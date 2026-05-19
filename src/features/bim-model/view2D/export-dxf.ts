import type { RoomData } from "@/types";

const DEFAULT_WALL_THICKNESS = 0.2;

type CanvasFormValues = Record<string, string>;
type CanvasRoom = Pick<RoomData, "id" | "name" | "formValues" | "placement">;
type Point = { x: number; y: number };
type WallSlot = "North" | "East" | "South" | "West";
type WallDirection =
  | "North"
  | "Northeast"
  | "East"
  | "Southeast"
  | "South"
  | "Southwest"
  | "West"
  | "Northwest";
type RawWallInput = {
  slot: WallSlot;
  direction: WallDirection;
  length: number;
  thickness: number;
};
type DoorInput = {
  slot: WallSlot;
  direction: WallDirection;
  width: number;
};
type WindowInput = {
  slot: WallSlot;
  direction: WallDirection;
  width: number;
};
type EditableWall = {
  id: string;
  slot: WallSlot;
  direction: WallDirection;
  start: Point;
  end: Point;
  thickness: number;
};
type EditableOpening = {
  id: string;
  wallId: string;
  kind: "window" | "door";
  offsetMeters: number;
  widthMeters: number;
};
type OffsetLine = {
  start: Point;
  end: Point;
};
type ExportWallGeometry = {
  wallId: string;
  start: Point;
  end: Point;
  outerStart: Point;
  outerEnd: Point;
  connectStart: boolean;
  connectEnd: boolean;
};
type WallFeatureSpan = {
  startMeters: number;
  widthMeters: number;
};

const WALL_DIRECTIONS: WallDirection[] = [
  "North",
  "Northeast",
  "East",
  "Southeast",
  "South",
  "Southwest",
  "West",
  "Northwest",
];

const WALL_EXTERIOR_NORMALS: Record<WallDirection, Point> = {
  North: { x: 0, y: -1 },
  Northeast: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  East: { x: 1, y: 0 },
  Southeast: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  South: { x: 0, y: 1 },
  Southwest: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  West: { x: -1, y: 0 },
  Northwest: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
};

type DxfEntityBuilder = {
  addLine: (layer: string, start: Point, end: Point) => void;
  addPolyline: (layer: string, points: Point[], closed?: boolean) => void;
  addText: (layer: string, point: Point, text: string, height?: number) => void;
  addArc: (layer: string, center: Point, radius: number, start: Point, end: Point) => void;
};

export function buildRoomsDxf(
  rooms: CanvasRoom[],
  options?: { projectName?: string }
) {
  const layers = new Set([
    "0",
    "WALLS",
    "WALL_CENTER",
    "ROOM_PATH",
    "DOORS",
    "WINDOWS",
    "LABELS",
  ]);
  const entities: string[] = [];
  const addEntity: DxfEntityBuilder = {
    addLine(layer, start, end) {
      layers.add(layer);
      entities.push(buildLineEntity(layer, start, end));
    },
    addPolyline(layer, points, closed = false) {
      if (points.length < 2) {
        return;
      }

      layers.add(layer);
      entities.push(buildPolylineEntity(layer, points, closed));
    },
    addText(layer, point, text, height = 0.25) {
      const safeText = sanitizeDxfText(text);

      if (!safeText) {
        return;
      }

      layers.add(layer);
      entities.push(buildTextEntity(layer, point, safeText, height));
    },
    addArc(layer, center, radius, start, end) {
      layers.add(layer);
      entities.push(buildArcEntity(layer, center, radius, start, end));
    },
  };

  rooms.forEach((room) => {
    const roomOffset = {
      x: room.placement?.x ?? 0,
      y: room.placement?.y ?? 0,
    };
    const sketch = buildEditorSketchFromFormValues(room.formValues);
    const wallGeometryById = new Map(
      buildExportWallGeometry(sketch.walls, roomOffset).map((geometry) => [geometry.wallId, geometry])
    );
    const wallPoints: Point[] = [];

    sketch.walls.forEach((wall) => {
      const geometry = wallGeometryById.get(wall.id);
      if (!geometry) {
        return;
      }

      const wallOpenings = sketch.openings
        .filter((item) => item.wallId === wall.id)
        .sort((first, second) => first.offsetMeters - second.offsetMeters);

      wallPoints.push(geometry.start, geometry.end, geometry.outerStart, geometry.outerEnd);
      addWallWithOpenings(addEntity, wall, geometry, wallOpenings);
      addEntity.addLine("WALL_CENTER", geometry.start, geometry.end);
    });

    const roomPath = getRoomPath(sketch.walls, roomOffset);
    if (roomPath.points.length >= 2) {
      addEntity.addPolyline("ROOM_PATH", roomPath.points, roomPath.closed);
    }

    const labelPoint = getRoomLabelPoint(wallPoints, roomOffset);
    addEntity.addText("LABELS", labelPoint, room.name || room.id, 0.28);
  });

  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1009",
    "9",
    "$INSUNITS",
    "70",
    "6",
    "9",
    "$MEASUREMENT",
    "70",
    "1",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "TABLES",
    buildLinetypeTable(),
    buildLayerTable([...layers]),
    buildStyleTable(),
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    entities.join("\n"),
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ].join("\n");
}

export function downloadRoomsDxf(
  rooms: CanvasRoom[],
  options?: { projectName?: string; fileName?: string }
) {
  const dxf = buildRoomsDxf(rooms, { projectName: options?.projectName });
  const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeFileName(
    options?.fileName ||
      `${sanitizeFileName(options?.projectName || "hlc-bim-project")}.dxf`
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildLayerTable(layers: string[]) {
  const entries = layers
    .sort((first, second) => first.localeCompare(second))
    .map((layer) =>
      [
        "0",
        "LAYER",
        "2",
        layer,
        "70",
        "0",
        "62",
        "7",
        "6",
        "CONTINUOUS",
      ].join("\n")
    )
    .join("\n");

  return [
    "0",
    "TABLE",
    "2",
    "LAYER",
    "70",
    String(layers.length),
    entries,
    "0",
    "ENDTAB",
  ].join("\n");
}

function buildLinetypeTable() {
  return [
    "0",
    "TABLE",
    "2",
    "LTYPE",
    "70",
    "1",
    "0",
    "LTYPE",
    "2",
    "CONTINUOUS",
    "70",
    "0",
    "3",
    "Solid line",
    "72",
    "65",
    "73",
    "0",
    "40",
    "0.0",
    "0",
    "ENDTAB",
  ].join("\n");
}

function buildStyleTable() {
  return [
    "0",
    "TABLE",
    "2",
    "STYLE",
    "70",
    "1",
    "0",
    "STYLE",
    "2",
    "STANDARD",
    "70",
    "0",
    "40",
    "0",
    "41",
    "1",
    "50",
    "0",
    "71",
    "0",
    "42",
    "0.2",
    "3",
    "txt",
    "4",
    "",
    "0",
    "ENDTAB",
  ].join("\n");
}

function buildLineEntity(layer: string, start: Point, end: Point) {
  const first = toDxfPoint(start);
  const second = toDxfPoint(end);

  return [
    "0",
    "LINE",
    "8",
    layer,
    "10",
    formatDxfNumber(first.x),
    "20",
    formatDxfNumber(first.y),
    "30",
    "0.0",
    "11",
    formatDxfNumber(second.x),
    "21",
    formatDxfNumber(second.y),
    "31",
    "0.0",
  ].join("\n");
}

function buildPolylineEntity(layer: string, points: Point[], closed: boolean) {
  const uniquePoints = closed ? removeClosingPoint(points) : points;
  const dxfPoints = uniquePoints.map(toDxfPoint);
  const values = [
    "0",
    "POLYLINE",
    "8",
    layer,
    "10",
    "0.0",
    "20",
    "0.0",
    "30",
    "0.0",
    "66",
    "1",
    "70",
    closed ? "1" : "0",
  ];

  dxfPoints.forEach((point) => {
    values.push(
      "0",
      "VERTEX",
      "8",
      layer,
      "10",
      formatDxfNumber(point.x),
      "20",
      formatDxfNumber(point.y),
      "30",
      "0.0"
    );
  });

  values.push("0", "SEQEND");
  return values.join("\n");
}

function buildTextEntity(
  layer: string,
  point: Point,
  text: string,
  height: number
) {
  const dxfPoint = toDxfPoint(point);

  return [
    "0",
    "TEXT",
    "8",
    layer,
    "10",
    formatDxfNumber(dxfPoint.x),
    "20",
    formatDxfNumber(dxfPoint.y),
    "30",
    "0.0",
    "40",
    formatDxfNumber(height),
    "1",
    text,
    "7",
    "STANDARD",
  ].join("\n");
}

function buildArcEntity(
  layer: string,
  center: Point,
  radius: number,
  start: Point,
  end: Point
) {
  const points = buildDoorSwingArcPoints(center, start, end, radius);
  return buildPolylineEntity(layer, points, false);
}

function buildEditorSketchFromFormValues(formValues: CanvasFormValues) {
  let nextId = 0;
  const visibleWalls = getRawWallInputs(formValues).filter((wall) => wall.length > 0);
  const walls = createChainSegments(visibleWalls).map((segment) => {
    nextId += 1;

    return {
      id: `wall-${nextId}`,
      slot: segment.slot,
      direction: segment.direction,
      start: segment.start,
      end: segment.end,
      thickness: segment.thickness,
    } satisfies EditableWall;
  });

  const openings: EditableOpening[] = [];
  const doorsBySlot = new Map(getRawDoorInputs(formValues).map((item) => [item.slot, item.width]));
  const windowsBySlot = new Map(
    getRawWindowInputs(formValues).map((item) => [item.slot, item.width])
  );

  walls.forEach((ownerWall) => {
    const wallLength = getDistance(ownerWall.start, ownerWall.end);
    const desiredDoorWidth = doorsBySlot.get(ownerWall.slot) ?? 0;
    const desiredWindowWidth = windowsBySlot.get(ownerWall.slot) ?? 0;
    const featureSpans = resolveWallFeatureSpans(
      wallLength,
      desiredDoorWidth,
      desiredWindowWidth
    );

    if (featureSpans.door) {
      nextId += 1;
      openings.push({
        id: `opening-${nextId}`,
        wallId: ownerWall.id,
        kind: "door",
        widthMeters: featureSpans.door.widthMeters,
        offsetMeters: featureSpans.door.startMeters,
      });
    }

    if (featureSpans.window) {
      nextId += 1;
      openings.push({
        id: `opening-${nextId}`,
        wallId: ownerWall.id,
        kind: "window",
        widthMeters: featureSpans.window.widthMeters,
        offsetMeters: featureSpans.window.startMeters,
      });
    }
  });

  return { walls, openings };
}

function getRawWallInputs(formValues: CanvasFormValues): RawWallInput[] {
  return [
    {
      slot: "North",
      direction: parseWallDirection(formValues.wallNorthDirection, "North"),
      length: parsePositiveNumber(formValues.wallNorthLength),
      thickness: parseWallThicknessMeters(formValues.wallNorthWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      slot: "East",
      direction: parseWallDirection(formValues.wallEastDirection, "East"),
      length: parsePositiveNumber(formValues.wallEastLength),
      thickness: parseWallThicknessMeters(formValues.wallEastWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      slot: "South",
      direction: parseWallDirection(formValues.wallSouthDirection, "South"),
      length: parsePositiveNumber(formValues.wallSouthLength),
      thickness: parseWallThicknessMeters(formValues.wallSouthWidth, DEFAULT_WALL_THICKNESS),
    },
    {
      slot: "West",
      direction: parseWallDirection(formValues.wallWestDirection, "West"),
      length: parsePositiveNumber(formValues.wallWestLength),
      thickness: parseWallThicknessMeters(formValues.wallWestWidth, DEFAULT_WALL_THICKNESS),
    },
  ];
}

function getRawDoorInputs(formValues: CanvasFormValues): DoorInput[] {
  return [
    {
      slot: "North",
      direction: parseWallDirection(formValues.doorNorthDirection, "North"),
      width: parsePositiveNumber(formValues.doorNorthWidth),
    },
    {
      slot: "East",
      direction: parseWallDirection(formValues.doorEastDirection, "East"),
      width: parsePositiveNumber(formValues.doorEastWidth),
    },
    {
      slot: "South",
      direction: parseWallDirection(formValues.doorSouthDirection, "South"),
      width: parsePositiveNumber(formValues.doorSouthWidth),
    },
    {
      slot: "West",
      direction: parseWallDirection(formValues.doorWestDirection, "West"),
      width: parsePositiveNumber(formValues.doorWestWidth),
    },
  ];
}

function getRawWindowInputs(formValues: CanvasFormValues): WindowInput[] {
  return [
    {
      slot: "North",
      direction: parseWallDirection(formValues.windowNorthDirection, "North"),
      width: parsePositiveNumber(formValues.windowNorthWidth),
    },
    {
      slot: "East",
      direction: parseWallDirection(formValues.windowEastDirection, "East"),
      width: parsePositiveNumber(formValues.windowEastWidth),
    },
    {
      slot: "South",
      direction: parseWallDirection(formValues.windowSouthDirection, "South"),
      width: parsePositiveNumber(formValues.windowSouthWidth),
    },
    {
      slot: "West",
      direction: parseWallDirection(formValues.windowWestDirection, "West"),
      width: parsePositiveNumber(formValues.windowWestWidth),
    },
  ];
}

function createChainSegments(walls: RawWallInput[]) {
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
      slot: wall.slot,
      direction: wall.direction,
      length: wall.length,
      thickness: wall.thickness,
      start,
      end,
    };
  });
}

function getDirectionVector(direction: WallDirection): Point {
  const outwardNormal = getExteriorNormal(direction);
  return {
    x: -outwardNormal.y,
    y: outwardNormal.x,
  };
}

function addWallWithOpenings(
  builder: DxfEntityBuilder,
  wall: EditableWall,
  geometry: ExportWallGeometry,
  openings: EditableOpening[]
) {
  const { start, end, outerStart, outerEnd, connectStart, connectEnd } = geometry;
  const wallLength = getDistance(start, end);

  if (wallLength <= 0.0001) {
    return;
  }

  const alongWall = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y,
  });
  const exteriorNormal = normalizeVector(getExteriorNormal(wall.direction));
  const interiorNormal = scalePoint(exteriorNormal, -1);

  if (connectStart) {
    builder.addLine("WALLS", start, outerStart);
  }

  if (connectEnd) {
    builder.addLine("WALLS", end, outerEnd);
  }

  let currentOffset = 0;

  openings.forEach((opening) => {
    const openingStartOffset = clampNumber(opening.offsetMeters, 0, wallLength);
    const openingEndOffset = clampNumber(
      opening.offsetMeters + opening.widthMeters,
      openingStartOffset,
      wallLength
    );

    if (openingStartOffset > currentOffset + 0.0001) {
      const innerSegmentStart = addPoints(start, scalePoint(alongWall, currentOffset));
      const innerSegmentEnd = addPoints(start, scalePoint(alongWall, openingStartOffset));
      const outerSegmentStart = getPointOnLine(outerStart, outerEnd, currentOffset / wallLength);
      const outerSegmentEnd = getPointOnLine(
        outerStart,
        outerEnd,
        openingStartOffset / wallLength
      );

      builder.addLine("WALLS", innerSegmentStart, innerSegmentEnd);
      builder.addLine("WALLS", outerSegmentStart, outerSegmentEnd);
    }

    const openingStart = addPoints(start, scalePoint(alongWall, openingStartOffset));
    const openingEnd = addPoints(start, scalePoint(alongWall, openingEndOffset));
    const openingOuterStart = getPointOnLine(
      outerStart,
      outerEnd,
      openingStartOffset / wallLength
    );
    const openingOuterEnd = getPointOnLine(
      outerStart,
      outerEnd,
      openingEndOffset / wallLength
    );

    builder.addLine("WALLS", openingStart, openingOuterStart);
    builder.addLine("WALLS", openingEnd, openingOuterEnd);

    if (opening.kind === "door") {
      const hingePoint = openingStart;
      const leafEnd = addPoints(
        hingePoint,
        scalePoint(interiorNormal, opening.widthMeters)
      );
      builder.addLine("DOORS", hingePoint, leafEnd);
      builder.addArc("DOORS", hingePoint, opening.widthMeters, openingEnd, leafEnd);
    } else {
      const windowCenterOffset = wall.thickness * 0.52;
      const lineStart = addPoints(
        openingStart,
        scalePoint(exteriorNormal, windowCenterOffset)
      );
      const lineEnd = addPoints(
        openingEnd,
        scalePoint(exteriorNormal, windowCenterOffset)
      );
      builder.addLine("WINDOWS", lineStart, lineEnd);
    }

    currentOffset = Math.max(currentOffset, openingEndOffset);
  });

  if (currentOffset < wallLength - 0.0001) {
    const innerSegmentStart = addPoints(start, scalePoint(alongWall, currentOffset));
    const outerSegmentStart = getPointOnLine(
      outerStart,
      outerEnd,
      currentOffset / wallLength
    );
    builder.addLine("WALLS", innerSegmentStart, end);
    builder.addLine("WALLS", outerSegmentStart, outerEnd);
  }

  if (openings.length === 0) {
    builder.addLine("WALLS", start, end);
    builder.addLine("WALLS", outerStart, outerEnd);
  }
}

function getRoomPath(walls: EditableWall[], roomOffset: Point) {
  if (walls.length === 0) {
    return { points: [] as Point[], closed: false };
  }

  const points = walls.map((wall) => addPoints(wall.start, roomOffset));
  const finalPoint = addPoints(walls[walls.length - 1].end, roomOffset);
  const closed = getDistance(points[0], finalPoint) <= 0.01;

  if (!closed) {
    points.push(finalPoint);
  }

  return { points, closed };
}

function buildExportWallGeometry(
  walls: EditableWall[],
  roomOffset: Point
): ExportWallGeometry[] {
  const isClosedLoop =
    walls.length > 1 &&
    getDistance(walls[0].start, walls[walls.length - 1].end) <= 0.01;

  return walls.map((wall, index) => {
    const start = addPoints(wall.start, roomOffset);
    const end = addPoints(wall.end, roomOffset);
    const outerLine = getOuterOffsetLine(start, end, wall.direction, wall.thickness);
    const previousWall =
      walls[index - 1] ?? (isClosedLoop ? walls[walls.length - 1] : undefined);
    const nextWall =
      walls[index + 1] ?? (isClosedLoop ? walls[0] : undefined);

    let outerStart = outerLine.start;
    let outerEnd = outerLine.end;

    if (previousWall) {
      const previousLine = getOuterOffsetLine(
        addPoints(previousWall.start, roomOffset),
        addPoints(previousWall.end, roomOffset),
        previousWall.direction,
        previousWall.thickness
      );
      outerStart = getLineIntersection(previousLine, outerLine) ?? outerStart;
    }

    if (nextWall) {
      const nextLine = getOuterOffsetLine(
        addPoints(nextWall.start, roomOffset),
        addPoints(nextWall.end, roomOffset),
        nextWall.direction,
        nextWall.thickness
      );
      outerEnd = getLineIntersection(outerLine, nextLine) ?? outerEnd;
    }

    return {
      wallId: wall.id,
      start,
      end,
      outerStart,
      outerEnd,
      connectStart: !isClosedLoop && index === 0,
      connectEnd: !isClosedLoop && index === walls.length - 1,
    };
  });
}

function getRoomLabelPoint(points: Point[], roomOffset: Point) {
  if (points.length === 0) {
    return roomOffset;
  }

  const bounds = points.reduce(
    (result, point) => ({
      minX: Math.min(result.minX, point.x),
      minY: Math.min(result.minY, point.y),
      maxX: Math.max(result.maxX, point.x),
      maxY: Math.max(result.maxY, point.y),
    }),
    {
      minX: points[0].x,
      minY: points[0].y,
      maxX: points[0].x,
      maxY: points[0].y,
    }
  );

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function resolveWallFeatureSpans(
  segmentLengthMeters: number,
  doorWidthMeters: number,
  windowWidthMeters: number
) {
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

function getExteriorNormal(direction: WallDirection): Point {
  return WALL_EXTERIOR_NORMALS[direction];
}

function getOuterOffsetLine(
  start: Point,
  end: Point,
  direction: WallDirection,
  thickness: number
): OffsetLine {
  const exteriorNormal = normalizeVector(getExteriorNormal(direction));

  return {
    start: addPoints(start, scalePoint(exteriorNormal, thickness)),
    end: addPoints(end, scalePoint(exteriorNormal, thickness)),
  };
}

function parsePositiveNumber(value: string | undefined, fallback = 0) {
  if (!value) {
    return fallback;
  }

  const normalizedValue = Number(value.replace(",", "."));
  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return fallback;
  }

  return normalizedValue;
}

function parseWallDirection(
  value: string | undefined,
  fallback: WallDirection
): WallDirection {
  if (!value) {
    return fallback;
  }

  return WALL_DIRECTIONS.includes(value as WallDirection)
    ? (value as WallDirection)
    : fallback;
}

function parseWallThicknessMeters(value: string | undefined, fallback = 0) {
  const parsed = parsePositiveNumber(value, fallback);
  return parsed > 20 ? parsed / 1000 : parsed;
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
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.000001) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function getDistance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getAngleDegreesBetweenPoints(origin: Point, target: Point) {
  const degrees = (Math.atan2(target.y - origin.y, target.x - origin.x) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildDoorSwingArcPoints(
  hingePoint: Point,
  closedPoint: Point,
  openPoint: Point,
  radius: number
) {
  if (radius <= 0.0001) {
    return [closedPoint, openPoint];
  }

  let startAngle = Math.atan2(
    closedPoint.y - hingePoint.y,
    closedPoint.x - hingePoint.x
  );
  let endAngle = Math.atan2(
    openPoint.y - hingePoint.y,
    openPoint.x - hingePoint.x
  );

  if (endAngle < startAngle && startAngle - endAngle > Math.PI) {
    endAngle += Math.PI * 2;
  } else if (startAngle < endAngle && endAngle - startAngle > Math.PI) {
    startAngle += Math.PI * 2;
  }

  const angleDelta = endAngle - startAngle;
  const stepCount = Math.max(
    12,
    Math.ceil((Math.abs(angleDelta) / (Math.PI / 18)))
  );
  const points: Point[] = [];

  for (let step = 0; step <= stepCount; step += 1) {
    const ratio = step / stepCount;
    const angle = startAngle + angleDelta * ratio;
    points.push({
      x: hingePoint.x + Math.cos(angle) * radius,
      y: hingePoint.y + Math.sin(angle) * radius,
    });
  }

  return points;
}

function removeClosingPoint(points: Point[]) {
  if (points.length <= 1) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return getDistance(first, last) <= 0.0001 ? points.slice(0, -1) : points;
}

function toDxfPoint(point: Point) {
  return {
    x: point.x,
    y: -point.y,
  };
}

function formatDxfNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function sanitizeDxfText(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function sanitizeFileName(value: string) {
  const sanitized = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();
  return sanitized.length > 0 ? sanitized : "hlc-bim-project";
}

function getPointOnLine(start: Point, end: Point, ratio: number) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
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
