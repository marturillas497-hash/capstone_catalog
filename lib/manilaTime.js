// Manila is UTC+8 all year with no daylight saving, so a fixed offset is exact.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/* ISO timestamp of 00:00 on the first day of the current month, Manila time. */
export function manilaMonthStartISO(now = new Date()) {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS);
  const monthStartUtc = Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), 1);
  return new Date(monthStartUtc - MANILA_OFFSET_MS).toISOString();
}
