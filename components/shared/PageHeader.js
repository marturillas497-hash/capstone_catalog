/*
 * Unified page-level header (PRD Section 21, "Page Header Pattern").
 * Applies to page-level h1 headings only, never inside modals or cards.
 *
 * Variants:
 *  - "editorial" (default): optional breadcrumb, large title, hairline with a
 *    short orange segment. Used by most pages.
 *  - "banner": navy card with gold eyebrow and a right-side action. Used by the
 *    three role dashboards.
 *  - "stats": white card with an icon tile, optional stat pills, crumbs,
 *    badge and actions. Used by Analytics and most standard pages.
 *  - "dense": single row with icon, title and count badge, for table pages.
 *
 * Props:
 *  - title (required), subtitle
 *  - variant: "editorial" | "banner" | "stats" | "dense"
 *  - compact: smaller editorial title for long dynamic titles (report pages)
 *  - crumbs: string[] shown above an editorial or stats header, last item highlighted
 *  - eyebrow: small uppercase label above a banner title
 *  - actions: node on the right (e.g. a primary button)
 *  - stats: [{ label, value, tone }] for the stats variant
 *  - icon: lucide icon for the stats, dense and editorial variants, drawn by
 *    the shared IconTile (soft navy tile with an orange dot, as on Analytics)
 *  - badge: node next to the title (e.g. a count pill)
 *  - children: extra content under the subtitle
 *  - iconBg: accepted for backward compatibility and ignored
 */
/* Single source for the header icon, so every page that shows one matches. */
function IconTile({ icon: Icon, size = "lg" }) {
  const lg = size === "lg";
  return (
    <div
      className={`relative rounded-2xl bg-navy/10 flex items-center justify-center shrink-0 ${
        lg ? "w-[60px] h-[60px]" : "w-11 h-11"
      }`}
    >
      <Icon className={lg ? "w-7 h-7 text-navy" : "w-5 h-5 text-navy"} strokeWidth={1.75} />
      <span
        className={`absolute -right-1 -top-1 rounded-full bg-orange border-white ${
          lg ? "h-3.5 w-3.5 border-[3px]" : "h-3 w-3 border-2"
        }`}
      />
    </div>
  );
}

function Crumbs({ items }) {
  return (
    <p className="text-[13px] font-semibold text-slate-500 mb-2">
      {items.map((item, i) => (
        <span key={item}>
          {i > 0 && <span className="text-slate-300 mx-1.5">/</span>}
          <span className={i === items.length - 1 ? "text-[#B84E00]" : ""}>{item}</span>
        </span>
      ))}
    </p>
  );
}

function Banner({ title, subtitle, eyebrow, actions, children }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-navy px-6 sm:px-8 py-8 mb-8 flex flex-wrap items-center justify-between gap-6">
      <div className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full bg-gold/10" />
      <div className="pointer-events-none absolute right-36 -bottom-28 h-52 w-52 rounded-full bg-orange/15" />
      <div className="absolute bottom-0 left-0 h-1 w-16 bg-orange" />
      <div className="absolute bottom-0 left-16 h-1 w-6 bg-gold" />
      <div className="relative min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.1em] text-gold">{eyebrow}</p>}
        <h1 className="font-display text-3xl md:text-4xl leading-tight text-white mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-white/75 mt-1.5">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="relative shrink-0">{actions}</div>}
    </div>
  );
}

function Stats({ title, subtitle, icon: Icon, stats = [], crumbs, badge, actions, children }) {
  return (
    <>
      {crumbs && crumbs.length > 0 && <Crumbs items={crumbs} />}
      <div className="bg-background shadow-neo rounded-2xl px-6 py-6 mb-8 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          {Icon && <IconTile icon={Icon} />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl leading-tight text-navy">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            {children}
          </div>
        </div>
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {stats.map((s) => (
              <div key={s.label} className={`rounded-xl px-[18px] py-2.5 ${s.tone === "navy" ? "bg-navy/10" : "bg-slate-100"}`}>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-navy leading-tight">{s.value}</p>
              </div>
            ))}
          </div>
        )}
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </>
  );
}

function Dense({ title, subtitle, icon: Icon, badge, actions, children }) {
  return (
    <div className="border-b border-slate-200 pb-4 mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && <IconTile icon={Icon} size="md" />}
        <h1 className="font-display text-2xl text-navy">{title}</h1>
        {badge}
        {children}
      </div>
      {actions
        ? <div className="shrink-0">{actions}</div>
        : subtitle && <p className="text-[13px] text-slate-500 max-w-sm sm:text-right">{subtitle}</p>}
    </div>
  );
}

function Editorial({ title, subtitle, crumbs, compact, icon: Icon, badge, actions, children }) {
  return (
    <div className={`relative border-b border-slate-200 pb-5 ${compact ? "mb-6" : "mb-8"}`}>
      <span className="absolute left-0 -bottom-px h-[3px] w-[72px] rounded-full bg-orange" />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          {crumbs && crumbs.length > 0 && <Crumbs items={crumbs} />}
          <div className="flex items-center gap-4">
            {Icon && <IconTile icon={Icon} size={compact ? "md" : "lg"} />}
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1
                  className={`font-display text-navy tracking-tight ${
                    compact ? "text-2xl leading-snug" : "text-3xl md:text-[40px] leading-tight"
                  }`}
                >
                  {title}
                </h1>
                {badge}
              </div>
              {subtitle && <p className="text-slate-500 mt-2 text-[15px]">{subtitle}</p>}
              {children}
            </div>
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default function PageHeader({ variant = "editorial", ...props }) {
  if (variant === "banner") return <Banner {...props} />;
  if (variant === "stats") return <Stats {...props} />;
  if (variant === "dense") return <Dense {...props} />;
  return <Editorial {...props} />;
}
