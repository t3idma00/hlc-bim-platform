type FormValues = Record<string, string>;
type SurfaceType = "walls" | "windows" | "doors";

export function DirectionDimensionCell({
  name,
  surfaceType,
  values,
  onFieldChange,
}: {
  name: string;
  surfaceType: SurfaceType;
  values: FormValues;
  onFieldChange: (name: string, value: string) => void;
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
        onValueChange={onFieldChange}
      />
      <DimensionField
        label="H"
        name={`${name}Height`}
        value={values[`${name}Height`] ?? defaultHeight}
        onValueChange={onFieldChange}
      />
    </div>
  );
}

function DimensionField({
  label,
  name,
  value,
  onValueChange,
}: {
  label: string;
  name: string;
  value: string;
  onValueChange: (name: string, value: string) => void;
}) {
  return (
    <>
      <span className="text-[10px] font-semibold text-slate-900">{label}</span>
      <input
        aria-label={name}
        name={name}
        type="text"
        value={value}
        onChange={(event) => onValueChange(name, event.target.value)}
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

export function TopSelectField({
  ariaLabel,
  name,
  options,
  value,
  onValueChange,
}: {
  ariaLabel: string;
  name: string;
  options: string[];
  value: string;
  onValueChange: (name: string, value: string) => void;
}) {
  return (
    <div className="relative min-h-[30px] h-full w-full">
      <select
        aria-label={ariaLabel}
        name={name}
        value={value}
        onChange={(event) => onValueChange(name, event.target.value)}
        className="min-h-[30px] h-full w-full appearance-none cursor-pointer bg-[#fff4f7] px-2 py-2 pr-7 text-left text-[10px] font-semibold leading-snug text-slate-900 outline-none"
        style={{ fontWeight: 600, fontFamily: "inherit" }}
      >
        {options.map((option) => (
          <option key={option} value={option} style={{ fontWeight: 600 }}>
            {option}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-2 top-1/2 h-[6px] w-[10px] -translate-y-1/2 text-slate-900"
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
