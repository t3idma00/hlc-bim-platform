import { formatUnitValue, toCanonicalUnitValue, unitLabel, type UnitSystem } from "@/lib/units";

import type { SheetValues, SummaryRow } from "./heat-load-sheet-types";

const summaryNoteWidth = "10%";
const summaryValueWidth = "9%";
const tableClass = "w-full table-fixed border-collapse text-[10px] leading-none text-slate-900";
const cellClass = "border border-slate-300 px-1 py-1 align-middle";

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
