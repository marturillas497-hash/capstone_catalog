import { redirect } from "next/navigation";
import { getAuthHeaders } from "@/lib/authHeaders";
import { getViewAnalytics } from "@/lib/dashboardStats";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/constants";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import RankedBars from "@/components/shared/RankedBars";
import { TrendingUp } from "lucide-react";

const toItems = (rows) => rows.map((r) => ({ id: r.id, title: r.title, count: r.views }));

// Staff only (middleware covers /staff). Aggregates only: which abstracts are
// read most. Never who read them, so no viewer names, ids or timestamps.
export default async function StaffAnalyticsPage({ searchParams }) {
  const me = await getAuthHeaders();
  if (!me || me.role !== "staff") redirect("/login");

  // Optional ?program=<id> narrows the aggregates to one program. Empty means all.
  const sp = await searchParams;
  const programId = isUuid(sp?.program) ? sp.program : null;

  const supabase = await createClient();
  const [{ total, week, topAll, topWeek }, { data: programs }] = await Promise.all([
    getViewAnalytics(programId),
    supabase.from("programs").select("id, code, name").order("name"),
  ]);

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={me.role} fullName={me.fullName} />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="Analytics"
          subtitle="Which abstracts students read most in the capstone library."
          icon={TrendingUp}
          stats={[
            { label: "Total views", value: total },
            { label: "This week", value: week, tone: "navy" },
          ]}
        />

        <form method="get" className="flex items-center justify-end gap-2 mb-4">
          <label htmlFor="program" className="text-xs font-medium text-slate-600">
            Program
          </label>
          <select
            id="program"
            name="program"
            defaultValue={programId ?? ""}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option value="">All programs</option>
            {(programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-navy text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-navy-dark transition-colors"
          >
            Apply
          </button>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-background shadow-neo rounded-2xl p-6">
            <h2 className="text-[17px] font-bold text-navy">Top 10 most viewed</h2>
            <p className="text-[13px] text-slate-500 mt-0.5 mb-5">
              All time, counted once per student per day
            </p>
            <RankedBars
              items={toItems(topAll)}
              color="#003366"
              dimColor="#4C7AA8"
              highlight={3}
              emptyText="No view data yet."
            />
          </div>

          <div className="bg-background shadow-neo rounded-2xl p-6">
            <h2 className="text-[17px] font-bold text-navy">Trending this week</h2>
            <p className="text-[13px] text-slate-500 mt-0.5 mb-5">Top 5 over the last 7 days</p>
            <RankedBars items={toItems(topWeek)} color="#E56200" emptyText="No views recorded this week." />
          </div>
        </div>
      </main>
    </div>
  );
}
