import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { RISK_LABELS, RISK_BADGE as riskBadgeColor } from "@/lib/risk";
import PageHeader from "@/components/shared/PageHeader";

export default async function AdviserStudentPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "capstone_adviser") redirect("/login");

  // Confirms this student is explicitly assigned to the logged in adviser,
  // mirrors the RLS policy on similarity_reports rather than trusting the URL alone.
  const { data: meta } = await supabase
    .from("student_metadata")
    .select("profile_id, id_number, year_level, section, adviser_id")
    .eq("profile_id", id)
    .eq("adviser_id", user.id)
    .single();

  if (!meta) notFound();

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .single();

  if (!studentProfile) notFound();

  const { data: reports } = await supabase
    .from("similarity_reports")
    .select("id, input_title, similarity_score, risk_level, created_at")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8">

        <Link
          href="/adviser"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          Back to My Students
        </Link>

        <PageHeader
          title={studentProfile.full_name}
          subtitle={
            <>
              {meta.id_number}
              {meta.year_level && ` · ${meta.year_level}`}
              {meta.section && ` — Section ${meta.section}`}
            </>
          }
          icon={GraduationCap}
          iconBg="bg-navy"
        />

        <div>
          <h2 className="font-sans font-semibold text-foreground mb-4">
            Similarity Scans
          </h2>

          {!reports || reports.length === 0 ? (
            <div className="bg-background shadow-neo neo-transition rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">
                This student has not run any similarity scans yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/adviser/students/${id}/report/${report.id}`}
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
                        className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${riskBadgeColor[report.risk_level]}`}
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}