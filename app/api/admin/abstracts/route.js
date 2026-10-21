import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAbstractInput } from "@/lib/abstractInput";

// POST /api/admin/abstracts
// Adds an abstract. Admin and staff may call it. added_by is taken from the
// verified session, never from the request body, so it cannot be faked.
export async function POST(request) {
  try {
    const auth = await requireActiveUser(["admin", "staff"]);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await request.json().catch(() => null);
    const parsed = parseAbstractInput(body);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data, error } = await createAdminClient()
      .from("abstracts")
      .insert({ ...parsed.value, added_by: user.id })
      .select("id, title, accession_id, year, authors, keywords, added_by, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        const field = error.message.includes("title") ? "title" : "accession ID";
        return NextResponse.json({ error: `A record with this ${field} already exists` }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ abstract: data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/abstracts]", err);
    return NextResponse.json({ error: "Failed to add abstract" }, { status: 500 });
  }
}
