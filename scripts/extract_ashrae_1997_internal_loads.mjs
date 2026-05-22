import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("C:/tmp/ashrae-pdf-tools/node_modules/pdf-parse");

const F25_PDF =
  "e:/Ashrae/1997-20260520T200628Z-3-001/1997/1997 ASHRAE Fundamentals Handbook/F25S.PDF";
const F28_PDF =
  "e:/Ashrae/1997-20260520T200628Z-3-001/1997/1997 ASHRAE Fundamentals Handbook/F28S.PDF";
const OUTPUT_JSON =
  "d:/OAMK IT/3rd year/Thesis/hlc-bim-platform/src/features/heat-load/components/form-panel/ashrae-tables/internal-loads-1997.json";

const peopleHeatGainW = {
  "Seated at theater": { sensible: 65, latent: 30 },
  "Seated at theater, night": { sensible: 70, latent: 35 },
  "Seated, very light work": { sensible: 70, latent: 45 },
  "Moderately active office work": { sensible: 75, latent: 55 },
  "Standing, light work; walking": { sensible: 75, latent: 55 },
  "Walking, standing": { sensible: 75, latent: 70 },
  "Sedentary work": { sensible: 80, latent: 80 },
  "Light bench work": { sensible: 80, latent: 140 },
  "Moderate dancing": { sensible: 90, latent: 160 },
  "Walking 4.8 km/h; light machine work": { sensible: 110, latent: 185 },
  "Bowling": { sensible: 170, latent: 255 },
  "Heavy work": { sensible: 170, latent: 255 },
  "Heavy machine work; lifting": { sensible: 185, latent: 285 },
  "Athletics": { sensible: 210, latent: 315 },
  default: { sensible: 75, latent: 55 },
};

const motorHeatGainW = {
  "(0.04)": 105,
  "(0.06)": 170,
  "(0.09)": 264,
  "(0.12)": 340,
  "(0.19)": 346,
  "(0.25)": 439,
  "(0.37)": 621,
  "(0.56)": 776,
  "(0.75)": 993,
  "(1.10)": 1453,
  "(1.50)": 1887,
  "(2.20)": 2763,
  default: 346,
};

const lightingHeatGainW = {
  "User entered incandescent/tungsten watts": 100,
  "Fluorescent fixture, Fsa 1.20": 48,
  "Industrial discharge fixture, Fsa 1.20": 120,
  "Ventilated/recessed fixture, user adjusted": 80,
  default: 48,
};

const applianceHeatGainW = {
  "Personal computer and 430 mm monitor": 133,
  "380 mm energy-saver monitor": 78,
  "Laser printer": 248,
  "Desktop copier": 181,
  "Terminal": 130,
  "Typewriter": 67,
  "Small copier": 900,
  "Microwave oven": 400,
  "Water cooler": 1750,
  default: 133,
};

const ventilationRates = {
  "Drugstore / pharmacy": { perPerson: 7, perArea: 0 },
  "General application": { perPerson: 10, perArea: 0 },
  "Minimum occupant outdoor air": { perPerson: 8, perArea: 0 },
  "Office": { perPerson: 10, perArea: 0 },
  "Hospital operating room, 6 ACH at 3 m height": { perPerson: 0, perArea: 5 },
  "Manual outdoor-air flow": { perPerson: 0, perArea: 0 },
  default: { perPerson: 10, perArea: 0 },
};

function normalizeLine(value) {
  return value.trim().replace(/\s+/g, " ");
}

function numbersFrom(value) {
  return (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function parseClfTable(text, marker, validDurations) {
  const startIndex = text.indexOf(marker);
  if (startIndex < 0) throw new Error(`Could not find ${marker}`);

  const table = {};
  let zone = null;
  const rows = text.slice(startIndex).split(/\r?\n/);

  for (const rawLine of rows) {
    const line = normalizeLine(rawLine);
    const zoneMatch = line.match(/^Zone Type ([A-D])/);
    if (zoneMatch) {
      zone = zoneMatch[1];
      table[zone] = table[zone] ?? {};
      continue;
    }

    if (!zone) continue;

    const values = numbersFrom(line);
    if (!values.length || !validDurations.includes(values[0])) continue;

    if (values.length !== 25) {
      throw new Error(`${marker} zone ${zone}, duration ${values[0]} has ${values.length} numbers`);
    }

    table[zone][String(values[0])] = values.slice(1);
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
  const table37Text = await readPdfPage(F28_PDF, 51);
  const table38Text = await readPdfPage(F28_PDF, 52);
  const table39Text = await readPdfPage(F28_PDF, 53);

  const payload = {
    metadata: {
      datasetName: "ASHRAE 1997 Internal Load, CLF, Infiltration, and Ventilation Tables",
      unitSystem: "si",
      source: "1997 ASHRAE Handbook - Fundamentals, Chapters 25 and 28",
      sourcePdfs: { f25: F25_PDF, f28: F28_PDF },
      extractionScript: "scripts/extract_ashrae_1997_internal_loads.mjs",
      extractedTables: [
        "F28 Table 3 Rates of Heat Gain from Occupants of Conditioned Spaces",
        "F28 Table 4 Heat Gain from Typical Electric Motors",
        "F28 Table 9A Rate of Heat Gain from Selected Office Equipment",
        "F28 Table 37 Cooling Load Factors for People and Unhooded Equipment",
        "F28 Table 38 Cooling Load Factors for Lights",
        "F28 Table 39 Cooling Load Factors for Hooded Equipment",
        "F25 Table 3 Effective Air Leakage Areas",
      ],
      pdfChapterPages: {
        people: "28.8",
        motors: "28.10",
        officeEquipment: "28.14",
        peopleEquipmentClf: "28.51",
        lightingClf: "28.52",
        hoodedEquipmentClf: "28.53",
        ventilationText: "25.5, 28.11, 28.55",
        leakageAreas: "25.18",
      },
    },
    peopleHeatGainW,
    motorHeatGainW,
    lightingHeatGainW,
    applianceHeatGainW,
    clfTables: {
      peopleAndUnhoodedEquipment: parseClfTable(
        table37Text,
        "Table 37",
        [2, 4, 6, 8, 10, 12, 14, 16, 18],
      ),
      lights: parseClfTable(table38Text, "Table 38", [8, 10, 12, 14, 16]),
      hoodedEquipment: parseClfTable(
        table39Text,
        "Table 39",
        [2, 4, 6, 8, 10, 12, 14, 16, 18],
      ),
    },
    infiltration: {
      windowLeakageAreaCm2PerM: 0.31,
      doorFrameLeakageAreaCm2Each: 12,
      stackCoefficient: 0.00029,
      windCoefficient: 0.000231,
      airDensityCp: 1.23,
      latentConstant: 3010,
    },
    ventilationRates,
  };

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_JSON}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
