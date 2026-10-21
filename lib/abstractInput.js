/*
 * Single place that validates the body of an abstract add or edit, used by both
 * POST /api/admin/abstracts and PATCH /api/admin/abstracts/[id].
 *
 * The browser computes the embedding and the server cannot recompute it, so we
 * at least require a real, normalized vector. all-MiniLM-L6-v2 output is
 * normalized by the client (length 1), which makes arbitrary or malformed
 * numbers easy to reject. It cannot prove the vector matches the text, so
 * added_by and updated_by remain the accountability trail.
 */

const MAX = { title: 500, abstract: 20000, authors: 500, accession: 40, keyword: 60, keywords: 20 };
const MIN_YEAR = 2000;
const EMBEDDING_DIMS = 384;
const NORM_TOLERANCE = 0.02;

const text = (v) => (typeof v === "string" ? v.trim() : "");

function isNormalizedVector(v) {
  if (!Array.isArray(v) || v.length !== EMBEDDING_DIMS) return false;
  let sumSquares = 0;
  for (const n of v) {
    if (typeof n !== "number" || !Number.isFinite(n)) return false;
    sumSquares += n * n;
  }
  return Math.abs(Math.sqrt(sumSquares) - 1) <= NORM_TOLERANCE;
}

/** Returns { error } or { value } with trimmed fields and the embedding as a pgvector string. */
export function parseAbstractInput(body) {
  const title = text(body?.title);
  const abstract_text = text(body?.abstract_text);
  const authors = text(body?.authors);
  const accession_id = text(body?.accession_id) || null;

  if (!title || !abstract_text) return { error: "Title and abstract text are required" };
  if (!authors) return { error: "Authors is required" };
  if (title.length > MAX.title) return { error: `Title must be ${MAX.title} characters or fewer` };
  if (abstract_text.length > MAX.abstract) return { error: `Abstract must be ${MAX.abstract} characters or fewer` };
  if (authors.length > MAX.authors) return { error: `Authors must be ${MAX.authors} characters or fewer` };
  if (accession_id && accession_id.length > MAX.accession) {
    return { error: `Accession ID must be ${MAX.accession} characters or fewer` };
  }

  const maxYear = new Date().getFullYear();
  let year = null;
  if (body?.year !== null && body?.year !== undefined && body?.year !== "") {
    year = Number(body.year);
    if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear) {
      return { error: `Year must be a whole year from ${MIN_YEAR} to ${maxYear}` };
    }
  }

  let keywords = [];
  if (body?.keywords !== undefined && body?.keywords !== null) {
    if (!Array.isArray(body.keywords) || body.keywords.length > MAX.keywords) {
      return { error: `Keywords must be a list of at most ${MAX.keywords}` };
    }
    keywords = body.keywords.map(text).filter(Boolean);
    if (keywords.some((k) => k.length > MAX.keyword)) {
      return { error: `Each keyword must be ${MAX.keyword} characters or fewer` };
    }
  }

  if (!isNormalizedVector(body?.embedding)) return { error: "Invalid embedding" };

  return {
    value: {
      title,
      abstract_text,
      authors,
      year,
      accession_id,
      keywords,
      embedding: `[${body.embedding.join(",")}]`,
    },
  };
}
