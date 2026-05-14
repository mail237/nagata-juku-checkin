/** Wall-clock string in Asia/Tokyo matching sheet format `YYYY-MM-DD HH:mm:ss`. */
export function formatTimestampTokyo(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** ISO-like local Tokyo time without offset, for JSON responses. */
export function formatIsoTokyo(d: Date): string {
  const s = formatTimestampTokyo(d);
  return s.replace(" ", "T");
}
