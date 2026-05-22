import materialData from "../ashrae-tables/wall-materials-table4-1997.json";
import { getAshrae1997WallArchetype } from "../ashrae-wall-assemblies";

import { formatSource } from "./common";
import type { FactorResult } from "./types";

const TABLE_1_REFERENCE = "ASHRAE 1997 Fundamentals Handbook (SI), Ch24 Table 1, p.24.2";
const TABLE_4_REFERENCE = "ASHRAE 1997 Fundamentals Handbook (SI), Ch24 Table 4, pp.24.4-24.7";

type Material = {
  id: string;
  label: string;
  fixedResistanceM2KPerW?: number;
  conductivityWPerMK?: number;
  reference: string;
};

type Layer = {
  materialId: string;
  thicknessMm?: number;
};

type ArchetypePath = {
  fraction: number;
  layers: Layer[];
};

const materials = materialData.materials as Material[];
const surfaces = materialData.surfaceResistancesM2KPerW;

function getMaterial(layer: Layer) {
  return materials.find((material) => material.id === layer.materialId) ?? null;
}

function layerResistance(layer: Layer) {
  const material = getMaterial(layer);

  if (!material) {
    return Number.NaN;
  }
  if (typeof material.fixedResistanceM2KPerW === "number") {
    return material.fixedResistanceM2KPerW;
  }
  if (typeof material.conductivityWPerMK === "number" && material.conductivityWPerMK > 0) {
    return (layer.thicknessMm ?? 0) / 1000 / material.conductivityWPerMK;
  }

  return Number.NaN;
}

function totalLayerResistance(layers: Layer[]) {
  return layers.reduce((sum, layer) => sum + layerResistance(layer), 0);
}

function surfaceResistance() {
  return surfaces.outsideSummer + surfaces.insideVertical;
}

function seriesUFactor(layers: Layer[]) {
  const resistance = surfaceResistance() + totalLayerResistance(layers);
  return resistance > 0 ? 1 / resistance : Number.NaN;
}

function parallelPathUFactor(paths: ArchetypePath[]) {
  return paths.reduce((uFactor, path) => uFactor + path.fraction * seriesUFactor(path.layers), 0);
}

function archetypeUFactor(type: string) {
  const archetype = getAshrae1997WallArchetype(type);

  if (!archetype || archetype.scope !== "opaque-wall") {
    return null;
  }

  if (archetype.method === "series-layers") {
    return seriesUFactor(archetype.layers ?? []);
  }
  if (archetype.method === "parallel-paths") {
    return parallelPathUFactor(archetype.paths ?? []);
  }
  if (archetype.method === "fixed-resistance") {
    const resistance = surfaceResistance() + (archetype.fixedResistanceWithoutSurfacesM2KPerW ?? 0);
    return resistance > 0 ? 1 / resistance : Number.NaN;
  }

  return null;
}

function archetypeMaterials(type: string) {
  const archetype = getAshrae1997WallArchetype(type);
  const layers = archetype?.paths?.flatMap((path) => path.layers) ?? archetype?.layers ?? [];
  const labels = layers.map((layer) => getMaterial(layer)?.label).filter(Boolean);

  return Array.from(new Set(labels)).join(", ");
}

export function resolveAshrae1997WallUFactor(type: string): FactorResult | null {
  const archetype = getAshrae1997WallArchetype(type);
  const value = archetypeUFactor(type);

  if (!archetype || value === null || !Number.isFinite(value)) {
    return null;
  }

  const method =
    archetype.method === "parallel-paths"
      ? "parallel-path U-factor"
      : archetype.method === "fixed-resistance"
        ? "example assembly resistance plus surfaces"
        : "series layer resistance";
  const materialSummary = archetypeMaterials(type);
  const materialsText = materialSummary ? ` Materials: ${materialSummary}.` : "";

  return {
    value,
    source: formatSource(
      `${TABLE_1_REFERENCE}; ${TABLE_4_REFERENCE}`,
      `${archetype.id} ${method}. ${archetype.uFactorBasis}${materialsText} ${archetype.auditNote}`,
    ),
  };
}
