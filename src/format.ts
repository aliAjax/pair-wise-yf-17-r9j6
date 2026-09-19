export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fmtCents(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

/** 温湿度判定参考（管风琴常见维护区间） */
export function tempLevel(t: number): "ok" | "warn" | "bad" {
  if (t >= 15 && t <= 22) return "ok";
  if (t >= 12 && t <= 25) return "warn";
  return "bad";
}

export function humidityLevel(h: number): "ok" | "warn" | "bad" {
  if (h >= 45 && h <= 60) return "ok";
  if (h >= 38 && h <= 68) return "warn";
  return "bad";
}
