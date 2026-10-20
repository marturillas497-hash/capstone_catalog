"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react";

const MIN_LENGTH = 8;

export default function ChangePasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  function resetAndClose() {
    if (submitting) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError(null);
    setSuccess(false);
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("Could not verify your account, try signing in again.");
        setSubmitting(false);
        return;
      }

      // Reauthenticate with the current password before allowing the change.
      // supabase.auth.updateUser() does not check the old password on its own,
      // so without this step an unattended, unlocked session could have its
      // password changed by anyone at the keyboard.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        setError("Current password is incorrect.");
        setSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message || "Could not update your password, try again.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong, try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={resetAndClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-in">
        {success ? (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-xl text-navy mb-1">Password Updated</h2>
            <p className="text-sm text-slate-500 mb-6">
              Your password has been changed. You are still signed in, no need to log back in.
            </p>
            <button
              onClick={resetAndClose}
              className="w-full bg-navy text-white text-sm font-medium py-2 rounded-lg hover:bg-navy-dark transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-navy" strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-xl text-navy">Change Password</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrent ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={MIN_LENGTH}
                    autoComplete="new-password"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">At least {MIN_LENGTH} characters.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={MIN_LENGTH}
                    autoComplete="new-password"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-navy text-white text-sm font-medium py-2 rounded-lg hover:bg-navy-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Updating…" : "Update Password"}
                </button>
                <button
                  type="button"
                  onClick={resetAndClose}
                  disabled={submitting}
                  className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}