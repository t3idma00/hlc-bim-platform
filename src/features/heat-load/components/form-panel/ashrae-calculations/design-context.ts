import defaults from "../ashrae-tables/design-defaults.json";

import { getNum, isBlank } from "./common";
import type { DesignConditionContext, DesignConditionSource, FormValues } from "./types";

type OutdoorDesignCache = {
  source?: string;
  standardPressureKPa?: number;
  meanCoincidentWindSpeed?: number | null;
  hottestMonth?: number | null;
};

function parseOutdoorDesignCache(value: string | undefined): OutdoorDesignCache | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as OutdoorDesignCache;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getDesignConditionSource(value: string | undefined): DesignConditionSource {
  return value === "ashrae-2017" || value === "ashrae-2005" ? "ashrae-2017" : "current";
}

export function resolveDesignConditionContext(formValues: FormValues): DesignConditionContext {
  const source = getDesignConditionSource(formValues.designConditionSource);
  const cache =
    source === "ashrae-2017"
      ? parseOutdoorDesignCache(formValues.ashraeOutdoorDesignData)
      : parseOutdoorDesignCache(formValues.currentOutdoorDesignData);

  const pressurePa =
    typeof cache?.standardPressureKPa === "number" && Number.isFinite(cache.standardPressureKPa)
      ? cache.standardPressureKPa * 1000
      : defaults.standardPressurePa;
  const windSpeedMps =
    typeof cache?.meanCoincidentWindSpeed === "number" && Number.isFinite(cache.meanCoincidentWindSpeed)
      ? cache.meanCoincidentWindSpeed
      : defaults.defaultWindSpeedMps;
  const hottestMonth =
    typeof cache?.hottestMonth === "number" && Number.isFinite(cache.hottestMonth)
      ? Math.min(12, Math.max(1, Math.round(cache.hottestMonth)))
      : defaults.defaultHottestMonth;

  const dni = getNum(formValues.solarDni);
  const dhi = getNum(formValues.solarDhi);
  const ghi = getNum(formValues.solarGhi);
  const zenith = getNum(formValues.solarZenith);
  const azimuth = getNum(formValues.solarAzimuth);
  const outdoorDryBulbC = getNum(formValues.dryBulbTemp);
  const indoorDryBulbC = getNum(formValues.insideCondition);

  return {
    source,
    outdoorDryBulbC,
    indoorDryBulbC,
    deltaTC: outdoorDryBulbC - indoorDryBulbC,
    pressurePa,
    windSpeedMps,
    hottestMonth,
    solar: {
      dni,
      dhi,
      ghi,
      zenith,
      azimuth,
      hasData:
        !isBlank(formValues.solarZenith) &&
        !isBlank(formValues.solarAzimuth) &&
        (dni > 0 || dhi > 0 || ghi > 0),
    },
  };
}
