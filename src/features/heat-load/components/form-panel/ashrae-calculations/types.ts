export type FormValues = Record<string, string>;
export type DesignConditionSource = "current" | "ashrae-2017";

export type DesignConditionContext = {
  source: DesignConditionSource;
  outdoorDryBulbC: number;
  indoorDryBulbC: number;
  deltaTC: number;
  pressurePa: number;
  windSpeedMps: number;
  hottestMonth: number;
  hottestMonthDryBulbRangeC: number;
  designHour: number;
  latitude: number;
  longitude: number;
  solar: {
    dni: number;
    dhi: number;
    ghi: number;
    zenith: number;
    azimuth: number;
    hasData: boolean;
  };
};

export type FactorResult = {
  value: number;
  source: string;
};

export type Section1Result = {
  uFactor: FactorResult;
  td: FactorResult;
  heatLoad: FactorResult;
};

export type Section2Factors = {
  effectiveCoefficient: FactorResult;
  solarCoolingLoadFactor: FactorResult;
  solarHeatGain: FactorResult;
};

export type Section3Result = {
  uFactor: FactorResult;
  td: FactorResult;
  heatLoad: FactorResult;
};

export type Section4Result = {
  flowLps: FactorResult;
  sensibleW: FactorResult;
  latentW: FactorResult;
  heatLoad: FactorResult;
};
