/*
 * Plain SVG donut, no chart library. Segments are drawn as stroked arcs on a
 * single circle. Zero-value segments are skipped so an empty slice never
 * leaves a stray gap.
 *
 * segments: [{ label, value, color }]
 */
const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function DonutChart({ segments, centerValue, centerLabel, size = 150 }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 3 : 0;

  let offset = 0;
  const arcs = visible.map((s) => {
    const length = (s.value / total) * CIRCUMFERENCE;
    const arc = (
      <circle
        key={s.label}
        cx="70"
        cy="70"
        r={R}
        fill="none"
        stroke={s.color}
        strokeWidth="16"
        strokeDasharray={`${Math.max(length - gap, 0)} ${CIRCUMFERENCE}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 70 70)"
      />
    );
    offset += length;
    return arc;
  });

  const summary = segments.map((s) => `${s.label}: ${s.value}`).join(", ");

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={summary}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {arcs}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold leading-none text-navy">{centerValue}</span>
        {centerLabel && <span className="text-xs text-slate-500 mt-1">{centerLabel}</span>}
      </div>
    </div>
  );
}

/** Card wrapper: title, donut on the left, legend with counts on the right. */
export default function DonutCard({ title, segments, centerValue, centerLabel, footer }) {
  return (
    <div className="flex-1 min-w-[min(100%,300px)] bg-background shadow-neo rounded-2xl p-6">
      <h2 className="text-base font-bold text-navy mb-5">{title}</h2>
      <div className="flex flex-wrap items-center gap-6">
        <DonutChart segments={segments} centerValue={centerValue} centerLabel={centerLabel} />
        <ul className="flex flex-col gap-2.5 min-w-[130px]">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 text-sm text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="flex-1">{s.label}</span>
              <span className="font-bold text-navy">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
      {footer}
    </div>
  );
}
