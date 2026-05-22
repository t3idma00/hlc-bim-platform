import references from "../ashrae-tables/references.json";

import { formatSource } from "./common";
import { resolveCorrectedCltd } from "./cltd";
import type { DesignConditionContext, Section1Result } from "./types";
import { resolveAshraeUFactor } from "./u-factors";

export function calculateAshraeSection1(input: {
  item: string;
  direction: string;
  type: string;
  detail?: string;
  thicknessMm: number;
  areaM2: number;
  context: DesignConditionContext;
}): Section1Result {
  const uFactor = resolveAshraeUFactor(input);
  const correctedCltd = resolveCorrectedCltd(input);
  const heatLoad = input.areaM2 > 0 ? uFactor.value * correctedCltd.value * input.areaM2 : 0;

  return {
    uFactor,
    td: correctedCltd,
    heatLoad: {
      value: heatLoad,
      source: formatSource(references.opaqueCts, "Q = U x corrected CLTD x area"),
    },
  };
}
