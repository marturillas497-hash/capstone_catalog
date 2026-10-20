const TONES = {
  navy: "bg-navy/10 text-navy",
  gold: "bg-gold/25 text-navy",
  orange: "bg-orange/10 text-orange-dark",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-600",
};

/* Icon in a tinted circle, big value, small label. `hint` is an optional muted line. */
export default function StatCard({ icon: Icon, tone = "navy", value, label, hint, loading = false }) {
  return (
    <div className="flex-1 min-w-[min(100%,200px)] bg-background shadow-neo rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0 ${TONES[tone]}`}>
        <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-7 w-14 bg-slate-100 rounded animate-pulse mb-1" />
        ) : (
          <p className="text-2xl font-bold text-navy leading-tight">{value}</p>
        )}
        <p className="text-[13px] text-slate-500">
          {label}
          {hint && <span className="text-slate-400"> · {hint}</span>}
        </p>
      </div>
    </div>
  );
}
