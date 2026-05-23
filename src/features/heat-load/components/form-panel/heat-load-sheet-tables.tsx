import { Fragment, useState } from "react";

import { formatUnitValue, toCanonicalUnitValue, unitLabel, type UnitSystem } from "@/lib/units";

import type { Align, Column, Section, SheetValues } from "./heat-load-sheet-types";
import { FenestrationFramePickerCell } from "./fenestration-frame-picker-cell";
import { getAshrae1997WallDropdownLabel, getWallCoreThicknessMm } from "./ashrae-wall-assemblies";
import {
  getAshraeTable5FrameOptions,
  getAshraeTable5SkylightFrameOptions,
  getAshraeTable5ThicknessOptions,
} from "./ashrae-calculations/fenestration-u-table5";
import {
  getAshrae1997SolarGlassThicknessOptions,
  getAshrae1997SolarShadingOptions,
} from "./ashrae-calculations/section-2";
import { normalizeSheetCellValue } from "./heat-load-sheet-normalization";
import { rowLooksLikeWall } from "./heat-load-wall-thickness";
import { RowReferenceToggle } from "./heat-load-reference-toggle";
import { getAshraeZoneLabel } from "./heat-load-zone-labels";
import { WallTypePickerCell } from "./wall-type-picker-cell";
import { getNum, SECTION3_INTERMEDIATE_FLOOR, section3FloorUsesGroundReview } from "./ashrae-calculations";

const SECTION3_INTERMEDIATE_FLOOR_CONSTRUCTION = "100 mm concrete wall + finish + plaster";
const numberColumnWidth = "5%";
const tableClass = "w-full table-fixed border-collapse text-[10px] leading-none text-slate-900";
const cellClass = "border border-slate-300 px-1 py-1 align-middle";

function getColumnLabel(column: Column, unitSystem: UnitSystem): string {
  return column.unit ? `${column.label} (${unitLabel(unitSystem, column.unit)})` : column.label;
}

function formatSheetCellValue(value: string, column: Column, unitSystem: UnitSystem): string {
  if (column.key === "zone") {
    return getAshraeZoneLabel(value);
  }

  if (value === "Not applicable") {
    return "-";
  }

  return column.unit ? formatUnitValue(value, unitSystem, column.unit) : value;
}

function parseSheetCellInput(value: string, column: Column, unitSystem: UnitSystem): string {
  return column.unit ? toCanonicalUnitValue(value, unitSystem, column.unit) : value;
}

function getDisplayValue(input: {
  row: Section["rows"][number];
  column: Column;
  cellValue: string;
  unitSystem: UnitSystem;
  rowIsInactive: boolean;
}) {
  if (input.rowIsInactive && ["calcValue", "heatLoad"].includes(input.column.key)) {
    return "-";
  }

  if (
    input.row.id === "3.3" &&
    input.column.key === "typeB" &&
    input.cellValue === SECTION3_INTERMEDIATE_FLOOR_CONSTRUCTION
  ) {
    return "100 mm concrete floor slab + finish";
  }

  return formatSheetCellValue(input.cellValue, input.column, input.unitSystem);
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
  const [openReferences, setOpenReferences] = useState<Record<string, boolean>>({});

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
          <th
            className={`${cellClass} bg-[#ffe7ee] text-left text-[11px] font-semibold text-slate-900`}
            colSpan={columns.length}
          >
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
        {rows.map((row) => {
          const referenceText = sheetValues[`${row.id}_reference`] ?? row.values.reference ?? "";
          const calculationTrace = sheetValues[`${row.id}_calculationTrace`] ?? "";
          const referenceIsOpen = Boolean(openReferences[row.id]);
          const rowWallType = row.values.type ?? row.values.typeA ?? row.values.typeB ?? "";
          const rowIsInactive = isInactiveSection3InteriorRow(number, row);
          return (
            <Fragment key={row.id}>
              <tr>
                <td className={`${cellClass} bg-white text-center font-medium text-slate-900`}>
                  <RowReferenceToggle
                    rowId={row.id}
                    referenceText={referenceText}
                    referenceIsOpen={referenceIsOpen}
                    onToggleReference={() =>
                      setOpenReferences((current) => ({
                        ...current,
                        [row.id]: !current[row.id],
                      }))
                    }
                  />
                </td>
                {columns.map((column) => {
                  const rawCellValue = row.values[column.key] ?? "";
                  const cellValue = normalizeSheetCellValue(row, column.key, rawCellValue);
                  const displayValue = getDisplayValue({
                    row,
                    column,
                    cellValue,
                    unitSystem,
                    rowIsInactive,
                  });
                  const sourceTitle = sheetValues[`${row.id}_${column.key}_source`] ?? "";
                  const titleText = sourceTitle ? `${displayValue}\n${sourceTitle}` : displayValue;
                  const rawOptions = row.selectOptions?.[column.key] ?? column.selectOptions ?? [];
                  const options = normalizeSelectOptions(row, column.key, rawOptions);
                  const locksWallThickness =
                    column.key === "thickness" &&
                    rowLooksLikeWall(row) &&
                    getWallCoreThicknessMm(rowWallType) !== null;
                  const hasOptions = options.length > 0;
                  const hasSelect = options.length > 1 && !locksWallThickness;
                  const showsWallDetailsToggle =
                    hasSelect &&
                    !isSection3PartitionRow(row) &&
                    isWallTypeColumn(row, column);
                  const showsFenestrationDetailsToggle =
                    hasSelect &&
                    rowUsesTable5Fenestration(row) &&
                    column.key === "detail";
                  const fillClass = hasOptions || !column.editable ? "bg-[#fff4f7]" : "bg-white";

                  return (
                    <td key={column.key} className={`${cellClass} ${fillClass} p-0`}>
                      {showsWallDetailsToggle ? (
                        <WallTypePickerCell
                          ariaLabel={`${row.id} ${column.label || column.key}`}
                          value={cellValue}
                          title={titleText}
                          align={column.align ?? "left"}
                          options={options}
                          onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                        />
                      ) : showsFenestrationDetailsToggle ? (
                        <FenestrationFramePickerCell
                          ariaLabel={`${row.id} ${column.label || column.key}`}
                          value={cellValue}
                          title={titleText}
                          align={column.align ?? "left"}
                          options={options}
                          onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                        />
                      ) : hasSelect ? (
                        <SheetSelectCell
                          ariaLabel={`${row.id} ${column.label || column.key}`}
                          value={cellValue}
                          title={titleText}
                          align={column.align ?? "left"}
                          options={options}
                          getOptionLabel={(option) => formatSelectOptionLabel(row, column, option, unitSystem)}
                          onValueChange={(value) => onCellChange(number, row.id, column.key, value)}
                        />
                      ) : column.editable && !locksWallThickness && !hasOptions ? (
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
              {(referenceText || calculationTrace) && referenceIsOpen ? (
                <tr>
                  <td className={`${cellClass} bg-[#fff4f7] text-left text-slate-900`} colSpan={columns.length + 1}>
                    {referenceText ? (
                      <div>
                        <span className="font-semibold">ASHRAE reference: </span>
                        <span>{referenceText}</span>
                      </div>
                    ) : null}
                    {calculationTrace ? (
                      <div className="mt-2 whitespace-pre-wrap border-t border-slate-200 pt-2 leading-snug">
                        {calculationTrace}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function normalizeSelectOptions(row: Section["rows"][number], key: string, options: readonly string[]) {
  if (rowUsesTable5Fenestration(row) && key === "thickness") {
    const table5Options = getAshraeTable5ThicknessOptions(row.values.type);
    return table5Options.length > 0 ? table5Options : Array.from(options);
  }
  if (rowUsesTable5Fenestration(row) && key === "detail") {
    const table5Options = row.id === "1.5S"
      ? getAshraeTable5SkylightFrameOptions(row.values.type, Number(row.values.thickness))
      : getAshraeTable5FrameOptions(row.values.type, Number(row.values.thickness));
    return table5Options.length > 0 ? table5Options : Array.from(options);
  }
  if (row.id === "3.1" && key === "thickness") {
    const table5Options = getAshraeTable5ThicknessOptions(row.values.typeA);
    return table5Options.length > 0 ? table5Options : Array.from(options);
  }
  if (row.id === "3.1" && key === "typeB") {
    const table5Options = getAshraeTable5FrameOptions(row.values.typeA, Number(row.values.thickness));
    const allowedOptions = Array.from(options).filter((option) => table5Options.includes(option));
    return allowedOptions.length > 0 ? allowedOptions : table5Options;
  }
  if (row.id === "3.3" && key === "typeB") {
    if (section3FloorUsesGroundReview(row.values.typeA)) {
      return ["Not applicable"];
    }
    if (row.values.typeA === SECTION3_INTERMEDIATE_FLOOR) {
      return [SECTION3_INTERMEDIATE_FLOOR_CONSTRUCTION];
    }
  }
  if (rowUsesSolarFenestration(row) && key === "thickness") {
    return getAshrae1997SolarGlassThicknessOptions(row.values.type);
  }
  if (rowUsesSolarFenestration(row) && key === "shading") {
    return getAshrae1997SolarShadingOptions(row.values.type, Number(row.values.thickness));
  }

  return Array.from(new Set(options.map((option) => normalizeSheetCellValue(row, key, option))));
}

function formatSelectOptionLabel(
  row: Section["rows"][number],
  column: Column,
  option: string,
  unitSystem: UnitSystem,
) {
  if (column.key === "thickness" && rowLooksLikeWall(row)) {
    return `${option} mm`;
  }
  if (rowUsesTable5Fenestration(row) && column.key === "thickness") {
    return `${option} mm`;
  }
  if (rowUsesTable5Fenestration(row) && column.key === "detail") {
    return option;
  }
  if (row.id === "3.1" && column.key === "thickness") {
    return `${option} mm`;
  }
  if (row.id === "3.1" && column.key === "typeB") {
    return option;
  }
  if (row.id === "3.3" && column.key === "typeB" && option === SECTION3_INTERMEDIATE_FLOOR_CONSTRUCTION) {
    return "100 mm concrete floor slab + finish";
  }
  if (isSection3PartitionRow(row) && column.key === "typeA") {
    return formatWallOptionWithThickness(option);
  }
  if (isWallTypeColumn(row, column)) {
    return getAshrae1997WallDropdownLabel(option);
  }

  return formatSheetCellValue(option, column, unitSystem);
}

function formatWallOptionWithThickness(option: string) {
  const label = getAshrae1997WallDropdownLabel(option);
  const thicknessMm = getWallCoreThicknessMm(option);

  if (!thicknessMm) {
    return label;
  }

  return label.includes(" (")
    ? label.replace(" (", ` ${thicknessMm} mm (`)
    : `${label} ${thicknessMm} mm`;
}

function isWallTypeColumn(row: Section["rows"][number], column: Column) {
  return (column.key === "type" || column.key === "typeA" || column.key === "typeB") && rowLooksLikeWall(row);
}

function rowUsesTable5Fenestration(row: Section["rows"][number]) {
  return row.id === "1.5" || row.id === "1.5S";
}

function rowUsesSolarFenestration(row: Section["rows"][number]) {
  return row.id.startsWith("2.");
}

function isInactiveSection3InteriorRow(sectionNumber: string, row: Section["rows"][number]) {
  return (
    sectionNumber === "3" &&
    (row.id === "3.1" || isSection3PartitionRow(row)) &&
    getNum(row.values.calcValue) <= 0
  );
}

function isSection3PartitionRow(row: Section["rows"][number]) {
  return row.values.item === "Wall Partition";
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
        className={`min-h-[24px] h-full min-w-[58px] w-full appearance-none cursor-pointer bg-[#fff4f7] px-1 py-1 pr-5 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
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
