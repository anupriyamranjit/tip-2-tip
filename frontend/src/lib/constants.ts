/** Shared category → emoji map used across TripView, Budget, and map popups */
export const CATEGORY_ICONS: Record<string, string> = {
  restaurant: "\uD83C\uDF74",
  activity: "\u26F7\uFE0F",
  lodging: "\uD83C\uDFE8",
  transport: "\u2708\uFE0F",
  sightseeing: "\uD83C\uDFDB\uFE0F",
  general: "\uD83D\uDCCD",
  other: "\uD83D\uDCB0",
};

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(date: string | null): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateRange(
  start: string | null,
  end: string | null
): string {
  if (!start && !end) return "Dates TBD";
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  return `Until ${formatDate(end)}`;
}

/** HTML-escape for Leaflet popups — pure string replacement, no DOM allocation */
const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
