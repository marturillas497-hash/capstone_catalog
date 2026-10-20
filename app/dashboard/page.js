import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DonutCard from "@/components/shared/DonutChart";
import { RISK_LABELS_SHORT, RISK_BADGE, riskSegments } from "@/lib/risk";
import { getStudentScanStats } from "@/lib/dashboardStats";
import { DAILY_SCAN_LIMIT } from "@/lib/constants";
import { Plus, ScanLine, Clock, ShieldAlert, ArrowRight } from "lucide-react";

const RECENT_LIMIT = 5;
const RISK_TONE = { RED: "red", ORANGE: "orange", YELLOW: "gold", GREEN: "green" };

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "student") redirect("/login");

  const [{ data: meta }, { data: reports }, stats] = await Promise.all([
    supabase
      .from("student_metadata")
      .select("id_number, year_level, section")
      .eq("profile_id", user.id)
      .single(),
    supabase
      .from("similarity_reports")
      .select("id, input_title, similarity_score, risk_level, created_at")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    getStudentScanStats(user.id),
  ]);

  const latestRisk = reports?.[0]?.risk_level;
  const used = Math.min(stats.today, DAILY_SCAN_LIMIT);
  const left = DAILY_SCAN_LIMIT - used;

  const subtitle = [
    meta?.id_number,
    meta?.year_level && (meta?.section ? `${meta.year_level}, Section ${meta.section}` : meta.year_level),
  ]
    .filter(Boolean)
    .join(" · ") || "BSIS Student";

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8">
        <PageHeader
          variant="banner"
          eyebrow="Student Dashboard"
          title={`Welcome, ${profile.full_name.split(" ")[0]}`}
          subtitle={subtitle}
          actions={
            <a
              href="/submit"
              className="inline-flex items-center gap-2 bg-gold text-navy text-sm font-semibold px-[18px] py-3 rounded-xl hover:bg-gold-light transition"
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={1.75} />
              New Similarity Scan
            </a>
          }
        />

        <div className="flex flex-wrap gap-4 mb-6">
          <StatCard icon={ScanLine} tone="navy" value={stats.total} label="Total scans" />
          <StatCard
            icon={Clock}
            tone="orange"
            value={`${left} of ${DAILY_SCAN_LIMIT}`}
            label="Scans left today"
          />
          <StatCard
            icon={ShieldAlert}
            tone={latestRisk ? RISK_TONE[latestRisk] : "navy"}
            value={latestRisk ? RISK_LABELS_SHORT[latestRisk] : "None yet"}
            label="Latest risk"
          />
        </div>

        <div className="flex flex-wrap gap-6 mb-6">
          <DonutCard
            title="My scans by risk level"
            segments={riskSegments(stats.counts)}
            centerValue={stats.total}
            centerLabel={stats.total === 1 ? "scan" : "scans"}
          />
          <DonutCard
            title="Daily scan limit"
            segments={[
              { label: "Used today", value: used, color: "#003366" },
              { label: "Remaining", value: left, color: "#E2E8F0" },
            ]}
            centerValue={`${used}/${DAILY_SCAN_LIMIT}`}
            centerLabel="used"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy">Recent Scans</h2>
            {stats.total > RECENT_LIMIT && (
              <a
                href="/dashboard/scans"
                className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:text-navy-light transition"
              >
                View all {stats.total}
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </a>
            )}
          </div>

          {!reports || reports.length === 0 ? (
            <div className="bg-background shadow-neo neo-transition rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">
                No scans yet. Run your first similarity check to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <a
                  key={report.id}
                  href={`/dashboard/report/${report.id}`}
                  className="block bg-background shadow-neo hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {report.input_title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(report.created_at).toLocaleDateString("en-PH", {
                          timeZone: "Asia/Manila",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
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
                    <p className="text-xs text-slate-500 mt-2">
                      Top match: {(report.similarity_score * 100).toFixed(1)}% similarity
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
