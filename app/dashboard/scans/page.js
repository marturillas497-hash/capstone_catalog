import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import { RISK_LABELS_SHORT, RISK_BADGE, RISK_BAR, RISK_ORDER } from "@/lib/risk";
import { getStudentScanStats } from "@/lib/dashboardStats";
import { Plus, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

// Builds a link that keeps the active risk filter and omits defaults.
function href({ page = 1, risk = null }) {
  const params = new URLSearchParams();
  if (risk) params.set("risk", risk);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/scans?${qs}` : "/dashboard/scans";
}

export default async function StudentScansPage({ searchParams }) {
  const { page: pageParam, risk: riskParam } = await searchParams;
  const risk = RISK_ORDER.includes(riskParam) ? riskParam : null;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, stats] = await Promise.all([
    supabase.from("profiles").select("full_name, role, status").eq("id", user.id).single(),
    getStudentScanStats(user.id),
  ]);

  if (!profile || profile.role !== "student") redirect("/login");

  // The aggregate already has per-risk counts, so no second count query is needed.
  const total = risk ? stats.counts[risk] : stats.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(parseInt(pageParam, 10) || 1, 1), totalPages);

  let reports = [];
  if (total > 0) {
    let query = supabase
      .from("similarity_reports")
      .select("id, input_title, similarity_score, risk_level, created_at")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (risk) query = query.eq("risk_level", risk);
    ({ data: reports = [] } = await query);
  }

  const pill = (active) =>
    `text-xs font-semibold px-3 py-1.5 rounded-full neo-transition ${
      active ? "bg-navy text-white" : "bg-background shadow-neo text-slate-600 hover:shadow-neo-hover"
    }`;

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8">
        <PageHeader
          variant="stats"
          crumbs={["Dashboard", "My Scans"]}
          title="My Scans"
          icon={Clock}
          subtitle="Every similarity scan you have run, newest first."
          badge={
            stats.total > 0 && (
              <span className="text-sm font-semibold text-white bg-navy rounded-full px-2.5 py-0.5">
                {stats.total}
              </span>
            )
          }
          actions={
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 bg-gold text-navy text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gold-light transition"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              New Similarity Scan
            </Link>
          }
        />

        <div className="flex flex-wrap gap-2 mb-6">
          <Link href={href({})} className={pill(!risk)}>
            All ({stats.total})
          </Link>
          {RISK_ORDER.map((level) => (
            <Link key={level} href={href({ risk: level })} className={pill(risk === level)}>
              {RISK_LABELS_SHORT[level]} ({stats.counts[level]})
            </Link>
          ))}
        </div>

        {reports.length === 0 ? (
          <div className="bg-background shadow-neo rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">
              {risk
                ? "No scans at this risk level."
                : "No scans yet. Run your first similarity check to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/dashboard/report/${report.id}`}
                className="relative block overflow-hidden bg-background shadow-neo hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition rounded-xl p-4 pl-5"
              >
                {report.risk_level && (
                  <span className={`absolute left-0 inset-y-0 w-1.5 ${RISK_BAR[report.risk_level]}`} />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {report.input_title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(report.created_at).toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {report.risk_level && (
                    <span
                      className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${RISK_BADGE[report.risk_level]}`}
                    >
                      {RISK_LABELS_SHORT[report.risk_level]}
                    </span>
                  )}
                </div>
                {report.similarity_score !== null && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${RISK_BAR[report.risk_level] ?? "bg-navy"}`}
                        style={{ width: `${Math.min(report.similarity_score * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {(report.similarity_score * 100).toFixed(1)}% top match
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-between mt-6" aria-label="Pagination">
            {page > 1 ? (
              <Link href={href({ page: page - 1, risk })} className={`${pill(false)} inline-flex items-center gap-1`}>
                <ChevronLeft className="w-4 h-4" strokeWidth={1.75} /> Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={href({ page: page + 1, risk })} className={`${pill(false)} inline-flex items-center gap-1`}>
                Older <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
