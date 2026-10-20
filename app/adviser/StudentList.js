"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, ChevronRight } from "lucide-react";
import { RISK_BADGE as riskBadge, RISK_LABELS_SHORT as riskLabel } from "@/lib/risk";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function StudentList({ students }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.id_number.toLowerCase().includes(q)
    );
  }, [query, students]);

  return (
    <div className="space-y-4">

      {/* Search box */}
      <div className="relative max-w-sm">
        <span className="absolute inset-y-0 left-3 flex items-center text-slate-600 pointer-events-none">
          <Search className="w-4 h-4" strokeWidth={1.75} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or student ID"
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-3 flex items-center text-slate-600 hover:text-slate-600 transition"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Empty states */}
      {students.length === 0 && (
        <div className="text-center py-20 text-slate-600">
          <p className="text-base font-medium">No students assigned yet</p>
          <p className="text-sm mt-1">Students will appear here once they select you as their adviser.</p>
        </div>
      )}

      {students.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <p className="text-base font-medium">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-sm mt-1">Try a different name or student ID.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* Mobile: cards */}
          <div className="block md:hidden space-y-3">
            {filtered.map((student) => (
              <Link
                key={student.profile_id}
                href={`/adviser/students/${student.profile_id}`}
                className="block bg-background shadow-neo hover:shadow-neo-hover hover:-translate-y-1 active:shadow-neo-inset active:translate-y-0 neo-transition rounded-xl px-5 py-4 group"
              >
                {/* Top row: name + badge + chevron */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <p className="font-semibold text-foreground group-hover:text-navy transition-colors">
                      {student.full_name}
                    </p>
                    {student.latest_risk && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskBadge[student.latest_risk]}`}>
                        {riskLabel[student.latest_risk]}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-navy transition-colors shrink-0 mt-0.5" strokeWidth={1.75} />
                </div>

                {/* Student ID / year / section */}
                <p className="text-xs text-slate-600 mt-1">
                  {[
                    student.id_number,
                    student.year_level,
                    student.section ? `Sec. ${student.section}` : null,
                  ].filter(Boolean).join(" · ")}
                </p>

                {/* Bottom row: scans + last scan */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-foreground">
                    {student.report_count} {student.report_count === 1 ? "scan" : "scans"}
                  </span>
                  {student.latest_report_at && (
                    <span className="text-xs text-slate-600">
                      Last: {formatDate(student.latest_report_at)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-background shadow-neo neo-transition rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Student ID", "Name", "Year / Section", "Last Risk", "Scans", "Last Scan"].map((col) => (
                    <th key={col} className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide px-5 py-3">
                      {col}
                    </th>
                  ))}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((student) => (
                  <tr key={student.profile_id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">
                      {student.id_number}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground group-hover:text-navy transition-colors">
                      {student.full_name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {[student.year_level, student.section ? `Sec. ${student.section}` : null]
                        .filter(Boolean)
                        .join(" · ") || <span className="text-slate-400">Not set</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {student.latest_risk ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskBadge[student.latest_risk]}`}>
                          {riskLabel[student.latest_risk]}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">None yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-foreground font-semibold">
                      {student.report_count}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {formatDate(student.latest_report_at) ?? (
                        <span className="text-slate-400">No scans yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/adviser/students/${student.profile_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-orange transition-colors"
                      >
                        View
                        <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-600">
                {filtered.length} {filtered.length === 1 ? "student" : "students"}
                {query && ` matching "${query}"`}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}