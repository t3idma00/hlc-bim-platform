import { getAshraeZoneCode, getAshraeZoneLabel } from "./heat-load-zone-labels";

export const SECTION4_REFERENCE =
  "Ch25 Table 3 leakage area rows, p.25.18; Eq.46 stack-wind flow, p.25.22; Ch28 Eqs.22-23 loads, p.28.55";

export const SECTION6_REFERENCE =
  "Ch25 ventilation-rate procedure text, pp.25.5, 25.23; Ch28 ventilation example/Eqs.22-23, p.28.55";

export function getSection1Reference(item: string, type: string, direction: string) {
  if (item.toLowerCase().includes("roof")) {
    return "Ch28 Table 30 roof CLTD row Roof No. 13, p.28.42; Table 31 roof number selection, p.28.42";
  }
  if (item.toLowerCase().includes("glass")) {
    return "Ch28 Table 34 glass conduction CLTD row by hour, p.28.49; Ch29 Table 11 U/SC basis, pp.29.25-29.26";
  }

  return `Ch28 Table 32 wall CLTD ${direction} row, pp.28.43-28.45; ${type} mapping from Table 33, pp.28.46-28.48`;
}

export function getSection2Reference(direction: string, zoneType = "C") {
  const zoneCode = getAshraeZoneCode(zoneType);

  return [
    "Ch29 Tables 25/26/29 SC rows, pp.29.38, 29.40",
    `Ch29 Tables 15-21 SHGF ${direction} row, pp.29.29-29.35`,
    `Ch28 Table 36 SCL ${getAshraeZoneLabel(zoneCode)} (${zoneCode}) ${direction} row, p.28.50`,
  ].join("; ");
}

export function getSection3Reference(item: string) {
  if (item.includes("Glass")) {
    return "Ch28 Table 34 glass CLTD, p.28.49; Ch29 Table 11 U-factor basis, pp.29.25-29.26";
  }

  return "Ch28 heat gain through interior partitions/floors method, pp.28.28-28.29; U-factor from Ch24 assembly basis";
}

export function getSection5Reference(item: string) {
  if (item.includes("People")) {
    return "Ch28 Table 3 occupant heat gain row, p.28.8; Table 37 people CLF row, pp.28.51-28.52";
  }
  if (item.includes("Motor")) {
    return "Ch28 Table 4 motor heat gain row, p.28.10; Table 37 equipment CLF row, pp.28.51-28.52";
  }
  if (item.toLowerCase().includes("lamp")) {
    return "Ch28 Eq.9 lighting heat gain, p.28.8; Table 38 lights CLF row, p.28.52";
  }
  if (item.includes("Appliance")) {
    return "Ch28 Table 9A/9B equipment heat gain rows, p.28.14; Table 37 equipment CLF row, pp.28.51-28.52";
  }

  return "Manual additional heat gain row; not tied to a single ASHRAE printed row";
}
