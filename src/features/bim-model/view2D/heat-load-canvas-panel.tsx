"use client";

import { useEffect, useRef, useState } from "react";
import { getWallAppearanceByType, type WallAppearance, type WallPatternKind } from "@/data/assets";
import { createBucketedIsoString, fetchCachedJson } from "@/lib/client-fetch-cache";
import { CompassOverlay, getCompassMarkerPosition } from "../shared/CompassOverlay";
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
const EDITOR_SNAP_DIVISIONS = 4;
const EDITOR_MIN_WALL_LENGTH = 0.4;
const EDITOR_DEFAULT_WINDOW_WIDTH = 1.2;
const EDITOR_DEFAULT_DOOR_WIDTH = 0.9;
const EDITOR_OPENING_EDGE_INSET = 0.2;
const wallPatternCache: Partial<Record<WallPatternKind, CanvasPattern | null>> = {};

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

type EditorTool = "select" | "pan" | "delete" | "wall" | "window" | "door";

type EditableWall = {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
};

type OpeningKind = "window" | "door";

type EditableOpening = {
  id: string;
  wallId: string;
  kind: OpeningKind;
  offsetMeters: number;
  widthMeters: number;
};

type SelectedEditorElement =
  | {
      kind: "wall" | "opening";
      id: string;
    }
  | null;

type EditorDragState =
  | {
      kind: "idle";
    }
  | {
      kind: "pan";
      lastScreen: Point;
    }
  | {
      kind: "wall";
      wallId: string;
      lastWorld: Point;
    }
  | {
      kind: "opening";
      openingId: string;
    };

type EditorViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  pixelsPerMeter: number;
};

type ToolOption = {
  key: EditorTool;
  label: string;
};

type EditorWallHit = {
  wall: EditableWall;
  distance: number;
};

type EditorOpeningHit = {
  opening: EditableOpening;
  wall: EditableWall;
};

type ActiveEditorTool = EditorTool | null;

const TOOL_OPTIONS: ToolOption[] = [
  { key: "select", label: "Select" },
  { key: "pan", label: "Pan" },
  { key: "delete", label: "Delete" },
];

export function HeatLoadCanvasPanel({
  formValues,
  activeView,
  onViewChange,
  onFieldChange,
}: {
  formValues: CanvasFormValues;
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onFieldChange: (name: string, value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);
  const [solarState, setSolarState] = useState<SolarState>({
    status: "loading",
    snapshot: null,
    message: "Locating live sun...",
  });
  const [editorTool, setEditorTool] = useState<ActiveEditorTool>(null);
  const [editorRevision, setEditorRevision] = useState(0);

  const offsetRef = useRef({ x: 0, y: 0 });
  const editorToolRef = useRef<ActiveEditorTool>(null);
  const editorWallsRef = useRef<EditableWall[]>([]);
  const editorOpeningsRef = useRef<EditableOpening[]>([]);
  const selectedEditorElementRef = useRef<SelectedEditorElement>(null);
  const draftWallStartRef = useRef<Point | null>(null);
  const draftWallEndRef = useRef<Point | null>(null);
  const dragStateRef = useRef<EditorDragState>({ kind: "idle" });
  const idCounterRef = useRef(0);

  const refreshEditorUi = () => {
    setEditorRevision((previousValue) => previousValue + 1);
  };

  const clearEditorDraft = () => {
    draftWallStartRef.current = null;
    draftWallEndRef.current = null;
  };

  const clearFormFields = (...fieldNames: string[]) => {
    fieldNames.forEach((fieldName) => onFieldChange(fieldName, ""));
  };

  const deleteWallAndSync = (wall: EditableWall) => {
    const direction = getEditorWallDirection(wall);

    editorWallsRef.current = editorWallsRef.current.filter((item) => item.id !== wall.id);
    editorOpeningsRef.current = editorOpeningsRef.current.filter(
      (opening) => opening.wallId !== wall.id
    );

    clearFormFields(
      getWallLengthFieldName(direction),
      getDoorLengthFieldName(direction),
      getDoorWidthFieldName(direction),
      getDoorHeightFieldName(direction),
      getWindowLengthFieldName(direction),
      getWindowWidthFieldName(direction),
      getWindowHeightFieldName(direction)
    );
  };

  const deleteOpeningAndSync = (opening: EditableOpening, wall: EditableWall) => {
    const direction = getEditorWallDirection(wall);

    editorOpeningsRef.current = editorOpeningsRef.current.filter(
      (item) => item.id !== opening.id
    );

    if (opening.kind === "door") {
      clearFormFields(
        getDoorLengthFieldName(direction),
        getDoorWidthFieldName(direction),
        getDoorHeightFieldName(direction)
      );
      return;
    }

    clearFormFields(
      getWindowLengthFieldName(direction),
      getWindowWidthFieldName(direction),
      getWindowHeightFieldName(direction)
    );
  };

  const deleteSelectedEditorElement = () => {
    const selected = selectedEditorElementRef.current;

    if (!selected) {
      return;
    }

    if (selected.kind === "wall") {
      const wall = editorWallsRef.current.find((item) => item.id === selected.id);

      if (!wall) {
        return;
      }

      deleteWallAndSync(wall);
    } else {
      const opening = editorOpeningsRef.current.find((item) => item.id === selected.id);

      if (!opening) {
        return;
      }

      const wall = editorWallsRef.current.find((item) => item.id === opening.wallId);

      if (!wall) {
        return;
      }

      deleteOpeningAndSync(opening, wall);
    }

    selectedEditorElementRef.current = null;
    refreshEditorUi();
  };

  const handleToolbarToolClick = (tool: EditorTool) => {
    if (tool === "delete" && selectedEditorElementRef.current !== null) {
      deleteSelectedEditorElement();
      setEditorTool(null);
      return;
    }

    setEditorTool((previousTool) => (previousTool === tool ? null : tool));
  };

  useEffect(() => {
    editorToolRef.current = editorTool;

    if (
      editorTool !== "wall" &&
      (draftWallStartRef.current !== null || draftWallEndRef.current !== null)
    ) {
      clearEditorDraft();
      refreshEditorUi();
    }
  }, [editorTool]);

  useEffect(() => {
    const seededSketch = buildEditorSketchFromFormValues(formValues);

    editorWallsRef.current = seededSketch.walls;
    editorOpeningsRef.current = seededSketch.openings;
    idCounterRef.current = seededSketch.lastId;
    selectedEditorElementRef.current = null;
    dragStateRef.current = { kind: "idle" };
    clearEditorDraft();
    refreshEditorUi();
  }, [formValues]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const workspaceElement = workspaceRef.current;

      if (!workspaceElement) {
        return;
      }

      if (event.target instanceof Node && workspaceElement.contains(event.target)) {
        return;
      }

      selectedEditorElementRef.current = null;
      dragStateRef.current = { kind: "idle" };
      clearEditorDraft();
      refreshEditorUi();
      setEditorTool(null);
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, []);

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

      const editorViewport = getEditorViewport(
        width,
        height,
        pixelsPerMeter,
        offsetX,
        offsetY
      );
      const hasEditorContent =
        editorWallsRef.current.length > 0 ||
        editorOpeningsRef.current.length > 0 ||
        draftWallStartRef.current !== null;

      if (hasEditorContent) {
        drawEditorPlan(
          context,
          editorViewport,
          editorWallsRef.current,
          editorOpeningsRef.current,
          selectedEditorElementRef.current,
          draftWallStartRef.current,
          draftWallEndRef.current
        );
        context.restore();
        return;
      }

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
          const appearance = getWallAppearanceForDirection(segment.direction, formValues);

          drawWallTypeSurface(
            context,
            segment,
            start,
            end,
            pixelsPerMeter,
            appearance
          );

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

    const redrawCanvas = () => {
      draw(canvas, ctx);
    };

    const getCanvasPoint = (event: MouseEvent): Point => {
      const bounds = canvas.getBoundingClientRect();
      const scaleX = bounds.width > 0 ? canvas.width / bounds.width : 1;
      const scaleY = bounds.height > 0 ? canvas.height / bounds.height : 1;

      return {
        x: (event.clientX - bounds.left) * scaleX,
        y: (event.clientY - bounds.top) * scaleY,
      };
    };

    const getEditorInteractionContext = (event: MouseEvent) => {
      const point = getCanvasPoint(event);
      const gridMetrics = getGridMetrics(scale);
      const viewport = getEditorViewport(
        canvas.width,
        canvas.height,
        gridMetrics.pixelsPerMeter,
        offsetRef.current.x,
        offsetRef.current.y
      );
      const insideViewport = isPointInsideViewport(point, viewport);
      const rawWorldPoint = insideViewport
        ? screenToEditorWorld(point, viewport)
        : null;
      const worldPoint = rawWorldPoint
        ? snapEditorPoint(rawWorldPoint, getEditorSnapStep(gridMetrics))
        : null;

      return {
        point,
        gridMetrics,
        viewport,
        insideViewport,
        worldPoint,
      };
    };

    const handleMouseDown = (event: MouseEvent) => {
      const interaction = getEditorInteractionContext(event);
      const tool = editorToolRef.current;

      if (tool === null) {
        dragStateRef.current = { kind: "idle" };
        return;
      }

      if (!interaction.insideViewport) {
        dragStateRef.current = { kind: "idle" };
        return;
      }

      const openingHit = findEditorOpeningHit(
        interaction.point,
        interaction.viewport,
        editorWallsRef.current,
        editorOpeningsRef.current
      );
      const wallHit: EditorWallHit | null =
        openingHit === null
          ? findEditorWallHit(
              interaction.point,
              interaction.viewport,
              editorWallsRef.current
            )
          : null;

      if (tool === "wall") {
        if (!interaction.worldPoint) {
          return;
        }

        if (!draftWallStartRef.current) {
          selectedEditorElementRef.current = null;
          draftWallStartRef.current = interaction.worldPoint;
          draftWallEndRef.current = interaction.worldPoint;
          refreshEditorUi();
          redrawCanvas();
          return;
        }

        const endPoint = lockEditorWallPoint(
          draftWallStartRef.current,
          interaction.worldPoint
        );

        if (
          getDistance(draftWallStartRef.current, endPoint) >=
          EDITOR_MIN_WALL_LENGTH
        ) {
          idCounterRef.current += 1;

          const wall: EditableWall = {
            id: `wall-${idCounterRef.current}`,
            start: draftWallStartRef.current,
            end: endPoint,
            thickness: DEFAULT_WALL_THICKNESS,
          };

          editorWallsRef.current = [...editorWallsRef.current, wall];
          selectedEditorElementRef.current = {
            kind: "wall",
            id: wall.id,
          };
        }

        clearEditorDraft();
        refreshEditorUi();
        redrawCanvas();
        return;
      }

      if (tool === "window" || tool === "door") {
        const worldPoint = interaction.worldPoint;

        if (!wallHit || !worldPoint) {
          return;
        }

        const nextOpening = createEditorOpening(
          tool,
          wallHit.wall,
          worldPoint
        );

        if (!nextOpening) {
          return;
        }

        idCounterRef.current += 1;
        const opening: EditableOpening = {
          ...nextOpening,
          id: `opening-${idCounterRef.current}`,
        };

        editorOpeningsRef.current = [...editorOpeningsRef.current, opening];
        selectedEditorElementRef.current = {
          kind: "opening",
          id: opening.id,
        };
        refreshEditorUi();
        redrawCanvas();
        return;
      }

      if (tool === "delete") {
        if (openingHit) {
          deleteOpeningAndSync(openingHit.opening, openingHit.wall);
          if (selectedEditorElementRef.current?.id === openingHit.opening.id) {
            selectedEditorElementRef.current = null;
          }
          refreshEditorUi();
          redrawCanvas();
          return;
        }

        if (wallHit) {
          deleteWallAndSync(wallHit.wall);
          if (selectedEditorElementRef.current?.id === wallHit.wall.id) {
            selectedEditorElementRef.current = null;
          }
          refreshEditorUi();
          redrawCanvas();
        }

        return;
      }

      if (tool === "pan") {
        dragStateRef.current = {
          kind: "pan",
          lastScreen: interaction.point,
        };
        redrawCanvas();
        return;
      }

      if (openingHit && interaction.worldPoint) {
        selectedEditorElementRef.current = {
          kind: "opening",
          id: openingHit.opening.id,
        };
        dragStateRef.current = {
          kind: "opening",
          openingId: openingHit.opening.id,
        };
        refreshEditorUi();
        redrawCanvas();
        return;
      }

      if (wallHit && interaction.worldPoint) {
        const worldPoint = interaction.worldPoint;

        selectedEditorElementRef.current = {
          kind: "wall",
          id: wallHit.wall.id,
        };
        dragStateRef.current = {
          kind: "wall",
          wallId: wallHit.wall.id,
          lastWorld: worldPoint,
        };
        refreshEditorUi();
        redrawCanvas();
        return;
      }

      selectedEditorElementRef.current = null;
      dragStateRef.current = { kind: "idle" };
      refreshEditorUi();
      redrawCanvas();
    };

    const handleMouseUp = () => {
      dragStateRef.current = { kind: "idle" };
    };

    const handleMouseMove = (event: MouseEvent) => {
      const interaction = getEditorInteractionContext(event);
      const dragState = dragStateRef.current;

      if (
        editorToolRef.current === "wall" &&
        draftWallStartRef.current &&
        interaction.worldPoint
      ) {
        draftWallEndRef.current = lockEditorWallPoint(
          draftWallStartRef.current,
          interaction.worldPoint
        );
        redrawCanvas();
      }

      if (dragState.kind === "pan") {
        const dx = interaction.point.x - dragState.lastScreen.x;
        const dy = interaction.point.y - dragState.lastScreen.y;

        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
        dragStateRef.current = {
          kind: "pan",
          lastScreen: interaction.point,
        };
        redrawCanvas();
        return;
      }

      if (dragState.kind === "wall" && interaction.worldPoint) {
        const delta = {
          x: interaction.worldPoint.x - dragState.lastWorld.x,
          y: interaction.worldPoint.y - dragState.lastWorld.y,
        };

        if (Math.abs(delta.x) <= 0.0001 && Math.abs(delta.y) <= 0.0001) {
          return;
        }

        editorWallsRef.current = editorWallsRef.current.map((wall) =>
          wall.id === dragState.wallId ? moveEditorWall(wall, delta) : wall
        );
        dragStateRef.current = {
          kind: "wall",
          wallId: dragState.wallId,
          lastWorld: interaction.worldPoint,
        };
        redrawCanvas();
        return;
      }

      if (dragState.kind === "opening" && interaction.worldPoint) {
        const worldPoint = interaction.worldPoint;
        const targetOpening = editorOpeningsRef.current.find(
          (opening) => opening.id === dragState.openingId
        );

        if (!targetOpening) {
          dragStateRef.current = { kind: "idle" };
          return;
        }

        const ownerWall = editorWallsRef.current.find(
          (wall) => wall.id === targetOpening.wallId
        );

        if (!ownerWall) {
          dragStateRef.current = { kind: "idle" };
          return;
        }

        editorOpeningsRef.current = editorOpeningsRef.current.map((opening) =>
          opening.id === dragState.openingId
            ? moveEditorOpeningAlongWall(opening, ownerWall, worldPoint)
            : opening
        );
        redrawCanvas();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (draftWallStartRef.current || draftWallEndRef.current) {
          clearEditorDraft();
          refreshEditorUi();
          redrawCanvas();
        }
        dragStateRef.current = { kind: "idle" };
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedEditorElementRef.current
      ) {
        event.preventDefault();
        deleteSelectedEditorElement();
        redrawCanvas();
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [deleteSelectedEditorElement, editorRevision, editorTool, formValues, scale, solarState]);

  const editorWalls = editorWallsRef.current;
  const editorOpenings = editorOpeningsRef.current;
  const wallSummary = getCanvasSummary(
    formValues,
    editorWalls,
    editorOpenings,
    draftWallStartRef.current
  );
  const sunSummary = getSunSummary(solarState);
  const compassMarker =
    solarState.status === "ready" && solarState.snapshot.altitude > 0
      ? getCompassMarkerPosition(solarState.snapshot.azimuth)
      : null;
  const canvasCursorClass =
    editorTool === "pan"
      ? "cursor-grab active:cursor-grabbing"
      : editorTool === "delete"
        ? "cursor-not-allowed"
        : "cursor-default";

  return (
    <section ref={workspaceRef} className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
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
        <div className="flex h-full w-full flex-1 overflow-hidden border border-sky-100 bg-[#dbeafe]">
          <div className="w-14 border-r border-[#44536a] bg-[#5d6b7d]/97 shadow-lg shadow-slate-900/18 backdrop-blur">
            <div className="flex h-full w-full flex-col items-center gap-1 pt-2">
              {TOOL_OPTIONS.map((tool) => {
                const isActive = editorTool === tool.key;

                return (
                  <button
                    key={tool.key}
                    type="button"
                    aria-label={tool.label}
                    title={tool.label}
                    onClick={() => handleToolbarToolClick(tool.key)}
                    className={`flex h-10 w-10 items-center justify-center border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80 ${
                      isActive
                        ? "border-[#a9c8ff] bg-[#2f6fe4] text-white shadow-sm"
                        : "border-transparent bg-transparent text-[#f8fbff] hover:border-[#8ea2bf]/55 hover:bg-[#7686a0]/28"
                    }`}
                  >
                    <ToolboxIcon tool={tool.key} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative min-w-0 flex-1">
            <canvas
              ref={canvasRef}
              className={`h-full w-full ${canvasCursorClass}`}
            />
            <div className="pointer-events-none absolute right-4 top-6">
              <CompassOverlay marker={compassMarker} />
            </div>
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

function ToolboxIcon({ tool }: { tool: EditorTool }) {
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
        <path
          d="M5 3.5v13l3.9-4 3.1 7 2.2-.9-3.1-7L19 10 5 3.5z"
        />
        <path d="M15.5 4.5h3" />
        <path d="M17 3v3" />
      </svg>
    );
  }

  if (tool === "pan") {
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
        <path
          d="M8.5 10.8V7.2a1.4 1.4 0 012.8 0v2.3"
        />
        <path d="M11.3 9.5V5.8a1.4 1.4 0 112.8 0v3.7" />
        <path d="M14.1 9.5V6.9a1.4 1.4 0 112.8 0v4.7" />
        <path d="M8.5 11.1a1.7 1.7 0 00-2.8 1.9l2.2 3.7A4.4 4.4 0 0011.7 19H17a3 3 0 003-3v-2.2c0-.9-.3-1.8-1-2.4l-2.1-2" />
        <path d="M16.9 11.8V9.2a1.4 1.4 0 112.8 0v4.3" />
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
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.7h6v1.8" />
      <path d="M7.2 6.5l.8 12h8l.8-12" />
      <path d="M10 10.2v4.6" />
      <path d="M14 10.2v4.6" />
    </svg>
  );
}

function buildEditorSketchFromFormValues(formValues: CanvasFormValues) {
  let nextId = 0;
  const visibleWalls = getRawWallInputs(formValues).filter((wall) => wall.length > 0);
  const seededWalls = createChainSegments(visibleWalls).map((segment) => {
    nextId += 1;

    return {
      id: `wall-${nextId}`,
      start: segment.start,
      end: segment.end,
      thickness: segment.thickness,
    };
  });

  const seededOpenings: EditableOpening[] = [];
  const doorsByDirection = new Map(
    getRawDoorInputs(formValues).map((item) => [item.direction, item.width])
  );
  const windowsByDirection = new Map(
    getRawWindowInputs(formValues).map((item) => [item.direction, item.width])
  );

  seededWalls.forEach((ownerWall) => {
    const direction = getEditorWallDirection(ownerWall);
    const wallLength = getEditorWallLength(ownerWall);
    const desiredDoorWidth = doorsByDirection.get(direction) ?? 0;
    const desiredWindowWidth = windowsByDirection.get(direction) ?? 0;
    const featureSpans = resolveWallFeatureSpans(
      wallLength,
      desiredDoorWidth,
      desiredWindowWidth
    );

    if (featureSpans.door) {
      nextId += 1;
      seededOpenings.push({
        id: `opening-${nextId}`,
        wallId: ownerWall.id,
        kind: "door",
        widthMeters: featureSpans.door.widthMeters,
        offsetMeters: featureSpans.door.startMeters,
      });
    }

    if (featureSpans.window) {
      nextId += 1;
      seededOpenings.push({
        id: `opening-${nextId}`,
        wallId: ownerWall.id,
        kind: "window",
        widthMeters: featureSpans.window.widthMeters,
        offsetMeters: featureSpans.window.startMeters,
      });
    }
  });

  return {
    walls: seededWalls,
    openings: seededOpenings,
    lastId: nextId,
  };
}

function getEditorViewport(
  width: number,
  height: number,
  pixelsPerMeter: number,
  offsetX: number,
  offsetY: number
): EditorViewport {
  const drawWidth = Math.max(width - LEFT_RULER_SIZE, 1);
  const drawHeight = Math.max(height - RULER_SIZE, 1);

  return {
    x: LEFT_RULER_SIZE,
    y: RULER_SIZE,
    width: drawWidth,
    height: drawHeight,
    centerX: LEFT_RULER_SIZE + drawWidth / 2 + offsetX,
    centerY: RULER_SIZE + drawHeight / 2 + offsetY,
    pixelsPerMeter,
  };
}

function isPointInsideViewport(point: Point, viewport: EditorViewport) {
  return (
    point.x >= viewport.x &&
    point.x <= viewport.x + viewport.width &&
    point.y >= viewport.y &&
    point.y <= viewport.y + viewport.height
  );
}

function worldToEditorScreen(point: Point, viewport: EditorViewport): Point {
  return {
    x: viewport.centerX + point.x * viewport.pixelsPerMeter,
    y: viewport.centerY + point.y * viewport.pixelsPerMeter,
  };
}

function screenToEditorWorld(point: Point, viewport: EditorViewport): Point {
  return {
    x: (point.x - viewport.centerX) / viewport.pixelsPerMeter,
    y: (point.y - viewport.centerY) / viewport.pixelsPerMeter,
  };
}

function getEditorSnapStep(gridMetrics: GridMetrics) {
  return gridMetrics.gridStepMeters / EDITOR_SNAP_DIVISIONS;
}

function snapEditorPoint(point: Point, step: number): Point {
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  };
}

function lockEditorWallPoint(start: Point, end: Point): Point {
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    return { x: end.x, y: start.y };
  }

  return { x: start.x, y: end.y };
}

function moveEditorWall(wall: EditableWall, delta: Point): EditableWall {
  return {
    ...wall,
    start: addPoints(wall.start, delta),
    end: addPoints(wall.end, delta),
  };
}

function getEditorWallLength(wall: EditableWall) {
  return getDistance(wall.start, wall.end);
}

function getEditorWallDirection(wall: EditableWall): WallDirection {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "North" : "South";
  }

  return dy >= 0 ? "East" : "West";
}

function getEditorOpeningOffsetBounds(
  wallLength: number,
  openingWidth: number
) {
  const centeredStart = Math.max((wallLength - openingWidth) / 2, 0);
  const maxStart = wallLength - openingWidth - EDITOR_OPENING_EDGE_INSET;

  if (maxStart <= EDITOR_OPENING_EDGE_INSET) {
    return {
      min: centeredStart,
      max: centeredStart,
    };
  }

  return {
    min: EDITOR_OPENING_EDGE_INSET,
    max: maxStart,
  };
}

function getProjectedDistanceOnWall(point: Point, wall: EditableWall) {
  const vector = {
    x: wall.end.x - wall.start.x,
    y: wall.end.y - wall.start.y,
  };
  const wallLength = getDistance(wall.start, wall.end);

  if (wallLength <= 0.0001) {
    return 0;
  }

  return clampNumber(
    ((point.x - wall.start.x) * vector.x + (point.y - wall.start.y) * vector.y) /
      wallLength,
    0,
    wallLength
  );
}

function createEditorOpening(
  tool: Extract<EditorTool, "window" | "door">,
  wall: EditableWall,
  worldPoint: Point
): Omit<EditableOpening, "id"> | null {
  const wallLength = getEditorWallLength(wall);
  const defaultWidth =
    tool === "window" ? EDITOR_DEFAULT_WINDOW_WIDTH : EDITOR_DEFAULT_DOOR_WIDTH;
  const maxWidth = Math.max(wallLength - EDITOR_OPENING_EDGE_INSET * 2, 0);
  const widthMeters = Math.min(defaultWidth, maxWidth);

  if (wallLength <= 0.25 || widthMeters <= 0.2) {
    return null;
  }

  const projectedDistance = getProjectedDistanceOnWall(worldPoint, wall);
  const bounds = getEditorOpeningOffsetBounds(wallLength, widthMeters);

  return {
    wallId: wall.id,
    kind: tool,
    offsetMeters: clampNumber(
      projectedDistance - widthMeters / 2,
      bounds.min,
      bounds.max
    ),
    widthMeters,
  };
}

function moveEditorOpeningAlongWall(
  opening: EditableOpening,
  wall: EditableWall,
  worldPoint: Point
): EditableOpening {
  const wallLength = getEditorWallLength(wall);
  const bounds = getEditorOpeningOffsetBounds(wallLength, opening.widthMeters);
  const projectedDistance = getProjectedDistanceOnWall(worldPoint, wall);

  return {
    ...opening,
    offsetMeters: clampNumber(
      projectedDistance - opening.widthMeters / 2,
      bounds.min,
      bounds.max
    ),
  };
}

function getEditorOpeningGeometry(
  wall: EditableWall,
  opening: EditableOpening,
  viewport: EditorViewport
) {
  const wallStart = worldToEditorScreen(wall.start, viewport);
  const wallEnd = worldToEditorScreen(wall.end, viewport);
  const alongWall = normalizeVector({
    x: wallEnd.x - wallStart.x,
    y: wallEnd.y - wallStart.y,
  });
  const wallThicknessPx = Math.max(wall.thickness * viewport.pixelsPerMeter, 8);
  const halfThickness = wallThicknessPx / 2;
  const normal = {
    x: -alongWall.y,
    y: alongWall.x,
  };
  const openingStart = addPoints(
    wallStart,
    scalePoint(alongWall, opening.offsetMeters * viewport.pixelsPerMeter)
  );
  const openingEnd = addPoints(
    openingStart,
    scalePoint(alongWall, opening.widthMeters * viewport.pixelsPerMeter)
  );
  const polygon = [
    addPoints(openingStart, scalePoint(normal, halfThickness)),
    addPoints(openingEnd, scalePoint(normal, halfThickness)),
    addPoints(openingEnd, scalePoint(normal, -halfThickness)),
    addPoints(openingStart, scalePoint(normal, -halfThickness)),
  ];

  return {
    alongWall,
    normal,
    wallThicknessPx,
    halfThickness,
    openingStart,
    openingEnd,
    polygon,
  };
}

function drawEditorPlan(
  context: CanvasRenderingContext2D,
  viewport: EditorViewport,
  walls: EditableWall[],
  openings: EditableOpening[],
  selectedElement: SelectedEditorElement,
  draftWallStart: Point | null,
  draftWallEnd: Point | null
) {
  const origin = worldToEditorScreen({ x: 0, y: 0 }, viewport);

  context.save();

  context.strokeStyle = "rgba(59, 130, 246, 0.18)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(origin.x - 10, origin.y);
  context.lineTo(origin.x + 10, origin.y);
  context.moveTo(origin.x, origin.y - 10);
  context.lineTo(origin.x, origin.y + 10);
  context.stroke();

  const openingsByWall = new Map<string, EditableOpening[]>();
  openings.forEach((opening) => {
    const items = openingsByWall.get(opening.wallId) ?? [];
    items.push(opening);
    openingsByWall.set(opening.wallId, items);
  });

  walls.forEach((wall) => {
    drawEditorWall(
      context,
      wall,
      viewport,
      openingsByWall.get(wall.id) ?? [],
      selectedElement
    );
  });

  if (draftWallStart && draftWallEnd) {
    const start = worldToEditorScreen(draftWallStart, viewport);
    const end = worldToEditorScreen(draftWallEnd, viewport);

    context.strokeStyle = "#0ea5e9";
    context.lineWidth = 3;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#0ea5e9";
    context.beginPath();
    context.arc(start.x, start.y, 5, 0, Math.PI * 2);
    context.fill();

    if (getDistance(draftWallStart, draftWallEnd) >= EDITOR_MIN_WALL_LENGTH) {
      const previewWall: EditableWall = {
        id: "draft",
        start: draftWallStart,
        end: draftWallEnd,
        thickness: DEFAULT_WALL_THICKNESS,
      };

      drawSegmentDimension(
        context,
        getEditorWallDirection(previewWall),
        start,
        end,
        getEditorWallLength(previewWall),
        Math.max(DEFAULT_WALL_THICKNESS * viewport.pixelsPerMeter, 8)
      );
    }
  }

  if (walls.length === 0 && !draftWallStart) {
    context.fillStyle = "#475569";
    context.font = "14px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      "Choose Wall and click two points on the grid to start sketching.",
      viewport.x + viewport.width / 2,
      viewport.y + viewport.height / 2
    );
  }

  context.restore();
}

function drawEditorWall(
  context: CanvasRenderingContext2D,
  wall: EditableWall,
  viewport: EditorViewport,
  openings: EditableOpening[],
  selectedElement: SelectedEditorElement
) {
  const start = worldToEditorScreen(wall.start, viewport);
  const end = worldToEditorScreen(wall.end, viewport);
  const alongWall = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y,
  });
  const normal = {
    x: -alongWall.y,
    y: alongWall.x,
  };
  const wallThicknessPx = Math.max(wall.thickness * viewport.pixelsPerMeter, 8);
  const halfThickness = wallThicknessPx / 2;
  const corners = [
    addPoints(start, scalePoint(normal, halfThickness)),
    addPoints(end, scalePoint(normal, halfThickness)),
    addPoints(end, scalePoint(normal, -halfThickness)),
    addPoints(start, scalePoint(normal, -halfThickness)),
  ];
  const isSelected =
    selectedElement?.kind === "wall" && selectedElement.id === wall.id;

  context.save();
  context.lineJoin = "round";

  if (isSelected) {
    context.beginPath();
    addClosedPath(context, corners);
    context.strokeStyle = "rgba(14, 165, 233, 0.85)";
    context.lineWidth = wallThicknessPx + 2.5;
    context.stroke();
  }

  context.beginPath();
  addClosedPath(context, corners);
  context.fillStyle = "#0f172b";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.14)";
  context.lineWidth = 1;
  context.stroke();

  openings.forEach((opening) => {
    drawEditorOpening(
      context,
      wall,
      opening,
      viewport,
      selectedElement?.kind === "opening" && selectedElement.id === opening.id
    );
  });

  drawSegmentDimension(
    context,
    getEditorWallDirection(wall),
    start,
    end,
    getEditorWallLength(wall),
    wallThicknessPx
  );

  if (isSelected) {
    [start, end].forEach((point) => {
      context.fillStyle = "#ffffff";
      context.strokeStyle = "#0ea5e9";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
  }

  context.restore();
}

function drawEditorOpening(
  context: CanvasRenderingContext2D,
  wall: EditableWall,
  opening: EditableOpening,
  viewport: EditorViewport,
  isSelected: boolean
) {
  const geometry = getEditorOpeningGeometry(wall, opening, viewport);
  const { polygon, openingStart, openingEnd, normal, halfThickness, alongWall } =
    geometry;

  context.save();
  context.beginPath();
  addClosedPath(context, polygon);
  context.fillStyle = "#dbeafe";
  context.fill();

  if (opening.kind === "window") {
    const windowLineStart = addPoints(openingStart, scalePoint(normal, 0));
    const windowLineEnd = addPoints(openingEnd, scalePoint(normal, 0));

    context.strokeStyle = "#38bdf8";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(windowLineStart.x, windowLineStart.y);
    context.lineTo(windowLineEnd.x, windowLineEnd.y);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(windowLineStart.x, windowLineStart.y);
    context.lineTo(windowLineEnd.x, windowLineEnd.y);
    context.stroke();
  } else {
    const interiorNormal = normalizeVector(
      getInteriorNormal(getEditorWallDirection(wall))
    );
    const hingePoint = addPoints(
      openingStart,
      scalePoint(interiorNormal, halfThickness)
    );
    const closedPoint = addPoints(
      openingEnd,
      scalePoint(interiorNormal, halfThickness)
    );
    const leafEnd = addPoints(
      hingePoint,
      scalePoint(
        interiorNormal,
        opening.widthMeters * viewport.pixelsPerMeter
      )
    );

    context.strokeStyle = "rgba(51, 65, 85, 0.8)";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(hingePoint.x, hingePoint.y);
    context.lineTo(leafEnd.x, leafEnd.y);
    context.stroke();
    drawDoorSwingArc(context, hingePoint, closedPoint, leafEnd);

    context.strokeStyle = "rgba(15, 23, 42, 0.22)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(openingStart.x, openingStart.y);
    context.lineTo(openingEnd.x, openingEnd.y);
    context.stroke();
  }

  if (isSelected) {
    context.strokeStyle = "#0ea5e9";
    context.lineWidth = 2.5;
    context.beginPath();
    addClosedPath(context, polygon);
    context.stroke();

    const center = addPoints(
      openingStart,
      scalePoint(alongWall, (opening.widthMeters * viewport.pixelsPerMeter) / 2)
    );
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(center.x, center.y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.restore();
}

function findEditorWallHit(
  point: Point,
  viewport: EditorViewport,
  walls: EditableWall[]
): EditorWallHit | null {
  let closestHit: EditorWallHit | null = null;

  walls.forEach((wall) => {
    const start = worldToEditorScreen(wall.start, viewport);
    const end = worldToEditorScreen(wall.end, viewport);
    const wallThicknessPx = Math.max(wall.thickness * viewport.pixelsPerMeter, 8);
    const distance = getDistanceToSegment(point, start, end);
    const threshold = Math.max(wallThicknessPx * 0.75, 10);

    if (distance > threshold) {
      return;
    }

    if (!closestHit || distance < closestHit.distance) {
      closestHit = {
        wall,
        distance,
      };
    }
  });

  return closestHit;
}

function findEditorOpeningHit(
  point: Point,
  viewport: EditorViewport,
  walls: EditableWall[],
  openings: EditableOpening[]
): EditorOpeningHit | null {
  for (let index = openings.length - 1; index >= 0; index -= 1) {
    const opening = openings[index];
    const ownerWall = walls.find((wall) => wall.id === opening.wallId);

    if (!ownerWall) {
      continue;
    }

    const geometry = getEditorOpeningGeometry(ownerWall, opening, viewport);

    if (
      isPointInsidePolygon(point, geometry.polygon) ||
      getPolygonEdgeDistance(point, geometry.polygon) <= 8
    ) {
      return {
        opening,
        wall: ownerWall,
      };
    }
  }

  return null;
}

function getDistanceToSegment(point: Point, start: Point, end: Point) {
  const lengthSquared =
    (end.x - start.x) * (end.x - start.x) +
    (end.y - start.y) * (end.y - start.y);

  if (lengthSquared <= 0.0001) {
    return getDistance(point, start);
  }

  const ratio = clampNumber(
    ((point.x - start.x) * (end.x - start.x) +
      (point.y - start.y) * (end.y - start.y)) /
      lengthSquared,
    0,
    1
  );
  const projectedPoint = {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };

  return getDistance(point, projectedPoint);
}

function isPointInsidePolygon(point: Point, polygon: Point[]) {
  let isInside = false;

  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex++
  ) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          ((previous.y - current.y) || 0.000001) +
          current.x;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function getPolygonEdgeDistance(point: Point, polygon: Point[]) {
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    shortestDistance = Math.min(
      shortestDistance,
      getDistanceToSegment(point, start, end)
    );
  }

  return shortestDistance;
}

function getCanvasSummary(
  formValues: CanvasFormValues,
  editorWalls: EditableWall[],
  editorOpenings: EditableOpening[],
  draftWallStart: Point | null
) {
  if (editorWalls.length === 0 && editorOpenings.length === 0 && !draftWallStart) {
    return getWallSummary(formValues);
  }

  const wallLabel = editorWalls.length === 1 ? "wall" : "walls";
  const openingLabel = editorOpenings.length === 1 ? "opening" : "openings";

  if (draftWallStart) {
    return `Sketching wall | ${editorWalls.length} ${wallLabel} | ${editorOpenings.length} ${openingLabel}`;
  }

  return `Sketch: ${editorWalls.length} ${wallLabel} | ${editorOpenings.length} ${openingLabel}`;
}

function getEditorToolHelp(
  tool: EditorTool,
  hasDraftWall: boolean
) {
  if (tool === "wall") {
    return hasDraftWall
      ? "Click again to finish the wall. Press Esc to cancel the draft."
      : "Click two points on the grid to draw an orthogonal wall.";
  }

  if (tool === "window") {
    return "Click a sketched wall to place a window.";
  }

  if (tool === "door") {
    return "Click a sketched wall to place a door.";
  }

  if (tool === "delete") {
    return "Click any wall, window, or door to remove it.";
  }

  return "Click to select. Drag a selected item to move it, or drag empty space to pan.";
}

function getSelectedEditorElementLabel(
  selectedElement: SelectedEditorElement,
  walls: EditableWall[],
  openings: EditableOpening[]
) {
  if (!selectedElement) {
    return "Nothing selected";
  }

  if (selectedElement.kind === "wall") {
    const wallIndex = walls.findIndex((wall) => wall.id === selectedElement.id);

    return wallIndex >= 0 ? `Wall ${wallIndex + 1}` : "Wall";
  }

  const opening = openings.find(
    (item) => item.id === selectedElement.id
  );

  if (!opening) {
    return "Opening";
  }

  return opening.kind === "door" ? "Door" : "Window";
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
      thickness: parseWallThicknessMeters(formValues.wallNorthWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      direction: "East",
      length: parsePositiveNumber(formValues.wallEastLength),
      thickness: parseWallThicknessMeters(formValues.wallEastWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      direction: "South",
      length: parsePositiveNumber(formValues.wallSouthLength),
      thickness: parseWallThicknessMeters(formValues.wallSouthWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      direction: "West",
      length: parsePositiveNumber(formValues.wallWestLength),
      thickness: parseWallThicknessMeters(formValues.wallWestWidth, DEFAULT_WALL_THICKNESS),
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

function getWallTypeFieldName(direction: WallDirection) {
  return `wall${direction}Type`;
}

function getWallLengthFieldName(direction: WallDirection) {
  return `wall${direction}Length`;
}

function getWallWidthFieldName(direction: WallDirection) {
  return `wall${direction}Width`;
}

function getDoorLengthFieldName(direction: WallDirection) {
  return `door${direction}Length`;
}

function getDoorWidthFieldName(direction: WallDirection) {
  return `door${direction}Width`;
}

function getDoorHeightFieldName(direction: WallDirection) {
  return `door${direction}Height`;
}

function getWindowLengthFieldName(direction: WallDirection) {
  return `window${direction}Length`;
}

function getWindowWidthFieldName(direction: WallDirection) {
  return `window${direction}Width`;
}

function getWindowHeightFieldName(direction: WallDirection) {
  return `window${direction}Height`;
}

function getWallAppearanceForDirection(direction: WallDirection, formValues: CanvasFormValues) {
  const wallType = formValues[getWallTypeFieldName(direction)] ?? "Brick Wall";
  return getWallAppearanceByType(wallType);
}

function getWallPattern(context: CanvasRenderingContext2D, kind: WallPatternKind) {
  const cachedPattern = wallPatternCache[kind];

  if (cachedPattern !== undefined) {
    return cachedPattern;
  }

  if (typeof document === "undefined") {
    wallPatternCache[kind] = null;
    return null;
  }

  const tileSize = kind === "concrete" ? 28 : 36;
  const tile = document.createElement("canvas");
  tile.width = tileSize;
  tile.height = tileSize;
  const tileContext = tile.getContext("2d");

  if (!tileContext) {
    wallPatternCache[kind] = null;
    return null;
  }

  tileContext.clearRect(0, 0, tileSize, tileSize);

  if (kind === "brick") {
    tileContext.fillStyle = "rgb(179, 74, 52)";
    tileContext.fillRect(0, 0, tileSize, tileSize);
    tileContext.strokeStyle = "rgb(255, 241, 236)";
    tileContext.lineWidth = 1;
    const rowHeight = tileSize / 4;
    const brickWidth = tileSize / 2;

    for (let row = 0; row < 4; row += 1) {
      const y = row * rowHeight;
      tileContext.beginPath();
      tileContext.moveTo(0, y);
      tileContext.lineTo(tileSize, y);
      tileContext.stroke();

      const offset = row % 2 === 0 ? 0 : brickWidth / 2;
      for (let column = 0; column <= 2; column += 1) {
        const x = column * brickWidth - offset;
        if (x > 0 && x < tileSize) {
          tileContext.beginPath();
          tileContext.moveTo(x, y);
          tileContext.lineTo(x, y + rowHeight);
          tileContext.stroke();
        }
      }
    }
  } else if (kind === "block") {
    tileContext.fillStyle = "rgb(204, 209, 215)";
    tileContext.fillRect(0, 0, tileSize, tileSize);
    tileContext.strokeStyle = "rgb(110, 119, 128)";
    tileContext.lineWidth = 1;
    const blockSize = tileSize / 3;

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const x = column * blockSize;
        const y = row * blockSize;
        tileContext.strokeRect(x + 0.5, y + 0.5, blockSize - 1, blockSize - 1);
      }
    }

    tileContext.strokeStyle = "rgba(255, 255, 255, 0.18)";
    tileContext.beginPath();
    tileContext.moveTo(blockSize, 0);
    tileContext.lineTo(blockSize, tileSize);
    tileContext.moveTo(0, blockSize);
    tileContext.lineTo(tileSize, blockSize);
    tileContext.moveTo(blockSize * 2, 0);
    tileContext.lineTo(blockSize * 2, tileSize);
    tileContext.moveTo(0, blockSize * 2);
    tileContext.lineTo(tileSize, blockSize * 2);
    tileContext.stroke();
  } else {
    tileContext.fillStyle = "rgb(169, 175, 181)";
    tileContext.fillRect(0, 0, tileSize, tileSize);

    for (let index = 0; index < 20; index += 1) {
      const dotX = (index * 11 + 7) % tileSize;
      const dotY = (index * 17 + 11) % tileSize;
      const dotRadius = 0.55 + (index % 5) * 0.14;
      tileContext.fillStyle = index % 3 === 0 ? "rgb(96, 104, 112)" : "rgb(255, 255, 255)";
      tileContext.beginPath();
      tileContext.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      tileContext.fill();
    }

    tileContext.strokeStyle = "rgb(255, 255, 255)";
    tileContext.lineWidth = 0.9;
    tileContext.beginPath();
    tileContext.moveTo(0, tileSize * 0.18);
    tileContext.lineTo(tileSize, tileSize * 0.82);
    tileContext.stroke();
  }

  const pattern = context.createPattern(tile, "repeat");
  wallPatternCache[kind] = pattern;
  return pattern;
}

function drawWallTypeSurface(
  context: CanvasRenderingContext2D,
  segment: WallSegment,
  start: Point,
  end: Point,
  pixelsPerMeter: number,
  appearance: WallAppearance
) {
  const exteriorNormal = normalizeVector(getExteriorNormal(segment.direction));
  const wallThicknessPx = Math.max(segment.thickness * pixelsPerMeter, 8);
  const outerStart = addPoints(start, scalePoint(exteriorNormal, wallThicknessPx));
  const outerEnd = addPoints(end, scalePoint(exteriorNormal, wallThicknessPx));
  const wallPolygon = [start, end, outerEnd, outerStart];

  context.save();
  context.beginPath();
  addClosedPath(context, wallPolygon);
  context.fillStyle = appearance.fill;
  context.fill();

  const pattern = getWallPattern(context, appearance.patternKind);
  if (pattern) {
    context.save();
    context.globalAlpha = 1;
    context.fillStyle = pattern;
    context.fill();
    context.restore();
  }

  context.strokeStyle = appearance.stroke;
  context.lineWidth = 1.1;
  context.stroke();
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

function parseWallThicknessMeters(value: string | undefined, fallback = 0) {
  const parsed = parsePositiveNumber(value, fallback);

  if (parsed > 20) {
    return parsed / 1000;
  }

  return parsed;
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
