"use client";

import { useState } from "react";
import { DesignConditionsHeader, DesignConditionsRow } from "./design-conditions-table";
import { HeatLoadSheet } from "./heat-load-sheet";
import { RoomDetailsHeader, RoomDetailsRow } from "./room-details-table";

type SurfaceType = "walls" | "windows" | "doors";
type UnitSystem = "si" | "imperial";
export type FormValues = Record<string, string>;

const topSectionRows = [0, 1, 2, 3];

export const initialFormValues: FormValues = {
  wallNorthDirection: "North",
  wallNorthLength: "",
  wallNorthWidth: "",
  wallNorthHeight: "3",
  wallEastDirection: "East",
  wallEastLength: "",
  wallEastWidth: "",
  wallEastHeight: "3",
  wallSouthDirection: "South",
  wallSouthLength: "",
  wallSouthWidth: "",
  wallSouthHeight: "3",
  wallWestDirection: "West",
  wallWestLength: "",
  wallWestWidth: "",
  wallWestHeight: "3",
  windowNorthDirection: "North",
  windowNorthLength: "",
  windowNorthWidth: "",
  windowNorthHeight: "",
  windowEastDirection: "East",
  windowEastLength: "",
  windowEastWidth: "",
  windowEastHeight: "",
  windowSouthDirection: "South",
  windowSouthLength: "",
  windowSouthWidth: "",
  windowSouthHeight: "",
  windowWestDirection: "West",
  windowWestLength: "",
  windowWestWidth: "",
  windowWestHeight: "",
  doorNorthDirection: "North",
  doorNorthLength: "",
  doorNorthWidth: "",
  doorNorthHeight: "",
  doorEastDirection: "East",
  doorEastLength: "",
  doorEastWidth: "",
  doorEastHeight: "",
  doorSouthDirection: "South",
  doorSouthLength: "",
  doorSouthWidth: "",
  doorSouthHeight: "",
  doorWestDirection: "West",
  doorWestLength: "",
  doorWestWidth: "",
  doorWestHeight: "",
  outsideCondition: "",
  insideCondition: "",
  conditionDifference: "",
  conditionType: "Relative Humidity",
  conditionValue: "",
};

export function HeatLoadFormPanel({
  formValues,
  onFieldChange,
}: {
  formValues: FormValues;
  onFieldChange: (name: string, value: string) => void;
}) {
  const [surfaceType, setSurfaceType] = useState<SurfaceType>("walls");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("si");

  return (
    <aside className="min-h-0 overflow-hidden border-b border-rose-100 bg-[#fff8fa] xl:border-r xl:border-b-0">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-rose-100 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#be123c]">Heat Load Form</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Load Input Sheet</h2>
            </div>
            <div className="inline-flex overflow-hidden border border-rose-200 bg-white text-[10px] font-semibold text-slate-900">
              <button
                type="button"
                onClick={() => setUnitSystem("si")}
                className={`px-3 py-1.5 ${unitSystem === "si" ? "bg-[#fff4f7] text-[#9f1239]" : "bg-white text-slate-700"}`}
              >
                SI Unit
              </button>
              <button
                type="button"
                onClick={() => setUnitSystem("imperial")}
                className={`border-l border-rose-200 px-3 py-1.5 ${
                  unitSystem === "imperial" ? "bg-[#fff4f7] text-[#9f1239]" : "bg-white text-slate-700"
                }`}
              >
                IP Units
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          <div className="space-y-3">
            <table className="w-full table-fixed border-collapse text-[10px] leading-none text-slate-900">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <RoomDetailsHeader surfaceType={surfaceType} onSurfaceChange={setSurfaceType} />
                  <DesignConditionsHeader />
                </tr>
                {topSectionRows.map((rowIndex) => (
                  <tr key={rowIndex}>
                    <RoomDetailsRow
                      surfaceType={surfaceType}
                      rowIndex={rowIndex}
                      values={formValues}
                      onFieldChange={onFieldChange}
                    />
                    <DesignConditionsRow rowIndex={rowIndex} values={formValues} onFieldChange={onFieldChange} />
                  </tr>
                ))}
              </tbody>
            </table>
            <HeatLoadSheet />
          </div>
        </div>

        <div className="border-t border-rose-100 px-1 py-2">
          <div className="flex justify-end">
            <button className="border border-rose-200 bg-[#9f1239] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#881337]">
              Calculate Heat Load
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
