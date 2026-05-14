"use client";

import { useEffect, useRef, useState } from "react";

import { fetchCachedJson } from "@/lib/client-fetch-cache";
import { calculateRelativeHumidityFromWetBulb, calculateWetBulbFromRelativeHumidity } from "@/lib/calculations";
import { normalizeUnitSystem, unitLabel, type UnitSystem } from "@/lib/units";

import { DesignConditionsHeader, DesignConditionsRow } from "./design-conditions-table";
import { HeatLoadSheet } from "./heat-load-sheet";
import { RoomDetailsHeader, RoomDetailsRow } from "./room-details-table";

type SurfaceType = "walls" | "windows" | "doors";
type DesignConditionSource = "current" | "ashrae-2017";

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
  hourlyDryBulb?: Array<{
    time: string;
    dryBulbTemp: number | null;
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
  percentile: string;
  year?: string;
  stationName?: string;
  stationWmo?: string;
  stationLocation?: string;
  stationCountry?: string;
  stationSourceEdition?: string;
  stationDistanceKm?: number;
  hottestMonth?: number | null;
  matchedByCountry?: boolean;
};

const topSectionRows = [0, 1, 2, 3];
const ASHRAE_SUPPORTED_PERCENTILES = ["0.4", "1", "2"] as const;

export const initialFormValues: FormValues = {
  selectedCountry: "",
  selectedCountryCode: "",
  selectedCity: "",
  unitSystem: "si",
  wallNorthDirection: "North",
  wallNorthLength: "",
  wallNorthWidth: "",
  wallNorthHeight: "3",
  wallNorthType: "Brick Wall",
  wallEastDirection: "East",
  wallEastLength: "",
  wallEastWidth: "",
  wallEastHeight: "3",
  wallEastType: "Cement block Wall",
  wallSouthDirection: "South",
  wallSouthLength: "",
  wallSouthWidth: "",
  wallSouthHeight: "3",
  wallSouthType: "Cement block Wall",
  wallWestDirection: "West",
  wallWestLength: "",
  wallWestWidth: "",
  wallWestHeight: "3",
  wallWestType: "Cement block Wall",
  windowNorthDirection: "North",
  windowNorthLength: "",
  windowNorthWidth: "",
  windowNorthHeight: "",
  windowEastDirection: "East",
  windowEastLength: "",
  windowEastWidth: "",
  windowEastHeight: "",
  windowSouthDirection: "South",
  windowSouthLength: "",
  windowSouthWidth: "",
  windowSouthHeight: "",
  windowWestDirection: "West",
  windowWestLength: "",
  windowWestWidth: "",
  windowWestHeight: "",
  doorNorthDirection: "North",
  doorNorthLength: "",
  doorNorthWidth: "",
  doorNorthHeight: "",
  doorEastDirection: "East",
  doorEastLength: "",
  doorEastWidth: "",
  doorEastHeight: "",
  doorSouthDirection: "South",
  doorSouthLength: "",
  doorSouthWidth: "",
  doorSouthHeight: "",
  doorWestDirection: "West",
  doorWestLength: "",
  doorWestWidth: "",
  doorWestHeight: "",
  roofType: "Concrete Slab Roof",
  roofThickness: "150",
  outsideCondition: "",
  dryBulbTemp: "",
  wetBulbTemp: "",
  dryBulbPercentile: "1",
  designYear: String(new Date().getUTCFullYear() - 1),
  designConditionSource: "current",
  currentOutdoorDesignData: "",
  ashraeOutdoorDesignData: "",
  insideCondition: "",
  conditionDifference: "",
  conditionType: "Relative Humidity",
  conditionValue: "",
  indoorConditionType: "Relative Humidity",
  indoorConditionValue: "",
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
  entries: Array<{ time: string; dryBulbTemp: number | null }>,
  targetDryBulb: number,
) {
  const candidates = entries.filter(
    (entry): entry is { time: string; dryBulbTemp: number } => typeof entry.dryBulbTemp === "number",
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
  return value === "ashrae-2017" || value === "ashrae-2005" ? "ashrae-2017" : "current";
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
      hottestMonth:
        typeof parsed.hottestMonth === "number" && Number.isFinite(parsed.hottestMonth)
          ? parsed.hottestMonth
          : undefined,
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

function buildSyntheticAshraeDatetime(year: number, hottestMonth: number | null | undefined) {
  const month = Math.min(12, Math.max(1, Number.isFinite(hottestMonth ?? NaN) ? Number(hottestMonth) : 7));
  const paddedMonth = String(month).padStart(2, "0");
  return `${year}-${paddedMonth}-21T15:00`;
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

  const previousOutdoorConditionType = useRef(formValues.conditionType);
  const previousIndoorConditionType = useRef(formValues.indoorConditionType);
  const previousLocationKey = useRef("");

  const designConditionSource = getDesignConditionSource(formValues.designConditionSource);
  const currentOutdoorDesignCache = parseOutdoorDesignCache(formValues.currentOutdoorDesignData);
  const ashraeOutdoorDesignCache = parseOutdoorDesignCache(formValues.ashraeOutdoorDesignData);
  const activeOutdoorDesignCache =
    designConditionSource === "ashrae-2017" ? ashraeOutdoorDesignCache : currentOutdoorDesignCache;
  const designConditionSourceSummary =
    designConditionSource === "current"
      ? currentOutdoorDesignCache?.year
        ? `Current historical data source. Cached percentile ${currentOutdoorDesignCache.percentile}% for year ${currentOutdoorDesignCache.year}.`
        : "Current historical data source using the existing Open-Meteo percentile workflow."
      : ashraeOutdoorDesignCache?.stationName
        ? `ASHRAE station source. ${ashraeOutdoorDesignCache.stationName}${ashraeOutdoorDesignCache.stationWmo ? ` (${ashraeOutdoorDesignCache.stationWmo})` : ""}${ashraeOutdoorDesignCache.stationLocation ? ` | ${ashraeOutdoorDesignCache.stationLocation}` : ""}${ashraeOutdoorDesignCache.stationSourceEdition ? ` | ASHRAE ${ashraeOutdoorDesignCache.stationSourceEdition}` : ""}${typeof ashraeOutdoorDesignCache.stationDistanceKm === "number" ? ` | ${ashraeOutdoorDesignCache.stationDistanceKm.toFixed(1)} km from selected city` : ""}.`
        : "ASHRAE station source using the bundled global lookup with Sri Lanka 2025 overrides.";

  const updateFieldIfChanged = (name: string, value: string) => {
    if ((formValues[name] ?? "") !== value) {
      onFieldChange(name, value);
    }
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
      return;
    }

    const currentType = formValues.conditionType ?? "Relative Humidity";
    const conditionValue =
      currentType === "Wet bulb temperature" ? cache.wetBulbTemp : cache.relativeHumidity;

    updateFieldIfChanged("dryBulbTemp", cache.dryBulbTemp);
    updateFieldIfChanged("outsideCondition", cache.dryBulbTemp);
    updateFieldIfChanged("wetBulbTemp", cache.wetBulbTemp);
    updateFieldIfChanged("conditionValue", conditionValue);
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
          return;
        }

        const selected = formValues.selectedCountry;
        const nextCountry =
          selected && countries.some((item) => item.name === selected)
            ? selected
            : countries[0].name;
        const matched = countries.find((item) => item.name === nextCountry);

        if (formValues.selectedCountry !== nextCountry) {
          onFieldChange("selectedCountry", nextCountry);
        }
        onFieldChange("selectedCountryCode", matched?.iso2 ?? "");
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
        if (!selected || !cities.includes(selected)) {
          onFieldChange("selectedCity", cities[0]);
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
    onFieldChange("selectedCountry", nextCountry);
    const matched = countryOptions.find((item) => item.name === nextCountry);
    onFieldChange("selectedCountryCode", matched?.iso2 ?? "");
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
    if (
      designConditionSource === "ashrae-2017" &&
      !ASHRAE_SUPPORTED_PERCENTILES.includes(formValues.dryBulbPercentile as (typeof ASHRAE_SUPPORTED_PERCENTILES)[number])
    ) {
      onFieldChange("dryBulbPercentile", "1");
    }
  }, [designConditionSource, formValues.dryBulbPercentile, onFieldChange]);

  useEffect(() => {
    applyOutdoorDesignCache(activeOutdoorDesignCache);
  }, [designConditionSource, formValues.currentOutdoorDesignData, formValues.ashraeOutdoorDesignData]);

  useEffect(() => {
    async function updateCurrentDesignConditions() {
      const country = formValues.selectedCountry?.trim();
      const city = formValues.selectedCity?.trim();
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
          throw new Error("No dry-bulb values were returned for the selected city.");
        }

        const selectedPercent = Number(formValues.dryBulbPercentile || "1");
        const dryBulb = computePercentile(dryBulbSeries, 100 - selectedPercent);
        const designHour = findNearestDesignHour(hourlyDryBulb, dryBulb);

        let relativeHumidityText = "";
        let wetBulbText = "";
        let solarSnapshot = emptySolarSnapshot();

        if (designHour) {
          const solarDetailsPayload = await fetchSolarDetailsForLocation(
            resolvedLocation,
            designHour.time,
          );
          solarSnapshot = buildSolarSnapshot(solarDetailsPayload);

          const relativeHumidity = solarDetailsPayload.ambient?.relativeHumidity;
          const wetBulb = solarDetailsPayload.ambient?.wetBulbTemp;

          relativeHumidityText = formatOptionalConditionValue(relativeHumidity);
          wetBulbText =
            formatOptionalConditionValue(wetBulb) ||
            formatOptionalConditionValue(
              typeof relativeHumidity === "number"
                ? calculateWetBulbFromRelativeHumidity(dryBulb, relativeHumidity)
                : null,
            );
        }

        const cache: OutdoorDesignCache = {
          source: "current",
          label: "Current",
          dryBulbTemp: formatConditionValue(dryBulb),
          wetBulbTemp: wetBulbText,
          relativeHumidity: relativeHumidityText,
          solarDni: solarSnapshot.solarDni,
          solarDhi: solarSnapshot.solarDhi,
          solarGhi: solarSnapshot.solarGhi,
          solarZenith: solarSnapshot.solarZenith,
          solarAzimuth: solarSnapshot.solarAzimuth,
          percentile: formValues.dryBulbPercentile,
          year: String(year),
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
      if (!country || !city || designConditionSource !== "ashrae-2017") {
        return;
      }

      if (
        !ASHRAE_SUPPORTED_PERCENTILES.includes(formValues.dryBulbPercentile as (typeof ASHRAE_SUPPORTED_PERCENTILES)[number])
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
          percentile: formValues.dryBulbPercentile,
        });

        const ashraePayload = await fetchCachedJson<AshraeDesignConditionsResponse & { error?: string }>(
          `/api/ashrae-design-conditions?${ashraeParams.toString()}`,
          undefined,
          {
            cacheKey: `ashrae-design-conditions:${ashraeParams.toString()}`,
            ttlMs: 24 * 60 * 60 * 1000,
          },
        );

        const latestCompleteYear = new Date().getUTCFullYear() - 1;
        let solarSnapshot = emptySolarSnapshot();

        try {
          const solarDetailsPayload = await fetchSolarDetailsForLocation(
            resolvedLocation,
            buildSyntheticAshraeDatetime(latestCompleteYear, ashraePayload.cooling.hottestMonth),
          );
          solarSnapshot = buildSolarSnapshot(solarDetailsPayload);
        } catch {
          solarSnapshot = emptySolarSnapshot();
        }

        const cache: OutdoorDesignCache = {
          source: "ashrae-2017",
          label: "ASHRAE Station Data",
          dryBulbTemp: formatConditionValue(ashraePayload.cooling.dryBulbTemp),
          wetBulbTemp: formatConditionValue(ashraePayload.cooling.meanCoincidentWetBulb),
          relativeHumidity: formatOptionalConditionValue(ashraePayload.cooling.relativeHumidity),
          solarDni: solarSnapshot.solarDni,
          solarDhi: solarSnapshot.solarDhi,
          solarGhi: solarSnapshot.solarGhi,
          solarZenith: solarSnapshot.solarZenith,
          solarAzimuth: solarSnapshot.solarAzimuth,
          percentile: ashraePayload.percentile,
          stationName: ashraePayload.station.name,
          stationWmo: ashraePayload.station.wmo,
          stationLocation: ashraePayload.station.locationLabel,
          stationCountry: ashraePayload.station.countryLabel,
          stationSourceEdition: ashraePayload.station.sourceEdition,
          stationDistanceKm: ashraePayload.distanceKm,
          hottestMonth: ashraePayload.cooling.hottestMonth,
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
    const currentType = formValues.conditionType ?? "Relative Humidity";
    const previousType = previousOutdoorConditionType.current;

    if (currentType === previousType) {
      return;
    }

    previousOutdoorConditionType.current = currentType;

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
  }, [formValues.conditionType, formValues.conditionValue, formValues.dryBulbTemp, onFieldChange]);

  useEffect(() => {
    const dryBulb = parseConditionValue(formValues.dryBulbTemp);
    const currentType = formValues.conditionType ?? "Relative Humidity";
    const currentValue = parseConditionValue(formValues.conditionValue);

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
    const currentType = formValues.indoorConditionType ?? "Relative Humidity";
    const previousType = previousIndoorConditionType.current;

    if (currentType === previousType) {
      return;
    }

    previousIndoorConditionType.current = currentType;

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
    <aside className="min-h-0 overflow-hidden border-b border-rose-100 bg-[#fff8fa] xl:border-r xl:border-b-0">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-rose-100 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#be123c]">Heat Load Form</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Load Input Sheet</h2>
            </div>
            <div className="inline-flex overflow-hidden border border-rose-200 bg-white text-[10px] font-semibold text-slate-900">
              <button
                type="button"
                onClick={() => handleUnitSystemChange("si")}
                className={`px-3 py-1.5 ${unitSystem === "si" ? "bg-[#fff4f7] text-[#9f1239]" : "bg-white text-slate-700"}`}
              >
                SI Unit
              </button>
              <button
                type="button"
                onClick={() => handleUnitSystemChange("imperial")}
                className={`border-l border-rose-200 px-3 py-1.5 ${
                  unitSystem === "imperial" ? "bg-[#fff4f7] text-[#9f1239]" : "bg-white text-slate-700"
                }`}
              >
                IP Units
              </button>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-slate-600">
            Units: {unitLabel(unitSystem, "length")}, {unitLabel(unitSystem, "area")}, {unitLabel(unitSystem, "temperature")}, {unitLabel(unitSystem, "heat")}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          <div className="space-y-3">
            <div className="border border-rose-200 bg-white px-2 py-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9f1239]">
                Location Selection
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-[10px] font-semibold text-slate-700">
                  Country
                  <select
                    value={formValues.selectedCountry}
                    onChange={(event) => handleCountryChange(event.target.value)}
                    disabled={countryLoading || countryOptions.length === 0}
                    className="h-7 border border-rose-200 bg-white px-2 text-[10px] font-medium text-slate-900"
                  >
                    {countryOptions.map((option) => (
                      <option key={option.name} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[10px] font-semibold text-slate-700">
                  City
                  <select
                    value={formValues.selectedCity}
                    onChange={(event) => onFieldChange("selectedCity", event.target.value)}
                    disabled={cityLoading || cityOptions.length === 0}
                    className="h-7 border border-rose-200 bg-white px-2 text-[10px] font-medium text-slate-900"
                  >
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {locationError ? <p className="mt-2 text-[10px] text-rose-700">{locationError}</p> : null}
              {designTempLoading ? <p className="mt-2 text-[10px] text-slate-600">Updating design temperatures...</p> : null}
              {designTempError ? <p className="mt-2 text-[10px] text-rose-700">{designTempError}</p> : null}
            </div>

            <div className="border border-rose-200 bg-white px-2 py-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9f1239]">
                Design Condition Source
              </p>
              <div className="flex flex-wrap gap-4 text-[10px] font-semibold text-slate-800">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="designConditionSource"
                    value="current"
                    checked={designConditionSource === "current"}
                    onChange={() => handleDesignConditionSourceChange("current")}
                    className="h-3.5 w-3.5 border-rose-300 text-[#9f1239]"
                  />
                  Current
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="designConditionSource"
                    value="ashrae-2017"
                    checked={designConditionSource === "ashrae-2017"}
                    onChange={() => handleDesignConditionSourceChange("ashrae-2017")}
                    className="h-3.5 w-3.5 border-rose-300 text-[#9f1239]"
                  />
                  ASHRAE Station Data
                </label>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">{designConditionSourceSummary}</p>
            </div>

            <table className="w-full table-fixed border-collapse text-[10px] leading-none text-slate-900">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <RoomDetailsHeader surfaceType={surfaceType} onSurfaceChange={setSurfaceType} />
                  <DesignConditionsHeader
                    sourceSummary={designConditionSourceSummary}
                  />
                </tr>
                {topSectionRows.map((rowIndex) => (
                  <tr key={rowIndex}>
                    <RoomDetailsRow
                      surfaceType={surfaceType}
                      rowIndex={rowIndex}
                      values={formValues}
                      unitSystem={unitSystem}
                      onFieldChange={onFieldChange}
                    />
                    <DesignConditionsRow
                      rowIndex={rowIndex}
                      values={formValues}
                      unitSystem={unitSystem}
                      designConditionSource={designConditionSource}
                      onFieldChange={onFieldChange}
                    />
                  </tr>
                ))}
              </tbody>
            </table>

            <HeatLoadSheet
              formValues={formValues}
              sheetValues={sheetValues}
              unitSystem={unitSystem}
              onSheetChange={onSheetChange}
            />
          </div>
        </div>

        <div className="border-t border-rose-100 px-1 py-2">
          <div className="flex justify-end">
            <button className="border border-rose-200 bg-[#9f1239] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#881337]">
              Calculate Heat Load
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
