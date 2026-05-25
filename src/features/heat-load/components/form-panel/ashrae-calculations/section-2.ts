import { calculateSHGF } from "@/lib/calculations/solar-calculations";

import section2Tables from "../ashrae-tables/section-2-1997.json";
import { getAshraeZoneCode } from "../heat-load-zone-labels";

import { formatSource, matchesText } from "./common";
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

type DomedHorizontalSkylight = {
  label: string;
  dome: string;
  lightDiffuser: string;
  curbHeightIn: number;
  widthToHeightRatio: string;
  shadingCoefficient: number;
};

type Section2Tables = {
  glassTypes: GlassType[];
  domedHorizontalSkylights: DomedHorizontalSkylight[];
  sclTable36WPerM2: Record<string, Record<string, number[]>>;
  shgfTablesWPerM2: Record<string, Record<string, Record<string, Record<string, number>>>>;
};

const tables = section2Tables as unknown as Section2Tables;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const latitudes = [16, 24, 32, 40, 48, 56, 64];
const shadingCoefficientSource1997 = "ASHRAE 1997 Ch29 Tables 11, 25, 26, 29";
const solarHeatGainFactorSource1997 = "ASHRAE 1997 Ch29 Tables 15-21";
const solarHeatGainFactorSourceCurrent = "NASA/Open-Meteo solar irradiance plane-of-array calculation";
const solarCoolingLoadSource1997 = "ASHRAE 1997 Ch28 Tables 35B and 36";
const domedSkylightSource = "ASHRAE 1997 Ch29 Table 12, p.29.26";
const removedIndoorShadeLabels = new Set([
  "Drapery A",
  "Drapery B",
  "Drapery C",
  "Drapery D",
  "Drapery E",
  "Drapery F",
  "Drapery G",
  "Drapery H",
  "Drapery I",
  "Drapery J",
]);

export const ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL =
  "ASHRAE Table 12 dome coefficient";

export const ashrae1997SolarGlassTypeOptions = tables.glassTypes.map((record) => record.label);
export const ashrae1997DomedHorizontalSkylightOptions =
  tables.domedHorizontalSkylights.map((record) => record.label);

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

const surfaceAzimuthByDirection: Record<string, number> = {
  North: 0,
  Northeast: 45,
  East: 90,
  Southeast: 135,
  South: 180,
  Southwest: 225,
  West: 270,
  Northwest: 315,
  HOR: 180,
};

function directionCode(direction: string) {
  return directionCodeByLabel[direction] ?? "N";
}

function surfaceTilt(direction: string) {
  return direction === "HOR" ? 0 : 90;
}

function surfaceAzimuth(direction: string) {
  return surfaceAzimuthByDirection[direction] ?? 180;
}

function hourKey(hour: number) {
  return String(Math.min(24, Math.max(1, Math.round(hour || 15))));
}

function shgfMonthBasis(context: DesignConditionContext) {
  const designMonth = Math.min(12, Math.max(1, Math.round(context.hottestMonth || 7)));
  const tableMonth = context.latitude < 0 ? ((designMonth + 5) % 12) + 1 : designMonth;
  const designLabel = months[designMonth - 1] ?? "Jul";
  const tableLabel = months[tableMonth - 1] ?? "Jul";
  const sourceLabel =
    context.source === "ashrae-2017" ? "ASHRAE station design month" : "current design month";

  return {
    tableLabel,
    sourceText:
      designMonth === tableMonth
        ? `${sourceLabel} ${designLabel}`
        : `${sourceLabel} ${designLabel}; equivalent northern SHGF month ${tableLabel}`,
  };
}

function nearestLatitude(latitude: number) {
  const absoluteLatitude = Number.isFinite(latitude) ? Math.abs(latitude) : 40;
  return latitudes.reduce((best, item) =>
    Math.abs(item - absoluteLatitude) < Math.abs(best - absoluteLatitude) ? item : best,
  );
}

function latitudeTableNote(latitude: number, tableLatitude: number) {
  const absoluteLatitude = Number.isFinite(latitude) ? Math.abs(latitude) : 40;
  const warning =
    absoluteLatitude > 64 && tableLatitude === 64
      ? "warning: absolute latitude above 64 deg; "
      : "";
  if (absoluteLatitude === tableLatitude) return `${warning}${tableLatitude} deg North latitude table`;

  return `${warning}${absoluteLatitude.toFixed(2)} deg station latitude mapped to ${tableLatitude} deg North latitude table`;
}

function findGlassType(type: string) {
  return (
    tables.glassTypes.find((record) =>
      record.label === type || record.aliases.some((alias) => matchesText(type, alias)),
    ) ?? tables.glassTypes[0]
  );
}

function findDomedHorizontalSkylight(type: string) {
  return tables.domedHorizontalSkylights.find((record) => matchesText(type, record.label)) ?? null;
}

function isRemovedIndoorShadeLabel(value: string) {
  return Array.from(removedIndoorShadeLabels).some((label) => matchesText(label, value));
}

export function isAshrae1997DomedHorizontalSkylightType(type: string) {
  return findDomedHorizontalSkylight(type) !== null;
}

function glassThicknessKeys(glassType: GlassType) {
  return Object.keys(glassType.thicknesses).sort((left, right) => Number(left) - Number(right));
}

function resolveGlassThickness(glassType: GlassType, requestedThicknessMm: number) {
  const thicknesses = glassThicknessKeys(glassType);
  const supportedThickness = thicknesses.find((item) => Number(item) === requestedThicknessMm);
  const selected = supportedThickness ?? thicknesses.reduce((best, item) => {
    const bestDistance = Math.abs(Number(best) - requestedThicknessMm);
    const itemDistance = Math.abs(Number(item) - requestedThicknessMm);
    return itemDistance < bestDistance ? item : best;
  }, thicknesses[0]);

  return {
    key: selected,
    record: glassType.thicknesses[selected],
    isExact: Boolean(supportedThickness),
  };
}

export function getAshrae1997SolarGlassThicknessOptions(type: string) {
  if (isAshrae1997DomedHorizontalSkylightType(type)) return ["N/A"];
  return glassThicknessKeys(findGlassType(type));
}

export function getAshrae1997SolarShadingOptions(type: string, thicknessMm = 6) {
  if (isAshrae1997DomedHorizontalSkylightType(type)) {
    return [ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL];
  }

  const glassType = findGlassType(type);
  const thickness = resolveGlassThickness(glassType, thicknessMm || 6);
  return Object.keys(thickness.record.shadingSc).filter((label) => !removedIndoorShadeLabels.has(label));
}

export function normalizeAshrae1997SolarGlassThickness(type: string, value: string) {
  const options = getAshrae1997SolarGlassThicknessOptions(type);
  const requestedThicknessMm = Number.parseFloat(value);
  return options.find((option) => Number(option) === requestedThicknessMm) ?? options[0] ?? value;
}

export function normalizeAshrae1997SolarShading(type: string, thicknessMm: number, value: string) {
  const options = getAshrae1997SolarShadingOptions(type, thicknessMm);
  if (isRemovedIndoorShadeLabel(value)) {
    return "No inside shade";
  }

  return options.find((option) => matchesText(option, value)) ?? options[0] ?? value;
}

function resolveShadingCoefficient(input: {
  type: string;
  shading: string;
  thicknessMm: number;
}): FactorResult {
  const domedSkylight = findDomedHorizontalSkylight(input.type);

  if (domedSkylight) {
    const ratio =
      domedSkylight.widthToHeightRatio === "infinity"
        ? "no curb"
        : `curb width/height ratio ${domedSkylight.widthToHeightRatio}`;

    return {
      value: domedSkylight.shadingCoefficient,
      source: formatSource(
        domedSkylightSource,
        `${domedSkylight.label}; ${domedSkylight.dome}; diffuser ${domedSkylight.lightDiffuser}; ${ratio}`,
      ),
    };
  }

  const glassType = findGlassType(input.type);
  const requestedThicknessMm = input.thicknessMm || 6;
  const thickness = resolveGlassThickness(glassType, requestedThicknessMm);
  const exactShading = Object.keys(thickness.record.shadingSc).find((key) =>
    matchesText(input.shading, key),
  );
  const value = exactShading
    ? thickness.record.shadingSc[exactShading]
    : thickness.record.glassAloneSc;
  const thicknessDetail = thickness.isExact
    ? `${thickness.key} mm`
    : `${thickness.key} mm supported row for requested ${requestedThicknessMm} mm`;

  return {
    value,
    source: formatSource(
      shadingCoefficientSource1997,
      `${glassType.label}, ${thicknessDetail}, ${exactShading ?? "No inside shade"} SC`,
    ),
  };
}

function resolveAshrae1997Shgf(input: {
  direction: string;
  context: DesignConditionContext;
}): FactorResult | null {
  const latitude = nearestLatitude(input.context.latitude);
  const month = shgfMonthBasis(input.context);
  const hour = hourKey(input.context.designHour);
  const code = directionCode(input.direction);
  const value = tables.shgfTablesWPerM2[String(latitude)]?.[month.tableLabel]?.[hour]?.[code];

  if (typeof value !== "number") return null;

  return {
    value,
    source: formatSource(
      solarHeatGainFactorSource1997,
      `${month.sourceText}; ${latitudeTableNote(input.context.latitude, latitude)}; solar hour ${hour}; ${code} SHGF`,
    ),
  };
}

function resolveCurrentSolarHeatGain(input: {
  direction: string;
  context: DesignConditionContext;
}): FactorResult | null {
  if (input.context.source !== "current" || !input.context.solar.hasData) {
    return null;
  }

  const tilt = surfaceTilt(input.direction);
  const azimuth = surfaceAzimuth(input.direction);
  const result = calculateSHGF({
    dni: input.context.solar.dni,
    dhi: input.context.solar.dhi,
    ghi: input.context.solar.ghi,
    zenith: input.context.solar.zenith,
    azimuth: input.context.solar.azimuth,
    surfaceTilt: tilt,
    surfaceAzimuth: azimuth,
  });

  return {
    value: result.shgf,
    source: formatSource(
      solarHeatGainFactorSourceCurrent,
      [
        `${input.direction} surface tilt ${tilt} deg, azimuth ${azimuth} deg`,
        `DNI ${input.context.solar.dni.toFixed(2)} W/m2`,
        `DHI ${input.context.solar.dhi.toFixed(2)} W/m2`,
        `GHI ${input.context.solar.ghi.toFixed(2)} W/m2`,
        `solar zenith ${input.context.solar.zenith.toFixed(2)} deg`,
        `solar azimuth ${input.context.solar.azimuth.toFixed(2)} deg`,
        `beam ${result.components.beam.toFixed(2)} W/m2`,
        `diffuse ${result.components.diffuse.toFixed(2)} W/m2`,
        `ground-reflected ${result.components.reflected.toFixed(2)} W/m2`,
      ].join("; "),
    ),
  };
}

export function resolveAshraeSolarHeatGain(input: {
  direction: string;
  context: DesignConditionContext;
}): FactorResult {
  const currentValue = resolveCurrentSolarHeatGain(input);
  if (currentValue) return currentValue;

  const ashraeValue = resolveAshrae1997Shgf(input);
  if (ashraeValue) return ashraeValue;

  return {
    value: 0,
    source: formatSource(
      solarHeatGainFactorSource1997,
      "No Table 15-21 SHGF row for the selected 1997 latitude/month/hour/direction",
    ),
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
      solarCoolingLoadSource1997,
      `CLF from Table 36 Zone ${zone} ${code} hour ${hour}: SCL ${scl} / SHGF ${referenceShgf}`,
    ),
  };
}

export function resolveCurrentGlassFactors(type: string, shading: string, thicknessMm = 6) {
  const sc = resolveShadingCoefficient({ type, shading, thicknessMm });
  const context: DesignConditionContext = {
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
  };
  const clf = resolveSolarCoolingLoadFactor({
    direction: "North",
    zoneType: "C",
    context,
  });

  return {
    sc,
    shg: resolveAshraeSolarHeatGain({ direction: "North", context }),
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
