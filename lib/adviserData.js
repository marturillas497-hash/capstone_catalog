import { getAdviserScanStats } from "@/lib/dashboardStats";

/*
 * Shared by /adviser and /adviser/students. Student and profile reads go
 * through the RLS-aware Supabase client; the per-student scan aggregates come
 * from one grouped pg query.
 */
export async function getAdviserOverview(supabase, adviserId) {
  const { data: studentMeta } = await supabase
    .from("student_metadata")
    .select("profile_id, id_number, year_level, section")
    .eq("adviser_id", adviserId);

  const profileIds = (studentMeta || []).map((s) => s.profile_id);

  let names = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles || []) names[p.id] = p.full_name;
  }

  const stats = await getAdviserScanStats(adviserId, profileIds);

  const students = (studentMeta || []).map((meta) => {
    const s = stats.studentMap[meta.profile_id];
    return {
      profile_id: meta.profile_id,
      full_name: names[meta.profile_id] || "Unknown",
      id_number: meta.id_number,
      year_level: meta.year_level,
      section: meta.section,
      report_count: s?.n ?? 0,
      latest_report_at: s?.latest_at ?? null,
      latest_risk: s?.latest_risk ?? null,
    };
  });

  const byRecent = (a, b) => {
    if (!a.latest_report_at) return 1;
    if (!b.latest_report_at) return -1;
    return new Date(b.latest_report_at) - new Date(a.latest_report_at);
  };
  students.sort(byRecent);

  // Latest-risk breakdown, one count per student rather than per scan.
  const latestRiskCounts = { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 };
  for (const s of students) {
    if (s.latest_risk in latestRiskCounts) latestRiskCounts[s.latest_risk]++;
  }

  return {
    students,
    riskCounts: stats.counts,
    latestRiskCounts,
    totalScans: stats.totalScans,
    ownScans: stats.ownScans,
  };
}
