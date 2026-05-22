import table5Json from "../ashrae-tables/fenestration-u-table5-1997.json";

import { normalizeText } from "./common";

type Table5Column = {
  id: string;
  label: string;
};

type Table5Record = {
  id: number;
  category: string;
  glazing: string;
  u: Array<number | null>;
};

type Table5Data = {
  metadata: {
    source: string;
    pages: string[];
    title: string;
    units: string;
    scope: string;
    notes?: string[];
  };
  columns: Table5Column[];
  records: Table5Record[];
};

const table5 = table5Json as Table5Data;

export const ASHRAE_TABLE5_FENESTRATION_SOURCE =
  "ASHRAE 1997 Ch29 Table 5, pages 29.8-29.9";

export const ASHRAE_TABLE5_DEFAULT_FRAME_LABEL =
  table5.columns[0]?.label ?? "Vertical glass only - center of glass";
export const ASHRAE_TABLE5_DEFAULT_SKYLIGHT_FRAME_LABEL =
  table5.columns.find((column) => column.id === "skylight_glass_center")?.label ??
  "Skylight glass only - center of glass";

const FRAME_LEGACY_LABELS: Record<string, string> = {
  "glass only centre of glass": "vertical_glass_center",
  "glass only center of glass": "vertical_glass_center",
  "vertical glass only centre of glass": "vertical_glass_center",
  "vertical glass only center of glass": "vertical_glass_center",
  "glass only edge of glass": "vertical_glass_edge",
  "vertical glass only edge of glass": "vertical_glass_edge",
  "operablewood vinyl": "operable_wood_or_vinyl",
  "operable wood vinyl": "operable_wood_or_vinyl",
  "fixed wood vinyl": "fixed_wood_or_vinyl",
};

function searchText(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/\bpolycarb\b/g, "polycarbonate")
    .replace(/\bairspace\b/g, "air space")
    .replace(/\s+/g, " ")
    .trim();
}

function getNominalThicknessMm(record: Table5Record) {
  const match = record.glazing.match(/(\d+(?:\.\d+)?)\s*mm/);

  return match ? Math.round(Number(match[1])) : null;
}

function toFriendlyCategory(category: string) {
  return category
    .replace(/^Single Glazing$/, "Single glazing")
    .replace(/^Double Glazing$/, "Double glazing")
    .replace(/^Triple Glazing$/, "Triple glazing")
    .replace(/^Quadruple Glazing$/, "Quadruple glazing")
    .replace(/^Double Glazing, e = ([\d.]+) /, "Double glazing with low-emittance coating $1 ")
    .replace(/^Triple Glazing, e = ([\d.]+) /, "Triple glazing with low-emittance coating $1 ")
    .replace(/^Quadruple Glazing, e = ([\d.]+) /, "Quadruple glazing with low-emittance coating $1 ");
}

function toCompactCategory(category: string) {
  const lowE = category.match(/^(Double|Triple|Quadruple) Glazing, e = ([\d.]+) on (.+)$/);

  if (lowE) {
    return `${lowE[1]} glazing - low-e ${lowE[2]} (${lowE[3]})`;
  }

  return toFriendlyCategory(category);
}

function toFriendlyGlazing(glazing: string) {
  return glazing
    .replace("polycarb", "polycarbonate")
    .replace("airspace", "air space")
    .replace("airspaces", "air spaces");
}

function toCompactGlazing(glazing: string) {
  return toFriendlyGlazing(glazing).replace(/^\d+(?:\.\d+)?\s*mm\s+/, "");
}

export function getAshraeTable5GlazingLabel(record: Table5Record) {
  return `${toFriendlyCategory(record.category)} - ${toFriendlyGlazing(record.glazing)}`;
}

export function getAshraeTable5CompactGlazingLabel(record: Table5Record) {
  return `${toCompactCategory(record.category)} - ${toCompactGlazing(record.glazing)}`;
}

export const ashraeTable5GlazingOptions = Array.from(
  new Set(table5.records.map(getAshraeTable5CompactGlazingLabel)),
);

export const ashraeTable5FrameOptions = table5.columns.map((column) => column.label);

export const ashraeTable5ThicknessOptions = Array.from(
  new Set(
    table5.records
      .map(getNominalThicknessMm)
      .filter((value): value is number => value !== null)
      .map(String),
  ),
).sort((left, right) => Number(left) - Number(right));

export const ASHRAE_TABLE5_DEFAULT_GLAZING_LABEL = getAshraeTable5CompactGlazingLabel(table5.records[0]);

const recordsByFullLabel = new Map(
  table5.records.map((record) => [searchText(getAshraeTable5GlazingLabel(record)), record]),
);

const compactLabelsByRecord = new Map(
  table5.records.map((record) => [record.id, searchText(getAshraeTable5CompactGlazingLabel(record))]),
);

const columnIndexById = new Map(table5.columns.map((column, index) => [column.id, index]));

const columnIdByLabel = new Map(
  table5.columns.map((column) => [searchText(column.label), column.id]),
);

const FIRST_TABLE_PAGE_COLUMN_COUNT = 12;

function getRecordById(id: number) {
  return table5.records.find((record) => record.id === id) ?? null;
}

function findCompactRecord(glazingType: string, thicknessMm: number) {
  const text = searchText(glazingType);
  const matches = table5.records.filter((record) => compactLabelsByRecord.get(record.id) === text);

  if (matches.length === 0) {
    return null;
  }

  if (!thicknessMm) {
    return matches
      .slice()
      .sort((left, right) => (getNominalThicknessMm(left) ?? 0) - (getNominalThicknessMm(right) ?? 0))[0];
  }

  return matches
    .slice()
    .sort((left, right) =>
      Math.abs((getNominalThicknessMm(left) ?? thicknessMm) - thicknessMm) -
      Math.abs((getNominalThicknessMm(right) ?? thicknessMm) - thicknessMm),
    )[0];
}

function findLegacyRecord(glazingType: string, thicknessMm: number) {
  const text = searchText(glazingType);

  if (text.includes("acrylic") || text.includes("polycarbonate")) {
    return getRecordById(thicknessMm >= 5 ? 2 : 3);
  }

  if (text.includes("single") && text.includes("glass")) {
    return getRecordById(1);
  }

  if (text.includes("12 7") && text.includes("argon")) return getRecordById(7);
  if (text.includes("6 4") && text.includes("argon")) return getRecordById(6);
  if (text.includes("12 7") && text.includes("air space")) return getRecordById(5);
  if (text.includes("6 4") && text.includes("air space")) return getRecordById(4);

  return null;
}

export function findAshraeTable5Record(glazingType: string, thicknessMm = 0) {
  const text = searchText(glazingType);
  const exact = recordsByFullLabel.get(text);

  if (exact) return exact;

  const compact = findCompactRecord(glazingType, thicknessMm);

  if (compact) return compact;

  const readableMatch = table5.records.find((record) =>
    searchText(`${record.category} ${record.glazing}`).includes(text),
  );

  return readableMatch ?? findLegacyRecord(glazingType, thicknessMm);
}

export function normalizeAshraeTable5GlazingLabel(glazingType: string, thicknessMm = 0) {
  const record = findAshraeTable5Record(glazingType, thicknessMm) ?? table5.records[0];
  return getAshraeTable5CompactGlazingLabel(record);
}

export function normalizeAshraeTable5FrameLabel(frameType: string | undefined) {
  const normalized = searchText(frameType || ASHRAE_TABLE5_DEFAULT_FRAME_LABEL);
  const legacyId = FRAME_LEGACY_LABELS[normalized];
  const columnId = legacyId ?? columnIdByLabel.get(normalized) ?? "vertical_glass_center";
  return table5.columns.find((column) => column.id === columnId)?.label ?? ASHRAE_TABLE5_DEFAULT_FRAME_LABEL;
}

export function getAshraeTable5FrameOptions(glazingType: string, thicknessMm = 0) {
  const record = findAshraeTable5Record(glazingType, thicknessMm);

  if (!record) {
    return table5.columns.filter((column) => !columnIsSkylightProduct(column)).map((column) => column.label);
  }

  return table5.columns
    .filter((column, index) => !columnIsSkylightProduct(column) && typeof record.u[index] === "number")
    .map((column) => column.label);
}

function columnIsSkylightProduct(column: Table5Column) {
  return (
    column.id.startsWith("skylight_") ||
    column.id.startsWith("manufactured_skylight_") ||
    column.id.startsWith("site_assembled_sloped_overhead_")
  );
}

export function getAshraeTable5SkylightFrameOptions(glazingType: string, thicknessMm = 0) {
  const record = findAshraeTable5Record(glazingType, thicknessMm);

  if (!record) {
    return table5.columns.filter(columnIsSkylightProduct).map((column) => column.label);
  }

  return table5.columns
    .filter((column, index) => columnIsSkylightProduct(column) && typeof record.u[index] === "number")
    .map((column) => column.label);
}

export function getAshraeTable5FramePart(frameType: string | undefined) {
  const frameLabel = normalizeAshraeTable5FrameLabel(frameType);
  const columnId = columnIdByLabel.get(searchText(frameLabel)) ?? "vertical_glass_center";
  const columnIndex = columnIndexById.get(columnId) ?? 0;

  return columnIndex < FIRST_TABLE_PAGE_COLUMN_COUNT ? "first" : "continued";
}

export function getAshraeTable5ThicknessOptions(glazingType: string) {
  const text = searchText(normalizeAshraeTable5GlazingLabel(glazingType));
  const options = table5.records
    .filter((record) => compactLabelsByRecord.get(record.id) === text)
    .map(getNominalThicknessMm)
    .filter((value): value is number => value !== null)
    .map(String);

  return Array.from(new Set(options)).sort((left, right) => Number(left) - Number(right));
}

export function getAshraeTable5NominalThicknessMm(glazingType: string) {
  const options = getAshraeTable5ThicknessOptions(glazingType);

  return options.length > 0 ? Number(options[0]) : null;
}

export function lookupAshraeTable5VerticalUFactor(input: {
  glazingType: string;
  frameType?: string;
  thicknessMm: number;
}) {
  const record = findAshraeTable5Record(input.glazingType, input.thicknessMm);
  const frameLabel = normalizeAshraeTable5FrameLabel(input.frameType);
  const columnId = columnIdByLabel.get(searchText(frameLabel)) ?? "vertical_glass_center";
  const columnIndex = columnIndexById.get(columnId);

  if (!record || columnIndex == null) {
    return null;
  }

  const value = record.u[columnIndex];

  if (typeof value !== "number") {
    return null;
  }

  return {
    value,
    frameLabel,
    recordLabel: getAshraeTable5GlazingLabel(record),
    ashraeId: record.id,
  };
}
