import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country")?.trim();

    if (!country) {
      throw new Error("country query parameter is required.");
    }

    const response = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ country }),
    });

    if (!response.ok) {
      throw new Error(`Country cities request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      error?: boolean;
      msg?: string;
      data?: string[];
    };

    if (payload.error) {
      throw new Error(payload.msg ?? "Failed to load city list.");
    }

    const results = (payload.data ?? []).slice().sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load cities by country.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
