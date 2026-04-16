import { NextResponse } from "next/server";

type CountryResult = {
  name: string;
  iso2?: string;
};

export async function GET() {
  try {
    const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
    if (!response.ok) {
      throw new Error(`Countries request failed (${response.status}).`);
    }

    const payload = (await response.json()) as Array<{ name?: { common?: string }; cca2?: string }>;
    const results: CountryResult[] = payload
      .map((item) => ({
        name: item.name?.common ?? "",
        iso2: item.cca2,
      }))
      .filter((item) => item.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load countries.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
