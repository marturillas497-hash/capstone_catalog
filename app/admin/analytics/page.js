"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import { TrendingUp, History } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import RankedBars from "@/components/shared/RankedBars";

export default function AnalyticsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({ totalViews: 0, viewsThisWeek: 0 });
  const [topAll, setTopAll] = useState([]);
  const [topWeek, setTopWeek] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ role: "admin", fullName: "" });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .single();
        if (data) setProfile({ role: data.role, fullName: data.full_name });
      }
      await fetchAnalytics();
    }
    init();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [totalRes, weekRes, historyRes] = await Promise.all([
      supabase.from("abstract_views").select("id", { count: "exact", head: true }),
      supabase.from("abstract_views").select("id", { count: "exact", head: true }).gte("viewed_at", weekAgo),
      supabase
        .from("abstract_views")
        .select("viewed_at, viewer_id, abstract_id, abstracts(title), profiles(full_name, student_metadata!profile_id(id_number))")
        .order("viewed_at", { ascending: false })
        .limit(50),
    ]);

    setStats({
      totalViews: totalRes.count || 0,
      viewsThisWeek: weekRes.count || 0,
    });

    setHistory(historyRes.data || []);

    const allViews = await supabase
      .from("abstract_views")
      .select("abstract_id, abstracts(title)");

    if (allViews.data) {
      const countMap = {};
      for (const row of allViews.data) {
        const key = row.abstract_id;
        if (!countMap[key]) countMap[key] = { abstract_id: key, title: row.abstracts?.title || "Unknown", count: 0 };
        countMap[key].count++;
      }
      const sorted = Object.values(countMap).sort((a, b) => b.count - a.count);
      setTopAll(sorted.slice(0, 10));
    }

    const weekViews = await supabase
      .from("abstract_views")
      .select("abstract_id, abstracts(title)")
      .gte("viewed_at", weekAgo);

    if (weekViews.data) {
      const countMap = {};
      for (const row of weekViews.data) {
        const key = row.abstract_id;
        if (!countMap[key]) countMap[key] = { abstract_id: key, title: row.abstracts?.title || "Unknown", count: 0 };
        countMap[key].count++;
      }
      const sorted = Object.values(countMap).sort((a, b) => b.count - a.count);
      setTopWeek(sorted.slice(0, 5));
    }

    setLoading(false);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const toItems = (list) => list.map((r) => ({ id: r.abstract_id, title: r.title, count: r.count }));

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="Analytics"
          subtitle="Abstract view activity across the capstone library."
          icon={TrendingUp}
          stats={[
            { label: "Total views", value: loading ? "..." : stats.totalViews },
            { label: "This week", value: loading ? "..." : stats.viewsThisWeek, tone: "navy" },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
          <div className="bg-background shadow-neo rounded-2xl p-6">
            <h2 className="text-[17px] font-bold text-navy">Top 10 most viewed</h2>
            <p className="text-[13px] text-slate-500 mt-0.5 mb-5">
              All time, by number of students who opened the abstract
            </p>
            {loading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <RankedBars
                items={toItems(topAll)}
                color="#003366"
                dimColor="#4C7AA8"
                highlight={3}
                emptyText="No view data yet."
              />
            )}
          </div>

          <div className="bg-background shadow-neo rounded-2xl p-6">
            <h2 className="text-[17px] font-bold text-navy">Trending this week</h2>
            <p className="text-[13px] text-slate-500 mt-0.5 mb-5">Top 5 over the last 7 days</p>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <RankedBars
                items={toItems(topWeek)}
                color="#E56200"
                emptyText="No views recorded this week."
              />
            )}
          </div>
        </div>

        <div className="bg-background shadow-neo rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-[17px] font-bold text-navy flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
              View history
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Last 50 views, newest first</p>
          </div>
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-400">No view history yet.</div>
          ) : (
            <>
            {/* Phones and tablets: stacked rows, the title wraps in full */}
            <ul className="lg:hidden divide-y divide-slate-100" suppressHydrationWarning>
              {history.map((row, i) => (
                <li key={`${row.abstract_id}-${row.viewed_at}-${i}`} className="px-5 py-3.5">
                  <p className="text-sm font-medium text-slate-700 leading-snug break-words">
                    {row.abstracts?.title || "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {row.profiles?.full_name || "Unknown"}
                    {row.profiles?.student_metadata?.id_number && ` · ${row.profiles.student_metadata.id_number}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.viewed_at)}</p>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-44" />
                  <col className="w-[22%]" />
                  <col className="w-32" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-bold">Viewed</th>
                    <th className="text-left px-6 py-3 font-bold">Student</th>
                    <th className="text-left px-6 py-3 font-bold">Student ID</th>
                    <th className="text-left px-6 py-3 font-bold">Abstract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100" suppressHydrationWarning>
                  {history.map((row, i) => (
                    <tr key={`${row.abstract_id}-${row.viewed_at}-${i}`} className="hover:bg-slate-50/60">
                      <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{formatDate(row.viewed_at)}</td>
                      <td className="px-6 py-3 text-slate-700 break-words">{row.profiles?.full_name || "Unknown"}</td>
                      <td className="px-6 py-3 font-mono text-slate-500 text-xs">{row.profiles?.student_metadata?.id_number || ""}</td>
                      <td className="px-6 py-3 text-slate-600 leading-snug break-words">{row.abstracts?.title || "Unknown"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
