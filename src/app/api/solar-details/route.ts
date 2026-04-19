import { NextRequest, NextResponse } from "next/server";

import {
  calculateSHGF,
  chooseModeByDate,
  computeSolarPosition,
  fetchNasaPowerSolarIntensity,
  fetchOpenMeteoAmbientConditions,
  fetchOpenMeteoArchiveSolarIntensity,
  fetchOpenMeteoSolarIntensity,
  resolveSolarLocation,
  validateCityCoordinateMatch,
  type SolarMode,
} from "@/lib/calculations/solar";

// Request parsing helpers for query parameters.

function parseNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDateTime(value: string | null): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid datetime. Use ISO-8601 format.");
  }

  return parsed;
}

function parseRequestedMode(value: string | null): SolarMode | "auto" {
  if (!value || value === "auto") {
    return "auto";
  }

  if (value === "live" || value === "historical") {
    return value;
  }

  throw new Error("Invalid mode. Use auto, live, or historical.");
}

// Main API handler for solar details.
export async function GET(request: NextRequest) {
  try {
    // 1) Read incoming query params.
    const { searchParams } = new URL(request.url);

    const latitude = parseNumber(searchParams.get("latitude"));
    const longitude = parseNumber(searchParams.get("longitude"));
    const city = searchParams.get("city") ?? undefined;
    const country = searchParams.get("country") ?? undefined;
    const timezone = searchParams.get("timezone") ?? undefined;

    const targetDateTime = parseDateTime(searchParams.get("datetime"));
    const requestedMode = parseRequestedMode(searchParams.get("mode"));
    const mode = requestedMode === "auto" ? chooseModeByDate(targetDateTime) : requestedMode;

    const surfaceTilt = parseNumber(searchParams.get("surfaceTilt"));
    const surfaceAzimuth = parseNumber(searchParams.get("surfaceAzimuth"));
    const albedo = parseNumber(searchParams.get("albedo"));

    // 2) Resolve location and pull solar data from providers.
    const location = await resolveSolarLocation({
      latitude,
      longitude,
      city,
      country,
      timezone,
    });

    let intensity =
      mode === "historical"
        ? await fetchNasaPowerSolarIntensity(location, targetDateTime)
        : await fetchOpenMeteoSolarIntensity(location, targetDateTime);

    const alerts: string[] = [];

    let cityCoordinateMatch: {
      matched: boolean;
      distanceKm: number | null;
      referenceCity?: string;
      referenceCountry?: string;
    } | null = null;

    if (city && latitude !== undefined && longitude !== undefined) {
      try {
        const match = await validateCityCoordinateMatch({
          city,
          country,
          latitude,
          longitude,
          thresholdKm: 5,
        });

        cityCoordinateMatch = {
          matched: match.matched,
          distanceKm: match.distanceKm,
          referenceCity: match.reference?.name,
          referenceCountry: match.reference?.country,
        };

        if (!match.matched) {
          alerts.push("Solar data is not available for your selected city with the current coordinates.");
        }
      } catch {
        alerts.push("Unable to verify selected city against coordinates.");
      }
    }

  // 3) Fallback to archive when NASA returns fully missing values.
    if (mode === "historical" && intensity.missingVariables.length === 3) {
      try {
        intensity = await fetchOpenMeteoArchiveSolarIntensity(location, targetDateTime);
        alerts.push("NASA POWER returned missing values; using Open-Meteo archive fallback.");
      } catch {
        alerts.push("NASA POWER returned missing values and archive fallback was unavailable.");
      }
    }

    let ambient = {
      dryBulbTemp: null as number | null,
      relativeHumidity: null as number | null,
      wetBulbTemp: null as number | null,
      source: null as "open-meteo" | "open-meteo-archive" | null,
      missingVariables: [] as string[],
    };

    // 4) Fetch ambient weather data for the same datetime and location.
    try {
      const ambientData = await fetchOpenMeteoAmbientConditions(location, targetDateTime);
      ambient = {
        dryBulbTemp: ambientData.dryBulbTemp,
        relativeHumidity: ambientData.relativeHumidity,
        wetBulbTemp: ambientData.wetBulbTemp,
        source: ambientData.source,
        missingVariables: ambientData.missingVariables,
      };

      if (ambientData.missingVariables.length > 0) {
        alerts.push(`Missing ambient variables: ${ambientData.missingVariables.join(", ")}.`);
      }
    } catch {
      alerts.push("Ambient weather data was unavailable for this selection.");
    }

    // 5) Compute position and SHGF based on fetched values.
    const solarPosition = computeSolarPosition(targetDateTime, location.latitude, location.longitude);
    const shgf = calculateSHGF({
      dni: intensity.dni,
      dhi: intensity.dhi,
      ghi: intensity.ghi,
      zenith: solarPosition.zenith,
      azimuth: solarPosition.azimuth,
      surfaceTilt,
      surfaceAzimuth,
      albedo,
    });

    if (intensity.missingVariables.length > 0) {
      alerts.push(`Missing solar variables: ${intensity.missingVariables.join(", ")}.`);
    }

    const noSolarData = !intensity.availability.ghi && !intensity.availability.dni && !intensity.availability.dhi;
    if (noSolarData) {
      alerts.push("Solar data is not available for your selected city.");
    }

    // 6) Return normalized response shape for frontend use.
    return NextResponse.json({
      mode,
      targetDateTime: targetDateTime.toISOString(),
      location,
      solarPosition,
      solarIntensity: intensity,
      ambient,
      cityCoordinateMatch,
      shgf,
      alerts,
    });
  } catch (error) {
    // Keep error response consistent for easier client handling.
    const message = error instanceof Error ? error.message : "Solar details request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
