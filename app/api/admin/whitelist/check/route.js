import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_WHITELIST_ROWS } from "@/lib/constants";

// Given a batch of id_number values from a CSV a user is about to upload,
// returns whichever of those ids already exist in student_whitelist, with
// their current full_name. The client uses this to classify each row as
// new, an overwrite (name would change), or unchanged (already correct)
// before the user confirms the upload. Also flags ids that already belong to
// a registered student. Read-only, nothing is written here.
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ existing: [] });
    }

    // Reject instead of truncating, a dropped tail would be misclassified as New.
    if (ids.length > MAX_WHITELIST_ROWS) {
      return NextResponse.json(
        { error: `Too many IDs. The limit is ${MAX_WHITELIST_ROWS} per check.` },
        { status: 400 }
      );
    }
    const safeIds = ids.filter((id) => typeof id === "string");

    /*
     * PostgREST puts .in() values in the URL and caps rows per response,
     * so query in chunks of 200 and run them in parallel.
     */
    const CHUNK = 200;
    const toChunks = (arr) => {
      const out = [];
      for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
      return out;
    };

    const admin = createAdminClient();
    const results = await Promise.all(
      toChunks(safeIds).map((c) =>
        admin.from("student_whitelist").select("id_number, full_name").in("id_number", c)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
    const existing = results.flatMap((r) => r.data || []);

    // Only ids already on the whitelist can belong to a registered student.
    const metaResults = await Promise.all(
      toChunks(existing.map((e) => e.id_number)).map((c) =>
        admin.from("student_metadata").select("id_number").in("id_number", c)
      )
    );
    const metaFailed = metaResults.find((r) => r.error);
    if (metaFailed) throw metaFailed.error;
    const registered = new Set(metaResults.flatMap((r) => r.data || []).map((r) => r.id_number));

    return NextResponse.json({
      existing: existing.map((e) => ({ ...e, registered: registered.has(e.id_number) })),
    });
  } catch (err) {
    console.error("[POST /api/admin/whitelist/check]", err);
    return NextResponse.json({ error: "Failed to check whitelist" }, { status: 500 });
  }
}