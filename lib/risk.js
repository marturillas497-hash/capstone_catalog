/**
 * Determines risk level from the top cosine similarity score.
 * Boundaries use strict operators to eliminate ambiguity at boundary values.
 */
export function getRiskLevel(score) {
  if (score >= 0.85) return "RED";
  if (score >= 0.70) return "ORANGE";
  if (score >= 0.50) return "YELLOW";
  return "GREEN";
}

export const RISK_LABELS = {
  RED: "Critical Similarity",
  ORANGE: "High Relevance",
  YELLOW: "Moderate Relevance",
  GREEN: "Low Similarity",
};

export const RISK_LABELS_SHORT = {
  RED: "Critical",
  ORANGE: "High",
  YELLOW: "Moderate",
  GREEN: "Low",
};

/**
 * Bordered badge, used on report header cards and student list tables.
 * ORANGE uses the brand orange token, not stock Tailwind orange, since
 * IS Orange is already reserved for alert states in the design system.
 */
export const RISK_BADGE = {
  RED: "bg-red-50 border-red-200 text-red-700",
  ORANGE: "bg-orange/10 border-orange/30 text-orange-dark",
  YELLOW: "bg-yellow-50 border-yellow-200 text-yellow-700",
  GREEN: "bg-green-50 border-green-200 text-green-700",
};

/** Solid fill, used for the similarity score progress bar. */
export const RISK_BAR = {
  RED: "bg-red-500",
  ORANGE: "bg-orange",
  YELLOW: "bg-yellow-500",
  GREEN: "bg-green-500",
};

/** Compact pill, used for per-match badges in MatchesList. */
export const RISK_PILL = {
  RED: "text-red-700 bg-red-100",
  ORANGE: "text-orange-dark bg-orange/15",
  YELLOW: "text-yellow-700 bg-yellow-100",
  GREEN: "text-green-700 bg-green-100",
};

/** Display order for charts, most severe first. */
export const RISK_ORDER = ["RED", "ORANGE", "YELLOW", "GREEN"];

/** Hex fills for SVG charts, matching RISK_BAR's palette. */
export const RISK_HEX = {
  RED: "#DC2626",
  ORANGE: "#FF7A1F",
  YELLOW: "#EAB308",
  GREEN: "#16A34A",
};

/** Legend text for chart segments. */
export const RISK_LEGEND = {
  RED: "Red, critical",
  ORANGE: "Orange, high",
  YELLOW: "Yellow, moderate",
  GREEN: "Green, low",
};

/** Turns { RED: n, ... } counts into donut segments in severity order. */
export function riskSegments(counts) {
  return RISK_ORDER.map((key) => ({
    label: RISK_LEGEND[key],
    value: counts?.[key] ?? 0,
    color: RISK_HEX[key],
  }));
}
