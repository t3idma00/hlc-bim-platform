import internalLoads from "../ashrae-tables/internal-loads-1997.json";

import { formatSource } from "./common";
import type { DesignConditionContext, Section4Result } from "./types";

type InfiltrationTable = {
  windowLeakageAreaCm2PerM: number;
  doorFrameLeakageAreaCm2Each: number;
  stackCoefficient: number;
  windCoefficient: number;
  airDensityCp: number;
  latentConstant: number;
};

const infiltration = (internalLoads as { infiltration: InfiltrationTable }).infiltration;
const source1997 =
  "ASHRAE 1997 Ch25 Table 3, Tables 6 and 8, and Eq. 46; Ch28 outdoor-air heat equations";

function doorFrameLeakageArea(input: {
  doorQty: number;
}) {
  return Math.max(0, input.doorQty) * infiltration.doorFrameLeakageAreaCm2Each;
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

export function calculateAshraeSection4(input: {
  windowQty: number;
  crackLengthM: number;
  doorQty: number;
  context: DesignConditionContext;
  deltaW: number;
}): Section4Result {
  const windowArea =
    Math.max(0, input.windowQty) *
    Math.max(0, input.crackLengthM) *
    infiltration.windowLeakageAreaCm2PerM;
  const leakageAreaCm2 = windowArea + doorFrameLeakageArea(input);
  const driving =
    infiltration.stackCoefficient * Math.abs(input.context.deltaTC) +
    infiltration.windCoefficient * Math.max(0, input.context.windSpeedMps) ** 2;
  const flowLps = leakageAreaCm2 * Math.sqrt(Math.max(0, driving));

  return sensibleLatent({
    flowLps,
    deltaTC: input.context.deltaTC,
    deltaW: input.deltaW,
    source: formatSource(
      source1997,
      `Effective leakage area ${leakageAreaCm2.toFixed(2)} cm2 with design stack-wind conditions`,
    ),
  });
}
