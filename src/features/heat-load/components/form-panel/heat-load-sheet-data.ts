import {
  resolveCurrentGlassFactors,
  resolveCurrentTd,
  resolveCurrentUFactor,
} from "./ashrae-calculations";
import { heatLoadLookupOptions } from "./heat-load-options";
import { buildSection3, buildSection4, buildSection5, buildSection6 } from "./heat-load-sheet-section-builders";
import type { Section, SelectOptionsByKey, SummaryRow } from "./heat-load-sheet-types";

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

const roofCellSelects: SelectOptionsByKey = {
  type: heatLoadLookupOptions.roofTypes,
  thickness: ["6", "80", "150"],
};

function getDefaultUFactor(type: string) {
  return resolveCurrentUFactor(type).value.toFixed(2);
}

function getDefaultTd(type: string, direction?: string) {
  return resolveCurrentTd(type, direction).value.toFixed(2);
}

function getDefaultGlassFactors(type: string, shading: string) {
  const factors = resolveCurrentGlassFactors(type, shading);
  return {
    sc: factors.sc.value.toFixed(2),
    shg: factors.shg.value.toFixed(2),
    clf: factors.clf.value.toFixed(2),
  };
}

export const summaryRows: SummaryRow[] = [
  { label: "Heat Load", note: "", value: "" },
  { label: "Safety factor", note: "", value: "" },
  { label: "Total Heat load (kW)", note: "", value: "" },
  { label: "Total Heat load (Btu/hr)", note: "", value: "" },
  { label: "Total Heat load (RT)", note: "", value: "" },
];

export function buildInitialSections(): Section[] {
  return [
    {
      number: "1",
      title: "Solar & Trans. Heat gain through the Glass-Wall & Roof",
      columns: [
        { key: "item", label: "Item", width: "8%" },
        { key: "direction", label: "Direction", wrap: true, width: "10%" },
        { key: "type", label: "Type", wrap: true, width: "24%" },
        { key: "thickness", label: "Thickness", unit: "thickness", align: "center", width: "16%", editable: true },
        { key: "uFactor", label: "U Factor", unit: "uFactor", align: "right", width: "9%", editable: true },
        { key: "cltd", label: "CLTD/TD", unit: "temperatureDelta", align: "right", width: "10%", editable: true },
        { key: "calcValue", label: "Area / Qty", unit: "area", align: "right", width: "10%", editable: true },
        { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "9%", editable: true },
      ],
      rows: [
        wallRow("1.1", "North", "Brick Wall", "215"),
        wallRow("1.2", "East", "Cement block Wall", "100"),
        wallRow("1.3", "South", "Cement block Wall", "100"),
        wallRow("1.4", "West", "Cement block Wall", "100"),
        {
          id: "1.5",
          values: {
            item: "Glass",
            direction: "Single glass",
            type: "Glass only (Centre of Glass)",
            thickness: "6",
            uFactor: getDefaultUFactor("Glass only (Centre of Glass)"),
            cltd: getDefaultTd("Glass only (Centre of Glass)"),
            calcValue: "",
            heatLoad: "",
          },
          selectOptions: {
            direction: heatLoadLookupOptions.transmissionGlassTypes,
            type: heatLoadLookupOptions.glassFrameTypes,
            thickness: heatLoadLookupOptions.glassThicknesses,
          },
        },
        {
          id: "1.6",
          values: {
            item: "Roof",
            direction: "HOR",
            type: "Concrete Slab Roof",
            thickness: "150",
            uFactor: getDefaultUFactor("Concrete Slab Roof"),
            cltd: getDefaultTd("Concrete Slab Roof", "HOR"),
            calcValue: "",
            heatLoad: "",
          },
          selectOptions: roofCellSelects,
        },
      ],
    },
    buildSection2(),
    buildSection3(),
    buildSection4(),
    buildSection5(),
    buildSection6(),
  ];
}

function wallRow(id: string, direction: string, type: string, thickness: string) {
  return {
    id,
    values: {
      item: "Wall",
      direction,
      type,
      thickness,
      uFactor: getDefaultUFactor(type),
      cltd: getDefaultTd(type, direction),
      calcValue: "",
      heatLoad: "",
    },
    selectOptions: wallCellSelects,
  };
}

function buildSection2(): Section {
  const row = (id: string, item: string, direction: string) => ({
    id,
    values: {
      item,
      direction,
      type: "Single Glass Clear",
      shading: "No shading",
      thickness: "6",
      ...getDefaultGlassFactors("Single Glass Clear", "No shading"),
      areaQty: "",
      result: "",
    },
    selectOptions: solarGlassCellSelects,
  });

  return {
    number: "2",
    title: "Solar Heat gain through the Glass",
    columns: [
      { key: "item", label: "Item", width: "7%" },
      { key: "direction", label: "Direction", width: "8%" },
      { key: "type", label: "Type", wrap: true, width: "20%" },
      { key: "shading", label: "Interior Shading type", wrap: true, width: "10%" },
      { key: "thickness", label: "Thick.", unit: "thickness", align: "center", width: "7%" },
      { key: "sc", label: "SC/SHGC", align: "right", width: "8%", editable: true },
      { key: "shg", label: "SHG", unit: "heatFlux", align: "right", width: "8%", editable: true },
      { key: "clf", label: "CLF/RTS", align: "right", width: "8%", editable: true },
      { key: "areaQty", label: "Area / Qty", unit: "area", align: "right", width: "10%", editable: true },
      { key: "result", label: "Total Heat load", unit: "heat", align: "right", width: "9%", editable: true },
    ],
    rows: [
      row("2.1", "Glass", "North"),
      row("2.2", "Glass", "East"),
      row("2.3", "Glass", "South"),
      row("2.4", "Glass", "West"),
      row("2.5", "Sky light", "HOR"),
    ],
  };
}
