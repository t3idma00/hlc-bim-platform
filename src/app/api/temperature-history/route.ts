import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latitude = parseNumber(searchParams.get("latitude"), "latitude");
    const longitude = parseNumber(searchParams.get("longitude"), "longitude");
    const year = parseYear(searchParams.get("year"));
    const timezone = searchParams.get("timezone")?.trim() || "UTC";

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      timezone,
      start_date: startDate,
      end_date: endDate,
      hourly: "temperature_2m",
    });

    const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Open-Meteo temperature history request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      hourly?: {
        time?: string[];
        temperature_2m?: Array<number | null>;
      };
    };

    const hourly = payload.hourly;
    if (!hourly?.time?.length || !hourly.temperature_2m?.length) {
      throw new Error("Open-Meteo response does not contain hourly dry-bulb data.");
    }

    const expectedHours = isLeapYear(year) ? 8784 : 8760;
    const hourlyDryBulb = hourly.time.map((time, index) => ({
      time,
      dryBulbTemp: hourly.temperature_2m?.[index] ?? null,
    }));

    return NextResponse.json({
      location: {
        latitude,
        longitude,
        timezone,
      },
      year,
      expectedHours,
      actualHours: hourlyDryBulb.length,
      hourlyDryBulb,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load temperature history.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
