import { NextResponse } from "next/server";

type CountryResult = {
  name: string;
  iso2?: string;
};

export async function GET() {
  try {
    // RestCountries v3.1 was deprecated; use countriesnow.space (same provider
    // as the city endpoint) which returns { error, msg, data: [{ name, Iso2, Iso3 }] }.
    const response = await fetch("https://countriesnow.space/api/v0.1/countries/iso");
    if (!response.ok) {
      throw new Error(`Countries request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      error?: boolean;
      msg?: string;
      data?: Array<{ name?: string; Iso2?: string; Iso3?: string }>;
    };

    if (payload.error || !Array.isArray(payload.data)) {
      throw new Error(payload.msg ?? "Failed to load countries.");
    }

    const results: CountryResult[] = payload.data
      .map((item) => ({
        name: item.name ?? "",
        iso2: item.Iso2,
      }))
      .filter((item) => item.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load countries.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
