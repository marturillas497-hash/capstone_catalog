import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import { RISK_LABELS, RISK_BADGE as riskBadgeColor, RISK_BAR as riskBarColor } from "@/lib/risk";
import { parseAdvisory, isFallbackAdvisory, getFallbackMessage } from "@/lib/advisory";
import MatchesList from "@/components/shared/MatchesList";
import Link from "next/link";
import { ArrowLeft, Sparkles, Info, FileText } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default async function AdviserStudentReportPage({ params }) {
  const { id, reportId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "capstone_adviser") redirect("/login");

  const { data: meta } = await supabase
    .from("student_metadata")
    .select("profile_id, id_number, adviser_id")
    .eq("profile_id", id)
    .eq("adviser_id", user.id)
    .single();

  if (!meta) notFound();

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .single();

  // RLS reports_select_adviser ensures adviser can only read where adviser_id = auth.uid()
  const { data: report } = await supabase
    .from("similarity_reports")
    .select("*")
    .eq("id", reportId)
    .eq("student_id", id)
    .single();

  if (!report) notFound();

  const matches = report.results_json ?? [];
  const advisory = parseAdvisory(report.ai_recommendations);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8">

        <Link
          href={`/adviser/students/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          Back to {studentProfile?.full_name ?? "Student"}
        </Link>

        {/* Page header */}
        <PageHeader
          compact
          icon={FileText}
          title={report.input_title}
          subtitle={
            <>
              {studentProfile?.full_name} · {meta.id_number} · Submitted on{" "}
              {new Date(report.created_at).toLocaleDateString("en-PH", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </>
          }
        />

        {/* Header card */}
        <div className="bg-background shadow-neo neo-transition rounded-2xl p-6 mb-6">

          {report.risk_level && (
            <span className={`inline-block text-sm font-semibold px-3 py-1.5 rounded-full border mb-4 ${riskBadgeColor[report.risk_level]}`}>
              {RISK_LABELS[report.risk_level]}
            </span>
          )}

          {report.similarity_score !== null && (
            <div className="mb-5">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Similarity Score</span>
                <span>{(report.similarity_score * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${riskBarColor[report.risk_level]}`}
                  style={{ width: `${(report.similarity_score * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          )}

          <div className="pt-5 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Submitted Description
            </p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {report.input_description}
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-400 italic">Read-only view</span>
          </div>
        </div>

        {/* AI Advisory */}
        {report.ai_recommendations && (
          <div className="mb-6">
            <h2 className="font-sans font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-navy" strokeWidth={1.75} />
              AI Advisory
            </h2>

            <div className="space-y-3">
              {isFallbackAdvisory(report.ai_recommendations) ? (
                <div className="flex items-start gap-2 bg-orange/10 border border-orange/30 rounded-2xl px-4 py-3.5 text-sm text-orange-dark">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                  <p className="leading-relaxed">
                    {getFallbackMessage(report.ai_recommendations)}
                  </p>
                </div>
              ) : advisory ? (
                <>
                  {advisory.verdict && (
                    <div className="bg-background shadow-neo neo-transition rounded-2xl p-5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Verdict
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed indent-6">
                        {advisory.verdict}
                      </p>
                    </div>
                  )}

                  {advisory.criticalAnalysis && (
                    <div className="bg-background shadow-neo neo-transition rounded-2xl p-5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Critical Analysis of Overlap
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed indent-6">
                        {advisory.criticalAnalysis}
                      </p>
                    </div>
                  )}

                  {advisory.proposedTitles.length >= 1 && (
                    <div className="bg-background shadow-neo neo-transition rounded-2xl p-5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                        Proposed Unique Titles
                      </p>
                      <div className="divide-y divide-slate-100">
                        {advisory.proposedTitles.map((title, i) => (
                          <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                            <span className="text-xs font-medium text-slate-400 mt-0.5 min-w-[16px] shrink-0">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm text-slate-700 leading-snug">{title}</p>
                              {i === 2 && (
                                <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                                  includes AI integration
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {advisory.alternativeDirections.length >= 1 && (
                    <div className="bg-background shadow-neo neo-transition rounded-2xl p-5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                        Alternative Research Directions
                      </p>
                      <div className="space-y-3">
                        {advisory.alternativeDirections.map((direction, i) => (
                          <p key={i} className="text-sm text-slate-600 leading-relaxed">
                            {direction}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-background shadow-neo neo-transition rounded-2xl p-5">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {report.ai_recommendations}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {matches.length > 0 && (
          <div>
            <h2 className="font-sans font-semibold text-foreground mb-4">Top Matched Studies</h2>
            <MatchesList matches={matches} showAccessionNote />
          </div>
        )}
      </main>
    </div>
  );
}