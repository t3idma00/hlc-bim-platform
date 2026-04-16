import { NextRequest, NextResponse } from "next/server";

import { searchSolarLocations } from "@/lib/calculations/solar";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(50, Math.floor(parsed));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();
    const country = searchParams.get("country")?.trim() || undefined;
    const countryCode = searchParams.get("countryCode")?.trim() || undefined;
    const onlyCities = searchParams.get("onlyCities") === "true";
    const count = parsePositiveInt(searchParams.get("count"), 10);

    if (!name) {
      throw new Error("name query parameter is required.");
    }

    const results = await searchSolarLocations({
      name,
      country,
      countryCode,
      count,
      onlyCities,
    });

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve solar location.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
