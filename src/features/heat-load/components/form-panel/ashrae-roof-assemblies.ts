import { formatSource, matchesText } from "./ashrae-calculations/common";
import type { FactorResult } from "./ashrae-calculations/types";

type RoofCeilingMode = "with" | "without";

type RoofLayer = {
  label: string;
  resistanceM2KPerW?: number;
  conductivityWPerMK?: number;
  thicknessMm?: number;
  reference: string;
};

type RoofAssembly = {
  label: string;
  aliases: string[];
  defaultThicknessMm: number;
  coreLayer: RoofLayer;
  ceilingLayers: RoofLayer[];
  roofNumberByCeilingMode: Record<RoofCeilingMode, string>;
  table31BasisByCeilingMode: Record<RoofCeilingMode, string>;
  auditNote: string;
};

const CH24_TABLES_SOURCE =
  "ASHRAE 1997 Fundamentals Handbook (SI), Ch24 Tables 1, 3, and 4";
const CH28_TABLE31_SOURCE =
  "ASHRAE 1997 Fundamentals Handbook (SI), Ch28 Table 31, p.28.42";

const outsideRoofFilm: RoofLayer = {
  label: "Outside roof surface film",
  resistanceM2KPerW: 0.059,
  reference: "Ch28 Table 30 note",
};

const insideRoofFilm: RoofLayer = {
  label: "Inside roof surface film",
  resistanceM2KPerW: 0.121,
  reference: "Ch28 Table 30 note",
};

const suspendedCeilingLayers: RoofLayer[] = [
  {
    label: "20 mm nonreflective ceiling air space",
    resistanceM2KPerW: 0.15,
    reference: "Ch24 Table 3",
  },
  {
    label: "12.7 mm gypsum/plaster ceiling board",
    resistanceM2KPerW: 0.079,
    reference: "Ch24 Table 4",
  },
];

const roofAssemblies: RoofAssembly[] = [
  {
    label: "Concrete Slab Roof",
    aliases: ["Concrete"],
    defaultThicknessMm: 150,
    coreLayer: {
      label: "Dense concrete roof slab",
      conductivityWPerMK: 2.9,
      reference: "Ch24 Table 4 sand/gravel or stone aggregate concrete",
    },
    ceilingLayers: suspendedCeilingLayers,
    roofNumberByCeilingMode: {
      with: "3",
      without: "2",
    },
    table31BasisByCeilingMode: {
      with: "C12 heavy concrete roof, mass evenly placed, R 0 to 0.9, with suspended ceiling",
      without: "C12 heavy concrete roof, mass evenly placed, R 0 to 0.9, without suspended ceiling",
    },
    auditNote:
      "Concrete slab is treated as a massive flat roof; the row thickness is the concrete core thickness.",
  },
  {
    label: "Clay Roof",
    aliases: ["Clay", "Clay tile"],
    defaultThicknessMm: 25,
    coreLayer: {
      label: "Clay tile / fired clay roof covering",
      conductivityWPerMK: 0.98,
      reference: "Ch24 Table 4 fired clay masonry, conservative conductivity used for tile",
    },
    ceilingLayers: suspendedCeilingLayers,
    roofNumberByCeilingMode: {
      with: "1",
      without: "1",
    },
    table31BasisByCeilingMode: {
      with: "Lightweight roof surrogate from Table 31 low-R A3/attic-ceiling class, with ceiling",
      without: "Lightweight roof surrogate from Table 31 low-R B7/A3/attic-ceiling class, without ceiling",
    },
    auditNote:
      "Clay tile roofs are represented as lightweight roof construction unless project-specific deck, attic, and insulation data are supplied.",
  },
  {
    label: "Asbestos Roof",
    aliases: ["Asbestos", "Asbestos sheet"],
    defaultThicknessMm: 6,
    coreLayer: {
      label: "Corrugated asbestos-cement roof sheet",
      conductivityWPerMK: 0.58,
      reference: "Representative asbestos-cement sheet conductivity; replace with product data where available",
    },
    ceilingLayers: suspendedCeilingLayers,
    roofNumberByCeilingMode: {
      with: "1",
      without: "1",
    },
    table31BasisByCeilingMode: {
      with: "Lightweight A3 steel-deck surrogate from Table 31, R 0 to 0.9, with suspended ceiling",
      without: "Lightweight A3 steel-deck surrogate from Table 31, R 0 to 0.9, without suspended ceiling",
    },
    auditNote:
      "Asbestos sheet roofs are represented as lightweight sheet construction; manufacturer U-values should replace this where available.",
  },
];

export const roofAssemblyLabels = roofAssemblies.map((assembly) => assembly.label);
export const roofDetailOptions = ["With suspended ceiling", "Without suspended ceiling"];

export function getRoofAssembly(type: string | undefined | null) {
  return roofAssemblies.find((assembly) =>
    assembly.label === type ||
    assembly.aliases.some((alias) => matchesText(type, alias)),
  ) ?? null;
}

export function getDefaultRoofThicknessMm(type: string | undefined | null) {
  return getRoofAssembly(type)?.defaultThicknessMm ?? 150;
}

export function normalizeRoofDetail(detail: string | undefined | null) {
  return detail?.toLowerCase().includes("without ceiling")
    ? roofDetailOptions[1]
    : roofDetailOptions[0];
}

export function getRoofCeilingMode(detail: string | undefined | null): RoofCeilingMode {
  return normalizeRoofDetail(detail) === roofDetailOptions[1] ? "without" : "with";
}

export function resolveRoofCltdMapping(type: string, detail?: string) {
  const assembly = getRoofAssembly(type);

  if (!assembly) {
    return null;
  }

  const ceilingMode = getRoofCeilingMode(detail);

  return {
    roofNumber: assembly.roofNumberByCeilingMode[ceilingMode],
    basis: `${assembly.table31BasisByCeilingMode[ceilingMode]}. ${assembly.auditNote}`,
    table: "Table 30",
  };
}

export function resolveRoofAssemblyUFactor(
  type: string,
  detail: string | undefined,
  thicknessMm: number,
  source: string,
): FactorResult | null {
  const assembly = getRoofAssembly(type);

  if (!assembly) {
    return null;
  }

  const ceilingMode = getRoofCeilingMode(detail);
  const coreThicknessMm = thicknessMm > 0 ? thicknessMm : assembly.defaultThicknessMm;
  const coreLayer = { ...assembly.coreLayer, thicknessMm: coreThicknessMm };
  const layers = [
    outsideRoofFilm,
    coreLayer,
    ...(ceilingMode === "with" ? assembly.ceilingLayers : []),
    insideRoofFilm,
  ];
  const totalResistance = layers.reduce((sum, layer) => sum + layerResistance(layer), 0);

  if (!Number.isFinite(totalResistance) || totalResistance <= 0) {
    return null;
  }

  const value = 1 / totalResistance;
  const materialText = layers
    .map((layer) => {
      const thicknessText = layer.thicknessMm ? ` ${layer.thicknessMm} mm` : "";
      return `${layer.label}${thicknessText}`;
    })
    .join(" + ");

  return {
    value,
    source: formatSource(
      source === "Current application lookup data" ? CH24_TABLES_SOURCE : `${source}; ${CH24_TABLES_SOURCE}`,
      `${assembly.label} U = 1 / Rtotal = ${value.toFixed(3)} W/m2K. Rtotal ${totalResistance.toFixed(3)} m2K/W from ${materialText}. ${assembly.auditNote}`,
    ),
  };
}

export function getRoofAssemblyReference(type: string, detail?: string) {
  const assembly = getRoofAssembly(type);
  const mapping = resolveRoofCltdMapping(type, detail);

  if (!assembly || !mapping) {
    return "ASHRAE 1997 Chapter 28 Table 30 roof CLTD and Chapter 24 material U-factor basis";
  }

  return [
    `${CH28_TABLE31_SOURCE}: ${mapping.basis}`,
    "Ch28 Table 30 gives hourly roof CLTD by selected roof number",
    `${CH24_TABLES_SOURCE}: U-factor is calculated from the listed representative layers`,
  ].join("; ");
}

function layerResistance(layer: RoofLayer) {
  if (typeof layer.resistanceM2KPerW === "number") {
    return layer.resistanceM2KPerW;
  }
  if (typeof layer.conductivityWPerMK === "number" && layer.conductivityWPerMK > 0) {
    return (layer.thicknessMm ?? 0) / 1000 / layer.conductivityWPerMK;
  }

  return Number.NaN;
}
