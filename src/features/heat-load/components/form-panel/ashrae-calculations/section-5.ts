import internalLoads from "../ashrae-tables/internal-loads-1997.json";
import { getAshraeZoneCode } from "../heat-load-zone-labels";

import { formatSource, matchesText } from "./common";
import type { FactorResult } from "./types";

type HeatGainPair = { sensible: number; latent: number };
type ClfTable = Record<string, Record<string, number[]>>;
type InternalLoads = {
  peopleHeatGainW: Record<string, HeatGainPair>;
  motorHeatGainW: Record<string, number>;
  lightingHeatGainW: Record<string, number>;
  applianceHeatGainW: Record<string, number>;
  clfTables: {
    peopleAndUnhoodedEquipment: ClfTable;
    lights: ClfTable;
    hoodedEquipment: ClfTable;
  };
};

const tables = internalLoads as InternalLoads;
const source1997 =
  "ASHRAE 1997 Ch28 Tables 3, 4, 9A, 9B, 37, 38, and 39";

function tableValue<T>(table: Record<string, T>, key: string, fallback: T) {
  const exact = table[key];
  if (exact != null) return exact;

  const fuzzyKey = Object.keys(table).find((item) => matchesText(item, key));
  return fuzzyKey ? table[fuzzyKey] : fallback;
}

function normalizeZone(zoneType: string) {
  return getAshraeZoneCode(zoneType);
}

function nearestDuration(duration: number, allowed: number[]) {
  const rounded = Math.round(duration || allowed[0]);
  return allowed.reduce((best, item) =>
    Math.abs(item - rounded) < Math.abs(best - rounded) ? item : best,
  );
}

function scheduleClf(input: {
  table: ClfTable;
  zoneType: string;
  hoursInUse: number;
  hoursAfterStart: number;
  allowedDurations: number[];
  sourceTable: string;
}) {
  const zone = normalizeZone(input.zoneType);
  const duration = nearestDuration(input.hoursInUse, input.allowedDurations);
  const hour = Math.min(24, Math.max(1, Math.round(input.hoursAfterStart || 1)));
  const value = input.table[zone]?.[String(duration)]?.[hour - 1] ?? 1;

  return {
    value,
    source: formatSource(
      source1997,
      `${input.sourceTable} Zone ${zone}, ${duration} h schedule, hour ${hour}`,
    ),
  };
}

export function resolveAshraeInternalHeatGain(input: {
  item: string;
  application: string;
  isLatent?: boolean;
}): FactorResult {
  if (input.item.includes("People")) {
    const gains = tableValue(tables.peopleHeatGainW, input.application, tables.peopleHeatGainW.default);
    return {
      value: input.isLatent ? gains.latent : gains.sensible,
      source: formatSource(source1997, `${input.application} occupant heat gain`),
    };
  }

  if (input.item.includes("Motor")) {
    return {
      value: tableValue(tables.motorHeatGainW, input.application, tables.motorHeatGainW.default),
      source: formatSource(source1997, `${input.application} motor heat gain, motor and load in space`),
    };
  }

  if (input.item.includes("lamp") || input.item.includes("Lamp")) {
    return {
      value: tableValue(tables.lightingHeatGainW, input.application, tables.lightingHeatGainW.default),
      source: formatSource(source1997, `${input.application} lighting heat gain including allowance`),
    };
  }

  if (input.item.includes("Appliance")) {
    return {
      value: tableValue(tables.applianceHeatGainW, input.application, tables.applianceHeatGainW.default),
      source: formatSource(source1997, `${input.application} office equipment heat gain`),
    };
  }

  return {
    value: 100,
    source: "Manual additional heat gain value",
  };
}

export function resolveAshraeInternalClf(input: {
  item: string;
  zoneType: string;
  hoursInUse: number;
  hoursAfterStart: number;
  isLatent?: boolean;
}): FactorResult {
  if (input.isLatent) {
    return {
      value: 1,
      source: formatSource(source1997, "Latent heat gain is instantaneous cooling load"),
    };
  }

  if (input.item.includes("lamp") || input.item.includes("Lamp")) {
    return scheduleClf({
      table: tables.clfTables.lights,
      zoneType: input.zoneType,
      hoursInUse: input.hoursInUse,
      hoursAfterStart: input.hoursAfterStart,
      allowedDurations: [8, 10, 12, 14, 16],
      sourceTable: "Table 38",
    });
  }

  if (input.item.includes("Additional")) {
    return { value: 1, source: "Manual additional heat gain CLF" };
  }

  return scheduleClf({
    table: tables.clfTables.peopleAndUnhoodedEquipment,
    zoneType: input.zoneType,
    hoursInUse: input.hoursInUse,
    hoursAfterStart: input.hoursAfterStart,
    allowedDurations: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    sourceTable: "Table 37",
  });
}
