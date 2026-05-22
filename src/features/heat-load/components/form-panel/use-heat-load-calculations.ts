import { useEffect, useMemo } from "react";

import {
  calculateAshraeSection1,
  calculateAshraeSection3,
  calculateAshraeSection4,
  getNum,
  SECTION3_ASSEMBLY_U_FACTOR,
  SECTION3_GROUND_ADJACENT_SPACE,
  SECTION3_INTERMEDIATE_FLOOR,
  SECTION3_MANUAL_U_FACTOR,
  SECTION3_UNKNOWN_ADJACENT_SPACE,
  resolveAshraeInternalClf,
  resolveAshraeInternalHeatGain,
  resolveAshraeSection2Factors,
  resolveCorrectedCltd,
  resolveCurrentTransmissionGlassUFactor,
  resolveCurrentUFactor,
  resolveDesignConditionContext,
  resolveSection1GlassSelection,
  section3FloorUsesGroundReview,
} from "./ashrae-calculations";
import { resolveHumidityRatio } from "./heat-load-psychrometric-helpers";
import { buildInitialSections } from "./heat-load-sheet-data";
import { normalizeSheetCellValue } from "./heat-load-sheet-normalization";
import {
  SECTION4_REFERENCE,
  SECTION6_REFERENCE,
  getSection1Reference,
  getSection2Reference,
  getSection3Reference,
  getSection5Reference,
} from "./heat-load-row-references";
import section6Data from "./section-6-data.json";
import type { FormValues, Row, SheetValues } from "./heat-load-sheet-types";

type VentilationRate = {
  perPerson: number;
  perArea: number;
};

export function useHeatLoadCalculations({
  formValues,
  sheetValues,
  onSheetChange,
}: {
  formValues: FormValues;
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
}) {
  const designContext = useMemo(() => resolveDesignConditionContext(formValues), [formValues]);
  const outdoorW = resolveHumidityRatio(
    designContext.outdoorDryBulbC,
    formValues.conditionType,
    formValues.conditionValue,
    designContext.pressurePa,
  );
  const indoorW = resolveHumidityRatio(
    designContext.indoorDryBulbC,
    formValues.indoorConditionType,
    formValues.indoorConditionValue,
    designContext.pressurePa,
  );
  const deltaW = outdoorW != null && indoorW != null ? outdoorW - indoorW : 0;

  useEffect(() => {
    const sections = buildInitialSections();
    const updates: Record<string, string> = {};
    const setVal = (key: string, value: string) => {
      if (sheetValues[key] !== value) updates[key] = value;
    };
    const getVal = (row: Row, key: string) => {
      const sheetKey = `${row.id}_${key}`;
      const rawValue = sheetValues[sheetKey] ?? row.values[key] ?? "";
      const normalizedValue = normalizeSheetCellValue(row, key, rawValue);

      if (normalizedValue !== rawValue) {
        setVal(sheetKey, normalizedValue);
      }

      return normalizedValue;
    };
    const setSource = (rowId: string, key: string, value: string) => {
      setVal(`${rowId}_${key}_source`, value);
    };

    let totalHeatLoad = 0;

    sections.forEach((section) => {
      section.rows.forEach((row) => {
        const heatLoad = calculateRow(section.number, row, getVal, setVal, setSource, {
          designContext,
          deltaW,
          sheetValues,
        });
        totalHeatLoad += heatLoad;
      });
    });

    const safetyFactor = getNum(sheetValues.summary_1);
    const totalWithSafety = totalHeatLoad * (1 + safetyFactor / 100);

    setVal("summary_0", totalHeatLoad.toFixed(2));
    setVal("summary_2", (totalWithSafety / 1000).toFixed(2));
    setVal("summary_3", (totalWithSafety * 3.412142).toFixed(2));
    setVal("summary_4", (totalWithSafety * 3.412142 / 12000).toFixed(2));

    Object.entries(updates).forEach(([key, value]) => onSheetChange(key, value));
  }, [sheetValues, onSheetChange, designContext, deltaW]);

  return designContext;
}

function calculateRow(
  sectionNumber: string,
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: {
    designContext: ReturnType<typeof resolveDesignConditionContext>;
    deltaW: number;
    sheetValues: SheetValues;
  },
) {
  if (sectionNumber === "1") return calculateSection1Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "2") return calculateSection2Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "3") return calculateSection3Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "4") return calculateSection4Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "5") return calculateSection5Row(row, getVal, setVal, setSource);
  if (sectionNumber === "6") return calculateSection6Row(row, getVal, setVal, setSource, state);
  return 0;
}

function calculateSection1Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: {
    designContext: ReturnType<typeof resolveDesignConditionContext>;
    sheetValues: SheetValues;
  },
) {
  const item = getVal(row, "item");
  const direction = getVal(row, "direction");
  const type = getVal(row, "type");
  const detail = getVal(row, "detail");
  const thicknessMm = getNum(getVal(row, "thickness"));
  const area = getNum(getVal(row, "calcValue"));
  setVal(`${row.id}_reference`, getSection1Reference(item, type, direction));

  const allGlassResult =
    row.id === "1.5" && direction === "All"
      ? calculateAllGlassConduction({ type, detail, thicknessMm, state })
      : null;

  if (allGlassResult) {
    setVal(`${row.id}_uFactor`, allGlassResult.uFactor.value.toFixed(2));
    setVal(`${row.id}_cltd`, allGlassResult.td.value.toFixed(2));
    setSource(row.id, "uFactor", allGlassResult.uFactor.source);
    setSource(row.id, "cltd", allGlassResult.td.source);
    setSource(row.id, "heatLoad", allGlassResult.heatLoad.source);
    setVal(`${row.id}_calculationTrace`, allGlassResult.calculationTrace);
    setVal(`${row.id}_heatLoad`, allGlassResult.heatLoad.value.toFixed(2));
    return allGlassResult.heatLoad.value;
  }

  if (state.designContext.source === "ashrae-2017") {
    const result = calculateAshraeSection1({
      item,
      direction,
      type,
      detail,
      thicknessMm,
      areaM2: area,
      context: state.designContext,
    });
    setVal(`${row.id}_uFactor`, result.uFactor.value.toFixed(2));
    setVal(`${row.id}_cltd`, result.td.value.toFixed(2));
    setSource(row.id, "uFactor", result.uFactor.source);
    setSource(row.id, "cltd", result.td.source);
    setSource(row.id, "heatLoad", result.heatLoad.source);
    setVal(`${row.id}_calculationTrace`, result.calculationTrace ?? "");
    const heatLoad = area > 0 ? result.heatLoad.value : 0;
    setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
    return heatLoad;
  }

  const glassSelection = resolveSection1GlassSelection({ direction, type, detail });
  const u = itemUsesFenestrationUFactor(item)
    ? resolveCurrentTransmissionGlassUFactor({
        glazingType: glassSelection.glazingType,
        frameType: glassSelection.frameType,
        thicknessMm,
      })
    : resolveCurrentUFactor(type, detail, thicknessMm);
  const td = resolveCorrectedCltd({
    item,
    type,
    direction,
    detail,
    thicknessMm,
    context: state.designContext,
  });
  const heatLoad = area > 0 ? u.value * td.value * area : 0;
  setVal(`${row.id}_uFactor`, u.value.toFixed(2));
  setVal(`${row.id}_cltd`, td.value.toFixed(2));
  setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  setVal(`${row.id}_calculationTrace`, "");
  setSource(row.id, "uFactor", u.source);
  setSource(row.id, "cltd", td.source);
  return heatLoad;
}

function calculateAllGlassConduction(input: {
  type: string;
  detail: string;
  thicknessMm: number;
  state: {
    designContext: ReturnType<typeof resolveDesignConditionContext>;
    sheetValues: SheetValues;
  };
}) {
  const components = [
    { rowId: "2.1", item: "Glass", defaultDirection: "North" },
    { rowId: "2.2", item: "Glass", defaultDirection: "East" },
    { rowId: "2.3", item: "Glass", defaultDirection: "South" },
    { rowId: "2.4", item: "Glass", defaultDirection: "West" },
    { rowId: "2.5", item: "Skylight", defaultDirection: "HOR" },
  ]
    .map((component) => ({
      ...component,
      direction: input.state.sheetValues[`${component.rowId}_direction`] || component.defaultDirection,
      area: getNum(input.state.sheetValues[`${component.rowId}_areaQty`]),
    }))
    .filter((component) => component.area > 0);

  const totalArea = components.reduce((sum, component) => sum + component.area, 0);

  if (totalArea <= 0) {
    return null;
  }

  const uFactor =
    input.state.designContext.source === "ashrae-2017"
      ? calculateAshraeSection1({
          item: "Glass",
          direction: "All",
          type: input.type,
          detail: input.detail,
          thicknessMm: input.thicknessMm,
          areaM2: 0,
          context: input.state.designContext,
        }).uFactor
      : resolveCurrentTransmissionGlassUFactor({
          glazingType: resolveSection1GlassSelection({
            direction: "All",
            type: input.type,
            detail: input.detail,
          }).glazingType,
          frameType: resolveSection1GlassSelection({
            direction: "All",
            type: input.type,
            detail: input.detail,
          }).frameType,
          thicknessMm: input.thicknessMm,
        });

  const componentRows = components.map((component) => {
    const td = resolveCorrectedCltd({
      item: component.item,
      type: input.type,
      direction: component.direction,
      detail: input.detail,
      thicknessMm: input.thicknessMm,
      context: input.state.designContext,
    });
    const heatLoad = uFactor.value * td.value * component.area;

    return {
      ...component,
      td,
      heatLoad,
    };
  });
  const totalHeatLoad = componentRows.reduce((sum, component) => sum + component.heatLoad, 0);
  const weightedCltd = uFactor.value > 0 && totalArea > 0 ? totalHeatLoad / (uFactor.value * totalArea) : 0;
  const componentSummary = componentRows
    .map((component) =>
      `${component.rowId} ${component.direction}: area ${component.area.toFixed(2)} m2, CLTDc ${component.td.value.toFixed(2)} C`,
    )
    .join("; ");
  const sourceSummary = Array.from(new Set(componentRows.map((component) => component.td.source))).join("; ");

  return {
    uFactor,
    td: {
      value: weightedCltd,
      source: `Area-weighted corrected CLTD for Section 1.5 All glass/skylight conduction. ${componentSummary}. ${sourceSummary}`,
    },
    heatLoad: {
      value: totalHeatLoad,
      source: `Q = sum(U x corrected CLTD x area) for Section 2 glass/skylight areas. ${componentSummary}`,
    },
    calculationTrace: [
      "Section 1.5 All glass conduction",
      `Total area: ${totalArea.toFixed(2)} m2`,
      `U-value: ${uFactor.value.toFixed(3)} W/m2.K`,
      `Weighted corrected CLTD: ${weightedCltd.toFixed(2)} C`,
      `Cooling load: ${totalHeatLoad.toFixed(2)} W`,
      componentSummary,
    ].join("\n"),
  };
}

function calculateSection2Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext> },
) {
  const direction = getVal(row, "direction");
  const type = getVal(row, "type");
  const item = getVal(row, "item");
  const shading = getVal(row, "shading");
  const thicknessMm = getNum(getVal(row, "thickness"));
  const zoneType = getVal(row, "zone");
  const area = getNum(getVal(row, "areaQty"));
  setVal(`${row.id}_reference`, getSection2Reference(direction, zoneType, item));

  const factors = resolveAshraeSection2Factors({
    type,
    shading,
    direction,
    thicknessMm,
    zoneType,
    context: state.designContext,
  });
  const heatLoad =
    factors.effectiveCoefficient.value *
    factors.solarHeatGain.value *
    factors.solarCoolingLoadFactor.value *
    area;

  setVal(`${row.id}_sc`, factors.effectiveCoefficient.value.toFixed(2));
  setVal(`${row.id}_shg`, factors.solarHeatGain.value.toFixed(2));
  setVal(`${row.id}_clf`, factors.solarCoolingLoadFactor.value.toFixed(2));
  setVal(`${row.id}_result`, heatLoad.toFixed(2));
  setSource(row.id, "sc", factors.effectiveCoefficient.source);
  setSource(row.id, "shg", factors.solarHeatGain.source);
  setSource(row.id, "clf", factors.solarCoolingLoadFactor.source);
  setSource(row.id, "result", "ASHRAE 1997 Section 2: Q = SC x SHGF x CLF x area");
  setVal(
    `${row.id}_calculationTrace`,
    [
      "ASHRAE 1997 simplified solar glass method",
      "Q = SC x SHGF x CLF x area",
      "SHGF month and latitude follow the active design-condition station basis.",
      `SC: ${factors.effectiveCoefficient.value.toFixed(3)}`,
      `SHGF: ${factors.solarHeatGain.value.toFixed(2)} W/m2`,
      `CLF: ${factors.solarCoolingLoadFactor.value.toFixed(3)}`,
      `Area: ${area.toFixed(2)} m2`,
      `Cooling load: ${heatLoad.toFixed(2)} W`,
      `SC source: ${factors.effectiveCoefficient.source}`,
      `SHGF source: ${factors.solarHeatGain.source}`,
      `CLF source: ${factors.solarCoolingLoadFactor.source}`,
    ].join("\n"),
  );
  return heatLoad;
}

function itemUsesFenestrationUFactor(item: string) {
  const normalized = item.toLowerCase();
  return normalized.includes("glass") || normalized.includes("sky");
}

function calculateSection3Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext> },
) {
  const rawItem = getVal(row, "item");
  const isLegacyCeilingRow = row.id === "3.1" && rawItem === "Ceiling";
  const isLegacyManualFloorRow = row.id === "3.3" && rawItem === "Intermediate Floor";
  const isLegacySection3Row = isLegacyCeilingRow || isLegacyManualFloorRow;
  const item = isLegacyCeilingRow ? "All Glasses" : isLegacyManualFloorRow ? "Floor" : rawItem;
  const area = isLegacyCeilingRow ? 0 : getNum(getVal(row, "calcValue"));
  const typeA = isLegacyCeilingRow
    ? row.values.typeA
    : isLegacyManualFloorRow
      ? SECTION3_INTERMEDIATE_FLOOR
      : getVal(row, "typeA");
  const typeB = isLegacySection3Row ? row.values.typeB : getVal(row, "typeB");
  const requestedAdjacentSpaceType = isLegacySection3Row
    ? SECTION3_UNKNOWN_ADJACENT_SPACE
    : getVal(row, "adjacentSpaceType");
  const usesGroundReview =
    item === "Floor" &&
    section3FloorUsesGroundReview(typeA) &&
    requestedAdjacentSpaceType === SECTION3_UNKNOWN_ADJACENT_SPACE;
  const usesGroundFloorType = item === "Floor" && section3FloorUsesGroundReview(typeA);
  const adjacentSpaceType = usesGroundReview
    ? SECTION3_GROUND_ADJACENT_SPACE
    : requestedAdjacentSpaceType;
  const requestedUFactorMode = isLegacySection3Row ? SECTION3_ASSEMBLY_U_FACTOR : getVal(row, "uFactorMode");
  const uFactorMode =
    usesGroundFloorType && requestedUFactorMode === SECTION3_ASSEMBLY_U_FACTOR
      ? SECTION3_MANUAL_U_FACTOR
      : requestedUFactorMode;
  const result = calculateAshraeSection3({
    item,
    floorType: item === "Floor" ? typeA : undefined,
    assemblyType: item === "Floor" ? typeB || typeA : typeA || typeB,
    assemblyDetail: typeB,
    uFactorMode,
    manualUFactor: getNum(getVal(row, "uFactor")),
    adjacentSpaceType,
    manualAdjacentTemperatureC: getNum(getVal(row, "adjacentTemperature")),
    thicknessMm: isLegacySection3Row ? getNum(row.values.thickness) : getNum(getVal(row, "thickness")),
    areaM2: area,
    context: state.designContext,
  });

  setVal(`${row.id}_reference`, getSection3Reference(item, typeA));
  if (isLegacySection3Row) {
    setVal(`${row.id}_item`, item);
    setVal(`${row.id}_typeA`, typeA);
    setVal(`${row.id}_typeB`, typeB);
    setVal(`${row.id}_thickness`, row.values.thickness ?? "");
    setVal(`${row.id}_uFactorMode`, SECTION3_ASSEMBLY_U_FACTOR);
    setVal(`${row.id}_adjacentSpaceType`, SECTION3_UNKNOWN_ADJACENT_SPACE);
    if (isLegacyCeilingRow) setVal(`${row.id}_calcValue`, "");
  }
  if (usesGroundReview) setVal(`${row.id}_adjacentSpaceType`, SECTION3_GROUND_ADJACENT_SPACE);
  if (usesGroundFloorType) {
    setVal(`${row.id}_uFactorMode`, uFactorMode);
    if (typeB !== "Not applicable") {
      setVal(`${row.id}_typeB`, "Not applicable");
    }
    setVal(`${row.id}_thickness`, "N/A");
  }
  setVal(`${row.id}_uFactor`, result.uFactor.value.toFixed(2));
  setVal(`${row.id}_adjacentTemperature`, result.adjacentTemperature.value.toFixed(2));
  setVal(`${row.id}_indoorTemperature`, result.indoorTemperature.value.toFixed(2));
  setVal(`${row.id}_cltd`, result.td.value.toFixed(2));
  setVal(`${row.id}_heatLoad`, result.heatLoad.value.toFixed(2));
  setSource(row.id, "uFactor", result.uFactor.source);
  setSource(row.id, "adjacentTemperature", result.adjacentTemperature.source);
  setSource(row.id, "indoorTemperature", result.indoorTemperature.source);
  setSource(row.id, "cltd", result.td.source);
  setSource(row.id, "heatLoad", result.heatLoad.source);
  return result.heatLoad.value;
}

function calculateSection4Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext>; deltaW: number },
) {
  const input = {
    windowQty: getNum(getVal(row, "qty")),
    crackLengthM: getNum(getVal(row, "crackLength")),
    doorQty: getNum(getVal(row, "qtySecondary")),
  };
  setVal(`${row.id}_reference`, SECTION4_REFERENCE);
  const result = calculateAshraeSection4({
    ...input,
    context: state.designContext,
    deltaW: state.deltaW,
  });

  const heatLoad = result.flowLps.value > 0 ? result.heatLoad.value : 0;
  setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  setSource(row.id, "heatLoad", `${result.heatLoad.source}; ${result.flowLps.source}`);
  return heatLoad;
}

function calculateSection5Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
) {
  const item = getVal(row, "item");
  const application = getVal(row, "application");
  const isLatent = item.toLowerCase().includes("latent");
  const gainFactor = resolveAshraeInternalHeatGain({ item, application, isLatent });
  const clfFactor = resolveAshraeInternalClf({
    item,
    zoneType: getVal(row, "zone"),
    hoursInUse: getNum(getVal(row, "hoursInUse")),
    hoursAfterStart: getNum(getVal(row, "hoursAfterStart")),
    isLatent,
  });
  const gain = item.includes("Additional") ? getNum(getVal(row, "heatGain")) : gainFactor.value;
  const qty = getNum(getVal(row, "qty"));
  const clf = item.includes("Additional") ? getNum(getVal(row, "clf")) || 1 : clfFactor.value;
  const heatLoad = gain !== 0 && qty !== 0 ? gain * qty * clf : 0;
  setVal(`${row.id}_reference`, getSection5Reference(item));
  if (!item.includes("Additional")) setVal(`${row.id}_heatGain`, gain.toFixed(2));
  if (!item.includes("Additional")) setVal(`${row.id}_clf`, clf.toFixed(2));
  setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  setSource(row.id, "heatGain", gainFactor.source);
  setSource(row.id, "clf", clfFactor.source);
  setSource(row.id, "heatLoad", "Q = heat gain x quantity x CLF");
  return heatLoad;
}

function calculateSection6Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext>; deltaW: number },
) {
  const application = getVal(row, "application");
  setVal(`${row.id}_reference`, SECTION6_REFERENCE);
  const peopleQty = getNum(getVal(row, "quantity"));
  const areaQty = getNum(getVal(row, "areaQty"));
  const manualFlow = getNum(getVal(row, "totalFlowRate"));
  const rates = (section6Data.ventilationRates as Record<string, VentilationRate>)[application]
    ?? section6Data.ventilationRates.default;
  const isManualFlow = application === "Manual outdoor-air flow";
  const tableFlow = peopleQty * rates.perPerson + areaQty * rates.perArea;
  const flow = isManualFlow ? manualFlow : tableFlow;
  const sensible = Math.max(0, flow * 1.23 * state.designContext.deltaTC);
  const latent = Math.max(0, flow * 3010 * state.deltaW);
  const heatLoad = sensible + latent;
  setVal(`${row.id}_peopleOutdoorAirRate`, rates.perPerson.toFixed(2));
  setVal(`${row.id}_areaOutdoorAirRate`, rates.perArea.toFixed(2));
  setVal(`${row.id}_totalFlowRate`, flow.toFixed(2));
  setVal(`${row.id}_sensible`, sensible.toFixed(2));
  setVal(`${row.id}_latent`, latent.toFixed(2));
  setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  setSource(
    row.id,
    "peopleOutdoorAirRate",
    isManualFlow ? "Manual user-entered outdoor-air flow" : "ANSI/ASHRAE 62.1-2007 Table 03: people outdoor-air rate",
  );
  setSource(
    row.id,
    "areaOutdoorAirRate",
    isManualFlow ? "Manual user-entered outdoor-air flow" : "ANSI/ASHRAE 62.1-2007 Table 03: area outdoor-air rate",
  );
  setSource(
    row.id,
    "totalFlowRate",
    isManualFlow
      ? "Manual user-entered outdoor-air flow"
      : "Vbz = people x Rp + area x Ra, from ANSI/ASHRAE 62.1-2007 Table 03",
  );
  setSource(row.id, "sensible", "Cooling sizing sensible = max(0, ASHRAE 1997 Ch28 Eq. 22: 1.23 x L/s x deltaT)");
  setSource(row.id, "latent", "Cooling sizing latent = max(0, ASHRAE 1997 Ch28 Eq. 23: 3010 x L/s x deltaW)");
  setSource(row.id, "heatLoad", "Ventilation cooling total = clamped sensible + clamped latent");
  return heatLoad;
}
