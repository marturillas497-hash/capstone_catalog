import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import StudentList from "../StudentList";
import { getAdviserOverview } from "@/lib/adviserData";
import { FileText, Users } from "lucide-react";

export default async function AdviserStudentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "capstone_adviser") redirect("/login");

  const { students, totalScans } = await getAdviserOverview(supabase, user.id);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10">
        <PageHeader
          crumbs={["My Students", "All students"]}
          title="All Students"
          icon={Users}
          subtitle="Search every student who has assigned you as their capstone adviser."
          badge={
            students.length > 0 && (
              <span className="text-sm font-semibold text-white bg-navy rounded-full px-2.5 py-0.5">
                {students.length}
              </span>
            )
          }
        >
          {students.length > 0 && (
            <p className="text-slate-500 text-xs mt-2 inline-flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
              {totalScans} total {totalScans === 1 ? "scan" : "scans"}
            </p>
          )}
        </PageHeader>
        <StudentList students={students} />
      </main>
    </div>
  );
}
