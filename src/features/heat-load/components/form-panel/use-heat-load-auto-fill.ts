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
    const windowAreaByDirection: Record<(typeof directions)[number], number> = {
      North: 0,
      East: 0,
      South: 0,
      West: 0,
    };

    let totalWindowArea = 0;
    let totalWindowPerimeter = 0;
    let totalDoorArea = 0;

    directions.forEach((direction) => {
      const wallLength = getNum(formValues[`wall${direction}Length`]);
      const wallHeight = getNum(formValues[`wall${direction}Height`]);
      const wallGrossArea = wallLength * wallHeight;

      const windowWidth = getNum(formValues[`window${direction}Width`]);
      const windowHeight = getNum(formValues[`window${direction}Height`]);
      const windowArea = windowWidth * windowHeight;
      windowAreaByDirection[direction] = windowArea;

      const doorWidth = getNum(formValues[`door${direction}Width`]);
      const doorHeight = getNum(formValues[`door${direction}Height`]);
      const doorArea = doorWidth * doorHeight;

      totalWindowArea += windowArea;
      totalDoorArea += doorArea;
      totalWindowPerimeter += windowArea > 0 ? 2 * (windowWidth + windowHeight) : 0;

      setIfChanged(`${wallRow[direction]}_direction`, formValues[`wall${direction}Direction`] || direction);
      setIfChanged(`${glassRow[direction]}_direction`, formValues[`window${direction}Direction`] || direction);

      if (wallGrossArea > 0) {
        setIfChanged(`${wallRow[direction]}_calcValue`, Math.max(0, wallGrossArea - windowArea - doorArea).toFixed(2));
      }
      if (windowArea > 0) {
        setIfChanged(`${glassRow[direction]}_areaQty`, windowArea.toFixed(2));
      }
    });

    const floorArea = getNum(formValues.wallNorthLength) * getNum(formValues.wallEastLength);

    const selectedGlassDirection = sheetValues["1.5_direction"] ?? "East";
    const selectedWindowArea =
      selectedGlassDirection in windowAreaByDirection
        ? windowAreaByDirection[selectedGlassDirection as keyof typeof windowAreaByDirection]
        : totalWindowArea;

    if (totalWindowArea > 0) setIfChanged("1.5_calcValue", selectedWindowArea.toFixed(2));
    if (floorArea > 0) {
      setIfChanged("1.6_calcValue", floorArea.toFixed(2));
      setIfChanged("3.3_calcValue", floorArea.toFixed(2));
      setIfChanged("6.1_areaQty", floorArea.toFixed(2));
    }
    if (totalWindowPerimeter > 0) {
      setIfChanged("4.1_qty", "1");
      setIfChanged("4.1_crackLength", totalWindowPerimeter.toFixed(2));
    }
    if (totalDoorArea > 0) {
      setIfChanged("4.1_qtySecondary", "1");
      setIfChanged("4.1_doorArea", totalDoorArea.toFixed(2));
    }

    Object.entries(updates).forEach(([key, value]) => onSheetChange(key, value));
  }, [formValues, sheetValues, onSheetChange]);
}
