export type AssetCategory = "walls" | "roofs" | "doors" | "windows" | "furniture" | "lights";

export type AssetDimensions = {
  widthMeters?: number;
  heightMeters?: number;
  depthMeters?: number;
  thicknessMeters?: number;
  mountHeightMeters?: number;
};

export type AssetItem = {
  id: string;
  label: string;
  category: AssetCategory;
  modelPath: string;
  texturePath?: string;
  tags: string[];
  description?: string;
  dimensions?: AssetDimensions;
};

export type AssetCatalog = Record<AssetCategory, AssetItem[]>;
