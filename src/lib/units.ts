export type UnitSystem = "si" | "imperial";

export type UnitKind =
  | "length"
  | "area"
  | "temperature"
  | "temperatureDelta"
  | "uFactor"
  | "heatFlux"
  | "heat"
  | "airflow"
  | "thickness";

const M_TO_FT = 3.280839895;
const M2_TO_FT2 = 10.763910417;
const W_TO_BTUH = 3.412141633;
const LPS_TO_CFM = 2.118880003;
const MM_TO_IN = 1 / 25.4;
const U_SI_TO_IP = W_TO_BTUH / M2_TO_FT2 / 1.8;
const HEAT_FLUX_SI_TO_IP = W_TO_BTUH / M2_TO_FT2;

export function normalizeUnitSystem(value: string | undefined | null): UnitSystem {
  return value === "imperial" ? "imperial" : "si";
}

export function unitLabel(unitSystem: UnitSystem, kind: UnitKind): string {
  if (unitSystem === "imperial") {
    switch (kind) {
      case "length":
        return "ft";
      case "area":
        return "ft2";
      case "temperature":
        return "F";
      case "temperatureDelta":
        return "F";
      case "uFactor":
        return "Btu/hr ft2 F";
      case "heatFlux":
        return "Btu/hr ft2";
      case "heat":
        return "Btu/hr";
      case "airflow":
        return "cfm";
      case "thickness":
        return "in";
    }
  }

  switch (kind) {
    case "length":
      return "m";
    case "area":
      return "m2";
    case "temperature":
      return "C";
    case "temperatureDelta":
      return "C";
    case "uFactor":
      return "W/m2 K";
    case "heatFlux":
      return "W/m2";
    case "heat":
      return "W";
    case "airflow":
      return "L/s";
    case "thickness":
      return "mm";
  }
}

export function formatUnitValue(
  canonicalValue: string | number | undefined | null,
  unitSystem: UnitSystem,
  kind: UnitKind,
  maxDecimals = decimalsFor(kind, unitSystem),
): string {
  const parsed = parseFlexibleNumber(canonicalValue);
  if (parsed === null) {
    return canonicalValue == null ? "" : String(canonicalValue);
  }

  return formatNumber(toDisplayUnit(parsed, unitSystem, kind), maxDecimals);
}

export function toCanonicalUnitValue(
  displayValue: string,
  unitSystem: UnitSystem,
  kind: UnitKind,
  maxDecimals = storageDecimalsFor(kind),
): string {
  if (displayValue.trim() === "") {
    return "";
  }

  const parsed = parseFlexibleNumber(displayValue);
  if (parsed === null) {
    return displayValue;
  }

  return formatNumber(fromDisplayUnit(parsed, unitSystem, kind), maxDecimals);
}

export function formatLengthDisplay(valueMeters: number, unitSystem: UnitSystem): string {
  return `${formatNumber(toDisplayUnit(valueMeters, unitSystem, "length"), 2)} ${unitLabel(unitSystem, "length")}`;
}

export function toDisplayUnit(value: number, unitSystem: UnitSystem, kind: UnitKind): number {
  if (unitSystem === "si") {
    return value;
  }

  switch (kind) {
    case "length":
      return value * M_TO_FT;
    case "area":
      return value * M2_TO_FT2;
    case "temperature":
      return value * 1.8 + 32;
    case "temperatureDelta":
      return value * 1.8;
    case "uFactor":
      return value * U_SI_TO_IP;
    case "heatFlux":
      return value * HEAT_FLUX_SI_TO_IP;
    case "heat":
      return value * W_TO_BTUH;
    case "airflow":
      return value * LPS_TO_CFM;
    case "thickness":
      return value * MM_TO_IN;
  }
}

export function fromDisplayUnit(value: number, unitSystem: UnitSystem, kind: UnitKind): number {
  if (unitSystem === "si") {
    return value;
  }

  switch (kind) {
    case "length":
      return value / M_TO_FT;
    case "area":
      return value / M2_TO_FT2;
    case "temperature":
      return (value - 32) / 1.8;
    case "temperatureDelta":
      return value / 1.8;
    case "uFactor":
      return value / U_SI_TO_IP;
    case "heatFlux":
      return value / HEAT_FLUX_SI_TO_IP;
    case "heat":
      return value / W_TO_BTUH;
    case "airflow":
      return value / LPS_TO_CFM;
    case "thickness":
      return value / MM_TO_IN;
  }
}

function parseFlexibleNumber(value: string | number | undefined | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseFloat((value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, maxDecimals: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

function decimalsFor(kind: UnitKind, unitSystem: UnitSystem): number {
  switch (kind) {
    case "temperature":
    case "temperatureDelta":
      return 1;
    case "uFactor":
      return unitSystem === "imperial" ? 3 : 2;
    case "thickness":
      return unitSystem === "imperial" ? 2 : 0;
    case "heat":
      return unitSystem === "imperial" ? 0 : 2;
    default:
      return 2;
  }
}

function storageDecimalsFor(kind: UnitKind): number {
  switch (kind) {
    case "temperature":
    case "temperatureDelta":
      return 1;
    case "thickness":
      return 2;
    default:
      return 4;
  }
}
