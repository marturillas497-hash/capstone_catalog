"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Lock, Eye, EyeOff } from "lucide-react";

const INPUT =
  "w-full pl-11 pr-11 py-3 rounded-2xl bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 transition neo-transition";

// Forced password change. Middleware keeps anyone with the must-change flag on
// this page, so there is deliberately no close button, only Sign out.
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not set the password.");

      // "/" sends a signed-in user to their own home page.
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 animate-modal-in">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-navy">
            <KeyRound className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-lg text-navy">Set your password</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">Choose a new password to continue.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="New password (8+ characters)"
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition"
              tabIndex={-1}
            >
              {show ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
              className={INPUT}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-white text-sm font-medium py-3 rounded-full hover:bg-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving…" : "Save password"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 w-full text-center text-xs text-slate-500 hover:text-navy"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
