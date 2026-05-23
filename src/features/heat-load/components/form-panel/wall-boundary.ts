export type WallBoundary = "Exterior" | "Interior";
export type CardinalWall =
  | "North"
  | "Northeast"
  | "East"
  | "Southeast"
  | "South"
  | "Southwest"
  | "West"
  | "Northwest";
export type BoundaryOwner = "wall" | "window" | "door";

export const cardinalWalls = ["North", "East", "South", "West"] as const;

export const wallBoundaryOptions: WallBoundary[] = ["Exterior", "Interior"];

export function getWallBoundary(values: Record<string, string>, wall: CardinalWall): WallBoundary {
  return values[`wall${wall}Boundary`] === "Interior" ? "Interior" : "Exterior";
}

export function getSurfaceBoundary(
  values: Record<string, string>,
  owner: BoundaryOwner,
  wall: CardinalWall,
): WallBoundary {
  if (owner === "wall") {
    return getWallBoundary(values, wall);
  }

  const value = values[boundaryFieldName(owner, wall)];
  return value === "Interior" ? "Interior" : getWallBoundary(values, wall);
}

export function isExteriorWall(values: Record<string, string>, wall: CardinalWall) {
  return getWallBoundary(values, wall) === "Exterior";
}

export function isExteriorSurface(
  values: Record<string, string>,
  owner: BoundaryOwner,
  wall: CardinalWall,
) {
  return getSurfaceBoundary(values, owner, wall) === "Exterior";
}

export function wallBoundaryFieldName(wall: CardinalWall) {
  return `wall${wall}Boundary`;
}

export function boundaryFieldName(owner: BoundaryOwner, wall: CardinalWall) {
  return `${owner}${wall}Boundary`;
}
