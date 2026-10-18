import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_LOCALE: Record<string, string> = { INR: "en-IN", USD: "en-US", EUR: "de-DE", GBP: "en-GB" };

export function formatMoney(value: number | null | undefined, currency = "INR", compact = false) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact || Math.abs(n) >= 1000 ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(n);
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(value ?? 0));
}

/**
 * The time zone used for "today", week boundaries and timestamps. Servers (e.g. Vercel)
 * run in UTC, so we pin this explicitly. Override with NEXT_PUBLIC_APP_TIMEZONE.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!value) return "—";
  // Date-only values (YYYY-MM-DD) are calendar dates: format them in UTC so they never shift.
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: APP_TIMEZONE }).format(value instanceof Date ? value : new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: APP_TIMEZONE }).format(
    value instanceof Date ? value : new Date(value),
  );
}

/** Calendar date (YYYY-MM-DD) of an instant in APP_TIMEZONE. */
export function zonedDateISO(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Current hour (0–23) in APP_TIMEZONE. */
export function zonedHour(d: Date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(d));
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's date as YYYY-MM-DD in APP_TIMEZONE (optionally offset by N days). */
export function todayISO(offsetDays = 0) {
  return addDaysISO(zonedDateISO(), offsetDays);
}

/** YYYY-MM-DD from a Date's local calendar fields (for dates you built locally). */
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d` (in APP_TIMEZONE), as YYYY-MM-DD. */
export function weekStart(d = new Date(), offsetWeeks = 0) {
  const iso = zonedDateISO(d);
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
  return addDaysISO(iso, -dow + offsetWeeks * 7);
}

/** UTC instants bounding a calendar day in APP_TIMEZONE — for filtering timestamptz columns. */
export function zonedDayRange(iso: string = todayISO()) {
  const offsetMin = tzOffsetMinutes(new Date(`${iso}T12:00:00Z`));
  const start = new Date(new Date(`${iso}T00:00:00Z`).getTime() - offsetMin * 60_000);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

function tzOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUTC - at.getTime()) / 60_000);
}

export function currentQuarter(d = new Date()) {
  const [y, m] = zonedDateISO(d).split("-").map(Number);
  return `${y}-Q${Math.floor((m! - 1) / 3) + 1}`;
}

export function isOverdue(due: string | null | undefined) {
  return !!due && due < todayISO();
}

export function relativeDay(due: string | null | undefined) {
  if (!due) return null;
  const t = todayISO();
  if (due === t) return "Today";
  if (due === todayISO(1)) return "Tomorrow";
  if (due === todayISO(-1)) return "Yesterday";
  return formatDate(due);
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
}

/** Read an optional string field from FormData: empty strings become null. */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
