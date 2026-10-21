import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/users/students
// Paginated, searched, sorted, and filtered list of registered students
// for the Students tab of /admin/users (F16.1, F16.2, F16.3).
//
// Runs the admin_list_students Postgres function with the service role. The
// double join to profiles, the filters, and the sorting all live in SQL, and
// every value is a bound argument, so no filter string is ever built from
// user input.

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
    const adviserId = searchParams.get("adviserId") || "";
    const yearLevel = searchParams.get("yearLevel") || "";
    const section = searchParams.get("section") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const { data, error } = await createAdminClient().rpc("admin_list_students", {
      p_q: q || null,
      p_status: status || null,
      p_adviser: adviserId || null,
      p_year: yearLevel || null,
      p_section: section || null,
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
    console.error("[GET /api/admin/users/students]", err);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}