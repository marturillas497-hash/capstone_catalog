import { getPool } from "@/lib/db";

/*
 * Aggregate queries for the three dashboards. These run over the direct pg
 * connection so counts come from GROUP BY instead of pulling every report row
 * into JavaScript. Callers must pass ids taken from the verified session or
 * from RLS-filtered reads, never from request input.
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

/* Student: risk breakdown, total scans, and scans used today (PHT day). */
export async function getStudentScanStats(studentId) {
  const { rows } = await getPool().query(
    `SELECT risk_level,
            count(*)::int AS n,
            count(*) FILTER (
              WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'
            )::int AS today
     FROM similarity_reports
     WHERE student_id = $1
     GROUP BY risk_level`,
    [studentId]
  );
  const counts = toCounts(rows);
  const today = rows.reduce((a, r) => a + r.today, 0);
  return { counts, total: sum(counts), today };
}

/* Adviser: aggregates over assigned students plus the adviser's own scans. */
export async function getAdviserScanStats(adviserId, studentIds) {
  const pool = getPool();
  const [perStudent, byRisk, own] = await Promise.all([
    studentIds.length
      ? pool.query(
          `SELECT student_id,
                  count(*)::int AS n,
                  max(created_at) AS latest_at,
                  (array_agg(risk_level ORDER BY created_at DESC))[1] AS latest_risk
           FROM similarity_reports
           WHERE student_id = ANY($1::uuid[])
           GROUP BY student_id`,
          [studentIds]
        )
      : { rows: [] },
    studentIds.length
      ? pool.query(
          `SELECT risk_level, count(*)::int AS n
           FROM similarity_reports
           WHERE student_id = ANY($1::uuid[])
           GROUP BY risk_level`,
          [studentIds]
        )
      : { rows: [] },
    pool.query(
      `SELECT count(*)::int AS n
       FROM similarity_reports
       WHERE adviser_id = $1 AND student_id IS NULL`,
      [adviserId]
    ),
  ]);

  const counts = toCounts(byRisk.rows);
  const studentMap = {};
  for (const r of perStudent.rows) studentMap[r.student_id] = r;

  return {
    studentMap,
    counts,
    totalScans: sum(counts),
    ownScans: own.rows[0]?.n ?? 0,
  };
}

/* Admin: risk breakdown across all reports and account counts by status. */
export async function getAdminStats() {
  const pool = getPool();
  const [risk, accounts] = await Promise.all([
    pool.query(`SELECT risk_level, count(*)::int AS n FROM similarity_reports GROUP BY risk_level`),
    pool.query(
      `SELECT role, status, count(*)::int AS n
       FROM profiles
       WHERE role <> 'admin'
       GROUP BY role, status`
    ),
  ]);

  const a = { activeStudents: 0, activeAdvisers: 0, pendingAdvisers: 0, suspended: 0 };
  for (const r of accounts.rows) {
    if (r.status === "suspended") a.suspended += r.n;
    else if (r.status === "active" && r.role === "student") a.activeStudents += r.n;
    else if (r.status === "active" && r.role === "capstone_adviser") a.activeAdvisers += r.n;
    else if (r.status === "pending" && r.role === "capstone_adviser") a.pendingAdvisers += r.n;
  }

  const counts = toCounts(risk.rows);
  return { risk: counts, totalReports: sum(counts), accounts: a };
}
