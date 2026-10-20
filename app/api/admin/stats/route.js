import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminStats } from "@/lib/dashboardStats";

// GET /api/admin/stats
// Risk breakdown across all similarity reports and account counts by status,
// for the donut charts on /admin. Admin only, checked here because
// middleware.js does not run on /api routes.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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

    return NextResponse.json(await getAdminStats());
  } catch (err) {
    console.error("GET /api/admin/stats failed:", err.message);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
