"use client";

import { useEffect, useRef, useState } from "react";
import { DesignConditionsHeader, DesignConditionsRow } from "./design-conditions-table";
import { HeatLoadSheet } from "./heat-load-sheet";
import { RoomDetailsHeader, RoomDetailsRow } from "./room-details-table";
import { fetchCachedJson } from "@/lib/client-fetch-cache";
import { calculateRelativeHumidityFromWetBulb, calculateWetBulbFromRelativeHumidity } from "@/lib/calculations";

type SurfaceType = "walls" | "windows" | "doors";
type UnitSystem = "si" | "imperial";

export type FormValues = Record<string, string>;

type CountryOption = {
  name: string;
  iso2?: string;
};

type SolarLocationOption = {
  latitude: number;
  longitude: number;
  timezone?: string;
};

type TemperatureHistoryResponse = {
  hourlyDryBulb?: Array<{
    time: string;
    dryBulbTemp: number | null;
  }>;
};

const topSectionRows = [0, 1, 2, 3];

export const initialFormValues: FormValues = {
  selectedCountry: "",
  selectedCountryCode: "",
  selectedCity: "",
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
  outsideCondition: "",
  dryBulbTemp: "",
  wetBulbTemp: "",
  dryBulbPercentile: "1",
  designYear: String(new Date().getUTCFullYear() - 1),
  insideCondition: "",
  conditionDifference: "",
  conditionType: "Relative Humidity",
  conditionValue: "",
  indoorConditionType: "Relative Humidity",
  indoorConditionValue: "",
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

function formatConditionValue(value: number): string {
  return value.toFixed(1);
}

function parseConditionValue(value: string): number | null {
  const parsedValue = Number.parseFloat(value ?? "");
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function HeatLoadFormPanel({
  formValues,
  sheetValues,
  onFieldChange,
  onSheetChange,
}: Props) {
  const [surfaceType, setSurfaceType] = useState<SurfaceType>("walls");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("si");
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [designTempLoading, setDesignTempLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [designTempError, setDesignTempError] = useState<string | null>(null);
  const previousOutdoorConditionType = useRef(formValues.conditionType);
  const previousIndoorConditionType = useRef(formValues.indoorConditionType);

  useEffect(() => {
    async function loadCountries() {
      setCountryLoading(true);
      setLocationError(null);
      try {
        const payload = await fetchCachedJson<{ results?: CountryOption[]; error?: string }>(
          "/api/solar-countries",
          undefined,
          { cacheKey: "solar-countries", ttlMs: 24 * 60 * 60 * 1000 }
        );

        const countries = payload.results ?? [];
        setCountryOptions(countries);

        if (!countries.length) {
          return;
        }

        const selected = formValues.selectedCountry;
        const nextCountry = selected && countries.some((item) => item.name === selected) ? selected : countries[0].name;
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
  }, []);

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
          { cacheKey: `solar-country-cities:${country}`, ttlMs: 24 * 60 * 60 * 1000 }
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

  useEffect(() => {
    async function updateDesignTemperatures() {
      const country = formValues.selectedCountry?.trim();
      const city = formValues.selectedCity?.trim();
      if (!country || !city) {
        return;
      }

      setDesignTempLoading(true);
      setDesignTempError(null);

      try {
        const locationParams = new URLSearchParams({
          name: city,
          country,
          count: "1",
          onlyCities: "true",
        });

        if (formValues.selectedCountryCode) {
          locationParams.set("countryCode", formValues.selectedCountryCode);
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

        const latestCompleteYear = new Date().getUTCFullYear() - 1;
        const selectedYear = Number.parseInt(formValues.designYear ?? "", 10);
        const year = Number.isInteger(selectedYear) ? selectedYear : latestCompleteYear;

        const historyParams = new URLSearchParams({
          latitude: String(resolved.latitude),
          longitude: String(resolved.longitude),
          year: String(year),
          timezone: resolved.timezone ?? "UTC",
        });

        const historyPayload = await fetchCachedJson<TemperatureHistoryResponse & { error?: string }>(
          `/api/temperature-history?${historyParams.toString()}`,
          undefined,
          {
            cacheKey: `temperature-history:${historyParams.toString()}`,
            ttlMs: 24 * 60 * 60 * 1000,
          }
        );

        const dryBulbSeries = (historyPayload.hourlyDryBulb ?? [])
          .map((entry) => entry.dryBulbTemp)
          .filter((value): value is number => typeof value === "number");

        if (!dryBulbSeries.length) {
          throw new Error("No dry-bulb values were returned for the selected city.");
        }

        const selectedPercent = Number(formValues.dryBulbPercentile || "1");
        // Cooling design style: 1% means the top hottest 1% hours, so use (100 - p) percentile.
        const dryBulb = computePercentile(dryBulbSeries, 100 - selectedPercent);
        onFieldChange("dryBulbTemp", formatConditionValue(dryBulb));
        onFieldChange("outsideCondition", formatConditionValue(dryBulb));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to auto-fill design temperatures.";
        setDesignTempError(message);
      } finally {
        setDesignTempLoading(false);
      }
    }

    void updateDesignTemperatures();
  }, [
    formValues.selectedCountry,
    formValues.selectedCountryCode,
    formValues.selectedCity,
    formValues.dryBulbPercentile,
    formValues.designYear,
    formValues.conditionType,
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
  }, [formValues.conditionType, formValues.conditionValue, formValues.dryBulbTemp, formValues.wetBulbTemp, onFieldChange]);

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
  }, [formValues.indoorConditionType, formValues.indoorConditionValue, formValues.insideCondition, onFieldChange]);

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
  }, [formValues.dryBulbTemp, formValues.insideCondition, formValues.outsideCondition, formValues.conditionDifference]);

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
                onClick={() => setUnitSystem("si")}
                className={`px-3 py-1.5 ${unitSystem === "si" ? "bg-[#fff4f7] text-[#9f1239]" : "bg-white text-slate-700"}`}
              >
                SI Unit
              </button>
              <button
                type="button"
                onClick={() => setUnitSystem("imperial")}
                className={`border-l border-rose-200 px-3 py-1.5 ${
                  unitSystem === "imperial" ? "bg-[#fff4f7] text-[#9f1239]" : "bg-white text-slate-700"
                }`}
              >
                IP Units
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          <div className="space-y-3">
            <div className="border border-rose-200 bg-white px-2 py-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9f1239]">Location Selection</p>
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
                  <DesignConditionsHeader />
                </tr>
                {topSectionRows.map((rowIndex) => (
                  <tr key={rowIndex}>
                    <RoomDetailsRow
                      surfaceType={surfaceType}
                      rowIndex={rowIndex}
                      values={formValues}
                      onFieldChange={onFieldChange}
                    />
                    <DesignConditionsRow 
                      rowIndex={rowIndex} 
                      values={formValues} 
                      onFieldChange={onFieldChange} 
                    />
                  </tr>
                ))}
              </tbody>
            </table>
            <HeatLoadSheet onFieldChange={onFieldChange} />
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