import {
  SECTION3_ASSEMBLY_U_FACTOR,
  SECTION3_INTERMEDIATE_FLOOR,
  SECTION3_UNKNOWN_ADJACENT_SPACE,
  resolveAshraeInternalClf,
  resolveAshraeInternalHeatGain,
  resolveCurrentUFactor,
  section3AdjacentSpaceTypes,
  section3FloorTypes,
} from "./ashrae-calculations";
import {
  ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
  ASHRAE_TABLE5_DEFAULT_GLAZING_LABEL,
} from "./ashrae-calculations/fenestration-u-table5";
import { heatLoadLookupOptions } from "./heat-load-options";
import { getDefaultRoofThicknessMm, roofDetailOptions, type RoofExposure } from "./ashrae-roof-assemblies";
import {
  SECTION4_REFERENCE,
  SECTION6_REFERENCE,
  getSection3Reference,
  getSection5Reference,
} from "./heat-load-row-references";
import section6Data from "./section-6-data.json";
import type { Section, SelectOptionsByKey } from "./heat-load-sheet-types";

type VentilationRate = {
  perPerson: number;
  perArea: number;
};

const allGlassesCellSelects: SelectOptionsByKey = {
  typeA: heatLoadLookupOptions.interiorTransmissionGlassTypes,
  typeB: [ASHRAE_TABLE5_DEFAULT_FRAME_LABEL],
  thickness: heatLoadLookupOptions.transmissionGlassThicknesses,
  adjacentSpaceType: section3AdjacentSpaceTypes,
};

const wallPartitionCellSelects: SelectOptionsByKey = {
  typeA: heatLoadLookupOptions.interiorPartitionWallTypes,
  typeB: ["Not applicable"],
  adjacentSpaceType: section3AdjacentSpaceTypes,
};

const floorCellSelects: SelectOptionsByKey = {
  typeA: section3FloorTypes,
  typeB: [
    "100 mm concrete wall + finish + plaster",
    "Not applicable",
  ],
  adjacentSpaceType: section3AdjacentSpaceTypes,
};

const roofCeilingCellSelects: SelectOptionsByKey = {
  typeA: heatLoadLookupOptions.roofTypes,
  typeB: roofDetailOptions,
  thickness: ["6", "25", "150"],
  adjacentSpaceType: section3AdjacentSpaceTypes,
};

function uFactor(type: string, detail?: string, thicknessMm = 0, roofExposure: RoofExposure = "exterior") {
  return resolveCurrentUFactor(type, detail, thicknessMm, roofExposure).value.toFixed(2);
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
  const rate = getVentilationRate(application);
  const vent = section6Data.ventilation.default;
  return {
    peopleOutdoorAirRate: rate.perPerson.toFixed(2),
    areaOutdoorAirRate: rate.perArea.toFixed(2),
    sensible: vent.sensible.toFixed(2),
    latent: vent.latent.toFixed(2),
  };
}

export function getVentilationRate(application: string) {
  const rates = section6Data.ventilationRates as Record<string, VentilationRate>;
  return rates[application] ?? rates.default;
}

export function buildSection3(): Section {
  const partitionRow = (id: string, direction: string) => ({
    id,
    values: {
      item: "Wall Partition",
      direction,
      typeA: "W12 Simple 200 mm concrete wall with cement plaster",
      typeB: "Not applicable",
      thickness: "200",
      uFactorMode: SECTION3_ASSEMBLY_U_FACTOR,
      adjacentSpaceType: SECTION3_UNKNOWN_ADJACENT_SPACE,
      adjacentTemperature: "",
      indoorTemperature: "",
      reference: getSection3Reference("Wall Partition"),
      uFactor: uFactor("W12 Simple 200 mm concrete wall with cement plaster", undefined, 200),
      cltd: "",
      calcValue: "",
      heatLoad: "",
    },
    selectOptions: wallPartitionCellSelects,
  });

  return {
    number: "3",
    title: "Transmission heat gain through interior/intermediate surfaces",
    columns: [
      { key: "item", label: "Item", wrap: true, width: "11%" },
      { key: "direction", label: "Direction", wrap: true, width: "10%" },
      { key: "typeA", label: "Type", wrap: true, width: "17%", editable: true },
      { key: "typeB", label: "Construction", wrap: true, width: "17%", editable: true },
      { key: "adjacentTemperature", label: "Adj. temp", unit: "temperature", align: "right", width: "9%", editable: true },
      { key: "uFactor", label: "U Factor", unit: "uFactor", align: "right", width: "8%" },
      { key: "cltd", label: "TD", unit: "temperatureDelta", align: "right", width: "7%" },
      { key: "calcValue", label: "Area", unit: "area", align: "right", width: "9%", editable: true },
      { key: "heatLoad", label: "Heat gain", unit: "heat", align: "right", width: "12%" },
    ],
    rows: [
      {
        id: "3.1",
        values: {
          item: "All Glasses",
          direction: "Interior",
          typeA: ASHRAE_TABLE5_DEFAULT_GLAZING_LABEL,
          typeB: ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
          thickness: "6",
          uFactorMode: SECTION3_ASSEMBLY_U_FACTOR,
          adjacentSpaceType: SECTION3_UNKNOWN_ADJACENT_SPACE,
          adjacentTemperature: "",
          indoorTemperature: "",
          reference: getSection3Reference("All Glasses"),
          uFactor: "",
          cltd: "",
          calcValue: "",
          heatLoad: "",
        },
        selectOptions: allGlassesCellSelects,
      },
      partitionRow("3.2N", "North"),
      partitionRow("3.2E", "East"),
      partitionRow("3.2S", "South"),
      partitionRow("3.2W", "West"),
      {
        id: "3.3",
        values: {
          item: "Floor",
          direction: "HOR",
          typeA: SECTION3_INTERMEDIATE_FLOOR,
          typeB: "100 mm concrete wall + finish + plaster",
          thickness: "100",
          uFactorMode: SECTION3_ASSEMBLY_U_FACTOR,
          adjacentSpaceType: SECTION3_UNKNOWN_ADJACENT_SPACE,
          adjacentTemperature: "",
          indoorTemperature: "",
          reference: getSection3Reference("Floor", SECTION3_INTERMEDIATE_FLOOR),
          uFactor: uFactor("100 mm concrete wall + finish + plaster", undefined, 100),
          cltd: "",
          calcValue: "",
          heatLoad: "",
        },
        selectOptions: floorCellSelects,
      },
      {
        id: "3.4",
        values: {
          item: "Roof/Ceiling",
          direction: "Intermediate",
          typeA: "Concrete Slab Roof",
          typeB: roofDetailOptions[0],
          thickness: String(getDefaultRoofThicknessMm("Concrete Slab Roof")),
          uFactorMode: SECTION3_ASSEMBLY_U_FACTOR,
          adjacentSpaceType: SECTION3_UNKNOWN_ADJACENT_SPACE,
          adjacentTemperature: "",
          indoorTemperature: "",
          reference: getSection3Reference("Roof/Ceiling", "Concrete Slab Roof", roofDetailOptions[0]),
          uFactor: uFactor(
            "Concrete Slab Roof",
            roofDetailOptions[0],
            getDefaultRoofThicknessMm("Concrete Slab Roof"),
            "intermediate",
          ),
          cltd: "",
          calcValue: "",
          heatLoad: "",
        },
        selectOptions: roofCeilingCellSelects,
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
      { key: "componentA", label: "Window Component", width: "14%" },
      { key: "qty", label: "Window Qty", align: "right", width: "9%", editable: true },
      { key: "crackLength", label: "Window Crack Length", unit: "length", align: "right", width: "18%", editable: true },
      { key: "componentB", label: "Door Component", wrap: true, width: "16%" },
      { key: "qtySecondary", label: "Door Frame Qty", align: "right", width: "12%", editable: true },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "12%", editable: true },
    ],
    rows: [
      {
        id: "4.1",
        values: {
          method: "ASHRAE Stack-Wind",
          componentA: "Window crack",
          qty: "1",
          crackLength: "",
          componentB: "Door frame",
          qtySecondary: "1",
          reference: SECTION4_REFERENCE,
          heatLoad: "",
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
      { key: "item", label: "Item", wrap: true, width: "11%" },
      { key: "application", label: "Application", wrap: true, width: "27%" },
      { key: "hoursInUse", label: "Operational hour (h)", align: "right", width: "10%", editable: true },
      { key: "heatGain", label: "Sensible gain", unit: "heat", align: "right", width: "11%", editable: true },
      { key: "latentGain", label: "Latent gain", unit: "heat", align: "right", width: "10%", editable: true },
      { key: "clf", label: "CLF", align: "right", width: "8%", editable: true },
      { key: "qty", label: "QTY", align: "right", width: "8%", editable: true },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "15%", editable: true },
    ],
    rows: [
      internalHeatRow("5.1", "People", "Seated, very light work", "2"),
      internalHeatRow("5.2", "Motor power (Name plate)", "(0.04)"),
      internalHeatRow("5.3", "compact fluorescent lamp", "Fluorescent fixture, Fsa 1.20", "1"),
      internalHeatRow("5.4", "Appliance etc.", "Personal computer and 430 mm monitor", "1"),
      internalHeatRow("5.5", "Additional heat gain", "Miscellaneous equipment"),
    ],
  };
}

function internalHeatRow(id: string, item: string, application: string, qty = "") {
  const isPeople = item.includes("People");

  return {
    id,
    values: {
      item,
      application,
      zone: "C",
      hoursInUse: "10",
      hoursAfterStart: "8",
      reference: getSection5Reference(item),
      heatGain: getDefaultInternalGain(item, application),
      latentGain: isPeople ? getDefaultInternalGain(item, application, true) : "",
      clf: getDefaultClf(item, "C", "10", "8"),
      qty,
      heatLoad: "",
    },
    selectOptions: {
      application: getInternalApplicationOptions(item),
      hoursInUse: getInternalOperationalHourOptions(item),
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

function getInternalOperationalHourOptions(item: string) {
  if (item.toLowerCase().includes("lamp")) return ["8", "10", "12", "14", "16"];
  if (item.includes("Additional")) return [];
  return ["2", "4", "6", "8", "10", "12", "14", "16", "18"];
}

export function buildSection6(): Section {
  return {
    number: "6",
    title: "Ventilation",
    columns: [
      { key: "application", label: "Occupancy category", wrap: true, width: "15%" },
      { key: "item", label: "Item", width: "5%" },
      { key: "quantity", label: "People", align: "right", width: "6%", editable: true },
      { key: "peopleOutdoorAirRate", label: "People OA rate (L/s-person)", align: "right", width: "8%" },
      { key: "area", label: "Area", width: "4%" },
      { key: "areaQty", label: "Floor area (m2)", align: "right", width: "8%" },
      { key: "areaOutdoorAirRate", label: "Area OA rate (L/s-m2)", align: "right", width: "8%" },
      { key: "totalFlowRate", label: "Total flowrate", unit: "airflow", align: "right", width: "10%", editable: true },
      { key: "sensible", label: "Sensible heat", unit: "heat", align: "right", width: "8%" },
      { key: "latent", label: "Latent heat", unit: "heat", align: "right", width: "9%" },
      { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "14%" },
    ],
    rows: [
      {
        id: "6.1",
        values: {
          application: "Bed room, Living Room",
          item: "People",
          quantity: "2",
          area: "Area",
          areaQty: "",
          totalFlowRate: "",
          reference: SECTION6_REFERENCE,
          ...getDefaultVentilation("Bed room, Living Room"),
          heatLoad: "",
        },
        selectOptions: { application: heatLoadLookupOptions.ventilationApplications },
      },
    ],
  };
}
