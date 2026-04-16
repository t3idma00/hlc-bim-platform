"use client";

import * as THREE from "three";
import { getWallAppearanceByType } from "@/data/assets";

type WallTextureParams = {
  wallType: string;
  wallLength: number;
  wallHeight: number;
};

export type WallSurfaceTextureSet = {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  normalScale: number;
};

type WallSurfaceCacheEntry = {
  mapCanvas: HTMLCanvasElement;
  normalCanvas: HTMLCanvasElement;
  tileSizeMeters: number;
  normalScale: number;
};

const WALL_TEXTURE_PIXELS_PER_METER = 400;

// Keep the tile close to 1K while staying aligned to real brick/block modules.
const BRICK_LENGTH_METERS = 0.215;
const BRICK_HEIGHT_METERS = 0.065;
const BRICK_MORTAR_METERS = 0.01;
const BRICK_TILE_SIZE_METERS = 2.25;
const BRICK_NORMAL_STRENGTH = 1.15;
const BRICK_NORMAL_SCALE = 0.32;

const BLOCK_LENGTH_METERS = 0.39;
const BLOCK_HEIGHT_METERS = 0.19;
const BLOCK_MORTAR_METERS = 0.01;
const BLOCK_TILE_SIZE_METERS = 2.0;
const BLOCK_NORMAL_STRENGTH = 1.0;
const BLOCK_NORMAL_SCALE = 0.24;

const CONCRETE_TILE_SIZE_METERS = 2.0;
const CONCRETE_CELL_SIZE_PX = 40;
const CONCRETE_NORMAL_STRENGTH = 0.7;
const CONCRETE_NORMAL_SCALE = 0.08;

const wallSurfaceCache = new Map<string, WallSurfaceCacheEntry>();

export function createWallSurfaceTexture({ wallType, wallLength, wallHeight }: WallTextureParams) {
  const cacheEntry = getWallSurfaceCacheEntry(wallType);

  return createConfiguredTexture(
    cacheEntry.mapCanvas,
    wallLength,
    wallHeight,
    cacheEntry.tileSizeMeters,
    true
  );
}

export function createWallSurfaceTextureSet({
  wallType,
  wallLength,
  wallHeight,
}: WallTextureParams): WallSurfaceTextureSet {
  const cacheEntry = getWallSurfaceCacheEntry(wallType);

  return {
    map: createConfiguredTexture(
      cacheEntry.mapCanvas,
      wallLength,
      wallHeight,
      cacheEntry.tileSizeMeters,
      true
    ),
    normalMap: createConfiguredTexture(
      cacheEntry.normalCanvas,
      wallLength,
      wallHeight,
      cacheEntry.tileSizeMeters,
      false
    ),
    normalScale: cacheEntry.normalScale,
  };
}

function getWallSurfaceCacheEntry(wallType: string): WallSurfaceCacheEntry {
  const appearance = getWallAppearanceByType(wallType);
  const cacheKey = `${appearance.patternKind}|${appearance.fill}|${appearance.stroke}`;
  const cached = wallSurfaceCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const profile = getSurfaceProfile(appearance.patternKind);
  const canvasSize = Math.max(Math.round(profile.tileSizeMeters * WALL_TEXTURE_PIXELS_PER_METER), 256);
  const mapCanvas = createCanvas(canvasSize, canvasSize);
  const heightCanvas = createCanvas(canvasSize, canvasSize);
  const mapContext = mapCanvas.getContext("2d");
  const heightContext = heightCanvas.getContext("2d");

  if (!mapContext || !heightContext) {
    const fallbackCanvas = createCanvas(1, 1);
    const fallbackEntry: WallSurfaceCacheEntry = {
      mapCanvas: fallbackCanvas,
      normalCanvas: fallbackCanvas,
      tileSizeMeters: profile.tileSizeMeters,
      normalScale: profile.normalScale,
    };

    wallSurfaceCache.set(cacheKey, fallbackEntry);
    return fallbackEntry;
  }

  switch (appearance.patternKind) {
    case "brick":
      drawBrickSurface(mapContext, heightContext, appearance.fill, appearance.stroke);
      break;
    case "block":
      drawBlockSurface(mapContext, heightContext, appearance.fill, appearance.stroke);
      break;
    case "concrete":
      drawConcreteSurface(mapContext, heightContext, appearance.fill, appearance.stroke);
      break;
  }

  const normalCanvas = createNormalMapCanvas(heightCanvas, profile.normalStrength);
  const entry = {
    mapCanvas,
    normalCanvas,
    tileSizeMeters: profile.tileSizeMeters,
    normalScale: profile.normalScale,
  };

  wallSurfaceCache.set(cacheKey, entry);
  return entry;
}

function getSurfaceProfile(patternKind: "brick" | "block" | "concrete") {
  switch (patternKind) {
    case "brick":
      return {
        tileSizeMeters: BRICK_TILE_SIZE_METERS,
        normalStrength: BRICK_NORMAL_STRENGTH,
        normalScale: BRICK_NORMAL_SCALE,
      };
    case "block":
      return {
        tileSizeMeters: BLOCK_TILE_SIZE_METERS,
        normalStrength: BLOCK_NORMAL_STRENGTH,
        normalScale: BLOCK_NORMAL_SCALE,
      };
    case "concrete":
      return {
        tileSizeMeters: CONCRETE_TILE_SIZE_METERS,
        normalStrength: CONCRETE_NORMAL_STRENGTH,
        normalScale: CONCRETE_NORMAL_SCALE,
      };
  }
}

function createConfiguredTexture(
  canvas: HTMLCanvasElement,
  wallLength: number,
  wallHeight: number,
  tileSizeMeters: number,
  isColorMap: boolean
) {
  const texture = new THREE.CanvasTexture(canvas);

  if (isColorMap) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.repeat.set(
    Math.max(wallLength / tileSizeMeters, 0.001),
    Math.max(wallHeight / tileSizeMeters, 0.001)
  );
  texture.needsUpdate = true;

  return texture;
}

function drawBrickSurface(
  mapContext: CanvasRenderingContext2D,
  heightContext: CanvasRenderingContext2D,
  fillColor: string,
  mortarColor: string
) {
  const canvasSize = mapContext.canvas.width;
  const brickWidth = Math.max(Math.round(BRICK_LENGTH_METERS * WALL_TEXTURE_PIXELS_PER_METER), 1);
  const brickHeight = Math.max(Math.round(BRICK_HEIGHT_METERS * WALL_TEXTURE_PIXELS_PER_METER), 1);
  const mortar = Math.max(Math.round(BRICK_MORTAR_METERS * WALL_TEXTURE_PIXELS_PER_METER), 1);
  const stepX = brickWidth + mortar;
  const stepY = brickHeight + mortar;
  const rows = Math.ceil(canvasSize / stepY) + 2;
  const columns = Math.ceil(canvasSize / stepX) + 2;

  mapContext.fillStyle = mortarColor;
  mapContext.fillRect(0, 0, canvasSize, canvasSize);

  heightContext.fillStyle = gray(0.28);
  heightContext.fillRect(0, 0, canvasSize, canvasSize);

  for (let row = -1; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : stepX / 2;
    const y = row * stepY;

    for (let column = -1; column < columns; column += 1) {
      const x = column * stepX + offset;
      const seed = row * 41 + column * 17;
      const colorVariation = (pseudoRandom(seed) - 0.5) * 0.03;
      const heightVariation = (pseudoRandom(seed + 11) - 0.5) * 0.05;

      mapContext.save();
      mapContext.fillStyle = fillColor;
      mapContext.globalAlpha = 0.96 + colorVariation * 0.2;
      mapContext.fillRect(x, y, brickWidth, brickHeight);

      const gradient = mapContext.createLinearGradient(x, y, x + brickWidth, y + brickHeight);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.16)");
      gradient.addColorStop(0.45, "rgba(255, 255, 255, 0.05)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.14)");
      mapContext.globalAlpha = 1;
      mapContext.fillStyle = gradient;
      mapContext.fillRect(x, y, brickWidth, brickHeight);

      mapContext.strokeStyle = mortarColor;
      mapContext.lineWidth = mortar;
      mapContext.strokeRect(x, y, brickWidth, brickHeight);

      mapContext.strokeStyle = "rgba(255, 255, 255, 0.06)";
      mapContext.lineWidth = 1;
      mapContext.beginPath();
      mapContext.moveTo(x + 1, y + 1);
      mapContext.lineTo(x + brickWidth - 1, y + 1);
      mapContext.stroke();

      drawSubtleSpeckles(mapContext, x, y, brickWidth, brickHeight, seed);
      mapContext.restore();

      paintHeightRect(heightContext, x, y, brickWidth, brickHeight, 0.74 + heightVariation);
      paintHeightRect(heightContext, x + 1, y + 1, brickWidth - 2, brickHeight - 2, 0.8 + heightVariation);
      paintHeightRect(heightContext, x, y, brickWidth, 2, 0.62 + heightVariation);
      paintHeightRect(heightContext, x, y + brickHeight - 2, brickWidth, 2, 0.58 + heightVariation);
      paintHeightRect(heightContext, x, y, 2, brickHeight, 0.62 + heightVariation);
      paintHeightRect(heightContext, x + brickWidth - 2, y, 2, brickHeight, 0.58 + heightVariation);
    }
  }
}

function drawBlockSurface(
  mapContext: CanvasRenderingContext2D,
  heightContext: CanvasRenderingContext2D,
  fillColor: string,
  mortarColor: string
) {
  const canvasSize = mapContext.canvas.width;
  const blockWidth = Math.max(Math.round(BLOCK_LENGTH_METERS * WALL_TEXTURE_PIXELS_PER_METER), 1);
  const blockHeight = Math.max(Math.round(BLOCK_HEIGHT_METERS * WALL_TEXTURE_PIXELS_PER_METER), 1);
  const mortar = Math.max(Math.round(BLOCK_MORTAR_METERS * WALL_TEXTURE_PIXELS_PER_METER), 1);
  const stepX = blockWidth + mortar;
  const stepY = blockHeight + mortar;
  const rows = Math.ceil(canvasSize / stepY) + 2;
  const columns = Math.ceil(canvasSize / stepX) + 2;

  mapContext.fillStyle = mortarColor;
  mapContext.fillRect(0, 0, canvasSize, canvasSize);

  heightContext.fillStyle = gray(0.3);
  heightContext.fillRect(0, 0, canvasSize, canvasSize);

  for (let row = -1; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : stepX / 2;
    const y = row * stepY;

    for (let column = -1; column < columns; column += 1) {
      const x = column * stepX + offset;
      const seed = row * 29 + column * 23;
      const colorVariation = (pseudoRandom(seed) - 0.5) * 0.02;
      const heightVariation = (pseudoRandom(seed + 7) - 0.5) * 0.04;

      mapContext.save();
      mapContext.fillStyle = fillColor;
      mapContext.globalAlpha = 0.97 + colorVariation * 0.2;
      mapContext.fillRect(x, y, blockWidth, blockHeight);

      const gradient = mapContext.createLinearGradient(x, y, x + blockWidth, y + blockHeight);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.1)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.03)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.12)");
      mapContext.globalAlpha = 1;
      mapContext.fillStyle = gradient;
      mapContext.fillRect(x, y, blockWidth, blockHeight);

      mapContext.strokeStyle = mortarColor;
      mapContext.lineWidth = mortar;
      mapContext.strokeRect(x, y, blockWidth, blockHeight);

      mapContext.beginPath();
      mapContext.moveTo(x, y + blockHeight / 2);
      mapContext.lineTo(x + blockWidth, y + blockHeight / 2);
      mapContext.strokeStyle = "rgba(255, 255, 255, 0.07)";
      mapContext.lineWidth = 2;
      mapContext.stroke();

      drawSubtleSpeckles(mapContext, x, y, blockWidth, blockHeight, seed);
      mapContext.restore();

      paintHeightRect(heightContext, x, y, blockWidth, blockHeight, 0.7 + heightVariation);
      paintHeightRect(heightContext, x + 1, y + 1, blockWidth - 2, blockHeight - 2, 0.76 + heightVariation);
      paintHeightRect(
        heightContext,
        x,
        y + blockHeight / 2 - 1,
        blockWidth,
        2,
        0.6 + heightVariation
      );
    }
  }
}

function drawConcreteSurface(
  mapContext: CanvasRenderingContext2D,
  heightContext: CanvasRenderingContext2D,
  fillColor: string,
  mortarColor: string
) {
  const canvasSize = mapContext.canvas.width;
  const cellSize = CONCRETE_CELL_SIZE_PX;
  const cells = Math.ceil(canvasSize / cellSize);
  const periodicCells = Math.max(cells - 1, 1);

  mapContext.fillStyle = fillColor;
  mapContext.fillRect(0, 0, canvasSize, canvasSize);

  heightContext.fillStyle = gray(0.52);
  heightContext.fillRect(0, 0, canvasSize, canvasSize);

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const x = column * cellSize;
      const y = row * cellSize;
      const wrappedRow = row % periodicCells;
      const wrappedColumn = column % periodicCells;
      const seed = wrappedRow * 37 + wrappedColumn * 19;
      const colorTone = pseudoRandom(seed);
      const heightTone = pseudoRandom(seed + 9);
      const highlightX = x + cellSize * (0.28 + pseudoRandom(seed + 1) * 0.36);
      const highlightY = y + cellSize * (0.28 + pseudoRandom(seed + 2) * 0.36);
      const highlightRadius = cellSize * (0.34 + pseudoRandom(seed + 3) * 0.22);
      const shadowX = x + cellSize * (0.58 + pseudoRandom(seed + 4) * 0.18);
      const shadowY = y + cellSize * (0.58 + pseudoRandom(seed + 5) * 0.18);
      const shadowRadius = cellSize * (0.28 + pseudoRandom(seed + 6) * 0.18);

      mapContext.save();
      const highlight = mapContext.createRadialGradient(
        highlightX,
        highlightY,
        0,
        highlightX,
        highlightY,
        highlightRadius
      );
      highlight.addColorStop(0, `rgba(255, 255, 255, ${0.03 + colorTone * 0.025})`);
      highlight.addColorStop(0.8, `rgba(255, 255, 255, ${0.01 + colorTone * 0.01})`);
      highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
      mapContext.fillStyle = highlight;
      mapContext.fillRect(x, y, cellSize, cellSize);

      const shadow = mapContext.createRadialGradient(
        shadowX,
        shadowY,
        0,
        shadowX,
        shadowY,
        shadowRadius
      );
      shadow.addColorStop(0, `rgba(0, 0, 0, ${0.015 + colorTone * 0.02})`);
      shadow.addColorStop(0.85, `rgba(0, 0, 0, ${0.006 + colorTone * 0.01})`);
      shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
      mapContext.fillStyle = shadow;
      mapContext.fillRect(x, y, cellSize, cellSize);

      drawSubtleSpeckles(mapContext, x, y, cellSize, cellSize, seed);
      mapContext.restore();

      const baseHeight = 0.49 + (heightTone - 0.5) * 0.1;
      paintHeightRect(heightContext, x, y, cellSize, cellSize, baseHeight);
      paintHeightRect(
        heightContext,
        x + 3,
        y + 3,
        cellSize - 6,
        cellSize - 6,
        baseHeight + (pseudoRandom(seed + 10) - 0.5) * 0.04
      );

      if (column < cells - 1) {
        paintHeightRect(
          heightContext,
          x + cellSize - 1,
          y,
          1,
          cellSize,
          0.43 + (heightTone - 0.5) * 0.05
        );
      }

      if (row < cells - 1) {
        paintHeightRect(
          heightContext,
          x,
          y + cellSize - 1,
          cellSize,
          1,
          0.43 + (heightTone - 0.5) * 0.05
        );
      }
    }
  }

  mapContext.strokeStyle = mortarColor;
  mapContext.globalAlpha = 0.05;
  mapContext.lineWidth = 1;

  for (let row = 1; row < cells; row += 1) {
    mapContext.beginPath();
    mapContext.moveTo(0, row * cellSize);
    mapContext.lineTo(canvasSize, row * cellSize);
    mapContext.stroke();
  }

  for (let column = 1; column < cells; column += 1) {
    mapContext.beginPath();
    mapContext.moveTo(column * cellSize, 0);
    mapContext.lineTo(column * cellSize, canvasSize);
    mapContext.stroke();
  }

  mapContext.globalAlpha = 1;
}

function createNormalMapCanvas(heightCanvas: HTMLCanvasElement, strength: number) {
  const width = heightCanvas.width;
  const height = heightCanvas.height;
  const heightContext = heightCanvas.getContext("2d");
  const normalCanvas = createCanvas(width, height);
  const normalContext = normalCanvas.getContext("2d");

  if (!heightContext || !normalContext) {
    return normalCanvas;
  }

  const imageData = heightContext.getImageData(0, 0, width, height);
  const source = imageData.data;
  const output = normalContext.createImageData(width, height);
  const target = output.data;

  for (let y = 0; y < height; y += 1) {
    const upY = (y - 1 + height) % height;
    const downY = (y + 1) % height;

    for (let x = 0; x < width; x += 1) {
      const leftX = (x - 1 + width) % width;
      const rightX = (x + 1) % width;

      const left = readHeight(source, width, leftX, y);
      const right = readHeight(source, width, rightX, y);
      const up = readHeight(source, width, x, upY);
      const down = readHeight(source, width, x, downY);

      const nx = (left - right) * strength;
      const ny = (up - down) * strength;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      const index = (y * width + x) * 4;

      target[index] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      target[index + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      target[index + 2] = Math.round(((nz / length) * 0.5 + 0.5) * 255);
      target[index + 3] = 255;
    }
  }

  normalContext.putImageData(output, 0, 0);
  return normalCanvas;
}

function readHeight(source: Uint8ClampedArray, width: number, x: number, y: number) {
  const index = (y * width + x) * 4;
  return source[index] / 255;
}

function paintHeightRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number
) {
  const safeWidth = Math.max(width, 0);
  const safeHeight = Math.max(height, 0);

  if (safeWidth <= 0 || safeHeight <= 0) {
    return;
  }

  context.fillStyle = gray(value);
  context.fillRect(x, y, safeWidth, safeHeight);
}

function drawSubtleSpeckles(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
) {
  const dotCount = Math.max(Math.round((width * height) / 1800), 2);

  for (let index = 0; index < dotCount; index += 1) {
    const localSeed = seed + index * 11;
    const px = x + pseudoRandom(localSeed) * width;
    const py = y + pseudoRandom(localSeed + 5) * height;
    const radius = 0.6 + pseudoRandom(localSeed + 9) * 1.4;
    const alpha = 0.03 + pseudoRandom(localSeed + 15) * 0.06;

    context.beginPath();
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    context.arc(px, py, radius, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
    context.arc(px + 1.1, py + 1.1, radius * 0.8, 0, Math.PI * 2);
    context.fill();
  }
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function gray(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  const shade = Math.round(clamped * 255);
  return `rgb(${shade}, ${shade}, ${shade})`;
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
