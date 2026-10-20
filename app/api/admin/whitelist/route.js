import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFilterValue } from "@/lib/postgrest";
import { STUDENT_ID_PATTERN, MAX_WHITELIST_ROWS, MAX_NAME_LENGTH, normalizeName, isValidName } from "@/lib/constants";

const PAGE_SIZE = 25;

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const sort = searchParams.get("sort") || "date";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const from = (page - 1) * PAGE_SIZE;

    const SORT_MAP = {
      name: { column: "full_name", ascending: true },
      id: { column: "id_number", ascending: true },
      date: { column: "created_at", ascending: false },
    };
    const { column, ascending } = SORT_MAP[sort] || SORT_MAP.date;

    const admin = createAdminClient();

    /*
     * id is a unique tie-breaker. A bulk CSV import gives many rows the same
     * created_at, and without it rows can repeat or vanish across pages.
     */
    let query = admin
      .from("student_whitelist")
      .select("id, id_number, full_name, created_at", { count: "exact" })
      .order(column, { ascending })
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (q) {
      const safe = sanitizeFilterValue(q);
      query = query.or(`id_number.ilike.%${safe}%,full_name.ilike.%${safe}%`);
    }

    const { data, count, error } = await query;

    /* Page is past the end, so the client clamps back to a valid page. */
    if (error?.code === "PGRST103") {
      return NextResponse.json({ entries: [], page, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
    }
    if (error) throw error;

    const total = count ?? 0;
    return NextResponse.json({
      entries: data,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    console.error("[GET /api/admin/whitelist]", err);
    return NextResponse.json({ error: "Failed to fetch whitelist" }, { status: 500 });
  }
}

// Accepts { rows: [{ id_number, full_name }, ...] }, already parsed and
// reviewed by the user in the /admin/whitelist preview step. Re-validates
// server-side rather than trusting the client blindly, since this endpoint
// can be called directly regardless of what the UI enforces.
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

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : null;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }
    if (rows.length > MAX_WHITELIST_ROWS) {
      return NextResponse.json(
        { error: `Too many rows. The limit is ${MAX_WHITELIST_ROWS} per upload.` },
        { status: 400 }
      );
    }

    const cleaned = [];
    const seen = new Set();
    for (const row of rows) {
      const id_number = typeof row.id_number === "string" ? row.id_number.trim() : "";
      const full_name = typeof row.full_name === "string" ? normalizeName(row.full_name) : "";

      if (!id_number) {
        return NextResponse.json(
          { error: "One or more rows is missing a student ID. Fix the file and re-upload." },
          { status: 400 }
        );
      }
      if (!STUDENT_ID_PATTERN.test(id_number)) {
        return NextResponse.json(
          { error: `Student ID "${id_number}" must contain numbers only. Fix the file and re-upload.` },
          { status: 400 }
        );
      }
      if (!full_name) {
        return NextResponse.json(
          { error: "One or more rows is missing a name. Fix the file and re-upload." },
          { status: 400 }
        );
      }
      if (!isValidName(full_name)) {
        return NextResponse.json(
          { error: `Name "${full_name}" is not valid. Names need letters, no numbers, and at most ${MAX_NAME_LENGTH} characters.` },
          { status: 400 }
        );
      }
      if (seen.has(id_number)) {
        return NextResponse.json(
          { error: `Student ID ${id_number} appears more than once in this upload. Fix the file and re-upload.` },
          { status: 400 }
        );
      }
      seen.add(id_number);
      cleaned.push({ id_number, full_name });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("student_whitelist")
      .upsert(cleaned, { onConflict: "id_number" });

    if (error) throw error;

    return NextResponse.json({ ok: true, count: cleaned.length });
  } catch (err) {
    console.error("[POST /api/admin/whitelist]", err);
    return NextResponse.json({ error: "Failed to upload whitelist" }, { status: 500 });
  }
}