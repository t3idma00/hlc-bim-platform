"use client";

import { useMemo } from "react";

import {
  calculateAshraeSection1,
  calculateAshraeSection3,
  getNum,
  SECTION3_ASSEMBLY_U_FACTOR,
  SECTION3_GROUND_ADJACENT_SPACE,
  SECTION3_MANUAL_U_FACTOR,
  SECTION3_UNKNOWN_ADJACENT_SPACE,
  resolveAshraeInternalClf,
  resolveAshraeInternalHeatGain,
  resolveAshraeSection2Factors,
  resolveCorrectedCltd,
  resolveCurrentTransmissionGlassUFactor,
  resolveCurrentUFactor,
  resolveSection1GlassSelection,
  section3FloorUsesGroundReview,
} from "./ashrae-calculations";
import { buildInitialSections, summaryRows } from "./heat-load-sheet-data";
import { getWallCoreThicknessMm } from "./ashrae-wall-assemblies";
import { getDefaultRoofThicknessMm, normalizeRoofDetail } from "./ashrae-roof-assemblies";
import {
  getAshraeTable5FrameOptions,
  getAshraeTable5NominalThicknessMm,
  getAshraeTable5SkylightFrameOptions,
} from "./ashrae-calculations/fenestration-u-table5";
import {
  ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL,
  isAshrae1997DomedHorizontalSkylightType,
  normalizeAshrae1997SolarGlassThickness,
  normalizeAshrae1997SolarShading,
} from "./ashrae-calculations/section-2";
import { getDefaultVentilation } from "./heat-load-sheet-section-builders";
import { normalizeSheetCellValue, normalizeSheetRowValues } from "./heat-load-sheet-normalization";
import { SectionTable } from "./heat-load-sheet-tables";
import { SummaryTable } from "./heat-load-summary-table";
import type { HeatLoadSheetProps, Row, Section, SheetValues } from "./heat-load-sheet-types";
import { useHeatLoadAutoFill } from "./use-heat-load-auto-fill";
import { useHeatLoadCalculations } from "./use-heat-load-calculations";

function applySheetValuesToSections(sections: Section[], sheetValues: SheetValues): Section[] {
  if (Object.keys(sheetValues).length === 0) {
    return sections;
  }

  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => {
      const rowPrefix = `${row.id}_`;
      const values = { ...row.values };

      Object.entries(sheetValues).forEach(([key, value]) => {
        if (!key.startsWith(rowPrefix)) return;

        const cellKey = key.slice(rowPrefix.length);
        if (Object.prototype.hasOwnProperty.call(values, cellKey)) {
          values[cellKey] = normalizeSheetCellValue(row, cellKey, value);
        }
      });

      return { ...row, values: normalizeSheetRowValues(row, values) };
    }),
  }));
}

export function HeatLoadSheet({
  formValues,
  sheetValues,
  unitSystem,
  onSheetChange,
}: HeatLoadSheetProps) {
  const designContext = useHeatLoadCalculations({ formValues, sheetValues, onSheetChange });

  useHeatLoadAutoFill({ formValues, sheetValues, onSheetChange });

  const sections = useMemo(
    () => applySheetValuesToSections(buildInitialSections(), sheetValues),
    [sheetValues],
  );

  function handleCellChange(sectionNumber: string, rowId: string, key: string, value: string) {
    const section = sections.find((item) => item.number === sectionNumber);
    const row = section?.rows.find((item) => item.id === rowId);
    const normalizedValue = row ? normalizeSheetCellValue(row, key, value) : value;
    const updates: Record<string, string> = { [`${rowId}_${key}`]: normalizedValue };

    if (!row) {
      onSheetChange(`${rowId}_${key}`, normalizedValue);
      return;
    }

    updateDependentValues({
      sectionNumber,
      row,
      changedKey: key,
      changedValue: normalizedValue,
      sheetValues,
      designContext,
      updates,
    });

    Object.entries(updates).forEach(([updateKey, updateValue]) => {
      onSheetChange(updateKey, updateValue);
    });
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <SectionTable
          key={section.number}
          {...section}
          unitSystem={unitSystem}
          sheetValues={sheetValues}
          onCellChange={handleCellChange}
        />
      ))}

      <SummaryTable
        rows={summaryRows}
        unitSystem={unitSystem}
        sheetValues={sheetValues}
        onSheetChange={onSheetChange}
      />
    </div>
  );
}

function updateDependentValues(input: {
  sectionNumber: string;
  row: Row;
  changedKey: string;
  changedValue: string;
  sheetValues: SheetValues;
  designContext: ReturnType<typeof useHeatLoadCalculations>;
  updates: Record<string, string>;
}) {
  const reactiveKeys = [
    "type",
    "typeA",
    "typeB",
    "detail",
    "direction",
    "thickness",
    "shading",
    "zone",
    "hoursInUse",
    "hoursAfterStart",
    "application",
    "item",
    "uFactorMode",
    "adjacentSpaceType",
  ];

  if (!reactiveKeys.includes(input.changedKey)) {
    return;
  }

  const rowValue = (key: string) =>
    normalizeSheetCellValue(
      input.row,
      key,
      input.updates[`${input.row.id}_${key}`] ??
      (key === input.changedKey
        ? input.changedValue
        : input.sheetValues[`${input.row.id}_${key}`] ?? input.row.values[key] ?? ""),
    );

  if (["type", "typeA", "typeB"].includes(input.changedKey)) {
    const assemblyThicknessMm = getWallCoreThicknessMm(input.changedValue);
    if (assemblyThicknessMm) {
      input.updates[`${input.row.id}_thickness`] = String(assemblyThicknessMm);
    }
  }

  if (input.row.id === "3.3" && input.changedKey === "typeA") {
    const usesGroundReview = section3FloorUsesGroundReview(input.changedValue);
    input.updates[`${input.row.id}_adjacentSpaceType`] = usesGroundReview
      ? SECTION3_GROUND_ADJACENT_SPACE
      : SECTION3_UNKNOWN_ADJACENT_SPACE;
    input.updates[`${input.row.id}_uFactorMode`] = usesGroundReview
      ? SECTION3_MANUAL_U_FACTOR
      : SECTION3_ASSEMBLY_U_FACTOR;
    if (usesGroundReview) {
      input.updates[`${input.row.id}_typeB`] = "Not applicable";
      input.updates[`${input.row.id}_thickness`] = "N/A";
      input.updates[`${input.row.id}_uFactor`] = "";
    } else if (rowValue("typeB") === "Not applicable") {
      input.updates[`${input.row.id}_typeB`] = "100 mm concrete wall + finish + plaster";
      input.updates[`${input.row.id}_thickness`] = "100";
    }
  }

  if (rowUsesTable5Fenestration(input.row) && input.changedKey === "type") {
    const glazingThicknessMm = getAshraeTable5NominalThicknessMm(input.changedValue);
    if (glazingThicknessMm) {
      input.updates[`${input.row.id}_thickness`] = String(glazingThicknessMm);
    }
  }

  if (rowUsesTable5Fenestration(input.row) && ["type", "thickness"].includes(input.changedKey)) {
    const frameOptions = input.row.id === "1.5S"
      ? getAshraeTable5SkylightFrameOptions(rowValue("type"), getNum(rowValue("thickness")))
      : getAshraeTable5FrameOptions(rowValue("type"), getNum(rowValue("thickness")));
    const detail = rowValue("detail");

    if (frameOptions.length > 0 && !frameOptions.includes(detail)) {
      input.updates[`${input.row.id}_detail`] = frameOptions[0];
    }
  }

  if (input.row.id === "3.1" && input.changedKey === "typeA") {
    const glazingThicknessMm = getAshraeTable5NominalThicknessMm(input.changedValue);
    if (glazingThicknessMm) {
      input.updates[`${input.row.id}_thickness`] = String(glazingThicknessMm);
    }
  }

  if (input.row.id === "3.1" && ["typeA", "thickness"].includes(input.changedKey)) {
    const frameOptions = getAshraeTable5FrameOptions(rowValue("typeA"), getNum(rowValue("thickness")));
    const detail = rowValue("typeB");

    if (frameOptions.length > 0 && !frameOptions.includes(detail)) {
      input.updates[`${input.row.id}_typeB`] = frameOptions[0];
    }
  }

  if (input.row.id === "2.5" && input.changedKey === "type") {
    input.updates[`${input.row.id}_direction`] = "HOR";

    if (isAshrae1997DomedHorizontalSkylightType(input.changedValue)) {
      input.updates[`${input.row.id}_shading`] = ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL;
      input.updates[`${input.row.id}_thickness`] = "N/A";
    } else {
      if (rowValue("shading") === ASHRAE_DOMED_SKYLIGHT_COEFFICIENT_LABEL) {
        input.updates[`${input.row.id}_shading`] = "No inside shade";
      }
      if (rowValue("thickness") === "N/A") {
        input.updates[`${input.row.id}_thickness`] = "6";
      }
    }
  }

  if (input.row.id === "1.6" && ["type", "detail"].includes(input.changedKey)) {
    const roofType = rowValue("type");
    input.updates[`${input.row.id}_direction`] = "HOR";
    input.updates[`${input.row.id}_detail`] = normalizeRoofDetail(rowValue("detail"));
    input.updates[`${input.row.id}_thickness`] = String(getDefaultRoofThicknessMm(roofType));
  }

  if (input.sectionNumber === "2" && ["type", "thickness", "shading"].includes(input.changedKey)) {
    const type = rowValue("type");
    const thickness = normalizeAshrae1997SolarGlassThickness(type, rowValue("thickness"));
    const shading = normalizeAshrae1997SolarShading(type, getNum(thickness), rowValue("shading"));

    if (thickness !== rowValue("thickness")) {
      input.updates[`${input.row.id}_thickness`] = thickness;
    }
    if (shading !== rowValue("shading")) {
      input.updates[`${input.row.id}_shading`] = shading;
    }
  }

  if (input.sectionNumber === "1") {
    updateSection1Factors(input.row, rowValue, input.designContext, input.updates);
  } else if (input.sectionNumber === "2") {
    updateSection2Factors(input.row, rowValue, input.designContext, input.updates);
  } else if (input.sectionNumber === "3") {
    updateSection3Factors(input.row, rowValue, input.designContext, input.updates);
  } else if (input.sectionNumber === "5") {
    updateSection5Factors(input.row, rowValue, input.updates);
  } else if (input.sectionNumber === "6") {
    const values = getDefaultVentilation(rowValue("application"));
    input.updates[`${input.row.id}_peopleOutdoorAirRate`] = values.peopleOutdoorAirRate;
    input.updates[`${input.row.id}_areaOutdoorAirRate`] = values.areaOutdoorAirRate;
    input.updates[`${input.row.id}_sensible`] = values.sensible;
    input.updates[`${input.row.id}_latent`] = values.latent;
  }
}

function updateSection1Factors(
  row: Row,
  rowValue: (key: string) => string,
  designContext: ReturnType<typeof useHeatLoadCalculations>,
  updates: Record<string, string>,
) {
  const item = rowValue("item");
  const direction = rowValue("direction");
  const type = rowValue("type");
  const detail = rowValue("detail");
  const thicknessMm = getNum(rowValue("thickness"));

  if (designContext.source === "ashrae-2017") {
    const result = calculateAshraeSection1({
      item,
      direction,
      type,
      detail,
      thicknessMm,
      areaM2: getNum(rowValue("calcValue")),
      context: designContext,
    });
    updates[`${row.id}_uFactor`] = result.uFactor.value.toFixed(2);
    updates[`${row.id}_cltd`] = result.td.value.toFixed(2);
    updates[`${row.id}_uFactor_source`] = result.uFactor.source;
    updates[`${row.id}_cltd_source`] = result.td.source;
    updates[`${row.id}_calculationTrace`] = result.calculationTrace ?? "";
    return;
  }

  const glassSelection = resolveSection1GlassSelection({ direction, type, detail });
  const uFactor = itemUsesFenestrationUFactor(item)
    ? resolveCurrentTransmissionGlassUFactor({
        glazingType: glassSelection.glazingType,
        frameType: glassSelection.frameType,
        thicknessMm,
      })
    : resolveCurrentUFactor(type, detail, thicknessMm);

  updates[`${row.id}_uFactor`] = uFactor.value.toFixed(2);
  updates[`${row.id}_uFactor_source`] = uFactor.source;
  updates[`${row.id}_calculationTrace`] = "";
  const correctedCltd = resolveCorrectedCltd({
    item,
    type,
    direction,
    detail,
    thicknessMm,
    context: designContext,
  });
  updates[`${row.id}_cltd`] = correctedCltd.value.toFixed(2);
  updates[`${row.id}_cltd_source`] = correctedCltd.source;
}

function rowUsesTable5Fenestration(row: Row) {
  return row.id === "1.5" || row.id === "1.5S";
}

function itemUsesFenestrationUFactor(item: string) {
  const normalized = item.toLowerCase();
  return normalized.includes("glass") || normalized.includes("sky");
}

function updateSection2Factors(
  row: Row,
  rowValue: (key: string) => string,
  designContext: ReturnType<typeof useHeatLoadCalculations>,
  updates: Record<string, string>,
) {
  const type = rowValue("type");
  const shading = rowValue("shading");
  const factors = resolveAshraeSection2Factors({
    type,
    shading,
    direction: rowValue("direction"),
    thicknessMm: getNum(rowValue("thickness")),
    zoneType: rowValue("zone"),
    context: designContext,
  });

  updates[`${row.id}_sc`] = factors.effectiveCoefficient.value.toFixed(2);
  updates[`${row.id}_shg`] = factors.solarHeatGain.value.toFixed(2);
  updates[`${row.id}_clf`] = factors.solarCoolingLoadFactor.value.toFixed(2);
  updates[`${row.id}_sc_source`] = factors.effectiveCoefficient.source;
  updates[`${row.id}_shg_source`] = factors.solarHeatGain.source;
  updates[`${row.id}_clf_source`] = factors.solarCoolingLoadFactor.source;
}

function updateSection5Factors(
  row: Row,
  rowValue: (key: string) => string,
  updates: Record<string, string>,
) {
  const item = rowValue("item");
  const isLatent = item.toLowerCase().includes("latent");
  const heatGain = resolveAshraeInternalHeatGain({
    item,
    application: rowValue("application"),
    isLatent,
  });
  const clf = resolveAshraeInternalClf({
    item,
    zoneType: rowValue("zone"),
    hoursInUse: getNum(rowValue("hoursInUse")),
    hoursAfterStart: getNum(rowValue("hoursAfterStart")),
    isLatent,
  });

  if (!item.includes("Additional")) {
    updates[`${row.id}_heatGain`] = heatGain.value.toFixed(2);
    updates[`${row.id}_clf`] = clf.value.toFixed(2);
    updates[`${row.id}_heatGain_source`] = heatGain.source;
    updates[`${row.id}_clf_source`] = clf.source;
  }

  const qty = getNum(rowValue("qty"));
  const gainValue = item.includes("Additional") ? getNum(rowValue("heatGain")) : heatGain.value;
  const clfValue = item.includes("Additional") ? getNum(rowValue("clf")) || 1 : clf.value;
  if (qty > 0 && gainValue > 0) {
    updates[`${row.id}_heatLoad`] = (gainValue * qty * clfValue).toFixed(2);
  }
}

function updateSection3Factors(
  row: Row,
  rowValue: (key: string) => string,
  designContext: ReturnType<typeof useHeatLoadCalculations>,
  updates: Record<string, string>,
) {
  const item = rowValue("item");
  const typeA = rowValue("typeA");
  const typeB = rowValue("typeB");
  const requestedAdjacentSpaceType = rowValue("adjacentSpaceType");
  const usesGroundReview =
    item === "Floor" &&
    section3FloorUsesGroundReview(typeA) &&
    requestedAdjacentSpaceType === SECTION3_UNKNOWN_ADJACENT_SPACE;
  const adjacentSpaceType = usesGroundReview
    ? SECTION3_GROUND_ADJACENT_SPACE
    : requestedAdjacentSpaceType;

  const result = calculateAshraeSection3({
    item,
    floorType: item === "Floor" ? typeA : undefined,
    assemblyType: item === "Floor" ? typeB || typeA : typeA || typeB,
    assemblyDetail: typeB,
    uFactorMode: rowValue("uFactorMode"),
    manualUFactor: getNum(rowValue("uFactor")),
    adjacentSpaceType,
    manualAdjacentTemperatureC: getNum(rowValue("adjacentTemperature")),
    thicknessMm: getNum(rowValue("thickness")),
    areaM2: getNum(rowValue("calcValue")),
    context: designContext,
  });

  updates[`${row.id}_uFactor`] = result.uFactor.value.toFixed(2);
  updates[`${row.id}_adjacentTemperature`] = result.adjacentTemperature.value.toFixed(2);
  updates[`${row.id}_indoorTemperature`] = result.indoorTemperature.value.toFixed(2);
  updates[`${row.id}_cltd`] = result.td.value.toFixed(2);
  updates[`${row.id}_uFactor_source`] = result.uFactor.source;
  updates[`${row.id}_adjacentTemperature_source`] = result.adjacentTemperature.source;
  updates[`${row.id}_indoorTemperature_source`] = result.indoorTemperature.source;
  updates[`${row.id}_cltd_source`] = result.td.source;
  if (usesGroundReview) updates[`${row.id}_adjacentSpaceType`] = SECTION3_GROUND_ADJACENT_SPACE;
}
