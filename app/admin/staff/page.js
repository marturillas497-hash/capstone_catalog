"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import PageHeader from "@/components/shared/PageHeader";
import UserTable, { StatusPill } from "@/components/shared/UserTable";
import ResetPasswordModal from "@/components/shared/ResetPasswordModal";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";
import AddStaffModal from "@/components/shared/AddStaffModal";
import StaffStatsPanel from "@/components/shared/StaffStatsPanel";
import { Search, UserPlus, Plus, ChevronLeft, ChevronRight, Ban, RotateCcw, KeyRound } from "lucide-react";

const CONFIRM_CONFIG = {
  suspend: {
    icon: Ban,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "Suspend Account",
    confirmLabel: "Suspend",
    confirmingLabel: "Suspending…",
    confirmClassName: "bg-red-500 hover:bg-red-600",
    description: (name) => `Suspend ${name}? They will be unable to log in until unsuspended. No email is sent.`,
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

const selectClass =
  "border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-foreground bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30";

export default function StaffPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState({ role: "admin", fullName: "" });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date");
  const [status, setStatus] = useState("");

  const [busyId, setBusyId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState({ open: false, password: "", fullName: "", created: false });
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

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q: query, sort, page: String(page) });
    if (status) params.set("status", status);
    try {
      const res = await fetch(`/api/admin/staff?${params.toString()}`);
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
  }, [query, sort, status, page]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(fetchRows, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [fetchRows]);

  // Back to page 1 whenever a filter changes, not just the page control itself.
  useEffect(() => {
    setPage(1);
  }, [query, sort, status]);

  function handleToggleStatus(row) {
    setConfirmAction({ open: true, type: row.status === "active" ? "suspend" : "unsuspend", row });
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
    setBusyId(row.id);
    try {
      if (type === "reset") {
        const res = await fetch(`/api/admin/users/${row.id}/resetpassword`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to reset password");
        setConfirmAction({ open: false, type: null, row: null });
        setPasswordModal({ open: true, password: json.password, fullName: row.full_name, created: false });
      } else {
        const res = await fetch(`/api/admin/users/${row.id}/status`, {
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

  function handleCreated(created) {
    setAddOpen(false);
    setPasswordModal({ open: true, password: created.password, fullName: created.fullName, created: true });
    fetchRows();
  }

  const columns = [
    { key: "email", label: "Email", render: (r) => r.email },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "added", label: "Abstracts added", render: (r) => r.abstracts_added },
    {
      key: "created",
      label: "Joined",
      render: (r) => new Date(r.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    },
  ];

  const activeConfirmConfig = confirmAction.type ? CONFIRM_CONFIG[confirmAction.type] : null;

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="Staff"
          subtitle="Accounts for library staff who add abstracts"
          icon={UserPlus}
          badge={
            <span className="bg-orange/10 text-[#B84E00] text-[13px] font-bold rounded-full px-2.5 py-0.5">
              {total}
            </span>
          }
        />

        <StaffStatsPanel />

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

          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
            <option value="date">Newest first</option>
            <option value="name">Name (A to Z)</option>
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 bg-navy text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-navy-dark transition"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Add staff
          </button>
        </div>

        <UserTable
          rows={rows}
          loading={loading}
          columns={columns}
          identifier={{ label: "Name", render: (r) => r.full_name }}
          busyId={busyId}
          onToggleStatus={handleToggleStatus}
          onResetPassword={handleResetPassword}
          emptyMessage="No staff accounts yet."
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

      <AddStaffModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />

      <ResetPasswordModal
        open={passwordModal.open}
        onClose={() => setPasswordModal({ open: false, password: "", fullName: "", created: false })}
        password={passwordModal.password}
        fullName={passwordModal.fullName}
        title={passwordModal.created ? "Staff account created" : "Password reset"}
        label={passwordModal.created ? "Starting password for" : "New password for"}
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
