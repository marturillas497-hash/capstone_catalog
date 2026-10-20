import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { isValidEmbedding } from "@/lib/embedding";
import { getPool } from "@/lib/db";

// POST /api/library/search
// Semantic library search via pgvector match_abstracts.
// Called when the user submits a 3+ word query on the /library page.
// The embedding is generated client-side and sent in the request body.
// Uses a direct pg connection, PostgREST cannot pass JS arrays as vector type.

// Use a threshold of 0.3 for library search to filter out low-relevance noise.
// This is different from /api/analyze which uses 0 to capture all matches
// including weak GREEN ones for the full similarity report.
const LIBRARY_SEARCH_THRESHOLD = 0.3;
const DEFAULT_MATCH_COUNT = 10;
const MAX_MATCH_COUNT = 20;

export async function POST(request) {
  // Any active role may browse the library, admin included.
  const auth = await requireActiveUser();
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const embedding = body?.embedding;
  if (!isValidEmbedding(embedding)) {
    return NextResponse.json({ error: "Missing or invalid embedding." }, { status: 400 });
  }

  // matchCount comes from the client, so clamp it instead of trusting it.
  const requested = Number.parseInt(body?.matchCount, 10);
  const matchCount = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), MAX_MATCH_COUNT)
    : DEFAULT_MATCH_COUNT;

  try {
    const pool = getPool();
    const vectorStr = `[${embedding.join(",")}]`;

    const result = await pool.query(
      `SELECT * FROM match_abstracts($1::vector, $2, $3)`,
      [vectorStr, LIBRARY_SEARCH_THRESHOLD, matchCount]
    );

    return NextResponse.json({ results: result.rows }, { status: 200 });
  } catch (err) {
    console.error("Library search error:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
