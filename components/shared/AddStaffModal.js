"use client";

import { useState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";

// Admin creates a staff account. The server generates the starting password
// and returns it once, so the caller shows it in ResetPasswordModal.
export default function AddStaffModal({ open, onClose, onCreated }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setError("");
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  function close() {
    if (!busy) onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create the staff account.");
      onCreated(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-navy/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={close} />
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => e.key === "Escape" && close()}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-in"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="shrink-0 w-10 h-10 rounded-full bg-navy flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <h2 className="font-display text-xl text-navy">Add staff</h2>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          A starting password is generated and shown once after you create the account.
        </p>

        <label className="block text-xs font-semibold text-slate-500 mb-1.5" htmlFor="staff-name">
          Full name
        </label>
        <input
          id="staff-name"
          ref={nameRef}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={100}
          required
          className={`${inputClass} mb-4`}
        />

        <label className="block text-xs font-semibold text-slate-500 mb-1.5" htmlFor="staff-email">
          Email
        </label>
        <input
          id="staff-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          required
          className={`${inputClass} mb-4`}
        />

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-navy text-white text-sm font-medium py-2 rounded-lg hover:bg-navy-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
