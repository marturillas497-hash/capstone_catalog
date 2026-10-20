// Shared shape check for embeddings sent from the browser.
// 384 matches Xenova/all-MiniLM-L6-v2 and the vector(384) column on
// abstracts.embedding. If the model ever changes, change it here only.
export const EMBEDDING_DIMENSIONS = 384;

export function isValidEmbedding(value) {
  return (
    Array.isArray(value) &&
    value.length === EMBEDDING_DIMENSIONS &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}
