import { Fragment, useState } from "react";

import { formatUnitValue, toCanonicalUnitValue, toDisplayUnit, unitLabel, type UnitSystem } from "@/lib/units";

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
import { CompletionBadge } from "./completion-badge";
import { isManualSelectComplete, manualSelectMarkerKey } from "./progress-tracking";
import {
  getNum,
  SECTION3_CONDITIONED_ADJACENT_SPACE,
  SECTION3_GROUND_ADJACENT_SPACE,
  SECTION3_INTERMEDIATE_FLOOR,
  SECTION3_MANUAL_ADJACENT_SPACE,
  SECTION3_OUTDOOR_ADJACENT_SPACE,
  SECTION3_UNKNOWN_ADJACENT_SPACE,
  section3FloorUsesGroundReview,
} from "./ashrae-calculations";

const SECTION3_INTERMEDIATE_FLOOR_CONSTRUCTION = "100 mm concrete wall + finish + plaster";
const tableClass = "w-full table-fixed border-collapse text-[10px] leading-snug text-slate-900";
const cellClass = "border border-slate-200 px-1.5 py-1.5 align-middle";
const referenceColumnPercent = 5;

function getColumnLabel(column: Column, unitSystem: UnitSystem) {
  if (!column.unit) {
    return column.label;
  }

  const unit = unitLabel(unitSystem, column.unit);

  if (column.key === "heatLoad" || column.key === "result") {
    return (
      <span className="flex flex-col items-center gap-0.5 leading-tight">
        <span>Total Heat Load</span>
        <span>({unit})</span>
      </span>
    );
  }

  return `${column.label} (${unit})`;
}

function formatSheetCellValue(value: string, column: Column, unitSystem: UnitSystem): string {
  if (column.key === "zone") {
    return getAshraeZoneLabel(value);
  }

  if (column.key === "adjacentSpaceType") {
    return formatAdjacentSpaceType(value);
  }

  if (value === "Not applicable") {
    return "-";
  }

  if (isTotalHeatLoadColumn(column)) {
    return formatFixedHeatValue(value, unitSystem);
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

  if (isSection6TotalHeatCell(input.row, input.column)) {
    return formatSection6TotalHeatLoad(input.row, input.unitSystem);
  }

  return formatSheetCellValue(input.cellValue, input.column, input.unitSystem);
}

function isSection6TotalHeatCell(row: Section["rows"][number], column: Column) {
  return row.id.startsWith("6.") && column.key === "heatLoad";
}

function getSection6TotalHeatLoad(row: Section["rows"][number]) {
  return getNum(row.values.sensible) + getNum(row.values.latent);
}

function formatSection6TotalHeatLoad(row: Section["rows"][number], unitSystem: UnitSystem) {
  return toDisplayUnit(getSection6TotalHeatLoad(row), unitSystem, "heat").toFixed(0);
}

function isTotalHeatLoadColumn(column: Column) {
  return column.unit === "heat" && (column.key === "heatLoad" || column.key === "result");
}

function formatFixedHeatValue(value: string, unitSystem: UnitSystem) {
  const parsed = Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return toDisplayUnit(parsed, unitSystem, "heat").toFixed(0);
}

function cellIsComplete(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== "N/A" && normalized !== "Not applicable" && normalized !== "-");
}

function cellHasSelectableControl(row: Section["rows"][number], column: Column) {
  const rawOptions = row.selectOptions?.[column.key] ?? column.selectOptions ?? [];
  const options = normalizeSelectOptions(row, column.key, rawOptions);
  const rowWallType = row.values.type ?? row.values.typeA ?? row.values.typeB ?? "";
  const locksWallThickness =
    column.key === "thickness" &&
    rowLooksLikeWall(row) &&
    getWallCoreThicknessMm(rowWallType) !== null;

  return options.length > 1 && !locksWallThickness;
}

function getSectionCompletion(input: {
  columns: Column[];
  rows: Section["rows"];
  sheetValues: SheetValues;
}) {
  const checks = input.rows.flatMap((row) =>
    input.columns
      .filter((column) => column.editable || cellHasSelectableControl(row, column))
      .map((column) => {
        const cellKey = `${row.id}_${column.key}`;
        const value = input.sheetValues[cellKey] ?? row.values[column.key];

        return cellHasSelectableControl(row, column)
          ? isManualSelectComplete(input.sheetValues, cellKey, value) && cellIsComplete(value)
          : cellIsComplete(value);
      }),
  );

  if (!checks.length) {
    return 0;
  }

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getColumnWidth(column: Column, totalWeight: number) {
  const weight = Number.parseFloat(column.width ?? "");
  const fallbackWeight = totalWeight > 0 ? totalWeight : 1;

  if (!Number.isFinite(weight) || weight <= 0 || totalWeight <= 0) {
    return `${(100 - referenceColumnPercent) / fallbackWeight}%`;
  }

  return `${(weight / totalWeight) * (100 - referenceColumnPercent)}%`;
}

export function SectionTable({
  number,
  displayNumber,
  title,
  columns,
  rows,
  unitSystem,
  sheetValues,
  onCellChange,
}: Section & {
  displayNumber?: string;
  unitSystem: UnitSystem;
  sheetValues: SheetValues;
  onCellChange: (sectionNumber: string, rowId: string, key: string, value: string) => void;
}) {
  const [openReferences, setOpenReferences] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(true);
  const contentId = `heat-load-calculation-section-${number}`;
  const visibleNumber = displayNumber ?? number;
  const completion = getSectionCompletion({ columns, rows, sheetValues });
  const totalColumnWeight = columns.reduce((total, column) => {
    const weight = Number.parseFloat(column.width ?? "");
    return total + (Number.isFinite(weight) && weight > 0 ? weight : 1);
  }, 0);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-xs font-semibold text-[#be123c] ring-1 ring-slate-200">
            {visibleNumber}
          </span>
          <h4 className="min-w-0 text-sm font-semibold text-slate-950">{title}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CompletionBadge percent={completion} />
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={contentId}
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? `Expand section ${visibleNumber}` : `Collapse section ${visibleNumber}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-[#be123c] focus:outline-none focus:ring-2 focus:ring-rose-100"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
            >
              <path
                d="M5.5 8 10 12.5 14.5 8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>
      </div>
      <div id={contentId} hidden={collapsed} className="overflow-hidden">
        <table className={tableClass}>
          <colgroup>
            <col style={{ width: `${referenceColumnPercent}%` }} />
            {columns.map((column) => (
              <col key={column.key} style={{ width: getColumnWidth(column, totalColumnWeight) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={`${cellClass} bg-white text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500`}>
                Ref
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${cellClass} whitespace-normal break-words bg-white text-center text-[9px] font-semibold leading-tight text-slate-700`}
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
                      const cellKey = `${row.id}_${column.key}`;
                      const rawCellValue = row.values[column.key] ?? "";
                      const cellValue = normalizeSheetCellValue(row, column.key, rawCellValue);
                      const displayValue = getDisplayValue({
                        row,
                        column,
                        cellValue,
                        unitSystem,
                        rowIsInactive,
                      });
                      const sourceTitle = sheetValues[`${cellKey}_source`] ?? "";
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
                      const selectWasManuallyChosen = sheetValues[manualSelectMarkerKey(cellKey)] === "1";
                      const fillClass = hasOptions || !column.editable ? "bg-slate-50" : "bg-white";

                      return (
                        <td key={column.key} className={`${cellClass} min-w-0 ${fillClass} p-0`}>
                          {showsWallDetailsToggle ? (
                            <WallTypePickerCell
                              ariaLabel={`${row.id} ${column.label || column.key}`}
                              value={selectWasManuallyChosen ? cellValue : ""}
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
                      <td className={`${cellClass} bg-slate-50 text-left text-slate-900`} colSpan={columns.length + 1}>
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
      </div>
    </section>
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

function formatAdjacentSpaceType(value: string) {
  if (value === SECTION3_UNKNOWN_ADJACENT_SPACE) return "Unconditioned";
  if (value === SECTION3_MANUAL_ADJACENT_SPACE) return "Manual temp";
  if (value === SECTION3_OUTDOOR_ADJACENT_SPACE) return "Outdoor";
  if (value === SECTION3_CONDITIONED_ADJACENT_SPACE) return "Conditioned";
  if (value === SECTION3_GROUND_ADJACENT_SPACE) return "Ground/slab";
  return value;
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
    (row.id === "3.1" || row.id === "3.4" || isSection3PartitionRow(row)) &&
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
  const wrapClass = wrap && align !== "right" ? "whitespace-normal break-words" : "whitespace-nowrap";

  return (
    <div
      aria-label={ariaLabel}
      title={title ?? value}
      className={`min-h-[26px] h-full min-w-0 w-full px-1.5 py-1.5 text-[10px] leading-snug text-slate-900 tabular-nums ${alignClass} ${wrapClass}`}
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
      className={`min-h-[26px] h-full min-w-0 w-full bg-transparent px-1.5 py-1.5 text-[10px] leading-snug text-slate-900 tabular-nums outline-none transition focus:bg-white ${alignClass}`}
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
    <div className="relative min-h-[26px] h-full min-w-0 w-full">
      <select
        aria-label={ariaLabel}
        value={value}
        title={title ?? value}
        onChange={(event) => onValueChange(event.target.value)}
        className={`min-h-[26px] h-full min-w-0 w-full appearance-none cursor-pointer whitespace-normal bg-slate-50 px-1.5 py-1.5 pr-5 text-[10px] leading-snug text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-inset focus:ring-rose-100 ${alignClass}`}
      >
        <option value="">Select</option>
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
