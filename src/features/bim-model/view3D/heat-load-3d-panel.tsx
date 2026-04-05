"use client";

import { useEffect, useRef, useState } from "react";
import {
  WorkspaceViewToggle,
  type WorkspaceView,
} from "../workspace-view-toggle";

const DEFAULT_HEIGHT = 3;
const DEFAULT_WALL_THICKNESS = 0.2;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.2;

type CanvasFormValues = Record<string, string>;

type HeatLoad3DPanelProps = {
  formValues: CanvasFormValues;
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
};

type Point3D = {
  x: number;
  y: number;
  z: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
  z: number;
};

type RoomDimensions = {
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
};

type Face = {
  points: number[];
  fill: string;
  stroke: string;
};

const ROOM_FACES: Face[] = [
  {
    points: [0, 1, 5, 4],
    fill: "rgba(244, 63, 94, 0.18)",
    stroke: "rgba(159, 18, 57, 0.4)",
  },
  {
    points: [1, 2, 6, 5],
    fill: "rgba(251, 113, 133, 0.28)",
    stroke: "rgba(190, 24, 93, 0.42)",
  },
  {
    points: [2, 3, 7, 6],
    fill: "rgba(253, 164, 175, 0.24)",
    stroke: "rgba(190, 24, 93, 0.38)",
  },
  {
    points: [3, 0, 4, 7],
    fill: "rgba(251, 113, 133, 0.16)",
    stroke: "rgba(159, 18, 57, 0.36)",
  },
  {
    points: [4, 5, 6, 7],
    fill: "rgba(255, 228, 230, 0.72)",
    stroke: "rgba(159, 18, 57, 0.32)",
  },
  {
    points: [0, 1, 2, 3],
    fill: "rgba(15, 23, 42, 0.06)",
    stroke: "rgba(148, 163, 184, 0.4)",
  },
];

export function HeatLoad3DPanel({
  formValues,
  activeView,
  onViewChange,
}: HeatLoad3DPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef({ x: -0.62, y: 0.78 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const roomDimensions = getRoomDimensions(formValues);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const devicePixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.max(Math.floor(bounds.width * devicePixelRatio), 1);
      canvas.height = Math.max(Math.floor(bounds.height * devicePixelRatio), 1);
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      drawScene(
        context,
        bounds.width,
        bounds.height,
        roomDimensions,
        rotationRef.current.x,
        rotationRef.current.y,
        zoom
      );
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
      setZoom((previousZoom) =>
        Math.max(MIN_ZOOM, Math.min(previousZoom * zoomFactor, MAX_ZOOM))
      );
    };

    const handleMouseDown = (event: MouseEvent) => {
      isDragging.current = true;
      lastMouse.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = event.clientX - lastMouse.current.x;
      const deltaY = event.clientY - lastMouse.current.y;

      rotationRef.current = {
        x: clamp(rotationRef.current.x - deltaY * 0.01, -1.2, 0.35),
        y: rotationRef.current.y + deltaX * 0.01,
      };

      lastMouse.current = { x: event.clientX, y: event.clientY };

      const bounds = canvas.getBoundingClientRect();
      drawScene(
        context,
        bounds.width,
        bounds.height,
        roomDimensions,
        rotationRef.current.x,
        rotationRef.current.y,
        zoom
      );
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [roomDimensions, zoom]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-white">
      <div className="border-b border-rose-100 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#be123c]">
              Drawing Area
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              3D Model Workspace
            </h2>
          </div>
          <WorkspaceViewToggle
            activeView={activeView}
            onChange={onViewChange}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="relative flex h-full w-full flex-1 overflow-hidden border border-rose-100 bg-[radial-gradient(circle_at_top,_#fff1f2,_#ffffff_55%,_#ffe4e6)]">
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
          />
          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-rose-100 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm shadow-rose-100/60 backdrop-blur">
            <p className="font-semibold text-slate-900">3D controls</p>
            <p className="mt-1">Drag to orbit</p>
            <p>Scroll to zoom</p>
          </div>
        </div>
      </div>

      <div className="border-t border-rose-100 bg-[#fffafb] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>Mode: 3D Orbit View</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span>{getRoomSummary(roomDimensions)}</span>
        </div>
      </div>
    </section>
  );
}

function drawScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  roomDimensions: RoomDimensions | null,
  rotationX: number,
  rotationY: number,
  zoom: number
) {
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  drawBackdrop(context, width, height);

  if (!roomDimensions) {
    context.fillStyle = "#64748b";
    context.font = "14px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      "Enter at least one horizontal wall and one vertical wall to preview the room in 3D.",
      width / 2,
      height / 2
    );
    return;
  }

  const sizeReference = Math.max(
    roomDimensions.width,
    roomDimensions.depth,
    roomDimensions.height
  );
  const vertices = createRoomVertices(roomDimensions);
  const projectedVertices = vertices.map((vertex) =>
    projectPoint(
      rotatePoint(vertex, rotationX, rotationY),
      width,
      height,
      sizeReference,
      zoom
    )
  );

  const sortedFaces = ROOM_FACES.map((face) => ({
    ...face,
    depth:
      face.points.reduce(
        (sum, pointIndex) => sum + projectedVertices[pointIndex].z,
        0
      ) / face.points.length,
  })).sort((first, second) => first.depth - second.depth);

  sortedFaces.forEach((face) => {
    context.beginPath();
    const firstPoint = projectedVertices[face.points[0]];
    context.moveTo(firstPoint.x, firstPoint.y);

    face.points.slice(1).forEach((pointIndex) => {
      const point = projectedVertices[pointIndex];
      context.lineTo(point.x, point.y);
    });

    context.closePath();
    context.fillStyle = face.fill;
    context.fill();
    context.strokeStyle = face.stroke;
    context.lineWidth = 1.4;
    context.stroke();
  });

  drawFrame(context, projectedVertices);
  drawDimensionChip(context, width, height, roomDimensions);
}

function drawBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#fff1f2");
  gradient.addColorStop(0.55, "#ffffff");
  gradient.addColorStop(1, "#fff7f8");

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(244, 63, 94, 0.08)";
  context.lineWidth = 1;

  for (let y = Math.floor(height * 0.62); y < height; y += 22) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function createRoomVertices(roomDimensions: RoomDimensions): Point3D[] {
  const halfWidth = roomDimensions.width / 2;
  const halfDepth = roomDimensions.depth / 2;
  const halfHeight = roomDimensions.height / 2;

  return [
    { x: -halfWidth, y: -halfHeight, z: -halfDepth },
    { x: halfWidth, y: -halfHeight, z: -halfDepth },
    { x: halfWidth, y: -halfHeight, z: halfDepth },
    { x: -halfWidth, y: -halfHeight, z: halfDepth },
    { x: -halfWidth, y: halfHeight, z: -halfDepth },
    { x: halfWidth, y: halfHeight, z: -halfDepth },
    { x: halfWidth, y: halfHeight, z: halfDepth },
    { x: -halfWidth, y: halfHeight, z: halfDepth },
  ];
}

function rotatePoint(point: Point3D, rotationX: number, rotationY: number): Point3D {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const rotatedY = {
    x: point.x * cosY + point.z * sinY,
    y: point.y,
    z: -point.x * sinY + point.z * cosY,
  };

  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);

  return {
    x: rotatedY.x,
    y: rotatedY.y * cosX - rotatedY.z * sinX,
    z: rotatedY.y * sinX + rotatedY.z * cosX,
  };
}

function projectPoint(
  point: Point3D,
  canvasWidth: number,
  canvasHeight: number,
  sizeReference: number,
  zoom: number
): ProjectedPoint {
  const cameraDistance = sizeReference * 4.2;
  const perspective = (Math.min(canvasWidth, canvasHeight) * 0.52 * zoom) /
    (point.z + cameraDistance);

  return {
    x: canvasWidth / 2 + point.x * perspective,
    y: canvasHeight * 0.58 - point.y * perspective,
    z: point.z,
  };
}

function drawFrame(
  context: CanvasRenderingContext2D,
  projectedVertices: ProjectedPoint[]
) {
  const edges: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  context.strokeStyle = "#0f172b";
  context.lineWidth = 1.5;

  edges.forEach(([from, to]) => {
    context.beginPath();
    context.moveTo(projectedVertices[from].x, projectedVertices[from].y);
    context.lineTo(projectedVertices[to].x, projectedVertices[to].y);
    context.stroke();
  });
}

function drawDimensionChip(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  roomDimensions: RoomDimensions
) {
  const label = `${formatValue(roomDimensions.width)}m x ${formatValue(roomDimensions.depth)}m x ${formatValue(roomDimensions.height)}m`;
  const paddingX = 14;
  const paddingY = 10;

  context.font = "600 13px sans-serif";
  const textWidth = context.measureText(label).width;
  const chipWidth = textWidth + paddingX * 2;
  const chipHeight = 18 + paddingY * 2;
  const x = width - chipWidth - 20;
  const y = height - chipHeight - 20;

  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  context.strokeStyle = "rgba(244, 63, 94, 0.22)";
  context.lineWidth = 1;
  roundRect(context, x, y, chipWidth, chipHeight, 14);
  context.fill();
  context.stroke();

  context.fillStyle = "#0f172b";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x + chipWidth / 2, y + chipHeight / 2);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function getRoomDimensions(formValues: CanvasFormValues): RoomDimensions | null {
  const horizontalLengths = [
    parsePositiveNumber(formValues.wallNorthLength),
    parsePositiveNumber(formValues.wallSouthLength),
  ].filter((value) => value > 0);
  const verticalLengths = [
    parsePositiveNumber(formValues.wallEastLength),
    parsePositiveNumber(formValues.wallWestLength),
  ].filter((value) => value > 0);

  if (horizontalLengths.length === 0 || verticalLengths.length === 0) {
    return null;
  }

  const heights = [
    parsePositiveNumber(formValues.wallNorthHeight, DEFAULT_HEIGHT),
    parsePositiveNumber(formValues.wallEastHeight, DEFAULT_HEIGHT),
    parsePositiveNumber(formValues.wallSouthHeight, DEFAULT_HEIGHT),
    parsePositiveNumber(formValues.wallWestHeight, DEFAULT_HEIGHT),
  ];
  const thicknesses = [
    parsePositiveNumber(formValues.wallNorthWidth, DEFAULT_WALL_THICKNESS),
    parsePositiveNumber(formValues.wallEastWidth, DEFAULT_WALL_THICKNESS),
    parsePositiveNumber(formValues.wallSouthWidth, DEFAULT_WALL_THICKNESS),
    parsePositiveNumber(formValues.wallWestWidth, DEFAULT_WALL_THICKNESS),
  ];

  return {
    width: Math.max(...horizontalLengths),
    depth: Math.max(...verticalLengths),
    height: Math.max(...heights),
    wallThickness:
      thicknesses.reduce((sum, value) => sum + value, 0) / thicknesses.length,
  };
}

function getRoomSummary(roomDimensions: RoomDimensions | null) {
  if (!roomDimensions) {
    return "No room volume to preview yet";
  }

  return `Room: ${formatValue(roomDimensions.width)}m x ${formatValue(
    roomDimensions.depth
  )}m x ${formatValue(roomDimensions.height)}m`;
}

function parsePositiveNumber(value: string | undefined, fallback = 0) {
  if (!value) return fallback;

  const normalizedValue = Number(value.replace(",", "."));

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return fallback;
  }

  return normalizedValue;
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
