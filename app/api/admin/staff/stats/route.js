import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { manilaMonthStartISO } from "@/lib/manilaTime";

// GET /api/admin/staff/stats
// Admin only. Abstracts added per staff member: this Manila month and all time.
// One aggregate query, sorted by this month's count.
export async function GET() {
  try {
    const auth = await requireActiveUser(["admin"]);
    if (auth.error) return auth.error;

    const { data, error } = await createAdminClient().rpc("staff_contribution_stats", {
      p_month_start: manilaMonthStartISO(),
    });
    if (error) throw error;

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/staff/stats]", err);
    return NextResponse.json({ error: "Failed to load staff stats" }, { status: 500 });
  }
}
