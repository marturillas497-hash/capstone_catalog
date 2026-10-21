import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAbstractInput } from "@/lib/abstractInput";

// PATCH /api/admin/abstracts/[id]
// Admin may edit any abstract. Staff may edit only abstracts they added: the
// ownership check is part of the UPDATE itself (added_by = caller), so there is
// no gap between checking and writing. added_by is never changed by an edit.
// updated_by and updated_at record who last changed it.
export async function PATCH(request, { params }) {
  try {
    const auth = await requireActiveUser(["admin", "staff"]);
    if (auth.error) return auth.error;
    const { user, profile } = auth;

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = parseAbstractInput(body);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    let query = createAdminClient()
      .from("abstracts")
      .update({ ...parsed.value, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (profile.role === "staff") query = query.eq("added_by", user.id);

    const { data, error } = await query
      .select("id, title, accession_id, year, authors, keywords, added_by, updated_by, updated_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        const field = error.message.includes("title") ? "title" : "accession ID";
        return NextResponse.json({ error: `A record with this ${field} already exists` }, { status: 409 });
      }
      throw error;
    }

    if (!data) {
      return profile.role === "staff"
        ? NextResponse.json({ error: "You can only edit abstracts you added" }, { status: 403 })
        : NextResponse.json({ error: "Abstract not found" }, { status: 404 });
    }

    return NextResponse.json({ abstract: data });
  } catch (err) {
    console.error("[PATCH /api/admin/abstracts/[id]]", err);
    return NextResponse.json({ error: "Failed to update abstract" }, { status: 500 });
  }
}
