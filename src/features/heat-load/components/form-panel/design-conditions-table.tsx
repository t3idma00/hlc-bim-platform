import {
  formatUnitValue,
  toCanonicalUnitValue,
  unitLabel,
  type UnitSystem,
} from "@/lib/units";

type FormValues = Record<string, string>;
type DesignConditionSource = "" | "current" | "ashrae-2017";

type ConditionRow =
  | {
      kind: "outdoorDryBulb";
      label: string;
      dryBulbName: string;
      percentageName: string;
      yearName: string;
      percentageOptions: string[];
      yearOptions: string[];
    }
  | {
      kind: "typeValue";
      label: string;
      typeName: string;
      valueName: string;
      options: string[];
      defaultType: string;
    }
  | {
      kind: "indoorDryBulb";
      label: string;
      indoorDryBulbName: string;
      differenceName: string;
    };

const conditionRows: ConditionRow[] = [
  {
    kind: "outdoorDryBulb",
    label: "Outdoor dry bulb temp",
    dryBulbName: "dryBulbTemp",
    percentageName: "dryBulbPercentile",
    yearName: "designYear",
    percentageOptions: ["0.4", "1", "2", "5"],
    yearOptions: Array.from({ length: 8 }, (_, index) => String(new Date().getUTCFullYear() - 1 - index)),
  },
  {
    kind: "typeValue",
    label: "Outdoor WB / RH",
    typeName: "conditionType",
    valueName: "conditionValue",
    options: ["Relative Humidity", "Wet bulb temperature"],
    defaultType: "Relative Humidity",
  },
  {
    kind: "indoorDryBulb",
    label: "Indoor dry bulb temp",
    indoorDryBulbName: "insideCondition",
    differenceName: "conditionDifference",
  },
  {
    kind: "typeValue",
    label: "Indoor WB / RH",
    typeName: "indoorConditionType",
    valueName: "indoorConditionValue",
    options: ["Relative Humidity", "Wet bulb temperature"],
    defaultType: "Relative Humidity",
  },
];

export function DesignConditionsHeader({
  sourceSummary,
}: {
  sourceSummary?: string;
}) {
  return (
    <th
      className="border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs text-[#9f1239]"
      colSpan={2}
    >
      <div className="space-y-1">
        <div className="font-semibold uppercase tracking-[0.16em]">Design Conditions</div>
        <p className="text-xs font-medium normal-case tracking-normal text-slate-600">{sourceSummary}</p>
      </div>
    </th>
  );
}

export function DesignConditionsRow({
  rowIndex,
  values,
  unitSystem,
  designConditionSource,
  onFieldChange,
  onSelectChange,
}: {
  rowIndex: number;
  values: FormValues;
  unitSystem: UnitSystem;
  designConditionSource: DesignConditionSource;
  onFieldChange: (name: string, value: string) => void;
  onSelectChange: (name: string, value: string) => void;
}) {
  const conditionRow = conditionRows[rowIndex];
  const temperatureLabel = unitLabel(unitSystem, "temperature");
  const temperatureDeltaLabel = unitLabel(unitSystem, "temperatureDelta");

  if (conditionRow.kind === "outdoorDryBulb") {
    const percentageOptions =
      designConditionSource === "ashrae-2017" ? ["0.4", "1", "2"] : conditionRow.percentageOptions;
    const selectValue = values[conditionRow.percentageName] ?? "";
    const yearValue = values[conditionRow.yearName] ?? "";

    return (
      <>
        <th className="border border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold text-slate-900">
          {conditionRow.label} ({temperatureLabel})
        </th>
        <td className="border border-slate-200 bg-white p-0">
          <div className="grid min-h-[34px] grid-cols-[minmax(70px,1fr)_62px_72px] items-stretch">
            <input
              aria-label="Outdoor dry bulb temperature"
              name={conditionRow.dryBulbName}
              type="text"
              value={formatUnitValue(values[conditionRow.dryBulbName], unitSystem, "temperature")}
              onChange={(event) => onFieldChange(conditionRow.dryBulbName, toCanonicalUnitValue(event.target.value, unitSystem, "temperature"))}
              className="h-full min-h-[34px] min-w-0 w-full bg-transparent px-2 text-right text-xs font-semibold leading-snug text-slate-900 outline-none transition focus:bg-white"
            />
            <div className="border-l border-slate-200">
              <select
                aria-label="Dry bulb percentile"
                name={conditionRow.percentageName}
                value={selectValue}
                onChange={(event) => onSelectChange(conditionRow.percentageName, event.target.value)}
                className="h-full min-h-[34px] w-full bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-inset focus:ring-rose-100"
              >
                <option value="">Select</option>
                {percentageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}%
                  </option>
                ))}
              </select>
            </div>
            <div className="border-l border-slate-200">
              {designConditionSource === "current" ? (
                <select
                  aria-label="Design year"
                  name={conditionRow.yearName}
                  value={yearValue}
                  onChange={(event) => onSelectChange(conditionRow.yearName, event.target.value)}
                  className="h-full min-h-[34px] w-full bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-inset focus:ring-rose-100"
                >
                  <option value="">Select</option>
                  {conditionRow.yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex h-full min-h-[34px] items-center justify-center bg-slate-50 px-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  ASHRAE
                </div>
              )}
            </div>
          </div>
        </td>
      </>
    );
  }

  if (conditionRow.kind === "typeValue") {
    const selectedType = values[conditionRow.typeName] ?? "";
    const isOutdoorCondition = conditionRow.valueName === "conditionValue";
    const isWetBulb = selectedType === "Wet bulb temperature";
    const valueLabel = selectedType
      ? isWetBulb
        ? ` (${temperatureLabel})`
        : " (%)"
      : isOutdoorCondition && values.wetBulbTemp
        ? ` (${temperatureLabel})`
        : "";
    const displayValue = isWetBulb
      ? formatUnitValue(values[conditionRow.valueName], unitSystem, "temperature")
      : selectedType === "Relative Humidity"
        ? (values[conditionRow.valueName] ?? "")
        : isOutdoorCondition && values.wetBulbTemp
          ? formatUnitValue(values.wetBulbTemp, unitSystem, "temperature")
          : "";

    return (
      <>
        <th className="border border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold text-slate-900">
          {conditionRow.label}{valueLabel}
        </th>
        <td className="border border-slate-200 bg-white p-0">
          <div className="grid min-h-[34px] grid-cols-[150px_minmax(0,1fr)] items-stretch">
            <div className="border-r border-slate-200 px-1">
              <select
                aria-label={conditionRow.label}
                name={conditionRow.typeName}
                value={selectedType}
                onChange={(event) => onSelectChange(conditionRow.typeName, event.target.value)}
                className="h-full min-h-[34px] w-full bg-transparent px-1.5 text-[11px] font-semibold text-slate-900 outline-none transition focus:bg-white"
              >
                <option value="">Select</option>
                {conditionRow.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <input
              aria-label={`${conditionRow.label} value`}
              name={conditionRow.valueName}
              type="text"
              value={displayValue}
              onChange={(event) =>
                onFieldChange(
                  conditionRow.valueName,
                  isWetBulb ? toCanonicalUnitValue(event.target.value, unitSystem, "temperature") : event.target.value,
                )
              }
              className="h-full min-h-[34px] min-w-0 w-full bg-transparent px-2 text-xs leading-snug text-slate-900 outline-none transition focus:bg-white"
            />
          </div>
        </td>
      </>
    );
  }

  if (conditionRow.kind === "indoorDryBulb") {
    return (
      <>
        <th className="border border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold text-slate-900">
          {conditionRow.label} ({temperatureLabel})
        </th>
        <td className="border border-slate-200 bg-white p-0">
          <div className="grid min-h-[34px] grid-cols-[minmax(0,1fr)_118px] items-stretch">
            <input
              aria-label="Indoor dry bulb"
              name={conditionRow.indoorDryBulbName}
              type="text"
              value={formatUnitValue(values[conditionRow.indoorDryBulbName], unitSystem, "temperature")}
              onChange={(event) => onFieldChange(conditionRow.indoorDryBulbName, toCanonicalUnitValue(event.target.value, unitSystem, "temperature"))}
              className="h-full min-h-[34px] min-w-0 w-full bg-transparent px-2 text-right text-xs leading-snug text-slate-900 outline-none transition focus:bg-white"
            />
            <div className="border-l border-slate-200 bg-slate-50 px-2">
              <div className="flex h-full min-h-[34px] items-center justify-between gap-1.5 text-[9px] font-semibold text-slate-700">
                <span>DeltaT ({temperatureDeltaLabel})</span>
                <span aria-label="Dry bulb temperature difference" className="text-[11px] text-slate-900">
                  {formatUnitValue(values[conditionRow.differenceName], unitSystem, "temperatureDelta")}
                </span>
              </div>
            </div>
          </div>
        </td>
      </>
    );
  }

  return null;
}
