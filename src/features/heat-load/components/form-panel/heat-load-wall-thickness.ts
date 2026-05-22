import type { Row } from "./heat-load-sheet-types";
import { getWallCoreThicknessMm } from "./ashrae-wall-assemblies";

const MIN_PLAUSIBLE_MASONRY_THICKNESS_MM = 50;
export const DEFAULT_THIN_MASONRY_THICKNESS_MM = 100;
export const DEFAULT_BRICK_WALL_THICKNESS_MM = 215;

export function rowLooksLikeWall(row: Row) {
  const item = row.values.item ?? "";
  const type = row.values.type ?? row.values.typeA ?? row.values.typeB ?? "";

  return item.includes("Wall") || type.includes("Wall");
}

export function normalizeWallThicknessMm(value: number, fallbackMm?: number): number;
export function normalizeWallThicknessMm(value: string, fallbackMm?: number): number | string;
export function normalizeWallThicknessMm(value: string | number, fallbackMm = DEFAULT_THIN_MASONRY_THICKNESS_MM) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return typeof value === "number" ? fallbackMm : String(value);
  }

  if (parsed < MIN_PLAUSIBLE_MASONRY_THICKNESS_MM) {
    return fallbackMm;
  }

  return parsed;
}

export function normalizeWallThicknessCell(value: string) {
  const normalized = normalizeWallThicknessMm(value);

  if (typeof normalized === "string") {
    return normalized;
  }

  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
}

export function defaultWallThicknessMmForType(type: string) {
  const assemblyThicknessMm = getWallCoreThicknessMm(type);
  if (assemblyThicknessMm) {
    return assemblyThicknessMm;
  }

  return type.includes("Brick") ? DEFAULT_BRICK_WALL_THICKNESS_MM : DEFAULT_THIN_MASONRY_THICKNESS_MM;
}

export function normalizeWallRowThicknessCell(row: Row, value: string) {
  const type = row.values.type ?? row.values.typeA ?? row.values.typeB ?? "";
  const assemblyThicknessMm = getWallCoreThicknessMm(type);
  if (assemblyThicknessMm) {
    return String(assemblyThicknessMm);
  }

  const normalized = normalizeWallThicknessMm(value, defaultWallThicknessMmForType(type));

  if (typeof normalized === "string") {
    return normalized;
  }

  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
}
