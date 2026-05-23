import references from "../ashrae-tables/references.json";
import { defaultWallThicknessMmForType, normalizeWallThicknessMm } from "../heat-load-wall-thickness";
import { getWallTypeFamily } from "../ashrae-wall-assemblies";
import { resolveRoofAssemblyUFactor } from "../ashrae-roof-assemblies";
import section1Data from "../section-1-data.json";

import {
  ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
  ASHRAE_TABLE5_FENESTRATION_SOURCE,
  findAshraeTable5Record,
  lookupAshraeTable5VerticalUFactor,
  normalizeAshraeTable5FrameLabel,
  normalizeAshraeTable5GlazingLabel,
} from "./fenestration-u-table5";
import { formatSource, getNum, matchesText } from "./common";
import { resolveBaseCltd } from "./cltd";
import type { FactorResult } from "./types";
import { resolveAshrae1989WallUFactor } from "./wall-cltd-1989";
import { resolveAshrae1997WallUFactor } from "./wall-u-1997";

const CURRENT_SOURCE = "Current application lookup data";
const DEFAULT_GLASS_FRAME = ASHRAE_TABLE5_DEFAULT_FRAME_LABEL;

function wallMaterialKey(type: string) {
  type = getWallTypeFamily(type);
  if (type.includes("Brick")) return "brick_wall_CLTD_C";
  if (type.includes("Cement")) return "cement_block_wall_CLTD_C";
  if (type.includes("Concrete")) return "concrete_wall_CLTD_C";
  return "cement_block_wall_CLTD_C";
}

function resolveWallUFromCurrent(type: string): FactorResult | null {
  type = getWallTypeFamily(type);
  const uFactors = section1Data.wall_corrected_cltd_month_may.u_factors_W_per_m2K;

  if (type === "Brick Wall") {
    return { value: uFactors.brick_wall, source: CURRENT_SOURCE };
  }
  if (type === "Cement block Wall") {
    return { value: uFactors.cement_block_wall, source: CURRENT_SOURCE };
  }
  if (type === "Concrete Wall") {
    return { value: uFactors.concrete_wall, source: CURRENT_SOURCE };
  }

  return null;
}

function matchesRoofMaterial(type: string, materialType: string) {
  return matchesText(type, materialType) || (
    type.includes("Clay") && materialType.includes("Clay")
  );
}

function resolveRoofUFactor(type: string, source: string, detail?: string, thicknessMm = 0): FactorResult | null {
  const assembly = resolveRoofAssemblyUFactor(type, detail, thicknessMm, source);

  if (assembly) {
    return assembly;
  }

  const roof = section1Data.roof_material_u_factor.records.find((record) =>
    matchesRoofMaterial(type, record.material_type),
  );

  if (!roof) {
    return null;
  }

  const useWithoutCeiling = detail?.toLowerCase().includes("without ceiling");
  const value = useWithoutCeiling
    ? roof.u_factor_without_ceiling_W_per_m2K
    : roof.u_factor_with_ceiling_W_per_m2K;
  const ceilingBasis = useWithoutCeiling ? "without ceiling" : "with ceiling";

  return {
    value,
    source: formatSource(source, `${roof.material_type} roof U-factor ${ceilingBasis}`),
  };
}

function resolveGlassUFactor(input: {
  glazingType: string;
  frameType?: string;
  thicknessMm: number;
  source: string;
}): FactorResult | null {
  const table5 = lookupAshraeTable5VerticalUFactor(input);

  if (table5 && typeof table5.value === "number") {
    const source =
      input.source === CURRENT_SOURCE ? ASHRAE_TABLE5_FENESTRATION_SOURCE : input.source;

    return {
      value: table5.value,
      source: formatSource(
        source,
        `Table 5 ID ${table5.ashraeId}, ${table5.recordLabel}, ${table5.frameLabel}`,
      ),
    };
  }

  const record = section1Data.fenestration_u_factors_exterior_to_interior.records.find((item) => {
    const thicknessMatches =
      item.thickness_mm == null ||
      input.thicknessMm === 0 ||
      Math.abs(item.thickness_mm - input.thicknessMm) < 0.1;

    return thicknessMatches && matchesText(input.glazingType, item.glazing_type);
  });

  if (!record) {
    return null;
  }

  let value =
    record.glass_only_center_W_per_m2K ??
    record.fixed_wood_vinyl_W_per_m2K ??
    record.operable_wood_vinyl_W_per_m2K;

  const frameType = normalizeAshraeTable5FrameLabel(input.frameType);

  if (frameType.includes("Operable")) {
    value = record.operable_wood_vinyl_W_per_m2K ?? value;
  } else if (frameType.includes("Fixed")) {
    value = record.fixed_wood_vinyl_W_per_m2K ?? value;
  }

  if (typeof value !== "number") {
    return null;
  }

  return {
    value,
    source: formatSource(input.source, `${record.product_type} / ${record.glazing_type}`),
  };
}

export function resolveCurrentTransmissionGlassUFactor(input: {
  glazingType: string;
  frameType?: string;
  thicknessMm: number;
}): FactorResult {
  const glass = resolveGlassUFactor({
    glazingType: input.glazingType,
    frameType: input.frameType ?? DEFAULT_GLASS_FRAME,
    thicknessMm: input.thicknessMm,
    source: CURRENT_SOURCE,
  });

  return glass ?? {
    value: 2,
    source: `${CURRENT_SOURCE}; fallback because glazing/frame combination was not found`,
  };
}

export function resolveSection1GlassSelection(input: {
  direction: string;
  type: string;
  detail?: string;
}) {
  const legacyDirectionIsGlassType = Boolean(findAshraeTable5Record(input.direction));
  const glazingType = legacyDirectionIsGlassType ? input.direction : input.type;
  const frameType = legacyDirectionIsGlassType ? input.type : input.detail || DEFAULT_GLASS_FRAME;

  return {
    direction: legacyDirectionIsGlassType ? "All" : input.direction,
    glazingType: normalizeAshraeTable5GlazingLabel(glazingType),
    frameType: normalizeAshraeTable5FrameLabel(frameType),
  };
}

function resolveWallUFromLayer(type: string, thicknessMm: number, source: string): FactorResult | null {
  type = getWallTypeFamily(type);
  const record = section1Data.wall_u_factor_exterior_to_interior.records.find((item) =>
    matchesText(type, item.material_type),
  );

  if (!record) {
    return null;
  }

  const normalizedThicknessMm = normalizeWallThicknessMm(thicknessMm, defaultWallThicknessMmForType(type));
  const coreThicknessM = normalizedThicknessMm / 1000;
  const resistance = record.base_R_factor_without_core + coreThicknessM / record.core_K_factor_W_per_mK;
  const correctionNote =
    normalizedThicknessMm !== thicknessMm
      ? `; input ${thicknessMm || 0} mm treated as ${normalizedThicknessMm} mm minimum masonry thickness`
      : "";

  return {
    value: resistance > 0 ? 1 / resistance : record.base_U_factor_W_per_m2K,
    source: formatSource(
      source,
      `${record.material_type} layer-resistance U-factor at ${normalizedThicknessMm} mm${correctionNote}`,
    ),
  };
}

export function resolveCurrentUFactor(type: string, detail?: string, thicknessMm = 0): FactorResult {
  if (!type) {
    return { value: 2, source: CURRENT_SOURCE };
  }

  const wall1997 = resolveAshrae1997WallUFactor(type);
  if (wall1997) {
    return wall1997;
  }

  if (thicknessMm > 0) {
    const wallFromLayer = resolveWallUFromLayer(type, thicknessMm, CURRENT_SOURCE);
    if (wallFromLayer) {
      return wallFromLayer;
    }
  }

  const wall = resolveWallUFromCurrent(type);
  if (wall) {
    return wall;
  }

  const roof = resolveRoofUFactor(type, CURRENT_SOURCE, detail, thicknessMm);
  if (roof) {
    return roof;
  }

  const glass = resolveGlassUFactor({
    glazingType: type,
    frameType: type,
    thicknessMm: 0,
    source: CURRENT_SOURCE,
  });
  if (glass) {
    return glass;
  }

  return { value: 2, source: CURRENT_SOURCE };
}

export function resolveCurrentTd(type: string, direction = "North"): FactorResult {
  type = getWallTypeFamily(type);

  if (type.includes("Roof")) {
    return resolveBaseCltd({
      item: "Roof",
      type,
      direction,
    });
  }

  const row = section1Data.wall_corrected_cltd_month_may.records.find((record) =>
    matchesText(record.orientation, direction),
  );
  const tableValue = row ? getNum((row as Record<string, unknown>)[wallMaterialKey(type)] as string | number) : 0;

  if (tableValue > 0) {
    return { value: tableValue, source: "Current application CLTD/TD lookup data" };
  }
  if (type.includes("Brick")) return { value: 15.9, source: "Current application CLTD/TD lookup data" };
  if (type.includes("Cement")) return { value: 19.1, source: "Current application CLTD/TD lookup data" };
  if (type.includes("Concrete Wall")) return { value: 14.1, source: "Current application CLTD/TD lookup data" };
  if (type.toLowerCase().includes("glass")) return { value: 14.1, source: "Current application CLTD/TD lookup data" };
  return { value: 10, source: "Current application CLTD/TD lookup data" };
}

export function resolveAshraeUFactor(input: {
  item: string;
  type: string;
  detail?: string;
  direction?: string;
  thicknessMm: number;
}): FactorResult {
  const isGlass =
    input.item.toLowerCase().includes("glass") ||
    input.item.toLowerCase().includes("sky") ||
    input.detail?.includes("Glass") ||
    input.type.toLowerCase().includes("glass");

  if (isGlass) {
    const glassSelection = resolveSection1GlassSelection({
      direction: input.direction ?? "",
      type: input.type,
      detail: input.detail,
    });
    const glass =
      resolveGlassUFactor({
        glazingType: glassSelection.glazingType,
        frameType: glassSelection.frameType,
        thicknessMm: input.thicknessMm,
        source: references.fenestrationU,
      }) ??
      resolveGlassUFactor({
        glazingType: input.type,
        frameType: input.detail,
        thicknessMm: input.thicknessMm,
        source: references.fenestrationU,
      });

    if (glass) {
      return glass;
    }
  }

  if (input.item.toLowerCase().includes("roof") || input.type.includes("Roof")) {
    const roof = resolveRoofUFactor(input.type, references.opaqueCts, input.detail, input.thicknessMm);
    if (roof) {
      return roof;
    }
  }

  const wall1997 = resolveAshrae1997WallUFactor(input.type);
  if (wall1997) {
    return wall1997;
  }

  const wall1989 = resolveAshrae1989WallUFactor(input.type, input.thicknessMm);
  if (wall1989) {
    return wall1989;
  }

  const wall = resolveWallUFromLayer(input.type, input.thicknessMm, references.opaqueCts);
  return wall ?? {
    value: resolveCurrentUFactor(input.type).value,
    source: formatSource(references.opaqueCts, "Fallback to available assembly U-factor"),
  };
}
