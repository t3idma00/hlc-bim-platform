import { readFileSync, writeFileSync } from "node:fs";

const sourceFile = new URL("../src/data/ashrae2005/stations.si.json", import.meta.url);
const outputFile = new URL(
  "../src/data/ashrae2005/july-cltd-design-conditions.json",
  import.meta.url,
);
const julyKey = "jul";

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function getMonthlyRows(station) {
  return station.extractedTables?.monthlyClimaticDesignConditions?.rows ?? [];
}

function getRowValue(rows, label, qualifier) {
  const row = rows.find((item) => item.label === label && item.qualifier === qualifier);
  const value = row?.periodValues?.[julyKey];
  return isNumber(value) ? value : null;
}

function createStationRecord(station) {
  const rows = getMonthlyRows(station);
  const record = {
    dryBulb: {
      "0.4": getRowValue(rows, "DB", "0.4%"),
      "2": getRowValue(rows, "DB", "2%"),
    },
    meanCoincidentWetBulb: {
      "0.4": getRowValue(rows, "MCWB", "0.4%"),
      "2": getRowValue(rows, "MCWB", "2%"),
    },
    meanDailyDryBulbRange: getRowValue(rows, "MDBR", "Annual"),
  };

  return Object.values(record.dryBulb).every(isNumber) &&
    Object.values(record.meanCoincidentWetBulb).every(isNumber) &&
    isNumber(record.meanDailyDryBulbRange)
    ? record
    : null;
}

function buildLookup(payload) {
  const stations = {};

  for (const station of payload.stations ?? []) {
    if (!station.wmo || stations[station.wmo]) continue;

    const record = createStationRecord(station);
    if (record) stations[station.wmo] = record;
  }

  return {
    metadata: {
      datasetName: "ASHRAE 2017 July Station Design Conditions for 1997 CLTD",
      unitSystem: "si",
      sourceFile: "src/data/ashrae2005/stations.si.json",
      sourceRows: [
        "Monthly Design Dry Bulb and Mean Coincident Wet Bulb Temperatures DB 0.4%",
        "Monthly Design Dry Bulb and Mean Coincident Wet Bulb Temperatures MCWB 0.4%",
        "Monthly Design Dry Bulb and Mean Coincident Wet Bulb Temperatures DB 2%",
        "Monthly Design Dry Bulb and Mean Coincident Wet Bulb Temperatures MCWB 2%",
        "Mean Daily Temperature Range MDBR",
      ],
      referenceMonth: 7,
      notes: [
        "ASHRAE 1997 Chapter 28 wall and roof CLTD tables used by the app are July tables.",
        "ASHRAE 2017 monthly station tables provide July DB/MCWB rows for 0.4% and 2%, not 1%.",
      ],
    },
    recordCount: Object.keys(stations).length,
    stations,
  };
}

const sourcePayload = JSON.parse(readFileSync(sourceFile, "utf8"));
const outputPayload = buildLookup(sourcePayload);

writeFileSync(outputFile, `${JSON.stringify(outputPayload, null, 2)}\n`);
console.log(`Wrote ${outputPayload.recordCount} July CLTD station records to ${outputFile.pathname}`);
