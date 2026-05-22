import { getAshraeZoneCode, getAshraeZoneLabel } from "./heat-load-zone-labels";
import { getRoofAssemblyReference } from "./ashrae-roof-assemblies";

export const SECTION4_REFERENCE =
  "Chapter 25 Table 3 window crack and door-frame leakage area rows, page 25.18; Tables 6 and 8 stack/wind coefficients and Equation 46 airflow, page 25.22; Chapter 28 Equations 22-23 loads, page 28.55";

export const SECTION6_REFERENCE =
  "ANSI/ASHRAE Standard 62.1-2007 Table 03 minimum ventilation rates in breathing zone; breathing-zone flow Vbz = people x Rp + area x Ra; ASHRAE 1997 Chapter 28 Equations 22-23, page 28.55 for sensible and latent outdoor-air load";

export function getSection1Reference(item: string, type: string, direction: string) {
  if (item.toLowerCase().includes("roof")) {
    return getRoofAssemblyReference(type);
  }
  if (item.toLowerCase().includes("sky")) {
    return "Chapter 28 Table 34 fenestration conduction cooling load temperature difference row by hour, page 28.49; Chapter 29 Table 5 skylight and sloped/overhead fenestration U-factor columns, page 29.9";
  }
  if (item.toLowerCase().includes("glass")) {
    return "Chapter 28 Table 34 glass conduction cooling load temperature difference row by hour, page 28.49; Chapter 29 Table 5 fenestration U-factor row by glazing ID and product type, pages 29.8-29.9";
  }

  return `ASHRAE 1989 Table 30 wall construction mapping for "${type}", wall group and U-value; Table 31 ${direction} sunlit-wall base cooling load temperature difference row, pages 26.36-26.37; Table 32 latitude and design-month LM correction, pages 26.38-26.39`;
}

export function getSection2Reference(direction: string, zoneType = "C", item = "Glass") {
  const zoneCode = getAshraeZoneCode(zoneType);
  const shadingReference = item.toLowerCase().includes("sky")
    ? "Horizontal skylight row: Chapter 29 Table 12 domed horizontal skylight shading coefficient, page 29.26; flat glass skylights use Chapter 29 Tables 25, 26, and 29 shading rows"
    : "Chapter 29 Tables 25, 26, and 29 shading coefficient rows, pages 29.38 and 29.40";

  return [
    "Chapter 29 simplified solar heat-gain method Equations 46-47, page 29.28",
    shadingReference,
    `Chapter 29 Tables 15-21 solar heat gain factor ${direction} row, pages 29.29-29.35`,
    `Chapter 28 Tables 35B and 36 solar cooling load ${getAshraeZoneLabel(zoneCode)} (${zoneCode}) ${direction} row, pages 28.49-28.50; CLF is resolved from the Table 36 SCL basis`,
  ].join("; ");
}

export function getSection3Reference(item: string, floorType = "") {
  if (item.toLowerCase().includes("glass")) {
    return "Chapter 28 interior-surface heat gain method, pages 28.28-28.29: interior all-glass transmission Q = U x A x (Tadjacent - Tindoor); Chapter 29 Table 5 glass U-factor lookup adjusted to an interior-film basis from Chapter 24 Table 1";
  }

  if (item.toLowerCase().includes("floor") && floorType && floorType !== "Intermediate Floor") {
    return "ASHRAE 1997 Fundamentals Chapter 28 page 28.7, Heat Gain through Interior Surfaces floor note after Equation 8: heat transfer from a ground-contact floor may be neglected for cooling load estimates";
  }

  const floorNote = item.toLowerCase().includes("floor")
    ? "; ground floor cooling heat transfer is neglected when that floor type is selected"
    : "";

  return `Chapter 28 heat gain through interior partitions, ceilings, and floors method, pages 28.28-28.29: Q = U x A x (Tadjacent - Tindoor); U-factor from selected assembly or project input${floorNote}`;
}

export function getSection5Reference(item: string) {
  if (item.includes("People")) {
    return "Chapter 28 Table 3 occupant heat gain row, page 28.8; Table 37 people cooling load factor row, pages 28.51-28.52";
  }
  if (item.includes("Motor")) {
    return "Chapter 28 Table 4 motor heat gain row, page 28.10; Table 37 equipment cooling load factor row, pages 28.51-28.52";
  }
  if (item.toLowerCase().includes("lamp")) {
    return "Chapter 28 Equation 9 lighting heat gain, page 28.8; Table 38 lights cooling load factor row, page 28.52";
  }
  if (item.includes("Appliance")) {
    return "Chapter 28 Tables 9A and 9B equipment heat gain rows, page 28.14; Table 37 equipment cooling load factor row, pages 28.51-28.52";
  }

  return "Manual additional heat gain row; not tied to a single ASHRAE printed row";
}
