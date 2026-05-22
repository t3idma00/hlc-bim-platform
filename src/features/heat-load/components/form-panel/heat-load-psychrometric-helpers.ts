import { getHumidityRatioFromRelHum, getHumidityRatioFromWetBulb } from "@/lib/calculations";

import { getNum } from "./ashrae-calculations";

export function resolveHumidityRatio(
  dryBulbC: number,
  conditionType: string | undefined,
  conditionValue: string | undefined,
  pressurePa: number,
) {
  if (dryBulbC === 0 && conditionValue == null) return null;

  const value = getNum(conditionValue);
  if (value === 0 && !conditionValue) return null;

  return conditionType === "Wet bulb temperature"
    ? getHumidityRatioFromWetBulb(dryBulbC, value, pressurePa)
    : getHumidityRatioFromRelHum(dryBulbC, value, pressurePa);
}
