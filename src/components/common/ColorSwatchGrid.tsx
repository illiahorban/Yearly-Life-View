import React, { useRef } from "react";
import { swatchCheckColor, APPLE_COLORS } from "../../constants/colors";
import { useIsMobile } from "../../hooks/use-mobile";
import { blockGhostEvents } from "../../lib/utils";

export function ColorSwatchGrid({
  colors,
  selected,
  onSelect,
  onClear,
  clearLabel,
  dark,
}: {
  colors: readonly { key: string; hex: string; label: string }[];
  selected?: string | null;
  onSelect: (hex: string, key: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  dark: boolean;
}) {
  const isMobile = useIsMobile();
  const lastActionTimeRef = useRef(0);
  const activePointerDownKeyRef = useRef<string | null>(null);

  const handleSelectSafe = (hex: string, key: string) => {
    lastActionTimeRef.current = Date.now();
    blockGhostEvents(500);
    onSelect(hex, key);
  };

  const handleClearSafe = () => {
    if (!onClear) return;
    lastActionTimeRef.current = Date.now();
    blockGhostEvents(500);
    onClear();
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 20px)",
        gap: 5,
      }}
    >
      {onClear && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault(); // Prevents input blur, keeps keyboard up!
            e.stopPropagation();
            activePointerDownKeyRef.current = "__clear__";
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (activePointerDownKeyRef.current === "__clear__") {
              activePointerDownKeyRef.current = null;
              handleClearSafe();
            }
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (Date.now() - lastActionTimeRef.current < 400) return;
            handleClearSafe();
          }}
          title={clearLabel ?? "—"}
          aria-label={clearLabel ?? "—"}
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            border: "none",
            boxShadow: !selected
              ? `0 0 0 2px ${dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}`
              : undefined,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            flexShrink: 0,
            padding: 0,
            margin: 0,
            lineHeight: 0,
            boxSizing: "border-box",
            overflow: "hidden",
            WebkitAppearance: "none",
            appearance: "none",
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{
              display: "block",
              flexShrink: 0,
              pointerEvents: "none",
              margin: 0,
              padding: 0,
            }}
          >
            <line x1="2.5" y1="2.5" x2="7.5" y2="7.5" />
            <line x1="7.5" y1="2.5" x2="2.5" y2="7.5" />
          </svg>
        </button>
      )}
      {colors.map((c) => {
        const sel = Boolean(
          selected &&
            (selected === c.hex ||
              selected === c.key ||
              (c.hex && selected.toLowerCase() === c.hex.toLowerCase()) ||
              (c.key &&
                APPLE_COLORS.some(
                  (ac) =>
                    ac.key === c.key &&
                    (ac.light.toLowerCase() === selected.toLowerCase() ||
                      ac.dark.toLowerCase() === selected.toLowerCase() ||
                      ac.key === selected),
                )) ||
              (c.key === "grey" &&
                (selected === "#71717a" ||
                  selected.toLowerCase() === "#71717a"))),
        );
        return (
          <button
            type="button"
            key={c.key}
            onPointerDown={(e) => {
              e.preventDefault(); // Prevents input blur, keeps keyboard up!
              e.stopPropagation();
              activePointerDownKeyRef.current = c.key;
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (activePointerDownKeyRef.current === c.key) {
                activePointerDownKeyRef.current = null;
                handleSelectSafe(c.hex, c.key);
              }
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (Date.now() - lastActionTimeRef.current < 400) return;
              handleSelectSafe(c.hex, c.key);
            }}
            title={c.label}
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: c.hex,
              border: "none",
              cursor: "pointer",
              transition: "transform 120ms ease",
              boxShadow: sel
                ? `0 0 0 2px rgba(255,255,255,0.9)${c.key === "white" || c.key === "grey" ? ", inset 0 0 0 1px rgba(0,0,0,0.15)" : ""}`
                : c.key === "white" || c.key === "grey"
                  ? "inset 0 0 0 1px rgba(0,0,0,0.15)"
                  : undefined,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: sel ? "scale(1.08)" : "scale(1)",
              flexShrink: 0,
              padding: 0,
              margin: 0,
              lineHeight: 0,
              boxSizing: "border-box",
            }}
          >
            {sel && (
              <span
                style={{
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: swatchCheckColor(c.hex),
                }}
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Position a fixed-position popover relative to an anchor rect, flipping above
 *  the anchor and clamping to both viewport edges so it never renders off-screen. */