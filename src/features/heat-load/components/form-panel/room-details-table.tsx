import { DirectionDimensionCell, TopSelectField } from "./top-form-fields";

type SurfaceType = "walls" | "windows" | "doors";
type FormValues = Record<string, string>;

type RoomRow = {
  name: string;
  defaultDirection: string;
  options: string[];
};

const surfaceTabs: { key: SurfaceType; label: string }[] = [
  { key: "walls", label: "Walls" },
  { key: "windows", label: "Windows" },
  { key: "doors", label: "Doors" },
];

const orientationOptions = {
  north: ["North", "North East"],
  east: ["East", "South East"],
  south: ["South", "South West"],
  west: ["West", "North West"],
};

const roomRowsBySurface: Record<SurfaceType, RoomRow[]> = {
  walls: [
    { name: "wallNorth", defaultDirection: "North", options: orientationOptions.north },
    { name: "wallEast", defaultDirection: "East", options: orientationOptions.east },
    { name: "wallSouth", defaultDirection: "South", options: orientationOptions.south },
    { name: "wallWest", defaultDirection: "West", options: orientationOptions.west },
  ],
  windows: [
    { name: "windowNorth", defaultDirection: "North", options: orientationOptions.north },
    { name: "windowEast", defaultDirection: "East", options: orientationOptions.east },
    { name: "windowSouth", defaultDirection: "South", options: orientationOptions.south },
    { name: "windowWest", defaultDirection: "West", options: orientationOptions.west },
  ],
  doors: [
    { name: "doorNorth", defaultDirection: "North", options: orientationOptions.north },
    { name: "doorEast", defaultDirection: "East", options: orientationOptions.east },
    { name: "doorSouth", defaultDirection: "South", options: orientationOptions.south },
    { name: "doorWest", defaultDirection: "West", options: orientationOptions.west },
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
          value={values[`${roomRow.name}Direction`] ?? roomRow.defaultDirection}
          options={roomRow.options}
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
