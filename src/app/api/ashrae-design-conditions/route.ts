import { NextRequest, NextResponse } from "next/server";

import {
  getAshraeDesignConditions,
  type AshraePercentile,
} from "@/lib/calculations/ashrae-design-conditions";

function parseRequiredNumber(value: string | null, name: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} query parameter must be a valid number.`);
  }
  return parsed;
}

function parsePercentile(value: string | null): AshraePercentile {
  if (value === "0.4" || value === "1" || value === "2") {
    return value;
  }
  return "1";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseRequiredNumber(searchParams.get("latitude"), "latitude");
    const longitude = parseRequiredNumber(searchParams.get("longitude"), "longitude");
    const percentile = parsePercentile(searchParams.get("percentile"));
    const countryLabel = searchParams.get("country")?.trim() || undefined;

    const result = getAshraeDesignConditions({
      latitude,
      longitude,
      percentile,
      countryLabel,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve ASHRAE design conditions.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
