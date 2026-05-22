import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { PDFParse } = require("C:/tmp/ashrae-pdf-tools/node_modules/pdf-parse");

const SOURCE_PDF =
  "e:/Ashrae/1997-20260520T200628Z-3-001/1997/1997 ASHRAE Fundamentals Handbook/F28S.PDF";
const OUTPUT_JSON =
  "d:/OAMK IT/3rd year/Thesis/hlc-bim-platform/src/features/heat-load/components/form-panel/ashrae-tables/cltd-1997.json";

const directions = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];
const directionMap = {
  N: "North",
  NE: "Northeast",
  E: "East",
  SE: "Southeast",
  S: "South",
  SW: "Southwest",
  W: "West",
  NW: "Northwest",
};

function normalize(value) {
  return value.replace(/−/g, "-");
}

function numbersFrom(value) {
  return normalize(value)
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((item) => Number.isFinite(item));
}

function parseRoofTable(text) {
  const roof = {};

  for (const line of text.split(/\r?\n/)) {
    const match = normalize(line).match(/^(1|2|3|4|5|8|9|10|13|14)\s+(.+)$/);
    if (!match) continue;

    const values = numbersFrom(match[2]);
    if (values.length === 24) {
      roof[match[1]] = values;
    }
  }

  return roof;
}

function parseWallTable(textByPage) {
  const walls = {};
  let wallNumber = null;

  for (const page of [43, 44, 45]) {
    for (const line of textByPage[page].split(/\r?\n/)) {
      const wallMatch = line.match(/Wall Number\s+(\d+)/);
      if (wallMatch) {
        wallNumber = wallMatch[1];
        walls[wallNumber] = walls[wallNumber] ?? {};
        continue;
      }

      const rowMatch = normalize(line).match(/^(N|NE|E|SE|S|SW|W|NW)\s+(.+)$/);
      if (!wallNumber || !rowMatch) continue;

      const values = numbersFrom(rowMatch[2]);
      if (values.length === 24) {
        walls[wallNumber][directionMap[rowMatch[1]]] = values;
      }
    }
  }

  return walls;
}

function parseGlassTable(text) {
  const glass = {};

  for (const line of text.split(/\r?\n/)) {
    const match = normalize(line).match(/^(\d{4})\s+(-?\d+)\s+(\d{4})\s+(-?\d+)$/);
    if (!match) continue;

    glass[String(Number(match[1].slice(0, 2)) || 24)] = Number(match[2]);
    glass[String(Number(match[3].slice(0, 2)) || 24)] = Number(match[4]);
  }

  return glass;
}

function buildPayload(tables) {
  return {
    metadata: {
      datasetName: "ASHRAE 1997 CLTD Tables for Section 1",
      unitSystem: "si",
      source: "1997 ASHRAE Handbook - Fundamentals, Chapter 28, CLTD/SCL/CLF Calculation Procedure",
      sourcePdf: SOURCE_PDF,
      extractionScript: "scripts/extract_ashrae_1997_cltd.mjs",
      extractedTables: [
        "Table 30 July Cooling Load Temperature Differences for Flat Roofs at 40 deg North Latitude",
        "Table 32 July Cooling Load Temperature Differences for Sunlit Walls at 40 deg North Latitude",
        "Table 34 Cooling Load Temperature Differences for Conduction through Glass",
      ],
      pdfChapterPages: {
        table30: "28.42",
        table32: "28.43-28.45",
        table34: "28.49",
      },
      referenceConditions: {
        insideDryBulbC: 25.5,
        outdoorMaximumDryBulbC: 35,
        outdoorMeanDryBulbC: 29.4,
        outdoorDailyRangeC: 11.6,
        latitude: "40 deg North",
        date: "July 21",
        surface: "dark",
      },
      correction:
        "Corrected CLTD = CLTD + (25.5 - indoorDryBulbC) + (outdoorMeanDryBulbC - 29.4), where outdoorMeanDryBulbC = outdoorMaximumDryBulbC - dailyRangeC / 2.",
      hours: Array.from({ length: 24 }, (_, index) => index + 1),
      wallOrientations: directions,
      appMappings: {
        wallTypes: {
          "Brick Wall": {
            table: "Table 32",
            wallNumber: "6",
            basis:
              "Representative masonry wall selection from Table 33. The app only provides a generic brick wall, not the full ASHRAE layer sequence.",
          },
          "Cement block Wall": {
            table: "Table 32",
            wallNumber: "1",
            basis:
              "Representative low-mass concrete/block wall selection from Table 33B for low secondary R-value.",
          },
          "Concrete Wall": {
            table: "Table 32",
            wallNumber: "3",
            basis:
              "Representative 100 mm high-density concrete/concrete-block wall selection from Table 33B for low secondary R-value.",
          },
        },
        roofTypes: {
          "Concrete Slab Roof": {
            table: "Table 30",
            roofNumber: "13",
            basis:
              "Representative concrete roof with delayed heat response selected from Tables 30 and 31 for the app concrete slab roof.",
          },
        },
        glass: {
          table: "Table 34",
          basis: "Glass conduction CLTD by solar time.",
        },
      },
    },
    tables,
  };
}

async function main() {
  const parser = new PDFParse({ data: readFileSync(SOURCE_PDF) });
  const textByPage = {};

  for (const page of [42, 43, 44, 45, 49]) {
    textByPage[page] = (await parser.getText({ partial: [page] })).text;
  }

  await parser.destroy();

  const tables = {
    table30RoofCltdCByRoofNumber: parseRoofTable(textByPage[42]),
    table32WallCltdCByWallNumber: parseWallTable(textByPage),
    table34GlassCltdCBySolarHour: parseGlassTable(textByPage[49]),
  };

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(buildPayload(tables), null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_JSON}`);
  console.log(`Roof rows: ${Object.keys(tables.table30RoofCltdCByRoofNumber).length}`);
  console.log(`Wall numbers: ${Object.keys(tables.table32WallCltdCByWallNumber).length}`);
  console.log(`Glass hours: ${Object.keys(tables.table34GlassCltdCBySolarHour).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
