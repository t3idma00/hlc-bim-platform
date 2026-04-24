"use client";

import { useMemo, useState } from "react";
import { roomToThree, type RoomInputValues } from "../converters/roomToThree";
import {
  useThreeRoom,
  type SolarStateLike,
  type ThreeRoomCameraPreset,
  type ThreeRoomTool,
} from "./useThreeRoom";

type SheetValues = Record<string, string>;

type ThreeRoomViewProps = {
  formValues: RoomInputValues;
  sheetValues?: SheetValues;
  solarState?: SolarStateLike;
};

export function ThreeRoomView({
  formValues,
  sheetValues = {},
  solarState,
}: ThreeRoomViewProps) {
  const [activeTool, setActiveTool] = useState<ThreeRoomTool>("orbit");
  const [roofAndCeilingVisible, setRoofAndCeilingVisible] = useState(false);
  const roomModel = useMemo(
    () => roomToThree(formValues, sheetValues),
    [formValues, sheetValues]
  );
  const { containerRef, controls } = useThreeRoom(roomModel, solarState, activeTool);
  const isReady = roomModel !== null;
  const viewTools: Array<{
    key: ThreeRoomCameraPreset;
    label: string;
  }> = [
    { key: "top", label: "Top view" },
    { key: "front", label: "Front view" },
    { key: "side", label: "Side view" },
  ];

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      <div className="z-10 w-14 shrink-0 border-r border-[#44536a] bg-[#5d6b7d]/97 shadow-lg shadow-slate-900/18 backdrop-blur">
        <div className="flex h-full w-full flex-col items-center gap-1 pt-2">
          <button
            type="button"
            aria-label="Select"
            title="Select"
            onClick={() =>
              setActiveTool((currentTool) =>
                currentTool === "select" ? "orbit" : "select"
              )
            }
            className={`flex h-10 w-10 items-center justify-center border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80 ${
              activeTool === "select"
                ? "border-[#a9c8ff] bg-[#2f6fe4] text-white shadow-sm"
                : "border-transparent bg-transparent text-[#f8fbff] hover:border-[#8ea2bf]/55 hover:bg-[#7686a0]/28"
            }`}
          >
            <ThreeToolbarIcon tool="select" />
          </button>
          <div className="my-1 h-px w-8 bg-[#8ea2bf]/45" />
          <button
            type="button"
            aria-label="Reset camera"
            title="Reset camera"
            onClick={controls.resetCamera}
            className="flex h-10 w-10 items-center justify-center border border-transparent bg-transparent text-[#f8fbff] transition hover:border-[#8ea2bf]/55 hover:bg-[#7686a0]/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80"
          >
            <ThreeToolbarIcon tool="reset" />
          </button>
          <div className="my-1 h-px w-8 bg-[#8ea2bf]/45" />
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={controls.zoomIn}
            className="flex h-10 w-10 items-center justify-center border border-transparent bg-transparent text-[#f8fbff] transition hover:border-[#8ea2bf]/55 hover:bg-[#7686a0]/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80"
          >
            <ThreeToolbarIcon tool="zoomIn" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={controls.zoomOut}
            className="flex h-10 w-10 items-center justify-center border border-transparent bg-transparent text-[#f8fbff] transition hover:border-[#8ea2bf]/55 hover:bg-[#7686a0]/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80"
          >
            <ThreeToolbarIcon tool="zoomOut" />
          </button>
          <div className="my-1 h-px w-8 bg-[#8ea2bf]/45" />
          {viewTools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              aria-label={tool.label}
              title={tool.label}
              onClick={() => controls.setCameraPreset(tool.key)}
              className="flex h-10 w-10 items-center justify-center border border-transparent bg-transparent text-[#f8fbff] transition hover:border-[#8ea2bf]/55 hover:bg-[#7686a0]/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80"
            >
              <ThreeToolbarIcon tool={tool.key} />
            </button>
          ))}
          <div className="my-1 h-px w-8 bg-[#8ea2bf]/45" />
          <button
            type="button"
            aria-label={roofAndCeilingVisible ? "Hide roof and ceiling" : "Show roof and ceiling"}
            title={roofAndCeilingVisible ? "Hide roof and ceiling" : "Show roof and ceiling"}
            onClick={() => {
              setRoofAndCeilingVisible((currentValue) => {
                const nextValue = !currentValue;
                controls.setRoofAndCeilingVisible(nextValue);
                return nextValue;
              });
            }}
            className={`flex h-10 w-10 items-center justify-center border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80 ${
              roofAndCeilingVisible
                ? "border-transparent bg-transparent text-[#f8fbff] hover:border-[#8ea2bf]/55 hover:bg-[#7686a0]/28"
                : "border-[#a9c8ff] bg-[#2f6fe4] text-white shadow-sm"
            }`}
          >
            <ThreeToolbarIcon tool={roofAndCeilingVisible ? "roofOn" : "roofOff"} />
          </button>
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm shadow-slate-200/70 backdrop-blur">
          <p className="font-semibold text-slate-900">3D controls</p>
          <p className="mt-1">Drag to orbit</p>
          <p>Scroll to zoom</p>
          <p>Middle/right-drag to pan</p>
        </div>

        {!isReady ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
            Enter at least one horizontal wall and one vertical wall to build the 3D room.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ThreeToolbarIcon({
  tool,
}: {
  tool:
    | "select"
    | "reset"
    | "zoomIn"
    | "zoomOut"
    | "roofOn"
    | "roofOff"
    | ThreeRoomCameraPreset;
}) {
  if (tool === "select") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 3.5v13l3.9-4 3.1 7 2.2-.9-3.1-7L19 10 5 3.5z" />
        <path d="M15.5 4.5h3" />
        <path d="M17 3v3" />
      </svg>
    );
  }

  if (tool === "reset") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12a8 8 0 1 0 2.4-5.7" />
        <path d="M4 4v6h6" />
      </svg>
    );
  }

  if (tool === "zoomIn" || tool === "zoomOut") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 5 5" />
        <path d="M8 10.5h5" />
        {tool === "zoomIn" ? <path d="M10.5 8v5" /> : null}
      </svg>
    );
  }

  if (tool === "top") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 4 8 4-8 4-8-4 8-4z" />
        <path d="M12 12v8" />
        <path d="m8 16 4 4 4-4" />
      </svg>
    );
  }

  if (tool === "roofOn" || tool === "roofOff") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.5 11 12 4l8.5 7" />
        <path d="M5.5 10.5v8h13v-8" />
        <path d="M8 18.5h8" />
        {tool === "roofOff" ? <path d="M4 4l16 16" /> : null}
      </svg>
    );
  }

  if (tool === "front") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="5" width="14" height="14" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 5h10v14H7z" />
      <path d="M17 5 21 8v14l-4-3" />
      <path d="M7 5 3 8v14l4-3" />
    </svg>
  );
}
