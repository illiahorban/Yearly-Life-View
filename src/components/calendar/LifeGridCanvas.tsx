import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { LifeSettings, LifeView } from "../../types/calendar";
import { startOfDay, addDays, sameDay, daysBetween, monthsBetween, addYears, dayOfYear } from "../../utils/date-utils";
import { LIFE_ACCENT } from "../../constants/colors";

function _drawRR(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const minR = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + minR, y);
  ctx.arcTo(x + w, y, x + w, y + h, minR);
  ctx.arcTo(x + w, y + h, x, y + h, minR);
  ctx.arcTo(x, y + h, x, y, minR);
  ctx.arcTo(x, y, x + w, y, minR);
  ctx.closePath();
}

export const LifeGridCanvas = React.memo(function LifeGridCanvas({
  totalUnits,
  currentCell,
  cellPx,
  gapPx,
  numCols,
  dark,
  birthYear,
  showYearLabels,
  labelWidth = 0,
  viewType,
}: {
  totalUnits: number;
  currentCell: number;
  cellPx: number;
  gapPx: number;
  numCols: number;
  dark: boolean;
  birthYear?: number | null;
  showYearLabels?: boolean;
  labelWidth?: number;
  viewType?: LifeView;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rows = Math.ceil(totalUnits / numCols);
  const pitch = cellPx + gapPx;
  const gridW = numCols * pitch - gapPx;

  const showColHeaders = (viewType === "months" || viewType === "weeks") && numCols > 1;
  const colHeaderHeight = showColHeaders ? (viewType === "months" ? 18 : 16) : 0;
  const colFontSize =
    viewType === "months"
      ? Math.max(8, Math.min(10, Math.floor(cellPx * 0.45 + 5)))
      : Math.max(7, Math.min(9, Math.floor(cellPx * 0.6 + 3)));

  const fontSize =
    showYearLabels && labelWidth > 0
      ? Math.max(8, Math.min(10, Math.floor(cellPx * 0.95 + 4)))
      : 0;

  const padTop = showColHeaders
    ? colHeaderHeight + (showYearLabels && labelWidth > 0 ? 6 : 2)
    : showYearLabels && labelWidth > 0
      ? Math.max(8, Math.ceil(fontSize / 2 - cellPx / 2 + 4))
      : 2;
  const padBottom = Math.max(8, Math.ceil(fontSize / 2 - cellPx / 2 + 4));
  const cw = labelWidth + gridW;
  const ch = padTop + (rows * pitch - gapPx) + padBottom;
  const radius = Math.max(0, Math.floor(cellPx / 5));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(cw * dpr);
    canvas.height = Math.ceil(ch * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pastFill = "#007aff";
    const currFill = "rgba(0,122,255,0.45)";
    const futureFill = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)";
    const offsetX = labelWidth;

    // ── Horizontal column numbering (1..12 for months, 1..52 for weeks) ──
    if (showColHeaders) {
      ctx.font = `${colFontSize}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = dark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.48)";
      const headerY = padTop - (viewType === "months" ? 10 : 9);

      if (viewType === "months") {
        for (let c = 0; c < 12 && c < numCols; c++) {
          const cx = offsetX + c * pitch + cellPx / 2;
          ctx.fillText(String(c + 1), cx, headerY);
        }
      } else if (viewType === "weeks") {
        const step = pitch >= 12 ? 1 : pitch >= 8 ? 2 : pitch >= 4.5 ? 5 : 10;
        for (let c = 0; c < 52 && c < numCols; c++) {
          const weekNum = c + 1;
          const shouldDraw =
            step === 1 ||
            weekNum === 1 ||
            weekNum === 52 ||
            weekNum % step === 0;

          if (weekNum === 50 && step === 5 && pitch < 5.5) {
            continue;
          }

          if (shouldDraw) {
            const cx = offsetX + c * pitch + cellPx / 2;
            ctx.fillText(String(weekNum), cx, headerY);
          }
        }
      }
    }

    // ── Year labels: render alternate years (1999, 2001, 2003, ...) on mobile and desktop ──
    if (showYearLabels && birthYear != null && labelWidth > 0) {
      const step = 2;
      ctx.font = `${fontSize}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)";
      for (let r = 0; r < rows; r++) {
        if (r % step === 0) {
          const yr = birthYear + r;
          const yPos = padTop + r * pitch + cellPx / 2;
          ctx.fillText(String(yr), labelWidth - 6, yPos);
        }
      }
    }

    // ── Future cells ──────────────────────────────────────────────────────
    ctx.fillStyle = futureFill;
    ctx.beginPath();
    for (let i = currentCell + 1; i < totalUnits; i++) {
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      const x = offsetX + col * pitch;
      const y = padTop + row * pitch;
      if (radius > 0) _drawRR(ctx, x, y, cellPx, cellPx, radius);
      else ctx.rect(x, y, cellPx, cellPx);
    }
    ctx.fill();

    // ── Past cells ────────────────────────────────────────────────────────
    ctx.fillStyle = pastFill;
    ctx.beginPath();
    for (let i = 0; i < currentCell && i < totalUnits; i++) {
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      const x = offsetX + col * pitch;
      const y = padTop + row * pitch;
      if (radius > 0) _drawRR(ctx, x, y, cellPx, cellPx, radius);
      else ctx.rect(x, y, cellPx, cellPx);
    }
    ctx.fill();

    // ── Current cell ──────────────────────────────────────────────────────
    if (currentCell >= 0 && currentCell < totalUnits) {
      const col = currentCell % numCols;
      const row = Math.floor(currentCell / numCols);
      const cx = offsetX + col * pitch;
      const cy = padTop + row * pitch;
      ctx.fillStyle = currFill;
      ctx.beginPath();
      if (radius > 0) _drawRR(ctx, cx, cy, cellPx, cellPx, radius);
      else ctx.rect(cx, cy, cellPx, cellPx);
      ctx.fill();

      if (cellPx >= 3) {
        const bw = Math.max(1, Math.round(cellPx / 6));
        ctx.strokeStyle = "#007aff";
        ctx.lineWidth = bw;
        ctx.beginPath();
        if (radius > 0)
          _drawRR(ctx, cx + bw / 2, cy + bw / 2, cellPx - bw, cellPx - bw, radius);
        else
          ctx.rect(cx + bw / 2, cy + bw / 2, cellPx - bw, cellPx - bw);
        ctx.stroke();

        if (cellPx >= 5) {
          ctx.strokeStyle = "rgba(0,122,255,0.27)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (radius > 0)
            _drawRR(ctx, cx - 1, cy - 1, cellPx + 2, cellPx + 2, radius + 1);
          else
            ctx.rect(cx - 1, cy - 1, cellPx + 2, cellPx + 2);
          ctx.stroke();
        }
      }
    }
  }, [
    totalUnits,
    currentCell,
    cellPx,
    gapPx,
    numCols,
    dark,
    birthYear,
    showYearLabels,
    labelWidth,
    showColHeaders,
    colFontSize,
    viewType,
    cw,
    ch,
    radius,
    pitch,
    padTop,
    padBottom,
    fontSize,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: cw, height: ch, display: "block", margin: "0 auto" }}
    />
  );
});

// ─── LifeCalendarModal ────────────────────────────────────────────────────────