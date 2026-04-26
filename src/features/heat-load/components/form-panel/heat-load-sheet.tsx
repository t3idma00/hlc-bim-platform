"use client";

import { useEffect, useState } from "react";
import { heatLoadLookupOptions } from "./heat-load-options";
import dummyFactors from "./dummy-factors.json";
import { getHumidityRatioFromRelHum, getHumidityRatioFromWetBulb } from "@/lib/calculations";

type FormValues = Record<string, string>;

type SheetValues = Record<string, string>;

type Align = "left" | "right" | "center";

function getNum(val: string | undefined | null): number {
  const n = Number.parseFloat(val ?? "");
  return Number.isNaN(n) ? 0 : n;
}

type Column = {
  key: string;
  label: string;
  align?: Align;
  wrap?: boolean;
  width?: string;
  editable?: boolean;
  selectOptions?: readonly string[];
};

type SelectOptionsByKey = Partial<Record<string, readonly string[]>>;

type Row = {
  id: string;
  values: Record<string, string>;
  selectOptions?: SelectOptionsByKey;
};

type Section = {
  number: string;
  title: string;
  columns: Column[];
  rows: Row[];
};

type SummaryRow = {
  label: string;
  note: string;
  value: string;
};

type Props = {
  formValues: FormValues;
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
};

const numberColumnWidth = "5%";
const summaryNoteWidth = "10%";
const summaryValueWidth = "9%";
const tableClass = "w-full table-fixed border-collapse text-[10px] leading-none text-slate-900";
const cellClass = "border border-slate-300 px-1 py-1 align-middle";

const wallCellSelects: SelectOptionsByKey = {
  direction: heatLoadLookupOptions.directions,
  type: heatLoadLookupOptions.wallTypes,
  thickness: heatLoadLookupOptions.wallThicknesses,
};

const solarGlassCellSelects: SelectOptionsByKey = {
  direction: heatLoadLookupOptions.directions,
  type: heatLoadLookupOptions.glassSolarTypes,
  shading: heatLoadLookupOptions.glassShadingTypes,
  thickness: heatLoadLookupOptions.glassThicknesses,
};

const allGlassesCellSelects: SelectOptionsByKey = {
  typeA: heatLoadLookupOptions.transmissionGlassTypes,
  typeB: heatLoadLookupOptions.glassFrameTypes,
  thickness: heatLoadLookupOptions.glassThicknesses,
};

const wallPartitionCellSelects: SelectOptionsByKey = {
  typeA: heatLoadLookupOptions.wallTypes,
  thickness: heatLoadLookupOptions.wallThicknesses,
};

const floorCellSelects: SelectOptionsByKey = {
  typeB: heatLoadLookupOptions.wallTypes,
  thickness: heatLoadLookupOptions.wallThicknesses,
};

const roofCellSelects: SelectOptionsByKey = {
  type: heatLoadLookupOptions.roofTypes,
  thickness: ["6", "80", "150"],
};

function getDummyUFactor(type: string): string {
  if (!type) return dummyFactors.uFactors.default.toFixed(2);
  const factor = (dummyFactors.uFactors as Record<string, number>)[type] ?? dummyFactors.uFactors.default;
  return factor.toFixed(2);
}

function getDummyCLTD(type: string): string {
  if (!type) return dummyFactors.cltd.default.toFixed(2);
  const cltd = (dummyFactors.cltd as Record<string, number>)[type] ?? dummyFactors.cltd.default;
  return cltd.toFixed(2);
}

function getDummyGlassFactors(type: string, shading: string) {
  let sc = dummyFactors.glassFactors.shading.default;
  if (shading) {
    sc = (dummyFactors.glassFactors.shading as Record<string, number>)[shading] ?? sc;
  }
  
  if (type?.includes("Absorbing")) sc += dummyFactors.glassFactors.typeAdjustments.Absorbing;
  if (type?.includes("Insulating")) sc += dummyFactors.glassFactors.typeAdjustments.Insulating;
  
  return {
    sc: Math.max(0.1, sc).toFixed(2),
    shg: dummyFactors.glassFactors.defaultShg.toFixed(2),
    clf: dummyFactors.glassFactors.defaultClf.toFixed(2)
  };
}

function getDummyInternalGain(item: string, application: string): string {
  if (!item) return dummyFactors.internalGains.items.default.toFixed(2);
  const gain = (dummyFactors.internalGains.items as Record<string, number>)[item] ?? dummyFactors.internalGains.items.default;
  return gain.toFixed(2);
}

function getDummyVentilation(application: string) {
  const vent = (dummyFactors.ventilation.applications as Record<string, { sensible: number, latent: number }>)[application] ?? dummyFactors.ventilation.default;
  return {
    sensible: vent.sensible.toFixed(2),
    latent: vent.latent.toFixed(2)
  };
}

function buildInitialSections(): Section[] {
  return [
    {
      number: "1",
      title: "Solar & Trans. Heat gain through the Glass-Wall & Roof",
      columns: [
        { key: "item", label: "Item", width: "8%" },
        { key: "direction", label: "Direction", wrap: true, width: "10%" },
        { key: "type", label: "Type", wrap: true, width: "24%" },
        { key: "thickness", label: "Thickness (mm)", wrap: true, align: "center", width: "16%", editable: true },
        { key: "uFactor", label: "U Factor", align: "right", width: "9%", editable: true },
        { key: "cltd", label: "CLTD/TD", align: "right", width: "10%", editable: true },
        { key: "calcValue", label: "Area in m2 / Qty", align: "right", width: "10%", editable: true },
        { key: "heatLoad", label: "Total Heat load", align: "right", width: "9%", editable: true },
      ],
      rows: [
        { id: "1.1", values: { item: "Wall", direction: "North", type: "Brick Wall", thickness: "215", uFactor: getDummyUFactor("Brick Wall"), cltd: getDummyCLTD("Brick Wall"), calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        { id: "1.2", values: { item: "Wall", direction: "East", type: "Cement block Wall", thickness: "100", uFactor: getDummyUFactor("Cement block Wall"), cltd: getDummyCLTD("Cement block Wall"), calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        { id: "1.3", values: { item: "Wall", direction: "South", type: "Cement block Wall", thickness: "100", uFactor: getDummyUFactor("Cement block Wall"), cltd: getDummyCLTD("Cement block Wall"), calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        { id: "1.4", values: { item: "Wall", direction: "West", type: "Cement block Wall", thickness: "100", uFactor: getDummyUFactor("Cement block Wall"), cltd: getDummyCLTD("Cement block Wall"), calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        {
          id: "1.5",
          values: { item: "Glass", direction: "Single glass", type: "Glass only (Centre of Glass)", thickness: "6", uFactor: getDummyUFactor("Glass only (Centre of Glass)"), cltd: getDummyCLTD("Glass only (Centre of Glass)"), calcValue: "", heatLoad: "" },
          selectOptions: {
            direction: heatLoadLookupOptions.transmissionGlassTypes,
            type: heatLoadLookupOptions.glassFrameTypes,
            thickness: heatLoadLookupOptions.glassThicknesses,
          },
        },
        {
          id: "1.6",
          values: { item: "Roof", direction: "HOR", type: "Concrete Slab Roof", thickness: "150", uFactor: getDummyUFactor("Concrete Slab Roof"), cltd: getDummyCLTD("Concrete Slab Roof"), calcValue: "", heatLoad: "" },
          selectOptions: roofCellSelects,
        },
      ],
    },
    {
      number: "2",
      title: "Solar Heat gain through the Glass",
      columns: [
        { key: "item", label: "Item", width: "7%" },
        { key: "direction", label: "Direction", width: "8%" },
        { key: "type", label: "Type", wrap: true, width: "20%" },
        { key: "shading", label: "Interior Shading type", wrap: true, width: "10%" },
        { key: "thickness", label: "Thick.", align: "center", width: "7%" },
        { key: "sc", label: "SC", align: "right", width: "8%", editable: true },
        { key: "shg", label: "SHG", align: "right", width: "8%", editable: true },
        { key: "clf", label: "CLF", align: "right", width: "8%", editable: true },
        { key: "areaQty", label: "Area in m2 / Qty", align: "right", width: "10%", editable: true },
        { key: "result", label: "Total Heat load", align: "right", width: "9%", editable: true },
      ],
      rows: [
        { id: "2.1", values: { item: "Glass", direction: "East", type: "Single Glass Clear", shading: "No shading", thickness: "6", ...getDummyGlassFactors("Single Glass Clear", "No shading"), areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.2", values: { item: "Glass", direction: "East", type: "Single Glass Clear", shading: "No shading", thickness: "6", ...getDummyGlassFactors("Single Glass Clear", "No shading"), areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.3", values: { item: "Glass", direction: "South", type: "Single Glass Clear", shading: "No shading", thickness: "6", ...getDummyGlassFactors("Single Glass Clear", "No shading"), areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.4", values: { item: "Glass", direction: "West", type: "Single Glass Clear", shading: "No shading", thickness: "6", ...getDummyGlassFactors("Single Glass Clear", "No shading"), areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.5", values: { item: "Sky light", direction: "HOR", type: "Single Glass Clear", shading: "No shading", thickness: "6", ...getDummyGlassFactors("Single Glass Clear", "No shading"), areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
      ],
    },
    {
      number: "3",
      title: "Transmission heat gain Except outside wall and roof",
      columns: [
        { key: "item", label: "Item", width: "14%" },
        { key: "typeA", label: "Type", wrap: true, width: "14%" },
        { key: "typeB", label: "Detail", wrap: true, width: "16%" },
        { key: "thickness", label: "Thick.", wrap: true, align: "center", width: "16%", editable: true },
        { key: "uFactor", label: "U Factor", align: "right", width: "10%", editable: true },
        { key: "cltd", label: "CLTD/TD", align: "right", width: "11%", editable: true },
        { key: "calcValue", label: "Area in m2 / Qty", align: "right", width: "10%", editable: true },
        { key: "heatLoad", label: "Total Heat load", align: "right", width: "9%", editable: true },
      ],
      rows: [
        { id: "3.1", values: { item: "All Glasses", typeA: "Single glass", typeB: "Glass only (Centre of Glass)", thickness: "6", uFactor: getDummyUFactor("Single glass"), cltd: getDummyCLTD("Single glass"), calcValue: "", heatLoad: "" }, selectOptions: allGlassesCellSelects },
        { id: "3.2", values: { item: "Wall Partition", typeA: "Concrete Wall", typeB: "Not applicable", thickness: "215", uFactor: getDummyUFactor("Concrete Wall"), cltd: getDummyCLTD("Concrete Wall"), calcValue: "", heatLoad: "" }, selectOptions: wallPartitionCellSelects },
        { id: "3.3", values: { item: "Floor", typeA: "Intermediate Floor", typeB: "Concrete Wall", thickness: "100", uFactor: getDummyUFactor("Concrete Wall"), cltd: getDummyCLTD("Concrete Wall"), calcValue: "", heatLoad: "" }, selectOptions: floorCellSelects },
      ],
    },
    {
      number: "4",
      title: "Infiltration",
      columns: [
        { key: "componentA", label: "Component", width: "15%" },
        { key: "qty", label: "Qty", align: "right", width: "15%", editable: true },
        { key: "crackLength", label: "Crack length", align: "right", width: "14%", editable: true },
        { key: "componentB", label: "Component", wrap: true, width: "19%" },
        { key: "qtySecondary", label: "QTY", align: "right", width: "9%", editable: true },
        { key: "doorArea", label: "Door Area", align: "right", width: "11%", editable: true },
        { key: "heatLoad", label: "Total Heat load", align: "right", width: "10%", editable: true },
      ],
      rows: [
        {
          id: "4.1",
          values: {
            componentA: "Window",
            qty: "1",
            crackLength: "5",
            componentB: "Nonresidential door",
            qtySecondary: "2.00",
            doorArea: "1",
            heatLoad: "106.72",
          },
          selectOptions: {
            componentB: heatLoadLookupOptions.infiltrationDoorComponents,
          },
        },
      ],
    },
    {
      number: "5",
      title: "Internal Heat",
      columns: [
        { key: "item", label: "Item", wrap: true, width: "12%" },
        { key: "application", label: "Application", wrap: true, width: "31%" },
        { key: "heatGain", label: "Heat gain", align: "right", width: "14%", editable: true },
        { key: "qty", label: "QTY", align: "right", width: "19%", editable: true },
        { key: "heatLoad", label: "Total Heat load", align: "right", width: "19%", editable: true },
      ],
      rows: [
        { id: "5.1", values: { item: "People", application: "Standing, light work or walking", heatGain: getDummyInternalGain("People", "Standing, light work or walking"), qty: "", heatLoad: "" }, selectOptions: { application: heatLoadLookupOptions.peopleApplications } },
        { id: "5.2", values: { item: "Motor power (Name plate)", application: "(0.04)", heatGain: getDummyInternalGain("Motor", "(0.04)"), qty: "", heatLoad: "" }, selectOptions: { application: heatLoadLookupOptions.motorPowerFactors } },
        { id: "5.3", values: { item: "compact fluorescent lamp", application: "Office", heatGain: getDummyInternalGain("lamp", "Office"), qty: "", heatLoad: "" }, selectOptions: { application: heatLoadLookupOptions.lampApplications } },
        { id: "5.4", values: { item: "Appliance etc.", application: "Medium, desktop type", heatGain: getDummyInternalGain("Appliance", "Medium, desktop type"), qty: "", heatLoad: "" }, selectOptions: { application: heatLoadLookupOptions.applianceApplications } },
        { id: "5.5", values: { item: "Additional heat gain", application: "Miscellaneous equipment", heatGain: "50", qty: "", heatLoad: "" } },
      ],
    },
    {
      number: "6",
      title: "Ventilation",
      columns: [
        { key: "application", label: "Application", width: "13%" },
        { key: "item", label: "Item", width: "10%" },
        { key: "quantity", label: "Quantity", align: "right", width: "8%", editable: true },
        { key: "area", label: "Area", width: "8%" },
        { key: "areaQty", label: "Area quantity", align: "right", width: "9%", editable: true },
        { key: "totalFlowRate", label: "Total flowrate", align: "right", width: "11%", editable: true },
        { key: "sensible", label: "Sensible heat", align: "right", width: "8%", editable: true },
        { key: "latent", label: "Latent heat", align: "right", width: "9%", editable: true },
        { key: "heatLoad", label: "Total Heat load", align: "right", width: "19%", editable: true },
      ],
      rows: [
        {
          id: "6.1",
          values: {
            application: "Pharmacy",
            item: "People",
            quantity: "",
            area: "Area",
            areaQty: "",
            totalFlowRate: "",
            ...getDummyVentilation("Pharmacy"),
            heatLoad: "",
          },
          selectOptions: { application: heatLoadLookupOptions.ventilationApplications },
        },
      ],
    },
  ];
}

const summaryRows: SummaryRow[] = [
  { label: "Heat Load", note: "", value: "" },
  { label: "Safety factor", note: "", value: "" },
  { label: "Total Heat load (kW)", note: "", value: "" },
  { label: "Total Heat load (Btu/hr)", note: "", value: "" },
  { label: "Total Heat load (RT)", note: "", value: "" },
];

/**
 * Compute outdoor humidity ratio from formValues.
 * Supports both RH-based and WB-based conditions.
 */
function getOutdoorHumidityRatio(formValues: FormValues): number | null {
  const tOut = getNum(formValues.dryBulbTemp);
  if (tOut === 0 && !formValues.dryBulbTemp) return null;

  const condType = formValues.conditionType ?? "Relative Humidity";
  const condVal = getNum(formValues.conditionValue);
  if (condVal === 0 && !formValues.conditionValue) return null;

  if (condType === "Relative Humidity") {
    return getHumidityRatioFromRelHum(tOut, condVal);
  }
  return getHumidityRatioFromWetBulb(tOut, condVal);
}

/**
 * Compute indoor humidity ratio from formValues.
 */
function getIndoorHumidityRatio(formValues: FormValues): number | null {
  const tIn = getNum(formValues.insideCondition);
  if (tIn === 0 && !formValues.insideCondition) return null;

  const condType = formValues.indoorConditionType ?? "Relative Humidity";
  const condVal = getNum(formValues.indoorConditionValue);
  if (condVal === 0 && !formValues.indoorConditionValue) return null;

  if (condType === "Relative Humidity") {
    return getHumidityRatioFromRelHum(tIn, condVal);
  }
  return getHumidityRatioFromWetBulb(tIn, condVal);
}

export function HeatLoadSheet({ formValues, sheetValues, onSheetChange }: Props) {
  const [sections, setSections] = useState<Section[]>(buildInitialSections());

  // Derive design condition values
  const tOutdoor = getNum(formValues.dryBulbTemp);
  const tIndoor = getNum(formValues.insideCondition);
  const deltaT = tOutdoor - tIndoor;

  const wOutdoor = getOutdoorHumidityRatio(formValues);
  const wIndoor = getIndoorHumidityRatio(formValues);
  const deltaW = (wOutdoor != null && wIndoor != null) ? (wOutdoor - wIndoor) : 0;

  // ── Link Room Details dimensions → sheet area cells ──
  useEffect(() => {
    const updates: Record<string, string> = {};
    const setIfChanged = (key: string, value: string) => {
      if (sheetValues[key] !== value) updates[key] = value;
    };

    const directions = ["North", "East", "South", "West"] as const;
    const dirMap = { North: "1.1", East: "1.2", South: "1.3", West: "1.4" } as const;
    const solarDirMap = { North: "2.1", East: "2.2", South: "2.3", West: "2.4" } as const;

    let totalWindowArea = 0;
    let totalWindowPerimeter = 0;
    let totalDoorArea = 0;

    // For roof/floor: use North wall length × East wall length
    const wallNorthLen = getNum(formValues.wallNorthLength);
    const wallEastLen = getNum(formValues.wallEastLength);

    directions.forEach((dir) => {
      const prefix = dir.toLowerCase();

      // Wall gross area = length × height
      const wallLen = getNum(formValues[`wall${dir}Length`]);
      const wallH = getNum(formValues[`wall${dir}Height`]);
      const wallGrossArea = wallLen * wallH;

      // Window area = width × height (per side)
      const winW = getNum(formValues[`window${dir}Width`]);
      const winH = getNum(formValues[`window${dir}Height`]);
      const windowArea = winW * winH;
      totalWindowArea += windowArea;
      totalWindowPerimeter += windowArea > 0 ? 2 * (winW + winH) : 0;

      // Door area = width × height (per side)
      const doorW = getNum(formValues[`door${dir}Width`]);
      const doorH = getNum(formValues[`door${dir}Height`]);
      const doorArea = doorW * doorH;
      totalDoorArea += doorArea;

      // Net wall area = gross wall − window − door on that face
      const netWallArea = Math.max(0, wallGrossArea - windowArea - doorArea);

      // Section 1: wall rows (1.1–1.4) — net wall area
      if (wallGrossArea > 0) {
        setIfChanged(`${dirMap[dir]}_calcValue`, netWallArea.toFixed(2));
      }

      // Section 2: solar glass rows (2.1–2.4) — window area per direction
      if (windowArea > 0) {
        setIfChanged(`${solarDirMap[dir]}_areaQty`, windowArea.toFixed(2));
      }
    });

    // Section 1, row 1.5: total glass area for transmission
    if (totalWindowArea > 0) {
      setIfChanged("1.5_calcValue", totalWindowArea.toFixed(2));
    }

    // Section 1, row 1.6: roof area = wallNorthLength × wallEastLength
    const roofArea = wallNorthLen * wallEastLen;
    if (roofArea > 0) {
      setIfChanged("1.6_calcValue", roofArea.toFixed(2));
    }

    // Section 3, row 3.1: all glasses transmission area
    if (totalWindowArea > 0) {
      setIfChanged("3.1_calcValue", totalWindowArea.toFixed(2));
    }

    // Section 3, row 3.3: floor area = same as roof area
    if (roofArea > 0) {
      setIfChanged("3.3_calcValue", roofArea.toFixed(2));
    }

    // Section 4, row 4.1: infiltration — window crack length & door area
    if (totalWindowPerimeter > 0) {
      setIfChanged("4.1_crackLength", totalWindowPerimeter.toFixed(2));
    }
    if (totalDoorArea > 0) {
      setIfChanged("4.1_doorArea", totalDoorArea.toFixed(2));
    }

    // Section 6, row 6.1: ventilation area quantity = floor area
    if (roofArea > 0) {
      setIfChanged("6.1_areaQty", roofArea.toFixed(2));
    }

    if (Object.keys(updates).length > 0) {
      Object.entries(updates).forEach(([key, value]) => {
        onSheetChange(key, value);
      });
    }
  }, [
    formValues.wallNorthLength, formValues.wallNorthHeight,
    formValues.wallEastLength, formValues.wallEastHeight,
    formValues.wallSouthLength, formValues.wallSouthHeight,
    formValues.wallWestLength, formValues.wallWestHeight,
    formValues.windowNorthWidth, formValues.windowNorthHeight,
    formValues.windowEastWidth, formValues.windowEastHeight,
    formValues.windowSouthWidth, formValues.windowSouthHeight,
    formValues.windowWestWidth, formValues.windowWestHeight,
    formValues.doorNorthWidth, formValues.doorNorthHeight,
    formValues.doorEastWidth, formValues.doorEastHeight,
    formValues.doorSouthWidth, formValues.doorSouthHeight,
    formValues.doorWestWidth, formValues.doorWestHeight,
    onSheetChange, sheetValues,
  ]);

  // Sync sheetValues into local section state
  useEffect(() => {
    if (Object.keys(sheetValues).length === 0) {
      return;
    }

    setSections((prevSections) =>
      prevSections.map((section) => ({
        ...section,
        rows: section.rows.map((row) => {
          const newValues = { ...row.values };

          Object.entries(sheetValues).forEach(([key, value]) => {
            const rowPrefix = `${row.id}_`;

            if (!key.startsWith(rowPrefix)) {
              return;
            }

            const cellKey = key.slice(rowPrefix.length);
            if (Object.prototype.hasOwnProperty.call(newValues, cellKey)) {
              newValues[cellKey] = value;
            }
          });

          return { ...row, values: newValues };
        }),
      })),
    );
  }, [sheetValues]);

  // ── Calculation engine ──
  useEffect(() => {
    const updates: Record<string, string> = {};
    const initialSections = buildInitialSections();

    const getVal = (rowId: string, key: string, defaultVal: string) => {
      return sheetValues[`${rowId}_${key}`] ?? defaultVal;
    };

    const setVal = (key: string, value: string) => {
      if (sheetValues[key] !== value) {
        updates[key] = value;
      }
    };

    let totalHeatLoad = 0;

    initialSections.forEach((section) => {
      section.rows.forEach((row) => {
        const id = row.id;
        let rowHeatLoad = 0;

        if (section.number === "1") {
          // ── Walls, Roof, Glass Transmission ──
          // Q = U × CLTDcorrected × Area
          // CLTDcorrected = CLTDtable + (25.5 - Tindoor) + (Toutdoor - 29.4)
          const u = getNum(getVal(id, "uFactor", row.values.uFactor));
          const cltdRaw = getNum(getVal(id, "cltd", row.values.cltd));
          const area = getNum(getVal(id, "calcValue", row.values.calcValue));

          let cltdCorrected = cltdRaw;
          if (tOutdoor !== 0 || tIndoor !== 0) {
            cltdCorrected = cltdRaw + (25.5 - tIndoor) + (tOutdoor - 29.4);
          }

          if (area !== 0 && (u !== 0 || cltdCorrected !== 0)) {
            rowHeatLoad = u * cltdCorrected * area;
            setVal(`${id}_heatLoad`, rowHeatLoad.toFixed(2));
          } else {
            rowHeatLoad = getNum(getVal(id, "heatLoad", row.values.heatLoad));
          }
        } else if (section.number === "2") {
          // ── Solar Heat Gain through Glass ──
          // Q = SC × SHG × CLF × Area
          const sc = getNum(getVal(id, "sc", row.values.sc));
          const shg = getNum(getVal(id, "shg", row.values.shg));
          const clf = getNum(getVal(id, "clf", row.values.clf));
          const area = getNum(getVal(id, "areaQty", row.values.areaQty));

          if (area !== 0 && (sc !== 0 || shg !== 0 || clf !== 0)) {
            rowHeatLoad = sc * shg * clf * area;
            setVal(`${id}_result`, rowHeatLoad.toFixed(2));
          } else {
            rowHeatLoad = getNum(getVal(id, "result", row.values.result));
          }
        } else if (section.number === "3") {
          // ── Transmission (Partition, Floor, Internal Glass) ──
          // TD = 0.5 × (Toutdoor - Tindoor) for unconditioned adjacent spaces
          // Q = U × TD × Area
          const u = getNum(getVal(id, "uFactor", row.values.uFactor));
          const area = getNum(getVal(id, "calcValue", row.values.calcValue));

          let td = getNum(getVal(id, "cltd", row.values.cltd));
          if (tOutdoor !== 0 || tIndoor !== 0) {
            td = 0.5 * deltaT;
            setVal(`${id}_cltd`, td.toFixed(2));
          }

          if (area !== 0 && (u !== 0 || td !== 0)) {
            rowHeatLoad = u * td * area;
            setVal(`${id}_heatLoad`, rowHeatLoad.toFixed(2));
          } else {
            rowHeatLoad = getNum(getVal(id, "heatLoad", row.values.heatLoad));
          }
        } else if (section.number === "4") {
          // ── Infiltration ──
          // V̇_window = crackLength × windowCrackRate (L/s)
          // V̇_door = doorArea × doorRate (L/s)
          // Q_sensible = V̇_total × 1.2 × ΔT (W)
          // Q_latent   = V̇_total × 3000 × ΔW (W)
          const crackLength = getNum(getVal(id, "crackLength", row.values.crackLength));
          const doorArea = getNum(getVal(id, "doorArea", row.values.doorArea));
          const componentB = getVal(id, "componentB", row.values.componentB);

          const windowFlow = crackLength * dummyFactors.infiltration.windowCrackRate;

          const doorRate = componentB.includes("Nonresidential")
            ? dummyFactors.infiltration.nonresidentialDoorRate
            : dummyFactors.infiltration.residentialDoorRate;
          const doorFlow = doorArea * doorRate;

          const totalFlow = windowFlow + doorFlow;

          if (totalFlow > 0 && (deltaT !== 0 || deltaW !== 0)) {
            const qSensible = totalFlow * dummyFactors.infiltration.airDensityCp * deltaT;
            const qLatent = totalFlow * dummyFactors.infiltration.latentConstant * deltaW;
            rowHeatLoad = qSensible + qLatent;
            setVal(`${id}_heatLoad`, rowHeatLoad.toFixed(2));
          } else {
            rowHeatLoad = getNum(getVal(id, "heatLoad", row.values.heatLoad));
          }
        } else if (section.number === "5") {
          // ── Internal Heat (independent of design conditions) ──
          // Q = HeatGain × Quantity
          const gain = getNum(getVal(id, "heatGain", row.values.heatGain));
          const qty = getNum(getVal(id, "qty", row.values.qty));

          if (gain !== 0 && qty !== 0) {
            rowHeatLoad = gain * qty;
            setVal(`${id}_heatLoad`, rowHeatLoad.toFixed(2));
          } else {
            rowHeatLoad = getNum(getVal(id, "heatLoad", row.values.heatLoad));
          }
        } else if (section.number === "6") {
          // ── Ventilation ──
          // TotalFlowRate = (people × ratePerPerson) + (area × ratePerArea)
          // Q_sensible = flowRate × 1.2 × ΔT
          // Q_latent   = flowRate × 3000 × ΔW
          const application = getVal(id, "application", row.values.application);
          const peopleQty = getNum(getVal(id, "quantity", row.values.quantity));
          const areaQty = getNum(getVal(id, "areaQty", row.values.areaQty));

          const rates = (dummyFactors.ventilationRates as Record<string, { perPerson: number; perArea: number }>)[application]
            ?? dummyFactors.ventilationRates.default;

          const totalFlowRate = (peopleQty * rates.perPerson) + (areaQty * rates.perArea);

          if (totalFlowRate > 0) {
            setVal(`${id}_totalFlowRate`, totalFlowRate.toFixed(2));
          }

          if (totalFlowRate > 0 && (deltaT !== 0 || deltaW !== 0)) {
            const qSensible = totalFlowRate * 1.2 * deltaT;
            const qLatent = totalFlowRate * 3000 * deltaW;
            setVal(`${id}_sensible`, qSensible.toFixed(2));
            setVal(`${id}_latent`, qLatent.toFixed(2));
            rowHeatLoad = qSensible + qLatent;
            setVal(`${id}_heatLoad`, rowHeatLoad.toFixed(2));
          } else {
            rowHeatLoad = getNum(getVal(id, "heatLoad", row.values.heatLoad));
          }
        }

        totalHeatLoad += rowHeatLoad;
      });
    });

    const safetyStr = sheetValues["summary_1"];
    const safetyFactor = safetyStr ? getNum(safetyStr) : 0;
    const totalWithSafety = totalHeatLoad * (1 + safetyFactor / 100);

    const totalKW = totalWithSafety / 1000;
    const totalBtuHr = totalWithSafety * 3.412142;
    const totalRT = totalBtuHr / 12000;

    if (totalHeatLoad > 0 || sheetValues["summary_0"]) {
      setVal("summary_0", totalHeatLoad.toFixed(2));
      setVal("summary_2", totalKW.toFixed(2));
      setVal("summary_3", totalBtuHr.toFixed(2));
      setVal("summary_4", totalRT.toFixed(2));
    }

    if (Object.keys(updates).length > 0) {
      Object.entries(updates).forEach(([key, value]) => {
        onSheetChange(key, value);
      });
    }
  }, [sheetValues, onSheetChange, tOutdoor, tIndoor, deltaT, deltaW]);

  function handleCellChange(sectionNumber: string, rowId: string, key: string, value: string) {
    const updates: Record<string, string> = { [`${rowId}_${key}`]: value };

    // Find the row to get current values for dependent keys
    const section = sections.find((s) => s.number === sectionNumber);
    const row = section?.rows.find((r) => r.id === rowId);
    
    if (row && (key === "type" || key === "typeA" || key === "thickness" || key === "shading" || key === "application" || key === "item")) {
      const getRowVal = (k: string) => (k === key ? value : (sheetValues[`${rowId}_${k}`] ?? row.values[k]));

      if (sectionNumber === "1" || sectionNumber === "3") {
        const type = getRowVal("type") || getRowVal("typeA");
        updates[`${rowId}_uFactor`] = getDummyUFactor(type);
        updates[`${rowId}_cltd`] = getDummyCLTD(type);
      } else if (sectionNumber === "2") {
        const type = getRowVal("type");
        const shading = getRowVal("shading");
        const factors = getDummyGlassFactors(type, shading);
        updates[`${rowId}_sc`] = factors.sc;
        updates[`${rowId}_shg`] = factors.shg;
        updates[`${rowId}_clf`] = factors.clf;
      } else if (sectionNumber === "5") {
        const item = getRowVal("item");
        const app = getRowVal("application");
        updates[`${rowId}_heatGain`] = getDummyInternalGain(item, app);
      } else if (sectionNumber === "6") {
        const app = getRowVal("application");
        const factors = getDummyVentilation(app);
        updates[`${rowId}_sensible`] = factors.sensible;
        updates[`${rowId}_latent`] = factors.latent;
      }
    }

    setSections((currentSections) =>
      currentSections.map((section) =>
        section.number !== sectionNumber
          ? section
          : {
              ...section,
              rows: section.rows.map((r) => {
                if (r.id !== rowId) return r;
                const newValues = { ...r.values };
                Object.keys(updates).forEach((updateKey) => {
                  const cellKey = updateKey.replace(`${rowId}_`, "");
                  newValues[cellKey] = updates[updateKey];
                });
                return { ...r, values: newValues };
              }),
            },
      ),
    );

    Object.entries(updates).forEach(([k, v]) => {
      onSheetChange(k, v);
    });
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <SectionTable key={section.number} {...section} onCellChange={handleCellChange} />
      ))}

      <SummaryTable rows={summaryRows} sheetValues={sheetValues} onSheetChange={onSheetChange} />
    </div>
  );
}

function SectionTable({
  number,
  title,
  columns,
  rows,
  onCellChange,
}: Section & {
  onCellChange: (sectionNumber: string, rowId: string, key: string, value: string) => void;
}) {
  return (
    <table className={tableClass}>
      <colgroup>
        <col style={{ width: numberColumnWidth }} />
        {columns.map((column) => (
          <col key={column.key} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className={`${cellClass} bg-[#ffe7ee] text-center text-[11px] font-semibold whitespace-nowrap text-slate-900`}>{number}</th>
          <th className={`${cellClass} bg-[#ffe7ee] text-left text-[11px] font-semibold whitespace-nowrap text-slate-900`} colSpan={columns.length}>
            {title}
          </th>
        </tr>
        <tr>
          <th className={`${cellClass} bg-white text-center text-[10px] font-semibold whitespace-nowrap text-slate-900`} />
          {columns.map((column) => (
            <th key={column.key} className={`${cellClass} bg-white text-center text-[10px] font-semibold leading-tight whitespace-normal break-words text-slate-900`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={`${cellClass} bg-white text-center font-medium text-slate-900`}>{row.id}</td>
            {columns.map((column) => {
              const cellValue = row.values[column.key] ?? "";
              const cellOptions = row.selectOptions?.[column.key] ?? column.selectOptions ?? [];
              const hasSelect = cellOptions.length > 0;
              const fillClass = hasSelect || !column.editable ? "bg-[#fff4f7]" : "bg-white";

              return (
                <td key={column.key} className={`${cellClass} ${fillClass} p-0`}>
                  {hasSelect ? (
                    <SheetSelectCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={cellValue}
                      align={column.align ?? "left"}
                      options={cellOptions}
                      onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                    />
                  ) : column.editable ? (
                    <SheetInputCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={cellValue}
                      align={column.align ?? "left"}
                      onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                    />
                  ) : (
                    <SheetCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={cellValue}
                      align={column.align ?? "left"}
                      wrap={column.wrap}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryTable({
  rows,
  sheetValues,
  onSheetChange,
}: {
  rows: SummaryRow[];
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
}) {
  return (
    <table className={tableClass}>
      <colgroup>
        <col style={{ width: `calc(100% - ${summaryNoteWidth} - ${summaryValueWidth})` }} />
        <col style={{ width: summaryNoteWidth }} />
        <col style={{ width: summaryValueWidth }} />
      </colgroup>
      <tbody>
        {rows.map((row, index) => {
          const fieldKey = `summary_${index}`;

          return (
            <tr key={row.label}>
              <th className={`${cellClass} bg-[#fff4f7] text-left text-[11px] font-semibold whitespace-nowrap text-slate-900`}>{row.label}</th>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={sheetValues[`${fieldKey}_note`] ?? row.note ?? ""}
                  onChange={(event) => onSheetChange(`${fieldKey}_note`, event.target.value)}
                  className="min-h-[24px] w-full bg-transparent px-2 py-1 text-[10px] text-right text-slate-900 outline-none"
                />
              </td>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={sheetValues[fieldKey] ?? row.value ?? ""}
                  onChange={(event) => onSheetChange(fieldKey, event.target.value)}
                  className="min-h-[24px] w-full bg-transparent px-2 py-1 text-[10px] text-right text-slate-900 outline-none"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SheetCell({
  ariaLabel,
  value = "",
  align = "left",
  wrap = true,
}: {
  ariaLabel: string;
  value?: string;
  align?: Align;
  wrap?: boolean;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const wrapClass = wrap ? "whitespace-normal break-words" : "whitespace-nowrap";

  return (
    <div
      aria-label={ariaLabel}
      title={value}
      className={`min-h-[24px] h-full w-full px-1 py-1 text-[10px] leading-snug text-slate-900 ${alignClass} ${wrapClass}`}
    >
      {value || "\u00A0"}
    </div>
  );
}

function SheetInputCell({
  ariaLabel,
  value,
  align = "left",
  onValueChange,
}: {
  ariaLabel: string;
  value: string;
  align?: Align;
  onValueChange: (value: string) => void;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <input
      aria-label={ariaLabel}
      type="text"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className={`min-h-[24px] h-full w-full bg-transparent px-1 py-1 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
    />
  );
}

function SheetSelectCell({
  ariaLabel,
  value,
  align = "left",
  options,
  onValueChange,
}: {
  ariaLabel: string;
  value: string;
  align?: Align;
  options: readonly string[];
  onValueChange: (value: string) => void;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <div className="relative min-h-[24px] h-full w-full">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        title={value}
        className={`min-h-[24px] h-full w-full appearance-none cursor-pointer bg-[#fff4f7] px-1 py-1 pr-5 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-1 top-1/2 h-[6px] w-[10px] -translate-y-1/2 text-slate-900"
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
