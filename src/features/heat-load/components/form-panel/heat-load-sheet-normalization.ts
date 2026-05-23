import {
  getWallCoreThicknessMm,
  getWallTypeFamily,
  migrateLegacyWallAssembly,
} from "./ashrae-wall-assemblies";
import {
  ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
  findAshraeTable5Record,
  getAshraeTable5FrameOptions,
  getAshraeTable5SkylightFrameOptions,
  getAshraeTable5ThicknessOptions,
  normalizeAshraeTable5FrameLabel,
  normalizeAshraeTable5GlazingLabel,
} from "./ashrae-calculations/fenestration-u-table5";
import {
  SECTION3_ASSEMBLY_U_FACTOR,
  SECTION3_BASEMENT,
  SECTION3_GROUND_FLOOR,
  SECTION3_GROUND_FLOOR_WITH_BASEMENT,
  SECTION3_INTERMEDIATE_FLOOR,
  SECTION3_UNKNOWN_ADJACENT_SPACE,
} from "./ashrae-calculations/section-3";
import {
  ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL,
  isAshrae1997DomedHorizontalSkylightType,
  normalizeAshrae1997SolarGlassThickness,
  normalizeAshrae1997SolarShading,
} from "./ashrae-calculations/section-2";
import {
  defaultWallThicknessMmForType,
  normalizeWallRowThicknessCell,
  normalizeWallThicknessMm,
  rowLooksLikeWall,
} from "./heat-load-wall-thickness";
import {
  getDefaultRoofThicknessMm,
  normalizeRoofDetail,
} from "./ashrae-roof-assemblies";
import { heatLoadLookupOptions } from "./heat-load-options";
import type { Row } from "./heat-load-sheet-types";

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

const legacyVentilationApplications: Record<string, string> = {
  "Bedroom / residential": "Bed room, Living Room",
  "Drugstore / pharmacy": "Pharmacy",
  "General application": "Office space",
  "Minimum occupant outdoor air": "Office space",
  Office: "Office space",
  "Hospital operating room, 6 ACH at 3 m height": "Office space",
  Pharmacy: "Pharmacy",
};

function normalizeSection3InteriorWallType(type: string, fallback: string) {
  if (heatLoadLookupOptions.interiorPartitionWallTypes.includes(type)) {
    return type;
  }

  const family = getWallTypeFamily(type);
  const familyText = family.toLowerCase();
  const matchText = familyText.includes("brick")
    ? "brick wall"
    : familyText.includes("cement")
      ? "cement block wall"
      : "concrete wall";

  return heatLoadLookupOptions.interiorPartitionWallTypes.find((option) =>
    option.toLowerCase().includes(matchText)
  ) ?? fallback;
}

export function normalizeSheetCellValue(row: Row, key: string, value: string) {
  if (row.id === "1.5" && key === "direction") {
    return "All";
  }

  if ((row.id === "1.5S" || row.id === "2.5") && key === "direction") {
    return "HOR";
  }

  if (key !== "thickness" || !rowLooksLikeWall(row)) {
    return value;
  }

  return normalizeWallRowThicknessCell(row, value.trim());
}

export function normalizeSheetRowValues(row: Row, values: Record<string, string>) {
  if (row.id === "3.1" && values.item === "Ceiling") {
    values = {
      ...values,
      item: row.values.item,
      typeA: row.values.typeA,
      typeB: row.values.typeB,
      thickness: row.values.thickness,
      uFactorMode: SECTION3_ASSEMBLY_U_FACTOR,
      adjacentSpaceType: SECTION3_UNKNOWN_ADJACENT_SPACE,
      adjacentTemperature: "",
      uFactor: "",
      cltd: "",
      calcValue: "",
      heatLoad: "",
    };
  }

  if (row.id === "3.3" && values.item === "Intermediate Floor") {
    values = {
      ...values,
      item: "Floor",
      typeA: SECTION3_INTERMEDIATE_FLOOR,
      typeB: row.values.typeB,
      thickness: row.values.thickness,
      uFactorMode: SECTION3_ASSEMBLY_U_FACTOR,
      adjacentSpaceType: SECTION3_UNKNOWN_ADJACENT_SPACE,
      adjacentTemperature: "",
      uFactor: "",
      cltd: "",
      heatLoad: "",
    };
  }

  if (
    row.id === "3.3" &&
    (values.typeA === SECTION3_GROUND_FLOOR_WITH_BASEMENT || values.typeA === SECTION3_BASEMENT)
  ) {
    values = {
      ...values,
      typeA: SECTION3_GROUND_FLOOR,
    };
  }

  if (row.id === "3.3" && values.typeA === SECTION3_GROUND_FLOOR) {
    values = {
      ...values,
      typeB: "Not applicable",
      thickness: "N/A",
    };
  }

  if (row.id === "3.3" && values.typeA === SECTION3_INTERMEDIATE_FLOOR) {
    values = {
      ...values,
      typeB: row.values.typeB,
      thickness: row.values.thickness,
    };
  }

  if (row.id === "3.1") {
    const normalizedGlazingType = normalizeAshraeTable5GlazingLabel(values.typeA, Number(values.thickness));
    const glazingType = heatLoadLookupOptions.interiorTransmissionGlassTypes.includes(normalizedGlazingType)
      ? normalizedGlazingType
      : row.values.typeA;
    const thicknessOptions = getAshraeTable5ThicknessOptions(glazingType);
    const thickness = thicknessOptions.includes(values.thickness)
      ? values.thickness
      : thicknessOptions[0] ?? values.thickness;

    values = {
      ...values,
      typeA: glazingType,
      typeB: ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
      thickness,
    };
  }

  if (values.item === "Wall Partition") {
    const typeA = normalizeSection3InteriorWallType(values.typeA, row.values.typeA);

    values = {
      ...values,
      typeA,
      typeB: "Not applicable",
      thickness: String(getWallCoreThicknessMm(typeA) ?? row.values.thickness),
    };
  }

  const valuesLookLikeWall =
    values.item?.includes("Wall") ||
    values.type?.includes("Wall") ||
    values.typeA?.includes("Wall") ||
    values.typeB?.includes("Wall");

  if (valuesLookLikeWall && values.thickness) {
    const wallType = values.type ?? values.typeA ?? values.typeB ?? "";
    const normalized = normalizeWallThicknessMm(values.thickness, defaultWallThicknessMmForType(wallType));
    const normalizedNumber = typeof normalized === "number" ? normalized : Number.parseFloat(normalized);
    const nextWallType = migrateLegacyWallAssembly(
      wallType,
      Number.isFinite(normalizedNumber) ? normalizedNumber : defaultWallThicknessMmForType(wallType),
    );
    const assemblyThickness = getWallCoreThicknessMm(nextWallType);
    const wallKey =
      values.type === wallType ? "type" : values.typeA === wallType ? "typeA" : values.typeB === wallType ? "typeB" : null;

    values = {
      ...values,
      ...(wallKey ? { [wallKey]: nextWallType } : {}),
      thickness: String(assemblyThickness ?? normalized),
    };
  }

  if (row.id === "1.6") {
    const roofType = values.type || row.values.type;

    return {
      ...values,
      direction: "HOR",
      detail: normalizeRoofDetail(values.detail),
      thickness: String(getDefaultRoofThicknessMm(roofType)),
    };
  }

  if (row.id.startsWith("2.")) {
    const type = legacySolarGlass[values.type] ?? values.type;
    const shading = legacySolarShading[values.shading] ?? values.shading;
    const isDomedSkylight = row.id === "2.5" && isAshrae1997DomedHorizontalSkylightType(type);
    const migratedThickness =
      values.thickness === "12"
        ? "13"
        : values.thickness === "N/A"
          ? "6"
          : values.thickness || "6";
    const thickness = isDomedSkylight
      ? "N/A"
      : normalizeAshrae1997SolarGlassThickness(type, migratedThickness);
    const candidateShading =
      shading === ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL ? "No inside shade" : shading;

    return {
      ...values,
      ...(row.id === "2.5" ? { direction: "HOR" } : {}),
      type,
      shading: isDomedSkylight
        ? ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL
        : normalizeAshrae1997SolarShading(type, Number(thickness), candidateShading),
      thickness,
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

  if (row.id.startsWith("4.")) {
    return {
      ...values,
      method: "ASHRAE Stack-Wind",
      componentA: "Window crack",
      componentB: "Door frame",
    };
  }

  if (row.id.startsWith("6.")) {
    return {
      ...values,
      application: legacyVentilationApplications[values.application] ?? values.application,
    };
  }

  if (row.id !== "1.5" && row.id !== "1.5S") {
    return values;
  }

  const legacyDirectionIsGlassType = Boolean(findAshraeTable5Record(values.direction, Number(values.thickness)));
  const legacyOrCurrentGlazingType = legacyDirectionIsGlassType ? values.direction : values.type;
  const glazingType = normalizeAshraeTable5GlazingLabel(legacyOrCurrentGlazingType, Number(values.thickness));
  const frameType = normalizeAshraeTable5FrameLabel(
    legacyDirectionIsGlassType ? values.type || values.detail : values.detail,
  );
  const thicknessOptions = getAshraeTable5ThicknessOptions(glazingType);
  const thickness = thicknessOptions.includes(values.thickness)
    ? values.thickness
    : thicknessOptions[0] ?? values.thickness;
  const frameOptions = row.id === "1.5S"
    ? getAshraeTable5SkylightFrameOptions(glazingType, Number(thickness))
    : getAshraeTable5FrameOptions(glazingType, Number(thickness));
  const detail = frameOptions.includes(frameType) ? frameType : frameOptions[0] ?? frameType;

  if (!legacyDirectionIsGlassType) {
    return {
      ...values,
      ...(row.id === "1.5" ? { direction: "All" } : {}),
      ...(row.id === "1.5S" ? { direction: "HOR" } : {}),
      type: glazingType,
      detail,
      thickness,
    };
  }

  return {
    ...values,
    direction: row.id === "1.5S" ? "HOR" : "All",
    type: glazingType,
    detail,
    thickness,
  };
}
