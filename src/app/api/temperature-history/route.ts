import { NextRequest, NextResponse } from "next/server";

type HourlyDesignRow = {
  time: string;
  dryBulbTemp: number | null;
  relativeHumidity: number | null;
};

function parseNumber(value: string | null, name: string): number {
  if (!value || value.trim() === "") {
    throw new Error(`${name} query parameter is required.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsed;
}

function parseYear(value: string | null): number {
  if (!value || value.trim() === "") {
    return new Date().getUTCFullYear();
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    throw new Error("year must be an integer between 1900 and 2100.");
  }

  return parsed;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year: number, month: number, day: number): string {
  return [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMeasurement(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > -900 ? parsed : null;
}

function nasaKeyToLocalTime(key: string, timezone: string) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(4, 6));
  const day = Number(key.slice(6, 8));
  const hour = Number(key.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day, hour));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  const localHour = part("hour") === "24" ? "00" : part("hour");

  return `${part("year")}-${part("month")}-${part("day")}T${localHour}:00`;
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, {
        cache: "force-cache",
        next: { revalidate: 24 * 60 * 60 },
      });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(350 * attempt);
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "network request failed";
  throw new Error(detail);
}

async function fetchDryBulbRange(input: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  timezone: string;
}) {
  const params = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    timezone: input.timezone,
    start_date: input.startDate,
    end_date: input.endDate,
    hourly: "temperature_2m,relative_humidity_2m",
  });

  let response: Response;
  try {
    response = await fetchWithRetry(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network request failed";
    throw new Error(`Open-Meteo temperature request failed for ${input.startDate} to ${input.endDate}: ${detail}.`);
  }

  if (!response.ok) {
    throw new Error(`Open-Meteo temperature request failed for ${input.startDate} to ${input.endDate} (${response.status}).`);
  }

  const payload = (await response.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      relative_humidity_2m?: Array<number | null>;
    };
  };

  const hourly = payload.hourly;
  if (!hourly?.time?.length || !hourly.temperature_2m?.length) {
    throw new Error(`Open-Meteo response is missing hourly dry-bulb data for ${input.startDate} to ${input.endDate}.`);
  }

  return hourly.time.map((time, index) => ({
    time,
    dryBulbTemp: hourly.temperature_2m?.[index] ?? null,
    relativeHumidity: hourly.relative_humidity_2m?.[index] ?? null,
  })) satisfies HourlyDesignRow[];
}

async function fetchMonthlyDryBulb(input: {
  latitude: number;
  longitude: number;
  year: number;
  month: number;
  timezone: string;
}) {
  const startDate = formatDate(input.year, input.month, 1);
  const endDate = formatDate(input.year, input.month, daysInMonth(input.year, input.month));

  try {
    return await fetchDryBulbRange({
      latitude: input.latitude,
      longitude: input.longitude,
      startDate,
      endDate,
      timezone: input.timezone,
    });
  } catch (monthlyError) {
    const rows = [];
    let cursor = new Date(Date.UTC(input.year, input.month - 1, 1));
    const monthEnd = new Date(Date.UTC(input.year, input.month - 1, daysInMonth(input.year, input.month)));

    while (cursor <= monthEnd) {
      const periodStart = dateToIso(cursor);
      const periodEndDate = new Date(Math.min(addDays(cursor, 6).getTime(), monthEnd.getTime()));
      const periodEnd = dateToIso(periodEndDate);
      rows.push(
        ...(await fetchDryBulbRange({
          latitude: input.latitude,
          longitude: input.longitude,
          startDate: periodStart,
          endDate: periodEnd,
          timezone: input.timezone,
        })),
      );
      cursor = addDays(periodEndDate, 1);
    }

    if (!rows.length) {
      throw monthlyError;
    }

    return rows;
  }
}

async function fetchNasaPowerAnnualWeather(input: {
  latitude: number;
  longitude: number;
  year: number;
  timezone: string;
}) {
  const params = new URLSearchParams({
    parameters: "T2M,RH2M",
    community: "RE",
    longitude: String(input.longitude),
    latitude: String(input.latitude),
    start: `${input.year}0101`,
    end: `${input.year}1231`,
    format: "JSON",
    "time-standard": "UTC",
  });

  let response: Response;
  try {
    response = await fetchWithRetry(`https://power.larc.nasa.gov/api/temporal/hourly/point?${params.toString()}`, 2);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network request failed";
    throw new Error(`NASA POWER annual weather fallback failed: ${detail}.`);
  }

  if (!response.ok) {
    throw new Error(`NASA POWER annual weather fallback failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    properties?: {
      parameter?: {
        T2M?: Record<string, number | string | null>;
        RH2M?: Record<string, number | string | null>;
      };
    };
  };
  const parameters = payload.properties?.parameter;
  const dryBulb = parameters?.T2M ?? {};
  const relativeHumidity = parameters?.RH2M ?? {};

  return Object.keys(dryBulb)
    .sort()
    .map((key) => ({
      time: nasaKeyToLocalTime(key, input.timezone),
      dryBulbTemp: parseMeasurement(dryBulb[key]),
      relativeHumidity: parseMeasurement(relativeHumidity[key]),
    })) satisfies HourlyDesignRow[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latitude = parseNumber(searchParams.get("latitude"), "latitude");
    const longitude = parseNumber(searchParams.get("longitude"), "longitude");
    const year = parseYear(searchParams.get("year"));
    const timezone = searchParams.get("timezone")?.trim() || "UTC";

    const expectedHours = isLeapYear(year) ? 8784 : 8760;
    let hourlyRows: HourlyDesignRow[] = [];
    let source = "nasa-power";
    let fallbackReason = "";

    try {
      hourlyRows = await fetchNasaPowerAnnualWeather({
        latitude,
        longitude,
        year,
        timezone,
      });
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : "NASA POWER annual weather request failed.";
      source = "open-meteo-archive";
      for (let month = 1; month <= 12; month += 1) {
        hourlyRows.push(
          ...(await fetchMonthlyDryBulb({
            latitude,
            longitude,
            year,
            month,
            timezone,
          })),
        );
      }
    }

    if (!hourlyRows.length) {
      throw new Error("No annual hourly dry-bulb data was returned.");
    }

    return NextResponse.json({
      location: {
        latitude,
        longitude,
        timezone,
      },
      year,
      expectedHours,
      actualHours: hourlyRows.length,
      source,
      fallbackReason,
      hourlyDryBulb: hourlyRows,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    const message = detail === "fetch failed"
      ? "Open-Meteo temperature history is currently unavailable. Check internet access and try again."
      : detail;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
