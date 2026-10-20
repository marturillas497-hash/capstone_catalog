"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import UserTable, { StatusPill } from "@/components/shared/UserTable";
import ResetPasswordModal from "@/components/shared/ResetPasswordModal";
import { Search, Users, ChevronLeft, ChevronRight, Ban, RotateCcw, KeyRound } from "lucide-react";
import { YEAR_LEVELS, SECTIONS } from "@/lib/constants";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

export default function UsersPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState({ role: "admin", fullName: "" });

  const [tab, setTab] = useState("students");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date");
  const [status, setStatus] = useState("");
  const [adviserId, setAdviserId] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [adviserOptions, setAdviserOptions] = useState([]);

  const [busyId, setBusyId] = useState(null);
  const [resetModal, setResetModal] = useState({ open: false, password: "", fullName: "" });
  const [confirmAction, setConfirmAction] = useState({ open: false, type: null, row: null });

  const searchTimeout = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
        if (data) setProfile({ role: data.role, fullName: data.full_name });
      }
    }
    init();
  }, []);

  useEffect(() => {
    fetch("/api/admin/users/advisers?sort=name")
      .then((r) => r.json())
      .then((json) => setAdviserOptions(json.rows || []))
      .catch(() => setAdviserOptions([]));
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q: query, sort, page: String(page) });
    if (status) params.set("status", status);
    if (tab === "students") {
      if (adviserId) params.set("adviserId", adviserId);
      if (yearLevel) params.set("yearLevel", yearLevel);
      if (section) params.set("section", section);
    }
    try {
      const res = await fetch(`/api/admin/users/${tab}?${params.toString()}`);
      const json = await res.json();
      setRows(json.rows || []);
      setTotalPages(json.totalPages || 1);
      setTotal(json.total || 0);
    } catch {
      setRows([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, query, sort, status, adviserId, yearLevel, section, page]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(fetchRows, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [fetchRows]);

  // Reset to page 1 whenever a filter changes, not just the page control itself
  useEffect(() => {
    setPage(1);
  }, [tab, query, sort, status, adviserId, yearLevel, section]);

  function switchTab(next) {
    setTab(next);
    setStatus("");
    setAdviserId("");
    setYearLevel("");
    setSection("");
    setQuery("");
    setSort("date");
  }

  function handleToggleStatus(row) {
    const type = row.status === "active" ? "suspend" : "unsuspend";
    setConfirmAction({ open: true, type, row });
  }

  function handleResetPassword(row) {
    setConfirmAction({ open: true, type: "reset", row });
  }

  function closeConfirmAction() {
    if (busyId) return;
    setConfirmAction({ open: false, type: null, row: null });
  }

  async function runConfirmedAction() {
    const { type, row } = confirmAction;
    const id = row.id || row.profile_id;
    setBusyId(id);

    try {
      if (type === "reset") {
        const res = await fetch(`/api/admin/users/${id}/resetpassword`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to reset password");
        setConfirmAction({ open: false, type: null, row: null });
        setResetModal({ open: true, password: json.password, fullName: row.full_name });
      } else {
        const res = await fetch(`/api/admin/users/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: type }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update status");
        setConfirmAction({ open: false, type: null, row: null });
        await fetchRows();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const studentColumns = [
    { key: "id_number", label: "Student ID", render: (r) => <span className="font-mono">{r.id_number}</span> },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "year", label: "Year & Section", render: (r) => [r.year_level, r.section].filter(Boolean).join(" ") || "-" },
    { key: "adviser", label: "Adviser", render: (r) => r.adviser_name || "-" },
  ];

  const adviserColumns = [
    { key: "email", label: "Email", render: (r) => r.email },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "added", label: "Added", render: (r) => new Date(r.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) },
  ];

  const CONFIRM_CONFIG = {
    suspend: {
      icon: Ban,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      title: "Suspend Account",
      confirmLabel: "Suspend",
      confirmingLabel: "Suspending…",
      confirmClassName: "bg-red-500 hover:bg-red-600",
      description: (name) => `Suspend ${name}? They will be signed out and unable to log in until unsuspended. No email is sent.`,
    },
    unsuspend: {
      icon: RotateCcw,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      title: "Unsuspend Account",
      confirmLabel: "Unsuspend",
      confirmingLabel: "Unsuspending…",
      confirmClassName: "bg-green-600 hover:bg-green-700",
      description: (name) => `Restore access for ${name}? They will be able to log in again immediately. No email is sent.`,
    },
    reset: {
      icon: KeyRound,
      iconBg: "bg-navy",
      iconColor: "text-white",
      title: "Reset Password",
      confirmLabel: "Reset Password",
      confirmingLabel: "Resetting…",
      confirmClassName: "bg-navy hover:bg-navy-dark",
      description: (name) => `Reset the password for ${name}? Their current password stops working immediately, and a new one is generated for you to deliver to them.`,
    },
  };

  const activeConfirmConfig = confirmAction.type ? CONFIRM_CONFIG[confirmAction.type] : null;

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="User Management"
          subtitle="Suspend, unsuspend, or reset the password of any account"
          icon={Users}
          badge={
            <span className="bg-orange/10 text-[#B84E00] text-[13px] font-bold rounded-full px-2.5 py-0.5">
              {total}
            </span>
          }
        />

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => switchTab("students")}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              tab === "students" ? "bg-navy text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Students
          </button>
          <button
            onClick={() => switchTab("advisers")}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              tab === "advisers" ? "bg-navy text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Advisers
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option value="date">Newest first</option>
            <option value="name">Name (A to Z)</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          {tab === "students" && (
            <>
              <select
                value={adviserId}
                onChange={(e) => setAdviserId(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                <option value="">All advisers</option>
                {adviserOptions.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                <option value="">All year levels</option>
                {YEAR_LEVELS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                <option value="">All sections</option>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <UserTable
          rows={rows}
          loading={loading}
          columns={tab === "students" ? studentColumns : adviserColumns}
          identifier={{ label: "Name", render: (r) => r.full_name }}
          busyId={busyId}
          onToggleStatus={handleToggleStatus}
          onResetPassword={handleResetPassword}
          emptyMessage={tab === "students" ? "No students found." : "No advisers found."}
        />

        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </main>

      <ResetPasswordModal
        open={resetModal.open}
        onClose={() => setResetModal({ open: false, password: "", fullName: "" })}
        password={resetModal.password}
        fullName={resetModal.fullName}
      />

      <ConfirmActionModal
        open={confirmAction.open}
        onClose={closeConfirmAction}
        onConfirm={runConfirmedAction}
        busy={!!busyId}
        icon={activeConfirmConfig?.icon}
        iconBg={activeConfirmConfig?.iconBg}
        iconColor={activeConfirmConfig?.iconColor}
        title={activeConfirmConfig?.title}
        confirmLabel={activeConfirmConfig?.confirmLabel}
        confirmingLabel={activeConfirmConfig?.confirmingLabel}
        confirmClassName={activeConfirmConfig?.confirmClassName}
        description={activeConfirmConfig?.description(confirmAction.row?.full_name ?? "this account")}
      />
    </div>
  );
}