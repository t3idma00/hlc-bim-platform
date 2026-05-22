"use client";

import { useMemo } from "react";

import {
  calculateAshraeSection1,
  calculateAshraeSection3,
  getNum,
  resolveAshraeInternalClf,
  resolveAshraeInternalHeatGain,
  resolveAshraeSection2Factors,
  resolveCorrectedCltd,
  resolveCurrentTransmissionGlassUFactor,
  resolveCurrentUFactor,
  resolveSection1GlassSelection,
} from "./ashrae-calculations";
import { buildInitialSections, summaryRows } from "./heat-load-sheet-data";
import { getDefaultVentilation } from "./heat-load-sheet-section-builders";
import { normalizeSheetCellValue, normalizeSheetRowValues } from "./heat-load-sheet-normalization";
import { SectionTable, SummaryTable } from "./heat-load-sheet-tables";
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
  ];

  if (!reactiveKeys.includes(input.changedKey)) {
    return;
  }

  const rowValue = (key: string) =>
    normalizeSheetCellValue(
      input.row,
      key,
      key === input.changedKey
        ? input.changedValue
        : input.sheetValues[`${input.row.id}_${key}`] ?? input.row.values[key] ?? "",
    );

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
    return;
  }

  const glassSelection = resolveSection1GlassSelection({ direction, type, detail });
  const uFactor = item.toLowerCase().includes("glass")
    ? resolveCurrentTransmissionGlassUFactor({
        glazingType: glassSelection.glazingType,
        frameType: glassSelection.frameType,
        thicknessMm,
      })
    : resolveCurrentUFactor(type, detail, thicknessMm);

  updates[`${row.id}_uFactor`] = uFactor.value.toFixed(2);
  updates[`${row.id}_cltd`] = resolveCorrectedCltd({
    item,
    type,
    direction,
    detail,
    context: designContext,
  }).value.toFixed(2);
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
  const typeA = rowValue("typeA");
  const typeB = rowValue("typeB");
  const type = typeA === "Intermediate Floor" ? typeB : typeA || typeB;

  if (designContext.source === "ashrae-2017") {
    const result = calculateAshraeSection3({
      item: rowValue("item"),
      typeA,
      typeB,
      thicknessMm: getNum(rowValue("thickness")),
      areaM2: getNum(rowValue("calcValue")),
      context: designContext,
    });
    updates[`${row.id}_uFactor`] = result.uFactor.value.toFixed(2);
    updates[`${row.id}_cltd`] = result.td.value.toFixed(2);
    updates[`${row.id}_uFactor_source`] = result.uFactor.source;
    updates[`${row.id}_cltd_source`] = result.td.source;
    return;
  }

  updates[`${row.id}_uFactor`] = resolveCurrentUFactor(type, undefined, getNum(rowValue("thickness"))).value.toFixed(2);
  updates[`${row.id}_cltd`] = resolveCorrectedCltd({
    item: rowValue("item"),
    type,
    direction: rowValue("direction"),
    context: designContext,
  }).value.toFixed(2);
}
