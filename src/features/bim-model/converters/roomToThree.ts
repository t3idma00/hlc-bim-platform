import * as THREE from "three";
import {
  getRoofAppearanceByType,
  getRoofAssetByType,
  getWallAssetByType,
  getWindowGlassAppearanceByType,
} from "@/data/assets";
import {
  createWallSurfaceTextureSet,
  type WallSurfaceTextureSet,
} from "../shared/wallSurfaceTextures";

const DEFAULT_HEIGHT_METERS = 3;
const DEFAULT_WALL_THICKNESS_METERS = 0.2;
const DEFAULT_FLOOR_THICKNESS_METERS = 0.08;
const DEFAULT_ROOF_THICKNESS_METERS = 0.15;
const DEFAULT_DOOR_HEIGHT_METERS = 2.1;
const DEFAULT_WINDOW_HEIGHT_METERS = 1.2;
const DEFAULT_WINDOW_SILL_HEIGHT_METERS = 0.9;

export type RoomInputValues = Record<string, string>;
export type SheetValues = Record<string, string>;

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

type RoofSpec = {
  roofType: string;
  thickness: number;
};

type WallOpeningKind = "door" | "window";

type WallOpening = {
  kind: WallOpeningKind;
  startMeters: number;
  widthMeters: number;
  bottomMeters: number;
  heightMeters: number;
  glassType?: string;
};

type WallFeatureSpan = {
  startMeters: number;
  widthMeters: number;
};

type SceneObjectKind = "workDesk" | "chair" | "table" | "computer" | "tv" | "bed";

type SceneObjectPlacement = {
  id: string;
  kind: SceneObjectKind;
  position: {
    x: number;
    y: number;
  };
  rotationRadians: number;
};

export function roomToThree(
  formValues: RoomInputValues,
  sheetValues: SheetValues = {}
): ThreeRoomModel | null {
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
  group.add(createCeilingMesh(dimensions));
  group.add(createRoofMesh(dimensions, getRoofSpec(formValues)));

  visibleWallSpecs.forEach((spec) => {
    group.add(createWallAssembly(spec, dimensions, formValues, sheetValues));
  });

  group.add(createCornerFillers(visibleWallSpecs, dimensions));
  group.add(createSceneObjectGroup(formValues, dimensions));

  return { group, dimensions };
}

function createSceneObjectGroup(
  formValues: RoomInputValues,
  dimensions: RoomDimensions
) {
  const group = new THREE.Group();
  group.name = "room-scene-objects";
  const objects = parseSceneObjects(formValues.sceneObjectsJson);
  const halfWidth = dimensions.width / 2;
  const halfDepth = dimensions.depth / 2;

  objects.forEach((object) => {
    const mesh = createSceneObjectMesh(object.kind);
    const mappedPosition = mapEditorObjectToRoomPosition(object.position, dimensions);
    const footprint = getSceneObjectFootprint(object.kind);
    const clampedX = clamp(mappedPosition.x, -halfWidth + footprint.width / 2, halfWidth - footprint.width / 2);
    const clampedZ = clamp(mappedPosition.z, -halfDepth + footprint.depth / 2, halfDepth - footprint.depth / 2);
    mesh.position.set(clampedX, 0, clampedZ);
    mesh.rotation.y = -object.rotationRadians;
    mesh.userData = {
      id: object.id,
      kind: object.kind,
    };
    group.add(mesh);
  });

  return group;
}

function createSceneObjectMesh(kind: SceneObjectKind) {
  switch (kind) {
    case "chair":
      return createChairMesh();
    case "table":
      return createTableMesh();
    case "computer":
      return createComputerMesh();
    case "tv":
      return createTvMesh();
    case "bed":
      return createBedMesh();
    default:
      return createWorkDeskMesh();
  }
}

function getSceneObjectFootprint(kind: SceneObjectKind) {
  switch (kind) {
    case "chair":
      return { width: 0.6, depth: 0.6 };
    case "table":
      return { width: 1.25, depth: 0.85 };
    case "computer":
      return { width: 0.8, depth: 0.5 };
    case "tv":
      return { width: 1.4, depth: 0.32 };
    case "bed":
      return { width: 1.7, depth: 2.2 };
    default:
      return { width: 1.5, depth: 0.75 };
  }
}

function mapEditorObjectToRoomPosition(
  editorPosition: { x: number; y: number },
  dimensions: RoomDimensions
) {
  return {
    // 2D editor room coordinates are anchored from (0,0) at the north-west corner.
    // 3D room coordinates are centered at (0,0), with positive Z pointing north.
    x: editorPosition.x - dimensions.width / 2,
    z: dimensions.depth / 2 - editorPosition.y,
  };
}

function createWorkDeskMesh() {
  const group = new THREE.Group();
  group.name = "work-desk";

  const topMaterial = new THREE.MeshStandardMaterial({ color: "#8b5a2b", roughness: 0.68, metalness: 0.05 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.52, metalness: 0.22 });
  const screenMaterial = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.32, metalness: 0.18 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.45, metalness: 0.12 });

  group.add(createFurnitureBox(1.5, 0.05, 0.75, topMaterial, 0, 0.73, 0));
  group.add(createFurnitureBox(0.42, 0.64, 0.68, topMaterial, -0.46, 0.32, 0));
  group.add(createFurnitureBox(0.76, 0.04, 0.08, frameMaterial, 0.16, 0.61, -0.29));
  group.add(createFurnitureBox(0.76, 0.04, 0.08, frameMaterial, 0.16, 0.61, 0.29));
  group.add(createFurnitureBox(0.06, 0.68, 0.06, frameMaterial, 0.69, 0.34, 0.3));
  group.add(createFurnitureBox(0.06, 0.68, 0.06, frameMaterial, 0.69, 0.34, -0.3));
  group.add(createFurnitureBox(0.38, 0.24, 0.03, screenMaterial, 0.22, 0.99, -0.16));
  group.add(createFurnitureBox(0.06, 0.18, 0.06, accentMaterial, 0.22, 0.83, -0.16));
  group.add(createFurnitureBox(0.28, 0.02, 0.14, accentMaterial, 0.22, 0.75, 0.04));
  group.add(createFurnitureBox(0.12, 0.012, 0.08, new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.44, metalness: 0.12 }), 0.42, 0.746, 0.08));
  applyObjectShadows(group);
  return group;
}

function createTableMesh() {
  const group = new THREE.Group();
  group.name = "room-table";
  const topMaterial = new THREE.MeshStandardMaterial({ color: "#a16207", roughness: 0.74, metalness: 0.04 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: "#57534e", roughness: 0.6, metalness: 0.15 });
  group.add(createFurnitureBox(1.25, 0.06, 0.85, topMaterial, 0, 0.74, 0));
  group.add(createFurnitureBox(1.06, 0.05, 0.08, legMaterial, 0, 0.66, -0.31));
  group.add(createFurnitureBox(1.06, 0.05, 0.08, legMaterial, 0, 0.66, 0.31));
  group.add(createFurnitureBox(0.08, 0.05, 0.56, legMaterial, -0.42, 0.66, 0));
  group.add(createFurnitureBox(0.08, 0.05, 0.56, legMaterial, 0.42, 0.66, 0));
  [
    [0.53, 0.33],
    [-0.53, 0.33],
    [0.53, -0.33],
    [-0.53, -0.33],
  ].forEach(([x, z]) => {
    group.add(createFurnitureBox(0.06, 0.68, 0.06, legMaterial, x, 0.34, z));
  });
  applyObjectShadows(group);
  return group;
}

function createChairMesh() {
  const group = new THREE.Group();
  group.name = "room-chair";
  const seatMaterial = new THREE.MeshStandardMaterial({ color: "#3b82f6", roughness: 0.48, metalness: 0.05 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.56, metalness: 0.22 });
  group.add(createFurnitureBox(0.52, 0.05, 0.5, seatMaterial, 0, 0.47, 0));
  group.add(createFurnitureBox(0.52, 0.06, 0.06, seatMaterial, 0, 0.8, -0.22));
  group.add(createFurnitureBox(0.06, 0.4, 0.06, seatMaterial, -0.23, 0.63, -0.22));
  group.add(createFurnitureBox(0.06, 0.4, 0.06, seatMaterial, 0.23, 0.63, -0.22));
  [
    [0.2, 0.2],
    [-0.2, 0.2],
    [0.2, -0.2],
    [-0.2, -0.2],
  ].forEach(([x, z]) => {
    group.add(createFurnitureBox(0.04, 0.45, 0.04, frameMaterial, x, 0.225, z));
  });
  group.add(createFurnitureBox(0.34, 0.03, 0.03, frameMaterial, 0, 0.26, 0.2));
  group.add(createFurnitureBox(0.34, 0.03, 0.03, frameMaterial, 0, 0.26, -0.2));
  applyObjectShadows(group);
  return group;
}

function createTvMesh() {
  const group = new THREE.Group();
  group.name = "room-tv";
  const screenMaterial = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.32, metalness: 0.24 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.08, metalness: 0.18, emissive: "#0b1220", emissiveIntensity: 0.12 });
  const cabinetMaterial = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.58, metalness: 0.16 });
  group.add(createFurnitureBox(1.28, 0.22, 0.32, cabinetMaterial, 0, 0.11, 0));
  group.add(createFurnitureBox(1.18, 0.03, 0.28, new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.42, metalness: 0.18 }), 0, 0.22, 0));
  group.add(createFurnitureBox(1.02, 0.62, 0.07, screenMaterial, 0, 0.67, -0.03));
  group.add(createFurnitureBox(0.9, 0.5, 0.02, glassMaterial, 0, 0.67, 0.006));
  group.add(createFurnitureBox(0.1, 0.28, 0.08, cabinetMaterial, 0, 0.35, 0.02));
  group.add(createFurnitureBox(0.56, 0.03, 0.18, cabinetMaterial, 0, 0.015, 0.04));
  applyObjectShadows(group);
  return group;
}

function createComputerMesh() {
  const group = new THREE.Group();
  group.name = "room-computer";
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.5, metalness: 0.18 });
  const topMaterial = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.56, metalness: 0.12 });
  const screenMaterial = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.28, metalness: 0.18 });
  group.add(createFurnitureBox(0.8, 0.04, 0.5, topMaterial, 0, 0.72, 0));
  [
    [0.33, 0.18],
    [-0.33, 0.18],
    [0.33, -0.18],
    [-0.33, -0.18],
  ].forEach(([x, z]) => {
    group.add(createFurnitureBox(0.04, 0.7, 0.04, frameMaterial, x, 0.35, z));
  });
  group.add(createFurnitureBox(0.42, 0.28, 0.04, screenMaterial, 0, 0.94, -0.11));
  group.add(createFurnitureBox(0.06, 0.16, 0.06, frameMaterial, 0, 0.81, -0.11));
  group.add(createFurnitureBox(0.28, 0.02, 0.12, frameMaterial, 0, 0.74, 0.08));
  group.add(createFurnitureBox(0.12, 0.38, 0.22, new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.48, metalness: 0.14 }), 0.28, 0.19, -0.08));
  applyObjectShadows(group);
  return group;
}

function createBedMesh() {
  const group = new THREE.Group();
  group.name = "room-bed";
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#8b5a2b", roughness: 0.7, metalness: 0.05 });
  const mattressMaterial = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.9, metalness: 0 });
  const blanketMaterial = new THREE.MeshStandardMaterial({ color: "#93c5fd", roughness: 0.78, metalness: 0.02 });
  const pillowMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.86, metalness: 0 });

  group.add(createFurnitureBox(1.7, 0.2, 2.2, frameMaterial, 0, 0.1, 0));
  group.add(createFurnitureBox(1.6, 0.22, 1.95, mattressMaterial, 0, 0.31, 0.02));
  group.add(createFurnitureBox(1.7, 0.72, 0.08, frameMaterial, 0, 0.56, -1.06));
  group.add(createFurnitureBox(1.52, 0.08, 1.08, blanketMaterial, 0, 0.43, 0.48));
  group.add(createFurnitureBox(0.56, 0.08, 0.34, pillowMaterial, -0.4, 0.44, -0.72));
  group.add(createFurnitureBox(0.56, 0.08, 0.34, pillowMaterial, 0.4, 0.44, -0.72));
  applyObjectShadows(group);
  return group;
}

function createFurnitureBox(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function applyObjectShadows(group: THREE.Group) {
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
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

function createCeilingMesh(dimensions: RoomDimensions) {
  const ceilingThickness = 0.035;
  const geometry = new THREE.BoxGeometry(dimensions.width, ceilingThickness, dimensions.depth);
  const material = new THREE.MeshStandardMaterial({
    color: "#f8fafc",
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const ceiling = new THREE.Mesh(geometry, material);
  ceiling.name = "room-ceiling";
  ceiling.position.set(0, dimensions.height - ceilingThickness / 2, 0);
  ceiling.receiveShadow = true;
  ceiling.userData = {
    purpose: "conditioned-room-ceiling",
    thicknessMeters: ceilingThickness,
  };

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({ color: "#cbd5e1" })
  );
  edges.name = "room-ceiling-edges";
  ceiling.add(edges);

  return ceiling;
}

function createRoofMesh(dimensions: RoomDimensions, roofSpec: RoofSpec) {
  if (roofSpec.roofType === "Clay Roof") {
    return createClayTileRoof(dimensions, roofSpec);
  }

  if (roofSpec.roofType === "Asbestos Roof") {
    return createCorrugatedAsbestosRoof(dimensions, roofSpec);
  }

  return createConcreteSlabRoof(dimensions, roofSpec);
}

function createConcreteSlabRoof(dimensions: RoomDimensions, roofSpec: RoofSpec) {
  const appearance = getRoofAppearanceByType(roofSpec.roofType);
  const roofThickness = roofSpec.thickness;
  const overhang = 0.08;
  const roofWidth = dimensions.width + overhang * 2;
  const roofDepth = dimensions.depth + overhang * 2;
  const geometry = new THREE.BoxGeometry(roofWidth, roofThickness, roofDepth);
  const material = new THREE.MeshStandardMaterial({
    color: appearance.fill,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const roof = new THREE.Mesh(geometry, material);
  roof.name = "room-roof";
  roof.position.set(0, dimensions.height + roofThickness / 2, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  roof.userData = {
    roofType: roofSpec.roofType,
    thicknessMeters: roofThickness,
  };

  const seamMaterial = new THREE.LineBasicMaterial({ color: "#9ca3af" });
  const seamGroup = new THREE.Group();
  seamGroup.name = "concrete-roof-seams";
  const topY = roofThickness / 2 + 0.004;
  const seamSpacing = 1.2;

  for (let x = -roofWidth / 2 + seamSpacing; x < roofWidth / 2; x += seamSpacing) {
    const seam = createLineSegment(
      new THREE.Vector3(x, topY, -roofDepth / 2),
      new THREE.Vector3(x, topY, roofDepth / 2),
      seamMaterial
    );
    seamGroup.add(seam);
  }

  for (let z = -roofDepth / 2 + seamSpacing; z < roofDepth / 2; z += seamSpacing) {
    const seam = createLineSegment(
      new THREE.Vector3(-roofWidth / 2, topY, z),
      new THREE.Vector3(roofWidth / 2, topY, z),
      seamMaterial
    );
    seamGroup.add(seam);
  }

  roof.add(seamGroup);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({ color: appearance.stroke })
  );
  edges.name = "room-roof-edges";
  roof.add(edges);

  return roof;
}

function createClayTileRoof(dimensions: RoomDimensions, roofSpec: RoofSpec) {
  const group = new THREE.Group();
  group.name = "room-roof";
  group.userData = {
    roofType: roofSpec.roofType,
    thicknessMeters: roofSpec.thickness,
  };

  const overhang = 0.3;
  const halfSpan = dimensions.width / 2 + overhang;
  const roofDepth = dimensions.depth + overhang * 2;
  const rise = Math.max(dimensions.width * 0.18, 0.55);
  const slopeLength = Math.hypot(halfSpan, rise);
  const angle = Math.atan2(rise, halfSpan);
  const roofThickness = Math.max(roofSpec.thickness, 0.06);
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: "#b45309",
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const tileMaterial = new THREE.MeshStandardMaterial({
    color: "#c2410c",
    roughness: 0.9,
    metalness: 0,
  });

  const leftSide = createClayRoofSide({
    sideSign: -1,
    baseHeight: dimensions.height,
    halfSpan,
    roofDepth,
    rise,
    slopeLength,
    angle,
    roofThickness,
    sideMaterial,
    tileMaterial,
  });
  const rightSide = createClayRoofSide({
    sideSign: 1,
    baseHeight: dimensions.height,
    halfSpan,
    roofDepth,
    rise,
    slopeLength,
    angle,
    roofThickness,
    sideMaterial,
    tileMaterial,
  });
  group.add(leftSide, rightSide);

  const ridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, roofDepth, 16),
    new THREE.MeshStandardMaterial({ color: "#7c2d12", roughness: 0.82 })
  );
  ridge.name = "clay-roof-ridge-cap";
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(0, dimensions.height + rise + 0.035, 0);
  ridge.castShadow = true;
  ridge.receiveShadow = true;
  group.add(ridge);

  return group;
}

function createClayRoofSide({
  sideSign,
  baseHeight,
  halfSpan,
  roofDepth,
  rise,
  slopeLength,
  angle,
  roofThickness,
  sideMaterial,
  tileMaterial,
}: {
  sideSign: -1 | 1;
  baseHeight: number;
  halfSpan: number;
  roofDepth: number;
  rise: number;
  slopeLength: number;
  angle: number;
  roofThickness: number;
  sideMaterial: THREE.MeshStandardMaterial;
  tileMaterial: THREE.MeshStandardMaterial;
}) {
  const side = new THREE.Group();
  side.position.set(sideSign * halfSpan / 2, baseHeight + rise / 2, 0);
  side.rotation.z = sideSign === 1 ? -angle : angle;

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(slopeLength, roofThickness, roofDepth),
    sideMaterial.clone()
  );
  panel.name = sideSign === 1 ? "clay-roof-right-plane" : "clay-roof-left-plane";
  panel.castShadow = true;
  panel.receiveShadow = true;
  side.add(panel);

  const rowSpacing = 0.32;
  const tileRadius = 0.035;
  for (let x = -slopeLength / 2 + rowSpacing; x < slopeLength / 2; x += rowSpacing) {
    const tileRow = new THREE.Mesh(
      new THREE.CylinderGeometry(tileRadius, tileRadius, roofDepth + 0.04, 10),
      tileMaterial.clone()
    );
    tileRow.name = "clay-roof-tile-row";
    tileRow.rotation.x = Math.PI / 2;
    tileRow.position.set(x, roofThickness / 2 + tileRadius * 0.35, 0);
    tileRow.castShadow = true;
    tileRow.receiveShadow = true;
    side.add(tileRow);
  }

  return side;
}

function createCorrugatedAsbestosRoof(dimensions: RoomDimensions, roofSpec: RoofSpec) {
  const appearance = getRoofAppearanceByType(roofSpec.roofType);
  const group = new THREE.Group();
  group.name = "room-roof";
  group.userData = {
    roofType: roofSpec.roofType,
    thicknessMeters: roofSpec.thickness,
  };

  const overhang = 0.3;
  const halfSpan = dimensions.width / 2 + overhang;
  const roofDepth = dimensions.depth + overhang * 2;
  const rise = Math.max(dimensions.width * 0.18, 0.55);
  const slopeLength = Math.hypot(halfSpan, rise);
  const angle = Math.atan2(rise, halfSpan);
  const roofThickness = Math.max(roofSpec.thickness, 0.03);
  const sheetMaterial = new THREE.MeshStandardMaterial({
    color: appearance.fill,
    roughness: 0.95,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const ridgeMaterial = new THREE.MeshStandardMaterial({
    color: "#cbd5e1",
    roughness: 0.96,
    metalness: 0.04,
  });
  const leftSide = createCorrugatedRoofSide({
    sideSign: -1,
    baseHeight: dimensions.height,
    halfSpan,
    roofDepth,
    rise,
    slopeLength,
    angle,
    roofThickness,
    sheetMaterial,
    ridgeMaterial,
  });
  const rightSide = createCorrugatedRoofSide({
    sideSign: 1,
    baseHeight: dimensions.height,
    halfSpan,
    roofDepth,
    rise,
    slopeLength,
    angle,
    roofThickness,
    sheetMaterial,
    ridgeMaterial,
  });
  group.add(leftSide, rightSide);

  const ridgeCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, roofDepth, 14),
    ridgeMaterial.clone()
  );
  ridgeCap.name = "asbestos-roof-ridge-cap";
  ridgeCap.rotation.x = Math.PI / 2;
  ridgeCap.position.set(0, dimensions.height + rise + 0.03, 0);
  ridgeCap.castShadow = true;
  ridgeCap.receiveShadow = true;
  group.add(ridgeCap);

  return group;
}

function createCorrugatedRoofSide({
  sideSign,
  baseHeight,
  halfSpan,
  roofDepth,
  rise,
  slopeLength,
  angle,
  roofThickness,
  sheetMaterial,
  ridgeMaterial,
}: {
  sideSign: -1 | 1;
  baseHeight: number;
  halfSpan: number;
  roofDepth: number;
  rise: number;
  slopeLength: number;
  angle: number;
  roofThickness: number;
  sheetMaterial: THREE.MeshStandardMaterial;
  ridgeMaterial: THREE.MeshStandardMaterial;
}) {
  const side = new THREE.Group();
  side.position.set(sideSign * halfSpan / 2, baseHeight + rise / 2, 0);
  side.rotation.z = sideSign === 1 ? -angle : angle;

  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(slopeLength, roofThickness, roofDepth),
    sheetMaterial.clone()
  );
  sheet.name = sideSign === 1 ? "asbestos-roof-right-sheet" : "asbestos-roof-left-sheet";
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  side.add(sheet);

  const ridgeSpacing = 0.28;
  const ridgeRadius = 0.028;
  for (let x = -slopeLength / 2 + ridgeSpacing / 2; x < slopeLength / 2; x += ridgeSpacing) {
    const corrugation = new THREE.Mesh(
      new THREE.CylinderGeometry(ridgeRadius, ridgeRadius, roofDepth + 0.04, 10),
      ridgeMaterial.clone()
    );
    corrugation.name = "asbestos-roof-corrugation";
    corrugation.rotation.x = Math.PI / 2;
    corrugation.position.set(x, roofThickness / 2 + ridgeRadius * 0.45, 0);
    corrugation.castShadow = true;
    corrugation.receiveShadow = true;
    side.add(corrugation);
  }

  return side;
}

function createLineSegment(
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.LineBasicMaterial
) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([start, end]),
    material
  );
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
  formValues: RoomInputValues,
  sheetValues: SheetValues
) {
  const { direction, wallType, wallThickness, wallLength } = spec;
  const openings = buildWallOpenings(
    direction,
    wallLength,
    dimensions.height,
    formValues,
    sheetValues
  );
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
  group.userData = {
    glassType: opening.glassType ?? "Single Glass Clear",
  };

  const frameThickness = clamp(Math.min(opening.widthMeters * 0.1, 0.08), 0.035, 0.08);
  const frameDepth = Math.min(wallThickness * 0.3, 0.045);
  const glassWidth = Math.max(opening.widthMeters - frameThickness * 1.2, 0.08);
  const glassHeight = Math.max(opening.heightMeters - frameThickness * 1.2, 0.08);
  const glassDepth = Math.min(frameDepth * 0.35, 0.02);
  const glassAppearance = getWindowGlassAppearanceByType(opening.glassType ?? "Single Glass Clear");

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: "#cbd5e1",
    roughness: 0.75,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: glassAppearance.color,
    roughness: glassAppearance.roughness,
    metalness: glassAppearance.metalness,
    transparent: true,
    opacity: glassAppearance.opacity,
    transmission: 0.42,
    thickness: glassDepth,
    clearcoat: 0.85,
    clearcoatRoughness: 0.05,
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
  glass.name = "window-glass-pane";

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

  if (glassAppearance.paneCount === 2) {
    const secondGlass = glass.clone();
    secondGlass.name = "window-inner-insulating-pane";
    secondGlass.material = glassMaterial.clone();
    secondGlass.position.z = -Math.max(glassDepth * 2.2, 0.018);
    group.add(secondGlass);

    const spacer = createRectFrameGroup(
      glassWidth + frameThickness * 0.18,
      glassHeight + frameThickness * 0.18,
      0.012,
      Math.max(frameThickness * 0.18, 0.012),
      new THREE.MeshStandardMaterial({
        color: "#64748b",
        roughness: 0.5,
        metalness: 0.12,
        side: THREE.DoubleSide,
      })
    );
    spacer.name = "window-insulating-spacer";
    spacer.position.z = -Math.max(glassDepth * 1.1, 0.009);
    spacer.receiveShadow = true;
    group.add(spacer);
  }

  if (opening.glassType?.includes("Heat Absorbing")) {
    const tintFilm = new THREE.Mesh(
      new THREE.BoxGeometry(glassWidth * 0.92, glassHeight * 0.92, Math.max(glassDepth * 0.18, 0.003)),
      new THREE.MeshBasicMaterial({
        color: glassAppearance.tintColor,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      })
    );
    tintFilm.name = "window-heat-absorbing-tint";
    tintFilm.position.z = glassDepth / 2 + 0.004;
    group.add(tintFilm);
  }

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
  formValues: RoomInputValues,
  sheetValues: SheetValues
) {
  const door = getDoorInput(formValues, direction);
  const window = getWindowInput(formValues, sheetValues, direction);
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
      glassType: window.glassType,
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

function getWindowInput(
  formValues: RoomInputValues,
  sheetValues: SheetValues,
  direction: WallDirection
) {
  return {
    width: parseLengthMeters(formValues[getWindowWidthFieldName(direction)]),
    height: parseLengthMeters(
      formValues[getWindowHeightFieldName(direction)],
      DEFAULT_WINDOW_HEIGHT_METERS
    ),
    glassType: getGlassTypeForDirection(sheetValues, direction),
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

function getGlassTypeForDirection(
  sheetValues: SheetValues,
  direction: WallDirection
) {
  const glassRows = [
    { id: "2.1", defaultDirection: "East" },
    { id: "2.2", defaultDirection: "East" },
    { id: "2.3", defaultDirection: "South" },
    { id: "2.4", defaultDirection: "West" },
    { id: "2.5", defaultDirection: "HOR" },
  ];

  const matchingRow = glassRows.find((row) => {
    const rowDirection = sheetValues[`${row.id}_direction`] || row.defaultDirection;
    return rowDirection === direction;
  });

  return matchingRow
    ? sheetValues[`${matchingRow.id}_type`] || "Single Glass Clear"
    : "Single Glass Clear";
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

function getRoofSpec(formValues: RoomInputValues): RoofSpec {
  const roofType = formValues.roofType || "Concrete Slab Roof";

  return {
    roofType,
    thickness: parseRoofThicknessMeters(formValues.roofThickness, roofType),
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

function parseRoofThicknessMeters(value: string | undefined, roofType?: string) {
  const parsed = parsePositiveNumber(value, 0);

  if (parsed > 0) {
    return parsed > 2 ? parsed / 1000 : parsed;
  }

  const assetThickness = getRoofAssetByType(roofType ?? "")?.dimensions?.thicknessMeters;

  return assetThickness ?? DEFAULT_ROOF_THICKNESS_METERS;
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

function parseSceneObjects(rawValue: string | undefined): SceneObjectPlacement[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const source = item as {
          id?: unknown;
          kind?: unknown;
          position?: { x?: unknown; y?: unknown };
          rotationRadians?: unknown;
        };
        const x = Number(source.position?.x);
        const y = Number(source.position?.y);
        const rotationRadians = Number(source.rotationRadians ?? 0);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        return {
          id:
            typeof source.id === "string" && source.id.trim().length > 0
              ? source.id
              : `object-${index + 1}`,
          kind: parseSceneObjectKind(source.kind),
          position: { x, y },
          rotationRadians: Number.isFinite(rotationRadians) ? rotationRadians : 0,
        } as SceneObjectPlacement;
      })
      .filter((item): item is SceneObjectPlacement => item !== null);
  } catch {
    return [];
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseSceneObjectKind(value: unknown): SceneObjectKind {
  return value === "table" ||
    value === "chair" ||
    value === "tv" ||
    value === "computer" ||
    value === "bed" ||
    value === "workDesk"
    ? value
    : "workDesk";
}
