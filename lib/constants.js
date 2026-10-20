// Shared enumerated value lists for student_metadata.year_level and
// student_metadata.section. These are fixed dropdown values, not free
// text, so any UI that reads or filters on them (currently /profile and
// /admin/users) must import from here rather than defining a local copy.
//
// Keeping one source of truth prevents drift between the write side
// (/profile, where a student sets these) and the read/filter side
// (/admin/users, where the admin filters on the exact stored string).
// A mismatched local copy on either side would silently produce filters
// that can never match anything, since student_metadata.year_level and
// student_metadata.section are matched with strict equality, not ILIKE.

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

// Mirrors the limit enforced server-side in /api/analyze. Used for display only.
export const DAILY_SCAN_LIMIT = 5;

// Digits only. Column stays text so leading zeros survive.
export const STUDENT_ID_PATTERN = /^\d+$/;

// Whitelist limits shared by the upload preview and both whitelist routes.
export const MAX_WHITELIST_ROWS = 3000;
export const MAX_NAME_LENGTH = 100;

// Collapses repeated spaces so "Juan  Dela Cruz" and "Juan Dela Cruz" match.
export const normalizeName = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

// Expects a normalized name. Needs a letter, no digits, and a sane length.
export const isValidName = (v) =>
  v.length <= MAX_NAME_LENGTH && /\p{L}/u.test(v) && !/\d/.test(v);
