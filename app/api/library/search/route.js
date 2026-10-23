import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { isValidEmbedding } from "@/lib/embedding";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/library/search
// Semantic library search via pgvector match_abstracts.
// Called when the user submits a 3+ word query on the /library page.
// The embedding is generated client-side and sent in the request body.
// Calls match_abstracts with the service role. That function is not executable by anon or authenticated.

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
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("match_abstracts", {
      query_embedding: embedding,
      match_threshold: LIBRARY_SEARCH_THRESHOLD,
      match_count: matchCount,
    });
    if (error) throw error;

    let results = data ?? [];

    // match_abstracts does not return attribution. Admin only: one small
    // lookup so the library can show and filter by who added each result.
    if (auth.profile.role === "admin" && results.length > 0) {
      const { data: rows } = await admin
        .from("abstracts")
        .select("id, added_by")
        .in("id", results.map((r) => r.id));
      const addedBy = new Map((rows ?? []).map((r) => [r.id, r.added_by]));
      results = results.map((r) => ({ ...r, added_by: addedBy.get(r.id) ?? null }));
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    console.error("Library search error:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
