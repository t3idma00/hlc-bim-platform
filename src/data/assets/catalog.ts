import { type AssetCategory, type AssetCatalog, type AssetDimensions, type AssetItem } from "./types";

const MODEL_ROOT = "/models";
const TEXTURE_ROOT = "/textures";

const assetCategoryOrder: AssetCategory[] = ["walls", "doors", "windows", "furniture", "lights"];

export const assetCategoryLabels: Record<AssetCategory, string> = {
  walls: "Walls",
  doors: "Doors",
  windows: "Windows",
  furniture: "Furniture",
  lights: "Lights",
};

function buildPath(root: string, category: AssetCategory, fileName: string) {
  return `${root}/${category}/${fileName}`;
}

function createAsset(input: {
  id: string;
  label: string;
  category: AssetCategory;
  modelFile: string;
  textureFile?: string;
  tags: string[];
  description?: string;
  dimensions?: AssetDimensions;
}): AssetItem {
  return {
    id: input.id,
    label: input.label,
    category: input.category,
    modelPath: buildPath(MODEL_ROOT, input.category, input.modelFile),
    texturePath: input.textureFile ? buildPath(TEXTURE_ROOT, input.category, input.textureFile) : undefined,
    tags: input.tags,
    description: input.description,
    dimensions: input.dimensions,
  };
}

export const assetCatalog: AssetCatalog = {
  walls: [
    createAsset({
      id: "wall-brick",
      label: "Brick Wall",
      category: "walls",
      modelFile: "brick-wall.glb",
      textureFile: "brick-red.png",
      tags: ["wall", "brick", "masonry", "default"],
      description: "Standard brick wall type.",
      dimensions: {
        thicknessMeters: 0.215,
      },
    }),
    createAsset({
      id: "wall-cement-block",
      label: "Cement block Wall",
      category: "walls",
      modelFile: "cement-block-wall.glb",
      textureFile: "cement-block.png",
      tags: ["wall", "cement-block", "masonry"],
      description: "Plain cement block wall type.",
      dimensions: {
        thicknessMeters: 0.12,
      },
    }),
    createAsset({
      id: "wall-concrete",
      label: "Concrete Wall",
      category: "walls",
      modelFile: "concrete-wall.glb",
      textureFile: "concrete-plaster.png",
      tags: ["wall", "concrete", "solid"],
      description: "Solid concrete wall type.",
      dimensions: {
        thicknessMeters: 0.2,
      },
    }),
  ],
  doors: [
    createAsset({
      id: "door-single-swing",
      label: "Single Swing Door",
      category: "doors",
      modelFile: "single-swing-door.glb",
      textureFile: "oak-veneer.png",
      tags: ["door", "swing", "interior", "single"],
      description: "Standard single-leaf swing door.",
      dimensions: {
        widthMeters: 0.9,
        heightMeters: 2.1,
        thicknessMeters: 0.04,
      },
    }),
    createAsset({
      id: "door-double-swing",
      label: "Double Swing Door",
      category: "doors",
      modelFile: "double-swing-door.glb",
      textureFile: "walnut-veneer.png",
      tags: ["door", "swing", "double"],
      description: "Double-leaf door for larger openings.",
      dimensions: {
        widthMeters: 1.6,
        heightMeters: 2.1,
        thicknessMeters: 0.05,
      },
    }),
    createAsset({
      id: "door-sliding-glass",
      label: "Sliding Glass Door",
      category: "doors",
      modelFile: "sliding-glass-door.glb",
      textureFile: "glass-clear.png",
      tags: ["door", "sliding", "glass"],
      description: "Space-saving glazed door for bright areas.",
      dimensions: {
        widthMeters: 1.8,
        heightMeters: 2.2,
        thicknessMeters: 0.03,
      },
    }),
  ],
  windows: [
    createAsset({
      id: "window-fixed",
      label: "Fixed Window",
      category: "windows",
      modelFile: "fixed-window.glb",
      textureFile: "glass-clear.png",
      tags: ["window", "fixed"],
      description: "Non-opening window for daylight and visibility.",
      dimensions: {
        widthMeters: 1.2,
        heightMeters: 1.2,
        thicknessMeters: 0.03,
      },
    }),
    createAsset({
      id: "window-casement",
      label: "Casement Window",
      category: "windows",
      modelFile: "casement-window.glb",
      textureFile: "glass-tinted.png",
      tags: ["window", "casement", "opening"],
      description: "Side-hinged window with an opening sash.",
      dimensions: {
        widthMeters: 1.0,
        heightMeters: 1.2,
        thicknessMeters: 0.04,
      },
    }),
    createAsset({
      id: "window-sliding",
      label: "Sliding Window",
      category: "windows",
      modelFile: "sliding-window.glb",
      textureFile: "glass-clear.png",
      tags: ["window", "sliding"],
      description: "Horizontal sliding window for compact openings.",
      dimensions: {
        widthMeters: 1.5,
        heightMeters: 1.1,
        thicknessMeters: 0.04,
      },
    }),
  ],
  furniture: [
    createAsset({
      id: "furniture-task-chair",
      label: "Task Chair",
      category: "furniture",
      modelFile: "task-chair.glb",
      textureFile: "fabric-dark.png",
      tags: ["furniture", "chair", "office"],
      description: "Basic office chair for workspace scenes.",
      dimensions: {
        widthMeters: 0.6,
        heightMeters: 0.95,
        depthMeters: 0.6,
      },
    }),
    createAsset({
      id: "furniture-work-desk",
      label: "Work Desk",
      category: "furniture",
      modelFile: "work-desk.glb",
      textureFile: "wood-light.png",
      tags: ["furniture", "desk", "table"],
      description: "Simple desk for office and study rooms.",
      dimensions: {
        widthMeters: 1.4,
        heightMeters: 0.75,
        depthMeters: 0.7,
      },
    }),
    createAsset({
      id: "furniture-meeting-table",
      label: "Meeting Table",
      category: "furniture",
      modelFile: "meeting-table.glb",
      textureFile: "wood-dark.png",
      tags: ["furniture", "table", "meeting"],
      description: "Medium conference table for collaboration spaces.",
      dimensions: {
        widthMeters: 2.4,
        heightMeters: 0.75,
        depthMeters: 1.1,
      },
    }),
  ],
  lights: [
    createAsset({
      id: "light-recessed-downlight",
      label: "Recessed Downlight",
      category: "lights",
      modelFile: "recessed-downlight.glb",
      textureFile: "metal-white.png",
      tags: ["light", "ceiling", "downlight"],
      description: "Minimal recessed ceiling light.",
      dimensions: {
        widthMeters: 0.18,
        heightMeters: 0.05,
        depthMeters: 0.18,
        mountHeightMeters: 2.8,
      },
    }),
    createAsset({
      id: "light-pendant",
      label: "Pendant Light",
      category: "lights",
      modelFile: "pendant-light.glb",
      textureFile: "metal-black.png",
      tags: ["light", "pendant", "ceiling"],
      description: "Suspended light for common areas and meeting rooms.",
      dimensions: {
        widthMeters: 0.28,
        heightMeters: 0.55,
        depthMeters: 0.28,
        mountHeightMeters: 2.5,
      },
    }),
    createAsset({
      id: "light-wall-sconce",
      label: "Wall Sconce",
      category: "lights",
      modelFile: "wall-sconce.glb",
      textureFile: "metal-brass.png",
      tags: ["light", "wall", "sconce"],
      description: "Wall-mounted accent light.",
      dimensions: {
        widthMeters: 0.22,
        heightMeters: 0.35,
        depthMeters: 0.18,
        mountHeightMeters: 2.0,
      },
    }),
  ],
};

export const wallTypeAssetMap = {
  "Brick Wall": "wall-brick",
  "Cement block Wall": "wall-cement-block",
  "Concrete Wall": "wall-concrete",
} as const;

export type WallTypeLabel = keyof typeof wallTypeAssetMap;

export type WallPatternKind = "brick" | "block" | "concrete";

export type WallAppearance = {
  fill: string;
  stroke: string;
  patternKind: WallPatternKind;
};

export const wallTypeLabels = Object.keys(wallTypeAssetMap) as WallTypeLabel[];

export const wallAppearanceByType: Record<WallTypeLabel, WallAppearance> = {
  "Brick Wall": {
    fill: "rgb(183, 67, 45)",
    stroke: "rgb(101, 34, 22)",
    patternKind: "brick",
  },
  "Cement block Wall": {
    fill: "rgb(221, 224, 227)",
    stroke: "rgb(106, 114, 123)",
    patternKind: "block",
  },
  "Concrete Wall": {
    fill: "rgb(164, 170, 176)",
    stroke: "rgb(72, 80, 88)",
    patternKind: "concrete",
  },
};

export function getWallAssetByType(wallType: string) {
  const assetId = wallTypeAssetMap[wallType as WallTypeLabel];
  return assetId ? getAssetById(assetId) : undefined;
}

export function getWallAppearanceByType(wallType: string): WallAppearance {
  return wallAppearanceByType[wallType as WallTypeLabel] ?? wallAppearanceByType["Brick Wall"];
}

export function getAssetsByCategory(category: AssetCategory) {
  return assetCatalog[category];
}

export function getAssetById(assetId: string) {
  for (const category of assetCategoryOrder) {
    const match = assetCatalog[category].find((asset) => asset.id === assetId);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function getAssetModelPath(category: AssetCategory, fileName: string) {
  return buildPath(MODEL_ROOT, category, fileName);
}

export function getAssetTexturePath(category: AssetCategory, fileName: string) {
  return buildPath(TEXTURE_ROOT, category, fileName);
}

export { assetCategoryOrder };
