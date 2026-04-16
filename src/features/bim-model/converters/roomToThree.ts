import * as THREE from "three";
import { getWallAssetByType } from "@/data/assets";
import {
  createWallSurfaceTextureSet,
  type WallSurfaceTextureSet,
} from "../shared/wallSurfaceTextures";

const DEFAULT_HEIGHT_METERS = 3;
const DEFAULT_WALL_THICKNESS_METERS = 0.2;
const DEFAULT_FLOOR_THICKNESS_METERS = 0.08;
const DEFAULT_DOOR_HEIGHT_METERS = 2.1;
const DEFAULT_WINDOW_HEIGHT_METERS = 1.2;
const DEFAULT_WINDOW_SILL_HEIGHT_METERS = 0.9;

export type RoomInputValues = Record<string, string>;

export type WallDirection = "North" | "East" | "South" | "West";

export type RoomDimensions = {
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
};

export type ThreeRoomModel = {
  group: THREE.Group;
  dimensions: RoomDimensions;
};

type WallSpec = {
  direction: WallDirection;
  wallType: string;
  wallThickness: number;
  wallLength: number;
  isVisible: boolean;
};

type WallOpeningKind = "door" | "window";

type WallOpening = {
  kind: WallOpeningKind;
  startMeters: number;
  widthMeters: number;
  bottomMeters: number;
  heightMeters: number;
};

type WallFeatureSpan = {
  startMeters: number;
  widthMeters: number;
};

export function roomToThree(formValues: RoomInputValues): ThreeRoomModel | null {
  const dimensions = getRoomDimensions(formValues);

  if (!dimensions) {
    return null;
  }

  const wallSpecs = buildWallSpecs(formValues, dimensions);
  const visibleWallSpecs = wallSpecs.filter((spec) => spec.isVisible);
  const group = new THREE.Group();
  group.name = "three-room-root";
  group.userData.dimensions = dimensions;

  group.add(createFloorMesh(dimensions, wallSpecs));

  visibleWallSpecs.forEach((spec) => {
    group.add(createWallAssembly(spec, dimensions, formValues));
  });

  group.add(createCornerFillers(visibleWallSpecs, dimensions));

  return { group, dimensions };
}

function buildWallSpecs(formValues: RoomInputValues, dimensions: RoomDimensions): WallSpec[] {
  return (["North", "East", "South", "West"] as WallDirection[]).map((direction) => {
    const wallType = formValues[getWallTypeFieldName(direction)] ?? "Brick Wall";
    const sourceLength = parseLengthMeters(formValues[getWallLengthFieldName(direction)]);

    return {
      direction,
      wallType,
      wallThickness: parseWallThicknessMeters(
        formValues[getWallWidthFieldName(direction)],
        wallType
      ),
      wallLength: getWallLengthForDirection(direction, dimensions),
      isVisible: sourceLength > 0,
    };
  });
}

function createFloorMesh(dimensions: RoomDimensions, wallSpecs: WallSpec[]) {
  const visibleWallThicknesses = wallSpecs
    .filter((spec) => spec.isVisible)
    .map((spec) => spec.wallThickness);
  const maxWallThickness = Math.max(...visibleWallThicknesses, DEFAULT_WALL_THICKNESS_METERS);

  const floorWidth = dimensions.width + maxWallThickness * 2;
  const floorDepth = dimensions.depth + maxWallThickness * 2;
  const floorThickness = DEFAULT_FLOOR_THICKNESS_METERS;

  const geometry = new THREE.BoxGeometry(floorWidth, floorThickness, floorDepth);
  const material = new THREE.MeshStandardMaterial({
    color: "#f8fafc",
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const floor = new THREE.Mesh(geometry, material);
  floor.name = "room-floor";
  floor.position.set(0, -floorThickness / 2, 0);
  floor.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(geometry, 1);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: "#94a3b8",
  });
  const lines = new THREE.LineSegments(edges, lineMaterial);
  lines.name = "room-floor-edges";
  floor.add(lines);

  return floor;
}

function createWallSurfaceMaterial(textureSet: WallSurfaceTextureSet) {
  return new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: textureSet.map,
    normalMap: textureSet.normalMap,
    normalScale: new THREE.Vector2(textureSet.normalScale, textureSet.normalScale),
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

function createWallAssembly(
  spec: WallSpec,
  dimensions: RoomDimensions,
  formValues: RoomInputValues
) {
  const { direction, wallType, wallThickness, wallLength } = spec;
  const openings = buildWallOpenings(direction, wallLength, dimensions.height, formValues);
  const wallShape = createWallShape(wallLength, dimensions.height, openings);
  const wallGeometry = new THREE.ExtrudeGeometry(wallShape, {
    depth: wallThickness,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  wallGeometry.translate(-wallLength / 2, 0, -wallThickness / 2);
  wallGeometry.computeVertexNormals();
  const wallTextures = createWallSurfaceTextureSet({
    wallType,
    wallLength,
    wallHeight: dimensions.height,
  });
  const wallMaterial = createWallSurfaceMaterial(wallTextures);

  const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  wallMesh.name = `wall-${direction.toLowerCase()}`;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;

  const wallGroup = new THREE.Group();
  wallGroup.name = `${wallMesh.name}-group`;
  wallGroup.userData = {
    direction,
    wallType,
    thicknessMeters: wallThickness,
    openings,
  };
  wallGroup.add(wallMesh);

  openings.forEach((opening) => {
    wallGroup.add(createOpeningAssembly(opening, wallLength, wallThickness));
  });

  applyWallTransform(wallGroup, direction, dimensions, wallThickness);

  return wallGroup;
}

function createCornerFillers(wallSpecs: WallSpec[], dimensions: RoomDimensions) {
  const group = new THREE.Group();
  group.name = "room-corner-fillers";

  const specByDirection = new Map<WallDirection, WallSpec>(
    wallSpecs.map((spec) => [spec.direction, spec])
  );
  const overlap = 0.01;
  const halfWidth = dimensions.width / 2;
  const halfDepth = dimensions.depth / 2;
  const height = dimensions.height;

  const corners = [
    {
      name: "corner-north-east",
      xDirection: "East" as WallDirection,
      zDirection: "North" as WallDirection,
      materialDirection: "East" as WallDirection,
      xSign: 1,
      zSign: 1,
    },
    {
      name: "corner-south-east",
      xDirection: "East" as WallDirection,
      zDirection: "South" as WallDirection,
      materialDirection: "South" as WallDirection,
      xSign: 1,
      zSign: -1,
    },
    {
      name: "corner-south-west",
      xDirection: "West" as WallDirection,
      zDirection: "South" as WallDirection,
      materialDirection: "West" as WallDirection,
      xSign: -1,
      zSign: -1,
    },
    {
      name: "corner-north-west",
      xDirection: "West" as WallDirection,
      zDirection: "North" as WallDirection,
      materialDirection: "North" as WallDirection,
      xSign: -1,
      zSign: 1,
    },
  ];

  corners.forEach((corner) => {
    const xSpec = specByDirection.get(corner.xDirection);
    const zSpec = specByDirection.get(corner.zDirection);
    const materialSpec = specByDirection.get(corner.materialDirection);

    if (!xSpec || !zSpec || !materialSpec) {
      return;
    }

    const sizeX = xSpec.wallThickness + overlap * 2;
    const sizeZ = zSpec.wallThickness + overlap * 2;
    const positionX = corner.xSign > 0 ? halfWidth + xSpec.wallThickness / 2 + overlap : -halfWidth - xSpec.wallThickness / 2 - overlap;
    const positionZ = corner.zSign > 0 ? halfDepth + zSpec.wallThickness / 2 + overlap : -halfDepth - zSpec.wallThickness / 2 - overlap;
    const cornerGeometry = new THREE.BoxGeometry(sizeX, height, sizeZ);
    const cornerTextures = createWallSurfaceTextureSet({
      wallType: materialSpec.wallType,
      wallLength: Math.max(sizeX, sizeZ),
      wallHeight: height,
    });
    const cornerMaterial = createWallSurfaceMaterial(cornerTextures);

    const cornerMesh = new THREE.Mesh(cornerGeometry, cornerMaterial);
    cornerMesh.name = corner.name;
    cornerMesh.position.set(positionX, height / 2, positionZ);
    cornerMesh.castShadow = true;
    cornerMesh.receiveShadow = true;

    group.add(cornerMesh);
  });

  return group;
}

function createOpeningAssembly(
  opening: WallOpening,
  wallLength: number,
  wallThickness: number
) {
  const group = new THREE.Group();
  group.name = `${opening.kind}-opening`;
  group.position.set(
    opening.startMeters + opening.widthMeters / 2 - wallLength / 2,
    opening.bottomMeters + opening.heightMeters / 2,
    0
  );
  group.userData = opening;

  if (opening.kind === "door") {
    group.add(createDoorAssembly(opening, wallThickness));
  } else {
    group.add(createWindowAssembly(opening, wallThickness));
  }

  return group;
}

function createDoorAssembly(opening: WallOpening, wallThickness: number) {
  const group = new THREE.Group();
  group.name = "door-assembly";

  const frameThickness = clamp(Math.min(opening.widthMeters * 0.08, 0.06), 0.03, 0.06);
  const frameDepth = Math.min(wallThickness * 0.32, 0.05);
  const leafWidth = Math.max(opening.widthMeters - frameThickness * 0.9, 0.12);
  const leafHeight = Math.max(opening.heightMeters - frameThickness * 0.6, 0.2);
  const leafDepth = Math.min(wallThickness * 0.18, 0.04);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: "#7c4a1e",
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: "#b45309",
    roughness: 0.82,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: "#fbbf24",
    roughness: 0.4,
    metalness: 0.18,
  });

  const frame = createRectFrameGroup(
    opening.widthMeters,
    opening.heightMeters,
    frameDepth,
    frameThickness,
    frameMaterial
  );
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(leafWidth, leafHeight, leafDepth),
    leafMaterial
  );
  leaf.position.set(0, -frameThickness * 0.05, 0);
  leaf.receiveShadow = true;

  const leafEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(leaf.geometry, 1),
    new THREE.LineBasicMaterial({ color: "#78350f" })
  );
  leaf.add(leafEdges);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.02), handleMaterial);
  handle.position.set(leafWidth * 0.24, 0.02, leafDepth / 2 + 0.012);
  handle.rotation.z = Math.PI / 2;

  group.add(frame);
  group.add(leaf);
  group.add(handle);

  return group;
}

function createWindowAssembly(opening: WallOpening, wallThickness: number) {
  const group = new THREE.Group();
  group.name = "window-assembly";

  const frameThickness = clamp(Math.min(opening.widthMeters * 0.1, 0.08), 0.035, 0.08);
  const frameDepth = Math.min(wallThickness * 0.3, 0.045);
  const glassWidth = Math.max(opening.widthMeters - frameThickness * 1.2, 0.08);
  const glassHeight = Math.max(opening.heightMeters - frameThickness * 1.2, 0.08);
  const glassDepth = Math.min(frameDepth * 0.35, 0.02);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: "#cbd5e1",
    roughness: 0.75,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#bfe3ff",
    roughness: 0.1,
    metalness: 0.02,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });

  const frame = createRectFrameGroup(
    opening.widthMeters,
    opening.heightMeters,
    frameDepth,
    frameThickness,
    frameMaterial
  );
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(glassWidth, glassHeight, glassDepth),
    glassMaterial
  );
  glass.position.z = 0;
  glass.receiveShadow = true;

  const mullion = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(frameThickness * 0.35, 0.02), glassHeight, glassDepth),
    new THREE.MeshStandardMaterial({
      color: "#94a3b8",
      roughness: 0.7,
      metalness: 0.03,
      side: THREE.DoubleSide,
    })
  );

  group.add(frame);
  group.add(glass);
  if (glassWidth > frameThickness * 2) {
    group.add(mullion);
  }

  return group;
}

function createRectFrameGroup(
  width: number,
  height: number,
  depth: number,
  barThickness: number,
  material: THREE.MeshStandardMaterial
) {
  const group = new THREE.Group();
  const safeBarThickness = clamp(barThickness, 0.02, Math.min(width, height) * 0.25);
  const verticalSpan = Math.max(height - safeBarThickness * 2, safeBarThickness);

  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(width, safeBarThickness, depth),
    material.clone()
  );
  topBar.position.set(0, height / 2 - safeBarThickness / 2, 0);

  const bottomBar = new THREE.Mesh(
    new THREE.BoxGeometry(width, safeBarThickness, depth),
    material.clone()
  );
  bottomBar.position.set(0, -height / 2 + safeBarThickness / 2, 0);

  const leftBar = new THREE.Mesh(
    new THREE.BoxGeometry(safeBarThickness, verticalSpan, depth),
    material.clone()
  );
  leftBar.position.set(-width / 2 + safeBarThickness / 2, 0, 0);

  const rightBar = new THREE.Mesh(
    new THREE.BoxGeometry(safeBarThickness, verticalSpan, depth),
    material.clone()
  );
  rightBar.position.set(width / 2 - safeBarThickness / 2, 0, 0);

  [topBar, bottomBar, leftBar, rightBar].forEach((bar) => {
    bar.receiveShadow = true;
    group.add(bar);
  });

  return group;
}

function applyWallTransform(
  wallGroup: THREE.Group,
  direction: WallDirection,
  dimensions: RoomDimensions,
  wallThickness: number
) {
  const halfWidth = dimensions.width / 2;
  const halfDepth = dimensions.depth / 2;

  switch (direction) {
    case "North":
      wallGroup.position.set(0, 0, halfDepth + wallThickness / 2);
      break;
    case "East":
      wallGroup.rotation.y = -Math.PI / 2;
      wallGroup.position.set(halfWidth + wallThickness / 2, 0, 0);
      break;
    case "South":
      wallGroup.rotation.y = Math.PI;
      wallGroup.position.set(0, 0, -halfDepth - wallThickness / 2);
      break;
    case "West":
      wallGroup.rotation.y = Math.PI / 2;
      wallGroup.position.set(-halfWidth - wallThickness / 2, 0, 0);
      break;
  }
}

function createWallShape(length: number, height: number, openings: WallOpening[]) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  shape.lineTo(0, height);
  shape.closePath();

  openings.forEach((opening) => {
    const startX = clamp(opening.startMeters, 0, length);
    const endX = clamp(opening.startMeters + opening.widthMeters, 0, length);
    const bottomY = clamp(opening.bottomMeters, 0, height);
    const topY = clamp(opening.bottomMeters + opening.heightMeters, 0, height);

    if (endX <= startX || topY <= bottomY) {
      return;
    }

    const hole = new THREE.Path();
    hole.moveTo(startX, bottomY);
    hole.lineTo(startX, topY);
    hole.lineTo(endX, topY);
    hole.lineTo(endX, bottomY);
    hole.closePath();
    shape.holes.push(hole);
  });

  return shape;
}

function buildWallOpenings(
  direction: WallDirection,
  wallLength: number,
  wallHeight: number,
  formValues: RoomInputValues
) {
  const door = getDoorInput(formValues, direction);
  const window = getWindowInput(formValues, direction);
  const spans = resolveWallFeatureSpans(wallLength, door.width, window.width);
  const openings: WallOpening[] = [];

  if (spans.door && door.width > 0) {
    openings.push({
      kind: "door",
      startMeters: spans.door.startMeters,
      widthMeters: spans.door.widthMeters,
      bottomMeters: 0,
      heightMeters: clampOpeningHeight(
        door.height,
        wallHeight,
        DEFAULT_DOOR_HEIGHT_METERS,
        1.8
      ),
    });
  }

  if (spans.window && window.width > 0) {
    const windowHeight = clampOpeningHeight(
      window.height,
      wallHeight,
      DEFAULT_WINDOW_HEIGHT_METERS,
      0.45
    );
    openings.push({
      kind: "window",
      startMeters: spans.window.startMeters,
      widthMeters: spans.window.widthMeters,
      bottomMeters: getWindowBottomOffset(wallHeight, windowHeight),
      heightMeters: windowHeight,
    });
  }

  return openings;
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

function getDoorInput(formValues: RoomInputValues, direction: WallDirection) {
  return {
    width: parseLengthMeters(formValues[getDoorWidthFieldName(direction)]),
    height: parseLengthMeters(formValues[getDoorHeightFieldName(direction)], DEFAULT_DOOR_HEIGHT_METERS),
  };
}

function getWindowInput(formValues: RoomInputValues, direction: WallDirection) {
  return {
    width: parseLengthMeters(formValues[getWindowWidthFieldName(direction)]),
    height: parseLengthMeters(
      formValues[getWindowHeightFieldName(direction)],
      DEFAULT_WINDOW_HEIGHT_METERS
    ),
  };
}

function getWallLengthForDirection(
  direction: WallDirection,
  roomDimensions: RoomDimensions
) {
  return direction === "North" || direction === "South"
    ? roomDimensions.width
    : roomDimensions.depth;
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

function getDoorWidthFieldName(direction: WallDirection) {
  return `door${direction}Width`;
}

function getDoorHeightFieldName(direction: WallDirection) {
  return `door${direction}Height`;
}

function getWindowWidthFieldName(direction: WallDirection) {
  return `window${direction}Width`;
}

function getWindowHeightFieldName(direction: WallDirection) {
  return `window${direction}Height`;
}

function getRoomDimensions(formValues: RoomInputValues): RoomDimensions | null {
  const wallData = [
    {
      length: parseLengthMeters(formValues.wallNorthLength),
      thickness: parseWallThicknessMeters(formValues.wallNorthWidth, formValues.wallNorthType),
    },
    {
      length: parseLengthMeters(formValues.wallEastLength),
      thickness: parseWallThicknessMeters(formValues.wallEastWidth, formValues.wallEastType),
    },
    {
      length: parseLengthMeters(formValues.wallSouthLength),
      thickness: parseWallThicknessMeters(formValues.wallSouthWidth, formValues.wallSouthType),
    },
    {
      length: parseLengthMeters(formValues.wallWestLength),
      thickness: parseWallThicknessMeters(formValues.wallWestWidth, formValues.wallWestType),
    },
  ];
  const horizontalLengths = [wallData[0].length, wallData[2].length].filter((value) => value > 0);
  const verticalLengths = [wallData[1].length, wallData[3].length].filter((value) => value > 0);

  if (horizontalLengths.length === 0 || verticalLengths.length === 0) {
    return null;
  }

  const heights = [
    parseLengthMeters(formValues.wallNorthHeight, DEFAULT_HEIGHT_METERS),
    parseLengthMeters(formValues.wallEastHeight, DEFAULT_HEIGHT_METERS),
    parseLengthMeters(formValues.wallSouthHeight, DEFAULT_HEIGHT_METERS),
    parseLengthMeters(formValues.wallWestHeight, DEFAULT_HEIGHT_METERS),
  ];
  const thicknesses = wallData
    .filter((wall) => wall.length > 0)
    .map((wall) => wall.thickness);

  return {
    width: Math.max(...horizontalLengths),
    depth: Math.max(...verticalLengths),
    height: Math.max(...heights),
    wallThickness:
      thicknesses.reduce((sum, value) => sum + value, 0) / thicknesses.length,
  };
}

function parseLengthMeters(value: string | undefined, fallback = 0) {
  return parsePositiveNumber(value, fallback);
}

function parseWallThicknessMeters(value: string | undefined, wallType?: string) {
  const parsed = parsePositiveNumber(value, 0);

  if (parsed > 0) {
    return parsed > 20 ? parsed / 1000 : parsed;
  }

  const assetThickness = getWallAssetByType(wallType ?? "")?.dimensions?.thicknessMeters;

  return assetThickness ?? DEFAULT_WALL_THICKNESS_METERS;
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

  return clamp(DEFAULT_WINDOW_SILL_HEIGHT_METERS, 0, availableBottom);
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
