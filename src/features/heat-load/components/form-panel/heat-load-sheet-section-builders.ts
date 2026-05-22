import {
  infiltrationMethodOptions,
  resolveAshraeInternalClf,
  resolveAshraeInternalHeatGain,
  resolveCurrentTd,
  resolveCurrentUFactor,
} from "./ashrae-calculations";
import { heatLoadLookupOptions } from "./heat-load-options";
import {
  SECTION4_REFERENCE,
  SECTION6_REFERENCE,
  getSection3Reference,
  getSection5Reference,
} from "./heat-load-row-references";
import section6Data from "./section-6-data.json";
import type { Section, SelectOptionsByKey } from "./heat-load-sheet-types";

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

function uFactor(type: string, thicknessMm = 0) {
  return resolveCurrentUFactor(type, undefined, thicknessMm).value.toFixed(2);
}

function td(type: string) {
  return resolveCurrentTd(type).value.toFixed(2);
}

export function getDefaultInternalGain(item: string, application: string, isLatent = false) {
  return resolveAshraeInternalHeatGain({ item, application, isLatent }).value.toFixed(2);
}

export function getDefaultClf(
  item: string,
  zoneType = "C",
  hoursInUse = "10",
  hoursAfterStart = "8",
  isLatent = false,
) {
  return resolveAshraeInternalClf({
    item,
    zoneType,
    hoursInUse: Number(hoursInUse),
    hoursAfterStart: Number(hoursAfterStart),
    isLatent,
  }).value.toFixed(2);
}

export function getDefaultVentilation(application: string) {
  const apps = section6Data.ventilation.applications as Record<string, { sensible: number; latent: number }>;
  const vent = apps[application] ?? section6Data.ventilation.default;
  return {
    sensible: vent.sensible.toFixed(2),
    latent: vent.latent.toFixed(2),
  };
}

export function buildSection3(): Section {
  return {
    number: "3",
    title: "Transmission heat gain Except outside wall and roof",
    columns: [
      { key: "item", label: "Item", width: "14%" },
      { key: "typeA", label: "Type", wrap: true, width: "14%" },
      { key: "typeB", label: "Detail", wrap: true, width: "16%" },
      { key: "thickness", label: "Thick.", unit: "thickness", align: "center", width: "16%", editable: true },
      { key: "uFactor", label: "U Factor", unit: "uFactor", align: "right", width: "10%", editable: true },
      { key: "cltd", label: "CLTD/TD", unit: "temperatureDelta", align: "right", width: "11%", editable: true },
      { key: "calcValue", label: "Area / Qty", unit: "area", align: "right", width: "10%", editable: true },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "9%", editable: true },
    ],
    rows: [
      {
        id: "3.1",
        values: {
          item: "All Glasses",
          typeA: "Single glass",
          typeB: "Glass only (Centre of Glass)",
          thickness: "6",
          reference: getSection3Reference("All Glasses"),
          uFactor: uFactor("Single glass"),
          cltd: td("Single glass"),
          calcValue: "",
          heatLoad: "",
        },
        selectOptions: allGlassesCellSelects,
      },
      {
        id: "3.2",
        values: {
          item: "Wall Partition",
          typeA: "Concrete Wall",
          typeB: "Not applicable",
          thickness: "215",
          reference: getSection3Reference("Wall Partition"),
          uFactor: uFactor("Concrete Wall", 215),
          cltd: td("Concrete Wall"),
          calcValue: "",
          heatLoad: "",
        },
        selectOptions: wallPartitionCellSelects,
      },
      {
        id: "3.3",
        values: {
          item: "Floor",
          typeA: "Intermediate Floor",
          typeB: "Concrete Wall",
          thickness: "100",
          reference: getSection3Reference("Floor"),
          uFactor: uFactor("Concrete Wall", 100),
          cltd: td("Concrete Wall"),
          calcValue: "",
          heatLoad: "",
        },
        selectOptions: floorCellSelects,
      },
    ],
  };
}

export function buildSection4(): Section {
  return {
    number: "4",
    title: "Infiltration",
    columns: [
      { key: "method", label: "Method", wrap: true, width: "14%" },
      { key: "componentA", label: "Component", width: "12%" },
      { key: "qty", label: "Qty", align: "right", width: "9%", editable: true },
      { key: "crackLength", label: "Crack length", unit: "length", align: "right", width: "13%", editable: true },
      { key: "componentB", label: "Component", wrap: true, width: "17%" },
      { key: "qtySecondary", label: "QTY", align: "right", width: "8%", editable: true },
      { key: "doorArea", label: "Door Area", unit: "area", align: "right", width: "10%", editable: true },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "10%", editable: true },
    ],
    rows: [
      {
        id: "4.1",
        values: {
          method: "Crack + Door",
          componentA: "Window",
          qty: "1",
          crackLength: "",
          componentB: "Residential door",
          qtySecondary: "1",
          doorArea: "",
          reference: SECTION4_REFERENCE,
          heatLoad: "",
        },
        selectOptions: {
          method: infiltrationMethodOptions,
          componentB: heatLoadLookupOptions.infiltrationDoorComponents,
        },
      },
    ],
  };
}

export function buildSection5(): Section {
  return {
    number: "5",
    title: "Internal Heat",
    columns: [
      { key: "item", label: "Item", wrap: true, width: "12%" },
      { key: "application", label: "Application", wrap: true, width: "34%" },
      { key: "heatGain", label: "Heat gain", unit: "heat", align: "right", width: "13%", editable: true },
      { key: "clf", label: "CLF", align: "right", width: "8%", editable: true },
      { key: "qty", label: "QTY", align: "right", width: "12%", editable: true },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "21%", editable: true },
    ],
    rows: [
      internalHeatRow("5.1", "People (sensible)", "Seated, very light work", false, "2"),
      internalHeatRow("5.2", "People (latent)", "Seated, very light work", true, "2"),
      internalHeatRow("5.3", "Motor power (Name plate)", "(0.04)"),
      internalHeatRow("5.4", "compact fluorescent lamp", "Fluorescent fixture, Fsa 1.20", false, "1"),
      internalHeatRow("5.5", "Appliance etc.", "Personal computer and 430 mm monitor", false, "1"),
      internalHeatRow("5.6", "Additional heat gain", "Miscellaneous equipment"),
    ],
  };
}

function internalHeatRow(id: string, item: string, application: string, isLatent = false, qty = "") {
  return {
    id,
    values: {
      item,
      application,
      zone: "C",
      hoursInUse: "10",
      hoursAfterStart: "8",
      reference: getSection5Reference(item),
      heatGain: getDefaultInternalGain(item, application, isLatent),
      clf: getDefaultClf(item, "C", "10", "8", isLatent),
      qty,
      heatLoad: "",
    },
    selectOptions: {
      application: getInternalApplicationOptions(item),
    },
  };
}

function getInternalApplicationOptions(item: string) {
  if (item.includes("People")) return heatLoadLookupOptions.peopleApplications;
  if (item.includes("Motor")) return heatLoadLookupOptions.motorPowerFactors;
  if (item.toLowerCase().includes("lamp")) return heatLoadLookupOptions.lampApplications;
  if (item.includes("Appliance")) return heatLoadLookupOptions.applianceApplications;
  return [];
}

export function buildSection6(): Section {
  return {
    number: "6",
    title: "Ventilation",
    columns: [
      { key: "application", label: "Application", width: "13%" },
      { key: "item", label: "Item", width: "10%" },
      { key: "quantity", label: "Quantity", align: "right", width: "8%", editable: true },
      { key: "area", label: "Area", width: "8%" },
      { key: "areaQty", label: "Area quantity", unit: "area", align: "right", width: "9%", editable: true },
      { key: "totalFlowRate", label: "Total flowrate", unit: "airflow", align: "right", width: "11%", editable: true },
      { key: "sensible", label: "Sensible heat", unit: "heat", align: "right", width: "8%", editable: true },
      { key: "latent", label: "Latent heat", unit: "heat", align: "right", width: "9%", editable: true },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "19%", editable: true },
    ],
    rows: [
      {
        id: "6.1",
        values: {
          application: "Bedroom / residential",
          item: "People",
          quantity: "2",
          area: "Area",
          areaQty: "",
          totalFlowRate: "",
          reference: SECTION6_REFERENCE,
          ...getDefaultVentilation("Bedroom / residential"),
          heatLoad: "",
        },
        selectOptions: { application: heatLoadLookupOptions.ventilationApplications },
      },
    ],
  };
}
