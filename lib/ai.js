// Provider-neutral chat completion client. Defaults to Groq. Any provider with
// an OpenAI-compatible /chat/completions endpoint (Cerebras, Mistral,
// OpenRouter, ...) works by changing AI_BASE_URL, AI_API_KEY and AI_MODEL only.
const BASE_URL = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const MODEL = process.env.AI_MODEL?.trim() || "openai/gpt-oss-120b";

// A normal advisory is about 800 output tokens. Reasoning models spend part of
// this budget thinking, so it leaves headroom without allowing a runaway answer.
const MAX_TOKENS = 2048;
const TEMPERATURE = 0.6;

/*
 * gpt-oss models reason before answering, and those tokens count toward
 * MAX_TOKENS and the daily token allowance. "low" keeps that small. Other
 * models reject this parameter, so it is only sent to gpt-oss.
 */
function reasoningParams(model) {
  return model.includes("gpt-oss") ? { reasoning_effort: "low" } : {};
}

/**
 * Makes one chat completion call and waits up to timeoutMs for the answer. No
 * retries: on any failure or timeout this throws, and the caller falls back to
 * the canned advisory. timeoutMs must stay under the client's 45 second abort
 * (PRD F3.8). Plain fetch, no SDK. The API key is never logged.
 */
export async function generateText(prompt, { timeoutMs = 34_000 } = {}) {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) throw new Error("No AI API key is configured (AI_API_KEY).");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        ...reasoningParams(MODEL),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new Error(`AI API error ${res.status}: ${body?.error?.message ?? "no message"}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? "";
    if (!text.trim()) {
      throw new Error(
        `AI returned no text (finish_reason ${choice?.finish_reason ?? "?"}, out tokens ${data.usage?.completion_tokens ?? "?"})`
      );
    }

    if (choice.finish_reason === "length") {
      console.warn(`AI ${MODEL} hit max_tokens, advisory may be cut off.`);
    }
    console.info(
      `AI ${MODEL} ok in ${Date.now() - startedAt}ms ` +
        `(${data.usage?.prompt_tokens ?? "?"} in, ${data.usage?.completion_tokens ?? "?"} out)`
    );
    return text;
  } catch (err) {
    if (controller.signal.aborted) {
      console.warn(`AI ${MODEL} timed out after ${Date.now() - startedAt}ms.`);
    } else {
      console.warn(`AI ${MODEL} failed (status ${err?.status ?? "n/a"}).`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
