/**
 * Tiny, dependency-free IANA-timezone helpers built on `Intl`. Node 22 ships
 * full ICU, so every IANA zone (and its DST rules) is available.
 */

/** Offset (ms) of `timeZone` relative to UTC at the given instant. */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    Number(m.hour),
    Number(m.minute),
    Number(m.second),
  );
  return asUTC - date.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to the corresponding UTC instant,
 * applying the DST offset in effect on that date (so spring/autumn changes are
 * handled correctly). Returns null for an invalid timezone.
 */
export function zonedWallClockToUTC(
  year: number,
  month1: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date | null {
  try {
    const asUTC = Date.UTC(year, month1 - 1, day, hour, minute);
    const o1 = tzOffsetMs(timeZone, new Date(asUTC));
    let instant = asUTC - o1;
    const o2 = tzOffsetMs(timeZone, new Date(instant));
    if (o2 !== o1) instant = asUTC - o2; // re-resolve across a DST boundary
    return new Date(instant);
  } catch {
    return null;
  }
}

/** The calendar date (year, month 1-12, day) of an instant within `timeZone`. */
export function localDateInTz(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return { year: Number(m.year), month: Number(m.month), day: Number(m.day) };
}

/** Website dayIndex (0=Mon … 6=Sun) for a calendar date. */
export function dayIndexOfDate(year: number, month1: number, day: number): number {
  return (new Date(Date.UTC(year, month1 - 1, day)).getUTCDay() + 6) % 7;
}
