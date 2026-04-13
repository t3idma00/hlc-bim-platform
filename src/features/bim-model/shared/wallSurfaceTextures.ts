"use client";

import * as THREE from "three";
import { getWallAppearanceByType } from "@/data/assets";

type WallTextureParams = {
  wallType: string;
  wallLength: number;
  wallHeight: number;
};

const PIXELS_PER_METER = 128;

// Standard brick module dimensions in meters:
// 215 mm brick length, 65 mm brick height, 10 mm mortar joints.
const BRICK_LENGTH_METERS = 0.215;
const BRICK_HEIGHT_METERS = 0.065;
const BRICK_MORTAR_METERS = 0.01;

// Standard CMU-style block module used for the cement block wall variant.
const BLOCK_LENGTH_METERS = 0.39;
const BLOCK_HEIGHT_METERS = 0.19;
const BLOCK_MORTAR_METERS = 0.01;

export function createWallSurfaceTexture({
  wallType,
  wallLength,
  wallHeight,
}: WallTextureParams) {
  const appearance = getWallAppearanceByType(wallType);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.round(wallLength * PIXELS_PER_METER), 256);
  canvas.height = Math.max(Math.round(wallHeight * PIXELS_PER_METER), 256);
  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = appearance.fill;
  context.fillRect(0, 0, canvas.width, canvas.height);

  switch (appearance.patternKind) {
    case "brick":
      drawBrickPattern(context, appearance.fill, appearance.stroke);
      break;
    case "block":
      drawBlockPattern(context, appearance.fill, appearance.stroke);
      break;
    case "concrete":
      drawConcretePattern(context, appearance.fill, appearance.stroke);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return texture;
}

function drawBrickPattern(
  context: CanvasRenderingContext2D,
  fillColor: string,
  mortarColor: string
) {
  const canvasWidth = context.canvas.width;
  const canvasHeight = context.canvas.height;
  const brickWidth = Math.max(Math.round(BRICK_LENGTH_METERS * PIXELS_PER_METER), 1);
  const brickHeight = Math.max(Math.round(BRICK_HEIGHT_METERS * PIXELS_PER_METER), 1);
  const mortar = Math.max(Math.round(BRICK_MORTAR_METERS * PIXELS_PER_METER), 1);
  const stepX = brickWidth + mortar;
  const stepY = brickHeight + mortar;
  const rows = Math.ceil(canvasHeight / stepY) + 2;
  const columns = Math.ceil(canvasWidth / stepX) + 2;

  context.fillStyle = mortarColor;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let row = -1; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : stepX / 2;
    const y = row * stepY;

    for (let column = -1; column < columns; column += 1) {
      const x = column * stepX + offset;

      context.save();
      context.fillStyle = fillColor;
      context.globalAlpha = 0.96;
      context.fillRect(x, y, brickWidth, brickHeight);

      const gradient = context.createLinearGradient(x, y, x + brickWidth, y + brickHeight);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.03)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.09)");
      context.globalAlpha = 1;
      context.fillStyle = gradient;
      context.fillRect(x, y, brickWidth, brickHeight);

      context.strokeStyle = mortarColor;
      context.lineWidth = mortar;
      context.strokeRect(x, y, brickWidth, brickHeight);

      drawSubtleSpeckles(context, x, y, brickWidth, brickHeight, row * 17 + column * 13);
      context.restore();
    }
  }
}

function drawBlockPattern(
  context: CanvasRenderingContext2D,
  fillColor: string,
  mortarColor: string
) {
  const canvasWidth = context.canvas.width;
  const canvasHeight = context.canvas.height;
  const blockWidth = Math.max(Math.round(BLOCK_LENGTH_METERS * PIXELS_PER_METER), 1);
  const blockHeight = Math.max(Math.round(BLOCK_HEIGHT_METERS * PIXELS_PER_METER), 1);
  const mortar = Math.max(Math.round(BLOCK_MORTAR_METERS * PIXELS_PER_METER), 1);
  const stepX = blockWidth + mortar;
  const stepY = blockHeight + mortar;
  const rows = Math.ceil(canvasHeight / stepY) + 2;
  const columns = Math.ceil(canvasWidth / stepX) + 2;

  context.fillStyle = mortarColor;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let row = -1; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : stepX / 2;
    const y = row * stepY;

    for (let column = -1; column < columns; column += 1) {
      const x = column * stepX + offset;

      context.save();
      context.fillStyle = fillColor;
      context.globalAlpha = 0.98;
      context.fillRect(x, y, blockWidth, blockHeight);

      const gradient = context.createLinearGradient(x, y, x + blockWidth, y + blockHeight);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.10)");
      gradient.addColorStop(0.48, "rgba(255, 255, 255, 0.03)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.08)");
      context.globalAlpha = 1;
      context.fillStyle = gradient;
      context.fillRect(x, y, blockWidth, blockHeight);

      context.strokeStyle = mortarColor;
      context.lineWidth = mortar;
      context.strokeRect(x, y, blockWidth, blockHeight);

      context.beginPath();
      context.moveTo(x, y + blockHeight / 2);
      context.lineTo(x + blockWidth, y + blockHeight / 2);
      context.strokeStyle = "rgba(255, 255, 255, 0.06)";
      context.lineWidth = 2;
      context.stroke();

      drawSubtleSpeckles(context, x, y, blockWidth, blockHeight, row * 23 + column * 19);
      context.restore();
    }
  }
}

function drawConcretePattern(
  context: CanvasRenderingContext2D,
  fillColor: string,
  mortarColor: string
) {
  const canvasWidth = context.canvas.width;
  const canvasHeight = context.canvas.height;

  context.fillStyle = fillColor;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const gradient = context.createLinearGradient(0, 0, canvasWidth, canvasHeight);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.10)");
  gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.03)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.07)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const cellSize = 32;
  const rows = Math.ceil(canvasHeight / cellSize);
  const columns = Math.ceil(canvasWidth / cellSize);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * cellSize;
      const y = row * cellSize;
      const seed = row * 37 + column * 19;

      context.fillStyle = `rgba(255, 255, 255, ${0.02 + pseudoRandom(seed) * 0.03})`;
      context.fillRect(x, y, cellSize, cellSize);

      context.fillStyle = `rgba(0, 0, 0, ${0.015 + pseudoRandom(seed + 9) * 0.03})`;
      context.fillRect(x + 3, y + 3, cellSize - 6, cellSize - 6);

      drawSubtleSpeckles(context, x, y, cellSize, cellSize, seed);
    }
  }

  context.strokeStyle = mortarColor;
  context.globalAlpha = 0.14;
  context.lineWidth = 1;

  for (let row = 1; row < rows; row += 1) {
    context.beginPath();
    context.moveTo(0, row * cellSize);
    context.lineTo(canvasWidth, row * cellSize);
    context.stroke();
  }

  for (let column = 1; column < columns; column += 1) {
    context.beginPath();
    context.moveTo(column * cellSize, 0);
    context.lineTo(column * cellSize, canvasHeight);
    context.stroke();
  }

  context.globalAlpha = 1;
}

function drawSubtleSpeckles(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number
) {
  const dotCount = Math.max(Math.round((width * height) / 1200), 3);

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

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
