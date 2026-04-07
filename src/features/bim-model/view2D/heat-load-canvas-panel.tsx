"use client";

import { useEffect, useRef, useState } from "react";
import {
  WorkspaceViewToggle,
  type WorkspaceView,
} from "../workspace-view-toggle";

const RULER_SIZE = 24;
const LEFT_RULER_SIZE = 32;
const BASE_GRID_SIZE = 40;
const DEFAULT_WALL_THICKNESS = 0.2;
const DIMENSION_GAP = 12;
const GRID_TARGET_SIZE = 44;

type CanvasFormValues = Record<string, string>;
type Point = { x: number; y: number };
type WallDirection = "North" | "East" | "South" | "West";

type WallSegment = {
  direction: WallDirection;
  length: number;
  thickness: number;
  start: Point;
  end: Point;
};

type RawWallInput = {
  direction: WallDirection;
  length: number;
  thickness: number;
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

type WallFeatureSpan = {
  startMeters: number;
  widthMeters: number;
};

type OffsetLine = {
  start: Point;
  end: Point;
};

type WallChain = {
  segments: WallSegment[];
  closed: boolean;
};

type ChainGeometry =
  | {
      closed: true;
      outerPoints: Point[];
      innerPoints: Point[];
    }
  | {
      closed: false;
      outerPoints: Point[];
      innerPoints: Point[];
      polygonPoints: Point[];
    };

type LaidOutChain = {
  chain: WallChain;
  geometry: ChainGeometry;
  offset: Point;
};

type WallChainBuildResult = {
  chains: WallChain[];
  hasFullLoopInput: boolean;
};

type GridMetrics = {
  pixelsPerMeter: number;
  gridStepMeters: number;
  gridSpacing: number;
  subStepSpacing: number;
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

export function HeatLoadCanvasPanel({
  formValues,
  activeView,
  onViewChange,
}: {
  formValues: CanvasFormValues;
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);
  const [solarState, setSolarState] = useState<SolarState>({
    status: "loading",
    snapshot: null,
    message: "Locating live sun...",
  });

  const offsetRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

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
        const params = new URLSearchParams({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          timezone,
          datetime: new Date().toISOString(),
          mode: "auto",
        });

        const response = await fetch(`/api/solar-details?${params.toString()}`);
        const payload = (await response.json()) as SolarApiResponse;

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Unable to load live sun data.");
        }

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
            ? "Enable location access to show the live sun position."
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

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      draw(canvas, ctx);
    };

    function drawRulers(
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      gridMetrics: GridMetrics,
      offsetX: number,
      offsetY: number
    ) {
      context.fillStyle = "#e0efff";
      context.fillRect(0, 0, width, RULER_SIZE);
      context.fillRect(0, 0, LEFT_RULER_SIZE, height);

      context.strokeStyle = "#93c5fd";
      context.lineWidth = 1;

      context.beginPath();
      context.moveTo(0, RULER_SIZE);
      context.lineTo(width, RULER_SIZE);
      context.stroke();

      context.beginPath();
      context.moveTo(LEFT_RULER_SIZE, 0);
      context.lineTo(LEFT_RULER_SIZE, height);
      context.stroke();

      context.fillStyle = "#1e3a8a";
      context.font = "10px sans-serif";
      context.textBaseline = "middle";

      const subStep = gridMetrics.subStepSpacing;

      let indexX = Math.floor(-offsetX / subStep);

      for (let x = LEFT_RULER_SIZE + getOffsetWithinStep(offsetX, subStep); x < width; x += subStep) {
        const mod = getPositiveModulo(indexX, 4);

        let tick = 4;
        let showLabel = false;

        if (mod === 0) {
          tick = 12;
          showLabel = true;
        } else if (mod === 2) {
          tick = 8;
        }

        context.beginPath();
        context.moveTo(x, RULER_SIZE);
        context.lineTo(x, RULER_SIZE - tick);
        context.stroke();

        if (showLabel) {
          const value = roundToPrecision((indexX / 4) * gridMetrics.gridStepMeters);
          context.fillText(formatAxisValue(value), x + 2, 10);
        }

        indexX++;
      }

      let indexY = Math.floor(-offsetY / subStep);

      for (let y = RULER_SIZE + getOffsetWithinStep(offsetY, subStep); y < height; y += subStep) {
        const mod = getPositiveModulo(indexY, 4);

        let tick = 4;
        let showLabel = false;

        if (mod === 0) {
          tick = 12;
          showLabel = true;
        } else if (mod === 2) {
          tick = 8;
        }

        context.beginPath();
        context.moveTo(LEFT_RULER_SIZE, y);
        context.lineTo(LEFT_RULER_SIZE - tick, y);
        context.stroke();

        if (showLabel) {
          const value = roundToPrecision(-((indexY / 4) * gridMetrics.gridStepMeters));

          context.save();
          context.translate(10, y);
          context.rotate(-Math.PI / 2);
          context.fillText(formatAxisValue(value), 0, 0);
          context.restore();
        }

        indexY++;
      }
    }

    function drawGrid(
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      gridMetrics: GridMetrics,
      offsetX: number,
      offsetY: number
    ) {
      const drawX = LEFT_RULER_SIZE;
      const drawY = RULER_SIZE;
      const drawWidth = width - LEFT_RULER_SIZE;
      const drawHeight = height - RULER_SIZE;

      context.save();
      context.beginPath();
      context.rect(drawX, drawY, drawWidth, drawHeight);
      context.clip();

      context.fillStyle = "#dbeafe";
      context.fillRect(drawX, drawY, drawWidth, drawHeight);

      const minorStep = gridMetrics.subStepSpacing;
      const majorStep = gridMetrics.gridSpacing;

      context.strokeStyle = "rgba(59, 130, 246, 0.12)";
      context.lineWidth = 1;

      const minorStartX = drawX + getOffsetWithinStep(offsetX, minorStep);
      for (let x = minorStartX; x < width; x += minorStep) {
        context.beginPath();
        context.moveTo(x, drawY);
        context.lineTo(x, height);
        context.stroke();
      }

      const minorStartY = drawY + getOffsetWithinStep(offsetY, minorStep);
      for (let y = minorStartY; y < height; y += minorStep) {
        context.beginPath();
        context.moveTo(drawX, y);
        context.lineTo(width, y);
        context.stroke();
      }

      context.strokeStyle = "rgba(29, 78, 216, 0.24)";

      const majorStartX = drawX + getOffsetWithinStep(offsetX, majorStep);
      for (let x = majorStartX; x < width; x += majorStep) {
        context.beginPath();
        context.moveTo(x, drawY);
        context.lineTo(x, height);
        context.stroke();
      }

      const majorStartY = drawY + getOffsetWithinStep(offsetY, majorStep);
      for (let y = majorStartY; y < height; y += majorStep) {
        context.beginPath();
        context.moveTo(drawX, y);
        context.lineTo(width, y);
        context.stroke();
      }

      context.restore();
    }

    function drawWallPlan(
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      pixelsPerMeter: number,
      offsetX: number,
      offsetY: number
    ) {
      const drawX = LEFT_RULER_SIZE;
      const drawY = RULER_SIZE;
      const drawWidth = width - LEFT_RULER_SIZE;
      const drawHeight = height - RULER_SIZE;
      const wallChainResult = buildWallChains(formValues);
      const visibleSegments = wallChainResult.chains.flatMap((chain) => chain.segments);
      const pendingDoors = new Map<WallDirection, DoorInput>();
      const pendingWindows = new Map<WallDirection, WindowInput>();
      getRawDoorInputs(formValues).forEach((door) => {
        if (door.width > 0) {
          pendingDoors.set(door.direction, door);
        }
      });
      getRawWindowInputs(formValues).forEach((window) => {
        if (window.width > 0) {
          pendingWindows.set(window.direction, window);
        }
      });
      const laidOutChains = layoutChains(
        wallChainResult.chains
          .map((chain) => {
            const geometry = buildChainGeometry(chain);

            if (!geometry) {
              return null;
            }

            return {
              chain,
              geometry,
            };
          })
          .filter((value): value is { chain: WallChain; geometry: ChainGeometry } => value !== null)
      );

      context.save();
      context.beginPath();
      context.rect(drawX, drawY, drawWidth, drawHeight);
      context.clip();

      if (visibleSegments.length === 0) {
        context.fillStyle = "#64748b";
        context.font = "14px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
          "Enter wall lengths on the left to draw the room plan.",
          drawX + drawWidth / 2,
          drawY + drawHeight / 2
        );
        context.restore();
        return;
      }

      const bounds = laidOutChains.bounds;
      const planWidth = Math.max(bounds.maxX - bounds.minX, 1);
      const planHeight = Math.max(bounds.maxY - bounds.minY, 1);

      const originX =
        drawX + (drawWidth - planWidth * pixelsPerMeter) / 2 - bounds.minX * pixelsPerMeter + offsetX;
      const originY =
        drawY + (drawHeight - planHeight * pixelsPerMeter) / 2 - bounds.minY * pixelsPerMeter + offsetY;

      laidOutChains.items.forEach((item) => {
        if (item.geometry.closed) {
          const translatedOuter = item.geometry.outerPoints.map((point) =>
            translatePoint(addPoints(point, item.offset), originX, originY, pixelsPerMeter)
          );
          const translatedInner = item.geometry.innerPoints.map((point) =>
            translatePoint(addPoints(point, item.offset), originX, originY, pixelsPerMeter)
          );

          context.beginPath();
          addClosedPath(context, translatedOuter);
          addClosedPath(context, translatedInner);
          context.fillStyle = "#0f172b";
          context.fill("evenodd");

          context.beginPath();
          addClosedPath(context, translatedInner);
          context.fillStyle = "rgba(190, 18, 60, 0.08)";
          context.fill();
        } else {
          const translatedPolygon = item.geometry.polygonPoints.map((point) =>
            translatePoint(addPoints(point, item.offset), originX, originY, pixelsPerMeter)
          );

          context.beginPath();
          addClosedPath(context, translatedPolygon);
          context.fillStyle = "#0f172b";
          context.fill();
        }

        item.chain.segments.forEach((segment) => {
          const start = translatePoint(addPoints(segment.start, item.offset), originX, originY, pixelsPerMeter);
          const end = translatePoint(addPoints(segment.end, item.offset), originX, originY, pixelsPerMeter);
          const door = pendingDoors.get(segment.direction);
          const window = pendingWindows.get(segment.direction);

          if (door || window) {
            drawCenteredWallFeatures(
              context,
              segment,
              start,
              end,
              pixelsPerMeter,
              door?.width ?? 0,
              window?.width ?? 0
            );
            if (door) {
              pendingDoors.delete(segment.direction);
            }
            if (window) {
              pendingWindows.delete(segment.direction);
            }
          }

          drawSegmentDimension(
            context,
            segment.direction,
            start,
            end,
            segment.length,
            segment.thickness * pixelsPerMeter,
          );
        });

        if (wallChainResult.hasFullLoopInput && !item.chain.closed) {
          const lastSegment = item.chain.segments[item.chain.segments.length - 1];
          const firstSegment = item.chain.segments[0];

          const lastPoint = translatePoint(
            addPoints(lastSegment.end, item.offset),
            originX,
            originY,
            pixelsPerMeter
          );
          const firstPoint = translatePoint(
            addPoints(firstSegment.start, item.offset),
            originX,
            originY,
            pixelsPerMeter
          );

          context.setLineDash([8, 6]);
          context.lineWidth = 2;
          context.strokeStyle = "#be123c";
          context.beginPath();
          context.moveTo(lastPoint.x, lastPoint.y);
          context.lineTo(firstPoint.x, firstPoint.y);
          context.stroke();
          context.setLineDash([]);
        }
      });

      if (solarState.status === "ready" && solarState.snapshot.altitude > 0) {
        const planCenter = translatePoint(
          {
            x: bounds.minX + planWidth / 2,
            y: bounds.minY + planHeight / 2,
          },
          originX,
          originY,
          pixelsPerMeter
        );

        drawSunOverlay(
          context,
          planCenter,
          {
            x: drawX,
            y: drawY,
            width: drawWidth,
            height: drawHeight,
          },
          solarState.snapshot
        );
      }

      context.restore();
    }

    function draw(canvasElement: HTMLCanvasElement, context: CanvasRenderingContext2D) {
      const width = canvasElement.width;
      const height = canvasElement.height;
      const gridMetrics = getGridMetrics(scale);

      context.clearRect(0, 0, width, height);

      drawGrid(
        context,
        width,
        height,
        gridMetrics,
        offsetRef.current.x,
        offsetRef.current.y
      );

      drawWallPlan(
        context,
        width,
        height,
        gridMetrics.pixelsPerMeter,
        offsetRef.current.x,
        offsetRef.current.y
      );

      drawRulers(
        context,
        width,
        height,
        gridMetrics,
        offsetRef.current.x,
        offsetRef.current.y
      );
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      setScale((previousScale) => Math.max(0.4, Math.min(previousScale * zoomFactor, 4)));
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

      const dx = event.clientX - lastMouse.current.x;
      const dy = event.clientY - lastMouse.current.y;

      offsetRef.current.x += dx;
      offsetRef.current.y += dy;

      lastMouse.current = { x: event.clientX, y: event.clientY };

      draw(canvas, ctx);
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
  }, [formValues, scale, solarState]);

  const wallSummary = getWallSummary(formValues);
  const sunSummary = getSunSummary(solarState);
  const compassMarker =
    solarState.status === "ready" && solarState.snapshot.altitude > 0
      ? getCompassMarkerPosition(solarState.snapshot.azimuth)
      : null;

  return (
    <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
      <div className="border-b border-rose-100 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#be123c]">
              Drawing Area
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              2D Plan Workspace
            </h2>
          </div>
          <WorkspaceViewToggle
            activeView={activeView}
            onChange={onViewChange}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="relative flex h-full w-full flex-1 overflow-hidden border border-sky-100 bg-[#dbeafe]">
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
          />
          <div className="pointer-events-none absolute right-4 top-6">
            <svg
              aria-hidden="true"
              viewBox="0 0 72 72"
              className="h-24 w-24"
            >
              <circle cx="36" cy="36" r="22" fill="white" fillOpacity="0.9" stroke="#fda4af" strokeWidth="1.5" />
              <path d="M36 16 L31 31 L36 28 L41 31 Z" fill="#be123c" />
              <path d="M36 56 L31 41 L36 44 L41 41 Z" fill="#94a3b8" />
              <path d="M56 36 L41 31 L44 36 L41 41 Z" fill="#94a3b8" />
              <path d="M16 36 L31 31 L28 36 L31 41 Z" fill="#94a3b8" />
              <circle cx="36" cy="36" r="3.2" fill="#0f172b" />
              {compassMarker ? (
                <>
                  <path
                    d={`M36 36 L${compassMarker.x} ${compassMarker.y}`}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <g transform={`translate(${compassMarker.x} ${compassMarker.y})`}>
                    <circle r="7.2" fill="rgba(251, 191, 36, 0.2)" />
                    <circle r="4.2" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.1" />
                    <path d="M0 -9.6 V-6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M0 9.6 V6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M-9.6 0 H-6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M9.6 0 H6.4" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M-6.8 -6.8 L-4.8 -4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M6.8 -6.8 L4.8 -4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M-6.8 6.8 L-4.8 4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M6.8 6.8 L4.8 4.8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </>
              ) : null}
              <text x="36" y="8" textAnchor="middle" fontSize="9" fontWeight="700" fill="#be123c">N</text>
              <text x="65" y="39" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">E</text>
              <text x="36" y="70" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">S</text>
              <text x="7" y="39" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">W</text>
            </svg>
          </div>
        </div>
      </div>

      <div className="border-t border-rose-100 bg-[#fffafb] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>Mode: Plan View</span>
          <span>Zoom: {Math.round(scale * 100)}%</span>
          <span>{wallSummary}</span>
          <span>{sunSummary.bar}</span>
        </div>
      </div>
    </section>
  );
}

function buildWallChains(formValues: CanvasFormValues): WallChainBuildResult {
  const rawWalls = getRawWallInputs(formValues);
  const hasFullLoopInput = rawWalls.every((wall) => wall.length > 0);

  if (hasFullLoopInput) {
    const segments = createChainSegments(rawWalls);

    return {
      chains: [
        {
          segments,
          closed: getDistance(segments[segments.length - 1].end, segments[0].start) <= 0.01,
        },
      ],
      hasFullLoopInput,
    };
  }

  const chains: WallChain[] = [];

  for (let index = 0; index < rawWalls.length; index += 1) {
    const currentWall = rawWalls[index];
    const previousWall = rawWalls[(index + rawWalls.length - 1) % rawWalls.length];

    if (currentWall.length <= 0 || previousWall.length > 0) {
      continue;
    }

    const chainWalls: RawWallInput[] = [];
    let currentIndex = index;

    while (rawWalls[currentIndex].length > 0) {
      chainWalls.push(rawWalls[currentIndex]);

      const nextIndex = (currentIndex + 1) % rawWalls.length;
      if (rawWalls[nextIndex].length <= 0 || nextIndex === index) {
        break;
      }

      currentIndex = nextIndex;
    }

    chains.push({
      segments: createChainSegments(chainWalls),
      closed: false,
    });
  }

  return {
    chains,
    hasFullLoopInput,
  };
}

function getRawWallInputs(formValues: CanvasFormValues): RawWallInput[] {
  return [
    {
      direction: "North",
      length: parsePositiveNumber(formValues.wallNorthLength),
      thickness: parsePositiveNumber(formValues.wallNorthWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      direction: "East",
      length: parsePositiveNumber(formValues.wallEastLength),
      thickness: parsePositiveNumber(formValues.wallEastWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      direction: "South",
      length: parsePositiveNumber(formValues.wallSouthLength),
      thickness: parsePositiveNumber(formValues.wallSouthWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      direction: "West",
      length: parsePositiveNumber(formValues.wallWestLength),
      thickness: parsePositiveNumber(formValues.wallWestWidth, DEFAULT_WALL_THICKNESS),
    },
  ];
}

function getRawDoorInputs(formValues: CanvasFormValues): DoorInput[] {
  return [
    {
      direction: "North",
      width: parsePositiveNumber(formValues.doorNorthWidth),
      height: parsePositiveNumber(formValues.doorNorthHeight),
    },
    {
      direction: "East",
      width: parsePositiveNumber(formValues.doorEastWidth),
      height: parsePositiveNumber(formValues.doorEastHeight),
    },
    {
      direction: "South",
      width: parsePositiveNumber(formValues.doorSouthWidth),
      height: parsePositiveNumber(formValues.doorSouthHeight),
    },
    {
      direction: "West",
      width: parsePositiveNumber(formValues.doorWestWidth),
      height: parsePositiveNumber(formValues.doorWestHeight),
    },
  ];
}

function getRawWindowInputs(formValues: CanvasFormValues): WindowInput[] {
  return [
    {
      direction: "North",
      width: parsePositiveNumber(formValues.windowNorthWidth),
      height: parsePositiveNumber(formValues.windowNorthHeight),
    },
    {
      direction: "East",
      width: parsePositiveNumber(formValues.windowEastWidth),
      height: parsePositiveNumber(formValues.windowEastHeight),
    },
    {
      direction: "South",
      width: parsePositiveNumber(formValues.windowSouthWidth),
      height: parsePositiveNumber(formValues.windowSouthHeight),
    },
    {
      direction: "West",
      width: parsePositiveNumber(formValues.windowWestWidth),
      height: parsePositiveNumber(formValues.windowWestHeight),
    },
  ];
}

function createChainSegments(walls: RawWallInput[]): WallSegment[] {
  let currentPoint = { x: 0, y: 0 };

  return walls.map((wall) => {
    const directionVector = getDirectionVector(wall.direction);
    const start = currentPoint;
    const end = {
      x: start.x + directionVector.x * wall.length,
      y: start.y + directionVector.y * wall.length,
    };

    currentPoint = end;

    return {
      direction: wall.direction,
      length: wall.length,
      thickness: wall.thickness,
      start,
      end,
    };
  });
}

function getDirectionVector(direction: WallDirection): Point {
  switch (direction) {
    case "North":
      return { x: 1, y: 0 };
    case "East":
      return { x: 0, y: 1 };
    case "South":
      return { x: -1, y: 0 };
    case "West":
      return { x: 0, y: -1 };
  }
}

function getPointsBounds(points: Point[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
}

function buildChainGeometry(chain: WallChain): ChainGeometry | null {
  if (chain.segments.length === 0) {
    return null;
  }

  const innerPoints = getInnerPathPoints(chain.segments);
  const outerLines = chain.segments.map((segment) => getOuterOffsetLine(segment));

  if (chain.closed) {
    const outerPoints = buildClosedBoundary(outerLines);
    const innerLoopPoints = removeClosingPoint(innerPoints);

    if (!outerPoints || innerLoopPoints.length === 0) {
      return null;
    }

    return {
      closed: true,
      outerPoints,
      innerPoints: innerLoopPoints,
    };
  }

  const openBoundaries = buildOpenWallGeometry(outerLines, innerPoints);

  return {
    closed: false,
    outerPoints: openBoundaries.outerPoints,
    innerPoints: openBoundaries.innerPoints,
    polygonPoints: openBoundaries.polygonPoints,
  };
}

function getOuterOffsetLine(segment: WallSegment): OffsetLine {
  const leftNormal = getLeftNormal(segment);
  const offsetDistance = segment.thickness;

  return {
    start: offsetPoint(segment.start, leftNormal, offsetDistance),
    end: offsetPoint(segment.end, leftNormal, offsetDistance),
  };
}

function buildClosedBoundary(lines: OffsetLine[]) {
  const points = lines.map((line, index) =>
    getLineIntersection(line, lines[(index + 1) % lines.length])
  );

  if (points.some((point) => point === null)) {
    return null;
  }

  return points as Point[];
}

function getInnerPathPoints(segments: WallSegment[]) {
  if (segments.length === 0) {
    return [];
  }

  return [segments[0].start, ...segments.map((segment) => segment.end)];
}

function removeClosingPoint(points: Point[]) {
  if (points.length <= 1) {
    return points;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (getDistance(firstPoint, lastPoint) <= 0.01) {
    return points.slice(0, -1);
  }

  return points;
}

function buildOpenWallGeometry(
  outerLines: OffsetLine[],
  innerPoints: Point[]
) {
  const outerBoundary: Point[] = [outerLines[0].start];

  for (let index = 0; index < outerLines.length - 1; index += 1) {
    outerBoundary.push(getLineIntersection(outerLines[index], outerLines[index + 1]) ?? outerLines[index].end);
  }

  outerBoundary.push(outerLines[outerLines.length - 1].end);

  return {
    outerPoints: outerBoundary,
    innerPoints,
    polygonPoints: [...innerPoints, ...outerBoundary.slice().reverse()],
  };
}

function layoutChains(
  items: Array<{
    chain: WallChain;
    geometry: ChainGeometry;
  }>
) {
  const laidOutItems: LaidOutChain[] = [];

  let cursorX = 0;

  items.forEach((item, index) => {
    const points = getGeometryPoints(item.geometry);
    const bounds = getPointsBounds(points);
    const baseX = index === 0 ? 0 : cursorX + 2;
    const offset = {
      x: baseX - bounds.minX,
      y: -bounds.minY,
    };

    laidOutItems.push({
      ...item,
      offset,
    });

    cursorX = baseX + (bounds.maxX - bounds.minX);
  });

  const allPlacedPoints = laidOutItems.flatMap((item) =>
    getGeometryPoints(item.geometry).map((point) => addPoints(point, item.offset))
  );

  return {
    items: laidOutItems,
    bounds:
      allPlacedPoints.length > 0
        ? getPointsBounds(allPlacedPoints)
        : {
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0,
          },
  };
}

function getGridMetrics(scale: number): GridMetrics {
  const pixelsPerMeter = BASE_GRID_SIZE * scale;
  const desiredStepMeters = GRID_TARGET_SIZE / pixelsPerMeter;
  const gridStepMeters = getRoundedGridStep(desiredStepMeters);

  return {
    pixelsPerMeter,
    gridStepMeters,
    gridSpacing: pixelsPerMeter * gridStepMeters,
    subStepSpacing: (pixelsPerMeter * gridStepMeters) / 4,
  };
}

function getRoundedGridStep(desiredStepMeters: number) {
  if (!Number.isFinite(desiredStepMeters) || desiredStepMeters <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(desiredStepMeters));
  const candidates: number[] = [];

  for (let power = exponent - 1; power <= exponent + 1; power += 1) {
    const magnitude = 10 ** power;

    [1, 2, 5].forEach((multiplier) => {
      candidates.push(multiplier * magnitude);
    });
  }

  return candidates.reduce((bestStep, currentStep) => {
    const bestDistance = Math.abs(Math.log(bestStep / desiredStepMeters));
    const currentDistance = Math.abs(Math.log(currentStep / desiredStepMeters));

    return currentDistance < bestDistance ? currentStep : bestStep;
  });
}

function getOffsetWithinStep(offset: number, step: number) {
  return getPositiveModulo(offset, step);
}

function getPositiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getGeometryPoints(geometry: ChainGeometry) {
  return geometry.closed
    ? [...geometry.outerPoints, ...geometry.innerPoints]
    : [...geometry.outerPoints, ...geometry.innerPoints];
}

function getLeftNormal(segment: WallSegment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: dy / length,
    y: -dx / length,
  };
}

function offsetPoint(point: Point, normal: Point, distance: number): Point {
  return {
    x: point.x + normal.x * distance,
    y: point.y + normal.y * distance,
  };
}

function getLineIntersection(first: OffsetLine, second: OffsetLine): Point | null {
  const firstDirection = {
    x: first.end.x - first.start.x,
    y: first.end.y - first.start.y,
  };
  const secondDirection = {
    x: second.end.x - second.start.x,
    y: second.end.y - second.start.y,
  };
  const determinant = crossProduct(firstDirection, secondDirection);

  if (Math.abs(determinant) < 0.000001) {
    return null;
  }

  const difference = {
    x: second.start.x - first.start.x,
    y: second.start.y - first.start.y,
  };
  const scale = crossProduct(difference, secondDirection) / determinant;

  return {
    x: first.start.x + firstDirection.x * scale,
    y: first.start.y + firstDirection.y * scale,
  };
}

function crossProduct(first: Point, second: Point) {
  return first.x * second.y - first.y * second.x;
}

function addClosedPath(context: CanvasRenderingContext2D, points: Point[]) {
  if (points.length === 0) return;

  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
}

function translatePoint(point: Point, originX: number, originY: number, gridSize: number): Point {
  return {
    x: originX + point.x * gridSize,
    y: originY + point.y * gridSize,
  };
}

function addPoints(first: Point, second: Point): Point {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
  };
}

function scalePoint(point: Point, scalar: number): Point {
  return {
    x: point.x * scalar,
    y: point.y * scalar,
  };
}

function normalizeVector(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y) || 1;

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function drawSegmentDimension(
  context: CanvasRenderingContext2D,
  direction: WallDirection,
  start: Point,
  end: Point,
  value: number,
  wallThicknessPx: number,
) {
  const exteriorNormal = getExteriorNormal(direction);
  const offsetDistance = wallThicknessPx + DIMENSION_GAP;
  const dimensionStart = addPoints(start, scalePoint(exteriorNormal, offsetDistance));
  const dimensionEnd = addPoints(end, scalePoint(exteriorNormal, offsetDistance));
  const dimensionDirection = normalizeVector({
    x: dimensionEnd.x - dimensionStart.x,
    y: dimensionEnd.y - dimensionStart.y,
  });
  const midX = (dimensionStart.x + dimensionEnd.x) / 2;
  const midY = (dimensionStart.y + dimensionEnd.y) / 2;
  const isHorizontal = direction === "North" || direction === "South";
  const label = `${formatValue(value)} m`;

  context.save();
  context.strokeStyle = "#be123c";
  context.fillStyle = "#be123c";
  context.lineWidth = 1.5;

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(dimensionStart.x, dimensionStart.y);
  context.moveTo(end.x, end.y);
  context.lineTo(dimensionEnd.x, dimensionEnd.y);
  context.moveTo(dimensionStart.x, dimensionStart.y);
  context.lineTo(dimensionEnd.x, dimensionEnd.y);
  context.stroke();

  drawDimensionTick(context, dimensionStart, dimensionDirection);
  drawDimensionTick(context, dimensionEnd, dimensionDirection);

  context.font = "12px sans-serif";
  const metrics = context.measureText(label);
  const textWidth = metrics.width;
  const paddingX = 8;
  const paddingY = 4;

  context.save();
  context.translate(midX, midY);
  if (!isHorizontal) {
    context.rotate(-Math.PI / 2);
  }
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.fillRect(
    -textWidth / 2 - paddingX,
    -6 - paddingY,
    textWidth + paddingX * 2,
    12 + paddingY * 2
  );
  context.fillStyle = "#9f1239";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 0, 0);
  context.restore();

  context.restore();
}

function drawCenteredWallFeatures(
  context: CanvasRenderingContext2D,
  segment: WallSegment,
  start: Point,
  end: Point,
  pixelsPerMeter: number,
  doorWidthMeters: number,
  windowWidthMeters: number
) {
  const segmentLengthPx = getDistance(start, end);
  if (segmentLengthPx <= 0.01) {
    return;
  }

  const alongWall = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y,
  });
  const exteriorNormal = normalizeVector(getExteriorNormal(segment.direction));
  const interiorNormal = normalizeVector(getInteriorNormal(segment.direction));
  const wallThicknessPx = Math.max(segment.thickness * pixelsPerMeter, 1);
  const featureSpans = resolveWallFeatureSpans(
    segment.length,
    doorWidthMeters,
    windowWidthMeters
  );

  context.save();

  if (featureSpans.door) {
    const openingWidthPx = featureSpans.door.widthMeters * pixelsPerMeter;
    const openingStart = addPoints(
      start,
      scalePoint(alongWall, featureSpans.door.startMeters * pixelsPerMeter)
    );
    const openingEnd = addPoints(openingStart, scalePoint(alongWall, openingWidthPx));
    const openingOuterEnd = addPoints(openingEnd, scalePoint(exteriorNormal, wallThicknessPx));
    const openingOuterStart = addPoints(openingStart, scalePoint(exteriorNormal, wallThicknessPx));
    const hingePoint = openingStart;
    const leafEnd = addPoints(hingePoint, scalePoint(interiorNormal, openingWidthPx));

    context.fillStyle = "#dbeafe";
    context.beginPath();
    addClosedPath(context, [openingStart, openingEnd, openingOuterEnd, openingOuterStart]);
    context.fill();

    context.strokeStyle = "rgba(51, 65, 85, 0.7)";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(hingePoint.x, hingePoint.y);
    context.lineTo(leafEnd.x, leafEnd.y);
    context.stroke();

    drawDoorSwingArc(context, hingePoint, openingEnd, leafEnd);
  }

  if (featureSpans.window) {
    const windowStart = addPoints(
      start,
      scalePoint(alongWall, featureSpans.window.startMeters * pixelsPerMeter)
    );
    const windowEnd = addPoints(
      windowStart,
      scalePoint(alongWall, featureSpans.window.widthMeters * pixelsPerMeter)
    );
    const windowCenterOffset = wallThicknessPx * 0.52;
    const lineStart = addPoints(windowStart, scalePoint(exteriorNormal, windowCenterOffset));
    const lineEnd = addPoints(windowEnd, scalePoint(exteriorNormal, windowCenterOffset));

    context.strokeStyle = "#38bdf8";
    context.lineWidth = clampNumber(wallThicknessPx * 0.42, 3, 7);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(lineStart.x, lineStart.y);
    context.lineTo(lineEnd.x, lineEnd.y);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.85)";
    context.lineWidth = Math.max(clampNumber(wallThicknessPx * 0.16, 1.2, 3), 1.2);
    context.beginPath();
    context.moveTo(lineStart.x, lineStart.y);
    context.lineTo(lineEnd.x, lineEnd.y);
    context.stroke();
  }

  context.restore();
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

function drawDoorSwingArc(
  context: CanvasRenderingContext2D,
  hingePoint: Point,
  closedPoint: Point,
  openPoint: Point
) {
  const radius = getDistance(hingePoint, closedPoint);
  if (radius <= 0.5) {
    return;
  }

  let startAngle = Math.atan2(closedPoint.y - hingePoint.y, closedPoint.x - hingePoint.x);
  let endAngle = Math.atan2(openPoint.y - hingePoint.y, openPoint.x - hingePoint.x);

  if (endAngle < startAngle && startAngle - endAngle > Math.PI) {
    endAngle += Math.PI * 2;
  } else if (startAngle < endAngle && endAngle - startAngle > Math.PI) {
    startAngle += Math.PI * 2;
  }

  context.beginPath();
  context.arc(
    hingePoint.x,
    hingePoint.y,
    radius,
    startAngle,
    endAngle,
    endAngle < startAngle
  );
  context.stroke();
}

function getInteriorNormal(direction: WallDirection): Point {
  switch (direction) {
    case "North":
      return { x: 0, y: 1 };
    case "East":
      return { x: -1, y: 0 };
    case "South":
      return { x: 0, y: -1 };
    case "West":
      return { x: 1, y: 0 };
  }
}

function getExteriorNormal(direction: WallDirection): Point {
  return scalePoint(getInteriorNormal(direction), -1);
}

function drawDimensionTick(context: CanvasRenderingContext2D, point: Point, dimensionDirection: Point) {
  const perpendicular = {
    x: -dimensionDirection.y,
    y: dimensionDirection.x,
  };
  const tickLength = 6;
  const first = addPoints(point, scalePoint(perpendicular, tickLength));
  const second = addPoints(point, scalePoint(perpendicular, -tickLength));

  context.beginPath();
  context.moveTo(first.x, first.y);
  context.lineTo(second.x, second.y);
  context.stroke();
}

function drawSunOverlay(
  context: CanvasRenderingContext2D,
  planCenter: Point,
  bounds: { x: number; y: number; width: number; height: number },
  solarSnapshot: SolarSnapshot
) {
  const sunVector = getSunScreenVector(solarSnapshot.azimuth);
  const reach = Math.min(bounds.width, bounds.height) * 0.32;
  const altitudeFactor = clampNumber(solarSnapshot.altitude / 90, 0.15, 1);

  const start = clampPointToBounds(
    {
      x: planCenter.x + sunVector.x * reach,
      y: planCenter.y + sunVector.y * reach,
    },
    bounds,
    24
  );

  context.save();
  context.fillStyle = `rgba(251, 191, 36, ${0.3 + altitudeFactor * 0.2})`;
  context.beginPath();
  context.arc(start.x, start.y, 11, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#f59e0b";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(start.x, start.y, 6.5, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function getWallSummary(formValues: CanvasFormValues) {
  const visibleSegments = getRawWallInputs(formValues).filter((wall) => wall.length > 0);

  if (visibleSegments.length === 0) {
    return "No walls drawn yet";
  }

  return `Walls: ${visibleSegments.map((segment) => `${formatValue(segment.length)}m`).join(" | ")}`;
}

function getSunSummary(solarState: SolarState) {
  if (solarState.status === "ready") {
    const { snapshot } = solarState;

    if (snapshot.altitude <= 0) {
      return {
        bar: `Sun below horizon | Azimuth ${formatDegree(snapshot.azimuth)}° | Zenith ${formatDegree(snapshot.zenith)}°`,
      };
    }

    const direction = toCardinalDirection(snapshot.azimuth);

    return {
      bar: `Live sun | Azimuth ${formatDegree(snapshot.azimuth)}° ${direction} | Zenith ${formatDegree(snapshot.zenith)}° | Altitude ${formatDegree(snapshot.altitude)}°`,
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

function parsePositiveNumber(value: string | undefined, fallback = 0) {
  if (!value) return fallback;

  const normalizedValue = Number(value.replace(",", "."));

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return fallback;
  }

  return normalizedValue;
}

function getDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatAxisValue(value: number) {
  return Number(roundToPrecision(value).toFixed(2)).toString();
}

function roundToPrecision(value: number) {
  return Math.round(value * 100) / 100;
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

function getCompassMarkerPosition(azimuth: number) {
  const angle = (azimuth * Math.PI) / 180;
  const radius = 22;

  return {
    x: roundToPrecision(36 + Math.sin(angle) * radius),
    y: roundToPrecision(36 - Math.cos(angle) * radius),
  };
}

function getSunScreenVector(azimuth: number): Point {
  const angle = (azimuth * Math.PI) / 180;

  return {
    x: Math.sin(angle),
    y: -Math.cos(angle),
  };
}

function clampPointToBounds(
  point: Point,
  bounds: { x: number; y: number; width: number; height: number },
  padding: number
): Point {
  return {
    x: clampNumber(point.x, bounds.x + padding, bounds.x + bounds.width - padding),
    y: clampNumber(point.y, bounds.y + padding, bounds.y + bounds.height - padding),
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
