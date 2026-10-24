import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Aggregate queries for the three dashboards. Each one is a Postgres function
 * (see supabase/migrations) called with the service role, so counts come from
 * GROUP BY instead of pulling every report row into JavaScript, and each
 * dashboard costs one round trip. Callers must pass ids taken from the verified
 * session or from RLS-filtered reads, never from request input.
 */

const emptyCounts = () => ({ RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 });

function toCounts(rows) {
  const counts = emptyCounts();
  for (const row of rows) {
    if (row.risk_level in counts) counts[row.risk_level] = row.n;
  }
  return counts;
}

const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

async function rpc(name, args) {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw error;
  return data;
}

/* Student: risk breakdown, total scans, and scans used today (PHT day). */
export async function getStudentScanStats(studentId) {
  const rows = await rpc("student_scan_stats", { p_student: studentId });
  const counts = toCounts(rows);
  const today = rows.reduce((a, r) => a + r.today, 0);
  return { counts, total: sum(counts), today };
}

/* Adviser: aggregates over assigned students plus the adviser's own scans. */
export async function getAdviserScanStats(adviserId, studentIds) {
  const data = await rpc("adviser_scan_stats", { p_adviser: adviserId, p_students: studentIds });

  const counts = toCounts(data.byRisk);
  const studentMap = {};
  for (const r of data.perStudent) studentMap[r.student_id] = r;

  return {
    studentMap,
    counts,
    totalScans: sum(counts),
    ownScans: data.own ?? 0,
  };
}

/*
 * Library-wide view analytics: totals plus top abstracts, aggregates only.
 * Safe for staff because no viewer data is returned. Week is a rolling 7 days.
 */
export async function getViewAnalytics() {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const data = await rpc("view_analytics", { p_week_start: weekStart });
  return { total: data.total, week: data.week, topAll: data.topAll, topWeek: data.topWeek };
}

/* Admin: risk breakdown across all reports and account counts by status. */
export async function getAdminStats() {
  const data = await rpc("admin_dashboard_stats", {});

  const a = { activeStudents: 0, activeAdvisers: 0, pendingAdvisers: 0, suspended: 0 };
  for (const r of data.accounts) {
    if (r.status === "suspended") a.suspended += r.n;
    else if (r.status === "active" && r.role === "student") a.activeStudents += r.n;
    else if (r.status === "active" && r.role === "capstone_adviser") a.activeAdvisers += r.n;
    else if (r.status === "pending" && r.role === "capstone_adviser") a.pendingAdvisers += r.n;
  }

  const counts = toCounts(data.risk);
  return { risk: counts, totalReports: sum(counts), accounts: a };
}
