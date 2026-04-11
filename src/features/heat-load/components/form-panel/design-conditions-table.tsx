type FormValues = Record<string, string>;

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
    label: "Outdoor condition",
    dryBulbName: "dryBulbTemp",
    percentageName: "dryBulbPercentile",
    yearName: "designYear",
    percentageOptions: ["0.4", "1", "2", "5", "10"],
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
    label: "Indoor dry bulb",
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

export function DesignConditionsHeader() {
  return (
    <th
      className="border border-slate-300 bg-[#ffe7ee] px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9f1239]"
      colSpan={2}
    >
      Design Conditions
    </th>
  );
}

export function DesignConditionsRow({
  rowIndex,
  values,
  onFieldChange,
}: {
  rowIndex: number;
  values: FormValues;
  onFieldChange: (name: string, value: string) => void;
}) {
  const conditionRow = conditionRows[rowIndex];

  if (conditionRow.kind === "outdoorDryBulb") {
    const selectValue = values[conditionRow.percentageName] ?? conditionRow.percentageOptions[0];
    const yearValue = values[conditionRow.yearName] ?? conditionRow.yearOptions[0];

    return (
      <>
        <th className="border border-slate-300 bg-[#fff4f7] px-1 py-2 text-left text-[10px] font-semibold text-slate-900">
          {conditionRow.label}
        </th>
        <td className="border border-slate-300 bg-white p-0">
          <div className="grid min-h-[30px] grid-cols-[minmax(0,1fr)_46px_58px] items-stretch">
            <input
              aria-label="Outdoor dry bulb temperature"
              name={conditionRow.dryBulbName}
              type="text"
              value={values[conditionRow.dryBulbName] ?? ""}
              onChange={(event) => onFieldChange(conditionRow.dryBulbName, event.target.value)}
              className="h-full min-h-[30px] min-w-0 w-full bg-transparent px-1 text-right text-[10px] leading-snug text-slate-900 outline-none"
            />
            <div className="border-l border-slate-200">
              <select
                aria-label="Dry bulb percentile"
                name={conditionRow.percentageName}
                value={selectValue}
                onChange={(event) => onFieldChange(conditionRow.percentageName, event.target.value)}
                className="h-full min-h-[30px] w-full bg-transparent px-0 text-[9px] font-semibold text-slate-900 outline-none"
              >
                {conditionRow.percentageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}%
                  </option>
                ))}
              </select>
            </div>
            <div className="border-l border-slate-200">
              <select
                aria-label="Design year"
                name={conditionRow.yearName}
                value={yearValue}
                onChange={(event) => onFieldChange(conditionRow.yearName, event.target.value)}
                className="h-full min-h-[30px] w-full bg-transparent px-0 text-[9px] font-semibold text-slate-900 outline-none"
              >
                {conditionRow.yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </td>
      </>
    );
  }

  if (conditionRow.kind === "typeValue") {
    return (
      <>
        <th className="border border-slate-300 bg-[#fff4f7] px-1 py-2 text-left text-[10px] font-semibold text-slate-900">
          {conditionRow.label}
        </th>
        <td className="border border-slate-300 bg-white p-0">
          <div className="grid min-h-[30px] grid-cols-[120px_minmax(0,1fr)] items-stretch">
            <div className="border-r border-slate-200 px-1">
              <select
                aria-label={conditionRow.label}
                name={conditionRow.typeName}
                value={values[conditionRow.typeName] ?? conditionRow.defaultType}
                onChange={(event) => onFieldChange(conditionRow.typeName, event.target.value)}
                className="h-full min-h-[30px] w-full bg-transparent px-0 text-[9px] font-semibold text-slate-900 outline-none"
              >
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
              value={values[conditionRow.valueName] ?? ""}
              onChange={(event) => onFieldChange(conditionRow.valueName, event.target.value)}
              className="h-full min-h-[30px] min-w-0 w-full bg-transparent px-1 text-right text-[10px] leading-snug text-slate-900 outline-none"
            />
          </div>
        </td>
      </>
    );
  }

  if (conditionRow.kind === "indoorDryBulb") {
    return (
      <>
        <th className="border border-slate-300 bg-[#fff4f7] px-1 py-2 text-left text-[10px] font-semibold text-slate-900">
          {conditionRow.label}
        </th>
        <td className="border border-slate-300 bg-white p-0">
          <div className="grid min-h-[30px] grid-cols-[minmax(0,1fr)_96px] items-stretch">
            <input
              aria-label="Indoor dry bulb"
              name={conditionRow.indoorDryBulbName}
              type="text"
              value={values[conditionRow.indoorDryBulbName] ?? ""}
              onChange={(event) => onFieldChange(conditionRow.indoorDryBulbName, event.target.value)}
              className="h-full min-h-[30px] min-w-0 w-full bg-transparent px-1 text-right text-[10px] leading-snug text-slate-900 outline-none"
            />
            <div className="border-l border-slate-200 bg-slate-50 px-1">
              <div className="flex h-full min-h-[30px] items-center justify-between text-[8px] font-semibold text-slate-700">
                <span>ΔT dry bulb</span>
                <span aria-label="Dry bulb temperature difference" className="text-[9px] text-slate-800">
                  {values[conditionRow.differenceName] ?? ""}
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
