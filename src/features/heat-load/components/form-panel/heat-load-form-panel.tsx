"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { fetchCachedJson } from "@/lib/client-fetch-cache";
import { calculateRelativeHumidityFromWetBulb, calculateWetBulbFromRelativeHumidity } from "@/lib/calculations";
import { normalizeUnitSystem, unitLabel, type UnitSystem } from "@/lib/units";

import { DesignConditionsRow } from "./design-conditions-table";
import { HeatLoadSheet } from "./heat-load-sheet";
import { RoomDetailsRow, RoomDetailsSurfaceTabs } from "./room-details-table";
import { roofDetailOptions } from "./ashrae-roof-assemblies";
import { CompletionBadge } from "./completion-badge";
import { isManualSelectComplete, manualSelectMarkerKey, manualSelectMarkerValue } from "./progress-tracking";

type SurfaceType = "walls" | "windows" | "doors";
type DesignConditionSource = "" | "current" | "ashrae-2017";
type SetupTabKey = "location" | "source" | "conditions" | "roomDetails";
type FormSectionKey = "setup";

export type FormValues = Record<string, string>;
type SheetValues = Record<string, string>;

type Props = {
  formValues: FormValues;
  sheetValues: SheetValues;
  onFieldChange: (name: string, value: string) => void;
  onSheetChange: (name: string, value: string) => void;
};

type CountryOption = {
  name: string;
  iso2?: string;
};

type SolarLocationOption = {
  latitude: number;
  longitude: number;
  timezone?: string;
};

type ResolvedSolarLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
};

type TemperatureHistoryResponse = {
  source?: string;
  fallbackReason?: string;
  hourlyDryBulb?: Array<{
    time: string;
    dryBulbTemp: number | null;
    relativeHumidity?: number | null;
  }>;
};

type SolarDetailsResponse = {
  ambient?: {
    dryBulbTemp?: number | null;
    relativeHumidity?: number | null;
    wetBulbTemp?: number | null;
  };
  solarIntensity?: {
    dni?: number | null;
    dhi?: number | null;
    ghi?: number | null;
  };
  solarPosition?: {
    zenith?: number | null;
    azimuth?: number | null;
  };
};

type AshraeDesignConditionsResponse = {
  percentile: "0.4" | "1" | "2";
  matchedByCountry: boolean;
  distanceKm: number;
  station: {
    name: string;
    wmo: string;
    sourceEdition: string;
    countryLabel: string;
    locationLabel: string;
    latitude: number;
    longitude: number;
    elevationM: number;
    utcOffsetHours: number;
    timeZoneCode: string;
    periodOfRecord: string;
    standardPressureKPa: number;
    grade?: string;
  };
  cooling: {
    hottestMonth: number;
    hottestMonthDryBulbRange: number | null;
    dryBulbTemp: number;
    meanCoincidentWetBulb: number;
    relativeHumidity: number | null;
    wetBulbPercentile: number | null;
    wetBulbMeanCoincidentDryBulb: number | null;
    meanCoincidentWindSpeed: number | null;
    prevailingWindDirection: number | null;
  };
  supportedPercentiles: Array<"0.4" | "1" | "2">;
};

type OutdoorDesignCache = {
  source: DesignConditionSource;
  label: string;
  dryBulbTemp: string;
  wetBulbTemp: string;
  relativeHumidity: string;
  solarDni: string;
  solarDhi: string;
  solarGhi: string;
  solarZenith: string;
  solarAzimuth: string;
  latitude?: number;
  longitude?: number;
  percentile: string;
  year?: string;
  stationName?: string;
  stationWmo?: string;
  stationLocation?: string;
  stationCountry?: string;
  stationSourceEdition?: string;
  stationDistanceKm?: number;
  standardPressureKPa?: number;
  meanCoincidentWindSpeed?: number | null;
  hottestMonth?: number | null;
  hottestMonthDryBulbRange?: number | null;
  designHour?: number;
  matchedByCountry?: boolean;
};

const topSectionRows = [0, 1, 2, 3];
const CLTD_REFERENCE_MONTH = 7;
const DEFAULT_DESIGN_PERCENTILE = "1";
const CURRENT_SUPPORTED_PERCENTILES = ["0.4", "1", "2", "5"] as const;
const ASHRAE_SUPPORTED_PERCENTILES = ["0.4", "1", "2"] as const;
const linkedManualSheetSelectFields: Record<string, string[]> = {
  wallNorthDirection: ["1.1_direction", "3.2N_direction"],
  wallEastDirection: ["1.2_direction", "3.2E_direction"],
  wallSouthDirection: ["1.3_direction", "3.2S_direction"],
  wallWestDirection: ["1.4_direction", "3.2W_direction"],
  windowNorthDirection: ["2.1_direction"],
  windowEastDirection: ["2.2_direction"],
  windowSouthDirection: ["2.3_direction"],
  windowWestDirection: ["2.4_direction"],
};
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const initialFormValues: FormValues = {
  selectedCountry: "",
  selectedCountryCode: "",
  selectedCity: "",
  unitSystem: "imperial",
  wallNorthDirection: "",
  wallNorthLength: "6.096",
  wallNorthWidth: "200",
  wallNorthHeight: "2.4384",
  wallNorthType: "W04 Reinforced concrete frame with 200 mm cement block infill",
  wallNorthBoundary: "",
  wallEastDirection: "",
  wallEastLength: "3.048",
  wallEastWidth: "200",
  wallEastHeight: "2.4384",
  wallEastType: "W04 Reinforced concrete frame with 200 mm cement block infill",
  wallEastBoundary: "",
  wallSouthDirection: "",
  wallSouthLength: "6.096",
  wallSouthWidth: "200",
  wallSouthHeight: "2.4384",
  wallSouthType: "W04 Reinforced concrete frame with 200 mm cement block infill",
  wallSouthBoundary: "",
  wallWestDirection: "",
  wallWestLength: "3.048",
  wallWestWidth: "200",
  wallWestHeight: "2.4384",
  wallWestType: "W04 Reinforced concrete frame with 200 mm cement block infill",
  wallWestBoundary: "",
  windowNorthDirection: "",
  windowNorthLength: "",
  windowNorthWidth: "",
  windowNorthHeight: "",
  windowEastDirection: "",
  windowEastLength: "",
  windowEastWidth: "1.2192",
  windowEastHeight: "1.2192",
  windowSouthDirection: "",
  windowSouthLength: "",
  windowSouthWidth: "",
  windowSouthHeight: "",
  windowWestDirection: "",
  windowWestLength: "",
  windowWestWidth: "",
  windowWestHeight: "",
  doorNorthDirection: "",
  doorNorthLength: "",
  doorNorthWidth: "",
  doorNorthHeight: "",
  doorEastDirection: "",
  doorEastLength: "",
  doorEastWidth: "",
  doorEastHeight: "",
  doorSouthDirection: "",
  doorSouthLength: "",
  doorSouthWidth: "0.9144",
  doorSouthHeight: "2.1336",
  doorWestDirection: "",
  doorWestLength: "",
  doorWestWidth: "",
  doorWestHeight: "",
  roofType: "Concrete Slab Roof",
  roofDetail: roofDetailOptions[0],
  roofThickness: "150",
  outsideCondition: "35",
  dryBulbTemp: "35",
  wetBulbTemp: "",
  dryBulbPercentile: "",
  designYear: "",
  designConditionSource: "",
  currentOutdoorDesignData: "",
  ashraeOutdoorDesignData: "",
  insideCondition: "24",
  conditionDifference: "11",
  conditionType: "",
  conditionValue: "55",
  indoorConditionType: "",
  indoorConditionValue: "50",
  solarDni: "",
  solarDhi: "",
  solarGhi: "",
  solarZenith: "",
  solarAzimuth: "",
};

function computePercentile(values: number[], percentile: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.min(100, Math.max(0, percentile));
  const rank = (clamped / 100) * (sorted.length - 1);
  const lowIndex = Math.floor(rank);
  const highIndex = Math.ceil(rank);

  if (lowIndex === highIndex) {
    return sorted[lowIndex];
  }

  const weight = rank - lowIndex;
  return sorted[lowIndex] * (1 - weight) + sorted[highIndex] * weight;
}

function findNearestDesignHour(
  entries: Array<{
    time: string;
    dryBulbTemp: number | null;
    relativeHumidity?: number | null;
  }>,
  targetDryBulb: number,
) {
  const candidates = entries.filter(
    (entry): entry is {
      time: string;
      dryBulbTemp: number;
      relativeHumidity?: number | null;
    } => typeof entry.dryBulbTemp === "number",
  );

  if (!candidates.length) {
    return null;
  }

  return candidates.reduce((closest, entry) => {
    const currentDifference = Math.abs(entry.dryBulbTemp - targetDryBulb);
    const closestDifference = Math.abs(closest.dryBulbTemp - targetDryBulb);
    return currentDifference < closestDifference ? entry : closest;
  });
}

function formatConditionValue(value: number): string {
  return value.toFixed(1);
}

function formatOptionalConditionValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? formatConditionValue(value) : "";
}

function parseConditionValue(value: string): number | null {
  const parsedValue = Number.parseFloat(value ?? "");
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getDesignConditionSource(value: string | undefined): DesignConditionSource {
  if (value === "ashrae-2017" || value === "ashrae-2005") {
    return "ashrae-2017";
  }

  return value === "current" ? "current" : "";
}

function parseOutdoorDesignCache(value: string | undefined): OutdoorDesignCache | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<OutdoorDesignCache>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.dryBulbTemp !== "string" ||
      typeof parsed.wetBulbTemp !== "string" ||
      typeof parsed.relativeHumidity !== "string"
    ) {
      return null;
    }

    return {
      source: getDesignConditionSource(parsed.source),
      label: typeof parsed.label === "string" ? parsed.label : "",
      dryBulbTemp: parsed.dryBulbTemp,
      wetBulbTemp: parsed.wetBulbTemp,
      relativeHumidity: parsed.relativeHumidity,
      solarDni: typeof parsed.solarDni === "string" ? parsed.solarDni : "",
      solarDhi: typeof parsed.solarDhi === "string" ? parsed.solarDhi : "",
      solarGhi: typeof parsed.solarGhi === "string" ? parsed.solarGhi : "",
      solarZenith: typeof parsed.solarZenith === "string" ? parsed.solarZenith : "",
      solarAzimuth: typeof parsed.solarAzimuth === "string" ? parsed.solarAzimuth : "",
      latitude:
        typeof parsed.latitude === "number" && Number.isFinite(parsed.latitude) ? parsed.latitude : undefined,
      longitude:
        typeof parsed.longitude === "number" && Number.isFinite(parsed.longitude) ? parsed.longitude : undefined,
      percentile: typeof parsed.percentile === "string" ? parsed.percentile : "",
      year: typeof parsed.year === "string" ? parsed.year : undefined,
      stationName: typeof parsed.stationName === "string" ? parsed.stationName : undefined,
      stationWmo: typeof parsed.stationWmo === "string" ? parsed.stationWmo : undefined,
      stationLocation: typeof parsed.stationLocation === "string" ? parsed.stationLocation : undefined,
      stationCountry: typeof parsed.stationCountry === "string" ? parsed.stationCountry : undefined,
      stationSourceEdition:
        typeof parsed.stationSourceEdition === "string" ? parsed.stationSourceEdition : undefined,
      stationDistanceKm:
        typeof parsed.stationDistanceKm === "number" && Number.isFinite(parsed.stationDistanceKm)
          ? parsed.stationDistanceKm
          : undefined,
      standardPressureKPa:
        typeof parsed.standardPressureKPa === "number" && Number.isFinite(parsed.standardPressureKPa)
          ? parsed.standardPressureKPa
          : undefined,
      meanCoincidentWindSpeed:
        typeof parsed.meanCoincidentWindSpeed === "number" && Number.isFinite(parsed.meanCoincidentWindSpeed)
          ? parsed.meanCoincidentWindSpeed
          : undefined,
      hottestMonth:
        typeof parsed.hottestMonth === "number" && Number.isFinite(parsed.hottestMonth)
          ? parsed.hottestMonth
          : undefined,
      hottestMonthDryBulbRange:
        typeof parsed.hottestMonthDryBulbRange === "number" && Number.isFinite(parsed.hottestMonthDryBulbRange)
          ? parsed.hottestMonthDryBulbRange
          : undefined,
      designHour:
        typeof parsed.designHour === "number" && Number.isFinite(parsed.designHour) ? parsed.designHour : undefined,
      matchedByCountry: typeof parsed.matchedByCountry === "boolean" ? parsed.matchedByCountry : undefined,
    };
  } catch {
    return null;
  }
}

function buildSolarSnapshot(payload: SolarDetailsResponse) {
  return {
    solarDni:
      typeof payload.solarIntensity?.dni === "number" && Number.isFinite(payload.solarIntensity.dni)
        ? payload.solarIntensity.dni.toFixed(3)
        : "",
    solarDhi:
      typeof payload.solarIntensity?.dhi === "number" && Number.isFinite(payload.solarIntensity.dhi)
        ? payload.solarIntensity.dhi.toFixed(3)
        : "",
    solarGhi:
      typeof payload.solarIntensity?.ghi === "number" && Number.isFinite(payload.solarIntensity.ghi)
        ? payload.solarIntensity.ghi.toFixed(3)
        : "",
    solarZenith:
      typeof payload.solarPosition?.zenith === "number" && Number.isFinite(payload.solarPosition.zenith)
        ? payload.solarPosition.zenith.toFixed(3)
        : "",
    solarAzimuth:
      typeof payload.solarPosition?.azimuth === "number" && Number.isFinite(payload.solarPosition.azimuth)
        ? payload.solarPosition.azimuth.toFixed(3)
        : "",
  };
}

function emptySolarSnapshot() {
  return {
    solarDni: "",
    solarDhi: "",
    solarGhi: "",
    solarZenith: "",
    solarAzimuth: "",
  };
}

function getHourFromDateTime(value: string | undefined) {
  if (!value) {
    return 15;
  }
  const match = value.match(/T(\d{2}):/);
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isInteger(parsed) ? Math.min(23, Math.max(0, parsed)) : 15;
}

function getDailyDryBulbRange(
  entries: Array<{
    time: string;
    dryBulbTemp: number | null;
    relativeHumidity?: number | null;
  }>,
  designTime: string | undefined,
) {
  const day = designTime?.slice(0, 10);
  if (!day) {
    return null;
  }

  const values = entries
    .filter((entry) => entry.time.startsWith(day))
    .map((entry) => entry.dryBulbTemp)
    .filter((value): value is number => typeof value === "number");

  if (!values.length) {
    return null;
  }

  return Math.max(...values) - Math.min(...values);
}

function getMonthFromDateTime(dateTime: string | undefined) {
  const month = Number.parseInt(dateTime?.slice(5, 7) ?? "", 10);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : CLTD_REFERENCE_MONTH;
}

function buildSyntheticAshraeDatetime(year: number, hottestMonth: number | null | undefined) {
  const month = Math.min(12, Math.max(1, Number.isFinite(hottestMonth ?? NaN) ? Number(hottestMonth) : 7));
  const paddedMonth = String(month).padStart(2, "0");
  return `${year}-${paddedMonth}-21T15:00`;
}

function monthLabel(month: number | null | undefined) {
  const index = Math.min(12, Math.max(1, Number.isFinite(month ?? NaN) ? Number(month) : 7)) - 1;
  return MONTH_LABELS[index] ?? "July";
}

function fieldIsComplete(value: string | undefined) {
  return Boolean(value?.trim());
}

function completionPercent(items: boolean[]) {
  if (!items.length) {
    return 0;
  }

  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

function getSetupCompletion(values: FormValues, source: DesignConditionSource) {
  const walls = ["North", "East", "South", "West"];
  const wallChecks = walls.flatMap((wall) => [
    isManualSelectComplete(values, `wall${wall}Direction`, values[`wall${wall}Direction`]),
    fieldIsComplete(values[`wall${wall}Length`]),
    fieldIsComplete(values[`wall${wall}Height`]),
    isManualSelectComplete(values, `wall${wall}Boundary`, values[`wall${wall}Boundary`]),
  ]);
  const openingChecks = ["window", "door"].flatMap((owner) =>
    walls.flatMap((wall) => {
      const fieldPrefix = `${owner}${wall}`;
      const openingFields = [
        values[`${fieldPrefix}Direction`],
        values[`${fieldPrefix}Width`],
        values[`${fieldPrefix}Height`],
        values[`${fieldPrefix}Boundary`],
      ];
      const openingIsInUse = openingFields.some(fieldIsComplete);

      if (!openingIsInUse) {
        return [];
      }

      return [
        isManualSelectComplete(values, `${fieldPrefix}Direction`, values[`${fieldPrefix}Direction`]),
        fieldIsComplete(values[`${fieldPrefix}Width`]),
        fieldIsComplete(values[`${fieldPrefix}Height`]),
        isManualSelectComplete(values, `${fieldPrefix}Boundary`, values[`${fieldPrefix}Boundary`]),
      ];
    }),
  );
  const outdoorTypeIsComplete = isManualSelectComplete(values, "conditionType", values.conditionType);
  const indoorTypeIsComplete = isManualSelectComplete(values, "indoorConditionType", values.indoorConditionType);
  const designYearCheck =
    source === "current" ? [isManualSelectComplete(values, "designYear", values.designYear)] : [];

  return completionPercent([
    isManualSelectComplete(values, "selectedCountry", values.selectedCountry),
    isManualSelectComplete(values, "selectedCity", values.selectedCity),
    fieldIsComplete(source),
    fieldIsComplete(values.dryBulbTemp),
    isManualSelectComplete(values, "dryBulbPercentile", values.dryBulbPercentile),
    ...designYearCheck,
    outdoorTypeIsComplete,
    outdoorTypeIsComplete && fieldIsComplete(values.conditionValue),
    fieldIsComplete(values.insideCondition),
    indoorTypeIsComplete,
    indoorTypeIsComplete && fieldIsComplete(values.indoorConditionValue),
    ...wallChecks,
    ...openingChecks,
  ]);
}

async function resolveSelectedLocation(input: {
  country: string;
  city: string;
  countryCode?: string;
}) {
  const locationParams = new URLSearchParams({
    name: input.city,
    country: input.country,
    count: "1",
    onlyCities: "true",
  });

  if (input.countryCode) {
    locationParams.set("countryCode", input.countryCode);
  }

  const locationPayload = await fetchCachedJson<{
    results?: SolarLocationOption[];
    error?: string;
  }>(`/api/solar-locations?${locationParams.toString()}`, undefined, {
    cacheKey: `solar-locations:${locationParams.toString()}`,
    ttlMs: 24 * 60 * 60 * 1000,
  });

  const resolved = locationPayload.results?.[0];
  if (!resolved) {
    throw new Error("No location match found for selected city.");
  }

  return {
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    timezone: resolved.timezone ?? "UTC",
  } satisfies ResolvedSolarLocation;
}

async function fetchTemperatureHistoryForLocation(location: ResolvedSolarLocation, year: number) {
  const historyParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    year: String(year),
    timezone: location.timezone,
  });

  return fetchCachedJson<TemperatureHistoryResponse & { error?: string }>(
    `/api/temperature-history?${historyParams.toString()}`,
    undefined,
    {
      cacheKey: `temperature-history:${historyParams.toString()}`,
      ttlMs: 24 * 60 * 60 * 1000,
    },
  );
}

async function fetchSolarDetailsForLocation(location: ResolvedSolarLocation, datetime: string) {
  const solarDetailsParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: location.timezone,
    datetime,
    mode: "auto",
  });

  return fetchCachedJson<SolarDetailsResponse & { error?: string }>(
    `/api/solar-details?${solarDetailsParams.toString()}`,
    undefined,
    {
      cacheKey: `solar-details:${solarDetailsParams.toString()}`,
      ttlMs: 24 * 60 * 60 * 1000,
    },
  );
}

export function HeatLoadFormPanel({
  formValues,
  sheetValues,
  onFieldChange,
  onSheetChange,
}: Props) {
  const [surfaceType, setSurfaceType] = useState<SurfaceType>("walls");
  const unitSystem = normalizeUnitSystem(formValues.unitSystem);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [designTempLoading, setDesignTempLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [designTempError, setDesignTempError] = useState<string | null>(null);
  const [activeSetupTab, setActiveSetupTab] = useState<SetupTabKey>("location");
  const [collapsedSections, setCollapsedSections] = useState<Record<FormSectionKey, boolean>>({
    setup: true,
  });

  const previousOutdoorConditionType = useRef(formValues.conditionType);
  const previousIndoorConditionType = useRef(formValues.indoorConditionType);
  const previousLocationKey = useRef("");

  const designConditionSource = getDesignConditionSource(formValues.designConditionSource);
  const currentOutdoorDesignCache = parseOutdoorDesignCache(formValues.currentOutdoorDesignData);
  const ashraeOutdoorDesignCache = parseOutdoorDesignCache(formValues.ashraeOutdoorDesignData);
  const activeOutdoorDesignCache =
    designConditionSource === "ashrae-2017"
      ? ashraeOutdoorDesignCache
      : designConditionSource === "current"
        ? currentOutdoorDesignCache
        : null;
  const designConditionSourceSummary =
    !designConditionSource
      ? "Select a design condition source to populate outdoor design conditions and drive CLTD and SHGF context."
      : designConditionSource === "current"
      ? currentOutdoorDesignCache?.year
        ? `${currentOutdoorDesignCache.label || "NASA/Open-Meteo Weather"} historical source. Annual ${currentOutdoorDesignCache.percentile}% dry-bulb selection from ${currentOutdoorDesignCache.year}; selected month ${monthLabel(currentOutdoorDesignCache.hottestMonth)} drives CLTD and SHGF.`
        : "NASA/Open-Meteo weather source uses the annual hourly dry-bulb percentile; the selected hour's month drives CLTD and SHGF."
      : ashraeOutdoorDesignCache?.stationName
        ? `ASHRAE station source. ${ashraeOutdoorDesignCache.stationName}${ashraeOutdoorDesignCache.stationWmo ? ` (${ashraeOutdoorDesignCache.stationWmo})` : ""}${ashraeOutdoorDesignCache.stationLocation ? ` | ${ashraeOutdoorDesignCache.stationLocation}` : ""}${ashraeOutdoorDesignCache.stationSourceEdition ? ` | ASHRAE ${ashraeOutdoorDesignCache.stationSourceEdition}` : ""}${typeof ashraeOutdoorDesignCache.hottestMonth === "number" ? ` | design month ${ashraeOutdoorDesignCache.hottestMonth} linked to CLTD and SHGF` : ""}${typeof ashraeOutdoorDesignCache.latitude === "number" ? ` | station latitude ${ashraeOutdoorDesignCache.latitude.toFixed(2)} deg` : ""}${typeof ashraeOutdoorDesignCache.stationDistanceKm === "number" ? ` | ${ashraeOutdoorDesignCache.stationDistanceKm.toFixed(1)} km from selected city` : ""}.`
        : "ASHRAE annual station design conditions link the station hottest month and latitude to CLTD correction and Section 2 SHGF.";
  const setupCompletion = getSetupCompletion(formValues, designConditionSource);

  const updateFieldIfChanged = (name: string, value: string) => {
    if ((formValues[name] ?? "") !== value) {
      onFieldChange(name, value);
    }
  };

  const markLinkedManualSheetSelections = (name: string, value: string) => {
    linkedManualSheetSelectFields[name]?.forEach((sheetKey) => {
      onSheetChange(manualSelectMarkerKey(sheetKey), manualSelectMarkerValue(value));
    });
  };

  const handleManualSelectFieldChange = (name: string, value: string) => {
    onFieldChange(name, value);
    onFieldChange(manualSelectMarkerKey(name), manualSelectMarkerValue(value));
    markLinkedManualSheetSelections(name, value);
  };

  const toggleSection = (section: FormSectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const clearOutdoorFields = () => {
    updateFieldIfChanged("outsideCondition", "");
    updateFieldIfChanged("dryBulbTemp", "");
    updateFieldIfChanged("wetBulbTemp", "");
    updateFieldIfChanged("conditionValue", "");
    updateFieldIfChanged("solarDni", "");
    updateFieldIfChanged("solarDhi", "");
    updateFieldIfChanged("solarGhi", "");
    updateFieldIfChanged("solarZenith", "");
    updateFieldIfChanged("solarAzimuth", "");
  };

  const applyOutdoorDesignCache = (cache: OutdoorDesignCache | null) => {
    if (!cache) {
      clearOutdoorFields();
      return;
    }

    const currentType = formValues.conditionType ?? "";
    const conditionValue =
      currentType === "Wet bulb temperature"
        ? cache.wetBulbTemp
        : currentType === "Relative Humidity"
          ? cache.relativeHumidity
          : "";

    updateFieldIfChanged("dryBulbTemp", cache.dryBulbTemp);
    updateFieldIfChanged("outsideCondition", cache.dryBulbTemp);
    updateFieldIfChanged("wetBulbTemp", cache.wetBulbTemp);
    if (conditionValue) {
      updateFieldIfChanged("conditionValue", conditionValue);
    }
    updateFieldIfChanged("solarDni", cache.solarDni);
    updateFieldIfChanged("solarDhi", cache.solarDhi);
    updateFieldIfChanged("solarGhi", cache.solarGhi);
    updateFieldIfChanged("solarZenith", cache.solarZenith);
    updateFieldIfChanged("solarAzimuth", cache.solarAzimuth);
  };

  // Countries are loaded once and then persisted into form state.
  useEffect(() => {
    async function loadCountries() {
      setCountryLoading(true);
      setLocationError(null);
      try {
        const payload = await fetchCachedJson<{ results?: CountryOption[]; error?: string }>(
          "/api/solar-countries",
          undefined,
          { cacheKey: "solar-countries", ttlMs: 24 * 60 * 60 * 1000 },
        );

        const countries = payload.results ?? [];
        setCountryOptions(countries);

        if (!countries.length) {
          onFieldChange("selectedCountry", "");
          onFieldChange("selectedCountryCode", "");
          return;
        }

        const selected = formValues.selectedCountry;
        const matched = selected ? countries.find((item) => item.name === selected) : undefined;

        if (!matched) {
          onFieldChange("selectedCountry", "");
          onFieldChange("selectedCountryCode", "");
          return;
        }

        onFieldChange("selectedCountryCode", matched.iso2 ?? "");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load countries.";
        setLocationError(message);
      } finally {
        setCountryLoading(false);
      }
    }

    void loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The city list is keyed only by the selected country.
  useEffect(() => {
    async function loadCities() {
      const country = formValues.selectedCountry?.trim();
      if (!country) {
        setCityOptions([]);
        return;
      }

      setCityLoading(true);
      setLocationError(null);
      try {
        const payload = await fetchCachedJson<{ results?: string[]; error?: string }>(
          `/api/solar-country-cities?country=${encodeURIComponent(country)}`,
          undefined,
          { cacheKey: `solar-country-cities:${country}`, ttlMs: 24 * 60 * 60 * 1000 },
        );

        const cities = payload.results ?? [];
        setCityOptions(cities);

        if (!cities.length) {
          onFieldChange("selectedCity", "");
          return;
        }

        const selected = formValues.selectedCity;
        if (selected && !cities.includes(selected)) {
          onFieldChange("selectedCity", "");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load cities.";
        setLocationError(message);
        setCityOptions([]);
      } finally {
        setCityLoading(false);
      }
    }

    void loadCities();
  }, [formValues.selectedCountry]);

  function handleCountryChange(nextCountry: string) {
    handleManualSelectFieldChange("selectedCountry", nextCountry);
    const matched = countryOptions.find((item) => item.name === nextCountry);
    onFieldChange("selectedCountryCode", matched?.iso2 ?? "");
    onFieldChange("selectedCity", "");
    onFieldChange(manualSelectMarkerKey("selectedCity"), "");
  }

  function handleUnitSystemChange(nextUnitSystem: UnitSystem) {
    if (nextUnitSystem !== unitSystem) {
      onFieldChange("unitSystem", nextUnitSystem);
    }
  }

  function handleDesignConditionSourceChange(nextSource: DesignConditionSource) {
    if (nextSource !== designConditionSource) {
      onFieldChange("designConditionSource", nextSource);
    }
  }

  // Location changes invalidate both cached sources and the projected active values.
  useEffect(() => {
    const nextLocationKey = [
      formValues.selectedCountry ?? "",
      formValues.selectedCountryCode ?? "",
      formValues.selectedCity ?? "",
    ].join("|");

    if (!previousLocationKey.current) {
      previousLocationKey.current = nextLocationKey;
      return;
    }

    if (previousLocationKey.current === nextLocationKey) {
      return;
    }

    previousLocationKey.current = nextLocationKey;

    updateFieldIfChanged("currentOutdoorDesignData", "");
    updateFieldIfChanged("ashraeOutdoorDesignData", "");
    clearOutdoorFields();
  }, [formValues.selectedCountry, formValues.selectedCountryCode, formValues.selectedCity]);

  useEffect(() => {
    if (!formValues.dryBulbPercentile) {
      return;
    }

    if (
      designConditionSource === "current" &&
      !CURRENT_SUPPORTED_PERCENTILES.includes(formValues.dryBulbPercentile as (typeof CURRENT_SUPPORTED_PERCENTILES)[number])
    ) {
      onFieldChange("dryBulbPercentile", "");
      return;
    }

    if (
      designConditionSource === "ashrae-2017" &&
      !ASHRAE_SUPPORTED_PERCENTILES.includes(formValues.dryBulbPercentile as (typeof ASHRAE_SUPPORTED_PERCENTILES)[number])
    ) {
      onFieldChange("dryBulbPercentile", "");
    }
  }, [designConditionSource, formValues.dryBulbPercentile, onFieldChange]);

  useEffect(() => {
    applyOutdoorDesignCache(activeOutdoorDesignCache);
  }, [
    designConditionSource,
    formValues.currentOutdoorDesignData,
    formValues.ashraeOutdoorDesignData,
    formValues.conditionType,
  ]);

  useEffect(() => {
    async function updateCurrentDesignConditions() {
      const country = formValues.selectedCountry?.trim();
      const city = formValues.selectedCity?.trim();
      const designPercentile = formValues.dryBulbPercentile || DEFAULT_DESIGN_PERCENTILE;

      if (!country || !city || designConditionSource !== "current") {
        return;
      }

      setDesignTempLoading(true);
      setDesignTempError(null);

      try {
        const resolvedLocation = await resolveSelectedLocation({
          country,
          city,
          countryCode: formValues.selectedCountryCode,
        });

        const latestCompleteYear = new Date().getUTCFullYear() - 1;
        const selectedYear = Number.parseInt(formValues.designYear ?? "", 10);
        const year = Number.isInteger(selectedYear) ? selectedYear : latestCompleteYear;

        const historyPayload = await fetchTemperatureHistoryForLocation(resolvedLocation, year);
        const hourlyDryBulb = historyPayload.hourlyDryBulb ?? [];
        const dryBulbSeries = hourlyDryBulb
          .map((entry) => entry.dryBulbTemp)
          .filter((value): value is number => typeof value === "number");

        if (!dryBulbSeries.length) {
          throw new Error("No annual hourly dry-bulb values were returned for the selected city.");
        }

        const selectedPercent = Number(designPercentile);
        const dryBulb = computePercentile(dryBulbSeries, 100 - selectedPercent);
        const designHour = findNearestDesignHour(hourlyDryBulb, dryBulb);
        const designMonth = getMonthFromDateTime(designHour?.time);

        let relativeHumidityText = formatOptionalConditionValue(designHour?.relativeHumidity);
        let wetBulbText = "";
        let solarSnapshot = emptySolarSnapshot();

        if (designHour?.relativeHumidity !== null && designHour?.relativeHumidity !== undefined) {
          wetBulbText = formatOptionalConditionValue(
            calculateWetBulbFromRelativeHumidity(dryBulb, designHour.relativeHumidity),
          );
        }

        if (designHour) {
          try {
            const solarDetailsPayload = await fetchSolarDetailsForLocation(
              resolvedLocation,
              designHour.time,
            );
            solarSnapshot = buildSolarSnapshot(solarDetailsPayload);

            const relativeHumidity = solarDetailsPayload.ambient?.relativeHumidity;
            const wetBulb =
              typeof relativeHumidity === "number"
                ? calculateWetBulbFromRelativeHumidity(dryBulb, relativeHumidity)
                : solarDetailsPayload.ambient?.wetBulbTemp;

            if (typeof relativeHumidity === "number") {
              relativeHumidityText = formatOptionalConditionValue(relativeHumidity);
            }
            if (typeof wetBulb === "number") {
              wetBulbText = formatOptionalConditionValue(wetBulb);
            }
          } catch {
            solarSnapshot = emptySolarSnapshot();
          }
        }

        const cache: OutdoorDesignCache = {
          source: "current",
          label: `NASA/Open-Meteo ${monthLabel(designMonth)}`,
          dryBulbTemp: formatConditionValue(dryBulb),
          wetBulbTemp: wetBulbText,
          relativeHumidity: relativeHumidityText,
          solarDni: solarSnapshot.solarDni,
          solarDhi: solarSnapshot.solarDhi,
          solarGhi: solarSnapshot.solarGhi,
          solarZenith: solarSnapshot.solarZenith,
          solarAzimuth: solarSnapshot.solarAzimuth,
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
          percentile: designPercentile,
          year: String(year),
          stationSourceEdition: historyPayload.source,
          standardPressureKPa: 101.325,
          meanCoincidentWindSpeed: null,
          hottestMonth: designMonth,
          hottestMonthDryBulbRange: getDailyDryBulbRange(hourlyDryBulb, designHour?.time),
          designHour: getHourFromDateTime(designHour?.time),
        };

        const serializedCache = JSON.stringify(cache);
        updateFieldIfChanged("currentOutdoorDesignData", serializedCache);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to auto-fill current design conditions.";
        setDesignTempError(message);
      } finally {
        setDesignTempLoading(false);
      }
    }

    void updateCurrentDesignConditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    designConditionSource,
    formValues.selectedCountry,
    formValues.selectedCountryCode,
    formValues.selectedCity,
    formValues.dryBulbPercentile,
    formValues.designYear,
  ]);

  useEffect(() => {
    async function updateAshraeDesignConditions() {
      const country = formValues.selectedCountry?.trim();
      const city = formValues.selectedCity?.trim();
      const designPercentile = formValues.dryBulbPercentile || DEFAULT_DESIGN_PERCENTILE;

      if (!country || !city || designConditionSource !== "ashrae-2017") {
        return;
      }

      if (
        !ASHRAE_SUPPORTED_PERCENTILES.includes(designPercentile as (typeof ASHRAE_SUPPORTED_PERCENTILES)[number])
      ) {
        return;
      }

      setDesignTempLoading(true);
      setDesignTempError(null);

      try {
        const resolvedLocation = await resolveSelectedLocation({
          country,
          city,
          countryCode: formValues.selectedCountryCode,
        });

        const ashraeParams = new URLSearchParams({
          latitude: String(resolvedLocation.latitude),
          longitude: String(resolvedLocation.longitude),
          country,
          percentile: designPercentile,
        });

        const ashraePayload = await fetchCachedJson<AshraeDesignConditionsResponse & { error?: string }>(
          `/api/ashrae-design-conditions?${ashraeParams.toString()}`,
          undefined,
          {
            cacheKey: `ashrae-annual-station-design-conditions-v3:${ashraeParams.toString()}`,
            ttlMs: 24 * 60 * 60 * 1000,
          },
        );

        const latestCompleteYear = new Date().getUTCFullYear() - 1;
        let solarSnapshot = emptySolarSnapshot();

        const ashraeDateTime = buildSyntheticAshraeDatetime(
          latestCompleteYear,
          ashraePayload.cooling.hottestMonth,
        );

        try {
          const solarDetailsPayload = await fetchSolarDetailsForLocation(
            resolvedLocation,
            ashraeDateTime,
          );
          solarSnapshot = buildSolarSnapshot(solarDetailsPayload);
        } catch {
          solarSnapshot = emptySolarSnapshot();
        }

        const cache: OutdoorDesignCache = {
          source: "ashrae-2017",
          label: `ASHRAE ${ashraePayload.station.sourceEdition} Station Data`,
          dryBulbTemp: formatConditionValue(ashraePayload.cooling.dryBulbTemp),
          wetBulbTemp: formatConditionValue(ashraePayload.cooling.meanCoincidentWetBulb),
          relativeHumidity: formatOptionalConditionValue(ashraePayload.cooling.relativeHumidity),
          solarDni: solarSnapshot.solarDni,
          solarDhi: solarSnapshot.solarDhi,
          solarGhi: solarSnapshot.solarGhi,
          solarZenith: solarSnapshot.solarZenith,
          solarAzimuth: solarSnapshot.solarAzimuth,
          latitude: ashraePayload.station.latitude,
          longitude: ashraePayload.station.longitude,
          percentile: ashraePayload.percentile,
          stationName: ashraePayload.station.name,
          stationWmo: ashraePayload.station.wmo,
          stationLocation: ashraePayload.station.locationLabel,
          stationCountry: ashraePayload.station.countryLabel,
          stationSourceEdition: ashraePayload.station.sourceEdition,
          stationDistanceKm: ashraePayload.distanceKm,
          standardPressureKPa: ashraePayload.station.standardPressureKPa,
          meanCoincidentWindSpeed: ashraePayload.cooling.meanCoincidentWindSpeed,
          hottestMonth: ashraePayload.cooling.hottestMonth,
          hottestMonthDryBulbRange: ashraePayload.cooling.hottestMonthDryBulbRange,
          designHour: getHourFromDateTime(ashraeDateTime),
          matchedByCountry: ashraePayload.matchedByCountry,
        };

        const serializedCache = JSON.stringify(cache);
        updateFieldIfChanged("ashraeOutdoorDesignData", serializedCache);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to auto-fill ASHRAE design conditions.";
        setDesignTempError(message);
      } finally {
        setDesignTempLoading(false);
      }
    }

    void updateAshraeDesignConditions();
  }, [
    designConditionSource,
    formValues.selectedCountry,
    formValues.selectedCountryCode,
    formValues.selectedCity,
    formValues.dryBulbPercentile,
  ]);

  useEffect(() => {
    const currentType = formValues.conditionType ?? "";
    const previousType = previousOutdoorConditionType.current;

    if (currentType === previousType) {
      return;
    }

    previousOutdoorConditionType.current = currentType;

    if (!currentType) {
      return;
    }

    if (activeOutdoorDesignCache) {
      return;
    }

    const dryBulb = parseConditionValue(formValues.dryBulbTemp);
    const currentValue = parseConditionValue(formValues.conditionValue);

    if (dryBulb === null || currentValue === null) {
      return;
    }

    const convertedValue =
      currentType === "Wet bulb temperature"
        ? calculateWetBulbFromRelativeHumidity(dryBulb, currentValue)
        : calculateRelativeHumidityFromWetBulb(dryBulb, currentValue);

    if (convertedValue === null) {
      return;
    }

    const formattedValue = formatConditionValue(convertedValue);

    if ((formValues.conditionValue ?? "") !== formattedValue) {
      onFieldChange("conditionValue", formattedValue);
    }
  }, [
    activeOutdoorDesignCache,
    formValues.conditionType,
    formValues.conditionValue,
    formValues.dryBulbTemp,
    onFieldChange,
  ]);

  useEffect(() => {
    const dryBulb = parseConditionValue(formValues.dryBulbTemp);
    const currentType = formValues.conditionType ?? "";
    const currentValue = parseConditionValue(formValues.conditionValue);

    if (!currentType) {
      return;
    }

    if (dryBulb === null || currentValue === null) {
      if ((formValues.wetBulbTemp ?? "") !== "") {
        onFieldChange("wetBulbTemp", "");
      }
      return;
    }

    const wetBulb =
      currentType === "Relative Humidity"
        ? calculateWetBulbFromRelativeHumidity(dryBulb, currentValue)
        : currentValue;

    if (wetBulb === null) {
      if ((formValues.wetBulbTemp ?? "") !== "") {
        onFieldChange("wetBulbTemp", "");
      }
      return;
    }

    const formattedWetBulb = formatConditionValue(wetBulb);

    if ((formValues.wetBulbTemp ?? "") !== formattedWetBulb) {
      onFieldChange("wetBulbTemp", formattedWetBulb);
    }
  }, [
    formValues.conditionType,
    formValues.conditionValue,
    formValues.dryBulbTemp,
    formValues.wetBulbTemp,
    onFieldChange,
  ]);

  useEffect(() => {
    const currentType = formValues.indoorConditionType ?? "";
    const previousType = previousIndoorConditionType.current;

    if (currentType === previousType) {
      return;
    }

    previousIndoorConditionType.current = currentType;

    if (!currentType) {
      return;
    }

    const dryBulb = parseConditionValue(formValues.insideCondition);
    const currentValue = parseConditionValue(formValues.indoorConditionValue);

    if (dryBulb === null || currentValue === null) {
      return;
    }

    const convertedValue =
      currentType === "Wet bulb temperature"
        ? calculateWetBulbFromRelativeHumidity(dryBulb, currentValue)
        : calculateRelativeHumidityFromWetBulb(dryBulb, currentValue);

    if (convertedValue === null) {
      return;
    }

    const formattedValue = formatConditionValue(convertedValue);

    if ((formValues.indoorConditionValue ?? "") !== formattedValue) {
      onFieldChange("indoorConditionValue", formattedValue);
    }
  }, [
    formValues.indoorConditionType,
    formValues.indoorConditionValue,
    formValues.insideCondition,
    onFieldChange,
  ]);

  useEffect(() => {
    const outside = Number.parseFloat(formValues.dryBulbTemp ?? "");
    const inside = Number.parseFloat(formValues.insideCondition ?? "");

    if (Number.isFinite(outside)) {
      const outsideFormatted = formatConditionValue(outside);
      if ((formValues.outsideCondition ?? "") !== outsideFormatted) {
        onFieldChange("outsideCondition", outsideFormatted);
      }
    }

    if (Number.isFinite(outside) && Number.isFinite(inside)) {
      const differenceFormatted = formatConditionValue(outside - inside);
      if ((formValues.conditionDifference ?? "") !== differenceFormatted) {
        onFieldChange("conditionDifference", differenceFormatted);
      }
    } else if ((formValues.conditionDifference ?? "") !== "") {
      onFieldChange("conditionDifference", "");
    }
  }, [
    formValues.dryBulbTemp,
    formValues.insideCondition,
    formValues.outsideCondition,
    formValues.conditionDifference,
    onFieldChange,
  ]);

  return (
    <aside className="min-h-0 overflow-hidden border-b border-slate-200 bg-slate-50 xl:border-r xl:border-b-0">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#be123c]">Heat Load Form</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Load Input Sheet</h2>
              <p className="mt-1 text-[11px] font-medium text-slate-600">
                Units: {unitLabel(unitSystem, "length")}, {unitLabel(unitSystem, "area")},{" "}
                {unitLabel(unitSystem, "temperature")}, {unitLabel(unitSystem, "heat")}
              </p>
            </div>

            <div className="inline-flex w-fit shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-semibold text-slate-900">
              <button
                type="button"
                onClick={() => handleUnitSystemChange("si")}
                className={`rounded px-2.5 py-1.5 transition ${
                  unitSystem === "si" ? "bg-white text-[#9f1239] shadow-sm" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                SI Unit
              </button>
              <button
                type="button"
                onClick={() => handleUnitSystemChange("imperial")}
                className={`rounded px-2.5 py-1.5 transition ${
                  unitSystem === "imperial"
                    ? "bg-[#be123c] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                IP Units
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-3 pb-3">
            <FormSectionCard
              number="1"
              title="Project Setup"
              description="Location, source, and design condition inputs grouped into one compact workflow."
              progress={setupCompletion}
              collapsed={collapsedSections.setup}
              onToggle={() => toggleSection("setup")}
            >
              <SetupTabs activeTab={activeSetupTab} onTabChange={setActiveSetupTab} />

              <div className="mt-3">
                <div
                  id="setup-tab-panel-location"
                  role="tabpanel"
                  aria-labelledby="setup-tab-location"
                  hidden={activeSetupTab !== "location"}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
                      Country
                      <select
                        value={formValues.selectedCountry}
                        onChange={(event) => handleCountryChange(event.target.value)}
                        disabled={countryLoading || countryOptions.length === 0}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-900 outline-none transition focus:border-[#be123c] focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">Select country</option>
                        {countryOptions.map((option) => (
                          <option key={option.name} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
                      City
                      <select
                        value={formValues.selectedCity}
                        onChange={(event) => handleManualSelectFieldChange("selectedCity", event.target.value)}
                        disabled={cityLoading || cityOptions.length === 0}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-900 outline-none transition focus:border-[#be123c] focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">Select city</option>
                        {cityOptions.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <StatusMessages
                    locationError={locationError}
                    designTempLoading={designTempLoading}
                    designTempError={designTempError}
                  />
                </div>

                <div
                  id="setup-tab-panel-source"
                  role="tabpanel"
                  aria-labelledby="setup-tab-source"
                  hidden={activeSetupTab !== "source"}
                >
                  <div className="grid gap-2 lg:grid-cols-2">
                    <SourceOption
                      label="NASA/Open-Meteo Weather"
                      description="Uses annual hourly weather data and selected dry-bulb percentile."
                      value="current"
                      checked={designConditionSource === "current"}
                      onChange={() => handleDesignConditionSourceChange("current")}
                    />
                    <SourceOption
                      label="ASHRAE Station Data"
                      description="Uses matched ASHRAE station design conditions and hottest-month metadata."
                      value="ashrae-2017"
                      checked={designConditionSource === "ashrae-2017"}
                      onChange={() => handleDesignConditionSourceChange("ashrae-2017")}
                    />
                  </div>
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] leading-snug text-slate-600">
                    {designConditionSourceSummary}
                  </div>
                </div>

                <div
                  id="setup-tab-panel-conditions"
                  role="tabpanel"
                  aria-labelledby="setup-tab-conditions"
                  hidden={activeSetupTab !== "conditions"}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] table-fixed border-collapse text-xs text-slate-900">
                      <colgroup>
                        <col style={{ width: "34%" }} />
                        <col style={{ width: "66%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Condition
                          </th>
                          <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Input
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {topSectionRows.map((rowIndex) => (
                          <tr key={rowIndex}>
                            <DesignConditionsRow
                              rowIndex={rowIndex}
                              values={formValues}
                              unitSystem={unitSystem}
                              designConditionSource={designConditionSource}
                              onFieldChange={onFieldChange}
                              onSelectChange={handleManualSelectFieldChange}
                            />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div
                  id="setup-tab-panel-roomDetails"
                  role="tabpanel"
                  aria-labelledby="setup-tab-roomDetails"
                  hidden={activeSetupTab !== "roomDetails"}
                >
                  <div className="mb-3 flex justify-start">
                    <RoomDetailsSurfaceTabs surfaceType={surfaceType} onSurfaceChange={setSurfaceType} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] table-fixed border-collapse text-xs text-slate-900">
                      <colgroup>
                        <col style={{ width: "32%" }} />
                        <col style={{ width: "68%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Direction
                          </th>
                          <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Size and Boundary
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {topSectionRows.map((rowIndex) => (
                          <tr key={rowIndex}>
                            <RoomDetailsRow
                              surfaceType={surfaceType}
                              rowIndex={rowIndex}
                              values={formValues}
                              unitSystem={unitSystem}
                              onFieldChange={onFieldChange}
                              onSelectFieldChange={handleManualSelectFieldChange}
                            />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </FormSectionCard>

            <HeatLoadSheet
              formValues={formValues}
              sheetValues={sheetValues}
              unitSystem={unitSystem}
              onSheetChange={onSheetChange}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function FormSectionCard({
  number,
  title,
  description,
  progress,
  action,
  compact = false,
  collapsed,
  onToggle,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  progress: number;
  action?: ReactNode;
  compact?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = `heat-load-form-section-${number}`;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.045)]">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-50 text-xs font-semibold text-[#be123c] ring-1 ring-rose-100">
            {number}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
            </div>
            {description ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{description}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action ? <div className={collapsed ? "hidden sm:block" : ""}>{action}</div> : null}
          <CompletionBadge percent={progress} />
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={contentId}
            onClick={onToggle}
            title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-[#be123c] focus:outline-none focus:ring-2 focus:ring-rose-100"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
            >
              <path
                d="M5.5 8 10 12.5 14.5 8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>
      </div>
      <div id={contentId} hidden={collapsed} className={compact ? "px-2 py-2" : "px-3 py-3"}>
        {children}
      </div>
    </section>
  );
}

const setupTabs: Array<{ key: SetupTabKey; label: string; eyebrow: string }> = [
  { key: "location", label: "Location", eyebrow: "Climate" },
  { key: "source", label: "Source", eyebrow: "Weather" },
  { key: "conditions", label: "Conditions", eyebrow: "Design" },
  { key: "roomDetails", label: "Room Details", eyebrow: "Envelope" },
];

function SetupTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: SetupTabKey;
  onTabChange: (tab: SetupTabKey) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Project setup sections">
      <div className="grid min-w-[640px] grid-cols-4 gap-1">
        {setupTabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`setup-tab-panel-${tab.key}`}
              id={`setup-tab-${tab.key}`}
              onClick={() => onTabChange(tab.key)}
              className={`rounded-md border px-2.5 py-2 text-left transition ${
                isActive
                  ? "border-[#be123c] bg-white text-slate-950 shadow-sm"
                  : "border-transparent text-slate-600 hover:bg-white hover:text-slate-950"
              }`}
            >
              <span className={`block text-[9px] font-semibold uppercase tracking-[0.14em] ${isActive ? "text-[#be123c]" : "text-slate-400"}`}>
                {tab.eyebrow}
              </span>
              <span className="mt-0.5 block text-xs font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SourceOption({
  label,
  description,
  value,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  value: DesignConditionSource;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition ${
        checked
          ? "border-[#be123c] bg-rose-50 shadow-[0_6px_16px_rgba(190,18,60,0.07)]"
          : "border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/40"
      }`}
    >
      <input
        type="radio"
        name="designConditionSource"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-3.5 w-3.5 border-slate-300 text-[#be123c] focus:ring-[#be123c]"
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{description}</span>
      </span>
    </label>
  );
}

function StatusMessages({
  locationError,
  designTempLoading,
  designTempError,
}: {
  locationError: string | null;
  designTempLoading: boolean;
  designTempError: string | null;
}) {
  if (!locationError && !designTempLoading && !designTempError) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1.5">
      {locationError ? <p className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">{locationError}</p> : null}
      {designTempLoading ? (
        <p className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">Updating design temperatures...</p>
      ) : null}
      {designTempError ? <p className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">{designTempError}</p> : null}
    </div>
  );
}
