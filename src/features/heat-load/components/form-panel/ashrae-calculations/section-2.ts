import { calculateSHGF } from "@/lib/calculations";

import defaults from "../ashrae-tables/design-defaults.json";
import envelope from "../ashrae-tables/envelope.json";
import references from "../ashrae-tables/references.json";
import section2Tables from "../ashrae-tables/section-2-1997.json";
import { getAshraeZoneCode } from "../heat-load-zone-labels";

import { formatSource, getTableNumber, matchesText } from "./common";
import type { DesignConditionContext, FactorResult, Section2Factors } from "./types";

type GlassRecord = {
  glassAloneSc: number;
  shadingSc: Record<string, number>;
};

type GlassType = {
  label: string;
  aliases: string[];
  sourceTables: string[];
  thicknesses: Record<string, GlassRecord>;
};

type Section2Tables = {
  glassTypes: GlassType[];
  sclTable36WPerM2: Record<string, Record<string, number[]>>;
  shgfTablesWPerM2: Record<string, Record<string, Record<string, Record<string, number>>>>;
};

const tables = section2Tables as unknown as Section2Tables;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const latitudes = [16, 24, 32, 40, 48, 56, 64];
const source1997 =
  "ASHRAE 1997 Ch28 Table 36 and Ch29 Tables 15-21, 25, 26, 29";

const directionCodeByLabel: Record<string, string> = {
  North: "N",
  Northeast: "NE",
  East: "E",
  Southeast: "SE",
  South: "S",
  Southwest: "SW",
  West: "W",
  Northwest: "NW",
  HOR: "Hor",
};

function directionCode(direction: string) {
  return directionCodeByLabel[direction] ?? "N";
}

function hourKey(hour: number) {
  return String(Math.min(24, Math.max(1, Math.round(hour || 15))));
}

function monthName(context: DesignConditionContext) {
  const rawMonth = Math.min(12, Math.max(1, Math.round(context.hottestMonth || 7)));
  const shiftedForSouthern = context.latitude < 0 ? ((rawMonth + 5) % 12) + 1 : rawMonth;
  return months[shiftedForSouthern - 1] ?? "Jul";
}

function nearestLatitude(latitude: number) {
  const absoluteLatitude = Math.abs(latitude || 40);
  return latitudes.reduce((best, item) =>
    Math.abs(item - absoluteLatitude) < Math.abs(best - absoluteLatitude) ? item : best,
  );
}

function findGlassType(type: string) {
  return (
    tables.glassTypes.find((record) =>
      record.label === type || record.aliases.some((alias) => matchesText(type, alias)),
    ) ?? tables.glassTypes[0]
  );
}

function closestThickness(glassType: GlassType, thicknessMm: number) {
  const thicknesses = Object.keys(glassType.thicknesses);
  const selected = thicknesses.reduce((best, item) => {
    const bestDistance = Math.abs(Number(best) - thicknessMm);
    const itemDistance = Math.abs(Number(item) - thicknessMm);
    return itemDistance < bestDistance ? item : best;
  }, thicknesses[0]);

  return {
    key: selected,
    record: glassType.thicknesses[selected],
  };
}

function resolveShadingCoefficient(input: {
  type: string;
  shading: string;
  thicknessMm: number;
}): FactorResult {
  const glassType = findGlassType(input.type);
  const thickness = closestThickness(glassType, input.thicknessMm || 6);
  const exactShading = Object.keys(thickness.record.shadingSc).find((key) =>
    matchesText(input.shading, key),
  );
  const value = exactShading
    ? thickness.record.shadingSc[exactShading]
    : thickness.record.glassAloneSc;

  return {
    value,
    source: formatSource(
      source1997,
      `${glassType.label}, ${thickness.key} mm, ${exactShading ?? "No inside shade"} SC`,
    ),
  };
}

function resolveNasaPlaneOfArray(input: {
  direction: string;
  context: DesignConditionContext;
}): FactorResult | null {
  if (!input.context.solar.hasData) return null;

  const isHorizontal = input.direction === "HOR";
  const surfaceAzimuth = getTableNumber(
    envelope.surfaceAzimuthByDirection,
    input.direction,
    envelope.surfaceAzimuthByDirection.South,
  );
  const surface = calculateSHGF({
    dni: input.context.solar.dni,
    dhi: input.context.solar.dhi,
    ghi: input.context.solar.ghi,
    zenith: input.context.solar.zenith,
    azimuth: input.context.solar.azimuth,
    surfaceTilt: isHorizontal ? 0 : 90,
    surfaceAzimuth,
    albedo: defaults.defaultGroundReflectance,
  });

  return {
    value: surface.poa,
    source: formatSource(
      `${references.nasaSolar}; ${references.orientation}`,
      `NASA/current plane-of-array SHGF for ${input.direction}`,
    ),
  };
}

function resolveAshrae1997Shgf(input: {
  direction: string;
  context: DesignConditionContext;
}): FactorResult | null {
  const latitude = nearestLatitude(input.context.latitude);
  const month = monthName(input.context);
  const hour = hourKey(input.context.designHour);
  const code = directionCode(input.direction);
  const value = tables.shgfTablesWPerM2[String(latitude)]?.[month]?.[hour]?.[code];

  if (typeof value !== "number") return null;

  const hemisphereNote = input.context.latitude < 0 ? "southern-hemisphere month shift, " : "";
  return {
    value,
    source: formatSource(
      source1997,
      `${hemisphereNote}${latitude} deg North ${month}, hour ${hour}, ${code} SHGF`,
    ),
  };
}

export function resolveAshraeSolarHeatGain(input: {
  direction: string;
  context: DesignConditionContext;
}): FactorResult {
  if (input.context.source === "current") {
    const nasaValue = resolveNasaPlaneOfArray(input);
    if (nasaValue) return nasaValue;
  }

  const ashraeValue = resolveAshrae1997Shgf(input);
  if (ashraeValue) return ashraeValue;

  return {
    value: 150,
    source: formatSource(source1997, "Fallback SHGF because solar table/live solar data is unavailable"),
  };
}

function resolveSolarCoolingLoadFactor(input: {
  direction: string;
  zoneType: string;
  context: DesignConditionContext;
}): FactorResult {
  const zone = getAshraeZoneCode(input.zoneType);
  const code = directionCode(input.direction);
  const hour = Math.min(24, Math.max(1, Math.round(input.context.designHour || 15)));
  const scl = tables.sclTable36WPerM2[zone]?.[code]?.[hour - 1] ?? 0;
  const referenceShgf = tables.shgfTablesWPerM2["40"]?.Jul?.[String(hour)]?.[code] ?? 0;
  const value = referenceShgf > 0 ? scl / referenceShgf : 0;

  return {
    value,
    source: formatSource(
      source1997,
      `CLF from Table 36 Zone ${zone} ${code} hour ${hour}: SCL ${scl} / SHGF ${referenceShgf}`,
    ),
  };
}

export function resolveCurrentGlassFactors(type: string, shading: string, thicknessMm = 6) {
  const sc = resolveShadingCoefficient({ type, shading, thicknessMm });
  const clf = resolveSolarCoolingLoadFactor({
    direction: "North",
    zoneType: "C",
    context: {
      source: "current",
      outdoorDryBulbC: 0,
      indoorDryBulbC: 0,
      deltaTC: 0,
      pressurePa: 101325,
      windSpeedMps: 3,
      hottestMonth: 7,
      hottestMonthDryBulbRangeC: 0,
      designHour: 15,
      latitude: 40,
      longitude: 0,
      solar: { dni: 0, dhi: 0, ghi: 0, zenith: 0, azimuth: 0, hasData: false },
    },
  });

  return {
    sc,
    shg: { value: 150, source: "Default editable SHGF placeholder" },
    clf,
  };
}

export function resolveAshraeSection2Factors(input: {
  type: string;
  shading: string;
  thicknessMm?: number;
  zoneType?: string;
  direction: string;
  context: DesignConditionContext;
}): Section2Factors {
  const sc = resolveShadingCoefficient({
    type: input.type,
    shading: input.shading,
    thicknessMm: input.thicknessMm ?? 6,
  });
  const solarHeatGain = resolveAshraeSolarHeatGain(input);
  const solarCoolingLoadFactor = resolveSolarCoolingLoadFactor({
    direction: input.direction,
    zoneType: input.zoneType ?? "C",
    context: input.context,
  });

  return {
    effectiveCoefficient: sc,
    solarHeatGain,
    solarCoolingLoadFactor,
  };
}
