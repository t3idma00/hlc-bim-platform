import { TopInputCell, TopSelectField } from "./top-form-fields";

type FormValues = Record<string, string>;

type ConditionRow =
  | {
      kind: "input";
      label: string;
      name: string;
    }
  | {
      kind: "select";
      label: string;
      name: string;
      options: string[];
      defaultValue: string;
    };

const conditionRows: ConditionRow[] = [
  { kind: "input", label: "Outside temp.", name: "outsideCondition" },
  { kind: "input", label: "Inside temp.", name: "insideCondition" },
  { kind: "input", label: "Temp. difference", name: "conditionDifference" },
  {
    kind: "select",
    label: "Condition type",
    name: "conditionType",
    options: ["Relative Humidity", "Wet bulb temperature"],
    defaultValue: "Relative Humidity",
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

  if (conditionRow.kind === "select") {
    return (
      <>
        <td className="border border-slate-300 bg-[#fff4f7] p-0">
          <TopSelectField
            ariaLabel={conditionRow.label}
            name={conditionRow.name}
            options={conditionRow.options}
            value={values[conditionRow.name] ?? conditionRow.defaultValue}
            onValueChange={onFieldChange}
          />
        </td>
        <td className="border border-slate-300 bg-white p-0">
          <TopInputCell
            ariaLabel="Condition value"
            name="conditionValue"
            align="right"
            value={values.conditionValue ?? ""}
            onValueChange={onFieldChange}
          />
        </td>
      </>
    );
  }

  return (
    <>
      <th className="border border-slate-300 bg-[#fff4f7] px-2 py-2 text-left text-[10px] font-semibold text-slate-900">
        {conditionRow.label}
      </th>
      <td className="border border-slate-300 bg-white p-0">
        <TopInputCell
          ariaLabel={conditionRow.label}
          name={conditionRow.name}
          align="right"
          value={values[conditionRow.name] ?? ""}
          onValueChange={onFieldChange}
        />
      </td>
    </>
  );
}
