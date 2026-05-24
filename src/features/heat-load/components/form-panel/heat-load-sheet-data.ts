import {
  resolveCurrentGlassFactors,
  resolveCurrentTransmissionGlassUFactor,
  resolveCurrentTd,
  resolveCurrentUFactor,
} from "./ashrae-calculations";
import {
  ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
  ASHRAE_TABLE5_DEFAULT_GLAZING_LABEL,
} from "./ashrae-calculations/fenestration-u-table5";
import { heatLoadLookupOptions } from "./heat-load-options";
import { getSection1Reference, getSection2Reference } from "./heat-load-row-references";
import { getDefaultRoofThicknessMm, roofDetailOptions } from "./ashrae-roof-assemblies";
import { buildSection3, buildSection4, buildSection5, buildSection6 } from "./heat-load-sheet-section-builders";
import type { Section, SelectOptionsByKey, SummaryRow } from "./heat-load-sheet-types";

const defaultRoofType = "Concrete Slab Roof";
const defaultRoofDetail = roofDetailOptions[0];
const defaultRoofThickness = String(getDefaultRoofThicknessMm(defaultRoofType));

const wallCellSelects: SelectOptionsByKey = {
  direction: heatLoadLookupOptions.directions,
  type: heatLoadLookupOptions.wallTypes,
  detail: ["Not applicable"],
  thickness: heatLoadLookupOptions.wallThicknesses,
};

const transmissionGlassCellSelects: SelectOptionsByKey = {
  type: heatLoadLookupOptions.transmissionGlassTypes,
  detail: heatLoadLookupOptions.glassFrameTypes,
  thickness: heatLoadLookupOptions.transmissionGlassThicknesses,
};

const solarGlassCellSelects: SelectOptionsByKey = {
  direction: heatLoadLookupOptions.directions,
  type: heatLoadLookupOptions.glassSolarTypes,
  shading: heatLoadLookupOptions.glassShadingTypes,
  thickness: heatLoadLookupOptions.glassThicknesses,
  zone: heatLoadLookupOptions.ashraeZoneTypes,
};

const solarSkylightCellSelects: SelectOptionsByKey = {
  direction: ["HOR"],
  type: heatLoadLookupOptions.horizontalSkylightSolarTypes,
  shading: heatLoadLookupOptions.glassShadingTypes,
  thickness: heatLoadLookupOptions.glassThicknesses,
  zone: heatLoadLookupOptions.ashraeZoneTypes,
};

const roofCellSelects: SelectOptionsByKey = {
  type: heatLoadLookupOptions.roofRouteTypes,
  detail: roofDetailOptions,
  thickness: ["6", "25", "150"],
};

function getDefaultUFactor(type: string, detail?: string, thicknessMm = 0) {
  return resolveCurrentUFactor(type, detail, thicknessMm).value.toFixed(2);
}

function getDefaultTd(type: string, direction?: string) {
  return resolveCurrentTd(type, direction).value.toFixed(2);
}

function getDefaultGlassFactors(type: string, shading: string, thicknessMm: number) {
  const factors = resolveCurrentGlassFactors(type, shading, thicknessMm);
  return {
    sc: factors.sc.value.toFixed(2),
    shg: factors.shg.value.toFixed(2),
    clf: factors.clf.value.toFixed(2),
  };
}

function getDefaultTransmissionGlassUFactor(glazingType: string, frameType: string, thicknessMm: number) {
  return resolveCurrentTransmissionGlassUFactor({
    glazingType,
    frameType,
    thicknessMm,
  }).value.toFixed(2);
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
        { key: "item", label: "Item", width: "7%" },
        { key: "direction", label: "Direction", wrap: true, width: "8%" },
        { key: "type", label: "Type", wrap: true, width: "27%" },
        { key: "detail", label: "Detail", wrap: true, width: "15%", editable: true },
        { key: "uFactor", label: "U Factor", unit: "uFactor", align: "right", width: "9%", editable: true },
        { key: "cltd", label: "CLTD/TD", unit: "temperatureDelta", align: "right", width: "9%", editable: true },
        { key: "calcValue", label: "Area / Qty", unit: "area", align: "right", width: "10%", editable: true },
        { key: "heatLoad", label: "Total Heat load", unit: "heat", align: "right", width: "10%", editable: true },
      ],
      rows: [
        wallRow("1.1", "North", "W04 Reinforced concrete frame with 200 mm cement block infill", "200"),
        wallRow("1.2", "East", "W04 Reinforced concrete frame with 200 mm cement block infill", "200"),
        wallRow("1.3", "South", "W04 Reinforced concrete frame with 200 mm cement block infill", "200"),
        wallRow("1.4", "West", "W04 Reinforced concrete frame with 200 mm cement block infill", "200"),
        {
          id: "1.5",
          values: {
            item: "Glass",
            direction: "All",
            type: ASHRAE_TABLE5_DEFAULT_GLAZING_LABEL,
            detail: ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
            thickness: "3",
            reference: getSection1Reference("Glass", ASHRAE_TABLE5_DEFAULT_GLAZING_LABEL, "All"),
            uFactor: getDefaultTransmissionGlassUFactor(
              ASHRAE_TABLE5_DEFAULT_GLAZING_LABEL,
              ASHRAE_TABLE5_DEFAULT_FRAME_LABEL,
              3,
            ),
            cltd: getDefaultTd("Single glass"),
            calcValue: "",
            heatLoad: "",
          },
          selectOptions: transmissionGlassCellSelects,
        },
        {
          id: "1.6",
          values: {
            item: "Roof",
            direction: "HOR",
            type: defaultRoofType,
            detail: defaultRoofDetail,
            thickness: defaultRoofThickness,
            reference: getSection1Reference("Roof", defaultRoofType, "HOR", defaultRoofDetail),
            uFactor: getDefaultUFactor(defaultRoofType, defaultRoofDetail, Number(defaultRoofThickness)),
            cltd: getDefaultTd(defaultRoofType, "HOR"),
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
      detail: "Not applicable",
      thickness,
      reference: getSection1Reference("Wall", type, direction),
      uFactor: getDefaultUFactor(type, "", Number(thickness)),
      cltd: getDefaultTd(type, direction),
      calcValue: "",
      heatLoad: "",
    },
    selectOptions: wallCellSelects,
  };
}

function buildSection2(): Section {
  const row = (
    id: string,
    item: string,
    direction: string,
    selectOptions = solarGlassCellSelects,
  ) => ({
    id,
    values: {
      item,
      direction,
      type: "Single clear glass",
      shading: "No inside shade",
      thickness: "6",
      zone: "C",
      reference: getSection2Reference(direction, "C", item),
      ...getDefaultGlassFactors("Single clear glass", "No inside shade", 6),
      areaQty: "",
      result: "",
    },
    selectOptions,
  });

  return {
    number: "2",
    title: "Solar Cooling Load through Glass and Skylights",
    columns: [
      { key: "item", label: "Item", width: "7%" },
      { key: "direction", label: "Direction", width: "8%" },
      { key: "type", label: "Type", wrap: true, width: "20%" },
      { key: "shading", label: "Shading detail", wrap: true, width: "10%" },
      { key: "thickness", label: "Thick.", unit: "thickness", align: "center", width: "7%" },
      { key: "zone", label: "Solar zone", align: "center", width: "9%" },
      { key: "sc", label: "SC", align: "right", width: "8%" },
      { key: "shg", label: "SHGF", unit: "heatFlux", align: "right", width: "8%" },
      { key: "clf", label: "CLF", align: "right", width: "8%" },
      { key: "areaQty", label: "Area / Qty", unit: "area", align: "right", width: "10%", editable: true },
      { key: "result", label: "Total Heat load", unit: "heat", align: "right", width: "9%", editable: true },
    ],
    rows: [
      row("2.1", "Glass", "North"),
      row("2.2", "Glass", "East"),
      row("2.3", "Glass", "South"),
      row("2.4", "Glass", "West"),
      row("2.5", "Skylight", "HOR", solarSkylightCellSelects),
    ],
  };
}
