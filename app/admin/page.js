"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import Link from "next/link";
import { Users, BookOpen, Clock, BarChart3, TrendingUp, Plus, ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DonutCard from "@/components/shared/DonutChart";
import { riskSegments } from "@/lib/risk";

const CARD = "bg-background shadow-neo rounded-2xl p-6";

export default function AdminPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    students: 0,
    abstracts: 0,
    abstractsThisWeek: 0,
    pendingAdvisers: 0,
    reports: 0,
    reportsThisWeek: 0,
  });
  const [charts, setCharts] = useState(null);
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ role: "admin", fullName: "" });

  useEffect(() => {
    async function fetchAll() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .single();
        if (data) setProfile({ role: data.role, fullName: data.full_name });
      }

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [students, abstracts, abstractsWeek, pending, reports, reportsWeek, recentAbstracts, weekViews, chartRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("abstracts").select("id", { count: "exact", head: true }),
        supabase.from("abstracts").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "capstone_adviser").eq("status", "pending"),
        supabase.from("similarity_reports").select("id", { count: "exact", head: true }),
        supabase.from("similarity_reports").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("abstracts").select("id, title, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("abstract_views").select("abstract_id, abstracts(title)").gte("viewed_at", weekAgo),
        fetch("/api/admin/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      setStats({
        students: students.count || 0,
        abstracts: abstracts.count || 0,
        abstractsThisWeek: abstractsWeek.count || 0,
        pendingAdvisers: pending.count || 0,
        reports: reports.count || 0,
        reportsThisWeek: reportsWeek.count || 0,
      });

      setCharts(chartRes);
      setRecent(recentAbstracts.data || []);

      // Same client side aggregation already used on /admin/analytics for the
      // weekly trending list, capped to 3 rows for this preview.
      if (weekViews.data) {
        const countMap = {};
        for (const row of weekViews.data) {
          const key = row.abstract_id;
          if (!countMap[key]) countMap[key] = { abstract_id: key, title: row.abstracts?.title || "Unknown", count: 0 };
          countMap[key].count++;
        }
        setTrending(Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 3));
      }

      setLoading(false);
    }
    fetchAll();
  }, []);

  const hasAlert = stats.pendingAdvisers > 0;

  const accounts = charts?.accounts;
  const accountSegments = accounts
    ? [
        { label: "Active students", value: accounts.activeStudents, color: "#003366" },
        { label: "Active advisers", value: accounts.activeAdvisers, color: "#FFCC00" },
        { label: "Pending advisers", value: accounts.pendingAdvisers, color: "#FF7A1F" },
        { label: "Suspended", value: accounts.suspended, color: "#94A3B8" },
      ]
    : [];
  const accountTotal = accountSegments.reduce((a, s) => a + s.value, 0);

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8">

        <PageHeader
          variant="banner"
          eyebrow="Admin Dashboard"
          title="System Overview"
          subtitle="Library, accounts, and scan activity at a glance."
        />

        {!loading && hasAlert && (
          <Link
            href="/admin/approvals"
            className="flex items-center gap-3 bg-orange/10 border border-orange/20 rounded-xl px-4 py-3 mb-6 hover:bg-orange/15 transition-colors group"
          >
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-orange shrink-0">
              <Clock className="w-5 h-5 text-white" strokeWidth={1.75} />
            </div>
            <p className="flex-1 text-sm text-foreground">
              <span className="font-semibold">
                {stats.pendingAdvisers} adviser application{stats.pendingAdvisers > 1 ? "s" : ""}
              </span>{" "}
              {stats.pendingAdvisers > 1 ? "are" : "is"} waiting for review.
            </p>
            <span className="flex items-center gap-1 text-sm font-semibold text-orange-dark group-hover:text-orange transition-colors shrink-0">
              Review
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </span>
          </Link>
        )}

        <div className="flex flex-wrap gap-4 mb-6">
          <StatCard icon={Users} tone="navy" loading={loading} value={stats.students} label="Registered students" />
          <StatCard
            icon={BookOpen}
            tone="gold"
            loading={loading}
            value={stats.abstracts}
            label="Library abstracts"
            hint={stats.abstractsThisWeek > 0 ? `+${stats.abstractsThisWeek} this week` : undefined}
          />
          <StatCard
            icon={BarChart3}
            tone="orange"
            loading={loading}
            value={stats.reports}
            label="Similarity reports"
            hint={stats.reportsThisWeek > 0 ? `+${stats.reportsThisWeek} this week` : undefined}
          />
        </div>

        {charts && (
          <div className="flex flex-wrap gap-6 mb-6">
            <DonutCard
              title="All similarity reports by risk"
              segments={riskSegments(charts.risk)}
              centerValue={charts.totalReports}
              centerLabel="reports"
            />
            <DonutCard
              title="Accounts by status"
              segments={accountSegments}
              centerValue={accountTotal}
              centerLabel="accounts"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={CARD}>
            <h2 className="text-base font-bold text-navy mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange" strokeWidth={1.75} />
              Trending this week
            </h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : trending.length === 0 ? (
              <p className="text-sm text-slate-400">No views recorded this week.</p>
            ) : (
              <ol className="space-y-2 mb-4">
                {trending.map((item, i) => (
                  <li key={item.abstract_id} className="flex items-start gap-3 text-sm">
                    <span className="text-xs font-bold text-slate-400 w-5 shrink-0 pt-0.5">{i + 1}</span>
                    <span className="flex-1 text-slate-700 leading-snug line-clamp-2">{item.title}</span>
                    <span className="text-xs font-semibold text-navy shrink-0">{item.count}</span>
                  </li>
                ))}
              </ol>
            )}
            <Link href="/admin/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:text-navy-light transition-colors">
              View full analytics
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          <div className={CARD}>
            <h2 className="text-base font-bold text-navy mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-navy" strokeWidth={1.75} />
              Recently added
            </h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-400">No abstracts in the library yet.</p>
            ) : (
              <ol className="space-y-2 mb-4">
                {recent.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 text-sm">
                    <span className="flex-1 text-slate-700 leading-snug line-clamp-2">{item.title}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatDate(item.created_at)}</span>
                  </li>
                ))}
              </ol>
            )}
            <Link href="/library" className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:text-navy-light transition-colors">
              Browse library
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
