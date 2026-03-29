"use client";

import { useEffect, useRef, useState } from "react";

const RULER_SIZE = 24;
const LEFT_RULER_SIZE = 32;
const BASE_GRID_SIZE = 40;
const DEFAULT_WALL_THICKNESS = 0.2;
const DIMENSION_GAP = 12;

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

export function HeatLoadCanvasPanel({
  formValues,
}: {
  formValues: CanvasFormValues;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);

  const offsetRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

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
      gridSize: number,
      offsetX: number,
      offsetY: number
    ) {
      context.fillStyle = "#f8fafc";
      context.fillRect(0, 0, width, RULER_SIZE);
      context.fillRect(0, 0, LEFT_RULER_SIZE, height);

      context.strokeStyle = "#cbd5e1";
      context.lineWidth = 1;

      context.beginPath();
      context.moveTo(0, RULER_SIZE);
      context.lineTo(width, RULER_SIZE);
      context.stroke();

      context.beginPath();
      context.moveTo(LEFT_RULER_SIZE, 0);
      context.lineTo(LEFT_RULER_SIZE, height);
      context.stroke();

      context.fillStyle = "#334155";
      context.font = "10px sans-serif";
      context.textBaseline = "middle";

      const subStep = gridSize / 4;

      let indexX = Math.floor(-offsetX / subStep);

      for (let x = LEFT_RULER_SIZE + (offsetX % subStep); x < width; x += subStep) {
        const mod = indexX % 4;

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
          const value = Math.floor(indexX / 4);
          context.fillText(value.toString(), x + 2, 10);
        }

        indexX++;
      }

      let indexY = Math.floor(-offsetY / subStep);

      for (let y = RULER_SIZE + (offsetY % subStep); y < height; y += subStep) {
        const mod = indexY % 4;

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
          const value = -Math.floor(indexY / 4);

          context.save();
          context.translate(10, y);
          context.rotate(-Math.PI / 2);
          context.fillText(value.toString(), 0, 0);
          context.restore();
        }

        indexY++;
      }
    }

    function drawGrid(
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      gridSize: number,
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

      context.fillStyle = "#ffffff";
      context.fillRect(drawX, drawY, drawWidth, drawHeight);

      context.strokeStyle = "#e5e7eb";
      context.lineWidth = 1;

      const startX = drawX + (((offsetX % gridSize) + gridSize) % gridSize);
      for (let x = startX; x < width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, drawY);
        context.lineTo(x, height);
        context.stroke();
      }

      const startY = drawY + (((offsetY % gridSize) + gridSize) % gridSize);
      for (let y = startY; y < height; y += gridSize) {
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
      gridSize: number,
      offsetX: number,
      offsetY: number
    ) {
      const drawX = LEFT_RULER_SIZE;
      const drawY = RULER_SIZE;
      const drawWidth = width - LEFT_RULER_SIZE;
      const drawHeight = height - RULER_SIZE;
      const wallChainResult = buildWallChains(formValues);
      const visibleSegments = wallChainResult.chains.flatMap((chain) => chain.segments);
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

      const originX = drawX + (drawWidth - planWidth * gridSize) / 2 - bounds.minX * gridSize + offsetX;
      const originY = drawY + (drawHeight - planHeight * gridSize) / 2 - bounds.minY * gridSize + offsetY;
      laidOutChains.items.forEach((item) => {
        if (item.geometry.closed) {
          const translatedOuter = item.geometry.outerPoints.map((point) =>
            translatePoint(addPoints(point, item.offset), originX, originY, gridSize)
          );
          const translatedInner = item.geometry.innerPoints.map((point) =>
            translatePoint(addPoints(point, item.offset), originX, originY, gridSize)
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
            translatePoint(addPoints(point, item.offset), originX, originY, gridSize)
          );

          context.beginPath();
          addClosedPath(context, translatedPolygon);
          context.fillStyle = "#0f172b";
          context.fill();
        }

        item.chain.segments.forEach((segment) => {
          const start = translatePoint(addPoints(segment.start, item.offset), originX, originY, gridSize);
          const end = translatePoint(addPoints(segment.end, item.offset), originX, originY, gridSize);

          drawSegmentDimension(
            context,
            segment.direction,
            start,
            end,
            segment.length,
            segment.thickness * gridSize,
          );
        });

        if (wallChainResult.hasFullLoopInput && !item.chain.closed) {
          const lastSegment = item.chain.segments[item.chain.segments.length - 1];
          const firstSegment = item.chain.segments[0];

          const lastPoint = translatePoint(addPoints(lastSegment.end, item.offset), originX, originY, gridSize);
          const firstPoint = translatePoint(addPoints(firstSegment.start, item.offset), originX, originY, gridSize);

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

      context.restore();
    }

    function draw(canvasElement: HTMLCanvasElement, context: CanvasRenderingContext2D) {
      const width = canvasElement.width;
      const height = canvasElement.height;
      const gridSize = BASE_GRID_SIZE * scale;

      context.clearRect(0, 0, width, height);

      drawGrid(
        context,
        width,
        height,
        gridSize,
        offsetRef.current.x,
        offsetRef.current.y
      );

      drawWallPlan(
        context,
        width,
        height,
        gridSize,
        offsetRef.current.x,
        offsetRef.current.y
      );

      drawRulers(
        context,
        width,
        height,
        gridSize,
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
  }, [formValues, scale]);

  const wallSummary = getWallSummary(formValues);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-white">
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
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="relative flex h-full w-full flex-1 overflow-hidden border border-rose-100 bg-white">
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
          />
          <div className="pointer-events-none absolute right-4 top-6">
            <svg
              aria-hidden="true"
              viewBox="0 0 72 72"
              className="h-16 w-16"
            >
              <circle cx="36" cy="36" r="21" fill="white" fillOpacity="0.9" stroke="#fda4af" strokeWidth="1.5" />
              <path d="M36 16 L31 31 L36 28 L41 31 Z" fill="#be123c" />
              <path d="M36 56 L31 41 L36 44 L41 41 Z" fill="#94a3b8" />
              <path d="M56 36 L41 31 L44 36 L41 41 Z" fill="#94a3b8" />
              <path d="M16 36 L31 31 L28 36 L31 41 Z" fill="#94a3b8" />
              <circle cx="36" cy="36" r="3.2" fill="#0f172b" />
              <text x="36" y="10" textAnchor="middle" fontSize="9" fontWeight="700" fill="#be123c">N</text>
              <text x="62" y="39" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">E</text>
              <text x="36" y="67" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">S</text>
              <text x="10" y="39" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">W</text>
            </svg>
          </div>
        </div>
      </div>

      <div className="border-t border-rose-100 bg-[#fffafb] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>Mode: Plan View</span>
          <span>Zoom: {Math.round(scale * 100)}%</span>
          <span>{wallSummary}</span>
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

function getWallSummary(formValues: CanvasFormValues) {
  const visibleSegments = getRawWallInputs(formValues).filter((wall) => wall.length > 0);

  if (visibleSegments.length === 0) {
    return "No walls drawn yet";
  }

  return `Walls: ${visibleSegments.map((segment) => `${formatValue(segment.length)}m`).join(" | ")}`;
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
