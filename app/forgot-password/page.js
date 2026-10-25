"use client";

import { useState } from "react";
import { Mail, Hash, MailCheck, ArrowLeft } from "lucide-react";

const INPUT =
  "w-full pl-11 pr-4 py-3 rounded-2xl bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 transition neo-transition";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, studentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-neo p-8 animate-page-ease-in">
        {sent ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-navy/10 mb-4">
              <MailCheck className="w-6 h-6 text-navy" strokeWidth={1.75} />
            </div>
            <h1 className="font-display !font-bold text-2xl text-navy mb-2">Check your email</h1>
            <p className="text-sm text-slate-600 mb-6">
              If the details match an account, a link to set a new password is on its way. It works once and
              expires in 1 hour.
            </p>
            <a href="/login" className="text-sm text-orange font-medium hover:underline">
              Back to log in
            </a>
          </div>
        ) : (
          <>
            <h1 className="font-display !font-bold text-2xl text-navy mb-1">Forgot your password?</h1>
            <p className="text-sm text-slate-600 mb-6">
              Enter the email you registered with. Students also enter their student ID. We will email you a
              link to set a new password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Email"
                  className={INPUT}
                />
              </div>

              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  maxLength={20}
                  inputMode="numeric"
                  placeholder="Student ID (students only)"
                  className={INPUT}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-navy text-white text-sm font-medium py-3 rounded-full hover:bg-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <a
              href="/login"
              className="mt-6 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              Back to log in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
