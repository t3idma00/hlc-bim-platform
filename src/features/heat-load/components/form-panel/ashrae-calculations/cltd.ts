import cltd1997 from "../ashrae-tables/cltd-1997.json";
import { resolveRoofCltdMapping } from "../ashrae-roof-assemblies";

import { clamp, formatSource, matchesText } from "./common";
import type { DesignConditionContext, FactorResult } from "./types";
import {
  resolveAshrae1989WallBaseCltd,
  resolveAshrae1989WallLatitudeMonthCorrection,
} from "./wall-cltd-1989";

const CLTD_REFERENCE_OUTDOOR_MEAN_C = cltd1997.metadata.referenceConditions.outdoorMeanDryBulbC;
const CLTD_REFERENCE_INDOOR_C = cltd1997.metadata.referenceConditions.insideDryBulbC;
const CLTD_SOURCE = "ASHRAE 1997 Handbook - Fundamentals, Chapter 28 CLTD tables";

type WallMapping = {
  table: string;
  wallNumber: string;
  basis: string;
};

type RoofMapping = {
  table: string;
  roofNumber: string;
  basis: string;
};

function tableHour(designHour: number) {
  const hour = Math.round(designHour);
  return hour <= 0 ? "24" : String(clamp(hour, 1, 24));
}

function wallMapping(type: string): WallMapping {
  const mappings = cltd1997.metadata.appMappings.wallTypes as Record<string, WallMapping>;
  const match = Object.entries(mappings).find(([key]) => matchesText(type, key));
  return match?.[1] ?? mappings["Cement block Wall"];
}

function roofNumberFromDetail(detail: string | undefined) {
  const match = detail?.match(/manual\s+(?:ashrae\s+)?roof\s*(?:no\.?|number)?\s*(\d+)/i);
  return match?.[1];
}

function roofMapping(type: string, detail?: string): RoofMapping {
  const assemblyMapping = resolveRoofCltdMapping(type, detail);
  const detailRoofNumber = roofNumberFromDetail(detail);

  if (assemblyMapping && !detailRoofNumber) {
    return assemblyMapping;
  }

  const mappings = cltd1997.metadata.appMappings.roofTypes as Record<string, RoofMapping>;
  const match = Object.entries(mappings).find(([key]) => matchesText(type, key));
  const mapping = match?.[1] ?? mappings["Concrete Slab Roof"];

  if (!detailRoofNumber) {
    return mapping;
  }

  return {
    ...mapping,
    roofNumber: detailRoofNumber,
    basis: `Roof number ${detailRoofNumber} selected from row detail.`,
  };
}

function resolveWallCltd(input: {
  type: string;
  direction: string;
  designHour: number;
}) {
  const mapping = wallMapping(input.type);
  const wallTable = cltd1997.tables.table32WallCltdCByWallNumber as Record<string, Record<string, number[]>>;
  const directionValues =
    wallTable[mapping.wallNumber]?.[input.direction] ??
    wallTable[mapping.wallNumber]?.North ??
    [];
  const value = directionValues[Number(tableHour(input.designHour)) - 1] ?? 0;

  return {
    value,
    mapping,
  };
}

function resolveRoofCltd(type: string, designHour: number, detail?: string) {
  const mapping = roofMapping(type, detail);
  const roofTable = cltd1997.tables.table30RoofCltdCByRoofNumber as Record<string, number[]>;
  const values = roofTable[mapping.roofNumber] ?? [];

  return {
    value: values[Number(tableHour(designHour)) - 1] ?? 0,
    mapping,
  };
}

function resolveGlassCltd(designHour: number) {
  const values = cltd1997.tables.table34GlassCltdCBySolarHour as Record<string, number>;
  return values[tableHour(designHour)] ?? values["15"] ?? 0;
}

export function resolveBaseCltd(input: {
  item: string;
  type: string;
  direction: string;
  detail?: string;
  thicknessMm?: number;
  designHour?: number;
}): FactorResult {
  const item = input.item.toLowerCase();
  const type = input.type;
  const designHour = input.designHour ?? 15;

  if (item.includes("glass") || item.includes("sky") || type.toLowerCase().includes("glass")) {
    return {
      value: resolveGlassCltd(designHour),
      source: formatSource(
        `${CLTD_SOURCE}, Table 34, p.28.49`,
        `Base glass CLTD by solar time hour ${tableHour(designHour)}`,
      ),
    };
  }

  if (item.includes("roof") || type.includes("Roof") || input.direction === "HOR") {
    const roof = resolveRoofCltd(type, designHour, input.detail);

    return {
      value: roof.value,
      source: formatSource(
        `${CLTD_SOURCE}, Table 30, p.28.42`,
        `Base roof CLTD roof number ${roof.mapping.roofNumber}; ${roof.mapping.basis}`,
      ),
    };
  }

  const wall1989 = resolveAshrae1989WallBaseCltd({
    type,
    direction: input.direction,
    thicknessMm: input.thicknessMm,
    designHour,
  });

  if (wall1989) {
    return wall1989;
  }

  const wall = resolveWallCltd({
    type,
    direction: input.direction,
    designHour,
  });

  return {
    value: wall.value,
    source: formatSource(
      `${CLTD_SOURCE}, Table 32, pp.28.43-28.45`,
      `Base wall CLTD wall number ${wall.mapping.wallNumber}, ${input.direction}, hour ${tableHour(designHour)}; ${wall.mapping.basis}`,
    ),
  };
}

function outdoorMeanDryBulbC(context: DesignConditionContext) {
  return context.hottestMonthDryBulbRangeC > 0
    ? context.outdoorDryBulbC - context.hottestMonthDryBulbRangeC / 2
    : context.outdoorDryBulbC;
}

function latitudeMonthDirection(item: string, type: string, direction: string) {
  const itemText = item.toLowerCase();
  const typeText = type.toLowerCase();

  if (itemText.includes("roof") || itemText.includes("sky") || typeText.includes("roof") || direction === "HOR") {
    return "HOR";
  }

  return direction === "All" ? "HOR" : direction;
}

export function resolveCorrectedCltd(input: {
  item: string;
  type: string;
  direction: string;
  detail?: string;
  thicknessMm?: number;
  context: DesignConditionContext;
}): FactorResult {
  const base = resolveBaseCltd({
    item: input.item,
    type: input.type,
    direction: input.direction,
    detail: input.detail,
    thicknessMm: input.thicknessMm,
    designHour: input.context.designHour,
  });
  const outdoorMeanC = outdoorMeanDryBulbC(input.context);
  const outdoorCorrection = outdoorMeanC - CLTD_REFERENCE_OUTDOOR_MEAN_C;
  const indoorCorrection = CLTD_REFERENCE_INDOOR_C - input.context.indoorDryBulbC;
  const lmDirection = latitudeMonthDirection(input.item, input.type, input.direction);
  const latitudeMonthCorrection = resolveAshrae1989WallLatitudeMonthCorrection({
    direction: lmDirection,
    context: input.context,
  });
  const table32Correction = latitudeMonthCorrection.value;
  const corrected = Math.max(0, base.value + table32Correction + outdoorCorrection + indoorCorrection);
  const sourceName =
    input.context.source === "ashrae-2017"
      ? "ASHRAE station outdoor DB"
      : "Current/NASA outdoor DB";
  const latitudeMonthText = ` + (Table 32 ${lmDirection} latitude/month ${table32Correction.toFixed(2)})`;

  return {
    value: corrected,
    source: formatSource(
      `${base.source}; ${latitudeMonthCorrection.source}`,
      `Corrected CLTD = ${base.value.toFixed(2)}${latitudeMonthText} + (${sourceName} mean ${outdoorMeanC.toFixed(2)} - 29.4) + (25.5 - indoor ${input.context.indoorDryBulbC.toFixed(2)})`,
    ),
  };
}
