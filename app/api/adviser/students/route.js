import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/apiAuth";

export async function GET() {
  try {
    const auth = await requireActiveUser(["capstone_adviser"]);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const { data: studentMeta, error } = await supabase
      .from("student_metadata")
      .select("profile_id, id_number, year_level, section, adviser_id")
      .eq("adviser_id", user.id);

    if (error) throw error;

    if (!studentMeta || studentMeta.length === 0) {
      return NextResponse.json({ students: [] });
    }

    const profileIds = studentMeta.map((s) => s.profile_id);

    // The two lookups are independent, so run them together instead of back to back.
    const [{ data: profiles }, { data: reports }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, status").in("id", profileIds),
      supabase
        .from("similarity_reports")
        .select("student_id, created_at")
        .in("student_id", profileIds)
        .order("created_at", { ascending: false }),
    ]);

    const profileMap = {};
    for (const p of profiles || []) {
      profileMap[p.id] = p;
    }

    const reportCountMap = {};
    const latestReportMap = {};
    for (const r of reports || []) {
      if (!reportCountMap[r.student_id]) {
        reportCountMap[r.student_id] = 0;
        latestReportMap[r.student_id] = r.created_at;
      }
      reportCountMap[r.student_id]++;
    }

    const students = studentMeta.map((meta) => ({
      profile_id: meta.profile_id,
      full_name: profileMap[meta.profile_id]?.full_name || "Unknown",
      status: profileMap[meta.profile_id]?.status || "active",
      id_number: meta.id_number,
      year_level: meta.year_level,
      section: meta.section,
      report_count: reportCountMap[meta.profile_id] || 0,
      latest_report_at: latestReportMap[meta.profile_id] || null,
    }));

    students.sort((a, b) => {
      if (!a.latest_report_at) return 1;
      if (!b.latest_report_at) return -1;
      return new Date(b.latest_report_at) - new Date(a.latest_report_at);
    });

    return NextResponse.json({ students });
  } catch (err) {
    console.error("[GET /api/adviser/students]", err);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}
