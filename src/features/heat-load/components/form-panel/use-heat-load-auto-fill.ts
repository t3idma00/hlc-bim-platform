import { useEffect } from "react";

import { calculateSHGF } from "@/lib/calculations";

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
  useSolarAutoFill({ formValues, sheetValues, onSheetChange });
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
    let totalDoorArea = 0;

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

    if (totalWindowArea > 0) setIfChanged("1.5_calcValue", totalWindowArea.toFixed(2));
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

function useSolarAutoFill({
  formValues,
  sheetValues,
  onSheetChange,
}: {
  formValues: FormValues;
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
}) {
  useEffect(() => {
    const dni = getNum(formValues.solarDni);
    const dhi = getNum(formValues.solarDhi);
    const ghi = getNum(formValues.solarGhi);
    const zenith = getNum(formValues.solarZenith);
    const azimuth = getNum(formValues.solarAzimuth);
    const hasSolarData = formValues.solarZenith !== "" && formValues.solarAzimuth !== "" && (dni > 0 || dhi > 0 || ghi > 0);

    if (!hasSolarData) return;

    const surfaceAzimuthByDir = { North: 0, East: 90, South: 180, West: 270 } as const;
    const rowByDir = { North: "2.1", East: "2.2", South: "2.3", West: "2.4" } as const;
    const updates: Record<string, string> = {};

    (Object.keys(rowByDir) as Array<keyof typeof rowByDir>).forEach((direction) => {
      const result = calculateSHGF({
        dni,
        dhi,
        ghi,
        zenith,
        azimuth,
        surfaceTilt: 90,
        surfaceAzimuth: surfaceAzimuthByDir[direction],
      });
      const key = `${rowByDir[direction]}_shg`;
      if (sheetValues[key] !== result.poa.toFixed(2)) updates[key] = result.poa.toFixed(2);
    });

    const skylight = calculateSHGF({
      dni,
      dhi,
      ghi,
      zenith,
      azimuth,
      surfaceTilt: 0,
      surfaceAzimuth: 180,
    });
    if (sheetValues["2.5_shg"] !== skylight.poa.toFixed(2)) {
      updates["2.5_shg"] = skylight.poa.toFixed(2);
    }

    Object.entries(updates).forEach(([key, value]) => onSheetChange(key, value));
  }, [
    formValues.solarDni,
    formValues.solarDhi,
    formValues.solarGhi,
    formValues.solarZenith,
    formValues.solarAzimuth,
    sheetValues,
    onSheetChange,
  ]);
}
