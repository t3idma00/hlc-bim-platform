"use client";

import type { SheetValues } from "@/types";

type Align = "left" | "right" | "center";

type Column = {
  key: string;
  label: string;
  align?: Align;
  wrap?: boolean;
  width?: string;
};

type Row = Record<string, string>;

type Section = {
  number: string;
  title: string;
  columns: Column[];
  rows: Row[];
};

type SummaryRow = {
  label: string;
  note: string;
  value: string;
};

const numberColumnWidth = "5%";
const summaryNoteWidth = "10%";
const summaryValueWidth = "9%";
const tableClass = "w-full table-fixed border-collapse text-[10px] leading-none text-slate-900";
const cellClass = "border border-slate-300 px-1 py-1 align-middle";

const sections: Section[] = [
  {
    number: "1",
    title: "Solar & Trans. Heat gain through the Glass-Wall & Roof",
    columns: [
      { key: "item", label: "Item", width: "8%" },
      { key: "direction", label: "Direction", wrap: true, width: "10%" },
      { key: "type", label: "Type", wrap: true, width: "24%" },
      { key: "thickness", label: "Thickness (mm)", wrap: true, align: "center", width: "16%" },
      { key: "uFactor", label: "U Factor", align: "right", width: "9%" },
      { key: "cltd", label: "CLTD/TD", align: "right", width: "10%" },
      { key: "calcValue", label: "Area in m2 / Qty", align: "right", width: "10%" },
      { key: "heatLoad", label: "Total Heat load", align: "right", width: "9%" },
    ],
    rows: [
      { id: "1.1", item: "Wall", direction: "North", type: "Brick Wall", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
      { id: "1.2", item: "Wall", direction: "East", type: "Cement block Wall", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
      { id: "1.3", item: "Wall", direction: "South", type: "Cement block Wall", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
      { id: "1.4", item: "Wall", direction: "West", type: "Cement block Wall", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
      { id: "1.5", item: "Glass", direction: "Single glass", type: "Glass only (Centre of Glass)", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
      { id: "1.6", item: "Roof", direction: "Intermediate floor", type: "Concrete", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
    ],
  },
  {
    number: "2",
    title: "Solar Heat gain through the Glass",
    columns: [
      { key: "item", label: "Item", width: "7%" },
      { key: "direction", label: "Direction", width: "8%" },
      { key: "type", label: "Type", wrap: true, width: "20%" },
      { key: "shading", label: "Interior Shading type", wrap: true, width: "10%" },
      { key: "thickness", label: "Thick.", align: "center", width: "7%" },
      { key: "sc", label: "SC", align: "right", width: "8%" },
      { key: "shg", label: "SHG", align: "right", width: "8%" },
      { key: "clf", label: "CLF", align: "right", width: "8%" },
      { key: "areaQty", label: "Area in m2 / Qty", align: "right", width: "10%" },
      { key: "result", label: "Total Heat load", align: "right", width: "9%" },
    ],
    rows: [
      { id: "2.1", item: "Glass", direction: "East", type: "Single Glass Clear", shading: "", thickness: "", sc: "", shg: "", clf: "", areaQty: "", result: "" },
      { id: "2.2", item: "Glass", direction: "East", type: "Single Glass Clear", shading: "", thickness: "", sc: "", shg: "", clf: "", areaQty: "", result: "" },
      { id: "2.3", item: "Glass", direction: "South", type: "Single Glass Clear", shading: "", thickness: "", sc: "", shg: "", clf: "", areaQty: "", result: "" },
      { id: "2.4", item: "Glass", direction: "West", type: "Single Glass Clear", shading: "", thickness: "", sc: "", shg: "", clf: "", areaQty: "", result: "" },
      { id: "2.5", item: "Sky light", direction: "West", type: "Single Glass Clear", shading: "", thickness: "", sc: "", shg: "", clf: "", areaQty: "", result: "" },
    ],
  },
  {
    number: "3",
    title: "Transmission heat gain Except outside wall and roof",
    columns: [
      { key: "item", label: "Item", width: "14%" },
      { key: "typeA", label: "Type", wrap: true, width: "14%" },
      { key: "typeB", label: "Detail", wrap: true, width: "16%" },
      { key: "thickness", label: "Thick.", wrap: true, align: "center", width: "16%" },
      { key: "uFactor", label: "U Factor", align: "right", width: "10%" },
      { key: "cltd", label: "CLTD/TD", align: "right", width: "11%" },
      { key: "calcValue", label: "Area in m2 / Qty", align: "right", width: "10%" },
      { key: "heatLoad", label: "Total Heat load", align: "right", width: "9%" },
    ],
    rows: [
      { id: "3.1", item: "All Glasses", typeA: "Single glass", typeB: "Glass only (Centre of Glass)", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
      { id: "3.2", item: "Wall Partition", typeA: "Concrete Wall", typeB: "Not applicable", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
      { id: "3.3", item: "Floor", typeA: "Intermediate Floor", typeB: "Concrete Wall", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
    ],
  },
  {
    number: "4",
    title: "Infiltration",
    columns: [
      { key: "componentA", label: "Component", width: "10%" },
      { key: "qty", label: "Qty", align: "center", width: "6%" },
      { key: "crackLength", label: "Crack length", align: "right", width: "10%" },
      { key: "componentB", label: "Component", wrap: true, width: "26%" },
      { key: "sensible", label: "Sensible Heat", align: "right", width: "12%" },
      { key: "latent", label: "Latent heat", align: "right", width: "12%" },
      { key: "heatLoad", label: "Total Heat load", align: "right", width: "19%" },
    ],
    rows: [
      { id: "4.1", componentA: "Window", qty: "", crackLength: "", componentB: "", sensible: "", latent: "", heatLoad: "" },
    ],
  },
  {
    number: "5",
    title: "Internal Heat",
    columns: [
      { key: "item", label: "Item", wrap: true, width: "12%" },
      { key: "application", label: "Application", wrap: true, width: "31%" },
      { key: "heatGain", label: "Heat gain", align: "right", width: "14%" },
      { key: "qty", label: "QTY", align: "right", width: "19%" },
      { key: "heatLoad", label: "Total Heat load", align: "right", width: "19%" },
    ],
    rows: [
      { id: "5.1", item: "People", application: "Standing, light work or walking", heatGain: "", qty: "", heatLoad: "" },
      { id: "5.2", item: "Motor power (Name plate)", application: "(0.04)", heatGain: "", qty: "", heatLoad: "" },
      { id: "5.3", item: "compact fluorescent lamp", application: "Office", heatGain: "", qty: "", heatLoad: "" },
      { id: "5.4", item: "Appliance etc.", application: "Medium, desktop type", heatGain: "", qty: "", heatLoad: "" },
      { id: "5.5", item: "Additional heat gain", application: "Miscellaneous equipment", heatGain: "", qty: "", heatLoad: "" },
    ],
  },
  {
    number: "6",
    title: "Ventilation",
    columns: [
      { key: "application", label: "Application", width: "13%" },
      { key: "item", label: "Item", width: "10%" },
      { key: "quantity", label: "Quantity", align: "right", width: "8%" },
      { key: "area", label: "Area", width: "8%" },
      { key: "areaQty", label: "Area quantity", align: "right", width: "9%" },
      { key: "totalFlowRate", label: "Total flowrate", align: "right", width: "11%" },
      { key: "sensible", label: "Sensible heat", align: "right", width: "8%" },
      { key: "latent", label: "Latent heat", align: "right", width: "9%" },
      { key: "heatLoad", label: "Total Heat load", align: "right", width: "19%" },
    ],
    rows: [
      { id: "6.1", application: "Pharmacy", item: "People", quantity: "", area: "Area", areaQty: "", totalFlowRate: "", sensible: "", latent: "", heatLoad: "" },
    ],
  },
];

const summaryRows: SummaryRow[] = [
  { label: "Heat Load", note: "", value: "" },
  { label: "Safety factor", note: "", value: "" },
  { label: "Total Heat load (kW)", note: "", value: "" },
  { label: "Total Heat load (Btu/hr)", note: "", value: "" },
  { label: "Total Heat load (RT)", note: "", value: "" },
];

type Props = {
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
};

export function HeatLoadSheet({ sheetValues, onSheetChange }: Props) {
  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <SectionTable 
          key={section.number} 
          {...section} 
          sheetValues={sheetValues} 
          onSheetChange={onSheetChange} 
        />
      ))}
      <SummaryTable 
        rows={summaryRows} 
        sheetValues={sheetValues} 
        onSheetChange={onSheetChange} 
      />
    </div>
  );
}

function SectionTable({ 
  number, 
  title, 
  columns, 
  rows, 
  sheetValues, 
  onSheetChange 
}: Section & Props) {
  return (
    <table className={tableClass}>
      <colgroup>
        <col style={{ width: numberColumnWidth }} />
        {columns.map((column) => (
          <col key={column.key} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className={`${cellClass} bg-[#ffe7ee] text-center text-[11px] font-semibold whitespace-nowrap text-slate-900`}>{number}</th>
          <th className={`${cellClass} bg-[#ffe7ee] text-left text-[11px] font-semibold whitespace-nowrap text-slate-900`} colSpan={columns.length}>
            {title}
          </th>
        </tr>
        <tr>
          <th className={`${cellClass} bg-white text-center text-[10px] font-semibold whitespace-nowrap text-slate-900`} />
          {columns.map((column) => (
            <th key={column.key} className={`${cellClass} bg-white text-center text-[10px] font-semibold leading-tight whitespace-normal break-words text-slate-900`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={`${cellClass} bg-white text-center font-medium text-slate-900`}>{row.id}</td>
            {columns.map((column) => {
              const fieldKey = `${row.id}_${column.key}`;
              const value = sheetValues[fieldKey] ?? row[column.key] ?? "";

              return (
                <td key={column.key} className={`${cellClass} bg-white p-0`}>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onSheetChange(fieldKey, e.target.value)}
                    className={`min-h-[28px] w-full bg-transparent px-2 py-1 text-[10px] outline-none text-slate-900 ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
                    placeholder={row[column.key] || ""}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryTable({ 
  rows, 
  sheetValues, 
  onSheetChange 
}: { 
  rows: SummaryRow[]; 
  sheetValues: SheetValues; 
  onSheetChange: (key: string, value: string) => void;
}) {
  return (
    <table className={tableClass}>
      <colgroup>
        <col style={{ width: `calc(100% - ${summaryNoteWidth} - ${summaryValueWidth})` }} />
        <col style={{ width: summaryNoteWidth }} />
        <col style={{ width: summaryValueWidth }} />
      </colgroup>
      <tbody>
        {rows.map((row, index) => {
          const fieldKey = `summary_${index}`;
          const value = sheetValues[fieldKey] ?? row.value ?? "";

          return (
            <tr key={row.label}>
              <th className={`${cellClass} bg-[#fff4f7] text-left text-[11px] font-semibold whitespace-nowrap text-slate-900`}>{row.label}</th>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={sheetValues[`${fieldKey}_note`] ?? row.note ?? ""}
                  onChange={(e) => onSheetChange(`${fieldKey}_note`, e.target.value)}
                  className="min-h-[28px] w-full bg-transparent px-2 py-1 text-[10px] outline-none text-slate-900 text-right"
                />
              </td>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onSheetChange(fieldKey, e.target.value)}
                  className="min-h-[28px] w-full bg-transparent px-2 py-1 text-[10px] outline-none text-slate-900 text-right"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}