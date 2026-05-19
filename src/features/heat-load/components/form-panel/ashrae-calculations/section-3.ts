import references from "../ashrae-tables/references.json";
import section3Data from "../section-3-data.json";

import { formatSource } from "./common";
import type { DesignConditionContext, Section3Result } from "./types";
import { resolveAshraeUFactor } from "./u-factors";

export function calculateAshraeSection3(input: {
  item: string;
  typeA: string;
  typeB: string;
  thicknessMm: number;
  areaM2: number;
  context: DesignConditionContext;
}): Section3Result {
  const assemblyType = input.typeA === "Intermediate Floor" ? input.typeB : input.typeA || input.typeB;
  const uFactor = resolveAshraeUFactor({
    item: input.item,
    type: assemblyType,
    detail: input.typeB,
    direction: input.typeA,
    thicknessMm: input.thicknessMm,
  });
  const isFloor = input.item.toLowerCase().includes("floor");
  const multiplier = isFloor ? 0.25 : section3Data.transmission.unconditionedSpaceTDMultiplier;
  const tdValue = Math.max(0, input.context.deltaTC * multiplier);
  const heatLoad = input.areaM2 > 0 ? uFactor.value * tdValue * input.areaM2 : 0;

  return {
    uFactor,
    td: {
      value: tdValue,
      source: isFloor
        ? formatSource(references.slabBasement, "Floor/slab adjacent-space TD approximation")
        : formatSource(references.designConditions, "Adjacent unconditioned-space TD approximation"),
    },
    heatLoad: {
      value: heatLoad,
      source: formatSource(references.slabBasement, "Q = U x TD x area"),
    },
  };
}
