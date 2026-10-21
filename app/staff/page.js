import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import { manilaMonthStartISO } from "@/lib/manilaTime";
import { BookOpen, CalendarDays } from "lucide-react";

export default async function StaffDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "staff") redirect("/login");

  // Head-only counts: no rows are transferred. Served by abstracts_added_by_created_idx.
  const mine = () =>
    supabase.from("abstracts").select("id", { count: "exact", head: true }).eq("added_by", user.id);

  const [{ count: total }, { count: thisMonth }] = await Promise.all([
    mine(),
    mine().gte("created_at", manilaMonthStartISO()),
  ]);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8">
        <PageHeader
          variant="banner"
          eyebrow="Staff Dashboard"
          title={`Welcome, ${profile.full_name.split(" ")[0]}`}
          subtitle="Library Staff"
          actions={
            <a
              href="/library"
              className="inline-flex items-center gap-2 bg-gold text-navy text-sm font-semibold px-[18px] py-3 rounded-xl hover:bg-gold-light transition"
            >
              <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.75} />
              Browse Library
            </a>
          }
        />

        <div className="flex flex-wrap gap-4">
          <StatCard icon={BookOpen} tone="navy" value={total ?? 0} label="Abstracts added" />
          <StatCard icon={CalendarDays} tone="gold" value={thisMonth ?? 0} label="Added this month" />
        </div>
      </main>
    </div>
  );
}
