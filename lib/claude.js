// Set ANTHROPIC_MODEL in Vercel to swap models without a code change.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const API_URL = "https://api.anthropic.com/v1/messages";

// The advisory runs about 800 tokens with thinking off. This leaves headroom
// without letting a runaway response burn credit.
const MAX_TOKENS = 1536;

/*
 * Thinking must stay off. Thinking tokens count toward MAX_TOKENS, so left on
 * it can use the whole budget and return no text at all, and it adds seconds
 * of delay. Haiku takes "disabled". Sonnet rejects that and asks for
 * "between_tools" instead (not yet verified in a real scan).
 */
function thinkingOff(model) {
  return model.includes("haiku") ? { type: "disabled" } : { type: "between_tools" };
}

/**
 * Makes one Claude call and waits up to timeoutMs for the answer. No retries:
 * on any failure or timeout this throws, and the caller falls back to the
 * canned advisory. timeoutMs must stay under the client's 45 second abort
 * (PRD F3.8). Plain fetch, so no SDK dependency. The API key is never logged.
 */
export async function generateText(prompt, { timeoutMs = 34_000 } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("No Anthropic API key is configured.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: thinkingOff(MODEL),
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new Error(`Anthropic API error ${res.status}: ${body?.error?.message ?? "no message"}`);
      err.status = res.status;
      err.type = body?.error?.type ?? "unknown";
      throw err;
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (!text.trim()) {
      const types = (data.content ?? []).map((block) => block.type).join(",") || "none";
      throw new Error(
        `Claude returned no text (stop_reason ${data.stop_reason}, blocks ${types}, out tokens ${data.usage?.output_tokens ?? "?"})`
      );
    }

    if (data.stop_reason === "max_tokens") {
      console.warn(`Claude ${MODEL} hit max_tokens, advisory may be cut off.`);
    }
    console.info(
      `Claude ${MODEL} ok in ${Date.now() - startedAt}ms ` +
        `(${data.usage?.input_tokens ?? "?"} in, ${data.usage?.output_tokens ?? "?"} out)`
    );
    return text;
  } catch (err) {
    if (controller.signal.aborted) {
      console.warn(`Claude ${MODEL} timed out after ${Date.now() - startedAt}ms.`);
    } else {
      console.warn(`Claude ${MODEL} failed (status ${err?.status ?? "n/a"}, type ${err?.type ?? "n/a"}).`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}