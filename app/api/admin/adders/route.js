import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/adders
// Admin only. Who has added abstracts (admin and staff) with their names and
// counts. Names are resolved here because students cannot read staff profiles.
export async function GET() {
  try {
    const auth = await requireActiveUser(["admin"]);
    if (auth.error) return auth.error;

    const { data, error } = await createAdminClient().rpc("abstract_adders");
    if (error) throw error;

    return NextResponse.json({ adders: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/adders]", err);
    return NextResponse.json({ error: "Failed to load contributors" }, { status: 500 });
  }
}
