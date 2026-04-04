import type { SHGFInput, SHGFResult, SolarPosition } from "./solar-types";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function toRadians(value: number): number {
  return value * DEG_TO_RAD;
}

function toDegrees(value: number): number {
  return value * RAD_TO_DEG;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

// Solar position astronomy block: returns zenith and north-based azimuth.
export function computeSolarPosition(dateTime: Date, latitude: number, longitude: number): SolarPosition {
  const unixDays = dateTime.getTime() / 86400000 + 2440587.5 - 2451545.0;

  const meanLongitude = normalizeDegrees(280.460 + 0.9856474 * unixDays);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * unixDays);

  const lambda = normalizeDegrees(
    meanLongitude + 1.915 * Math.sin(toRadians(meanAnomaly)) + 0.02 * Math.sin(toRadians(2 * meanAnomaly)),
  );

  const obliquity = 23.439 - 0.0000004 * unixDays;

  const rightAscension = toDegrees(
    Math.atan2(
      Math.cos(toRadians(obliquity)) * Math.sin(toRadians(lambda)),
      Math.cos(toRadians(lambda)),
    ),
  );

  const declination = toDegrees(Math.asin(Math.sin(toRadians(obliquity)) * Math.sin(toRadians(lambda))));

  const gmst = normalizeDegrees(
    280.46061837 + 360.98564736629 * unixDays + 0.000387933 * (unixDays / 36525) ** 2,
  );
  const localSidereal = normalizeDegrees(gmst + longitude);
  const hourAngle = normalizeDegrees(localSidereal - rightAscension);
  const signedHourAngle = hourAngle > 180 ? hourAngle - 360 : hourAngle;

  const latRad = toRadians(latitude);
  const decRad = toRadians(declination);
  const haRad = toRadians(signedHourAngle);

  const cosZenith =
    Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const zenith = toDegrees(Math.acos(clamp(cosZenith, -1, 1)));

  const azimuth = normalizeDegrees(
    toDegrees(
      Math.atan2(
        Math.sin(haRad),
        Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad),
      ),
    ) + 180,
  );

  return {
    zenith,
    azimuth,
  };
}

// Basic SHGF block: converts solar inputs into plane-of-array gains.
export function calculateSHGF(input: SHGFInput): SHGFResult {
  const surfaceTilt = input.surfaceTilt ?? 90;
  const surfaceAzimuth = input.surfaceAzimuth ?? 180;
  const albedo = clamp(input.albedo ?? 0.2, 0, 1);

  const zenithRad = toRadians(input.zenith);
  const tiltRad = toRadians(surfaceTilt);
  const azimuthDeltaRad = toRadians(input.azimuth - surfaceAzimuth);

  const cosAoi = Math.max(
    0,
    Math.cos(zenithRad) * Math.cos(tiltRad) +
      Math.sin(zenithRad) * Math.sin(tiltRad) * Math.cos(azimuthDeltaRad),
  );
  const aoi = toDegrees(Math.acos(clamp(cosAoi, -1, 1)));

  const beam = input.dni * cosAoi;
  const diffuse = input.dhi * (1 + Math.cos(tiltRad)) * 0.5;
  const reflected = input.ghi * albedo * (1 - Math.cos(tiltRad)) * 0.5;
  const poa = Math.max(0, beam + diffuse + reflected);

  return {
    shgf: poa,
    components: {
      beam,
      diffuse,
      reflected,
    },
    aoi,
    poa,
    poaShaded: poa,
  };
}
