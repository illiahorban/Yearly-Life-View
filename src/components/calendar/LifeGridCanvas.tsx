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
  currentProgress = 0,
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
  currentProgress?: number;
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
  const prevViewRef = React.useRef<LifeView | undefined>(undefined);
  const rows = Math.ceil(totalUnits / numCols);
  const pitch = cellPx + gapPx;
  const gridW = numCols * pitch - gapPx;

  const showColHeaders = (viewType === "months" || viewType === "weeks") && numCols > 1;
  const colHeaderHeight = showColHeaders ? 18 : 0;
  const colFontSize = Math.max(8, Math.min(10, Math.floor(cellPx * 0.45 + 5)));

  const fontSize =
    showYearLabels && labelWidth > 0
      ? Math.max(8, Math.min(10, Math.floor(cellPx * 0.95 + 4)))
      : 0;

  const padTop = Math.round(
    showColHeaders
      ? colHeaderHeight + (showYearLabels && labelWidth > 0 ? 6 : 2)
      : showYearLabels && labelWidth > 0
        ? Math.max(8, Math.ceil(fontSize / 2 - cellPx / 2 + 4))
        : 2,
  );
  const padRight = showColHeaders ? 12 : 4;
  const padBottom = Math.round(Math.max(8, Math.ceil(fontSize / 2 - cellPx / 2 + 4)));
  const cw = Math.round(labelWidth + gridW + padRight);
  const ch = Math.round(padTop + (rows * pitch - gapPx) + padBottom);
  const radius = Math.max(0, Math.floor(cellPx / 5));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.ceil(cw * dpr);
    canvas.height = Math.ceil(ch * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pastFill = LIFE_ACCENT;
    const futureFill = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)";
    const offsetX = Math.round(labelWidth);

    // ── Function to draw base grid (headers, year labels, future and past cells) ──
    const drawBaseGrid = () => {
      // ── Horizontal column numbering (1..12 for months, 1..52 for weeks) ──
      if (showColHeaders) {
        ctx.font = `${colFontSize}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = dark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.48)";
        const headerY = padTop - 10;

        if (viewType === "months") {
          const step = pitch < 9 ? 3 : pitch < 12 ? 2 : 1;
          for (let c = 0; c < 12 && c < numCols; c++) {
            const monthNum = c + 1;
            const shouldDraw =
              step === 1 ||
              monthNum === 1 ||
              monthNum === 12 ||
              (step === 2 && monthNum % 2 === 0) ||
              (step === 3 && monthNum % 3 === 0);

            if (shouldDraw) {
              const cx = offsetX + c * pitch + cellPx / 2;
              ctx.fillText(String(monthNum), cx, headerY);
            }
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
    };

    // ── Function to draw current cell with bottom-to-top rising fill ──────────
    const drawCurrentCell = (progressPercent: number) => {
      if (currentCell < 0 || currentCell >= totalUnits) return;
      const col = currentCell % numCols;
      const row = Math.floor(currentCell / numCols);
      const cx = offsetX + col * pitch;
      const cy = padTop + row * pitch;

      // Cleanly clear cell region without disturbing neighbor cells
      ctx.clearRect(cx - 1, cy - 1, cellPx + 2, cellPx + 2);

      // 1. Draw base unfilled cell background (matching future cells)
      ctx.fillStyle = futureFill;
      ctx.beginPath();
      if (radius > 0) _drawRR(ctx, cx, cy, cellPx, cellPx, radius);
      else ctx.rect(cx, cy, cellPx, cellPx);
      ctx.fill();

      // 2. Draw bottom-to-top rising fill matching elapsed progress
      const effProgress = Math.min(100, Math.max(0, progressPercent));
      if (effProgress > 0) {
        const rawFillH = (cellPx * effProgress) / 100;
        // Hairline sliver ensures visibility even on compact 2px-3px cells
        const fillH = Math.min(cellPx, Math.max(cellPx >= 3 ? 0.6 : 0.4, rawFillH));
        const fillY = cy + cellPx - fillH;

        ctx.save();
        ctx.beginPath();
        if (radius > 0) _drawRR(ctx, cx, cy, cellPx, cellPx, radius);
        else ctx.rect(cx, cy, cellPx, cellPx);
        ctx.clip();

        ctx.fillStyle = pastFill;
        ctx.fillRect(cx, fillY, cellPx, fillH);
        ctx.restore();
      }

      // 3. Highlight boundary ring / contour
      if (cellPx >= 3) {
        ctx.strokeStyle = LIFE_ACCENT;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (radius > 0) _drawRR(ctx, cx, cy, cellPx, cellPx, radius);
        else ctx.rect(cx, cy, cellPx, cellPx);
        ctx.stroke();

        if (cellPx >= 5) {
          ctx.strokeStyle = "rgba(0, 122, 255, 0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (radius > 0)
            _drawRR(ctx, cx - 1, cy - 1, cellPx + 2, cellPx + 2, radius + 1);
          else
            ctx.rect(cx - 1, cy - 1, cellPx + 2, cellPx + 2);
          ctx.stroke();
        }
      } else {
        // For tiny 2px cells, crisp 1px stroke
        ctx.strokeStyle = "rgba(0, 122, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(cx, cy, cellPx, cellPx);
        ctx.stroke();
      }
    };

    const isNewView = prevViewRef.current !== viewType;
    prevViewRef.current = viewType;

    drawBaseGrid();

    let rafId: number | null = null;
    if (isNewView && currentProgress > 0) {
      const startTime = performance.now();
      const duration = 600;
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (nowTime: number) => {
        const elapsed = nowTime - startTime;
        const t = Math.min(1, elapsed / duration);
        const scale = easeOutCubic(t);
        drawCurrentCell(currentProgress * scale);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        }
      };
      rafId = requestAnimationFrame(step);
    } else {
      drawCurrentCell(currentProgress);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [
    totalUnits,
    currentCell,
    currentProgress,
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