import { heatLoadLookupOptions } from "./heat-load-options";
import {
  defaultWallThicknessMmForType,
  normalizeWallRowThicknessCell,
  normalizeWallThicknessMm,
  rowLooksLikeWall,
} from "./heat-load-wall-thickness";
import type { Row } from "./heat-load-sheet-types";

const DEFAULT_GLASS_FRAME = "Glass only (Centre of Glass)";
const DEFAULT_ROOF_DETAIL = "With ceiling / ASHRAE roof no. 13";

const legacySolarGlass: Record<string, string> = {
  "Single Glass Clear": "Single clear glass",
  "Single Glass Heat Absorbing": "Single heat-absorbing glass",
  "Insulating Glass Clear out Clear In": "Insulating clear glass, 6 mm air space",
  "Insulating Glass Heat Absorbing out Clear In": "Insulating heat-absorbing out / clear in",
};

const legacySolarShading: Record<string, string> = {
  "No shading": "No inside shade",
  "Venetian Blinds Medium": "Venetian blinds - medium",
  "Venetian Blinds Light": "Venetian blinds - light",
  "Opaque Dark": "Roller shade - opaque dark",
  "Opaque White": "Roller shade - opaque white",
  Translucent: "Roller shade - translucent light",
};

export function normalizeSheetCellValue(row: Row, key: string, value: string) {
  if (key !== "thickness" || !rowLooksLikeWall(row)) {
    return value;
  }

  return normalizeWallRowThicknessCell(row, value.trim());
}

export function normalizeSheetRowValues(row: Row, values: Record<string, string>) {
  const valuesLookLikeWall =
    values.item?.includes("Wall") ||
    values.type?.includes("Wall") ||
    values.typeA?.includes("Wall") ||
    values.typeB?.includes("Wall");

  if (valuesLookLikeWall && values.thickness) {
    const wallType = values.type ?? values.typeA ?? values.typeB ?? "";
    const normalized = normalizeWallThicknessMm(values.thickness, defaultWallThicknessMmForType(wallType));

    values = {
      ...values,
      thickness: typeof normalized === "number" && Number.isInteger(normalized)
        ? String(normalized)
        : String(normalized),
    };
  }

  if (row.id === "1.6") {
    return {
      ...values,
      detail: values.detail || DEFAULT_ROOF_DETAIL,
    };
  }

  if (row.id.startsWith("2.")) {
    return {
      ...values,
      type: legacySolarGlass[values.type] ?? values.type,
      shading: legacySolarShading[values.shading] ?? values.shading,
      thickness: values.thickness === "12" ? "13" : values.thickness,
      zone: values.zone || "C",
    };
  }

  if (row.id.startsWith("5.")) {
    return {
      ...values,
      application:
        values.application === "Standing, light work or walking"
          ? "Standing, light work; walking"
          : values.application,
      zone: values.zone || "C",
      hoursInUse: values.hoursInUse || "10",
      hoursAfterStart: values.hoursAfterStart || "8",
    };
  }

  if (row.id.startsWith("6.")) {
    return {
      ...values,
      application: values.application === "Pharmacy" ? "Drugstore / pharmacy" : values.application,
    };
  }

  if (row.id !== "1.5") {
    return values;
  }

  const legacyDirectionIsGlassType = heatLoadLookupOptions.transmissionGlassTypes.includes(
    values.direction as (typeof heatLoadLookupOptions.transmissionGlassTypes)[number],
  );

  if (!legacyDirectionIsGlassType) {
    return {
      ...values,
      detail: values.detail || DEFAULT_GLASS_FRAME,
    };
  }

  return {
    ...values,
    direction: "All",
    type: values.direction,
    detail: values.type || values.detail || DEFAULT_GLASS_FRAME,
  };
}
