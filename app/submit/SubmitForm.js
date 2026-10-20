"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEmbedding } from "@/components/shared/EmbeddingProvider";
import Navbar from "@/components/shared/Navbar";
import { ScanLine, Loader2, Info, Sparkles, Clock, Gauge } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import ScanProgress from "@/components/shared/ScanProgress";

const DAILY_LIMIT = 5;

// Staged, client-paced progress. The embedding stage reflects a real
// client-side promise. The middle stage's timing is an estimate, not a
// live server signal, since /api/analyze is one atomic request with no
// intermediate checkpoints. The advisory stage holds until the request
// actually resolves rather than guessing when the AI finishes.
const STAGES = [
  { key: "embedding", label: "Generating embedding…", description: "Converting your title and abstract into a semantic fingerprint." },
  { key: "matching", label: "Comparing against the capstone library…", description: "Checking your proposed topic against existing BSIS studies." },
  { key: "advisory", label: "Generating AI advisory…", description: "Claude is drafting structured feedback based on your closest matches." },
];

const MATCHING_STAGE_DELAY_MS = 1600;
const REQUEST_TIMEOUT_MS = 45000;

// Static, computed once when the limit modal opens. Not a live countdown,
// the daily scan limit's reset display is explicitly out of scope for a
// ticking timer per the PRD, this only states roughly how far away the
// fixed 12:00 AM PHT reset is at the moment the modal is shown.
function getResetLabel() {
  const nowPHT = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const nextMidnight = new Date(nowPHT);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffMs = nextMidnight - nowPHT;
  const diffHrs = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  return `about ${diffHrs} hour${diffHrs === 1 ? "" : "s"} from now`;
}

async function fetchScansUsedToday(supabase, userId, role) {
  const startOfDayPHT = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  startOfDayPHT.setHours(0, 0, 0, 0);

  let query = supabase
    .from("similarity_reports")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfDayPHT.toISOString());

  if (role === "student") {
    query = query.eq("student_id", userId);
  } else {
    // .is() silently fails through PostgREST on this project — always use .filter()
    query = query.eq("adviser_id", userId).filter("student_id", "is", null);
  }

  const { count } = await query;
  return count ?? 0;
}

// profile ({ full_name, role }) and userId are resolved server-side in
// page.js and passed down as props, guaranteed present on first render.
// Navbar below used to wait on its own client-side identity fetch here
// (useState(null) until it resolved), meaning it didn't render at all for
// as long as that fetch was in flight — on a slow connection or a cold
// serverless start, the page would show no navigation whatsoever.
export default function SubmitForm({ profile, userId }) {
  const router = useRouter();
  const { isReady, isLoading: modelLoading, getEmbedding } = useEmbedding();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scansLeft, setScansLeft] = useState(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [resetLabel, setResetLabel] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const stageTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const abortTimerRef = useRef(null);

  function openLimitModal() {
    setResetLabel(getResetLabel());
    setLimitModalOpen(true);
  }

  useEffect(() => {
    async function loadScanCount() {
      const supabase = createClient();
      const used = await fetchScansUsedToday(supabase, userId, profile.role);
      const left = Math.max(0, DAILY_LIMIT - used);
      setScansLeft(left);

      // Only surface the limit modal proactively here, on initial page
      // load, when the user already had zero scans left BEFORE doing
      // anything on this visit (e.g. they used their last scan earlier
      // today and came back to /submit). This must NOT also be wired as a
      // reactive effect on scansLeft in general — that previously caused
      // the modal to pop up as a side effect of a *successful* 5th scan
      // (scansLeft: 1 -> 0 right after the API call resolves), firing at
      // almost the same instant router.push() was redirecting to the new
      // report. A completed, saved scan looked like it had been blocked.
      if (left === 0) {
        openLimitModal();
      }
    }
    loadScanCount();
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(stageTimerRef.current);
      clearTimeout(abortTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isReady) {
      setError("The embedding model is still loading. Please wait a moment and try again.");
      return;
    }

    if (scansLeft === 0) {
      openLimitModal();
      return;
    }

    setLoading(true);
    setActiveIndex(0);

    let embedding;
    try {
      const combined = `${title.trim()} ${description.trim()}`;
      embedding = await getEmbedding(combined);
    } catch (err) {
      console.error(err);
      setError("Failed to generate embedding. Please try again.");
      setLoading(false);
      return;
    }

    setActiveIndex(1);
    stageTimerRef.current = setTimeout(() => setActiveIndex(2), MATCHING_STAGE_DELAY_MS);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    abortTimerRef.current = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          embedding,
        }),
        signal: controller.signal,
      });

      clearTimeout(stageTimerRef.current);
      clearTimeout(abortTimerRef.current);
      setActiveIndex(2);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setScansLeft((prev) => Math.max(0, (prev ?? 1) - 1));

      const reportPath =
        profile?.role === "capstone_adviser"
          ? `/adviser/report/${data.reportId}`
          : `/dashboard/report/${data.reportId}`;

      router.push(reportPath);
    } catch (err) {
      clearTimeout(stageTimerRef.current);
      clearTimeout(abortTimerRef.current);
      console.error(err);
      if (err.name === "AbortError") {
        setError("This is taking longer than expected. Check your connection and try again.");
      } else {
        setError("Could not reach the server. Check your connection and try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <Navbar role={profile.role} fullName={profile.full_name} />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-8">

        {/* Page header */}
        <PageHeader
          variant="stats"
          title="New Similarity Scan"
          subtitle="Enter your proposed capstone title and abstract to check for conceptual overlap with existing BSIS studies."
          icon={ScanLine}
          iconBg="bg-navy"
        />

        {/* Status row: model readiness and scan count, side by side on desktop */}
        {!loading && (
          <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Model status */}
            {modelLoading && (
              <div className="flex items-center gap-3 bg-background shadow-neo neo-transition rounded-xl px-4 py-3">
                <div className="shrink-0 w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Waking up the embedding model</p>
                  <p className="text-xs text-slate-400">Running locally in your browser, almost there…</p>
                </div>
              </div>
            )}
            {isReady && (
              <div className="flex items-center gap-3 bg-background shadow-neo neo-transition rounded-xl px-4 py-3 animate-pop-in">
                <div className="shrink-0 w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-green-600" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Model's warmed up and ready</p>
                  <p className="text-xs text-slate-400">Your scan will run instantly, no wait this time.</p>
                </div>
              </div>
            )}

            {/* Scans remaining */}
            {scansLeft !== null && (
              <button
                type="button"
                onClick={scansLeft === 0 ? openLimitModal : undefined}
                className={`flex items-center justify-between gap-3 bg-background shadow-neo neo-transition rounded-xl px-4 py-3 text-left
                  ${scansLeft === 0 ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Scans left today</p>
                  <p
                    className={`font-display text-3xl leading-none mt-1
                      ${scansLeft === 0 ? "text-red-500" : scansLeft === 1 ? "text-orange" : "text-navy"}`}
                  >
                    {scansLeft}
                    <span className="text-sm text-slate-400 font-sans"> / {DAILY_LIMIT}</span>
                  </p>
                </div>
                <div
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                    ${scansLeft === 0 ? "bg-red-50" : scansLeft === 1 ? "bg-orange/10" : "bg-navy/5"}`}
                >
                  <Gauge
                    className={`w-4 h-4 ${scansLeft === 0 ? "text-red-500" : scansLeft === 1 ? "text-orange" : "text-navy"}`}
                    strokeWidth={1.75}
                  />
                </div>
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="bg-background shadow-neo neo-transition rounded-2xl">
            <ScanProgress stages={STAGES} activeIndex={activeIndex} />
          </div>
        ) : (
          <div className="bg-background shadow-neo neo-transition rounded-2xl p-6">
            <div className="flex items-start gap-2 bg-navy/5 border border-navy/10 rounded-lg px-4 py-2.5 mb-5 text-xs text-navy">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
              <p>
                Enter your proposed title and description in English. The similarity model is trained primarily on English text and is not accurate for other languages, including Filipino and regional languages.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Proposed Capstone Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Automated Attendance Monitoring System Using Face Recognition"
                  className="w-full px-3 py-2 rounded-lg bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Abstract or Problem Statement
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={7}
                  placeholder="Describe your proposed study, its objectives, and the problem it aims to address…"
                  className="w-full px-3 py-2 rounded-lg bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 neo-transition resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || !isReady || scansLeft === 0}
                className="w-full flex items-center justify-center gap-2 bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ScanLine className="w-4 h-4" strokeWidth={1.75} />
                Run Semantic Scan
              </button>
            </form>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400 text-center px-4">
          Scans are limited to {DAILY_LIMIT} per calendar day and reset at 12:00 AM
          Philippine Standard Time. This tool performs semantic similarity detection,
          not plagiarism checking.
        </p>
      </main>

      {/* Daily limit reached modal */}
      {limitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setLimitModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-modal-in">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-orange/10 flex items-center justify-center">
              <Clock className="w-7 h-7 text-orange" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-xl text-navy mb-2">Daily Scan Limit Reached</h2>
            <p className="text-sm text-slate-600 mb-1">
              You've used all {DAILY_LIMIT} of your scans for today.
            </p>
            <p className="text-sm text-slate-600 mb-6">
              Scans reset at <span className="font-medium text-navy">12:00 AM Philippine Standard Time</span>
              {resetLabel && <>, {resetLabel}.</>}
            </p>
            <button
              onClick={() => setLimitModalOpen(false)}
              className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-navy-light transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}