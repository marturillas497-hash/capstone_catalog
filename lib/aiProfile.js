/*
 * Per-program settings for the AI advisory prompt. The real values live in
 * programs.ai_profile (see supabase/migrations). This file holds the shape, a
 * generic fallback for a program with no profile yet, and the cleaning step.
 * The profile text goes into the prompt, so it is clamped and type checked here
 * rather than trusted as is.
 */

export const DEFAULT_AI_PROFILE = {
  discipline: "research studies and capstone projects",
  topic: "research topic",
  focus:
    "Silently identify the proposal's core focus in one short phrase and do not print it. Every title and direction must keep that same core focus, applied differently as instructed per section.",
  title_form: "states one clear problem about one group of people or one setting, as a descriptive study title",
  titles: [
    "Same core focus, narrowed to a more specific aspect than the matched studies cover (never one their abstracts already name).",
    "Same core focus, applied to a different group of people or a different setting.",
    "Same core focus, adding exactly one extra factor that genuinely helps. Only one added factor in this title.",
  ],
  noun: "study",
  uncovered: "focus, group of respondents, or setting",
  varied: "group of respondents or setting",
  org_examples: "a barangay office",
  local: "",
  specific:
    "Keep every title and direction specific even though the setting is generic: one defined problem, one defined group of people, one defined setting.",
  limits: "",
};

const STRING_KEYS = [
  "discipline", "topic", "focus", "title_form", "noun", "uncovered",
  "varied", "org_examples", "local", "specific", "limits",
];
const MAX_LEN = 700;

export function normalizeAiProfile(raw) {
  const out = { ...DEFAULT_AI_PROFILE, titles: [...DEFAULT_AI_PROFILE.titles] };
  if (!raw || typeof raw !== "object") return out;

  for (const key of STRING_KEYS) {
    if (typeof raw[key] === "string" && raw[key].trim()) {
      out[key] = raw[key].trim().slice(0, MAX_LEN);
    }
  }
  if (
    Array.isArray(raw.titles) &&
    raw.titles.length === 3 &&
    raw.titles.every((t) => typeof t === "string" && t.trim())
  ) {
    out.titles = raw.titles.map((t) => t.trim().slice(0, MAX_LEN));
  }
  return out;
}
