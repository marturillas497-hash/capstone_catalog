import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DonutCard from "@/components/shared/DonutChart";
import { getAdviserOverview } from "@/lib/adviserData";
import { RISK_ORDER, RISK_BADGE, RISK_LABELS_SHORT, riskSegments } from "@/lib/risk";
import { Users, FileText, ScanLine, ArrowRight } from "lucide-react";

const TOP_STUDENTS = 5;

// Highest risk first, then most recent scan, so the short list surfaces the
// students who most need a conversation.
function bySeverity(a, b) {
  const ra = a.latest_risk ? RISK_ORDER.indexOf(a.latest_risk) : RISK_ORDER.length;
  const rb = b.latest_risk ? RISK_ORDER.indexOf(b.latest_risk) : RISK_ORDER.length;
  if (ra !== rb) return ra - rb;
  return new Date(b.latest_report_at || 0) - new Date(a.latest_report_at || 0);
}

export default async function AdviserPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "capstone_adviser") redirect("/login");

  const { students, riskCounts, latestRiskCounts, totalScans, ownScans } =
    await getAdviserOverview(supabase, user.id);

  const top = [...students].sort(bySeverity).slice(0, TOP_STUDENTS);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8">
        <PageHeader
          variant="banner"
          eyebrow="Adviser Portal"
          title="My Students"
          subtitle="Students who have assigned you as their capstone adviser."
        />

        <div className="flex flex-wrap gap-4 mb-6">
          <StatCard icon={Users} tone="navy" value={students.length} label="Assigned students" />
          <StatCard icon={FileText} tone="orange" value={totalScans} label="Student scans" />
          <StatCard icon={ScanLine} tone="green" value={ownScans} label="My own scans" />
        </div>

        <div className="flex flex-wrap gap-6 mb-6">
          <DonutCard
            title="Student scans by risk level"
            segments={riskSegments(riskCounts)}
            centerValue={totalScans}
            centerLabel={totalScans === 1 ? "scan" : "scans"}
          />
          <DonutCard
            title="Students by latest risk"
            segments={riskSegments(latestRiskCounts)}
            centerValue={students.length}
            centerLabel={students.length === 1 ? "student" : "students"}
          />
        </div>

        <div className="bg-background shadow-neo rounded-2xl p-6">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <h2 className="text-base font-bold text-navy">Students</h2>
            <span className="text-xs text-slate-400">Highest risk first</span>
          </div>

          {top.length === 0 ? (
            <p className="text-sm text-slate-500 py-6">
              No students have assigned you as their adviser yet.
            </p>
          ) : (
            <div>
              {top.map((s) => (
                <Link
                  key={s.profile_id}
                  href={`/adviser/students/${s.profile_id}`}
                  className="flex items-center justify-between gap-4 py-3.5 border-t border-slate-100 first:border-t-0 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.id_number}
                      {s.year_level && ` · ${s.year_level}`}
                      {s.section && `, Sec. ${s.section}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      {s.latest_report_at
                        ? `Last scan ${new Date(s.latest_report_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`
                        : "No scans yet"}
                    </span>
                    {s.latest_risk && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${RISK_BADGE[s.latest_risk]}`}>
                        {RISK_LABELS_SHORT[s.latest_risk]}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {students.length > 0 && (
            <Link
              href="/adviser/students"
              className="mt-3 pt-4 border-t border-slate-100 inline-flex w-full items-center gap-1 text-sm font-semibold text-navy hover:text-navy-light transition-colors"
            >
              View all students ({students.length})
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
