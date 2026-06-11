import { DirectionDimensionCell, TopSelectField } from "./top-form-fields";
import type { UnitSystem } from "@/lib/units";
import {
  boundaryFieldName,
  wallBoundaryOptions,
  type BoundaryOwner,
  type CardinalWall,
} from "./wall-boundary";

type SurfaceType = "walls" | "windows" | "doors";
type FormValues = Record<string, string>;

type RoomRow = {
  name: string;
  defaultDirection: CardinalWall;
  options: string[];
};

const surfaceTabs: { key: SurfaceType; label: string }[] = [
  { key: "walls", label: "Walls" },
  { key: "windows", label: "Windows" },
  { key: "doors", label: "Doors" },
];

const orientationOptions = {
  north: ["North", "Northeast"],
  east: ["East", "Southeast"],
  south: ["South", "Southwest"],
  west: ["West", "Northwest"],
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

export function RoomDetailsSurfaceTabs({
  surfaceType,
  onSurfaceChange,
}: {
  surfaceType: SurfaceType;
  onSurfaceChange: (surfaceType: SurfaceType) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-0.5">
      {surfaceTabs.map((tab) => {
        const isActive = surfaceType === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSurfaceChange(tab.key)}
            className={`min-w-16 rounded px-2.5 py-1.5 text-[11px] font-semibold transition ${
              isActive
                ? "bg-[#be123c] text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function RoomDetailsHeader({
  surfaceType,
  onSurfaceChange,
}: {
  surfaceType: SurfaceType;
  onSurfaceChange: (surfaceType: SurfaceType) => void;
}) {
  return (
    <th
      className="border border-slate-200 bg-slate-50 px-0 py-0 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#9f1239]"
      colSpan={2}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <span>Room Details</span>
        <RoomDetailsSurfaceTabs surfaceType={surfaceType} onSurfaceChange={onSurfaceChange} />
      </div>
    </th>
  );
}

export function RoomDetailsRow({
  surfaceType,
  rowIndex,
  values,
  unitSystem,
  onFieldChange,
  onSelectFieldChange,
}: {
  surfaceType: SurfaceType;
  rowIndex: number;
  values: FormValues;
  unitSystem: UnitSystem;
  onFieldChange: (name: string, value: string) => void;
  onSelectFieldChange: (name: string, value: string) => void;
}) {
  const roomRow = roomRowsBySurface[surfaceType][rowIndex];
  const boundaryOwner = getBoundaryOwner(surfaceType);
  const boundaryName = boundaryFieldName(boundaryOwner, roomRow.defaultDirection);

  return (
    <>
      <td className="border border-slate-200 bg-slate-50 p-0">
        <TopSelectField
          ariaLabel={`${roomRow.defaultDirection} direction`}
          name={`${roomRow.name}Direction`}
          value={values[`${roomRow.name}Direction`] ?? ""}
          options={roomRow.options}
          onValueChange={onSelectFieldChange}
        />
      </td>
      <td className="border border-slate-200 bg-white p-0">
        <div className="grid min-h-[34px] grid-cols-[minmax(0,1fr)_100px]">
          <DirectionDimensionCell
            name={roomRow.name}
            surfaceType={surfaceType}
            values={values}
            unitSystem={unitSystem}
            onFieldChange={onFieldChange}
          />
          <select
            aria-label={`${roomRow.defaultDirection} ${boundaryOwner} boundary`}
            value={values[boundaryName] ?? ""}
            onChange={(event) => onSelectFieldChange(boundaryName, event.target.value)}
            className="h-full min-h-[34px] border-l border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-inset focus:ring-rose-100"
            title={`${getBoundaryTitlePrefix(surfaceType)} boundary controls the cooling-load section routing.`}
          >
            <option value="">Select</option>
            {wallBoundaryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </td>
    </>
  );
}

function getBoundaryOwner(surfaceType: SurfaceType): BoundaryOwner {
  if (surfaceType === "windows") {
    return "window";
  }

  if (surfaceType === "doors") {
    return "door";
  }

  return "wall";
}

function getBoundaryTitlePrefix(surfaceType: SurfaceType) {
  if (surfaceType === "windows") {
    return "Window";
  }

  if (surfaceType === "doors") {
    return "Door";
  }

  return "Wall";
}
