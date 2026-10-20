/**
 * Staged progress indicator, a single circular spinner with a changing
 * label underneath, plus a row of dots marking position across the stages.
 *
 * This is deliberately a paced, staged visual, not a literal readout of
 * server-side events. /api/analyze and /api/library/search are each one
 * atomic request, there is no real signal from the server marking when
 * one internal step ends and the next begins. Stage transitions are timed
 * client-side to feel like real progress without claiming precision the
 * system doesn't actually have. See PRD / progress.md for the reasoning
 * behind this choice over a true server-streamed progress bar.
 *
 * Props:
 *  - stages (required): array of { key, label, description? }, in order.
 *  - activeIndex (required): index of the currently active stage. The
 *      component holds visually on this stage, completed stages (index
 *      below activeIndex) render as filled checkmarks.
 */
import { Check } from "lucide-react";

export default function ScanProgress({ stages, activeIndex }) {
  const current = stages[Math.min(activeIndex, stages.length - 1)];

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="relative w-16 h-16 mb-5">
        <div className="absolute inset-0 rounded-full border-4 border-navy/10" />
        <div className="absolute inset-0 rounded-full border-4 border-navy border-t-transparent animate-spin" />
      </div>

      <p className="text-base font-medium text-navy text-center">{current?.label}</p>
      {current?.description && (
        <p className="text-xs text-slate-400 mt-1 text-center max-w-xs">{current.description}</p>
      )}

      <div className="flex items-center gap-2 mt-6">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-5 h-5 rounded-full transition-colors shrink-0
                ${i < activeIndex ? "bg-navy" : i === activeIndex ? "bg-navy/15 ring-2 ring-navy/30" : "bg-slate-100"}`}
            >
              {i < activeIndex && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
              {i === activeIndex && <span className="w-1.5 h-1.5 rounded-full bg-navy animate-pulse" />}
            </div>
            {i < stages.length - 1 && (
              <div className={`w-8 h-0.5 rounded-full ${i < activeIndex ? "bg-navy" : "bg-slate-100"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}