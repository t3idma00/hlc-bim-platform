"use client";

import { useEffect, useState } from "react";
import { heatLoadLookupOptions } from "./heat-load-options";

type SheetValues = Record<string, string>;

type Align = "left" | "right" | "center";

type Column = {
  key: string;
  label: string;
  align?: Align;
  wrap?: boolean;
  width?: string;
  editable?: boolean;
  selectOptions?: readonly string[];
};

type SelectOptionsByKey = Partial<Record<string, readonly string[]>>;

type Row = {
  id: string;
  values: Record<string, string>;
  selectOptions?: SelectOptionsByKey;
};

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

type Props = {
  sheetValues: SheetValues;
  onSheetChange: (key: string, value: string) => void;
};

const numberColumnWidth = "5%";
const summaryNoteWidth = "10%";
const summaryValueWidth = "9%";
const tableClass = "w-full table-fixed border-collapse text-[10px] leading-none text-slate-900";
const cellClass = "border border-slate-300 px-1 py-1 align-middle";

const wallCellSelects: SelectOptionsByKey = {
  direction: heatLoadLookupOptions.directions,
  type: heatLoadLookupOptions.wallTypes,
  thickness: heatLoadLookupOptions.wallThicknesses,
};

const solarGlassCellSelects: SelectOptionsByKey = {
  direction: heatLoadLookupOptions.directions,
  type: heatLoadLookupOptions.glassSolarTypes,
  shading: heatLoadLookupOptions.glassShadingTypes,
  thickness: heatLoadLookupOptions.glassThicknesses,
};

const allGlassesCellSelects: SelectOptionsByKey = {
  typeA: heatLoadLookupOptions.transmissionGlassTypes,
  typeB: heatLoadLookupOptions.glassFrameTypes,
  thickness: heatLoadLookupOptions.glassThicknesses,
};

const wallPartitionCellSelects: SelectOptionsByKey = {
  typeA: heatLoadLookupOptions.wallTypes,
  thickness: heatLoadLookupOptions.wallThicknesses,
};

const floorCellSelects: SelectOptionsByKey = {
  typeB: heatLoadLookupOptions.wallTypes,
  thickness: heatLoadLookupOptions.wallThicknesses,
};

function buildInitialSections(): Section[] {
  return [
    {
      number: "1",
      title: "Solar & Trans. Heat gain through the Glass-Wall & Roof",
      columns: [
        { key: "item", label: "Item", width: "8%" },
        { key: "direction", label: "Direction", wrap: true, width: "10%" },
        { key: "type", label: "Type", wrap: true, width: "24%" },
        { key: "thickness", label: "Thickness (mm)", wrap: true, align: "center", width: "16%", editable: true },
        { key: "uFactor", label: "U Factor", align: "right", width: "9%", editable: true },
        { key: "cltd", label: "CLTD/TD", align: "right", width: "10%", editable: true },
        { key: "calcValue", label: "Area in m2 / Qty", align: "right", width: "10%", editable: true },
        { key: "heatLoad", label: "Total Heat load", align: "right", width: "9%", editable: true },
      ],
      rows: [
        { id: "1.1", values: { item: "Wall", direction: "North", type: "Brick Wall", thickness: "215", uFactor: "", cltd: "", calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        { id: "1.2", values: { item: "Wall", direction: "East", type: "Cement block Wall", thickness: "100", uFactor: "", cltd: "", calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        { id: "1.3", values: { item: "Wall", direction: "South", type: "Cement block Wall", thickness: "100", uFactor: "", cltd: "", calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        { id: "1.4", values: { item: "Wall", direction: "West", type: "Cement block Wall", thickness: "100", uFactor: "", cltd: "", calcValue: "", heatLoad: "" }, selectOptions: wallCellSelects },
        {
          id: "1.5",
          values: { item: "Glass", direction: "Single glass", type: "Glass only (Centre of Glass)", thickness: "6", uFactor: "", cltd: "", calcValue: "", heatLoad: "" },
          selectOptions: {
            direction: heatLoadLookupOptions.transmissionGlassTypes,
            type: heatLoadLookupOptions.glassFrameTypes,
            thickness: heatLoadLookupOptions.glassThicknesses,
          },
        },
        { id: "1.6", values: { item: "Roof", direction: "Intermediate floor", type: "Concrete", thickness: "", uFactor: "", cltd: "", calcValue: "", heatLoad: "" } },
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
        { key: "sc", label: "SC", align: "right", width: "8%", editable: true },
        { key: "shg", label: "SHG", align: "right", width: "8%", editable: true },
        { key: "clf", label: "CLF", align: "right", width: "8%", editable: true },
        { key: "areaQty", label: "Area in m2 / Qty", align: "right", width: "10%", editable: true },
        { key: "result", label: "Total Heat load", align: "right", width: "9%", editable: true },
      ],
      rows: [
        { id: "2.1", values: { item: "Glass", direction: "East", type: "Single Glass Clear", shading: "No shading", thickness: "6", sc: "", shg: "", clf: "", areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.2", values: { item: "Glass", direction: "East", type: "Single Glass Clear", shading: "No shading", thickness: "6", sc: "", shg: "", clf: "", areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.3", values: { item: "Glass", direction: "South", type: "Single Glass Clear", shading: "No shading", thickness: "6", sc: "", shg: "", clf: "", areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.4", values: { item: "Glass", direction: "West", type: "Single Glass Clear", shading: "No shading", thickness: "6", sc: "", shg: "", clf: "", areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
        { id: "2.5", values: { item: "Sky light", direction: "HOR", type: "Single Glass Clear", shading: "No shading", thickness: "6", sc: "", shg: "", clf: "", areaQty: "", result: "" }, selectOptions: solarGlassCellSelects },
      ],
    },
    {
      number: "3",
      title: "Transmission heat gain Except outside wall and roof",
      columns: [
        { key: "item", label: "Item", width: "14%" },
        { key: "typeA", label: "Type", wrap: true, width: "14%" },
        { key: "typeB", label: "Detail", wrap: true, width: "16%" },
        { key: "thickness", label: "Thick.", wrap: true, align: "center", width: "16%", editable: true },
        { key: "uFactor", label: "U Factor", align: "right", width: "10%", editable: true },
        { key: "cltd", label: "CLTD/TD", align: "right", width: "11%", editable: true },
        { key: "calcValue", label: "Area in m2 / Qty", align: "right", width: "10%", editable: true },
        { key: "heatLoad", label: "Total Heat load", align: "right", width: "9%", editable: true },
      ],
      rows: [
        { id: "3.1", values: { item: "All Glasses", typeA: "Single glass", typeB: "Glass only (Centre of Glass)", thickness: "6", uFactor: "", cltd: "", calcValue: "", heatLoad: "" }, selectOptions: allGlassesCellSelects },
        { id: "3.2", values: { item: "Wall Partition", typeA: "Concrete Wall", typeB: "Not applicable", thickness: "215", uFactor: "", cltd: "", calcValue: "", heatLoad: "" }, selectOptions: wallPartitionCellSelects },
        { id: "3.3", values: { item: "Floor", typeA: "Intermediate Floor", typeB: "Concrete Wall", thickness: "100", uFactor: "", cltd: "", calcValue: "", heatLoad: "" }, selectOptions: floorCellSelects },
      ],
    },
  ];
}

const summaryRows: SummaryRow[] = [
  { label: "Heat Load", note: "", value: "" },
  { label: "Safety factor", note: "", value: "" },
  { label: "Total Heat load (kW)", note: "", value: "" },
  { label: "Total Heat load (Btu/hr)", note: "", value: "" },
  { label: "Total Heat load (RT)", note: "", value: "" },
];

export function HeatLoadSheet({ sheetValues, onSheetChange }: Props) {
  const [sections, setSections] = useState<Section[]>(buildInitialSections());

  useEffect(() => {
    if (Object.keys(sheetValues).length === 0) {
      return;
    }

    setSections((prevSections) =>
      prevSections.map((section) => ({
        ...section,
        rows: section.rows.map((row) => {
          const newValues = { ...row.values };

          Object.entries(sheetValues).forEach(([key, value]) => {
            const rowPrefix = `${row.id}_`;

            if (!key.startsWith(rowPrefix)) {
              return;
            }

            const cellKey = key.slice(rowPrefix.length);
            if (Object.prototype.hasOwnProperty.call(newValues, cellKey)) {
              newValues[cellKey] = value;
            }
          });

          return { ...row, values: newValues };
        }),
      })),
    );
  }, [sheetValues]);

  function handleCellChange(sectionNumber: string, rowId: string, key: string, value: string) {
    setSections((currentSections) =>
      currentSections.map((section) =>
        section.number !== sectionNumber
          ? section
          : {
              ...section,
              rows: section.rows.map((row) =>
                row.id !== rowId
                  ? row
                  : { ...row, values: { ...row.values, [key]: value } },
              ),
            },
      ),
    );

    onSheetChange(`${rowId}_${key}`, value);
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <SectionTable key={section.number} {...section} onCellChange={handleCellChange} />
      ))}

      <SummaryTable rows={summaryRows} sheetValues={sheetValues} onSheetChange={onSheetChange} />
    </div>
  );
}

function SectionTable({
  number,
  title,
  columns,
  rows,
  onCellChange,
}: Section & {
  onCellChange: (sectionNumber: string, rowId: string, key: string, value: string) => void;
}) {
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
              const cellValue = row.values[column.key] ?? "";
              const cellOptions = row.selectOptions?.[column.key] ?? column.selectOptions ?? [];
              const hasSelect = cellOptions.length > 0;
              const fillClass = hasSelect || !column.editable ? "bg-[#fff4f7]" : "bg-white";

              return (
                <td key={column.key} className={`${cellClass} ${fillClass} p-0`}>
                  {hasSelect ? (
                    <SheetSelectCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={cellValue}
                      align={column.align ?? "left"}
                      options={cellOptions}
                      onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                    />
                  ) : column.editable ? (
                    <SheetInputCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={cellValue}
                      align={column.align ?? "left"}
                      onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                    />
                  ) : (
                    <SheetCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={cellValue}
                      align={column.align ?? "left"}
                      wrap={column.wrap}
                    />
                  )}
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
  onSheetChange,
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

          return (
            <tr key={row.label}>
              <th className={`${cellClass} bg-[#fff4f7] text-left text-[11px] font-semibold whitespace-nowrap text-slate-900`}>{row.label}</th>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={sheetValues[`${fieldKey}_note`] ?? row.note ?? ""}
                  onChange={(event) => onSheetChange(`${fieldKey}_note`, event.target.value)}
                  className="min-h-[24px] w-full bg-transparent px-2 py-1 text-[10px] text-right text-slate-900 outline-none"
                />
              </td>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={sheetValues[fieldKey] ?? row.value ?? ""}
                  onChange={(event) => onSheetChange(fieldKey, event.target.value)}
                  className="min-h-[24px] w-full bg-transparent px-2 py-1 text-[10px] text-right text-slate-900 outline-none"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SheetCell({
  ariaLabel,
  value = "",
  align = "left",
  wrap = true,
}: {
  ariaLabel: string;
  value?: string;
  align?: Align;
  wrap?: boolean;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const wrapClass = wrap ? "whitespace-normal break-words" : "whitespace-nowrap";

  return (
    <div
      aria-label={ariaLabel}
      title={value}
      className={`min-h-[24px] h-full w-full px-1 py-1 text-[10px] leading-snug text-slate-900 ${alignClass} ${wrapClass}`}
    >
      {value || "\u00A0"}
    </div>
  );
}

function SheetInputCell({
  ariaLabel,
  value,
  align = "left",
  onValueChange,
}: {
  ariaLabel: string;
  value: string;
  align?: Align;
  onValueChange: (value: string) => void;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <input
      aria-label={ariaLabel}
      type="text"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className={`min-h-[24px] h-full w-full bg-transparent px-1 py-1 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
    />
  );
}

function SheetSelectCell({
  ariaLabel,
  value,
  align = "left",
  options,
  onValueChange,
}: {
  ariaLabel: string;
  value: string;
  align?: Align;
  options: readonly string[];
  onValueChange: (value: string) => void;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <div className="relative min-h-[24px] h-full w-full">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        title={value}
        className={`min-h-[24px] h-full w-full appearance-none cursor-pointer bg-[#fff4f7] px-1 py-1 pr-5 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-1 top-1/2 h-[6px] w-[10px] -translate-y-1/2 text-slate-900"
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
