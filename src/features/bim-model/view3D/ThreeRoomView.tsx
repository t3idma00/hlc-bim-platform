"use client";

import { useMemo } from "react";
import { roomToThree, type RoomInputValues } from "../converters/roomToThree";
import { useThreeRoom } from "./useThreeRoom";

type ThreeRoomViewProps = {
  formValues: RoomInputValues;
};

export function ThreeRoomView({ formValues }: ThreeRoomViewProps) {
  const roomModel = useMemo(() => roomToThree(formValues), [formValues]);
  const { containerRef } = useThreeRoom(roomModel);
  const isReady = roomModel !== null;

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm shadow-slate-200/70 backdrop-blur">
        <p className="font-semibold text-slate-900">3D controls</p>
        <p className="mt-1">Drag to orbit</p>
        <p>Scroll to zoom</p>
        <p>Right-drag to pan</p>
      </div>

      {!isReady ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
          Enter at least one horizontal wall and one vertical wall to build the 3D room.
        </div>
      ) : null}
    </div>
  );
}
