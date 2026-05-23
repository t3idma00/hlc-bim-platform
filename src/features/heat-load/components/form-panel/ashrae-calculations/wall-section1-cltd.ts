import { formatSource } from "./common";
import type { DesignConditionContext, FactorResult } from "./types";
import {
  resolveAshrae1989WallAssembly,
  resolveAshrae1989WallBaseCltd,
  resolveAshrae1989WallLatitudeMonthCorrection,
  resolveAshrae1989WallUFactor,
} from "./wall-cltd-1989";
import { resolveAshrae1997WallUFactor } from "./wall-u-1997";

const CLTD_REFERENCE_INDOOR_C = 25.5;
const CLTD_REFERENCE_OUTDOOR_MEAN_C = 29.4;
const monthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type HourlyWallLoad = {
  hour: number;
  baseCltdC: number;
  correctedCltdC: number;
  loadW: number;
};

export type AshraeWallCltdPeak = {
  uFactor: FactorResult;
  correctedCltd: FactorResult;
  heatLoad: FactorResult;
  trace: string;
};

export function calculateAshraeWallCltdPeak(input: {
  type: string;
  direction: string;
  thicknessMm: number;
  areaM2: number;
  context: DesignConditionContext;
}): AshraeWallCltdPeak | null {
  const assembly = resolveAshrae1989WallAssembly(input.type, input.thicknessMm);
  const uFactor =
    resolveAshrae1997WallUFactor(input.type) ??
    resolveAshrae1989WallUFactor(input.type, input.thicknessMm);

  if (!assembly || !uFactor) {
    return null;
  }

  const latitudeMonthCorrection = resolveAshrae1989WallLatitudeMonthCorrection({
    direction: input.direction,
    context: input.context,
  });
  const meanOutdoorTemperatureC = outdoorMeanDryBulbC(input.context);
  const temperatureCorrection =
    CLTD_REFERENCE_INDOOR_C -
    input.context.indoorDryBulbC +
    meanOutdoorTemperatureC -
    CLTD_REFERENCE_OUTDOOR_MEAN_C;
  const hourlyLoads = getHourlyLoads({
    type: input.type,
    direction: input.direction,
    thicknessMm: input.thicknessMm,
    areaM2: input.areaM2,
    uFactorWPerM2K: uFactor.value,
    latitudeMonthCorrectionC: latitudeMonthCorrection.value,
    temperatureCorrectionC: temperatureCorrection,
  });
  const peak = getPeakHour(hourlyLoads);

  if (!peak) {
    return null;
  }

  const correctedSource = formatSource(
    `${peak.baseSource}; ${latitudeMonthCorrection.source}`,
    `CLTDc = CLTD base ${peak.baseCltdC.toFixed(2)} + LM ${latitudeMonthCorrection.value.toFixed(2)} + (25.5 - Ti ${input.context.indoorDryBulbC.toFixed(2)}) + (Tm ${meanOutdoorTemperatureC.toFixed(2)} - 29.4) at peak hour ${hourLabel(peak.hour)}`,
  );
  const heatLoadSource = formatSource(
    `${uFactor.source}; ${correctedSource}`,
    "Qwall = U x area x CLTDc; 24 Table 31 hours checked and maximum hourly wall load selected",
  );

  return {
    uFactor,
    correctedCltd: {
      value: peak.correctedCltdC,
      source: correctedSource,
    },
    heatLoad: {
      value: peak.loadW,
      source: heatLoadSource,
    },
    trace: buildTrace({
      input,
      assemblyGroup: assembly.groupLabel,
      table30Construction: assembly.row.description_of_construction,
      uFactor,
      latitudeMonthCorrection,
      meanOutdoorTemperatureC,
      hourlyLoads,
      peak,
    }),
  };
}

function getHourlyLoads(input: {
  type: string;
  direction: string;
  thicknessMm: number;
  areaM2: number;
  uFactorWPerM2K: number;
  latitudeMonthCorrectionC: number;
  temperatureCorrectionC: number;
}) {
  return Array.from({ length: 24 }, (_, index) => index + 1)
    .map((hour) => {
      const base = resolveAshrae1989WallBaseCltd({
        type: input.type,
        direction: input.direction,
        thicknessMm: input.thicknessMm,
        designHour: hour,
      });

      if (!base) {
        return null;
      }

      const correctedCltdC = Math.max(
        0,
        base.value + input.latitudeMonthCorrectionC + input.temperatureCorrectionC,
      );

      return {
        hour,
        baseCltdC: base.value,
        baseSource: base.source,
        correctedCltdC,
        loadW: input.areaM2 > 0 ? input.uFactorWPerM2K * input.areaM2 * correctedCltdC : 0,
      };
    })
    .filter((row): row is HourlyWallLoad & { baseSource: string } => row !== null);
}

function getPeakHour(hourlyLoads: Array<HourlyWallLoad & { baseSource: string }>) {
  return hourlyLoads.reduce<(HourlyWallLoad & { baseSource: string }) | null>(
    (peak, hour) =>
      !peak || hour.loadW > peak.loadW || (hour.loadW === peak.loadW && hour.correctedCltdC > peak.correctedCltdC)
        ? hour
        : peak,
    null,
  );
}

function outdoorMeanDryBulbC(context: DesignConditionContext) {
  return context.outdoorDryBulbC - Math.max(0, context.hottestMonthDryBulbRangeC) / 2;
}

function buildTrace(input: {
  input: {
    areaM2: number;
    context: DesignConditionContext;
  };
  assemblyGroup: string;
  table30Construction: string;
  uFactor: FactorResult;
  latitudeMonthCorrection: FactorResult;
  meanOutdoorTemperatureC: number;
  hourlyLoads: HourlyWallLoad[];
  peak: HourlyWallLoad;
}) {
  const context = input.input.context;
  const monthText = monthLabels[context.hottestMonth - 1] ?? `Month ${context.hottestMonth}`;
  const hourlyText = input.hourlyLoads
    .map(
      (hour) =>
        `${hourLabel(hour.hour)} base ${hour.baseCltdC.toFixed(2)} C, CLTDc ${hour.correctedCltdC.toFixed(2)} C, Q ${hour.loadW.toFixed(2)} W`,
    )
    .join("\n");

  return [
    "ASHRAE wall CLTD peak calculation (SI)",
    `Design DB: ${context.outdoorDryBulbC.toFixed(2)} C`,
    `DB range: ${context.hottestMonthDryBulbRangeC.toFixed(2)} C`,
    `Mean outdoor temperature Tm: ${input.meanOutdoorTemperatureC.toFixed(2)} C`,
    `Indoor dry-bulb Ti: ${context.indoorDryBulbC.toFixed(2)} C`,
    `Design month and CLTD month: ${monthText} (${context.hottestMonth})`,
    `Table 30 wall group: ${input.assemblyGroup}`,
    `Table 30 construction: ${input.table30Construction}`,
    `U-value: ${input.uFactor.value.toFixed(3)} W/m2.K`,
    `LM correction: ${input.latitudeMonthCorrection.value.toFixed(2)} C`,
    `Peak hour: ${hourLabel(input.peak.hour)}`,
    `Peak base CLTD: ${input.peak.baseCltdC.toFixed(2)} C`,
    `Peak corrected CLTD: ${input.peak.correctedCltdC.toFixed(2)} C`,
    `Area: ${input.input.areaM2.toFixed(2)} m2`,
    `Peak cooling load: ${input.peak.loadW.toFixed(2)} W`,
    `LM source: ${input.latitudeMonthCorrection.source}`,
    "Hourly wall load:",
    hourlyText,
  ].join("\n");
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
