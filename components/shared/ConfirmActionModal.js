"use client";

// Generic confirmation modal for /admin/users (F16). Replaces the plain
// browser confirm() dialogs used for Suspend/Unsuspend and the step
// before generating a new password, matching the visual pattern already
// established by the Navbar sign-out confirmation (F14) and the
// ResetPasswordModal reveal step: centered white card, backdrop-blur-sm
// overlay, rounded-2xl corners.
//
// One shared component rather than three near-identical modals, since
// the only real differences between Suspend, Unsuspend, and Reset
// Password's confirm step are the icon, color, copy, and the async
// action that runs on confirm.

export default function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  busy,
  icon: Icon,
  iconBg = "bg-navy",
  iconColor = "text-white",
  title,
  description,
  confirmLabel,
  confirmingLabel,
  confirmClassName = "bg-navy hover:bg-navy-dark",
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-in">
        <div className="flex items-center gap-3 mb-2">
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
            {Icon && <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.75} />}
          </div>
          <h2 className="font-display text-xl text-navy">{title}</h2>
        </div>

        <p className="text-sm text-slate-600 mb-6">{description}</p>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${confirmClassName}`}
          >
            {busy ? confirmingLabel : confirmLabel}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}