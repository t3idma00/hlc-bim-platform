"use client";

import { useEffect, useRef, useState } from "react";

const RULER_SIZE = 24;
const LEFT_RULER_SIZE = 32;
const BASE_GRID_SIZE = 40;

export function HeatLoadCanvasPanel() {
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
      draw();
    };

    function drawRulers(
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      gridSize: number,
      offsetX: number,
      offsetY: number
    ) {
      // background
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, RULER_SIZE);
      ctx.fillRect(0, 0, LEFT_RULER_SIZE, height);

      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;

      // borders
      ctx.beginPath();
      ctx.moveTo(0, RULER_SIZE);
      ctx.lineTo(width, RULER_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(LEFT_RULER_SIZE, 0);
      ctx.lineTo(LEFT_RULER_SIZE, height);
      ctx.stroke();

      ctx.fillStyle = "#334155";
      ctx.font = "10px sans-serif";
      ctx.textBaseline = "middle";

      const subStep = gridSize / 4;

      //  TOP RULER 
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

        ctx.beginPath();
        ctx.moveTo(x, RULER_SIZE);
        ctx.lineTo(x, RULER_SIZE - tick);
        ctx.stroke();

        if (showLabel) {
          const value = Math.floor(indexX / 4);
          ctx.fillText(value.toString(), x + 2, 10);
        }

        indexX++;
      }

      // LEFT RULER 
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

        ctx.beginPath();
        ctx.moveTo(LEFT_RULER_SIZE, y);
        ctx.lineTo(LEFT_RULER_SIZE - tick, y);
        ctx.stroke();

        if (showLabel) {
          const value = -Math.floor(indexY / 4);

          ctx.save();
          ctx.translate(10, y);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(value.toString(), 0, 0);
          ctx.restore();
        }

        indexY++;
      }
    }

    function drawGrid(
      ctx: CanvasRenderingContext2D,
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

      ctx.save();
      ctx.beginPath();
      ctx.rect(drawX, drawY, drawWidth, drawHeight);
      ctx.clip();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(drawX, drawY, drawWidth, drawHeight);

      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;

      const startX = drawX + (((offsetX % gridSize) + gridSize) % gridSize);
      for (let x = startX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, drawY);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      const startY = drawY + (((offsetY % gridSize) + gridSize) % gridSize);
      for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(drawX, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.restore();
    }

    function draw() {
      const width = canvas.width;
      const height = canvas.height;
      const gridSize = BASE_GRID_SIZE * scale;

      ctx.clearRect(0, 0, width, height);

      drawGrid(
        ctx,
        width,
        height,
        gridSize,
        offsetRef.current.x,
        offsetRef.current.y
      );

      drawRulers(
        ctx,
        width,
        height,
        gridSize,
        offsetRef.current.x,
        offsetRef.current.y
      );
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setScale((prev) => Math.max(0.4, Math.min(prev * zoomFactor, 4)));
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;

      offsetRef.current.x += dx;
      offsetRef.current.y += dy;

      lastMouse.current = { x: e.clientX, y: e.clientY };

      draw();
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
  }, [scale]);

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

          <div className="absolute right-4 top-4 rounded border border-rose-100 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            <div className="font-semibold text-slate-800">Scale</div>
            <div>1 main step = 1 unit</div>
          </div>
        </div>
      </div>

      <div className="border-t border-rose-100 bg-[#fffafb] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <span>Mode: Plan View</span>
          <span>Zoom: {Math.round(scale * 100)}%</span>
          <span>Pan enabled</span>
        </div>
      </div>
    </section>
  );
}
