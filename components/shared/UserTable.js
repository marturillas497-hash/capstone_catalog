"use client";

import { useState, useEffect, useRef } from "react";
import { Ban, RotateCcw, KeyRound, MoreVertical } from "lucide-react";

const STATUS_META = {
  active: { label: "Active", className: "bg-green-50 text-green-700 border-green-200" },
  suspended: { label: "Suspended", className: "bg-red-50 text-red-600 border-red-200" },
};

export function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.active;
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

// Three-dot menu. Closes on outside click or Escape. Rows near the bottom of
// the list open upward so the menu is not cut off by the page edge.
function RowMenu({ row, busy, dropUp, onToggleStatus, onResetPassword }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = row.status === "active";

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(handler) {
    setOpen(false);
    handler(row);
  }

  return (
    <div ref={ref} className={`relative ${open ? "z-20" : ""}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label={`Actions for ${row.full_name || "this account"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
          open ? "bg-slate-100 border-slate-300" : "border-transparent hover:bg-slate-100"
        }`}
      >
        <MoreVertical className="w-5 h-5 text-slate-600" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 animate-fade-in ${
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          <button
            role="menuitem"
            onClick={() => pick(onResetPassword)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-navy hover:bg-slate-100 transition-colors"
          >
            <KeyRound className="w-[18px] h-[18px]" strokeWidth={1.75} />
            Reset password
          </button>
          <div className="h-px bg-slate-100 my-1 mx-1.5" />
          <button
            role="menuitem"
            onClick={() => pick(onToggleStatus)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              isActive ? "text-red-700 hover:bg-red-50" : "text-green-700 hover:bg-green-50"
            }`}
          >
            {isActive ? (
              <Ban className="w-[18px] h-[18px]" strokeWidth={1.75} />
            ) : (
              <RotateCcw className="w-[18px] h-[18px]" strokeWidth={1.75} />
            )}
            {isActive ? "Suspend account" : "Unsuspend account"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

// columns: [{ key, label, render(row) }]
// identifier: { label, render(row) }, shown as the first column on desktop
// and the top line of the card on mobile.
export default function UserTable({
  rows,
  loading,
  columns,
  identifier,
  busyId,
  onToggleStatus,
  onResetPassword,
  emptyMessage = "No accounts found.",
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-background shadow-neo neo-transition rounded-lg px-4 py-3 animate-pulse h-14" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-base font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-background shadow-neo rounded-2xl">
      {/* Desktop table */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-t-2xl border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span className="flex-[1.3] min-w-0">{identifier.label}</span>
          {columns.map((col) => (
            <span key={col.key} className="flex-1 min-w-0">{col.label}</span>
          ))}
          <span className="w-9 shrink-0 text-right"><span className="sr-only">Actions</span></span>
        </div>
        <div className="divide-y divide-slate-50">
          {rows.map((row, index) => (
            <div key={row.id || row.profile_id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-[1.3] min-w-0 font-medium text-foreground truncate">
                {identifier.render(row)}
              </span>
              {columns.map((col) => (
                <span key={col.key} className="flex-1 min-w-0 text-slate-600 truncate">
                  {col.render(row)}
                </span>
              ))}
              <span className="w-9 shrink-0 flex justify-end">
                <RowMenu
                  row={row}
                  busy={busyId === (row.id || row.profile_id)}
                  dropUp={rows.length > 3 && index >= rows.length - 2}
                  onToggleStatus={onToggleStatus}
                  onResetPassword={onResetPassword}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-slate-50">
        {rows.map((row) => (
          <div key={row.id || row.profile_id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{identifier.render(row)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.created_at)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <StatusPill status={row.status} />
                <RowMenu
                  row={row}
                  busy={busyId === (row.id || row.profile_id)}
                  dropUp={false}
                  onToggleStatus={onToggleStatus}
                  onResetPassword={onResetPassword}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
              {columns.filter((col) => col.key !== "status").map((col) => (
                <span key={col.key}>{col.render(row)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}