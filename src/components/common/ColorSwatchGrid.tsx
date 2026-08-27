import React from "react";
import { swatchCheckColor } from "../../constants/colors";

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
          onClick={onClear}
          title={clearLabel ?? "—"}
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            border: "none",
            boxShadow: !selected
              ? `0 0 0 1.5px ${dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}`
              : undefined,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>✕</span>
        </button>
      )}
      {colors.map((c) => {
        const sel = selected === c.hex;
        return (
          <button
            key={c.key}
            onClick={() => onSelect(c.hex, c.key)}
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
                ? `0 0 0 2px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.22)${c.key === "white" || c.key === "grey" ? ", inset 0 0 0 1px rgba(0,0,0,0.15)" : ""}`
                : c.key === "white" || c.key === "grey"
                  ? "inset 0 0 0 1px rgba(0,0,0,0.15)"
                  : undefined,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: sel ? "scale(1.08)" : "scale(1)",
              flexShrink: 0,
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