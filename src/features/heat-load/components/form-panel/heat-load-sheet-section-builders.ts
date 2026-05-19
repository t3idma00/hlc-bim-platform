import { infiltrationMethodOptions, resolveCurrentTd, resolveCurrentUFactor } from "./ashrae-calculations";
import { heatLoadLookupOptions } from "./heat-load-options";
import section5Data from "./section-5-data.json";
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

function uFactor(type: string) {
  return resolveCurrentUFactor(type).value.toFixed(2);
}

function td(type: string) {
  return resolveCurrentTd(type).value.toFixed(2);
}

export function getDefaultInternalGain(item: string, application: string, isLatent = false) {
  if (item === "Motor power (Name plate)") {
    const motorPower = section5Data.internalGains.motorPower as Record<string, number>;
    const power = motorPower[application];
    if (power !== undefined) return power.toFixed(2);

    const parsedPower = Number.parseFloat(application.replace(/[()]/g, ""));
    if (Number.isFinite(parsedPower)) return (parsedPower * 1000).toFixed(2);
  }

  if (item === "People (sensible)" || item === "People (latent)" || item === "People") {
    const people = section5Data.internalGains.people as Record<string, { sensible: number; latent: number }>;
    const gains = people[application] ?? section5Data.internalGains.people.default;
    return (item === "People (latent)" || isLatent ? gains.latent : gains.sensible).toFixed(2);
  }

  if (item === "compact fluorescent lamp" || item === "Lamp") {
    const lamps = section5Data.internalGains.lamps as Record<string, number>;
    return (lamps[application] ?? section5Data.internalGains.lamps.default).toFixed(2);
  }

  if (item === "Appliance etc.") {
    const appliances = section5Data.internalGains.appliances as Record<string, number>;
    return (appliances[application] ?? section5Data.internalGains.appliances.default).toFixed(2);
  }

  const items = section5Data.internalGains.items as Record<string, number>;
  return (items[item] ?? section5Data.internalGains.items.default).toFixed(2);
}

export function getDefaultClf(item: string) {
  const values = section5Data.internalGains.clf as Record<string, number>;
  return (values[item] ?? section5Data.internalGains.clf.default).toFixed(2);
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
          uFactor: uFactor("Concrete Wall"),
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
          uFactor: uFactor("Concrete Wall"),
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
          componentB: "Nonresidential door",
          qtySecondary: "1",
          doorArea: "",
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
      { key: "application", label: "Application", wrap: true, width: "26%" },
      { key: "heatGain", label: "Heat gain", unit: "heat", align: "right", width: "12%", editable: true },
      { key: "clf", label: "CLF", align: "right", width: "8%", editable: true },
      { key: "qty", label: "QTY", align: "right", width: "16%", editable: true },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "17%", editable: true },
    ],
    rows: [
      internalHeatRow("5.1", "People (sensible)", "Standing, light work or walking"),
      internalHeatRow("5.2", "People (latent)", "Standing, light work or walking", true),
      internalHeatRow("5.3", "Motor power (Name plate)", "(0.04)"),
      internalHeatRow("5.4", "compact fluorescent lamp", "Office"),
      internalHeatRow("5.5", "Appliance etc.", "Medium, desktop type"),
      internalHeatRow("5.6", "Additional heat gain", "Miscellaneous equipment"),
    ],
  };
}

function internalHeatRow(id: string, item: string, application: string, isLatent = false) {
  return {
    id,
    values: {
      item,
      application,
      heatGain: getDefaultInternalGain(item, application, isLatent),
      clf: getDefaultClf(item),
      qty: "",
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
  if (item.includes("lamp")) return heatLoadLookupOptions.lampApplications;
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
          application: "Pharmacy",
          item: "People",
          quantity: "",
          area: "Area",
          areaQty: "",
          totalFlowRate: "",
          ...getDefaultVentilation("Pharmacy"),
          heatLoad: "",
        },
        selectOptions: { application: heatLoadLookupOptions.ventilationApplications },
      },
    ],
  };
}
