import "server-only";

import baseStationsPayload from "@/data/ashrae2005/ashrae-design-conditions.json";
import sriLankaStationsPayload from "@/data/ashrae2025-sri-lanka/ashrae-design-conditions.json";
import { calculateRelativeHumidityFromWetBulb } from "@/lib/calculations/psychrometrics";

export type AshraePercentile = "0.4" | "1" | "2";

type StationRecord = {
  stationName: string;
  wmo: string;
  sourceEdition: string;
  countryLabel: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  elevationM: number;
  standardPressureKPa: number;
  standardPressurePa: number;
  utcOffsetHours: number;
  timeZoneCode: string;
  periodOfRecord: string;
  cooling: {
    hottestMonth: number | null;
    hottestMonthDryBulbRange: number | null;
    dryBulb: Record<AshraePercentile, number | null>;
    meanCoincidentWetBulb: Record<AshraePercentile, number | null>;
    wetBulb: Record<AshraePercentile, number | null>;
    meanCoincidentDryBulbFromWetBulb: Record<AshraePercentile, number | null>;
    meanCoincidentWindTo0_4DryBulb: {
      windSpeed: number | null;
      prevailingDirection: number | null;
    };
  };
  grade?: string;
};

type StationsPayload = {
  generatedFrom?: string;
  recordCount: number;
  stations: StationRecord[];
};

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "unitedstates",
  unitedstatesofamerica: "unitedstates",
  us: "unitedstates",
  uk: "unitedkingdom",
  uae: "unitedarabemirates",
};

const baseStations = (baseStationsPayload as StationsPayload).stations;
const sriLankaStations = (sriLankaStationsPayload as StationsPayload).stations;
const sriLankaWmos = new Set(sriLankaStations.map((station) => station.wmo));
const stations = [...sriLankaStations, ...baseStations.filter((station) => !sriLankaWmos.has(station.wmo))];

function normalizeCountryLabel(value: string | undefined) {
  const compact = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return COUNTRY_ALIASES[compact] ?? compact;
}

function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const latARadians = toRadians(latitudeA);
  const latBRadians = toRadians(latitudeB);

  const sinLatitude = Math.sin(deltaLatitude / 2);
  const sinLongitude = Math.sin(deltaLongitude / 2);

  const a =
    sinLatitude * sinLatitude +
    Math.cos(latARadians) * Math.cos(latBRadians) * sinLongitude * sinLongitude;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStationUsable(station: StationRecord, percentile: AshraePercentile) {
  return (
    isFiniteNumber(station.latitude) &&
    isFiniteNumber(station.longitude) &&
    isFiniteNumber(station.standardPressurePa) &&
    isFiniteNumber(station.cooling.hottestMonth) &&
    isFiniteNumber(station.cooling.dryBulb[percentile]) &&
    isFiniteNumber(station.cooling.meanCoincidentWetBulb[percentile])
  );
}

function selectNearestStation(
  latitude: number,
  longitude: number,
  percentile: AshraePercentile,
  countryLabel?: string,
) {
  const normalizedCountry = normalizeCountryLabel(countryLabel);
  const usableStations = stations.filter((station) => isStationUsable(station, percentile));

  const countryStations = normalizedCountry
    ? usableStations.filter((station) => normalizeCountryLabel(station.countryLabel) === normalizedCountry)
    : [];

  const candidateStations = countryStations.length > 0 ? countryStations : usableStations;

  let nearestStation: StationRecord | null = null;
  let nearestDistanceKm = Number.POSITIVE_INFINITY;

  for (const station of candidateStations) {
    const distanceKm = haversineDistanceKm(latitude, longitude, station.latitude, station.longitude);
    if (distanceKm < nearestDistanceKm) {
      nearestStation = station;
      nearestDistanceKm = distanceKm;
    }
  }

  if (!nearestStation) {
    throw new Error("No usable ASHRAE station could be matched.");
  }

  return {
    station: nearestStation,
    distanceKm: nearestDistanceKm,
    matchedByCountry: candidateStations === countryStations && countryStations.length > 0,
  };
}

export function getAshraeDesignConditions(input: {
  latitude: number;
  longitude: number;
  percentile: AshraePercentile;
  countryLabel?: string;
}) {
  const match = selectNearestStation(
    input.latitude,
    input.longitude,
    input.percentile,
    input.countryLabel,
  );

  const dryBulbTemp = match.station.cooling.dryBulb[input.percentile];
  const meanCoincidentWetBulb = match.station.cooling.meanCoincidentWetBulb[input.percentile];
  const hottestMonth = match.station.cooling.hottestMonth;
  const hottestMonthDryBulbRange = match.station.cooling.hottestMonthDryBulbRange;

  if (
    !isFiniteNumber(dryBulbTemp) ||
    !isFiniteNumber(meanCoincidentWetBulb) ||
    !isFiniteNumber(hottestMonth)
  ) {
    throw new Error("Matched ASHRAE station does not contain the requested cooling design condition.");
  }

  const relativeHumidity =
    calculateRelativeHumidityFromWetBulb(
      dryBulbTemp,
      meanCoincidentWetBulb,
      match.station.standardPressurePa,
    );

  return {
    percentile: input.percentile,
    matchedByCountry: match.matchedByCountry,
    distanceKm: Number(match.distanceKm.toFixed(1)),
    station: {
      name: match.station.stationName,
      wmo: match.station.wmo,
      sourceEdition: match.station.sourceEdition,
      countryLabel: match.station.countryLabel,
      locationLabel: match.station.locationLabel,
      latitude: match.station.latitude,
      longitude: match.station.longitude,
      elevationM: match.station.elevationM,
      utcOffsetHours: match.station.utcOffsetHours,
      timeZoneCode: match.station.timeZoneCode,
      periodOfRecord: match.station.periodOfRecord,
      standardPressureKPa: match.station.standardPressureKPa,
      grade: match.station.grade,
    },
    cooling: {
      hottestMonth,
      hottestMonthDryBulbRange,
      dryBulbTemp,
      meanCoincidentWetBulb,
      relativeHumidity,
      wetBulbPercentile: match.station.cooling.wetBulb[input.percentile],
      wetBulbMeanCoincidentDryBulb:
        match.station.cooling.meanCoincidentDryBulbFromWetBulb[input.percentile],
      meanCoincidentWindSpeed:
        match.station.cooling.meanCoincidentWindTo0_4DryBulb.windSpeed,
      prevailingWindDirection:
        match.station.cooling.meanCoincidentWindTo0_4DryBulb.prevailingDirection,
    },
    supportedPercentiles: ["0.4", "1", "2"] as AshraePercentile[],
  };
}
