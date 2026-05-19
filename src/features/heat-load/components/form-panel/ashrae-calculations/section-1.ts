import { calculateSHGF } from "@/lib/calculations";

import defaults from "../ashrae-tables/design-defaults.json";
import envelope from "../ashrae-tables/envelope.json";
import references from "../ashrae-tables/references.json";

import { formatSource, getTableNumber } from "./common";
import type { DesignConditionContext, Section1Result } from "./types";
import { resolveAshraeUFactor } from "./u-factors";

function classifyThermalMass(type: string) {
  if (type.includes("Brick")) return "medium";
  if (type.includes("Cement")) return "light";
  if (type.includes("Concrete")) return "heavy";
  if (type.includes("Roof")) return "heavy";
  return "medium";
}

function getAbsorptance(type: string, item: string) {
  if (item.toLowerCase().includes("roof")) return envelope.absorptance.roof;
  if (type.includes("Brick")) return envelope.absorptance.brick;
  if (type.includes("Cement")) return envelope.absorptance.cementBlock;
  if (type.includes("Concrete")) return envelope.absorptance.concrete;
  return envelope.absorptance.default;
}

function solarEquivalentTemperatureC(input: {
  context: DesignConditionContext;
  direction: string;
  item: string;
  type: string;
}) {
  if (!input.context.solar.hasData) {
    return 0;
  }

  const isRoof = input.item.toLowerCase().includes("roof") || input.direction === "HOR";
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
    surfaceTilt: isRoof ? 0 : 90,
    surfaceAzimuth,
    albedo: defaults.defaultGroundReflectance,
  });

  return (
    surface.poa *
    getAbsorptance(input.type, input.item) /
    envelope.outsideFilmCoefficientWPerM2K
  );
}

export function calculateAshraeSection1(input: {
  item: string;
  direction: string;
  type: string;
  thicknessMm: number;
  areaM2: number;
  context: DesignConditionContext;
}): Section1Result {
  const uFactor = resolveAshraeUFactor(input);
  const isGlass = input.item.toLowerCase().includes("glass");
  const massType = classifyThermalMass(input.type);
  const response = isGlass ? 1 : getTableNumber(envelope.thermalMassResponse, massType, 0.65);
  const solarTd = isGlass ? 0 : solarEquivalentTemperatureC(input);
  const tdValue = Math.max(0, input.context.deltaTC + solarTd * response);
  const heatLoad = input.areaM2 > 0 ? uFactor.value * tdValue * input.areaM2 : 0;

  return {
    uFactor,
    td: {
      value: tdValue,
      source: isGlass
        ? formatSource(references.fenestrationU, "Glass conductive TD from indoor/outdoor DB")
        : formatSource(
            `${references.hourlyTemperature}; ${references.opaqueCts}; ${references.groundReflectance}`,
            `Sol-air TD with ${massType} CTS response`,
          ),
    },
    heatLoad: {
      value: heatLoad,
      source: formatSource(references.opaqueCts, "Q = U x TD x area"),
    },
  };
}
