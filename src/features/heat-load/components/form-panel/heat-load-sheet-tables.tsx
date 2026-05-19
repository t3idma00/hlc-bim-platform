import {
  formatUnitValue,
  toCanonicalUnitValue,
  unitLabel,
  type UnitSystem,
} from "@/lib/units";

import type { Align, Column, Section, SheetValues, SummaryRow } from "./heat-load-sheet-types";

const numberColumnWidth = "5%";
const summaryNoteWidth = "10%";
const summaryValueWidth = "9%";
const tableClass = "w-full table-fixed border-collapse text-[10px] leading-none text-slate-900";
const cellClass = "border border-slate-300 px-1 py-1 align-middle";

function getColumnLabel(column: Column, unitSystem: UnitSystem): string {
  return column.unit ? `${column.label} (${unitLabel(unitSystem, column.unit)})` : column.label;
}

function formatSheetCellValue(value: string, column: Column, unitSystem: UnitSystem): string {
  return column.unit ? formatUnitValue(value, unitSystem, column.unit) : value;
}

function parseSheetCellInput(value: string, column: Column, unitSystem: UnitSystem): string {
  return column.unit ? toCanonicalUnitValue(value, unitSystem, column.unit) : value;
}

export function SectionTable({
  number,
  title,
  columns,
  rows,
  unitSystem,
  sheetValues,
  onCellChange,
}: Section & {
  unitSystem: UnitSystem;
  sheetValues: SheetValues;
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
          <th className={`${cellClass} bg-[#ffe7ee] text-center text-[11px] font-semibold text-slate-900`}>
            {number}
          </th>
          <th className={`${cellClass} bg-[#ffe7ee] text-left text-[11px] font-semibold text-slate-900`} colSpan={columns.length}>
            {title}
          </th>
        </tr>
        <tr>
          <th className={`${cellClass} bg-white text-center text-[10px] font-semibold text-slate-900`} />
          {columns.map((column) => (
            <th
              key={column.key}
              className={`${cellClass} bg-white text-center text-[10px] font-semibold leading-tight text-slate-900`}
            >
              {getColumnLabel(column, unitSystem)}
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
              const displayValue = formatSheetCellValue(cellValue, column, unitSystem);
              const sourceTitle = sheetValues[`${row.id}_${column.key}_source`] ?? "";
              const titleText = sourceTitle ? `${displayValue}\n${sourceTitle}` : displayValue;
              const options = row.selectOptions?.[column.key] ?? column.selectOptions ?? [];
              const hasSelect = options.length > 0;
              const fillClass = hasSelect || !column.editable ? "bg-[#fff4f7]" : "bg-white";

              return (
                <td key={column.key} className={`${cellClass} ${fillClass} p-0`}>
                  {hasSelect ? (
                    <SheetSelectCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={cellValue}
                      title={titleText}
                      align={column.align ?? "left"}
                      options={options}
                      getOptionLabel={(option) => formatSheetCellValue(option, column, unitSystem)}
                      onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                    />
                  ) : column.editable ? (
                    <SheetInputCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={displayValue}
                      title={titleText}
                      align={column.align ?? "left"}
                      onValueChange={(value) =>
                        onCellChange(number, row.id, column.key, parseSheetCellInput(value, column, unitSystem))
                      }
                    />
                  ) : (
                    <SheetCell
                      ariaLabel={`${row.id} ${column.label || column.key}`}
                      value={displayValue}
                      title={titleText}
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

export function SummaryTable({
  rows,
  unitSystem,
  sheetValues,
  onSheetChange,
}: {
  rows: SummaryRow[];
  unitSystem: UnitSystem;
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
          const isPrimaryHeatLoad = index === 0;
          const label = isPrimaryHeatLoad ? `${row.label} (${unitLabel(unitSystem, "heat")})` : row.label;
          const value = sheetValues[fieldKey] ?? row.value ?? "";
          const displayValue = isPrimaryHeatLoad ? formatUnitValue(value, unitSystem, "heat") : value;

          return (
            <tr key={row.label}>
              <th className={`${cellClass} bg-[#fff4f7] text-left text-[11px] font-semibold text-slate-900`}>
                {label}
              </th>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={sheetValues[`${fieldKey}_note`] ?? row.note ?? ""}
                  onChange={(event) => onSheetChange(`${fieldKey}_note`, event.target.value)}
                  className="min-h-[24px] w-full bg-transparent px-2 py-1 text-right text-[10px] text-slate-900 outline-none"
                />
              </td>
              <td className={`${cellClass} bg-white p-0`}>
                <input
                  type="text"
                  value={displayValue}
                  onChange={(event) =>
                    onSheetChange(
                      fieldKey,
                      isPrimaryHeatLoad
                        ? toCanonicalUnitValue(event.target.value, unitSystem, "heat")
                        : event.target.value,
                    )
                  }
                  className="min-h-[24px] w-full bg-transparent px-2 py-1 text-right text-[10px] text-slate-900 outline-none"
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
  title,
  align = "left",
  wrap = true,
}: {
  ariaLabel: string;
  value?: string;
  title?: string;
  align?: Align;
  wrap?: boolean;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const wrapClass = wrap ? "whitespace-normal break-words" : "whitespace-nowrap";

  return (
    <div
      aria-label={ariaLabel}
      title={title ?? value}
      className={`min-h-[24px] h-full w-full px-1 py-1 text-[10px] leading-snug text-slate-900 ${alignClass} ${wrapClass}`}
    >
      {value || "\u00A0"}
    </div>
  );
}

function SheetInputCell({
  ariaLabel,
  value,
  title,
  align = "left",
  onValueChange,
}: {
  ariaLabel: string;
  value: string;
  title?: string;
  align?: Align;
  onValueChange: (value: string) => void;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <input
      aria-label={ariaLabel}
      type="text"
      value={value}
      title={title ?? value}
      onChange={(event) => onValueChange(event.target.value)}
      className={`min-h-[24px] h-full w-full bg-transparent px-1 py-1 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
    />
  );
}

function SheetSelectCell({
  ariaLabel,
  value,
  title,
  align = "left",
  options,
  getOptionLabel,
  onValueChange,
}: {
  ariaLabel: string;
  value: string;
  title?: string;
  align?: Align;
  options: readonly string[];
  getOptionLabel?: (option: string) => string;
  onValueChange: (value: string) => void;
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <div className="relative min-h-[24px] h-full w-full">
      <select
        aria-label={ariaLabel}
        value={value}
        title={title ?? value}
        onChange={(event) => onValueChange(event.target.value)}
        className={`min-h-[24px] h-full w-full appearance-none cursor-pointer bg-[#fff4f7] px-1 py-1 pr-5 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel ? getOptionLabel(option) : option}
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
