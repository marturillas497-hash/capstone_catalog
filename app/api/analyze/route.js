import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmbedding } from "@/lib/embedding";
import { getPool } from "@/lib/db";
import { getRiskLevel } from "@/lib/risk";
import { buildFallbackAdvisoryText } from "@/lib/advisory";
import { generateText } from "@/lib/claude";

// The AI call budget (34s) plus the DB work must fit inside this and the 45s client timeout.
export const maxDuration = 60;

const DAILY_LIMIT = 5;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 5000;

async function getRemainingScans(userId, role) {
  const pool = getPool();

  let result;
  if (role === "student") {
    result = await pool.query(
      `SELECT COUNT(*) FROM similarity_reports
       WHERE student_id = $1
         AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'`,
      [userId]
    );
  } else {
    result = await pool.query(
      `SELECT COUNT(*) FROM similarity_reports
       WHERE adviser_id = $1
         AND student_id IS NULL
         AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'`,
      [userId]
    );
  }

  const used = parseInt(result.rows[0].count, 10);
  return DAILY_LIMIT - used;
}

// Per-risk-level guidance injected into the prompt. Keeping this as data
// rather than four full prompt variants is what makes the risk-aware
// behavior maintainable: one sentence to edit per band, not four prompts.
const VERDICT_GUIDANCE = {
  RED: "State plainly that this topic overlaps too heavily with existing studies as it is currently scoped and needs a real change in function, beneficiary, or scope to stand apart. If the student still wants to pursue this exact idea after reading the analysis below, tell them directly that their next step is a conversation with their capstone adviser.",
  ORANGE: "State that the topic overlaps strongly with existing studies and needs a specific pivot, such as a narrower function, a different beneficiary, or a different scope, to stand apart from what already exists.",
  YELLOW: "State that the topic shares some themes with existing studies and would stand apart with one clear change: a more specific function, beneficiary, or record type not yet covered by similar studies.",
  GREEN: "State that the topic is distinct from the existing library. Focus entirely on making the scope more concrete. Do not mention duplication or overlap, since none was found.",
};

const OVERLAP_GUIDANCE = {
  GREEN: "No meaningful overlap was found. Say this clearly in one or two sentences, never more than two. You may mention the closest study shown below only to note that you checked, not as a warning.",
  DEFAULT: "Explain in plain, simple language which specific parts of the proposal overlap with the studies shown below. Name each matching study you discuss by its exact title, accession ID, and similarity score, in the same order they are numbered above. Only describe what a study's abstract above actually says, never attribute features to it that the text does not mention. You do not need to discuss every match, but always discuss match #1, saying plainly if its overlap is only superficial. Never mention or explain any other study you leave out, and never use first person about your own choices. Maximum 5 sentences.",
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
function sanitizeAdvisoryText(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .trim();
}

async function generateAdvisory(inputTitle, inputDescription, matches, riskLevel) {
  const AI_TIMEOUT_MS = 34000;
  try {
    const matchContext = buildMatchContext(matches, riskLevel);
    const overlapInstruction = OVERLAP_GUIDANCE[riskLevel] ?? OVERLAP_GUIDANCE.DEFAULT;
    const verdictInstruction = VERDICT_GUIDANCE[riskLevel] ?? VERDICT_GUIDANCE.GREEN;

    const prompt = `You are an academic adviser for Bachelor of Science in Information Systems (BSIS) capstone projects at Makilala Institute of Science and Technology (MIST) in Makilala, North Cotabato, Philippines.

A student proposed this capstone topic:

Title: ${inputTitle}
Abstract/Problem Statement: ${inputDescription}

The system found a similarity risk level of ${riskLevel} based on these studies in the BSIS capstone library:

${matchContext}

RULES
- Use exactly these four uppercase headings, in this order: VERDICT, CRITICAL ANALYSIS OF OVERLAP, PROPOSED UNIQUE TITLES, ALTERNATIVE RESEARCH DIRECTIONS.
- Plain text only: no markdown, bullets, section numbers, greeting, or sign-off.
- Write in plain conversational English, like an adviser talking one-on-one to their advisee. No academic jargon or citation-style language. Contractions are fine. Address the student as you/your, never third person.
- You give feedback, you do not make decisions. Never say or imply that a topic is approved, rejected, accepted, denied, cleared, or permitted. Only the student's capstone adviser and panel decide that. Describe what you found, not what the student is allowed to do.
- VERDICT and CRITICAL ANALYSIS OF OVERLAP must be direct and confident, with no hedging (e.g. may, might, perhaps, could potentially, could consider). ALTERNATIVE RESEARCH DIRECTIONS follows its own tone rule below.
- Silently identify the proposal's core system type in one short phrase (e.g. an inventory management system) and do not print it. Every title and direction must be that same core system type, applied differently as instructed per section.
- Never name a real organization. Use a general type only (e.g. a small barangay office, a rural health unit). Every organization and scenario must be realistic for a small city or municipality in the Makilala or Kidapawan area of North Cotabato (no snow, no large-city-only infrastructure).
- Keep the system's function specific even though the organization is generic: one defined problem, one defined output, one defined user group.

VERDICT
Exactly two sentences. ${verdictInstruction}

CRITICAL ANALYSIS OF OVERLAP
${overlapInstruction}

PROPOSED UNIQUE TITLES
Exactly 3 titles, one per line, numbered 1, 2, 3, with no label or description. Each is 12-15 words and describes one system with one clear purpose (never a feasibility study, analysis, assessment, or review):
1. Same core system type, scoped to a narrower or different function or record type than the matched studies cover (never one their abstracts already name).
2. Same core system type, applied to a different sector or beneficiary group.
3. Same core system type, plus exactly one AI feature as its core differentiator that is genuinely useful to the system. Only one technology in this title.

ALTERNATIVE RESEARCH DIRECTIONS
Exactly 3 directions, one per line, numbered 1, 2, 3 (structure only, so never refer to the numbers in the text). Each is a different project the student can take on, applied to a function, beneficiary, or record type the matched studies don't cover, and to a sector or beneficiary that none of the three titles above uses. Write them as open options, not orders or predictions. Start each one with a different natural opening, for instance by leading with the sector or the beneficiary. Never use "You will" or "You must". Maximum 2 sentences each, flowing prose.`;

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

  try {
    const remaining = await getRemainingScans(user.id, profile.role);
    if (remaining <= 0) {
      return NextResponse.json(
        { error: "You have reached your daily scan limit. Your scans will reset tomorrow." },
        { status: 429 }
      );
    }

    const pool = getPool();
    const vectorStr = `[${embedding.join(",")}]`;

    const matchResult = await pool.query(
      `SELECT * FROM match_abstracts($1::vector, $2, $3)`,
      [vectorStr, 0, 5]
    );

    const matches = matchResult.rows;
    const topScore = matches.length > 0 ? matches[0].similarity : 0;
    const riskLevel = getRiskLevel(topScore);

    const advisory = await generateAdvisory(title, description, matches, riskLevel);

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