import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPool } from "@/lib/db";

// GET /api/admin/users/advisers
// Paginated, searched, sorted, and filtered list of registered advisers
// for the Advisers tab of /admin/users (F16.1, F16.2, F16.3, F16.9).
//
// profiles has no email column, only auth.users does, and RLS cannot
// reach auth.users through the normal Supabase client at all. This uses
// the same direct pg connection already relied on elsewhere in this
// project to bypass PostgREST, joined straight to auth.users for email.
//
// Only active and suspended advisers are returned. Pending and rejected
// accounts belong to the Approvals workflow (F8), not to ongoing account
// management, so they are excluded here rather than filtered client side.

const PAGE_SIZE = 25;

const SORT_MAP = {
  name: "p.full_name ASC",
  date: "p.created_at DESC",
};

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
    const sort = SORT_MAP[searchParams.get("sort")] ? searchParams.get("sort") : "date";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const conditions = [`p.role = 'capstone_adviser'`, `p.status IN ('active', 'suspended')`];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`p.full_name ILIKE $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    params.push(PAGE_SIZE);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const sql = `
      SELECT
        p.id,
        p.full_name,
        p.status,
        p.created_at,
        u.email,
        count(*) OVER() AS full_count
      FROM profiles p
      JOIN auth.users u ON u.id = p.id
      ${whereClause}
      ORDER BY ${SORT_MAP[sort]}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const pool = getPool();
    const result = await pool.query(sql, params);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].full_count, 10) : 0;
    const rows = result.rows.map(({ full_count, ...row }) => row);

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