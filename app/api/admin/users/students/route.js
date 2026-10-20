import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPool } from "@/lib/db";

// GET /api/admin/users/students
// Paginated, searched, sorted, and filtered list of registered students
// for the Students tab of /admin/users (F16.1, F16.2, F16.3).
//
// Uses the direct pg connection rather than the Supabase client's embedded
// resource syntax. student_metadata has two foreign keys to profiles
// (profile_id and adviser_id, see PRD Section 9.2 and 13.2), and this query
// needs to join both at once while also filtering and sorting on columns
// that live on the joined profiles row, not on student_metadata itself.
// Raw parameterized SQL avoids the embedded-filter and ambiguous-FK
// failure modes already documented twice in this project for exactly
// this kind of double join, and also avoids ever building a filter
// string from user input, since every value here is a bound parameter.

const PAGE_SIZE = 25;

const SORT_MAP = {
  name: "p.full_name ASC",
  date: "sm.created_at DESC",
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
    const adviserId = searchParams.get("adviserId") || "";
    const yearLevel = searchParams.get("yearLevel") || "";
    const section = searchParams.get("section") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`p.full_name ILIKE $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }
    if (adviserId) {
      params.push(adviserId);
      conditions.push(`sm.adviser_id = $${params.length}`);
    }
    if (yearLevel) {
      params.push(yearLevel);
      conditions.push(`sm.year_level = $${params.length}`);
    }
    if (section) {
      params.push(section);
      conditions.push(`sm.section = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(PAGE_SIZE);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const sql = `
      SELECT
        sm.profile_id,
        sm.id_number,
        sm.year_level,
        sm.section,
        sm.adviser_id,
        sm.created_at,
        p.full_name,
        p.status,
        adv.full_name AS adviser_name,
        count(*) OVER() AS full_count
      FROM student_metadata sm
      JOIN profiles p ON p.id = sm.profile_id
      LEFT JOIN profiles adv ON adv.id = sm.adviser_id
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
    console.error("[GET /api/admin/users/students]", err);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}