import { formatUnitValue, toCanonicalUnitValue, type UnitSystem } from "@/lib/units";

type FormValues = Record<string, string>;
type SurfaceType = "walls" | "windows" | "doors";

export function DirectionDimensionCell({
  name,
  surfaceType,
  values,
  onFieldChange,
  unitSystem,
}: {
  name: string;
  surfaceType: SurfaceType;
  values: FormValues;
  onFieldChange: (name: string, value: string) => void;
  unitSystem: UnitSystem;
}) {
  const defaultHeight = name.startsWith("wall") ? "3" : "";
  const isOpeningSurface = surfaceType === "windows" || surfaceType === "doors";
  const primaryLabel = isOpeningSurface ? "W" : "L/W";
  const primaryFieldName = `${name}${isOpeningSurface ? "Width" : "Length"}`;

  return (
    <div className="grid min-h-[30px] grid-cols-[20px_minmax(0,1fr)_10px_minmax(0,1fr)] items-center gap-x-1 px-2 py-1">
      <DimensionField
        label={primaryLabel}
        name={primaryFieldName}
        value={values[primaryFieldName] ?? ""}
        unitSystem={unitSystem}
        onValueChange={onFieldChange}
      />
      <DimensionField
        label="H"
        name={`${name}Height`}
        value={values[`${name}Height`] ?? defaultHeight}
        unitSystem={unitSystem}
        onValueChange={onFieldChange}
      />
    </div>
  );
}

function DimensionField({
  label,
  name,
  value,
  unitSystem,
  onValueChange,
}: {
  label: string;
  name: string;
  value: string;
  unitSystem: UnitSystem;
  onValueChange: (name: string, value: string) => void;
}) {
  const displayValue = formatUnitValue(value, unitSystem, "length");

  return (
    <>
      <span className="text-[10px] font-semibold text-slate-900">{label}</span>
      <input
        aria-label={name}
        name={name}
        type="text"
        value={displayValue}
        onChange={(event) => onValueChange(name, toCanonicalUnitValue(event.target.value, unitSystem, "length"))}
        className="h-6 min-w-0 w-full border border-slate-200 bg-white px-1 text-center text-[10px] leading-snug text-slate-900 outline-none"
      />
    </>
  );
}

export function TopInputCell({
  ariaLabel,
  name,
  align = "left",
  value,
  onValueChange,
}: {
  ariaLabel: string;
  name: string;
  align?: "left" | "right";
  value: string;
  onValueChange: (name: string, value: string) => void;
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <input
      aria-label={ariaLabel}
      name={name}
      type="text"
      value={value}
      onChange={(event) => onValueChange(name, event.target.value)}
      className={`min-h-[30px] h-full w-full bg-transparent px-2 py-2 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
    />
  );
}

export function TopStaticField({
  ariaLabel,
  value,
}: {
  ariaLabel: string;
  value: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex min-h-[30px] h-full w-full items-center bg-[#fff4f7] px-2 py-2 text-left text-[10px] font-semibold leading-snug text-slate-900"
    >
      {value}
    </div>
  );
}

export function TopSelectField({
  ariaLabel,
  name,
  value,
  options,
  onValueChange,
}: {
  ariaLabel: string;
  name: string;
  value: string;
  options: string[];
  onValueChange: (name: string, value: string) => void;
}) {
  return (
    <select
      aria-label={ariaLabel}
      name={name}
      value={value}
      onChange={(event) => onValueChange(name, event.target.value)}
      className="flex min-h-[30px] h-full w-full items-center bg-[#fff4f7] px-2 py-2 text-left text-[10px] font-semibold leading-snug text-slate-900 outline-none cursor-pointer"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
