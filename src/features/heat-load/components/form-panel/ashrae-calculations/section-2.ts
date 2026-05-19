import { calculateSHGF } from "@/lib/calculations";

import defaults from "../ashrae-tables/design-defaults.json";
import envelope from "../ashrae-tables/envelope.json";
import glazing from "../ashrae-tables/glazing.json";
import references from "../ashrae-tables/references.json";
import section2Data from "../section-2-data.json";

import { formatSource, getTableNumber, matchesText } from "./common";
import type { DesignConditionContext, Section2Factors } from "./types";

export function resolveCurrentGlassFactors(type: string, shading: string) {
  let sc = 0.8;
  const typeKey = Object.keys(section2Data.shading_coefficients).find((key) =>
    matchesText(type, key),
  );

  if (typeKey) {
    const data = section2Data.shading_coefficients as Record<string, Record<string, number>>;
    sc = data[typeKey][shading] ?? data[typeKey]["No shading"] ?? 0.8;
  }

  return {
    sc: { value: sc, source: "Current application solar glass lookup data" },
    shg: { value: 150, source: "Current application solar glass lookup data" },
    clf: {
      value: section2Data.solar_cooling_load_factors_clf.North,
      source: "Current application solar glass lookup data",
    },
  };
}

export function resolveAshraeSolarHeatGain(input: {
  direction: string;
  context: DesignConditionContext;
}) {
  if (!input.context.solar.hasData) {
    return {
      value: 150,
      source: formatSource(references.designConditions, "Fallback SHG because live solar data is unavailable"),
    };
  }

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
      `${references.orientation}; ${references.nasaSolar}`,
      `Plane-of-array SHG for ${input.direction}`,
    ),
  };
}

export function resolveAshraeSection2Factors(input: {
  type: string;
  shading: string;
  direction: string;
  context: DesignConditionContext;
}): Section2Factors {
  const shgc = getTableNumber(glazing.shgcByType, input.type, 0.76);
  const iac = getTableNumber(glazing.interiorAttenuationByShading, input.shading, 1);
  const rts = getTableNumber(glazing.solarRtsPeakByDirection, input.direction, 0.82);
  const solarHeatGain = resolveAshraeSolarHeatGain(input);

  return {
    effectiveCoefficient: {
      value: shgc * iac,
      source: formatSource(
        `${references.glazingShgc}; ${references.interiorAttenuation}`,
        `Effective coefficient = SHGC ${shgc.toFixed(2)} x IAC ${iac.toFixed(2)}`,
      ),
    },
    solarCoolingLoadFactor: {
      value: rts,
      source: formatSource(references.solarRts, `Representative solar RTS fraction for ${input.direction}`),
    },
    solarHeatGain,
  };
}
