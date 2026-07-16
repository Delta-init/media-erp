/**
 * Date/time policy for mediaERP — the product runs entirely on **IST**
 * (Indian Standard Time, Asia/Kolkata, UTC+05:30).
 *
 * The API sends timezone-aware UTC instants (ISO strings ending in +00:00).
 * Every one of them must be rendered in IST — never the viewer's local
 * timezone — so that all users see the same clock regardless of where they are.
 *
 * ALWAYS use these helpers instead of calling `toLocaleString()` /
 * `toLocaleDateString()` / `toLocaleTimeString()` directly: a bare call uses the
 * browser's timezone and will show the wrong time outside India.
 */

export const IST_TZ = "Asia/Kolkata";
export const IST_LABEL = "IST";

/** Default locale — day/month/year ordering, matching the rest of the UI. */
const DEFAULT_LOCALE = "en-GB";

export type DateInput = string | number | Date | null | undefined;

function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(
  v: DateInput,
  opts: Intl.DateTimeFormatOptions,
  locale: string = DEFAULT_LOCALE,
  fallback = "—"
): string {
  const d = toDate(v);
  if (!d) return fallback;
  // timeZone is forced last so a caller can never accidentally override it.
  return d.toLocaleString(locale, { ...opts, timeZone: IST_TZ });
}

/** Date + time in IST, e.g. "16 Jul 2026, 21:05". */
export function fmtDateTime(
  v: DateInput,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  },
  locale?: string
): string {
  return fmt(v, opts, locale);
}

/** Date only in IST, e.g. "16 Jul 2026". */
export function fmtDate(
  v: DateInput,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
  locale?: string
): string {
  return fmt(v, opts, locale);
}

/** Time only in IST, e.g. "21:05". */
export function fmtTime(
  v: DateInput,
  opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
  locale?: string
): string {
  return fmt(v, opts, locale);
}

/**
 * Format a **date-only** value ("YYYY-MM-DD" — e.g. `task.due_date`,
 * `marketing_data.date`) exactly as written, with no timezone shifting.
 *
 * These values carry no time component, so they must never be converted.
 * `new Date("2026-06-17")` parses as UTC midnight and then renders as the
 * *previous* day for any browser west of UTC — this helper pins the value to
 * IST midnight so the calendar date always renders as-is.
 */
export function fmtDateOnly(
  v: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
  locale: string = DEFAULT_LOCALE,
  fallback = "—"
): string {
  if (!v) return fallback;
  const key = String(v).slice(0, 10);
  const d = new Date(`${key}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString(locale, { ...opts, timeZone: IST_TZ });
}

/** Date + time in IST with an explicit "IST" suffix, for schedules/logs. */
export function fmtDateTimeIST(v: DateInput, opts?: Intl.DateTimeFormatOptions): string {
  const s = fmtDateTime(v, opts);
  return s === "—" ? s : `${s} ${IST_LABEL}`;
}

/**
 * "YYYY-MM-DD" for the IST calendar day an instant falls on.
 * Use this for day comparisons — never `getDate()`, which is browser-local.
 */
export function istDateKey(v: DateInput = new Date()): string {
  const d = toDate(v);
  if (!d) return "";
  // en-CA renders as YYYY-MM-DD.
  return d.toLocaleDateString("en-CA", { timeZone: IST_TZ });
}

/** Today's IST calendar date as "YYYY-MM-DD". */
export function istTodayKey(): string {
  return istDateKey(new Date());
}

/** True when both instants fall on the same IST calendar day. */
export function isSameIstDay(a: DateInput, b: DateInput): boolean {
  const ka = istDateKey(a);
  return !!ka && ka === istDateKey(b);
}

/** True when the instant's IST calendar day is strictly before today (IST). */
export function isBeforeIstToday(v: DateInput): boolean {
  const k = istDateKey(v);
  return !!k && k < istTodayKey();
}
