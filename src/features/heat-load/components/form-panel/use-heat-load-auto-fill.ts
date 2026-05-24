import { useEffect } from "react";

import { getNum } from "./ashrae-calculations";
import { getWallCoreThicknessMm, getWallTypeFamily } from "./ashrae-wall-assemblies";
import {
  DEFAULT_ROOF_ASSEMBLY_LABEL,
  INTERMEDIATE_ROOF_SELECTION,
  getDefaultRoofThicknessMm,
  isIntermediateRoofSelection,
  normalizeRoofAssemblyLabel,
  normalizeRoofDetail,
  roofDetailOptions,
} from "./ashrae-roof-assemblies";
import { heatLoadLookupOptions } from "./heat-load-options";
import type { FormValues, SheetValues } from "./heat-load-sheet-types";
import { cardinalWalls, isExteriorSurface, isExteriorWall } from "./wall-boundary";

const DEFAULT_WINDOW_HEIGHT_M = 1.2;
const DEFAULT_DOOR_HEIGHT_M = 2.1;
const DEFAULT_INTERIOR_PARTITION_TYPE = "W12 Simple 200 mm concrete wall with cement plaster";
const EXTERIOR_ROOF_AREA_SOURCE = "Exterior roof area from Room Details wall lengths";
const EXTERIOR_ROOF_SELECTED_SOURCE = "Exterior roof selected in Section 1; intermediate roof/ceiling area is inactive";
const INTERMEDIATE_ROOF_AREA_SOURCE =
  "Intermediate Roof selected in Section 1; exterior roof solar area is zero to avoid double counting";
const INTERMEDIATE_ROOF_ACTIVE_AREA_SOURCE = "Intermediate roof/ceiling area from Room Details wall lengths";

export function useHeatLoadAutoFill({
  formValues,
  sheetValues,
  onSheetChange,
}: {
  formValues: FormValues;
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
}) {
  useRoomAreaAutoFill({ formValues, sheetValues, onSheetChange });
}

function useRoomAreaAutoFill({
  formValues,
  sheetValues,
  onSheetChange,
}: {
  formValues: FormValues;
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
}) {
  useEffect(() => {
    const updates: Record<string, string> = {};
    const setIfChanged = (key: string, value: string) => {
      if (sheetValues[key] !== value) updates[key] = value;
    };

    const wallRow = { North: "1.1", East: "1.2", South: "1.3", West: "1.4" } as const;
    const glassRow = { North: "2.1", East: "2.2", South: "2.3", West: "2.4" } as const;
    const partitionRow = { North: "3.2N", East: "3.2E", South: "3.2S", West: "3.2W" } as const;

    let totalWindowArea = 0;
    let totalInteriorWindowArea = 0;
    let totalWindowPerimeter = 0;
    let totalDoorCount = 0;

    cardinalWalls.forEach((direction) => {
      const wallIsExterior = isExteriorWall(formValues, direction);
      const windowIsExterior = isExteriorSurface(formValues, "window", direction);
      const doorIsExterior = isExteriorSurface(formValues, "door", direction);
      const wallLength = getNum(formValues[`wall${direction}Length`]);
      const wallHeight = getNum(formValues[`wall${direction}Height`]);
      const wallGrossArea = wallLength * wallHeight;
      const wallDirection = formValues[`wall${direction}Direction`] || direction;
      const wallType = formValues[`wall${direction}Type`] || "";
      const partitionType = getInteriorPartitionType(wallType);
      const partitionThickness = String(getWallCoreThicknessMm(partitionType) ?? 200);

      const windowWidth = getNum(formValues[`window${direction}Width`]);
      const windowInputHeight = getNum(formValues[`window${direction}Height`]);
      const windowHeight = windowWidth > 0 ? windowInputHeight || DEFAULT_WINDOW_HEIGHT_M : 0;
      const windowArea = windowWidth * windowHeight;

      const doorWidth = getNum(formValues[`door${direction}Width`]);
      const doorInputHeight = getNum(formValues[`door${direction}Height`]);
      const doorHeight = doorWidth > 0 ? doorInputHeight || DEFAULT_DOOR_HEIGHT_M : 0;
      const doorArea = doorWidth * doorHeight;
      const exteriorWindowArea = windowIsExterior ? windowArea : 0;
      const interiorWindowArea = windowIsExterior ? 0 : windowArea;
      const exteriorDoorArea = doorIsExterior ? doorArea : 0;
      const interiorDoorArea = doorIsExterior ? 0 : doorArea;
      const exteriorWallArea = Math.max(0, wallGrossArea - exteriorWindowArea - exteriorDoorArea);
      const interiorPartitionArea = Math.max(0, wallGrossArea - interiorWindowArea - interiorDoorArea);

      if (windowIsExterior) {
        totalWindowArea += windowArea;
        totalWindowPerimeter += windowArea > 0 ? 2 * (windowWidth + windowHeight) : 0;
      } else {
        totalInteriorWindowArea += windowArea;
      }
      if (doorIsExterior && doorArea > 0) totalDoorCount += 1;

      setIfChanged(`${wallRow[direction]}_direction`, wallDirection);
      setIfChanged(`${glassRow[direction]}_direction`, formValues[`window${direction}Direction`] || wallDirection);
      setIfChanged(`${partitionRow[direction]}_direction`, wallDirection);
      setIfChanged(`${partitionRow[direction]}_typeA`, partitionType);
      setIfChanged(`${partitionRow[direction]}_typeB`, "Not applicable");
      setIfChanged(`${partitionRow[direction]}_thickness`, partitionThickness);

      if (wallGrossArea > 0) {
        setIfChanged(`${wallRow[direction]}_calcValue`, wallIsExterior ? exteriorWallArea.toFixed(2) : "");
        setIfChanged(
          `${wallRow[direction]}_calcValue_source`,
          wallIsExterior
            ? `Exterior ${wallDirection} wall area: gross wall area minus exterior window and door openings`
            : `${wallDirection} wall marked Interior; external wall load moved to Section 3`,
        );
        setIfChanged(`${partitionRow[direction]}_calcValue`, wallIsExterior ? "" : interiorPartitionArea.toFixed(2));
        setIfChanged(
          `${partitionRow[direction]}_calcValue_source`,
          wallIsExterior
            ? `${wallDirection} wall marked Exterior; not used as an interior partition`
            : `Interior ${wallDirection} partition area: gross wall area minus interior opening areas`,
        );
      } else {
        setIfChanged(`${wallRow[direction]}_calcValue`, "");
        setIfChanged(`${partitionRow[direction]}_calcValue`, "");
      }
      if (windowArea > 0 || sheetValues[`${glassRow[direction]}_areaQty`]) {
        setIfChanged(`${glassRow[direction]}_areaQty`, windowIsExterior ? windowArea.toFixed(2) : "");
        setIfChanged(
          `${glassRow[direction]}_areaQty_source`,
          windowIsExterior
            ? "Exterior window width x height from Room Details"
            : `${wallDirection} window marked Interior; solar glass load is not applied`,
        );
      }
    });

    const floorWidth = Math.max(getNum(formValues.wallNorthLength), getNum(formValues.wallSouthLength));
    const floorDepth = Math.max(getNum(formValues.wallEastLength), getNum(formValues.wallWestLength));
    const floorArea = floorWidth * floorDepth;

    const skylightArea = getNum(sheetValues["2.5_areaQty"]);
    const selectedGlassArea = totalWindowArea + skylightArea;
    const selectedRoofRoute = sheetValues["1.6_type"] || formValues.roofType || DEFAULT_ROOF_ASSEMBLY_LABEL;
    const usesIntermediateRoof = isIntermediateRoofSelection(selectedRoofRoute);
    const roofType = usesIntermediateRoof
      ? normalizeRoofAssemblyLabel(sheetValues["3.4_typeA"], DEFAULT_ROOF_ASSEMBLY_LABEL)
      : normalizeRoofAssemblyLabel(selectedRoofRoute, DEFAULT_ROOF_ASSEMBLY_LABEL);
    const section1RoofType = usesIntermediateRoof ? INTERMEDIATE_ROOF_SELECTION : roofType;
    const roofDetail = normalizeRoofDetail(
      sheetValues["3.4_typeB"] ||
      sheetValues["1.6_detail"] ||
      formValues.roofDetail ||
      roofDetailOptions[0],
    );
    const roofThickness = formValues.roofThickness || String(getDefaultRoofThicknessMm(roofType));

    setIfChanged("1.5_direction", "All");
    if (
      totalWindowArea > 0 ||
      skylightArea > 0 ||
      sheetValues["1.5_calcValue"] ||
      sheetValues["1.5_calcValue_source"]
    ) {
      setIfChanged("1.5_calcValue", selectedGlassArea.toFixed(2));
      setIfChanged("1.5_calcValue_source", "All window area from Room Details plus Section 2 skylight area");
    }
    if (totalInteriorWindowArea > 0 || sheetValues["3.1_calcValue"] || sheetValues["3.1_calcValue_source"]) {
      setIfChanged("3.1_calcValue", totalInteriorWindowArea > 0 ? totalInteriorWindowArea.toFixed(2) : "");
      setIfChanged("3.1_calcValue_source", "Interior window/glass area from walls marked Interior");
    }
    if (floorArea > 0) {
      setIfChanged("1.6_calcValue", usesIntermediateRoof ? "0.00" : floorArea.toFixed(2));
      setIfChanged("1.6_calcValue_source", usesIntermediateRoof ? INTERMEDIATE_ROOF_AREA_SOURCE : EXTERIOR_ROOF_AREA_SOURCE);
      setIfChanged("3.4_calcValue", usesIntermediateRoof ? floorArea.toFixed(2) : "");
      setIfChanged("3.4_calcValue_source", usesIntermediateRoof ? INTERMEDIATE_ROOF_ACTIVE_AREA_SOURCE : EXTERIOR_ROOF_SELECTED_SOURCE);
      setIfChanged("3.3_calcValue", floorArea.toFixed(2));
      setIfChanged("6.1_areaQty", floorArea.toFixed(2));
      setIfChanged("6.1_areaQty_source", "Room floor area from Room Details wall lengths");
    }
    setIfChanged("3.4_direction", "Intermediate");
    setIfChanged("1.6_type", section1RoofType);
    setIfChanged("1.6_detail", roofDetail);
    setIfChanged("1.6_thickness", roofThickness);
    setIfChanged("3.4_typeA", roofType);
    setIfChanged("3.4_typeB", roofDetail);
    setIfChanged("3.4_thickness", roofThickness);
    if (totalWindowPerimeter > 0 || sheetValues["4.1_crackLength"]) {
      setIfChanged("4.1_qty", totalWindowPerimeter > 0 ? "1" : "");
      setIfChanged("4.1_crackLength", totalWindowPerimeter > 0 ? totalWindowPerimeter.toFixed(2) : "");
    }
    if (totalDoorCount > 0 || sheetValues["4.1_qtySecondary"]) {
      setIfChanged("4.1_qtySecondary", totalDoorCount > 0 ? String(totalDoorCount) : "");
    }

    Object.entries(updates).forEach(([key, value]) => onSheetChange(key, value));
  }, [formValues, sheetValues, onSheetChange]);
}

function getInteriorPartitionType(wallType: string) {
  const family = getWallTypeFamily(wallType).toLowerCase();
  const options = heatLoadLookupOptions.interiorPartitionWallTypes;
  const matchText = family.includes("brick")
    ? "brick wall"
    : family.includes("cement") || family.includes("block")
      ? "cement block wall"
      : "concrete wall";

  return options.find((option) => option.toLowerCase().includes(matchText)) ?? DEFAULT_INTERIOR_PARTITION_TYPE;
}
