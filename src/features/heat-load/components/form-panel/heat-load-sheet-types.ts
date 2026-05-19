import type { UnitKind, UnitSystem } from "@/lib/units";

export type FormValues = Record<string, string>;
export type SheetValues = Record<string, string>;
export type Align = "left" | "right" | "center";

export type Column = {
  key: string;
  label: string;
  unit?: UnitKind;
  align?: Align;
  wrap?: boolean;
  width?: string;
  editable?: boolean;
  selectOptions?: readonly string[];
};

export type SelectOptionsByKey = Partial<Record<string, readonly string[]>>;

export type Row = {
  id: string;
  values: Record<string, string>;
  selectOptions?: SelectOptionsByKey;
};

export type Section = {
  number: string;
  title: string;
  columns: Column[];
  rows: Row[];
};

export type SummaryRow = {
  label: string;
  note: string;
  value: string;
};

export type HeatLoadSheetProps = {
  formValues: FormValues;
  sheetValues: SheetValues;
  unitSystem: UnitSystem;
  onSheetChange: (key: string, value: string) => void;
};
