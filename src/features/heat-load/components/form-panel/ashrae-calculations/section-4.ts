import internalLoads from "../ashrae-tables/internal-loads-1997.json";

import { formatSource } from "./common";
import type { DesignConditionContext, Section4Result } from "./types";

type InfiltrationTable = {
  windowLeakageAreaCm2PerM: number;
  doorFrameLeakageAreaCm2Each: number;
  doorBarrierLeakageAreaCm2PerM2: number;
  stackCoefficient: number;
  windCoefficient: number;
  airDensityCp: number;
  latentConstant: number;
};

const infiltration = (internalLoads as { infiltration: InfiltrationTable }).infiltration;
const source1997 =
  "ASHRAE 1997 Ch25 Table 3 and Eq. 46; Ch28 outdoor-air heat equations";

export const infiltrationMethodOptions = ["Crack + Door", "ASHRAE Stack-Wind"] as const;

function doorLeakageArea(input: {
  doorQty: number;
  doorAreaM2: number;
}) {
  return (
    input.doorQty * infiltration.doorFrameLeakageAreaCm2Each +
    input.doorAreaM2 * infiltration.doorBarrierLeakageAreaCm2PerM2
  );
}

function sensibleLatent(input: {
  flowLps: number;
  deltaTC: number;
  deltaW: number;
  source: string;
}): Section4Result {
  const sensibleW = Math.max(0, input.flowLps * infiltration.airDensityCp * input.deltaTC);
  const latentW = Math.max(0, input.flowLps * infiltration.latentConstant * input.deltaW);

  return {
    flowLps: { value: input.flowLps, source: input.source },
    sensibleW: {
      value: sensibleW,
      source: formatSource(source1997, "Sensible = 1.23 x flow x deltaT"),
    },
    latentW: {
      value: latentW,
      source: formatSource(source1997, "Latent = 3010 x flow x deltaW"),
    },
    heatLoad: {
      value: sensibleW + latentW,
      source: formatSource(source1997, "Total infiltration = sensible + latent"),
    },
  };
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
  const windowArea = input.windowQty * input.crackLengthM * infiltration.windowLeakageAreaCm2PerM;
  const leakageAreaCm2 = windowArea + doorLeakageArea(input);
  const flowLps = leakageAreaCm2 * Math.sqrt(infiltration.stackCoefficient * 10 + infiltration.windCoefficient * 3 ** 2);

  return sensibleLatent({
    flowLps,
    deltaTC: input.deltaTC,
    deltaW: input.deltaW,
    source: formatSource(source1997, "Current mode uses 1997 effective leakage area at reference driving force"),
  });
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
  const windowArea = input.windowQty * input.crackLengthM * infiltration.windowLeakageAreaCm2PerM;
  const leakageAreaCm2 = windowArea + doorLeakageArea(input);
  const useStackWind = input.method !== "Crack + Door";
  const driving = useStackWind
    ? infiltration.stackCoefficient * Math.abs(input.context.deltaTC) +
      infiltration.windCoefficient * Math.max(0, input.context.windSpeedMps) ** 2
    : infiltration.stackCoefficient * 10 + infiltration.windCoefficient * 3 ** 2;
  const flowLps = leakageAreaCm2 * Math.sqrt(Math.max(0, driving));

  return sensibleLatent({
    flowLps,
    deltaTC: input.context.deltaTC,
    deltaW: input.deltaW,
    source: formatSource(
      source1997,
      `Effective leakage area ${leakageAreaCm2.toFixed(2)} cm2 ${useStackWind ? "with" : "without"} stack-wind correction`,
    ),
  });
}
