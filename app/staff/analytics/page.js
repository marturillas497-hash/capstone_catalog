import { redirect } from "next/navigation";
import { getAuthHeaders } from "@/lib/authHeaders";
import { getViewAnalytics } from "@/lib/dashboardStats";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import RankedBars from "@/components/shared/RankedBars";
import { TrendingUp } from "lucide-react";

const toItems = (rows) => rows.map((r) => ({ id: r.id, title: r.title, count: r.views }));

// Staff only (middleware covers /staff). Aggregates only: which abstracts are
// read most. Never who read them, so no viewer names, ids or timestamps.
export default async function StaffAnalyticsPage() {
  const me = await getAuthHeaders();
  if (!me || me.role !== "staff") redirect("/login");

  const { total, week, topAll, topWeek } = await getViewAnalytics();

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
