export function getNum(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isBlank(value: string | null | undefined) {
  return value == null || value.trim() === "";
}

export function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesText(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatSource(source: string, detail: string) {
  return `${detail} | ${source}`;
}

export function getTableNumber<T extends Record<string, number>>(
  table: T,
  key: string,
  fallback: number,
) {
  const value = table[key as keyof T];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
