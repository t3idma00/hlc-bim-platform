import references from "../ashrae-tables/references.json";
import wallMaterialData from "../ashrae-tables/wall-materials-table4-1997.json";
import section3Data from "../section-3-data.json";

import { formatSource } from "./common";
import type { DesignConditionContext, Section3Result } from "./types";
import { resolveAshraeUFactor } from "./u-factors";

export const SECTION3_ASSEMBLY_U_FACTOR = "Assembly lookup";
export const SECTION3_MANUAL_U_FACTOR = "Manual U-factor";

export const SECTION3_CONDITIONED_ADJACENT_SPACE = "Conditioned same setpoint";
export const SECTION3_UNKNOWN_ADJACENT_SPACE = "Unknown unconditioned space";
export const SECTION3_OUTDOOR_ADJACENT_SPACE = "Outdoor / ambient space";
export const SECTION3_MANUAL_ADJACENT_SPACE = "Manual adjacent temperature";
export const SECTION3_GROUND_ADJACENT_SPACE = "Ground / slab review";

export const SECTION3_INTERMEDIATE_FLOOR = "Intermediate Floor";
export const SECTION3_GROUND_FLOOR = "Ground Floor";
export const SECTION3_GROUND_FLOOR_WITH_BASEMENT = "Ground Floor with Basement";
export const SECTION3_BASEMENT = "Basement";

export const section3UFactorModes = [
  SECTION3_ASSEMBLY_U_FACTOR,
  SECTION3_MANUAL_U_FACTOR,
] as const;

export const section3AdjacentSpaceTypes = [
  SECTION3_UNKNOWN_ADJACENT_SPACE,
  SECTION3_MANUAL_ADJACENT_SPACE,
  SECTION3_OUTDOOR_ADJACENT_SPACE,
  SECTION3_CONDITIONED_ADJACENT_SPACE,
  SECTION3_GROUND_ADJACENT_SPACE,
] as const;

export const section3FloorTypes = [
  SECTION3_INTERMEDIATE_FLOOR,
  SECTION3_GROUND_FLOOR,
] as const;

export function calculateAshraeSection3(input: {
  item: string;
  floorType?: string;
  assemblyType: string;
  assemblyDetail?: string;
  uFactorMode: string;
  manualUFactor: number;
  adjacentSpaceType: string;
  manualAdjacentTemperatureC: number;
  thicknessMm: number;
  areaM2: number;
  context: DesignConditionContext;
}): Section3Result {
  const lookupUFactor = resolveAshraeUFactor({
    item: input.item,
    type: input.assemblyType,
    detail: input.assemblyDetail,
    thicknessMm: input.thicknessMm,
  });
  const uFactor = input.uFactorMode === SECTION3_MANUAL_U_FACTOR
    ? {
        value: Math.max(0, input.manualUFactor),
        source: "Manual project U-factor for the separating Section 3 surface",
      }
    : resolveSection3LookupUFactor(input.item, lookupUFactor);
  const adjacentTemperature = resolveSection3AdjacentTemperature(input);
  const indoorTemperature = {
    value: input.context.indoorDryBulbC,
    source: "Indoor design dry-bulb temperature",
  };
  const usesGroundFloorType =
    input.item.toLowerCase().includes("floor") &&
    Boolean(input.floorType) &&
    section3FloorUsesGroundReview(input.floorType ?? "");
  const tdValue = adjacentTemperature.value - indoorTemperature.value;
  const usesGroundCoolingScreen =
    usesGroundFloorType &&
    input.adjacentSpaceType === SECTION3_GROUND_ADJACENT_SPACE;
  const sourceReference = usesGroundFloorType
    ? references.groundFloorCooling1997
    : references.interiorSurfaces;
  const signedHeatTransfer = input.areaM2 > 0 ? uFactor.value * tdValue * input.areaM2 : 0;
  const coolingHeatGain = usesGroundCoolingScreen ? 0 : Math.max(0, signedHeatTransfer);
  const coolingGainNote =
    signedHeatTransfer < 0
      ? "; negative signed transfer is reported as zero cooling heat gain"
      : "";

  return {
    uFactor,
    adjacentTemperature,
    indoorTemperature,
    td: {
      value: tdValue,
      source: formatSource(
        sourceReference,
        usesGroundCoolingScreen
          ? "Ground-contact floor heat transfer is neglected for the Section 3 cooling estimate"
          : `TD = adjacent ${adjacentTemperature.value.toFixed(2)} C - indoor ${indoorTemperature.value.toFixed(2)} C${usesGroundFloorType ? " using project ground-floor input" : ""}`,
      ),
    },
    heatLoad: {
      value: coolingHeatGain,
      source: formatSource(
        sourceReference,
        usesGroundCoolingScreen
          ? "ASHRAE 1997 cooling rule: ground-contact floor heat transfer may be neglected, so this floor heat gain is zero"
          : `Cooling heat gain = max(0, U x area x TD); signed transfer ${signedHeatTransfer.toFixed(2)} W${coolingGainNote}${usesGroundFloorType ? "; project ground-floor input required" : ""}`,
      ),
    },
  };
}

export function section3FloorUsesGroundReview(floorType: string) {
  return floorType !== SECTION3_INTERMEDIATE_FLOOR;
}

function resolveSection3LookupUFactor(item: string, lookupUFactor: { value: number; source: string }) {
  if (!item.toLowerCase().includes("glass") || lookupUFactor.value <= 0) {
    return lookupUFactor;
  }

  const surfaces = wallMaterialData.surfaceResistancesM2KPerW;
  const interiorResistance =
    1 / lookupUFactor.value -
    surfaces.outsideSummer +
    surfaces.insideVertical;

  if (interiorResistance <= 0) {
    return lookupUFactor;
  }

  return {
    value: 1 / interiorResistance,
    source: formatSource(
      `${lookupUFactor.source}; ${references.interiorSurfaces}`,
      "Interior-glass U-factor adjusts the 1997 fenestration lookup from an outside summer film to a second inside vertical film",
    ),
  };
}

function resolveSection3AdjacentTemperature(input: {
  adjacentSpaceType: string;
  manualAdjacentTemperatureC: number;
  context: DesignConditionContext;
}) {
  if (input.adjacentSpaceType === SECTION3_MANUAL_ADJACENT_SPACE) {
    return {
      value: input.manualAdjacentTemperatureC,
      source: "Manual average adjacent-space air temperature",
    };
  }

  if (input.adjacentSpaceType === SECTION3_OUTDOOR_ADJACENT_SPACE) {
    return {
      value: input.context.outdoorDryBulbC,
      source: "Outdoor design dry-bulb temperature used as adjacent ambient temperature",
    };
  }

  if (input.adjacentSpaceType === SECTION3_CONDITIONED_ADJACENT_SPACE) {
    return {
      value: input.context.indoorDryBulbC,
      source: "Adjacent conditioned space assumed at the same indoor setpoint",
    };
  }

  if (input.adjacentSpaceType === SECTION3_GROUND_ADJACENT_SPACE) {
    return {
      value: input.context.indoorDryBulbC,
      source: formatSource(
        references.groundFloorCooling1997,
        "Ground-contact floor heat transfer neglected for Section 3 cooling estimate",
      ),
    };
  }

  const offsetK = section3Data.transmission.unknownConventionalSpaceOutdoorOffsetK;
  return {
    value: input.context.outdoorDryBulbC - offsetK,
    source: formatSource(
      references.interiorSurfaces,
      `Unknown conventional unconditioned space fallback: outdoor ${input.context.outdoorDryBulbC.toFixed(2)} C - ${offsetK.toFixed(2)} K`,
    ),
  };
}
