/*
 * Horizontal ranked bars. Each bar is scaled against the top item, so the
 * first row is always full width. Rows beyond `highlight` use the dim color,
 * which keeps a Top 10 readable without ten equally loud bars.
 *
 * Long titles wrap onto a second line rather than being cut off.
 *
 * items: [{ id, title, count }], already sorted descending.
 */
export default function RankedBars({
  items,
  color = "#003366",
  dimColor,
  highlight = items.length,
  emptyText = "No data yet.",
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyText}</p>;
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ol className="flex flex-col gap-3.5">
      {items.map((item, i) => (
        <li key={item.id}>
          <div className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="w-5 shrink-0 font-bold text-slate-400">{i + 1}</span>
            <span className="flex-1 min-w-0 font-medium leading-snug break-words">
              {item.title}
            </span>
            <span className="font-bold text-navy shrink-0">{item.count}</span>
          </div>
          <div className="mt-1.5 ml-[30px] h-2.5 rounded-full bg-slate-100">
            <div
              className="h-2.5 rounded-full"
              style={{
                width: `${(item.count / max) * 100}%`,
                backgroundColor: i < highlight ? color : dimColor || color,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
