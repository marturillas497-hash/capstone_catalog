"use client";

import { useEffect, useState } from "react";
import DonutCard from "@/components/shared/DonutChart";
import RankedBars from "@/components/shared/RankedBars";

// Six named slices, everyone past that is grouped as "Others".
const PALETTE = ["#003366", "#FFCC00", "#FF7A1F", "#0D9488", "#7C3AED", "#0EA5E9"];
const OTHERS_COLOR = "#94A3B8";
const TOP_ALL_TIME = 10;

// rows arrive sorted by this month's count, so the first six are the top six.
function monthSegments(rows) {
  const active = rows.filter((r) => r.month_count > 0);
  const named = active.slice(0, PALETTE.length).map((r, i) => ({
    label: r.full_name,
    value: r.month_count,
    color: PALETTE[i],
  }));
  const rest = active.slice(PALETTE.length);
  if (rest.length === 0) return named;
  const value = rest.reduce((sum, r) => sum + r.month_count, 0);
  return [...named, { label: `Others (${rest.length})`, value, color: OTHERS_COLOR }];
}

const monthLabel = new Date().toLocaleDateString("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Manila",
});

export default function StaffStatsPanel() {
  const [rows, setRows] = useState(null); // null while loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/staff/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setRows(j.rows ?? []))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return <p className="text-sm text-slate-400 mb-8">Staff statistics could not be loaded.</p>;
  }

  if (!rows) {
    return (
      <div className="flex flex-wrap gap-5 mb-8">
        <div className="flex-1 min-w-[min(100%,300px)] h-56 bg-background shadow-neo rounded-2xl animate-pulse" />
        <div className="flex-1 min-w-[min(100%,300px)] h-56 bg-background shadow-neo rounded-2xl animate-pulse" />
      </div>
    );
  }

  const monthTotal = rows.reduce((sum, r) => sum + r.month_count, 0);
  const allTime = [...rows]
    .sort((a, b) => b.total_count - a.total_count)
    .slice(0, TOP_ALL_TIME)
    .map((r) => ({ id: r.id, title: r.full_name, count: r.total_count, href: `/admin/staff/${r.id}` }));

  return (
    <div className="flex flex-wrap gap-5 mb-8">
      <DonutCard
        title={`Added in ${monthLabel}`}
        segments={monthSegments(rows)}
        centerValue={monthTotal}
        centerLabel="this month"
        footer={
          monthTotal === 0 && (
            <p className="text-sm text-slate-400 mt-4">No staff additions this month yet.</p>
          )
        }
      />
      <div className="flex-1 min-w-[min(100%,300px)] bg-background shadow-neo rounded-2xl p-6">
        <h2 className="text-base font-bold text-navy mb-5">All-time additions</h2>
        <RankedBars items={allTime} emptyText="No staff additions yet." />
      </div>
    </div>
  );
}
