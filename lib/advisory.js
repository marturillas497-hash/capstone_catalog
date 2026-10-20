/**
 * Sentinel prefix marking ai_recommendations text as a short fallback notice
 * (the AI call failed or timed out) rather than a full AI-generated advisory.
 * Saved directly into the report row, so this is detectable on every future
 * page load, not just immediately after the redirect that created it.
 */
const FALLBACK_PREFIX = "FALLBACK_ADVISORY::";

/**
 * True if the saved ai_recommendations text is a short fallback notice
 * rather than a full four-section advisory. Report pages should check this
 * BEFORE calling parseAdvisory, and render a lightweight notice instead of
 * the four advisory cards when true.
 */
export function isFallbackAdvisory(text) {
  return typeof text === "string" && text.startsWith(FALLBACK_PREFIX);
}

/**
 * Strips the sentinel prefix and returns the plain message to display.
 * Returns null if the text is not a fallback advisory.
 */
export function getFallbackMessage(text) {
  if (!isFallbackAdvisory(text)) return null;
  return text.slice(FALLBACK_PREFIX.length).trim();
}

/**
 * Builds the sentinel-prefixed text saved for a fallback advisory.
 * Used by /api/analyze when the AI call fails or times out.
 */
export function buildFallbackAdvisoryText(message) {
  return `${FALLBACK_PREFIX}${message}`;
}

/**
 * Parses the structured AI advisory text into four named sections.
 * Returns null if the text is missing, is a fallback advisory (see
 * isFallbackAdvisory), or none of the expected headings are found — the
 * last case triggers the raw text fallback on report pages.
 */
export function parseAdvisory(text) {
  if (!text || isFallbackAdvisory(text)) return null;

  const result = {
    verdict: "",
    criticalAnalysis: "",
    proposedTitles: [],
    alternativeDirections: [],
  };

  const headingPattern =
    /(VERDICT|CRITICAL ANALYSIS OF OVERLAP|PROPOSED UNIQUE TITLES|ALTERNATIVE RESEARCH DIRECTIONS)/;

  const parts = text.split(headingPattern);

  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const content = (parts[i + 1] || "").trim();

    if (heading === "VERDICT") {
      result.verdict = content;
    } else if (heading === "CRITICAL ANALYSIS OF OVERLAP") {
      result.criticalAnalysis = content;
    } else if (heading === "PROPOSED UNIQUE TITLES") {
      // Capped at 3: the prompt asks for exactly 3, and if the AI ever repeats
      // its list the extra copies must not reach the student.
      result.proposedTitles = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[1-3]\./.test(l))
        .map((l) => l.replace(/^[1-3]\.\s*/, "").trim())
        .slice(0, 3);
    } else if (heading === "ALTERNATIVE RESEARCH DIRECTIONS") {
      const numbered = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[1-3]\./.test(l))
        .map((l) => l.replace(/^[1-3]\.\s*/, "").trim())
        .slice(0, 3);
      // Fallback for the rare case the AI doesn't number them as instructed —
      // better to show something than an empty section.
      result.alternativeDirections =
        numbered.length > 0
          ? numbered
          : content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    }
  }

  const hasContent =
    result.verdict ||
    result.criticalAnalysis ||
    result.proposedTitles.length >= 1 ||
    result.alternativeDirections.length >= 1;

  return hasContent ? result : null;
}

/**
 * Derives a risk level string from a raw cosine similarity score.
 * Used for per-match coloring in the Critical Analysis table,
 * independent of the report-level risk_level stored in the database.
 */
export function getMatchRisk(score) {
  if (score >= 0.85) return "RED";
  if (score >= 0.70) return "ORANGE";
  if (score >= 0.50) return "YELLOW";
  return "GREEN";
}