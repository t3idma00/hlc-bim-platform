import { useState } from "react";

import { formatUnitValue, toCanonicalUnitValue, unitLabel, type UnitSystem } from "@/lib/units";

import type { SheetValues, SummaryRow } from "./heat-load-sheet-types";
import { CompletionBadge } from "./completion-badge";

const tableClass = "w-full min-w-[520px] table-auto border-collapse text-[10px] leading-snug text-slate-900";
const cellClass = "border border-slate-200 px-1.5 py-1.5 align-middle";

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
  const [collapsed, setCollapsed] = useState(true);
  const completion = getSummaryCompletion(rows, sheetValues);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-950">Summary</h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CompletionBadge percent={completion} />
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls="heat-load-summary-card"
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? "Expand summary" : "Collapse summary"}
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
      <div id="heat-load-summary-card" hidden={collapsed} className="overflow-x-auto">
        <table className={tableClass}>
          <tbody>
            {rows.map((row, index) => {
              const fieldKey = `summary_${index}`;
              const isPrimaryHeatLoad = index === 0;
              const isSafetyFactor = index === 1;
              const label = isPrimaryHeatLoad
                ? `${row.label} (${unitLabel(unitSystem, "heat")})`
                : isSafetyFactor
                  ? `${row.label} (%)`
                  : row.label;
              const value = sheetValues[fieldKey] ?? row.value ?? "";
              const displayValue = isPrimaryHeatLoad ? formatUnitValue(value, unitSystem, "heat") : value;

              return (
                <tr key={row.label}>
                  <th className={`${cellClass} whitespace-normal break-words bg-slate-50 text-left text-[10px] font-semibold text-slate-900`}>
                    {label}
                  </th>
                  <td className={`${cellClass} min-w-0 bg-white p-0`}>
                    <input
                      type="text"
                      value={sheetValues[`${fieldKey}_note`] ?? row.note ?? ""}
                      onChange={(event) => onSheetChange(`${fieldKey}_note`, event.target.value)}
                      className="min-h-[26px] min-w-0 w-full bg-transparent px-1.5 py-1.5 text-right text-[10px] text-slate-900 outline-none transition focus:bg-white"
                    />
                  </td>
                  <td className={`${cellClass} min-w-0 bg-white p-0`}>
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
                      className="min-h-[26px] min-w-0 w-full bg-transparent px-1.5 py-1.5 text-right text-[10px] text-slate-900 outline-none transition focus:bg-white"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getSummaryCompletion(rows: SummaryRow[], sheetValues: SheetValues) {
  if (!rows.length) {
    return 0;
  }

  const checks = rows.map((row, index) => Boolean((sheetValues[`summary_${index}`] ?? row.value ?? "").trim()));

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
