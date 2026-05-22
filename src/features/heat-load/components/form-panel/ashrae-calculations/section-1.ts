import { formatSource } from "./common";
import { resolveCorrectedCltd } from "./cltd";
import type { DesignConditionContext, Section1Result } from "./types";
import { resolveAshraeUFactor } from "./u-factors";
import { calculateAshraeWallCltdPeak } from "./wall-section1-cltd";

export function calculateAshraeSection1(input: {
  item: string;
  direction: string;
  type: string;
  detail?: string;
  thicknessMm: number;
  areaM2: number;
  context: DesignConditionContext;
}): Section1Result {
  if (input.item.toLowerCase().includes("wall")) {
    const wallPeak = calculateAshraeWallCltdPeak(input);

    if (wallPeak) {
      return {
        uFactor: wallPeak.uFactor,
        td: wallPeak.correctedCltd,
        heatLoad: wallPeak.heatLoad,
        calculationTrace: wallPeak.trace,
      };
    }
  }

  const uFactor = resolveAshraeUFactor(input);
  const correctedCltd = resolveCorrectedCltd(input);
  const heatLoad = input.areaM2 > 0 ? uFactor.value * correctedCltd.value * input.areaM2 : 0;

  return {
    uFactor,
    td: correctedCltd,
    heatLoad: {
      value: heatLoad,
      source: formatSource(
        `${uFactor.source}; ${correctedCltd.source}`,
        "Q = U x corrected CLTD x area",
      ),
    },
  };
}
