import infiltration from "../ashrae-tables/infiltration.json";
import references from "../ashrae-tables/references.json";

import { clamp, formatSource } from "./common";
import type { DesignConditionContext, Section4Result } from "./types";

export const infiltrationMethodOptions = ["Crack + Door", "ASHRAE Stack-Wind"] as const;

function getDoorRate(component: string) {
  return component.includes("Nonresidential")
    ? infiltration.nonresidentialDoorRateLpsPerM2
    : infiltration.residentialDoorRateLpsPerM2;
}

function drivingMultiplier(context: DesignConditionContext) {
  const reference =
    infiltration.stackCoefficient * 10 +
    infiltration.windCoefficient * 3 ** 2;
  const actual =
    infiltration.stackCoefficient * Math.abs(context.deltaTC) +
    infiltration.windCoefficient * Math.max(0, context.windSpeedMps) ** 2;

  if (reference <= 0 || actual <= 0) {
    return 1;
  }

  return clamp(
    Math.sqrt(actual / reference),
    infiltration.minMultiplier,
    infiltration.maxMultiplier,
  );
}

export function calculateCurrentSection4(input: {
  windowQty: number;
  crackLengthM: number;
  doorQty: number;
  doorAreaM2: number;
  componentB: string;
  deltaTC: number;
  deltaW: number;
}): Section4Result {
  const flowLps =
    input.windowQty * input.crackLengthM * infiltration.windowCrackRateLpsPerM +
    input.doorQty * input.doorAreaM2 * getDoorRate(input.componentB);
  const sensibleW = Math.max(0, flowLps * infiltration.airDensityCp * input.deltaTC);
  const latentW = Math.max(0, flowLps * infiltration.latentConstant * input.deltaW);

  return {
    flowLps: { value: flowLps, source: "Current application infiltration constants" },
    sensibleW: { value: sensibleW, source: "Current sensible infiltration formula" },
    latentW: { value: latentW, source: "Current latent infiltration formula" },
    heatLoad: { value: sensibleW + latentW, source: "Current method: sensible + latent infiltration" },
  };
}

export function calculateAshraeSection4(input: {
  method: string;
  windowQty: number;
  crackLengthM: number;
  doorQty: number;
  doorAreaM2: number;
  componentB: string;
  context: DesignConditionContext;
  deltaW: number;
}): Section4Result {
  const baseFlow =
    input.windowQty * input.crackLengthM * infiltration.windowCrackRateLpsPerM +
    input.doorQty * input.doorAreaM2 * getDoorRate(input.componentB);
  const useStackWind = input.method !== "Crack + Door";
  const multiplier = useStackWind ? drivingMultiplier(input.context) : 1;
  const flowLps = Math.max(0, baseFlow * multiplier);
  const sensibleW = Math.max(0, flowLps * infiltration.airDensityCp * input.context.deltaTC);
  const latentW = Math.max(0, flowLps * infiltration.latentConstant * input.deltaW);

  return {
    flowLps: {
      value: flowLps,
      source: formatSource(
        references.infiltration,
        useStackWind
          ? `Crack/door leakage with stack-wind multiplier ${multiplier.toFixed(2)}`
          : "Crack/door leakage without stack-wind multiplier",
      ),
    },
    sensibleW: {
      value: sensibleW,
      source: formatSource(references.infiltration, "Sensible = 1.23 x flow x deltaT"),
    },
    latentW: {
      value: latentW,
      source: formatSource(references.infiltration, "Latent = 3010 x flow x deltaW"),
    },
    heatLoad: {
      value: sensibleW + latentW,
      source: formatSource(references.infiltration, "Total infiltration = sensible + latent"),
    },
  };
}
