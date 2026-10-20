import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import { RISK_LABELS, RISK_BADGE as RISK_COLORS } from "@/lib/risk";
import { Plus, ScanLine } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default async function AdviserScansPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "capstone_adviser") redirect("/login");

  const { data: reports, count } = await supabase
    .from("similarity_reports")
    .select("id, input_title, similarity_score, risk_level, created_at", { count: "exact" })
    .eq("adviser_id", user.id)
    .filter("student_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8">

        <PageHeader
          variant="stats"
          title="My Scans"
          subtitle="Your own similarity scan history. This does not include scans submitted by your assigned students."
          icon={ScanLine}
          iconBg="bg-navy"
        />

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-background shadow-neo neo-transition rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Total Scans</p>
            <p className="font-display text-3xl text-navy">{count ?? 0}</p>
          </div>
          <div className="bg-background shadow-neo neo-transition rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Latest Risk</p>
            <p className="font-display text-3xl text-navy">
              {reports?.[0]?.risk_level ?? "—"}
            </p>
          </div>
          <div className="col-span-2 md:col-span-1 bg-navy rounded-xl p-4 flex flex-col justify-between">
            <p className="text-xs text-white mb-3">Ready to check a new topic?</p>
            <a
              href="/submit"
              className="inline-flex items-center justify-center gap-2 bg-gold text-navy text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gold-light transition"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              New Similarity Scan
            </a>
          </div>
        </div>

        {/* Recent reports */}
        <div>
          <h2 className="font-sans font-semibold text-foreground mb-4">
            Recent Scans
          </h2>

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
                  href={`/adviser/report/${report.id}`}
                  className="block bg-background shadow-neo hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {report.input_title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(report.created_at).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    {report.risk_level && (
                      <span
                        className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${
                          RISK_COLORS[report.risk_level]
                        }`}
                      >
                        {RISK_LABELS[report.risk_level]}
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