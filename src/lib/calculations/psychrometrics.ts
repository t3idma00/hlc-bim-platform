import psychrolib from "psychrolib";

const STANDARD_ATMOSPHERIC_PRESSURE_PA = 101325;

function ensureSiUnitSystem() {
  if (psychrolib.GetUnitSystem() !== psychrolib.SI) {
    psychrolib.SetUnitSystem(psychrolib.SI);
  }
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

export function calculateWetBulbFromRelativeHumidity(
  dryBulbTempCelsius: number,
  relativeHumidityPercent: number,
  pressurePa = STANDARD_ATMOSPHERIC_PRESSURE_PA
) {
  if (!isFiniteNumber(dryBulbTempCelsius) || !isFiniteNumber(relativeHumidityPercent) || !isFiniteNumber(pressurePa)) {
    return null;
  }

  if (relativeHumidityPercent < 0 || relativeHumidityPercent > 100) {
    return null;
  }

  try {
    ensureSiUnitSystem();
    return psychrolib.GetTWetBulbFromRelHum(dryBulbTempCelsius, relativeHumidityPercent / 100, pressurePa);
  } catch {
    return null;
  }
}

export function calculateRelativeHumidityFromWetBulb(
  dryBulbTempCelsius: number,
  wetBulbTempCelsius: number,
  pressurePa = STANDARD_ATMOSPHERIC_PRESSURE_PA
) {
  if (!isFiniteNumber(dryBulbTempCelsius) || !isFiniteNumber(wetBulbTempCelsius) || !isFiniteNumber(pressurePa)) {
    return null;
  }

  if (wetBulbTempCelsius > dryBulbTempCelsius) {
    return null;
  }

  try {
    ensureSiUnitSystem();
    return psychrolib.GetRelHumFromTWetBulb(dryBulbTempCelsius, wetBulbTempCelsius, pressurePa) * 100;
  } catch {
    return null;
  }
}

/**
 * Calculate humidity ratio (kg water / kg dry air) from dry-bulb temperature
 * and relative humidity (%). Returns null on invalid input.
 */
export function getHumidityRatioFromRelHum(
  dryBulbTempCelsius: number,
  relativeHumidityPercent: number,
  pressurePa = STANDARD_ATMOSPHERIC_PRESSURE_PA
): number | null {
  if (!isFiniteNumber(dryBulbTempCelsius) || !isFiniteNumber(relativeHumidityPercent) || !isFiniteNumber(pressurePa)) {
    return null;
  }

  if (relativeHumidityPercent < 0 || relativeHumidityPercent > 100) {
    return null;
  }

  try {
    ensureSiUnitSystem();
    return psychrolib.GetHumRatioFromRelHum(dryBulbTempCelsius, relativeHumidityPercent / 100, pressurePa);
  } catch {
    return null;
  }
}

/**
 * Calculate humidity ratio (kg water / kg dry air) from dry-bulb temperature
 * and wet-bulb temperature (°C). Returns null on invalid input.
 */
export function getHumidityRatioFromWetBulb(
  dryBulbTempCelsius: number,
  wetBulbTempCelsius: number,
  pressurePa = STANDARD_ATMOSPHERIC_PRESSURE_PA
): number | null {
  if (!isFiniteNumber(dryBulbTempCelsius) || !isFiniteNumber(wetBulbTempCelsius) || !isFiniteNumber(pressurePa)) {
    return null;
  }

  if (wetBulbTempCelsius > dryBulbTempCelsius) {
    return null;
  }

  try {
    ensureSiUnitSystem();
    return psychrolib.GetHumRatioFromTWetBulb(dryBulbTempCelsius, wetBulbTempCelsius, pressurePa);
  } catch {
    return null;
  }
}
