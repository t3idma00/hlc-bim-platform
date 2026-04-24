"use client";

import { useEffect, useRef, useState } from "react";
import { getWallAppearanceByType, type WallPatternKind } from "@/data/assets";
import { createBucketedIsoString, fetchCachedJson } from "@/lib/client-fetch-cache";
import {
  WorkspaceViewToggle,
  type WorkspaceView,
} from "../workspace-view-toggle";
import { ThreeRoomView } from "./ThreeRoomView";

const DEFAULT_HEIGHT = 3;
const DEFAULT_WALL_THICKNESS = 0.2;
const DEFAULT_DOOR_HEIGHT = 2.1;
const DEFAULT_WINDOW_HEIGHT = 1.2;
const DEFAULT_WINDOW_SILL_HEIGHT = 0.9;
const BASE_PROJECTION_SCALE = 0.68;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.2;
const MIN_ORBIT_TILT = -1.2;
const MAX_ORBIT_TILT = -0.08;

type CanvasFormValues = Record<string, string>;
type SheetValues = Record<string, string>;
type WallDirection = "North" | "East" | "South" | "West";

type HeatLoad3DPanelProps = {
  formValues: CanvasFormValues;
  sheetValues?: SheetValues;
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
};

type RotationState = {
  x: number;
  y: number;
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

type PlanePoint = {
  x: number;
  z: number;
};

type DoorInput = {
  direction: WallDirection;
  width: number;
  height: number;
};

type WindowInput = {
  direction: WallDirection;
  width: number;
  height: number;
};

type OpeningKind = "door" | "window";

type WallFeatureSpan = {
  startMeters: number;
  widthMeters: number;
};

type WallFeaturePlacement = {
  kind: OpeningKind;
  direction: WallDirection;
  startMeters: number;
  widthMeters: number;
  bottomMeters: number;
  heightMeters: number;
};

type WallSide = "outer" | "inner";

type RoomDimensions = {
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
};

type WallSurfaceFrame = {
  origin: Point3D;
  horizontal: Point3D;
  vertical: Point3D;
};

type Face = {
  points: number[];
  fill: string;
  stroke: string;
  direction?: WallDirection;
  patternKind?: WallPatternKind;
  label?: string;
  openingCount?: number;
  isRoof?: boolean;
  wallSide?: WallSide;
};

type ProjectedFace = {
  points: ProjectedPoint[];
  fill: string;
  stroke: string;
  direction?: WallDirection;
  patternKind?: WallPatternKind;
  openingCount?: number;
  isRoof?: boolean;
  wallSide?: WallSide;
  depth: number;
};

type SolarSnapshot = {
  azimuth: number;
  zenith: number;
  altitude: number;
  targetDateTime: string;
  latitude: number;
  longitude: number;
  alerts: string[];
};

type SolarState =
  | {
      status: "loading";
      snapshot: null;
      message: string;
    }
  | {
      status: "ready";
      snapshot: SolarSnapshot;
      message: string;
    }
  | {
      status: "denied" | "unsupported" | "error";
      snapshot: null;
      message: string;
    };

type SolarApiResponse = {
  targetDateTime: string;
  location: {
    latitude: number;
    longitude: number;
  };
  solarPosition: {
    azimuth: number;
    zenith: number;
  };
  alerts?: string[];
  error?: string;
};

const INITIAL_ROTATION: RotationState = {
  x: -0.62,
  y: 0.78,
};

const ROOM_FACES: Face[] = [
  {
    points: [0, 1, 5, 4],
    direction: "North",
    fill: "rgb(244, 63, 94)",
    stroke: "rgb(159, 18, 57)",
  },
  {
    points: [1, 2, 6, 5],
    direction: "East",
    fill: "rgb(251, 113, 133)",
    stroke: "rgb(190, 24, 93)",
  },
  {
    points: [2, 3, 7, 6],
    direction: "South",
    fill: "rgb(253, 164, 175)",
    stroke: "rgb(190, 24, 93)",
  },
  {
    points: [3, 0, 4, 7],
    direction: "West",
    fill: "rgb(251, 113, 133)",
    stroke: "rgb(159, 18, 57)",
  },
  {
    points: [4, 5, 6, 7],
    fill: "rgb(255, 241, 242)",
    stroke: "rgb(159, 18, 57)",
    isRoof: true,
  },
  {
    points: [0, 1, 2, 3],
    fill: "rgb(241, 245, 249)",
    stroke: "rgb(148, 163, 184)",
  },
];

const TOP_VIEW_ROOF_CUTOFF = -0.22;

function getWallTypeFieldName(direction: WallDirection) {
  return `wall${direction}Type`;
}

function getWallNormal(direction: WallDirection, wallSide: WallSide = "outer"): Point3D {
  const normal = (() => {
    switch (direction) {
      case "North":
        return { x: 0, y: 0, z: -1 };
      case "East":
        return { x: 1, y: 0, z: 0 };
      case "South":
        return { x: 0, y: 0, z: 1 };
      case "West":
        return { x: -1, y: 0, z: 0 };
    }
  })();

  return wallSide === "inner" ? scalePoint3D(normal, -1) : normal;
}

function getWallFaceStyle(direction: WallDirection, formValues: CanvasFormValues) {
  const wallType = formValues[getWallTypeFieldName(direction)] ?? "Brick Wall";
  return getWallAppearanceByType(wallType);
}

function isWallFacingCamera(
  direction: WallDirection,
  rotationX: number,
  rotationY: number,
  wallSide: WallSide = "outer"
) {
  const normal = rotatePoint(getWallNormal(direction, wallSide), rotationX, rotationY);
  return normal.z < 0;
}

function eraseWallOpening(
  context: CanvasRenderingContext2D,
  placement: WallFeaturePlacement,
  roomDimensions: RoomDimensions,
  rotationX: number,
  rotationY: number,
  canvasWidth: number,
  canvasHeight: number,
  sizeReference: number,
  zoom: number
) {
  const surface = getWallSurfaceFrame(placement.direction, roomDimensions);
  const outerCorners = createWallFeaturePolygon(surface, placement);
  const projectedOuterCorners = outerCorners.map((point) =>
    projectPoint(
      rotatePoint(point, rotationX, rotationY),
      canvasWidth,
      canvasHeight,
      sizeReference,
      zoom
    )
  );

  context.save();
  context.globalCompositeOperation = "destination-out";
  context.fillStyle = "rgba(0, 0, 0, 1)";
  traceProjectedShape(context, projectedOuterCorners, true);
  context.fill();
  context.restore();
}

export function HeatLoad3DPanel({
  formValues,
  sheetValues = {},
  activeView,
  onViewChange,
}: HeatLoad3DPanelProps) {
  const [solarState, setSolarState] = useState<SolarState>({
    status: "loading",
    snapshot: null,
    message: "Locating live sun...",
  });
  const roomDimensions = getRoomDimensions(formValues);
  const sunSummary = getLiveSunSummary(solarState);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!("geolocation" in navigator)) {
      setSolarState({
        status: "unsupported",
        snapshot: null,
        message: "Geolocation is not supported in this browser.",
      });
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;

    const fetchSolar = async (latitude: number, longitude: number) => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const datetime = createBucketedIsoString(new Date(), 300000);
        const params = new URLSearchParams({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          timezone,
          datetime,
          mode: "auto",
        });

        const payload = await fetchCachedJson<SolarApiResponse>(`/api/solar-details?${params.toString()}`);

        if (cancelled) {
          return;
        }

        const snapshot = createSolarSnapshot(payload);

        setSolarState({
          status: "ready",
          snapshot,
          message:
            snapshot.altitude > 0
              ? "Live sun synced to current location."
              : "Sun is currently below the horizon at this location.",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unable to load live sun data.";

        setSolarState({
          status: "error",
          snapshot: null,
          message,
        });
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        const { latitude, longitude } = position.coords;

        void fetchSolar(latitude, longitude);
        intervalId = window.setInterval(() => {
          void fetchSolar(latitude, longitude);
        }, 300000);
      },
      (error) => {
        if (cancelled) {
          return;
        }

        const message =
          error.code === error.PERMISSION_DENIED
            ? "Enable location access to show the live sun in 3D."
            : "Unable to access your location for live sun tracking.";

        setSolarState({
          status: "denied",
          snapshot: null,
          message,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );

    return () => {
      cancelled = true;

      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  return (
    <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
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
          <ThreeRoomView
            formValues={formValues}
            sheetValues={sheetValues}
            solarState={solarState}
          />
        </div>
      </div>

      <div className="border-t border-rose-100 bg-[#fffafb] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>Mode: 3D Orbit View</span>
          <span>Camera: Orbit Controls</span>
          <span>{getRoomSummary(roomDimensions)}</span>
          <span>{sunSummary.bar}</span>
          <span>Walls: Solid</span>
        </div>
      </div>
    </section>
  );
}

// Legacy canvas renderer preserved below for reference while the Three.js view is active.
export function LegacyHeatLoad3DPanel({
  formValues,
  activeView,
  onViewChange,
}: HeatLoad3DPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef(INITIAL_ROTATION);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [solarState, setSolarState] = useState<SolarState>({
    status: "loading",
    snapshot: null,
    message: "Locating live sun...",
  });

  const roomDimensions = getRoomDimensions(formValues);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!("geolocation" in navigator)) {
      setSolarState({
        status: "unsupported",
        snapshot: null,
        message: "Geolocation is not supported in this browser.",
      });
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;

    const fetchSolar = async (latitude: number, longitude: number) => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const datetime = createBucketedIsoString(new Date(), 300000);
        const params = new URLSearchParams({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          timezone,
          datetime,
          mode: "auto",
        });

        const payload = await fetchCachedJson<SolarApiResponse>(`/api/solar-details?${params.toString()}`);

        if (cancelled) {
          return;
        }

        const snapshot = createSolarSnapshot(payload);

        setSolarState({
          status: "ready",
          snapshot,
          message:
            snapshot.altitude > 0
              ? "Live sun synced to current location."
              : "Sun is currently below the horizon at this location.",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unable to load live sun data.";

        setSolarState({
          status: "error",
          snapshot: null,
          message,
        });
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        const { latitude, longitude } = position.coords;

        void fetchSolar(latitude, longitude);
        intervalId = window.setInterval(() => {
          void fetchSolar(latitude, longitude);
        }, 300000);
      },
      (error) => {
        if (cancelled) {
          return;
        }

        const message =
          error.code === error.PERMISSION_DENIED
            ? "Enable location access to show the live sun in 3D."
            : "Unable to access your location for live sun tracking.";

        setSolarState({
          status: "denied",
          snapshot: null,
          message,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );

    return () => {
      cancelled = true;

      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

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
        formValues,
        rotationRef.current.x,
        rotationRef.current.y,
        zoom,
        solarState
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

      const nextRotation = {
        x: clamp(
          rotationRef.current.x - deltaY * 0.01,
          MIN_ORBIT_TILT,
          MAX_ORBIT_TILT
        ),
        y: rotationRef.current.y + deltaX * 0.01,
      };
      rotationRef.current = nextRotation;

      lastMouse.current = { x: event.clientX, y: event.clientY };

      const bounds = canvas.getBoundingClientRect();
      drawScene(
        context,
        bounds.width,
        bounds.height,
        roomDimensions,
        formValues,
        rotationRef.current.x,
        rotationRef.current.y,
        zoom,
        solarState
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
  }, [formValues, roomDimensions, zoom, solarState]);

  const sunSummary = getSunSummary(solarState);

  return (
    <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
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
          <span>{sunSummary}</span>
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
  formValues: CanvasFormValues,
  rotationX: number,
  rotationY: number,
  zoom: number,
  solarState: SolarState
) {
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  drawBackdrop(context, width, height);

  const sceneDimensions = roomDimensions ?? {
    width: 6,
    depth: 6,
    height: DEFAULT_HEIGHT,
    wallThickness: DEFAULT_WALL_THICKNESS,
  };
  drawFloorGrid(
    context,
    width,
    height,
    sceneDimensions,
    rotationX,
    rotationY,
    zoom
  );
  drawSceneAxes(
    context,
    width,
    height,
    sceneDimensions,
    rotationX,
    rotationY,
    zoom
  );
  drawFloorCompass(
    context,
    width,
    height,
    sceneDimensions,
    rotationX,
    rotationY,
    zoom,
    solarState
  );
  drawSunInScene(
    context,
    width,
    height,
    sceneDimensions,
    rotationX,
    rotationY,
    zoom,
    solarState
  );

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
  const openingsByDirection = buildWallOpeningPlacements(formValues, roomDimensions);
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

  const shouldShowRoof = rotationX > TOP_VIEW_ROOF_CUTOFF;

  const projectedFaces: ProjectedFace[] = ROOM_FACES.flatMap((face): ProjectedFace[] => {
    if (face.isRoof && !shouldShowRoof) {
      return [];
    }

    if (!face.direction) {
      const points = face.points.map((pointIndex) => projectedVertices[pointIndex]);
      const depth =
        points.reduce((sum, point) => sum + point.z, 0) / Math.max(points.length, 1);

      return [
        {
          ...face,
          points,
          depth,
        },
      ];
    }

    const wallFaceStyle = getWallFaceStyle(face.direction, formValues);
    const openingCount = openingsByDirection[face.direction].length;
    const outerPoints = face.points.map((pointIndex) => projectedVertices[pointIndex]);
    const innerWallPoints = createWallFacePoints(
      face.direction,
      roomDimensions,
      "inner",
      Math.max(roomDimensions.wallThickness, 0.01)
    ).map((point) =>
      projectPoint(
        rotatePoint(point, rotationX, rotationY),
        width,
        height,
        sizeReference,
        zoom
      )
    );

    const outerDepth =
      outerPoints.reduce((sum, point) => sum + point.z, 0) / Math.max(outerPoints.length, 1);
    const innerDepth =
      innerWallPoints.reduce((sum, point) => sum + point.z, 0) /
      Math.max(innerWallPoints.length, 1);

    return [
      {
        ...face,
        points: outerPoints,
        fill: wallFaceStyle.fill,
        stroke: wallFaceStyle.stroke,
        patternKind: wallFaceStyle.patternKind,
        openingCount,
        wallSide: "outer" as WallSide,
        depth: outerDepth,
      },
      {
        ...face,
        points: innerWallPoints,
        fill: wallFaceStyle.fill,
        stroke: wallFaceStyle.stroke,
        patternKind: wallFaceStyle.patternKind,
        wallSide: "inner" as WallSide,
        depth: innerDepth,
      },
    ];
  }).filter((face): face is ProjectedFace => {
    if (!face.direction) {
      return true;
    }

    return isWallFacingCamera(
      face.direction,
      rotationX,
      rotationY,
      face.wallSide ?? "outer"
    );
  }).sort((first, second) => first.depth - second.depth);

  projectedFaces.forEach((face) => {
    context.beginPath();
    const firstPoint = face.points[0];
    context.moveTo(firstPoint.x, firstPoint.y);

    face.points.slice(1).forEach((point) => {
      context.lineTo(point.x, point.y);
    });

    context.closePath();
    context.globalAlpha = 1;
    context.fillStyle = face.fill;
    context.fill();

    context.strokeStyle = face.stroke;
    context.lineWidth = 1.4;
    context.stroke();

    if (face.direction && face.wallSide !== "inner") {
      const openings = openingsByDirection[face.direction];

      openings.forEach((opening) => {
        eraseWallOpening(
          context,
          opening,
          roomDimensions,
          rotationX,
          rotationY,
          width,
          height,
          sizeReference,
          zoom
        );
      });

      openings.forEach((opening) => {
        drawWallOpening(
          context,
          opening,
          roomDimensions,
          rotationX,
          rotationY,
          width,
          height,
          sizeReference,
          zoom
        );
      });
    }
  });

  drawDimensionChip(context, width, height, roomDimensions);
}

function drawBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f9fcff");
  gradient.addColorStop(0.38, "#edf5ff");
  gradient.addColorStop(0.72, "#dbeafe");
  gradient.addColorStop(1, "#c7ddff");

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(
    width * 0.5,
    height * 0.14,
    0,
    width * 0.5,
    height * 0.14,
    Math.max(width, height) * 0.72
  );
  glow.addColorStop(0, "rgba(255, 255, 255, 0.96)");
  glow.addColorStop(0.45, "rgba(255, 255, 255, 0.32)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const horizonBand = context.createLinearGradient(0, height * 0.34, 0, height * 0.82);
  horizonBand.addColorStop(0, "rgba(191, 219, 254, 0)");
  horizonBand.addColorStop(0.6, "rgba(147, 197, 253, 0.1)");
  horizonBand.addColorStop(1, "rgba(96, 165, 250, 0.18)");

  context.fillStyle = horizonBand;
  context.fillRect(0, 0, width, height);
}

function drawFloorGrid(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  roomDimensions: RoomDimensions,
  rotationX: number,
  rotationY: number,
  zoom: number
) {
  const grid = getFloorGridSettings(roomDimensions);
  const sizeReference = Math.max(
    roomDimensions.width,
    roomDimensions.depth,
    roomDimensions.height,
    6
  );
  const floorY = -roomDimensions.height / 2;
  const projectGridPoint = (x: number, z: number) =>
    projectPoint(
      rotatePoint({ x, y: floorY, z }, rotationX, rotationY),
      canvasWidth,
      canvasHeight,
      sizeReference,
      zoom
    );
  const planeCorners = [
    projectGridPoint(-grid.extent, -grid.extent),
    projectGridPoint(grid.extent, -grid.extent),
    projectGridPoint(grid.extent, grid.extent),
    projectGridPoint(-grid.extent, grid.extent),
  ];
  const farCenter = projectGridPoint(0, -grid.extent);
  const nearCenter = projectGridPoint(0, grid.extent);
  const minorStep = grid.step / 2;
  const minorHalfLines = grid.halfLines * 2;

  context.save();

  const planeGradient = context.createLinearGradient(
    farCenter.x,
    farCenter.y,
    nearCenter.x,
    nearCenter.y
  );
  planeGradient.addColorStop(0, "rgba(248, 252, 255, 0.18)");
  planeGradient.addColorStop(0.28, "rgba(230, 241, 255, 0.42)");
  planeGradient.addColorStop(0.72, "rgba(204, 228, 255, 0.78)");
  planeGradient.addColorStop(1, "rgba(183, 215, 255, 0.96)");

  context.fillStyle = planeGradient;
  traceProjectedShape(context, planeCorners, true);
  context.fill();

  const planeSheen = context.createLinearGradient(
    planeCorners[0].x,
    planeCorners[0].y,
    planeCorners[3].x,
    planeCorners[3].y
  );
  planeSheen.addColorStop(0, "rgba(255, 255, 255, 0.34)");
  planeSheen.addColorStop(0.45, "rgba(255, 255, 255, 0.1)");
  planeSheen.addColorStop(1, "rgba(147, 197, 253, 0.08)");

  context.fillStyle = planeSheen;
  traceProjectedShape(context, planeCorners, true);
  context.fill();

  context.strokeStyle = "rgba(96, 165, 250, 0.18)";
  context.lineWidth = 1;
  traceProjectedShape(context, planeCorners, true);
  context.stroke();

  for (let index = -minorHalfLines; index <= minorHalfLines; index += 1) {
    if (index % 2 === 0) {
      continue;
    }

    const lineValue = index * minorStep;
    const start = projectGridPoint(lineValue, -grid.extent);
    const end = projectGridPoint(lineValue, grid.extent);
    const crossStart = projectGridPoint(-grid.extent, lineValue);
    const crossEnd = projectGridPoint(grid.extent, lineValue);

    context.strokeStyle = "rgba(59, 130, 246, 0.12)";
    context.lineWidth = 0.7;

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();

    context.beginPath();
    context.moveTo(crossStart.x, crossStart.y);
    context.lineTo(crossEnd.x, crossEnd.y);
    context.stroke();
  }

  for (let index = -grid.halfLines; index <= grid.halfLines; index += 1) {
    const lineValue = index * grid.step;
    const start = projectGridPoint(lineValue, -grid.extent);
    const end = projectGridPoint(lineValue, grid.extent);
    const crossStart = projectGridPoint(-grid.extent, lineValue);
    const crossEnd = projectGridPoint(grid.extent, lineValue);
    const isMajor = index % grid.majorEvery === 0;

    context.strokeStyle = isMajor
      ? "rgba(29, 78, 216, 0.3)"
      : "rgba(37, 99, 235, 0.18)";
    context.lineWidth = isMajor ? 1.15 : 0.8;

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();

    context.beginPath();
    context.moveTo(crossStart.x, crossStart.y);
    context.lineTo(crossEnd.x, crossEnd.y);
    context.stroke();
  }

  context.restore();
}

function drawSceneAxes(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  roomDimensions: RoomDimensions,
  rotationX: number,
  rotationY: number,
  zoom: number
) {
  const axisLength = Math.max(
    Math.min(Math.max(roomDimensions.width, roomDimensions.depth, roomDimensions.height) * 0.45, 4),
    2
  );
  const sizeReference = Math.max(
    roomDimensions.width,
    roomDimensions.depth,
    roomDimensions.height,
    6
  );
  const floorY = -roomDimensions.height / 2;
  const origin = projectPoint(
    rotatePoint({ x: 0, y: floorY, z: 0 }, rotationX, rotationY),
    canvasWidth,
    canvasHeight,
    sizeReference,
    zoom
  );

  const axes = [
    {
      key: "x",
      label: "X",
      color: "#f87171",
      end: projectPoint(
        rotatePoint({ x: axisLength, y: floorY, z: 0 }, rotationX, rotationY),
        canvasWidth,
        canvasHeight,
        sizeReference,
        zoom
      ),
    },
    {
      key: "y",
      label: "Y",
      color: "#4ade80",
      end: projectPoint(
        rotatePoint({ x: 0, y: floorY + axisLength, z: 0 }, rotationX, rotationY),
        canvasWidth,
        canvasHeight,
        sizeReference,
        zoom
      ),
    },
    {
      key: "z",
      label: "Z",
      color: "#60a5fa",
      end: projectPoint(
        rotatePoint({ x: 0, y: floorY, z: -axisLength }, rotationX, rotationY),
        canvasWidth,
        canvasHeight,
        sizeReference,
        zoom
      ),
    },
  ].sort((first, second) => {
    const firstDepth = (origin.z + first.end.z) / 2;
    const secondDepth = (origin.z + second.end.z) / 2;

    return firstDepth - secondDepth;
  });

  context.save();

  axes.forEach((axis) => {
    const labelPoint = getProjectedLabelPoint(origin, axis.end, 12);

    context.strokeStyle = axis.color;
    context.fillStyle = axis.color;
    context.lineWidth = 2.2;

    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(axis.end.x, axis.end.y);
    context.stroke();

    context.beginPath();
    context.arc(axis.end.x, axis.end.y, 3.8, 0, Math.PI * 2);
    context.fill();

    context.font = "700 12px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(axis.label, labelPoint.x, labelPoint.y);
  });

  context.beginPath();
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#0f172b";
  context.lineWidth = 1.4;
  context.arc(origin.x, origin.y, 4.2, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.restore();
}

function drawFloorCompass(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  roomDimensions: RoomDimensions,
  rotationX: number,
  rotationY: number,
  zoom: number,
  solarState: SolarState
) {
  const grid = getFloorGridSettings(roomDimensions);
  const sizeReference = Math.max(
    roomDimensions.width,
    roomDimensions.depth,
    roomDimensions.height,
    6
  );
  const floorY = -roomDimensions.height / 2;
  const radius = Math.max(Math.min(grid.step * 1.02, 1.42), 0.82);
  const padding = Math.min(grid.step * 2.1, grid.extent * 0.23);
  const centerWorld = {
    x: -grid.extent + padding + radius * 1.4,
    y: floorY,
    z: -grid.extent + padding + radius * 1.4,
  };
  const projectCompassPoint = (x: number, z: number) =>
    projectFloorPlanePoint(
      centerWorld,
      { x, z },
      canvasWidth,
      canvasHeight,
      sizeReference,
      rotationX,
      rotationY,
      zoom
    );
  const outerRing = getCirclePlanePoints(radius, 40).map((point) =>
    projectCompassPoint(point.x, point.z)
  );
  const core = getCirclePlanePoints(radius * 0.14, 20).map((point) =>
    projectCompassPoint(point.x, point.z)
  );
  const northNeedle = [
    projectCompassPoint(0, -radius * 0.9),
    projectCompassPoint(-radius * 0.2, -radius * 0.23),
    projectCompassPoint(0, -radius * 0.36),
    projectCompassPoint(radius * 0.2, -radius * 0.23),
  ];
  const southNeedle = [
    projectCompassPoint(0, radius * 0.9),
    projectCompassPoint(-radius * 0.2, radius * 0.23),
    projectCompassPoint(0, radius * 0.36),
    projectCompassPoint(radius * 0.2, radius * 0.23),
  ];
  const eastNeedle = [
    projectCompassPoint(radius * 0.9, 0),
    projectCompassPoint(radius * 0.23, -radius * 0.2),
    projectCompassPoint(radius * 0.36, 0),
    projectCompassPoint(radius * 0.23, radius * 0.2),
  ];
  const westNeedle = [
    projectCompassPoint(-radius * 0.9, 0),
    projectCompassPoint(-radius * 0.23, -radius * 0.2),
    projectCompassPoint(-radius * 0.36, 0),
    projectCompassPoint(-radius * 0.23, radius * 0.2),
  ];
  const center = projectCompassPoint(0, 0);
  const northEdge = projectCompassPoint(0, -radius);
  const southEdge = projectCompassPoint(0, radius);
  const projectedRadius = Math.max(
    Math.hypot(northEdge.x - southEdge.x, northEdge.y - southEdge.y) / 2,
    1
  );
  const labelFontSize = clamp(projectedRadius * 0.38, 8, 11);
  const northLabel = projectCompassPoint(0, -radius * 1.42);
  const eastLabel = projectCompassPoint(radius * 1.42, 0);
  const southLabel = projectCompassPoint(0, radius * 1.42);
  const westLabel = projectCompassPoint(-radius * 1.42, 0);
  const liveMarker =
    solarState.status === "ready" && solarState.snapshot.altitude > 0
      ? projectCompassPoint(
          Math.sin((solarState.snapshot.azimuth * Math.PI) / 180) * radius,
          -Math.cos((solarState.snapshot.azimuth * Math.PI) / 180) * radius
        )
      : null;
  const markerHaloRadius = clamp(projectedRadius * 0.28, 4.5, 8.5);
  const markerCoreRadius = clamp(projectedRadius * 0.17, 2.8, 5);
  const markerInnerTick = markerCoreRadius + 1.8;
  const markerOuterTick = markerHaloRadius + 2.4;
  const markerDiagonalOuterTick = markerHaloRadius + 1.2;

  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.88)";
  context.strokeStyle = "rgba(244, 63, 94, 0.56)";
  context.lineWidth = 1.5;
  traceProjectedShape(context, outerRing, true);
  context.fill();
  context.stroke();

  context.fillStyle = "#be123c";
  traceProjectedShape(context, northNeedle, true);
  context.fill();

  context.fillStyle = "#94a3b8";
  traceProjectedShape(context, southNeedle, true);
  context.fill();

  context.fillStyle = "#94a3b8";
  traceProjectedShape(context, eastNeedle, true);
  context.fill();
  traceProjectedShape(context, westNeedle, true);
  context.fill();

  context.fillStyle = "#0f172a";
  traceProjectedShape(context, core, true);
  context.fill();

  if (liveMarker) {
    context.strokeStyle = "#f59e0b";
    context.lineWidth = Math.max(projectedRadius * 0.08, 1.8);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(liveMarker.x, liveMarker.y);
    context.stroke();

    context.fillStyle = "rgba(251, 191, 36, 0.2)";
    context.beginPath();
    context.arc(liveMarker.x, liveMarker.y, markerHaloRadius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f59e0b";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.1;
    context.beginPath();
    context.arc(liveMarker.x, liveMarker.y, markerCoreRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.strokeStyle = "#f59e0b";
    context.lineWidth = Math.max(projectedRadius * 0.05, 1.4);

    const cardinalTicks: Array<[number, number, number]> = [
      [0, -1, markerOuterTick],
      [1, 0, markerOuterTick],
      [0, 1, markerOuterTick],
      [-1, 0, markerOuterTick],
    ];

    cardinalTicks.forEach(([dx, dy, outer]) => {
      context.beginPath();
      context.moveTo(
        liveMarker.x + dx * markerInnerTick,
        liveMarker.y + dy * markerInnerTick
      );
      context.lineTo(
        liveMarker.x + dx * outer,
        liveMarker.y + dy * outer
      );
      context.stroke();
    });

    const diagonalTicks: Array<[number, number]> = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];

    diagonalTicks.forEach(([dx, dy]) => {
      const normalized = Math.SQRT1_2;
      context.beginPath();
      context.moveTo(
        liveMarker.x + dx * markerInnerTick * normalized,
        liveMarker.y + dy * markerInnerTick * normalized
      );
      context.lineTo(
        liveMarker.x + dx * markerDiagonalOuterTick * normalized,
        liveMarker.y + dy * markerDiagonalOuterTick * normalized
      );
      context.stroke();
    });
  }

  drawCompassLabel(context, "N", northLabel, "#be123c", labelFontSize);
  drawCompassLabel(context, "E", eastLabel, "#475569", labelFontSize);
  drawCompassLabel(context, "S", southLabel, "#475569", labelFontSize);
  drawCompassLabel(context, "W", westLabel, "#475569", labelFontSize);

  context.restore();
}

function drawSunInScene(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  roomDimensions: RoomDimensions,
  rotationX: number,
  rotationY: number,
  zoom: number,
  solarState: SolarState
) {
  if (solarState.status !== "ready" || solarState.snapshot.altitude <= 0) {
    return;
  }

  const sizeReference = Math.max(
    roomDimensions.width,
    roomDimensions.depth,
    roomDimensions.height,
    6
  );
  const sunWorld = getSunWorldPosition(solarState.snapshot, roomDimensions);
  const targetWorld = {
    x: 0,
    y: roomDimensions.height * 0.08,
    z: 0,
  };
  const projectedSun = projectPoint(
    rotatePoint(sunWorld, rotationX, rotationY),
    canvasWidth,
    canvasHeight,
    sizeReference,
    zoom
  );
  const projectedTarget = projectPoint(
    rotatePoint(targetWorld, rotationX, rotationY),
    canvasWidth,
    canvasHeight,
    sizeReference,
    zoom
  );
  const altitudeIntensity = clamp(solarState.snapshot.altitude / 90, 0.2, 1);
  const haloRadius = 22 + altitudeIntensity * 12;
  const coreRadius = 8 + altitudeIntensity * 3.5;
  const glow = context.createRadialGradient(
    projectedSun.x,
    projectedSun.y,
    0,
    projectedSun.x,
    projectedSun.y,
    haloRadius
  );

  glow.addColorStop(0, "rgba(251, 191, 36, 0.95)");
  glow.addColorStop(0.45, "rgba(251, 191, 36, 0.42)");
  glow.addColorStop(1, "rgba(251, 191, 36, 0)");

  context.save();
  context.setLineDash([8, 8]);
  context.strokeStyle = `rgba(245, 158, 11, ${0.18 + altitudeIntensity * 0.18})`;
  context.lineWidth = 1.6;
  context.beginPath();
  context.moveTo(projectedSun.x, projectedSun.y);
  context.lineTo(projectedTarget.x, projectedTarget.y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = glow;
  context.beginPath();
  context.arc(projectedSun.x, projectedSun.y, haloRadius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f59e0b";
  context.beginPath();
  context.arc(projectedSun.x, projectedSun.y, coreRadius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(projectedSun.x, projectedSun.y, coreRadius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function getFloorGridSettings(roomDimensions: RoomDimensions) {
  const maxSpan = Math.max(roomDimensions.width, roomDimensions.depth, 6);
  const step = getRoundedStep(maxSpan / 7);
  const targetExtent = Math.max(maxSpan * 2.4, 14);
  const halfLines = Math.min(18, Math.max(8, Math.ceil(targetExtent / step)));

  return {
    step,
    halfLines,
    extent: halfLines * step,
    majorEvery: 5,
  };
}

function getCirclePlanePoints(
  radius: number,
  segments: number,
  startAngle = -Math.PI / 2
): PlanePoint[] {
  return Array.from({ length: segments }, (_, index) => {
    const angle = startAngle + (index / segments) * Math.PI * 2;

    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    };
  });
}

function getRoundedStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const candidates: number[] = [];

  for (let power = exponent - 1; power <= exponent + 1; power += 1) {
    const magnitude = 10 ** power;

    [1, 2, 5].forEach((multiplier) => {
      candidates.push(multiplier * magnitude);
    });
  }

  return candidates.reduce((best, current) => {
    const bestDistance = Math.abs(Math.log(best / value));
    const currentDistance = Math.abs(Math.log(current / value));

    return currentDistance < bestDistance ? current : best;
  });
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

function getSunWorldPosition(solarSnapshot: SolarSnapshot, roomDimensions: RoomDimensions): Point3D {
  const azimuthRad = (solarSnapshot.azimuth * Math.PI) / 180;
  const altitudeRad = (solarSnapshot.altitude * Math.PI) / 180;
  const sceneScale = Math.max(roomDimensions.width, roomDimensions.depth, roomDimensions.height, 6);
  const distance = sceneScale * 3.2;
  const horizontal = Math.cos(altitudeRad) * distance;

  return {
    x: Math.sin(azimuthRad) * horizontal,
    y: Math.sin(altitudeRad) * distance,
    z: -Math.cos(azimuthRad) * horizontal,
  };
}

function getProjectedLabelPoint(start: { x: number; y: number }, end: { x: number; y: number }, offset: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: end.x + (dx / length) * offset,
    y: end.y + (dy / length) * offset,
  };
}

function projectFloorPlanePoint(
  centerWorld: Point3D,
  offset: PlanePoint,
  canvasWidth: number,
  canvasHeight: number,
  sizeReference: number,
  rotationX: number,
  rotationY: number,
  zoom: number
): ProjectedPoint {
  return projectPoint(
    rotatePoint(
      {
        x: centerWorld.x + offset.x,
        y: centerWorld.y,
        z: centerWorld.z + offset.z,
      },
      rotationX,
      rotationY
    ),
    canvasWidth,
    canvasHeight,
    sizeReference,
    zoom
  );
}

function traceProjectedShape(
  context: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  closePath = false
) {
  if (points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }

  if (closePath) {
    context.closePath();
  }
}

function drawCompassLabel(
  context: CanvasRenderingContext2D,
  label: string,
  point: ProjectedPoint,
  color: string,
  fontSize: number
) {
  context.save();
  context.fillStyle = color;
  context.font = `700 ${fontSize}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, point.x, point.y);
  context.restore();
}

function projectPoint(
  point: Point3D,
  canvasWidth: number,
  canvasHeight: number,
  sizeReference: number,
  zoom: number
): ProjectedPoint {
  const cameraDistance = sizeReference * 4.2;
  const perspective = (Math.min(canvasWidth, canvasHeight) * BASE_PROJECTION_SCALE * zoom) /
    (point.z + cameraDistance);

  return {
    x: canvasWidth / 2 + point.x * perspective,
    y: canvasHeight * 0.58 - point.y * perspective,
    z: point.z,
  };
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

function buildWallOpeningPlacements(
  formValues: CanvasFormValues,
  roomDimensions: RoomDimensions
) {
  const openings: Record<WallDirection, WallFeaturePlacement[]> = {
    North: [],
    East: [],
    South: [],
    West: [],
  };

  const doorInputs = new Map<WallDirection, DoorInput>();
  const windowInputs = new Map<WallDirection, WindowInput>();

  getRawDoorInputs(formValues).forEach((door) => {
    if (door.width > 0) {
      doorInputs.set(door.direction, door);
    }
  });

  getRawWindowInputs(formValues).forEach((window) => {
    if (window.width > 0) {
      windowInputs.set(window.direction, window);
    }
  });

  (["North", "East", "South", "West"] as WallDirection[]).forEach((direction) => {
    const wallLength = getWallLengthForDirection(direction, roomDimensions);
    const doorInput = doorInputs.get(direction);
    const windowInput = windowInputs.get(direction);
    const spans = resolveWallFeatureSpans(
      wallLength,
      doorInput?.width ?? 0,
      windowInput?.width ?? 0
    );

    if (doorInput && spans.door) {
      openings[direction].push({
        kind: "door",
        direction,
        startMeters: spans.door.startMeters,
        widthMeters: spans.door.widthMeters,
        bottomMeters: 0,
        heightMeters: clampOpeningHeight(
          doorInput.height,
          roomDimensions.height,
          DEFAULT_DOOR_HEIGHT,
          1.8
        ),
      });
    }

    if (windowInput && spans.window) {
      const heightMeters = clampOpeningHeight(
        windowInput.height,
        roomDimensions.height,
        DEFAULT_WINDOW_HEIGHT,
        0.6
      );
      const bottomMeters = getWindowBottomOffset(roomDimensions.height, heightMeters);

      openings[direction].push({
        kind: "window",
        direction,
        startMeters: spans.window.startMeters,
        widthMeters: spans.window.widthMeters,
        bottomMeters,
        heightMeters,
      });
    }
  });

  return openings;
}

function drawWallOpening(
  context: CanvasRenderingContext2D,
  placement: WallFeaturePlacement,
  roomDimensions: RoomDimensions,
  rotationX: number,
  rotationY: number,
  canvasWidth: number,
  canvasHeight: number,
  sizeReference: number,
  zoom: number
) {
  const surface = getWallSurfaceFrame(placement.direction, roomDimensions);
  const outerCorners = createWallFeaturePolygon(surface, placement);
  const { horizontalInset, verticalInset } = getOpeningFrameInsets(placement);
  const innerCorners = createInsetWallFeaturePolygon(
    surface,
    placement,
    horizontalInset,
    verticalInset
  );
  const projectedOuterCorners = outerCorners.map((point) =>
    projectPoint(
      rotatePoint(point, rotationX, rotationY),
      canvasWidth,
      canvasHeight,
      sizeReference,
      zoom
    )
  );
  const projectedInnerCorners = innerCorners.map((point) =>
    projectPoint(
      rotatePoint(point, rotationX, rotationY),
      canvasWidth,
      canvasHeight,
      sizeReference,
      zoom
    )
  );

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  if (placement.kind === "door") {
    context.fillStyle = "rgba(107, 68, 35, 0.92)";
    context.strokeStyle = "rgba(92, 51, 23, 0.92)";
    context.lineWidth = 1;
  } else {
    context.fillStyle = "rgba(71, 85, 105, 0.88)";
    context.strokeStyle = "rgba(71, 85, 105, 0.95)";
    context.lineWidth = 1;
  }

  traceProjectedShape(context, projectedOuterCorners, true);
  context.fill();
  context.stroke();

  if (placement.kind === "door") {
    const leafGradient = context.createLinearGradient(
      projectedInnerCorners[3].x,
      projectedInnerCorners[3].y,
      projectedInnerCorners[1].x,
      projectedInnerCorners[1].y
    );
    leafGradient.addColorStop(0, "rgba(252, 244, 230, 0.98)");
    leafGradient.addColorStop(0.55, "rgba(217, 159, 98, 0.98)");
    leafGradient.addColorStop(1, "rgba(126, 75, 42, 0.98)");

    context.fillStyle = leafGradient;
    context.strokeStyle = "rgba(92, 51, 23, 0.72)";
    context.lineWidth = 1;
    traceProjectedShape(context, projectedInnerCorners, true);
    context.fill();
    context.stroke();

    drawDoorDetail(context, projectedInnerCorners);
  } else {
    const glassGradient = context.createLinearGradient(
      projectedInnerCorners[3].x,
      projectedInnerCorners[3].y,
      projectedInnerCorners[1].x,
      projectedInnerCorners[1].y
    );
    glassGradient.addColorStop(0, "rgba(224, 242, 254, 0.92)");
    glassGradient.addColorStop(0.45, "rgba(186, 230, 253, 0.62)");
    glassGradient.addColorStop(1, "rgba(56, 189, 248, 0.28)");

    context.fillStyle = glassGradient;
    context.strokeStyle = "rgba(255, 255, 255, 0.64)";
    context.lineWidth = 1;
    traceProjectedShape(context, projectedInnerCorners, true);
    context.fill();
    context.stroke();

    drawWindowDetail(context, projectedInnerCorners);
  }

  context.restore();
}

function drawDoorDetail(context: CanvasRenderingContext2D, projectedCorners: ProjectedPoint[]) {
  const panelFrame = insetProjectedQuad(projectedCorners, 0.2, 0.14);
  const centerLineStart = projectQuadPoint(projectedCorners, 0.5, 0.18);
  const centerLineEnd = projectQuadPoint(projectedCorners, 0.5, 0.82);
  const handlePoint = projectQuadPoint(projectedCorners, 0.78, 0.56);
  const handleRadius = clamp(Math.min(getQuadWidth(projectedCorners), getQuadHeight(projectedCorners)) * 0.04, 1.1, 2.1);

  context.save();
  context.strokeStyle = "rgba(92, 51, 23, 0.55)";
  context.lineWidth = 0.95;

  traceProjectedShape(context, panelFrame, true);
  context.stroke();

  context.beginPath();
  context.moveTo(centerLineStart.x, centerLineStart.y);
  context.lineTo(centerLineEnd.x, centerLineEnd.y);
  context.stroke();

  context.fillStyle = "rgba(255, 251, 235, 0.96)";
  context.beginPath();
  context.arc(handlePoint.x, handlePoint.y, handleRadius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(120, 53, 15, 0.92)";
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(handlePoint.x, handlePoint.y, handleRadius, 0, Math.PI * 2);
  context.stroke();

  const hingeTop = projectQuadPoint(projectedCorners, 0.12, 0.22);
  const hingeBottom = projectQuadPoint(projectedCorners, 0.12, 0.78);
  context.strokeStyle = "rgba(255, 251, 235, 0.55)";
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(hingeTop.x, hingeTop.y);
  context.lineTo(hingeBottom.x, hingeBottom.y);
  context.stroke();

  context.restore();
}

function drawWindowDetail(context: CanvasRenderingContext2D, projectedCorners: ProjectedPoint[]) {
  const frame = insetProjectedQuad(projectedCorners, 0.1, 0.1);
  const topLeft = projectQuadPoint(projectedCorners, 0.12, 0.1);
  const bottomRight = projectQuadPoint(projectedCorners, 0.88, 0.9);
  const mullionTop = projectQuadPoint(projectedCorners, 0.5, 0.14);
  const mullionBottom = projectQuadPoint(projectedCorners, 0.5, 0.86);
  const sillLeft = projectQuadPoint(projectedCorners, 0.18, 0.82);
  const sillRight = projectQuadPoint(projectedCorners, 0.82, 0.82);

  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 0.9;

  traceProjectedShape(context, frame, true);
  context.stroke();

  context.beginPath();
  context.moveTo(topLeft.x, topLeft.y);
  context.lineTo(bottomRight.x, bottomRight.y);
  context.stroke();

  context.strokeStyle = "rgba(255, 255, 255, 0.35)";
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(mullionTop.x, mullionTop.y);
  context.lineTo(mullionBottom.x, mullionBottom.y);
  context.stroke();

  context.beginPath();
  context.moveTo(sillLeft.x, sillLeft.y);
  context.lineTo(sillRight.x, sillRight.y);
  context.stroke();
  context.restore();
}

function createWallFeaturePolygon(
  surface: WallSurfaceFrame,
  placement: WallFeaturePlacement
): Point3D[] {
  const startOffset = scalePoint3D(surface.horizontal, placement.startMeters);
  const endOffset = scalePoint3D(
    surface.horizontal,
    placement.startMeters + placement.widthMeters
  );
  const bottomOffset = scalePoint3D(surface.vertical, placement.bottomMeters);
  const topOffset = scalePoint3D(surface.vertical, placement.bottomMeters + placement.heightMeters);
  const bottomLeft = addPoint3D(surface.origin, addPoint3D(startOffset, bottomOffset));
  const bottomRight = addPoint3D(surface.origin, addPoint3D(endOffset, bottomOffset));
  const topLeft = addPoint3D(surface.origin, addPoint3D(startOffset, topOffset));
  const topRight = addPoint3D(surface.origin, addPoint3D(endOffset, topOffset));

  return [bottomLeft, bottomRight, topRight, topLeft];
}

function createInsetWallFeaturePolygon(
  surface: WallSurfaceFrame,
  placement: WallFeaturePlacement,
  horizontalInsetMeters: number,
  verticalInsetMeters: number
): Point3D[] {
  const safeHorizontalInset = clamp(
    horizontalInsetMeters,
    0,
    Math.max(placement.widthMeters / 2 - 0.01, 0)
  );
  const safeVerticalInset = clamp(
    verticalInsetMeters,
    0,
    Math.max(placement.heightMeters / 2 - 0.01, 0)
  );

  return createWallFeaturePolygon(surface, {
    ...placement,
    startMeters: placement.startMeters + safeHorizontalInset,
    widthMeters: Math.max(placement.widthMeters - safeHorizontalInset * 2, 0.02),
    bottomMeters: placement.bottomMeters + safeVerticalInset,
    heightMeters: Math.max(placement.heightMeters - safeVerticalInset * 2, 0.02),
  });
}

function getOpeningFrameInsets(placement: WallFeaturePlacement) {
  if (placement.kind === "door") {
    return {
      horizontalInset: clamp(placement.widthMeters * 0.06, 0.035, 0.08),
      verticalInset: clamp(placement.heightMeters * 0.06, 0.035, 0.09),
    };
  }

  return {
    horizontalInset: clamp(placement.widthMeters * 0.05, 0.03, 0.07),
    verticalInset: clamp(placement.heightMeters * 0.08, 0.04, 0.1),
  };
}

function getWallSurfaceFrame(
  direction: WallDirection,
  roomDimensions: RoomDimensions
): WallSurfaceFrame {
  const halfWidth = roomDimensions.width / 2;
  const halfDepth = roomDimensions.depth / 2;
  const floorY = -roomDimensions.height / 2;

  switch (direction) {
    case "North":
      return {
        origin: { x: -halfWidth, y: floorY, z: -halfDepth },
        horizontal: { x: 1, y: 0, z: 0 },
        vertical: { x: 0, y: 1, z: 0 },
      };
    case "East":
      return {
        origin: { x: halfWidth, y: floorY, z: -halfDepth },
        horizontal: { x: 0, y: 0, z: 1 },
        vertical: { x: 0, y: 1, z: 0 },
      };
    case "South":
      return {
        origin: { x: halfWidth, y: floorY, z: halfDepth },
        horizontal: { x: -1, y: 0, z: 0 },
        vertical: { x: 0, y: 1, z: 0 },
      };
    case "West":
      return {
        origin: { x: -halfWidth, y: floorY, z: halfDepth },
        horizontal: { x: 0, y: 0, z: -1 },
        vertical: { x: 0, y: 1, z: 0 },
      };
  }
}

function createWallFacePoints(
  direction: WallDirection,
  roomDimensions: RoomDimensions,
  wallSide: WallSide = "outer",
  insetMeters = 0
): Point3D[] {
  const surface = getWallSurfaceFrame(direction, roomDimensions);
  const length = getWallLengthForDirection(direction, roomDimensions);
  const origin = addPoint3D(
    surface.origin,
    scalePoint3D(getWallNormal(direction, wallSide), insetMeters)
  );

  const start = origin;
  const end = addPoint3D(origin, scalePoint3D(surface.horizontal, length));
  const topEnd = addPoint3D(end, scalePoint3D(surface.vertical, roomDimensions.height));
  const topStart = addPoint3D(origin, scalePoint3D(surface.vertical, roomDimensions.height));

  return [start, end, topEnd, topStart];
}

function getWallLengthForDirection(
  direction: WallDirection,
  roomDimensions: RoomDimensions
) {
  return direction === "North" || direction === "South"
    ? roomDimensions.width
    : roomDimensions.depth;
}

function resolveWallFeatureSpans(
  segmentLengthMeters: number,
  doorWidthMeters: number,
  windowWidthMeters: number
): {
  door: WallFeatureSpan | null;
  window: WallFeatureSpan | null;
} {
  const sideInsetMeters = Math.min(segmentLengthMeters * 0.15, 0.12);
  const usableStart = sideInsetMeters;
  const usableEnd = Math.max(segmentLengthMeters - sideInsetMeters, usableStart);
  const usableWidth = Math.max(usableEnd - usableStart, 0);
  const clampToCenteredSpan = (desiredWidthMeters: number): WallFeatureSpan | null => {
    const widthMeters = Math.min(desiredWidthMeters, usableWidth);

    if (widthMeters <= 0.05) {
      return null;
    }

    return {
      startMeters: usableStart + (usableWidth - widthMeters) / 2,
      widthMeters,
    };
  };

  const result = {
    door: null as WallFeatureSpan | null,
    window: null as WallFeatureSpan | null,
  };

  if (doorWidthMeters > 0) {
    result.door = clampToCenteredSpan(doorWidthMeters);
  }

  if (windowWidthMeters <= 0) {
    return result;
  }

  if (!result.door) {
    result.window = clampToCenteredSpan(windowWidthMeters);
    return result;
  }

  const gapMeters = Math.min(Math.max(segmentLengthMeters * 0.04, 0.08), 0.2);
  const doorStart = result.door.startMeters;
  const doorEnd = doorStart + result.door.widthMeters;
  const leftWidth = Math.max(doorStart - gapMeters - usableStart, 0);
  const rightStart = doorEnd + gapMeters;
  const rightWidth = Math.max(usableEnd - rightStart, 0);
  const placeOnRight = rightWidth > leftWidth;

  const trySpan = (spanStart: number, spanWidth: number): WallFeatureSpan | null => {
    const widthMeters = Math.min(windowWidthMeters, spanWidth);

    if (widthMeters <= 0.05) {
      return null;
    }

    return {
      startMeters: spanStart + (spanWidth - widthMeters) / 2,
      widthMeters,
    };
  };

  result.window = placeOnRight
    ? trySpan(rightStart, rightWidth) ?? trySpan(usableStart, leftWidth)
    : trySpan(usableStart, leftWidth) ?? trySpan(rightStart, rightWidth);

  return result;
}

function getRawDoorInputs(formValues: CanvasFormValues): DoorInput[] {
  return [
    {
      direction: "North",
      width: parsePositiveNumber(formValues.doorNorthWidth),
      height: parsePositiveNumber(formValues.doorNorthHeight, DEFAULT_DOOR_HEIGHT),
    },
    {
      direction: "East",
      width: parsePositiveNumber(formValues.doorEastWidth),
      height: parsePositiveNumber(formValues.doorEastHeight, DEFAULT_DOOR_HEIGHT),
    },
    {
      direction: "South",
      width: parsePositiveNumber(formValues.doorSouthWidth),
      height: parsePositiveNumber(formValues.doorSouthHeight, DEFAULT_DOOR_HEIGHT),
    },
    {
      direction: "West",
      width: parsePositiveNumber(formValues.doorWestWidth),
      height: parsePositiveNumber(formValues.doorWestHeight, DEFAULT_DOOR_HEIGHT),
    },
  ];
}

function getRawWindowInputs(formValues: CanvasFormValues): WindowInput[] {
  return [
    {
      direction: "North",
      width: parsePositiveNumber(formValues.windowNorthWidth),
      height: parsePositiveNumber(formValues.windowNorthHeight, DEFAULT_WINDOW_HEIGHT),
    },
    {
      direction: "East",
      width: parsePositiveNumber(formValues.windowEastWidth),
      height: parsePositiveNumber(formValues.windowEastHeight, DEFAULT_WINDOW_HEIGHT),
    },
    {
      direction: "South",
      width: parsePositiveNumber(formValues.windowSouthWidth),
      height: parsePositiveNumber(formValues.windowSouthHeight, DEFAULT_WINDOW_HEIGHT),
    },
    {
      direction: "West",
      width: parsePositiveNumber(formValues.windowWestWidth),
      height: parsePositiveNumber(formValues.windowWestHeight, DEFAULT_WINDOW_HEIGHT),
    },
  ];
}

function clampOpeningHeight(
  desiredHeight: number,
  wallHeight: number,
  fallbackHeight: number,
  minimumHeight: number,
  clearance = 0.15
) {
  const availableHeight = Math.max(wallHeight - clearance, 0.3);
  const candidate = desiredHeight > 0 ? desiredHeight : fallbackHeight;
  const lowerBound = Math.min(minimumHeight, availableHeight);

  return clamp(candidate, lowerBound, availableHeight);
}

function getWindowBottomOffset(roomHeight: number, windowHeight: number) {
  const availableBottom = Math.max(roomHeight - windowHeight - 0.15, 0);

  return clamp(DEFAULT_WINDOW_SILL_HEIGHT, 0, availableBottom);
}

function addPoint3D(first: Point3D, second: Point3D): Point3D {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  };
}

function scalePoint3D(point: Point3D, scalar: number): Point3D {
  return {
    x: point.x * scalar,
    y: point.y * scalar,
    z: point.z * scalar,
  };
}

function getProjectedMidpoint(first: ProjectedPoint, second: ProjectedPoint) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    z: (first.z + second.z) / 2,
  };
}

function projectQuadPoint(projectedCorners: ProjectedPoint[], u: number, v: number) {
  const bottomEdgePoint = lerpProjectedPoint(projectedCorners[0], projectedCorners[1], u);
  const topEdgePoint = lerpProjectedPoint(projectedCorners[3], projectedCorners[2], u);

  return lerpProjectedPoint(bottomEdgePoint, topEdgePoint, v);
}

function insetProjectedQuad(projectedCorners: ProjectedPoint[], insetU: number, insetV: number) {
  return [
    projectQuadPoint(projectedCorners, insetU, insetV),
    projectQuadPoint(projectedCorners, 1 - insetU, insetV),
    projectQuadPoint(projectedCorners, 1 - insetU, 1 - insetV),
    projectQuadPoint(projectedCorners, insetU, 1 - insetV),
  ];
}

function lerpProjectedPoint(first: ProjectedPoint, second: ProjectedPoint, t: number): ProjectedPoint {
  return {
    x: first.x + (second.x - first.x) * t,
    y: first.y + (second.y - first.y) * t,
    z: first.z + (second.z - first.z) * t,
  };
}

function getQuadWidth(projectedCorners: ProjectedPoint[]) {
  return Math.hypot(
    projectedCorners[1].x - projectedCorners[0].x,
    projectedCorners[1].y - projectedCorners[0].y
  );
}

function getQuadHeight(projectedCorners: ProjectedPoint[]) {
  return Math.hypot(
    projectedCorners[3].x - projectedCorners[0].x,
    projectedCorners[3].y - projectedCorners[0].y
  );
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
    parseWallThicknessMeters(formValues.wallNorthWidth, DEFAULT_WALL_THICKNESS),
    parseWallThicknessMeters(formValues.wallEastWidth, DEFAULT_WALL_THICKNESS),
    parseWallThicknessMeters(formValues.wallSouthWidth, DEFAULT_WALL_THICKNESS),
    parseWallThicknessMeters(formValues.wallWestWidth, DEFAULT_WALL_THICKNESS),
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

function parseWallThicknessMeters(value: string | undefined, fallback = 0) {
  const parsed = parsePositiveNumber(value, fallback);

  if (parsed > 20) {
    return parsed / 1000;
  }

  return parsed;
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLiveSunSummary(solarState: SolarState) {
  if (solarState.status === "ready") {
    const { snapshot } = solarState;

    if (snapshot.altitude <= 0) {
      return {
        bar: `Sun below horizon | Azimuth ${formatDegree(snapshot.azimuth)}° | Zenith ${formatDegree(
          snapshot.zenith
        )}°`,
      };
    }

    const direction = toCardinalDirection(snapshot.azimuth);

    return {
      bar: `Live sun | Azimuth ${formatDegree(snapshot.azimuth)}° ${direction} | Zenith ${formatDegree(
        snapshot.zenith
      )}° | Altitude ${formatDegree(snapshot.altitude)}°`,
    };
  }

  if (solarState.status === "loading") {
    return {
      bar: "Sun: Syncing...",
    };
  }

  return {
    bar: solarState.message,
  };
}

function getSunSummary(solarState: SolarState) {
  if (solarState.status === "ready") {
    const { snapshot } = solarState;

    if (snapshot.altitude <= 0) {
      return `Sun: Below horizon | Az ${formatDegree(snapshot.azimuth)}° | Zen ${formatDegree(snapshot.zenith)}°`;
    }

    return `Sun: ${toCardinalDirection(snapshot.azimuth)} | Az ${formatDegree(snapshot.azimuth)}° | Zen ${formatDegree(
      snapshot.zenith
    )}° | Alt ${formatDegree(snapshot.altitude)}°`;
  }

  if (solarState.status === "loading") {
    return "Sun: Syncing...";
  }

  return `Sun: ${solarState.message}`;
}

function createSolarSnapshot(payload: SolarApiResponse): SolarSnapshot {
  return {
    azimuth: payload.solarPosition.azimuth,
    zenith: payload.solarPosition.zenith,
    altitude: 90 - payload.solarPosition.zenith,
    targetDateTime: payload.targetDateTime,
    latitude: payload.location.latitude,
    longitude: payload.location.longitude,
    alerts: payload.alerts ?? [],
  };
}

function formatDegree(value: number) {
  return Math.round(value).toString();
}

function toCardinalDirection(azimuth: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((azimuth % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;

  return directions[index];
}
