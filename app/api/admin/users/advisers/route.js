import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/users/advisers
// Paginated, searched, sorted, and filtered list of registered advisers
// for the Advisers tab of /admin/users (F16.1, F16.2, F16.3, F16.9).
//
// profiles has no email column, only auth.users does, and the normal Supabase
// client cannot read auth.users at all. The admin_list_advisers Postgres
// function joins it (SECURITY DEFINER) and is executable by service_role only.
//
// Only active and suspended advisers are returned. Pending and rejected
// accounts belong to the Approvals workflow (F8), not to ongoing account
// management, so they are excluded here rather than filtered client side.

const PAGE_SIZE = 25;

const SORT_KEYS = ["name", "date"];

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const sort = SORT_KEYS.includes(searchParams.get("sort")) ? searchParams.get("sort") : "date";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const { data, error } = await createAdminClient().rpc("admin_list_advisers", {
      p_q: q || null,
      p_status: status || null,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw error;

    const total = data.length > 0 ? parseInt(data[0].full_count, 10) : 0;
    const rows = data.map(({ full_count, ...row }) => row);

    return NextResponse.json({
      rows,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    console.error("[GET /api/admin/users/advisers]", err);
    return NextResponse.json({ error: "Failed to fetch advisers" }, { status: 500 });
  }
}