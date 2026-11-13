import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmbedding } from "@/lib/embedding";
import { getRiskLevel } from "@/lib/risk";
import { buildFallbackAdvisoryText } from "@/lib/advisory";
import { generateText } from "@/lib/ai";
import { normalizeAiProfile } from "@/lib/aiProfile";

// The AI call budget (34s) plus the DB work must fit inside this and the 45s client timeout.
export const maxDuration = 60;

const DAILY_LIMIT = 5;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 5000;

async function getRemainingScans(userId, role) {
  const { data: used, error } = await createAdminClient().rpc("scans_used_today", {
    p_user: userId,
    p_is_student: role === "student",
  });
  if (error) throw error;
  return DAILY_LIMIT - used;
}

// Per-risk-level guidance injected into the prompt. Keeping this as data
// rather than four full prompt variants is what makes the risk-aware
// behavior maintainable: one sentence to edit per band, not four prompts.
// The wording that names what can change comes from the program's profile.
function buildVerdictGuidance(ai) {
  return {
    RED: `State plainly that this topic overlaps too heavily with existing studies as it is currently scoped and needs a real change in ${ai.uncovered}, or in scope, to stand apart. If the student still wants to pursue this exact idea after reading the analysis below, tell them directly that their next step is a conversation with their capstone adviser.`,
    ORANGE: `State that the topic overlaps strongly with existing studies and needs a specific pivot, such as a narrower or different ${ai.uncovered}, or a different scope, to stand apart from what already exists.`,
    YELLOW: `State that the topic shares some themes with existing studies and would stand apart with one clear change: a more specific ${ai.uncovered} not yet covered by similar studies.`,
    GREEN: "State that the topic is distinct from the existing library. Focus entirely on making the scope more concrete. Do not mention duplication or overlap, since none was found.",
  };
}

const OVERLAP_GUIDANCE = {
  GREEN: "No meaningful overlap was found. Say this clearly in one or two sentences, never more than two. You may mention the closest study shown below only to note that you checked, not as a warning.",
  DEFAULT: "Explain in plain, simple language how the student's proposal is similar to each study listed below, taking them in the order they are numbered above. Name each study by its exact title, accession ID, and similarity score. For each one, point to the specific features, users, methods, or purposes the proposal shares with that study's abstract, and say plainly if the overlap is only superficial. Only describe what a study's abstract above actually says, never attribute features to it that the text does not mention. The list may hold just one study, which is normal: never comment on how many studies are listed or considered. Never use first person about your own choices. Maximum 5 sentences.",
};

// Long enough to reach what a study actually builds, not just its background.
const ABSTRACT_SNIPPET_CHARS = 600;

function buildMatchContext(matches, riskLevel) {
  // Matches arrive sorted by similarity, so every filter here keeps a prefix
  // and the numbering still matches the order the report page shows.
  // GREEN: nothing shown is a meaningful overlap, so only the top 2 are sent.
  // Other bands: the top match plus any other match that is not GREEN on its
  // own score. Weaker matches invite the AI to manufacture a false overlap.
  const relevant =
    riskLevel === "GREEN"
      ? matches.slice(0, 2)
      : matches.filter((m, i) => i === 0 || getRiskLevel(m.similarity) !== "GREEN");
  return relevant
    .map((m, i) => {
      const abstract = m.abstract_text ?? "";
      const snippet =
        abstract.length > ABSTRACT_SNIPPET_CHARS
          ? `${abstract.slice(0, ABSTRACT_SNIPPET_CHARS)}...`
          : abstract;
      return `${i + 1}. Title: ${m.title}\n   Accession ID: ${m.accession_id ?? "N/A"}\n   Authors: ${m.authors ?? "Unknown"} (${m.year ?? "N/A"})\n   Abstract: ${snippet}\n   Similarity: ${(m.similarity * 100).toFixed(1)}%`;
    })
    .join("\n\n");
}

// Strips markdown the AI was told not to use but may emit anyway. Defense in
// depth alongside the prompt instruction. See PRD Section 21 note on why
// both layers are kept rather than relying on the prompt alone.
// Sentences about how many studies were listed or considered ("No additional
// studies are listed, so only this match is considered."). The prompt forbids
// them, this removes any that slip through.
const STUDY_COUNT_SENTENCE = new RegExp(
  [
    String.raw`[^.\n]*\b(?:other|remaining|additional|further)\b[^.\n]*\b(?:studies|study|matches)\b[^.\n]*\b(?:examined|discussed|reviewed|considered|analy[sz]ed)\b[^.\n]*\.[ \t]*`,
    String.raw`[^.\n]*\bonly (?:this|the (?:top|first)) (?:match|study)\b[^.\n]*\b(?:examined|discussed|reviewed|considered|analy[sz]ed)\b[^.\n]*\.[ \t]*`,
  ].join("|"),
  "gi"
);

function sanitizeAdvisoryText(text) {
  return text
    .replace(STUDY_COUNT_SENTENCE, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .trim();
}

async function generateAdvisory(inputTitle, inputDescription, matches, riskLevel, program) {
  const AI_TIMEOUT_MS = 34000;
  try {
    const matchContext = buildMatchContext(matches, riskLevel);
    const overlapInstruction = OVERLAP_GUIDANCE[riskLevel] ?? OVERLAP_GUIDANCE.DEFAULT;
    const guidance = buildVerdictGuidance(program.ai);
    const verdictInstruction = guidance[riskLevel] ?? guidance.GREEN;
    const ai = program.ai;
    const libraryName = program.code ? `${program.code} library` : "institution's library";

    const prompt = `You are an academic adviser for ${ai.discipline} at Makilala Institute of Science and Technology (MIST) in Makilala, North Cotabato, Philippines.

A student proposed this ${ai.topic}:

Title: ${inputTitle}
Abstract/Problem Statement: ${inputDescription}

The system found a similarity risk level of ${riskLevel} based on these studies in the ${libraryName}:

${matchContext}

RULES
- Use exactly these four uppercase headings, in this order: VERDICT, CRITICAL ANALYSIS OF OVERLAP, PROPOSED UNIQUE TITLES, ALTERNATIVE RESEARCH DIRECTIONS.
- Plain text only: no markdown, bullets, section numbers, greeting, or sign-off.
- Write in plain conversational English, like an adviser talking one-on-one to their advisee. No academic jargon or citation-style language. Contractions are fine. Address the student as you/your, never third person.
- You give feedback, you do not make decisions. Never say or imply that a topic is approved, rejected, accepted, denied, cleared, or permitted. Only the student's capstone adviser and panel decide that. Describe what you found, not what the student is allowed to do.
- VERDICT and CRITICAL ANALYSIS OF OVERLAP must be direct and confident, with no hedging (e.g. may, might, perhaps, could potentially, could consider). ALTERNATIVE RESEARCH DIRECTIONS follows its own tone rule below.
- ${ai.focus}
- Never name a real organization. Use a general type only (e.g. ${ai.org_examples}). Every organization and scenario must be realistic for a small city or municipality in the Makilala or Kidapawan area of North Cotabato (no snow, no large-city-only infrastructure).${ai.local ? ` ${ai.local}` : ""}
- ${ai.specific}
- Everything you suggest must be realistic for a small group of undergraduate students to finish within one academic year, using only what is available in the area.${ai.limits ? ` ${ai.limits}` : ""}

VERDICT
Exactly two sentences. ${verdictInstruction}

CRITICAL ANALYSIS OF OVERLAP
${overlapInstruction}

PROPOSED UNIQUE TITLES
Exactly 3 titles, one per line, numbered 1, 2, 3, with no label or description. Each is 12-15 words and ${ai.title_form}. No title may reuse the wording of a matched study title above, not even in a different order: change the subject words, not just the phrasing.
1. ${ai.titles[0]}
2. ${ai.titles[1]}
3. ${ai.titles[2]}

ALTERNATIVE RESEARCH DIRECTIONS
Exactly 3 directions, one per line, numbered 1, 2, 3 (structure only, so never refer to the numbers in the text). Each is a different ${ai.noun} the student can take on, applied to a ${ai.uncovered} the matched studies don't cover, and to a ${ai.varied} that none of the three titles above uses. Write them as open options, not orders or predictions. Start each one with a different natural opening, for instance by leading with the sector or the beneficiary. Never use "You will" or "You must". Maximum 2 sentences each, flowing prose.`;

    // One call, no retries. The provider module owns the timeout. Any failure lands in the catch below, which returns the fallback advisory.
    const text = await generateText(prompt, { timeoutMs: AI_TIMEOUT_MS });
    return { text: sanitizeAdvisoryText(text), usedFallback: false };
  } catch (err) {
    console.error("AI error:", err);
    return { text: generateFallbackAdvisory(riskLevel), usedFallback: true };
  }
}

const FALLBACK_MESSAGES = {
  RED: "This topic scores very high on similarity, which usually means one or more studies below already cover close to the same idea. Review the matches and consider a real pivot in function or beneficiary. If you still want to pursue this exact idea after reviewing them, your next step is talking directly with your capstone adviser.",
  ORANGE: "This topic overlaps strongly with existing studies in the library. Review the matches below and look for a narrower function or a different beneficiary group to set your proposal apart.",
  YELLOW: "This topic shares some themes with existing studies but isn't a clear duplicate. Review the matches below and see what specific angle would make your proposal stand fully on its own.",
  GREEN: "This topic doesn't show significant overlap with existing studies. The matches below are shown for reference, not as a warning.",
};

function generateFallbackAdvisory(riskLevel) {
  return buildFallbackAdvisoryText(
    `Our AI reviewer didn't respond in time to write a full written analysis for this topic. This only affects the written advisory — the similarity score and matched studies below were calculated independently of the AI and are fully valid. ${FALLBACK_MESSAGES[riskLevel]} Try running the scan again in a few minutes for a complete AI advisory.`
  );
}

export async function POST(request) {
  const auth = await requireActiveUser(["student", "capstone_adviser"]);
  if (auth.error) return auth.error;
  const { supabase, user, profile } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const embedding = body?.embedding;

  // Validate before touching the database or the AI call, so a bad request costs nothing.
  if (!title || !description) {
    return NextResponse.json({ error: "Title and abstract are required." }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Title is too long. Keep it under ${MAX_TITLE_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `Abstract is too long. Keep it under ${MAX_DESCRIPTION_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (!isValidEmbedding(embedding)) {
    return NextResponse.json({ error: "Invalid embedding." }, { status: 400 });
  }
  // A scan compares against the user's own program only.
  if (!profile.program_id) {
    return NextResponse.json(
      { error: "Your account has no program assigned. Please contact the librarian." },
      { status: 409 }
    );
  }

  try {
    const remaining = await getRemainingScans(user.id, profile.role);
    if (remaining <= 0) {
      return NextResponse.json(
        { error: "You have reached your daily scan limit. Your scans will reset tomorrow." },
        { status: 429 }
      );
    }

    const { data: matchRows, error: matchError } = await createAdminClient().rpc("match_abstracts", {
      query_embedding: embedding,
      match_threshold: 0,
      match_count: 5,
      p_program: profile.program_id,
    });
    if (matchError) throw matchError;

    const matches = matchRows ?? [];
    const topScore = matches.length > 0 ? matches[0].similarity : 0;
    const riskLevel = getRiskLevel(topScore);

    // Program-specific advice settings. If the lookup fails, the generic profile is used.
    const { data: programRow } = await createAdminClient()
      .from("programs")
      .select("code, ai_profile")
      .eq("id", profile.program_id)
      .single();
    const program = { code: programRow?.code ?? "", ai: normalizeAiProfile(programRow?.ai_profile) };

    const advisory = await generateAdvisory(title, description, matches, riskLevel, program);

    let studentId = null;
    let adviserId = null;

    if (profile.role === "student") {
      studentId = user.id;
      const { data: meta } = await supabase
        .from("student_metadata")
        .select("adviser_id")
        .eq("profile_id", user.id)
        .single();
      adviserId = meta?.adviser_id ?? null;
    } else {
      adviserId = user.id;
    }

    // Service role insert: clients have no INSERT policy on similarity_reports, so the
    // daily limit enforced above cannot be bypassed by writing rows directly from the browser.
    const { data: report, error: reportError } = await createAdminClient()
      .from("similarity_reports")
      .insert({
        student_id: studentId,
        adviser_id: adviserId,
        input_title: title,
        input_description: description,
        similarity_score: topScore,
        risk_level: riskLevel,
        ai_recommendations: advisory.text,
        results_json: matches,
        program_id: profile.program_id,
      })
      .select("id")
      .single();

    if (reportError) {
      console.error("Report insert error:", reportError);
      return NextResponse.json({ error: "Failed to save report." }, { status: 500 });
    }

    return NextResponse.json(
      { reportId: report.id, usedFallback: advisory.usedFallback },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/analyze]", err);
    return NextResponse.json(
      { error: "Something went wrong while running the scan. Please try again." },
      { status: 500 }
    );
  }
}