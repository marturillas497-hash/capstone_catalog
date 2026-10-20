"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/shared/Navbar";
import { CheckCircle, XCircle, Clock, Ban } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "active", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function ApprovalsPage() {
  const supabase = createClient();
  const [advisersByTab, setAdvisersByTab] = useState({ pending: [], active: [], rejected: [] });
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [toast, setToast] = useState(null);
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
      await fetchAll();
    }
    init();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, created_at, status")
      .eq("role", "capstone_adviser")
      .order("created_at", { ascending: true });

    const grouped = { pending: [], active: [], rejected: [] };
    (data || []).forEach((a) => {
      if (grouped[a.status]) grouped[a.status].push(a);
    });
    setAdvisersByTab(grouped);
    setLoading(false);
  }

  async function handleAction(adviserId, action) {
    setProcessing((p) => ({ ...p, [adviserId]: action }));
    try {
      const res = await fetch(`/api/admin/approvals/${adviserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");

      // Move the adviser between tab groups locally instead of refetching,
      // keeps the other tabs' data intact and avoids a full reload flash.
      setAdvisersByTab((prev) => {
        const moved = prev.pending.find((a) => a.id === adviserId);
        const nextStatus = action === "approved" ? "active" : "rejected";
        if (!moved) return prev;
        return {
          ...prev,
          pending: prev.pending.filter((a) => a.id !== adviserId),
          [nextStatus]: [{ ...moved, status: nextStatus }, ...prev[nextStatus]],
        };
      });

      showToast(action === "approved" ? "Adviser approved and notified." : "Application rejected.", action === "approved" ? "success" : "info");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setProcessing((p) => ({ ...p, [adviserId]: null }));
    }
  }

  function showToast(message, type = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  const advisers = advisersByTab[activeTab] || [];

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.fullName} />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10">
        <PageHeader
          variant="stats"
          title="Adviser Applications"
          subtitle="Review pending registrations and browse past decisions."
          icon={Clock}
        />

        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {TABS.map((tab) => {
            const count = advisersByTab[tab.key]?.length ?? 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors
                  ${isActive ? "text-navy" : "text-slate-400 hover:text-slate-600"}`}
              >
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${isActive ? "bg-navy/10 text-navy" : "bg-slate-100 text-slate-400"}`}>
                    {count}
                  </span>
                </span>
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-orange rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background shadow-neo neo-transition rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-48 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-32" />
              </div>
            ))}
          </div>
        ) : advisers.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-medium">
              {activeTab === "pending" && "No pending applications"}
              {activeTab === "active" && "No approved advisers yet"}
              {activeTab === "rejected" && "No rejected applications"}
            </p>
            <p className="text-sm mt-1">
              {activeTab === "pending"
                ? "All adviser applications have been reviewed."
                : "Nothing to show here yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {advisers.map((adviser) => (
              <div
                key={adviser.id}
                className="bg-background shadow-neo neo-transition rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-slate-700">{adviser.full_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Registered {formatDate(adviser.created_at)}
                  </p>
                </div>

                {activeTab === "pending" ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(adviser.id, "approved")}
                      disabled={!!processing[adviser.id]}
                      className="inline-flex items-center gap-1.5 bg-navy text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
                      {processing[adviser.id] === "approved" ? "Approving..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction(adviser.id, "rejected")}
                      disabled={!!processing[adviser.id]}
                      className="inline-flex items-center gap-1.5 bg-white text-red-600 border border-red-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" strokeWidth={1.75} />
                      {processing[adviser.id] === "rejected" ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                ) : activeTab === "active" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-green-200 bg-green-50 text-green-700 shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-red-200 bg-red-50 text-red-600 shrink-0">
                    <Ban className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Rejected
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-lg text-white transition-all z-50
          ${toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-navy"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}