export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function relative(iso: string, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (Math.abs(s) < 60) return "just now";
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return m > 0 ? `${m}m ago` : `in ${-m}m`;
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return h > 0 ? `${h}h ago` : `in ${-h}h`;
  const d = Math.round(h / 24);
  return d > 0 ? `${d}d ago` : `in ${-d}d`;
}

/** "in 7d", "today", "3d overdue" for a YYYY-MM-DD deadline. */
export function deadlineLabel(days: number | undefined) {
  if (days === undefined) return "—";
  if (days === 0) return "today";
  if (days < 0) return `${-days}d overdue`;
  return `in ${days}d`;
}
