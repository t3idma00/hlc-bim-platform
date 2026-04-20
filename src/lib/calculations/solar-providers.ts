import type {
  AmbientConditions,
  ResolvedSolarLocation,
  SolarIntensity,
  SolarLocationCandidate,
  SolarLocationInput,
  SolarMode,
} from "./solar-types";
import { calculateWetBulbFromRelativeHumidity } from "./psychrometrics";

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toYyyyMmDdUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function parseMeasurement(value: unknown): { value: number; available: boolean } {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return { value: 0, available: false };
  }

  return { value: parsed, available: true };
}

function buildMissingVariables(availability: { ghi: boolean; dni: boolean; dhi: boolean }): string[] {
  const missing: string[] = [];
  if (!availability.ghi) {
    missing.push("GHI");
  }
  if (!availability.dni) {
    missing.push("DNI");
  }
  if (!availability.dhi) {
    missing.push("DHI");
  }
  return missing;
}

function buildAmbientMissingVariables(availability: {
  dryBulbTemp: boolean;
  relativeHumidity: boolean;
  wetBulbTemp: boolean;
}): string[] {
  const missing: string[] = [];
  if (!availability.dryBulbTemp) {
    missing.push("DryBulbTemp");
  }
  if (!availability.relativeHumidity) {
    missing.push("RelativeHumidity");
  }
  if (!availability.wetBulbTemp) {
    missing.push("WetBulbTemp");
  }
  return missing;
}

function findNearestHourlyIndex(times: string[], targetDateTime: Date): number {
  const targetMs = targetDateTime.getTime();
  let nearestIndex = 0;
  let nearestDelta = Number.POSITIVE_INFINITY;

  for (let index = 0; index < times.length; index += 1) {
    const sampleMs = new Date(times[index]).getTime();
    const delta = Math.abs(sampleMs - targetMs);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}


// Great-circle distance between two geographic points on Earth using the Haversine formula.
//
// Inputs:
//   aLat, aLon = latitude and longitude of point A in degrees
//   bLat, bLon = latitude and longitude of point B in degrees
//
// Mathematical steps:
//
// 1) Convert angular differences from degrees to radians:
//      Δφ = (bLat - aLat) * π / 180
//      Δλ = (bLon - aLon) * π / 180
//
//    Also convert the original latitudes:
//      φ1 = aLat * π / 180
//      φ2 = bLat * π / 180
//
// 2) Haversine formula:
//      a = sin²(Δφ / 2) + cos(φ1) cos(φ2) sin²(Δλ / 2)
//
// 3) Central angle between the two points:
//      c = 2 atan2( √a, √(1 - a) )
//
// 4) Surface distance on the Earth:
//      d = R c
//
//    where R = 6371 km is the approximate mean Earth radius.
//
// Output:
//   d = great-circle distance in kilometers
//
// Note:
//   This is appropriate for city-to-city / coordinate validation,
//   such as checking whether a selected point is within 50 km of a city.

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const aa =
    sinLat * sinLat +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * sinLon * sinLon;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

export async function searchSolarLocations(input: {
  name: string;
  country?: string;
  countryCode?: string;
  count?: number;
  onlyCities?: boolean;
}): Promise<SolarLocationCandidate[]> {
  const params = new URLSearchParams({
    name: input.name,
    count: String(input.count ?? 10),
    language: "en",
    format: "json",
  });

  if (input.country) {
    params.set("country", input.country);
  }
  if (input.countryCode) {
    params.set("country_code", input.countryCode);
  }

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to resolve geocoding location (${response.status}).`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      id?: number;
      name?: string;
      country?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
      population?: number;
      feature_code?: string;
      admin1?: string;
    }>;
  };

  const onlyCities = input.onlyCities ?? false;
  const candidates = payload.results ?? [];

  return candidates
    .filter((item) => {
      if (!onlyCities) {
        return true;
      }
      const code = item.feature_code ?? "";
      return code.startsWith("PPL") || code === "PPLA" || code === "PPLC";
    })
    .map((item) => {
      const missingFields: string[] = [];
      if (!isFiniteNumber(item.latitude)) {
        missingFields.push("latitude");
      }
      if (!isFiniteNumber(item.longitude)) {
        missingFields.push("longitude");
      }
      if (!item.timezone) {
        missingFields.push("timezone");
      }

      return {
        id: String(item.id ?? `${item.name ?? "unknown"}-${item.latitude ?? 0}-${item.longitude ?? 0}`),
        name: item.name ?? input.name,
        country: item.country,
        countryCode: item.country_code,
        latitude: isFiniteNumber(item.latitude) ? item.latitude : 0,
        longitude: isFiniteNumber(item.longitude) ? item.longitude : 0,
        timezone: item.timezone,
        population: item.population ?? null,
        featureCode: item.feature_code,
        admin1: item.admin1,
        missingFields,
        hasRequiredData: missingFields.length === 0,
      };
    });
}

export async function validateCityCoordinateMatch(input: {
  city: string;
  country?: string;
  latitude: number;
  longitude: number;
  thresholdKm?: number;
}): Promise<{ matched: boolean; distanceKm: number | null; reference: SolarLocationCandidate | null }> {
  const thresholdKm = input.thresholdKm ?? 50;
  const candidates = await searchSolarLocations({
    name: input.city,
    country: input.country,
    count: 10,
    onlyCities: true,
  });

  const reference = candidates.find((item) => item.hasRequiredData) ?? candidates[0] ?? null;
  if (!reference) {
    return { matched: false, distanceKm: null, reference: null };
  }

  const deltaKm = distanceKm(input.latitude, input.longitude, reference.latitude, reference.longitude);
  return {
    matched: deltaKm <= thresholdKm,
    distanceKm: Number(deltaKm.toFixed(2)),
    reference,
  };
}

// Decide which data source mode to use from the selected date.
export function chooseModeByDate(targetDateTime: Date): SolarMode {
  const now = new Date();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(
    targetDateTime.getUTCFullYear(),
    targetDateTime.getUTCMonth(),
    targetDateTime.getUTCDate(),
  );

  return targetUtc < startOfTodayUtc ? "historical" : "live";
}

// Resolve final location values for downstream provider calls.
export async function resolveSolarLocation(input: SolarLocationInput): Promise<ResolvedSolarLocation> {
  if (isFiniteNumber(input.latitude) && isFiniteNumber(input.longitude)) {
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      city: input.city,
      country: input.country,
      timezone: input.timezone,
    };
  }

  throw new Error("Provide latitude and longitude.");
}

// Live/near-live solar radiation from Open-Meteo forecast API.
export async function fetchOpenMeteoSolarIntensity(
  location: ResolvedSolarLocation,
  targetDateTime: Date,
): Promise<SolarIntensity> {
  const dateIso = targetDateTime.toISOString().slice(0, 10);
  const timezone = location.timezone ?? "UTC";
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone,
    hourly: "shortwave_radiation,direct_normal_irradiance,diffuse_radiation",
    start_date: dateIso,
    end_date: dateIso,
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    hourly?: {
      time?: string[];
      shortwave_radiation?: Array<number | null>;
      direct_normal_irradiance?: Array<number | null>;
      diffuse_radiation?: Array<number | null>;
    };
  };

  const hourly = payload.hourly;
  if (!hourly?.time?.length) {
    throw new Error("Open-Meteo response does not contain hourly solar data.");
  }

  const nearestIndex = findNearestHourlyIndex(hourly.time, targetDateTime);
  const ghi = parseMeasurement(hourly.shortwave_radiation?.[nearestIndex]);
  const dni = parseMeasurement(hourly.direct_normal_irradiance?.[nearestIndex]);
  const dhi = parseMeasurement(hourly.diffuse_radiation?.[nearestIndex]);

  const availability = {
    ghi: ghi.available,
    dni: dni.available,
    dhi: dhi.available,
  };

  return {
    ghi: ghi.value,
    dni: dni.value,
    dhi: dhi.value,
    source: "open-meteo",
    availability,
    missingVariables: buildMissingVariables(availability),
  };
}

function parseNasaHourlyValue(
  parameterMap: Record<string, number | string | null> | undefined,
  dateTime: Date,
): { value: number; available: boolean } {
  if (!parameterMap) {
    return { value: 0, available: false };
  }

  const key = `${toYyyyMmDdUtc(dateTime)}${pad(dateTime.getUTCHours())}`;
  const value = parameterMap[key];
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < -900) {
    return { value: 0, available: false };
  }

  return { value: parsed, available: true };
}

// Historical solar radiation from NASA POWER hourly endpoint.
export async function fetchNasaPowerSolarIntensity(
  location: ResolvedSolarLocation,
  targetDateTime: Date,
): Promise<SolarIntensity> {
  const date = toYyyyMmDdUtc(targetDateTime);
  const params = new URLSearchParams({
    parameters: "ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF",
    community: "RE",
    longitude: String(location.longitude),
    latitude: String(location.latitude),
    start: date,
    end: date,
    format: "JSON",
    "time-standard": "UTC",
  });

  const response = await fetch(`https://power.larc.nasa.gov/api/temporal/hourly/point?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`NASA POWER request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    properties?: {
      parameter?: {
        ALLSKY_SFC_SW_DWN?: Record<string, number | string | null>;
        ALLSKY_SFC_SW_DNI?: Record<string, number | string | null>;
        ALLSKY_SFC_SW_DIFF?: Record<string, number | string | null>;
      };
    };
  };

  const parameter = payload.properties?.parameter;
  if (!parameter) {
    throw new Error("NASA POWER response does not contain hourly solar parameters.");
  }

  const ghi = parseNasaHourlyValue(parameter.ALLSKY_SFC_SW_DWN, targetDateTime);
  const dni = parseNasaHourlyValue(parameter.ALLSKY_SFC_SW_DNI, targetDateTime);
  const dhi = parseNasaHourlyValue(parameter.ALLSKY_SFC_SW_DIFF, targetDateTime);

  const availability = {
    ghi: ghi.available,
    dni: dni.available,
    dhi: dhi.available,
  };

  return {
    ghi: ghi.value,
    dni: dni.value,
    dhi: dhi.value,
    source: "nasa-power",
    availability,
    missingVariables: buildMissingVariables(availability),
  };
}

// Historical fallback solar radiation from Open-Meteo archive.
export async function fetchOpenMeteoArchiveSolarIntensity(
  location: ResolvedSolarLocation,
  targetDateTime: Date,
): Promise<SolarIntensity> {
  const dateIso = targetDateTime.toISOString().slice(0, 10);
  const timezone = location.timezone ?? "UTC";
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone,
    hourly: "shortwave_radiation,direct_normal_irradiance,diffuse_radiation",
    start_date: dateIso,
    end_date: dateIso,
  });

  const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo archive request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    hourly?: {
      time?: string[];
      shortwave_radiation?: Array<number | null>;
      direct_normal_irradiance?: Array<number | null>;
      diffuse_radiation?: Array<number | null>;
    };
  };

  const hourly = payload.hourly;
  if (!hourly?.time?.length) {
    throw new Error("Open-Meteo archive response does not contain hourly solar data.");
  }

  const nearestIndex = findNearestHourlyIndex(hourly.time, targetDateTime);
  const ghi = parseMeasurement(hourly.shortwave_radiation?.[nearestIndex]);
  const dni = parseMeasurement(hourly.direct_normal_irradiance?.[nearestIndex]);
  const dhi = parseMeasurement(hourly.diffuse_radiation?.[nearestIndex]);

  const availability = {
    ghi: ghi.available,
    dni: dni.available,
    dhi: dhi.available,
  };

  return {
    ghi: ghi.value,
    dni: dni.value,
    dhi: dhi.value,
    source: "open-meteo-archive",
    availability,
    missingVariables: buildMissingVariables(availability),
  };
}

// Ambient weather values (dry bulb and RH) for the selected timestamp.
export async function fetchOpenMeteoAmbientConditions(
  location: ResolvedSolarLocation,
  targetDateTime: Date,
): Promise<AmbientConditions> {
  const dateIso = targetDateTime.toISOString().slice(0, 10);
  const timezone = location.timezone ?? "UTC";
  const isHistorical = chooseModeByDate(targetDateTime) === "historical";
  const endpoint = isHistorical
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";
  const source: AmbientConditions["source"] = isHistorical ? "open-meteo-archive" : "open-meteo";

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone,
    hourly: "temperature_2m,relative_humidity_2m",
    start_date: dateIso,
    end_date: dateIso,
  });

  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo ambient request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      relative_humidity_2m?: Array<number | null>;
    };
  };

  const hourly = payload.hourly;
  if (!hourly?.time?.length) {
    throw new Error("Open-Meteo ambient response does not contain hourly weather data.");
  }

  const nearestIndex = findNearestHourlyIndex(hourly.time, targetDateTime);
  const dryBulbTemp = parseMeasurement(hourly.temperature_2m?.[nearestIndex]);
  const relativeHumidity = parseMeasurement(hourly.relative_humidity_2m?.[nearestIndex]);
  const wetBulbTemp =
    dryBulbTemp.available && relativeHumidity.available
      ? calculateWetBulbFromRelativeHumidity(dryBulbTemp.value, relativeHumidity.value)
      : null;

  const availability = {
    dryBulbTemp: dryBulbTemp.available,
    relativeHumidity: relativeHumidity.available,
    wetBulbTemp: wetBulbTemp !== null,
  };

  return {
    dryBulbTemp: dryBulbTemp.value,
    relativeHumidity: relativeHumidity.value,
    wetBulbTemp,
    source,
    availability,
    missingVariables: buildAmbientMissingVariables(availability),
  };
}
