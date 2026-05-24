import { formatUnitValue, toCanonicalUnitValue, unitLabel, type UnitSystem } from "@/lib/units";

import type { SheetValues, SummaryRow } from "./heat-load-sheet-types";

const tableClass = "w-full table-auto border-collapse text-[10px] leading-none text-slate-900";
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
              <th className={`${cellClass} bg-[#fff4f7] text-left text-[11px] font-semibold text-slate-900 whitespace-normal break-words`}>
                {label}
              </th>
              <td className={`${cellClass} min-w-0 bg-white p-0`}>
                <input
                  type="text"
                  value={sheetValues[`${fieldKey}_note`] ?? row.note ?? ""}
                  onChange={(event) => onSheetChange(`${fieldKey}_note`, event.target.value)}
                  className="min-h-[24px] min-w-0 w-full bg-transparent px-2 py-1 text-right text-[10px] text-slate-900 outline-none"
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
                  className="min-h-[24px] min-w-0 w-full bg-transparent px-2 py-1 text-right text-[10px] text-slate-900 outline-none"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
