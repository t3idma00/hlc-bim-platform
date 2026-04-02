import { DirectionDimensionCell, TopSelectField } from "./top-form-fields";

type SurfaceType = "walls" | "windows" | "doors";
type FormValues = Record<string, string>;

type RoomRow = {
  name: string;
  defaultDirection: string;
};

const directionOptions = ["North", "East", "South", "West"];

const surfaceTabs: { key: SurfaceType; label: string }[] = [
  { key: "walls", label: "Walls" },
  { key: "windows", label: "Windows" },
  { key: "doors", label: "Doors" },
];

const roomRowsBySurface: Record<SurfaceType, RoomRow[]> = {
  walls: [
    { name: "wallNorth", defaultDirection: "North" },
    { name: "wallEast", defaultDirection: "East" },
    { name: "wallSouth", defaultDirection: "South" },
    { name: "wallWest", defaultDirection: "West" },
  ],
  windows: [
    { name: "windowNorth", defaultDirection: "North" },
    { name: "windowEast", defaultDirection: "East" },
    { name: "windowSouth", defaultDirection: "South" },
    { name: "windowWest", defaultDirection: "West" },
  ],
  doors: [
    { name: "doorNorth", defaultDirection: "North" },
    { name: "doorEast", defaultDirection: "East" },
    { name: "doorSouth", defaultDirection: "South" },
    { name: "doorWest", defaultDirection: "West" },
  ],
};

export function RoomDetailsHeader({
  surfaceType,
  onSurfaceChange,
}: {
  surfaceType: SurfaceType;
  onSurfaceChange: (surfaceType: SurfaceType) => void;
}) {
  return (
    <th
      className="border border-slate-300 bg-[#ffe7ee] px-0 py-0 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9f1239]"
      colSpan={2}
    >
      <div className="flex items-end justify-between gap-3 px-2 pt-2">
        <span className="pb-2">Room Details</span>
        <div className="flex items-end">
          {surfaceTabs.map((tab) => {
            const isActive = surfaceType === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSurfaceChange(tab.key)}
                className={`relative flex h-7 w-[78px] items-center justify-center border px-3 text-[9px] font-semibold normal-case tracking-[0.14em] leading-none ${
                  isActive
                    ? "-mb-px z-10 border-[#9f1239] border-b-[#fff8fa] bg-[#9f1239] text-white"
                    : "border-slate-300 bg-[#fff4f7] text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </th>
  );
}

export function RoomDetailsRow({
  surfaceType,
  rowIndex,
  values,
  onFieldChange,
}: {
  surfaceType: SurfaceType;
  rowIndex: number;
  values: FormValues;
  onFieldChange: (name: string, value: string) => void;
}) {
  const roomRow = roomRowsBySurface[surfaceType][rowIndex];

  return (
    <>
      <td className="border border-slate-300 bg-[#fff4f7] p-0">
        <TopSelectField
          ariaLabel={`${roomRow.defaultDirection} direction`}
          name={`${roomRow.name}Direction`}
          options={directionOptions}
          value={values[`${roomRow.name}Direction`] ?? roomRow.defaultDirection}
          onValueChange={onFieldChange}
        />
      </td>
      <td className="border border-slate-300 bg-white p-0">
        <DirectionDimensionCell
          name={roomRow.name}
          surfaceType={surfaceType}
          values={values}
          onFieldChange={onFieldChange}
        />
      </td>
    </>
  );
}
