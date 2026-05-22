import { useEffect } from "react";

import { getNum } from "./ashrae-calculations";
import type { FormValues, SheetValues } from "./heat-load-sheet-types";

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

    const directions = ["North", "East", "South", "West"] as const;
    const wallRow = { North: "1.1", East: "1.2", South: "1.3", West: "1.4" } as const;
    const glassRow = { North: "2.1", East: "2.2", South: "2.3", West: "2.4" } as const;

    let totalWindowArea = 0;
    let totalWindowPerimeter = 0;
    let totalDoorCount = 0;

    directions.forEach((direction) => {
      const wallLength = getNum(formValues[`wall${direction}Length`]);
      const wallHeight = getNum(formValues[`wall${direction}Height`]);
      const wallGrossArea = wallLength * wallHeight;

      const windowWidth = getNum(formValues[`window${direction}Width`]);
      const windowHeight = getNum(formValues[`window${direction}Height`]);
      const windowArea = windowWidth * windowHeight;

      const doorWidth = getNum(formValues[`door${direction}Width`]);
      const doorHeight = getNum(formValues[`door${direction}Height`]);
      const doorArea = doorWidth * doorHeight;

      totalWindowArea += windowArea;
      totalWindowPerimeter += windowArea > 0 ? 2 * (windowWidth + windowHeight) : 0;
      if (doorArea > 0) totalDoorCount += 1;

      setIfChanged(`${wallRow[direction]}_direction`, formValues[`wall${direction}Direction`] || direction);
      setIfChanged(`${glassRow[direction]}_direction`, formValues[`window${direction}Direction`] || direction);

      if (wallGrossArea > 0) {
        setIfChanged(`${wallRow[direction]}_calcValue`, Math.max(0, wallGrossArea - windowArea - doorArea).toFixed(2));
      }
      if (windowArea > 0) {
        setIfChanged(`${glassRow[direction]}_areaQty`, windowArea.toFixed(2));
      }
    });

    const floorWidth = Math.max(getNum(formValues.wallNorthLength), getNum(formValues.wallSouthLength));
    const floorDepth = Math.max(getNum(formValues.wallEastLength), getNum(formValues.wallWestLength));
    const floorArea = floorWidth * floorDepth;

    const skylightArea = getNum(sheetValues["2.5_areaQty"]);
    const selectedGlassArea = totalWindowArea + skylightArea;

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
    if (floorArea > 0) {
      setIfChanged("1.6_calcValue", floorArea.toFixed(2));
      setIfChanged("3.3_calcValue", floorArea.toFixed(2));
      setIfChanged("6.1_areaQty", floorArea.toFixed(2));
      setIfChanged("6.1_areaQty_source", "Room floor area from Room Details wall lengths");
    }
    if (totalWindowPerimeter > 0) {
      setIfChanged("4.1_qty", "1");
      setIfChanged("4.1_crackLength", totalWindowPerimeter.toFixed(2));
    }
    if (totalDoorCount > 0) {
      setIfChanged("4.1_qtySecondary", String(totalDoorCount));
    }

    Object.entries(updates).forEach(([key, value]) => onSheetChange(key, value));
  }, [formValues, sheetValues, onSheetChange]);
}
