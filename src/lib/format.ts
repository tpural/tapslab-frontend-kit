/**
 * Formatters.
 *
 * All of these take an explicit locale defaulting to undefined, which makes
 * Intl use the runtime's locale. That is deliberate but has a sharp edge in
 * SSR: the server's locale is usually en-US while the browser's is the user's,
 * so a date rendered on both sides can mismatch during hydration. For
 * user-visible dates in a Server Component, either pass an explicit locale or
 * render the raw ISO string and format it client-side.
 */

export function formatDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatDateTime(value: string | number | Date, locale?: string): string {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" }, locale);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
];

/** "3 days ago", "in 2 hours". */
export function formatRelative(
  value: string | number | Date,
  now: Date = new Date(),
  locale?: string,
): string {
  const delta = new Date(value).getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(delta) >= ms) {
      return formatter.format(Math.round(delta / ms), unit);
    }
  }
  return formatter.format(0, "second");
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** 1024 -> "1.0 KB". Binary units, since this is for file and payload sizes. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : decimals)} ${units[exponent]}`;
}

/** Truncate on a word boundary where possible. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
