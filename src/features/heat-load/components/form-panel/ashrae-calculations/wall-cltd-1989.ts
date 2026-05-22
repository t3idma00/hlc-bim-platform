import latitudeMonthCorrections from "../ashrae-tables/cltd-latitude-month-table32-1989.json";
import wallCltdRows from "../ashrae-tables/cltd-wall-table31-1989.json";
import wallConstructionRows from "../ashrae-tables/wall-construction-table30-1989.json";
import { defaultWallThicknessMmForType, normalizeWallThicknessMm } from "../heat-load-wall-thickness";
import { getAshrae1989WallAssembly, getAshrae1997WallArchetype } from "../ashrae-wall-assemblies";

import { formatSource } from "./common";
import type { DesignConditionContext, FactorResult } from "./types";

const TABLE_30_REFERENCE = "ASHRAE 1989 Fundamentals Handbook (SI), Table 30 wall construction groups";
const TABLE_31_REFERENCE = "ASHRAE 1989 Fundamentals Handbook (SI), Table 31 sunlit wall CLTD, pp.26.36-26.37";
const TABLE_32_REFERENCE =
  "ASHRAE 1989 Fundamentals Handbook (SI), Table 32 latitude/month CLTD correction, pp.26.38-26.39";

type WallConstructionRow = {
  construction_category: string;
  group_no: string;
  description_of_construction: string;
  u_value_w_m2_c: string;
  u_min_w_m2_c: number;
  u_max_w_m2_c: number;
};

type WallCltdRow = {
  wall_group: string;
  orientation: string;
} & Record<string, string | number>;

type LatitudeMonthCorrectionRow = {
  latitude_deg_N: number;
  month: string;
  N: number;
  NNE_NNW: number;
  NE_NW: number;
  ENE_WNW: number;
  E_W: number;
  ESE_WSW: number;
  SE_SW: number;
  SSE_SSW: number;
  S: number;
  HOR: number;
};

type WallConstructionChoice = {
  category: string;
  description: string;
  assumedCoreThicknessMm: number;
  uValueWPerM2K?: number;
};

export type Ashrae1989WallAssembly = {
  row: WallConstructionRow;
  normalizedThicknessMm: number;
  assumedCoreThicknessMm: number;
  uValueWPerM2K: number;
  groupLabel: string;
};

const constructions = wallConstructionRows as WallConstructionRow[];
const cltdRows = wallCltdRows as WallCltdRow[];
const correctionRows = latitudeMonthCorrections as LatitudeMonthCorrectionRow[];

function text(value: string) {
  return value.trim().toLowerCase();
}

function table31Hour(designHour: number) {
  const rounded = Math.min(24, Math.max(1, Math.round(designHour || 15)));
  return `${String(rounded).padStart(2, "0")}00`;
}

function chooseWallConstruction(type: string, thicknessMm: number): WallConstructionChoice | null {
  const archetype = getAshrae1997WallArchetype(type);
  if (archetype?.scope === "opaque-wall") {
    return {
      category: archetype.cltdTable30Category,
      description: archetype.cltdTable30Description,
      assumedCoreThicknessMm: archetype.coreThicknessMm,
    };
  }

  const assembly = getAshrae1989WallAssembly(type);
  if (assembly) {
    return {
      category: assembly.table30Category,
      description: assembly.table30Description,
      assumedCoreThicknessMm: assembly.coreThicknessMm,
      uValueWPerM2K: assembly.uValueWPerM2K,
    };
  }

  const isThinWall = thicknessMm < 150;

  if (type.includes("Brick")) {
    return {
      category: "100-mm face brick + (brick)",
      description: isThinWall ? "100-mm common brick" : "200-mm common brick",
      assumedCoreThicknessMm: isThinWall ? 100 : 200,
    };
  }

  if (type.includes("Cement")) {
    return {
      category: "100-mm face brick + (light or heavyweight concrete block)",
      description: isThinWall ? "100-mm block" : "200-mm block",
      assumedCoreThicknessMm: isThinWall ? 100 : 200,
    };
  }

  if (type.includes("Concrete")) {
    return {
      category: "Heavyweight concrete wall + (finish)",
      description: isThinWall ? "100-mm concrete" : "200-mm concrete",
      assumedCoreThicknessMm: isThinWall ? 100 : 200,
    };
  }

  return null;
}

function representativeUValue(row: WallConstructionRow) {
  if (Number.isFinite(row.u_min_w_m2_c) && Number.isFinite(row.u_max_w_m2_c)) {
    return row.u_max_w_m2_c;
  }

  return Number.parseFloat(row.u_value_w_m2_c);
}

export function resolveAshrae1989WallAssembly(
  type: string,
  thicknessMm = defaultWallThicknessMmForType(type),
): Ashrae1989WallAssembly | null {
  const normalizedThicknessMm = normalizeWallThicknessMm(
    thicknessMm,
    defaultWallThicknessMmForType(type),
  );
  const choice = chooseWallConstruction(type, normalizedThicknessMm);

  if (!choice) {
    return null;
  }

  const row = constructions.find(
    (item) =>
      text(item.construction_category) === text(choice.category) &&
      text(item.description_of_construction) === text(choice.description),
  );
  const uValueWPerM2K = choice.uValueWPerM2K ?? (row ? representativeUValue(row) : Number.NaN);

  if (!row || !Number.isFinite(uValueWPerM2K)) {
    return null;
  }

  return {
    row,
    normalizedThicknessMm,
    assumedCoreThicknessMm: choice.assumedCoreThicknessMm,
    uValueWPerM2K,
    groupLabel: `Group ${row.group_no}`,
  };
}

function wallAssemblyBasis(assembly: Ashrae1989WallAssembly) {
  const inputThicknessNote =
    assembly.normalizedThicknessMm === assembly.assumedCoreThicknessMm
      ? ""
      : `; selected ${assembly.normalizedThicknessMm} mm mapped to Table 30 ${assembly.assumedCoreThicknessMm} mm construction`;

  return `${assembly.groupLabel}, ${assembly.row.description_of_construction}${inputThicknessNote}`;
}

export function resolveAshrae1989WallUFactor(type: string, thicknessMm: number): FactorResult | null {
  const assembly = resolveAshrae1989WallAssembly(type, thicknessMm);

  if (!assembly) {
    return null;
  }

  const table30UValueBasis =
    assembly.row.u_min_w_m2_c !== assembly.row.u_max_w_m2_c
      ? assembly.uValueWPerM2K === assembly.row.u_max_w_m2_c
        ? `Table 30 range ${assembly.row.u_value_w_m2_c}; upper U-value used`
        : `Table 30 range ${assembly.row.u_value_w_m2_c}; mapped construction U-value used`
      : `Table 30 value ${assembly.row.u_value_w_m2_c}`;

  return {
    value: assembly.uValueWPerM2K,
    source: formatSource(
      TABLE_30_REFERENCE,
      `${wallAssemblyBasis(assembly)}; selected U = ${assembly.uValueWPerM2K.toFixed(2)} W/m2.K from ${table30UValueBasis}`,
    ),
  };
}

function wallOrientation(direction: string) {
  const normalized = direction.trim().toUpperCase().replace(/[^A-Z]/g, "");
  const aliases: Record<string, string> = {
    NORTH: "N",
    NORTHEAST: "NE",
    EAST: "E",
    SOUTHEAST: "SE",
    SOUTH: "S",
    SOUTHWEST: "SW",
    WEST: "W",
    NORTHWEST: "NW",
  };

  return aliases[normalized] ?? normalized;
}

export function resolveAshrae1989WallBaseCltd(input: {
  type: string;
  thicknessMm?: number;
  direction: string;
  designHour: number;
}): FactorResult | null {
  const assembly = resolveAshrae1989WallAssembly(input.type, input.thicknessMm);

  if (!assembly) {
    return null;
  }

  const orientation = wallOrientation(input.direction);
  const hour = table31Hour(input.designHour);
  const row = cltdRows.find(
    (item) => item.wall_group === assembly.groupLabel && item.orientation === orientation,
  );
  const value = Number(row?.[hour]);

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    value,
    source: formatSource(
      TABLE_31_REFERENCE,
      `${wallAssemblyBasis(assembly)}; ${orientation} row, solar time ${hour}`,
    ),
  };
}

function shiftedNorthernMonth(month: number, latitude: number) {
  const normalizedMonth = Math.min(12, Math.max(1, Math.round(month || 7)));
  return latitude < 0 ? ((normalizedMonth + 5) % 12) + 1 : normalizedMonth;
}

function table32Month(month: number) {
  const monthGroups: Record<number, string> = {
    1: "Jan/Nov",
    2: "Feb/Oct",
    3: "Mar/Sept",
    4: "Apr/Aug",
    5: "May/Jul",
    6: "Jun",
    7: "May/Jul",
    8: "Apr/Aug",
    9: "Mar/Sept",
    10: "Feb/Oct",
    11: "Jan/Nov",
    12: "Dec",
  };

  return monthGroups[month] ?? "May/Jul";
}

function nearestTable32Latitude(latitude: number) {
  const availableLatitudes = [...new Set(correctionRows.map((row) => row.latitude_deg_N))];
  const absoluteLatitude = Math.abs(latitude || 40);

  return availableLatitudes.reduce((nearest, current) =>
    Math.abs(current - absoluteLatitude) < Math.abs(nearest - absoluteLatitude) ? current : nearest,
  );
}

function table32LatitudeWarning(latitude: number, tableLatitude: number) {
  return Math.abs(latitude) > 64 && tableLatitude === 64
    ? "warning: absolute latitude is above 64 deg; Table 32 64 deg N row used; "
    : "";
}

function table32DirectionColumn(direction: string): keyof LatitudeMonthCorrectionRow {
  const orientation = wallOrientation(direction);
  const columns: Record<string, keyof LatitudeMonthCorrectionRow> = {
    N: "N",
    NNE: "NNE_NNW",
    NNW: "NNE_NNW",
    NE: "NE_NW",
    NW: "NE_NW",
    ENE: "ENE_WNW",
    WNW: "ENE_WNW",
    E: "E_W",
    W: "E_W",
    ESE: "ESE_WSW",
    WSW: "ESE_WSW",
    SE: "SE_SW",
    SW: "SE_SW",
    SSE: "SSE_SSW",
    SSW: "SSE_SSW",
    S: "S",
    HOR: "HOR",
  };

  return columns[orientation] ?? "N";
}

export function resolveAshrae1989WallLatitudeMonthCorrection(input: {
  direction: string;
  context: DesignConditionContext;
}): FactorResult {
  const equivalentMonth = shiftedNorthernMonth(input.context.hottestMonth, input.context.latitude);
  const month = table32Month(equivalentMonth);
  const latitude = nearestTable32Latitude(input.context.latitude);
  const column = table32DirectionColumn(input.direction);
  const row = correctionRows.find(
    (item) => item.latitude_deg_N === latitude && item.month === month,
  );
  const value = Number(row?.[column] ?? 0);
  const hemisphereNote = input.context.latitude < 0 ? "southern-latitude month shifted by six months; " : "";
  const latitudeWarning = table32LatitudeWarning(input.context.latitude, latitude);

  return {
    value: Number.isFinite(value) ? value : 0,
    source: formatSource(
      TABLE_32_REFERENCE,
      `${latitudeWarning}${hemisphereNote}${latitude} deg N ${month} ${String(column)} correction`,
    ),
  };
}
