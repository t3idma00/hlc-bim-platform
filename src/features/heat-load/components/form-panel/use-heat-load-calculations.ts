import { useEffect, useMemo } from "react";

import { getHumidityRatioFromRelHum, getHumidityRatioFromWetBulb } from "@/lib/calculations";

import {
  calculateAshraeSection1,
  calculateAshraeSection3,
  calculateAshraeSection4,
  calculateCurrentSection4,
  getNum,
  resolveAshraeSection2Factors,
  resolveCurrentGlassFactors,
  resolveCurrentTd,
  resolveCurrentUFactor,
  resolveDesignConditionContext,
} from "./ashrae-calculations";
import { buildInitialSections } from "./heat-load-sheet-data";
import section6Data from "./section-6-data.json";
import type { FormValues, Row, SheetValues } from "./heat-load-sheet-types";

function humidityRatio(
  dryBulbC: number,
  conditionType: string | undefined,
  conditionValue: string | undefined,
  pressurePa: number,
) {
  if (dryBulbC === 0 && conditionValue == null) return null;

  const value = getNum(conditionValue);
  if (value === 0 && !conditionValue) return null;

  return conditionType === "Wet bulb temperature"
    ? getHumidityRatioFromWetBulb(dryBulbC, value, pressurePa)
    : getHumidityRatioFromRelHum(dryBulbC, value, pressurePa);
}

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
  const outdoorW = humidityRatio(
    designContext.outdoorDryBulbC,
    formValues.conditionType,
    formValues.conditionValue,
    designContext.pressurePa,
  );
  const indoorW = humidityRatio(
    designContext.indoorDryBulbC,
    formValues.indoorConditionType,
    formValues.indoorConditionValue,
    designContext.pressurePa,
  );
  const deltaW = outdoorW != null && indoorW != null ? outdoorW - indoorW : 0;

  useEffect(() => {
    const sections = buildInitialSections();
    const updates: Record<string, string> = {};
    const getVal = (row: Row, key: string) => sheetValues[`${row.id}_${key}`] ?? row.values[key] ?? "";
    const setVal = (key: string, value: string) => {
      if (sheetValues[key] !== value) updates[key] = value;
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
        });
        totalHeatLoad += heatLoad;
      });
    });

    const safetyFactor = getNum(sheetValues.summary_1);
    const totalWithSafety = totalHeatLoad * (1 + safetyFactor / 100);

    if (totalHeatLoad > 0 || sheetValues.summary_0) {
      setVal("summary_0", totalHeatLoad.toFixed(2));
      setVal("summary_2", (totalWithSafety / 1000).toFixed(2));
      setVal("summary_3", (totalWithSafety * 3.412142).toFixed(2));
      setVal("summary_4", (totalWithSafety * 3.412142 / 12000).toFixed(2));
    }

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
  },
) {
  if (sectionNumber === "1") return calculateSection1Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "2") return calculateSection2Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "3") return calculateSection3Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "4") return calculateSection4Row(row, getVal, setVal, setSource, state);
  if (sectionNumber === "5") return calculateSection5Row(row, getVal, setVal);
  if (sectionNumber === "6") return calculateSection6Row(row, getVal, setVal, state);
  return 0;
}

function calculateSection1Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext> },
) {
  const item = getVal(row, "item");
  const direction = getVal(row, "direction");
  const type = getVal(row, "type");
  const area = getNum(getVal(row, "calcValue"));

  if (state.designContext.source === "ashrae-2017") {
    const result = calculateAshraeSection1({
      item,
      direction,
      type,
      thicknessMm: getNum(getVal(row, "thickness")),
      areaM2: area,
      context: state.designContext,
    });
    setVal(`${row.id}_uFactor`, result.uFactor.value.toFixed(2));
    setVal(`${row.id}_cltd`, result.td.value.toFixed(2));
    setSource(row.id, "uFactor", result.uFactor.source);
    setSource(row.id, "cltd", result.td.source);
    setSource(row.id, "heatLoad", result.heatLoad.source);
    if (area > 0) setVal(`${row.id}_heatLoad`, result.heatLoad.value.toFixed(2));
    return area > 0 ? result.heatLoad.value : getNum(getVal(row, "heatLoad"));
  }

  const u = resolveCurrentUFactor(type);
  const td = resolveCurrentTd(type, direction);
  const correctedTd = td.value + (25.5 - state.designContext.indoorDryBulbC) + (state.designContext.outdoorDryBulbC - 29.4);
  const heatLoad = area > 0 ? u.value * correctedTd * area : getNum(getVal(row, "heatLoad"));
  setVal(`${row.id}_uFactor`, u.value.toFixed(2));
  setVal(`${row.id}_cltd`, td.value.toFixed(2));
  if (area > 0) setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  setSource(row.id, "uFactor", u.source);
  setSource(row.id, "cltd", td.source);
  return heatLoad;
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
  const shading = getVal(row, "shading");
  const area = getNum(getVal(row, "areaQty"));

  if (state.designContext.source === "ashrae-2017") {
    const factors = resolveAshraeSection2Factors({ type, shading, direction, context: state.designContext });
    setVal(`${row.id}_sc`, factors.effectiveCoefficient.value.toFixed(2));
    setVal(`${row.id}_shg`, factors.solarHeatGain.value.toFixed(2));
    setVal(`${row.id}_clf`, factors.solarCoolingLoadFactor.value.toFixed(2));
    setSource(row.id, "sc", factors.effectiveCoefficient.source);
    setSource(row.id, "shg", factors.solarHeatGain.source);
    setSource(row.id, "clf", factors.solarCoolingLoadFactor.source);
    const heatLoad = factors.effectiveCoefficient.value * factors.solarHeatGain.value * factors.solarCoolingLoadFactor.value * area;
    if (area > 0) setVal(`${row.id}_result`, heatLoad.toFixed(2));
    return area > 0 ? heatLoad : getNum(getVal(row, "result"));
  }

  const current = resolveCurrentGlassFactors(type, shading);
  const shg = state.designContext.solar.hasData ? getNum(getVal(row, "shg")) : current.shg.value;
  const heatLoad = current.sc.value * shg * current.clf.value * area;
  setVal(`${row.id}_sc`, current.sc.value.toFixed(2));
  setVal(`${row.id}_clf`, current.clf.value.toFixed(2));
  if (!state.designContext.solar.hasData) setVal(`${row.id}_shg`, shg.toFixed(2));
  if (area > 0) setVal(`${row.id}_result`, heatLoad.toFixed(2));
  setSource(row.id, "sc", current.sc.source);
  setSource(row.id, "clf", current.clf.source);
  return area > 0 ? heatLoad : getNum(getVal(row, "result"));
}

function calculateSection3Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext> },
) {
  const area = getNum(getVal(row, "calcValue"));

  if (state.designContext.source === "ashrae-2017") {
    const result = calculateAshraeSection3({
      item: getVal(row, "item"),
      typeA: getVal(row, "typeA"),
      typeB: getVal(row, "typeB"),
      thicknessMm: getNum(getVal(row, "thickness")),
      areaM2: area,
      context: state.designContext,
    });
    setVal(`${row.id}_uFactor`, result.uFactor.value.toFixed(2));
    setVal(`${row.id}_cltd`, result.td.value.toFixed(2));
    setSource(row.id, "uFactor", result.uFactor.source);
    setSource(row.id, "cltd", result.td.source);
    if (area > 0) setVal(`${row.id}_heatLoad`, result.heatLoad.value.toFixed(2));
    return area > 0 ? result.heatLoad.value : getNum(getVal(row, "heatLoad"));
  }

  const typeA = getVal(row, "typeA");
  const typeB = getVal(row, "typeB");
  const type = typeA === "Intermediate Floor" ? typeB : typeA || typeB;
  const u = resolveCurrentUFactor(type);
  const td = 0.5 * state.designContext.deltaTC;
  const heatLoad = area > 0 ? u.value * td * area : getNum(getVal(row, "heatLoad"));
  setVal(`${row.id}_uFactor`, u.value.toFixed(2));
  setVal(`${row.id}_cltd`, td.toFixed(2));
  if (area > 0) setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  setSource(row.id, "uFactor", u.source);
  return heatLoad;
}

function calculateSection4Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  setSource: (rowId: string, key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext>; deltaW: number },
) {
  const input = {
    windowQty: getNum(getVal(row, "qty")) || 1,
    crackLengthM: getNum(getVal(row, "crackLength")),
    doorQty: getNum(getVal(row, "qtySecondary")) || 1,
    doorAreaM2: getNum(getVal(row, "doorArea")),
    componentB: getVal(row, "componentB"),
  };
  const result = state.designContext.source === "ashrae-2017"
    ? calculateAshraeSection4({ ...input, method: getVal(row, "method"), context: state.designContext, deltaW: state.deltaW })
    : calculateCurrentSection4({ ...input, deltaTC: state.designContext.deltaTC, deltaW: state.deltaW });

  if (result.flowLps.value > 0) setVal(`${row.id}_heatLoad`, result.heatLoad.value.toFixed(2));
  setSource(row.id, "heatLoad", `${result.heatLoad.source}; ${result.flowLps.source}`);
  return result.flowLps.value > 0 ? result.heatLoad.value : getNum(getVal(row, "heatLoad"));
}

function calculateSection5Row(row: Row, getVal: (row: Row, key: string) => string, setVal: (key: string, value: string) => void) {
  const gain = getNum(getVal(row, "heatGain"));
  const qty = getNum(getVal(row, "qty"));
  const isLatent = getVal(row, "item").toLowerCase().includes("latent");
  const clf = isLatent ? 1 : getNum(getVal(row, "clf")) || 1;
  const heatLoad = gain * qty * clf;
  if (gain !== 0 && qty !== 0) setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  return gain !== 0 && qty !== 0 ? heatLoad : getNum(getVal(row, "heatLoad"));
}

function calculateSection6Row(
  row: Row,
  getVal: (row: Row, key: string) => string,
  setVal: (key: string, value: string) => void,
  state: { designContext: ReturnType<typeof resolveDesignConditionContext>; deltaW: number },
) {
  const application = getVal(row, "application");
  const peopleQty = getNum(getVal(row, "quantity"));
  const areaQty = getNum(getVal(row, "areaQty"));
  const manualFlow = getNum(getVal(row, "totalFlowRate"));
  const rates = (section6Data.ventilationRates as Record<string, { perPerson: number; perArea: number }>)[application]
    ?? section6Data.ventilationRates.default;
  const flow = peopleQty * rates.perPerson + areaQty * rates.perArea || manualFlow;
  const sensible = flow * 1.23 * state.designContext.deltaTC;
  const latent = flow * 3010 * state.deltaW;
  const heatLoad = sensible + latent;
  if (flow > 0) setVal(`${row.id}_totalFlowRate`, flow.toFixed(2));
  if (flow > 0) {
    setVal(`${row.id}_sensible`, sensible.toFixed(2));
    setVal(`${row.id}_latent`, latent.toFixed(2));
    setVal(`${row.id}_heatLoad`, heatLoad.toFixed(2));
  }
  return flow > 0 ? heatLoad : getNum(getVal(row, "heatLoad"));
}
