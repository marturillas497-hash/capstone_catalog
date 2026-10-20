"use client";

import { useState } from "react";
import { KeyRound, Copy, Check, AlertTriangle } from "lucide-react";

export default function ResetPasswordModal({ open, onClose, password, fullName }) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function handleCopy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    setCopied(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={handleDone} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-in">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-navy">
            <KeyRound className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <h2 className="font-display text-lg text-navy">Password reset</h2>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          New password for <span className="font-medium text-foreground">{fullName}</span>. Shown once, deliver it through a trusted channel.
        </p>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4">
          <span className="font-mono text-base text-foreground flex-1 tracking-wide">{password}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" strokeWidth={1.75} /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
          </button>
        </div>

        <div className="flex gap-2 bg-orange/5 border border-orange/30 rounded-lg px-3 py-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 text-orange-dark shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-slate-600">
            This is not saved anywhere. If you close this without copying it, you will need to reset again.
          </p>
        </div>

        <button
          onClick={handleDone}
          className="w-full bg-navy text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-navy-dark transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}