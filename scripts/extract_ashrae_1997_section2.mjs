import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("C:/tmp/ashrae-pdf-tools/node_modules/pdf-parse");

const F28_PDF =
  "e:/Ashrae/1997-20260520T200628Z-3-001/1997/1997 ASHRAE Fundamentals Handbook/F28S.PDF";
const F29_PDF =
  "e:/Ashrae/1997-20260520T200628Z-3-001/1997/1997 ASHRAE Fundamentals Handbook/F29S.PDF";
const OUTPUT_JSON =
  "d:/OAMK IT/3rd year/Thesis/hlc-bim-platform/src/features/heat-load/components/form-panel/ashrae-tables/section-2-1997.json";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shgfPagesByLatitude = { 16: 29, 24: 30, 32: 31, 40: 32, 48: 33, 56: 34, 64: 35 };
const amDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "Hor"];
const pmDirections = ["N", "NNW", "NW", "WNW", "W", "WSW", "SW", "SSW", "S", "SSE", "SE", "ESE", "E", "ENE", "NE", "NNE", "Hor"];

const glassTypes = [
  {
    label: "Single clear glass",
    aliases: ["Single Glass Clear", "single clear", "clear single glass"],
    sourceTables: ["F29 Table 11", "F29 Table 25", "F29 Table 29"],
    thicknesses: {
      "3": glassRecord(1.0, clearBlindRoller(), drapery([0.87, 0.82, 0.74, 0.69, 0.64, 0.59, 0.53, 0.48, 0.42, 0.37])),
      "6": glassRecord(0.95, clearBlindRoller(), drapery([0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35])),
      "13": glassRecord(0.88, clearBlindRoller(), drapery([0.74, 0.7, 0.66, 0.61, 0.56, 0.52, 0.48, 0.43, 0.39, 0.35])),
    },
  },
  {
    label: "Single heat-absorbing glass",
    aliases: ["Single Glass Heat Absorbing", "heat absorbing single glass", "single tinted glass"],
    sourceTables: ["F29 Table 11", "F29 Table 25", "F29 Table 29"],
    thicknesses: {
      "6": glassRecord(0.67, heatAbsorbingBlindRoller(), drapery([0.57, 0.54, 0.52, 0.49, 0.46, 0.44, 0.41, 0.38, 0.36, 0.33])),
      "10": glassRecord(0.5, lowTransmittanceBlindRoller(), drapery([0.43, 0.42, 0.4, 0.39, 0.38, 0.36, 0.34, 0.33, 0.32, 0.3])),
      "13": glassRecord(0.5, lowTransmittanceBlindRoller(), drapery([0.43, 0.42, 0.4, 0.39, 0.38, 0.36, 0.34, 0.33, 0.32, 0.3])),
    },
  },
  {
    label: "Insulating clear glass, 6 mm air space",
    aliases: ["Insulating Glass Clear out Clear In", "double clear glass", "clear insulating glass"],
    sourceTables: ["F29 Table 11", "F29 Table 26", "F29 Table 29"],
    thicknesses: {
      "3": glassRecord(0.89, insulatingClearBlindRoller(), drapery([0.75, 0.71, 0.65, 0.63, 0.57, 0.53, 0.48, 0.45, 0.38, 0.36])),
      "6": glassRecord(0.81, insulatingClearBlindRoller(), drapery([0.75, 0.71, 0.65, 0.63, 0.57, 0.53, 0.48, 0.45, 0.38, 0.36])),
    },
  },
  {
    label: "Insulating clear glass, 13 mm air space",
    aliases: ["double clear glass 13 mm air", "clear insulating glass 13 mm air"],
    sourceTables: ["F29 Table 11", "F29 Table 26", "F29 Table 29"],
    thicknesses: {
      "3": glassRecord(0.83, insulatingClearBlindRoller(), drapery([0.66, 0.62, 0.58, 0.56, 0.52, 0.48, 0.45, 0.42, 0.37, 0.35])),
      "6": glassRecord(0.81, insulatingClearBlindRoller(), drapery([0.66, 0.62, 0.58, 0.56, 0.52, 0.48, 0.45, 0.42, 0.37, 0.35])),
    },
  },
  {
    label: "Insulating heat-absorbing out / clear in",
    aliases: ["Insulating Glass Heat Absorbing out Clear In", "heat absorbing out clear in"],
    sourceTables: ["F29 Table 11", "F29 Table 26", "F29 Table 29"],
    thicknesses: {
      "6": glassRecord(0.55, insulatingHeatAbsorbingBlindRoller(), drapery([0.49, 0.47, 0.45, 0.43, 0.41, 0.39, 0.37, 0.35, 0.33, 0.32])),
    },
  },
];

const domedHorizontalSkylights = [
  domeSkylight("Clear dome with translucent diffuser - no curb", "Clear, tau 0.86", "Translucent, tau 0.58", 0, "infinity", 0.61),
  domeSkylight("Clear dome with translucent diffuser - 9 in curb", "Clear, tau 0.86", "Translucent, tau 0.58", 9, "5", 0.58),
  domeSkylight("Clear dome with translucent diffuser - 18 in curb", "Clear, tau 0.86", "Translucent, tau 0.58", 18, "2.5", 0.5),
  domeSkylight("Clear dome without diffuser - no curb", "Clear, tau 0.86", "None", 0, "infinity", 0.99),
  domeSkylight("Clear dome without diffuser - 9 in curb", "Clear, tau 0.86", "None", 9, "5", 0.88),
  domeSkylight("Clear dome without diffuser - 18 in curb", "Clear, tau 0.86", "None", 18, "2.5", 0.8),
  domeSkylight("Translucent dome - medium transmission - no curb", "Translucent, tau 0.52", "None", 0, "infinity", 0.57),
  domeSkylight("Translucent dome - medium transmission - 18 in curb", "Translucent, tau 0.52", "None", 18, "2.5", 0.46),
  domeSkylight("Translucent dome - low transmission - no curb", "Translucent, tau 0.27", "None", 0, "infinity", 0.34),
  domeSkylight("Translucent dome - low transmission - 9 in curb", "Translucent, tau 0.27", "None", 9, "5", 0.3),
  domeSkylight("Translucent dome - low transmission - 18 in curb", "Translucent, tau 0.27", "None", 18, "2.5", 0.28),
];

function domeSkylight(label, dome, lightDiffuser, curbHeightIn, widthToHeightRatio, shadingCoefficient) {
  return { label, dome, lightDiffuser, curbHeightIn, widthToHeightRatio, shadingCoefficient };
}

function glassRecord(glassAloneSc, blindRollerSc, draperySc) {
  return { glassAloneSc, shadingSc: { "No inside shade": glassAloneSc, ...blindRollerSc, ...draperySc } };
}

function clearBlindRoller() {
  return {
    "Venetian blinds - medium": 0.74,
    "Venetian blinds - light": 0.67,
    "Venetian blinds - medium closed": 0.63,
    "Venetian blinds - light closed": 0.58,
    "Roller shade - opaque dark": 0.81,
    "Roller shade - opaque white": 0.39,
    "Roller shade - translucent light": 0.44,
  };
}

function heatAbsorbingBlindRoller() {
  return {
    "Venetian blinds - medium": 0.57,
    "Venetian blinds - light": 0.53,
    "Roller shade - opaque dark": 0.45,
    "Roller shade - opaque white": 0.3,
    "Roller shade - translucent light": 0.36,
  };
}

function lowTransmittanceBlindRoller() {
  return {
    "Venetian blinds - medium": 0.42,
    "Venetian blinds - light": 0.4,
    "Roller shade - opaque dark": 0.36,
    "Roller shade - opaque white": 0.28,
    "Roller shade - translucent light": 0.31,
  };
}

function insulatingClearBlindRoller() {
  return {
    "Venetian blinds - medium": 0.62,
    "Venetian blinds - light": 0.58,
    "Venetian blinds - medium closed": 0.63,
    "Venetian blinds - light closed": 0.58,
    "Roller shade - opaque dark": 0.71,
    "Roller shade - opaque white": 0.35,
    "Roller shade - translucent light": 0.4,
  };
}

function insulatingHeatAbsorbingBlindRoller() {
  return {
    "Venetian blinds - medium": 0.39,
    "Venetian blinds - light": 0.36,
    "Roller shade - opaque dark": 0.4,
    "Roller shade - opaque white": 0.22,
    "Roller shade - translucent light": 0.3,
  };
}

function drapery(values) {
  return Object.fromEntries(values.map((value, index) => [`Drapery ${String.fromCharCode(65 + index)}`, value]));
}

function normalizeLine(value) {
  return value.trim().replace(/\s+/g, " ");
}

function numbersFrom(value) {
  return (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function parseSclTable(text) {
  const zones = {};
  let zone = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    const zoneMatch = line.match(/Zone Type ([A-D])/);
    if (zoneMatch) {
      zone = zoneMatch[1];
      zones[zone] = zones[zone] ?? {};
      continue;
    }

    const rowMatch = line.match(/^(N|NE|E|SE|S|SW|W|NW|Hor)\s+(.+)$/);
    if (!zone || !rowMatch) continue;

    const values = numbersFrom(rowMatch[2]);
    if (values.length !== 24) {
      throw new Error(`Unexpected SCL row length for zone ${zone} ${rowMatch[1]}: ${values.length}`);
    }
    zones[zone][rowMatch[1]] = values;
  }

  return zones;
}

function addShgfRow(target, month, numbers, page) {
  let row = numbers;

  if (page === 33 && month === "May" && numbers[0] === 12 && numbers.length === 19) {
    row = [...numbers.slice(0, 15), 114, ...numbers.slice(15)];
  }

  if (row.length !== 20) {
    throw new Error(`Unexpected SHGF row length on F29 page ${page}, ${month}: ${row.length}`);
  }

  const amHour = row[0];
  const values = row.slice(2, 19);
  const pmHour = amHour === 12 ? 12 : 24 - amHour;

  target[month] = target[month] ?? {};
  target[month][String(amHour)] = target[month][String(amHour)] ?? {};
  target[month][String(pmHour)] = target[month][String(pmHour)] ?? {};

  amDirections.forEach((direction, index) => {
    target[month][String(amHour)][direction] = values[index];
  });
  pmDirections.forEach((direction, index) => {
    target[month][String(pmHour)][direction] = values[index];
  });
}

function parseShgfTable(text, page) {
  const table = {};
  let currentMonth = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (!line || line.includes("HALF DAY") || line.startsWith("Table") || line.startsWith("Date")) {
      continue;
    }

    const monthMatch = line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(.+)$/);
    let body = line;

    if (monthMatch) {
      currentMonth = monthMatch[1];
      body = monthMatch[2];
    }

    if (!currentMonth || !/^\d+\s+/.test(body)) continue;
    addShgfRow(table, currentMonth, numbersFrom(body), page);
  }

  return table;
}

async function readPdfPage(pdfPath, page) {
  const parser = new PDFParse({ data: readFileSync(pdfPath) });
  const text = (await parser.getText({ partial: [page] })).text;
  await parser.destroy();
  return text;
}

async function main() {
  const sclText = await readPdfPage(F28_PDF, 50);
  const shgfTables = {};

  for (const [latitude, page] of Object.entries(shgfPagesByLatitude)) {
    shgfTables[latitude] = parseShgfTable(await readPdfPage(F29_PDF, page), page);
  }

  const payload = {
    metadata: {
      datasetName: "ASHRAE 1997 Section 2 Solar Glass Tables",
      unitSystem: "si",
      source: "1997 ASHRAE Handbook - Fundamentals, Chapters 28 and 29",
      sourcePdfs: { f28: F28_PDF, f29: F29_PDF },
      extractionScript: "scripts/extract_ashrae_1997_section2.mjs",
      extractedTables: [
        "F28 Table 36 July Solar Cooling Load for Sunlit Glass at 40 deg North Latitude",
        "F29 Table 11 Visible Transmission, SC, and SHGC glazing rows used for glass-alone SC",
        "F29 Tables 15-21 Solar Heat Gain Factors for 16-64 deg North Latitude",
        "F29 Table 12 Shading Coefficients for Domed Horizontal Skylights",
        "F29 Table 25 Indoor Shading Coefficients for Single Glass",
        "F29 Table 26 Indoor Shading Coefficients for Insulating Glass",
        "F29 Table 29 Shading Coefficients for Single and Insulating Glass with Draperies",
      ],
      pdfChapterPages: {
        sclTable36: "28.50",
        glassScTable11: "29.25-29.26",
        shgfTables15To21: "29.29-29.35",
        domedSkylightTable12: "29.26",
        shadingTables25To26: "29.38",
        draperyTable29: "29.40",
      },
      notes: [
        "Table 36 SCL values are W/m2 and are converted to CLF at runtime by dividing by the matching 40 deg North July ASHRAE SHGF.",
        "For southern latitudes, the runtime resolver uses the equivalent northern month shifted by six months.",
      ],
      months: monthNames,
      directions: amDirections,
      zoneTypes: ["A", "B", "C", "D"],
    },
    glassTypes,
    domedHorizontalSkylights,
    sclTable36WPerM2: parseSclTable(sclText),
    shgfTablesWPerM2: shgfTables,
  };

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_JSON}`);
  console.log(`Glass systems: ${glassTypes.length}`);
  console.log(`SHGF latitude tables: ${Object.keys(shgfTables).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
