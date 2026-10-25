"use client";

import { MailCheck, AlertTriangle } from "lucide-react";

// Small acknowledgement dialog. warn switches to the amber "needs attention" look.
export default function NoticeModal({ open, onClose, title, message, warn = false }) {
  if (!open) return null;
  const Icon = warn ? AlertTriangle : MailCheck;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-in"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${warn ? "bg-orange/10" : "bg-navy"}`}
          >
            <Icon className={`w-5 h-5 ${warn ? "text-orange-dark" : "text-white"}`} strokeWidth={1.75} />
          </div>
          <h2 className="font-display text-lg text-navy">{title}</h2>
        </div>

        <p className="text-sm text-slate-600 mb-5">{message}</p>

        <button
          onClick={onClose}
          autoFocus
          className="w-full bg-navy text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-navy-dark transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
