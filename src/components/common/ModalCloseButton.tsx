import React from "react";

export interface ModalCloseButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Standardized Modal Close Button for Yearly Life View.
 *
 * Enforces strict geometric vector centering (Rule 9):
 * - Uses exact mathematical vector SVG coordinates instead of unicode glyphs (e.g. '✕').
 * - Eliminates font-baseline, font-metrics, and line-height drift on iOS WebKit & desktop.
 * - Standardized 26x26 circular container with zero padding, zero margin, line-height: 0.
 */
export function ModalCloseButton({
  onClick,
  title = "Close",
  className,
  style,
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`transition-colors cursor-pointer select-none ${className ?? ""}`.trim()}
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        background: "rgba(128,128,128,0.15)",
        color: "var(--text-secondary)",
        border: "none",
        padding: 0,
        margin: 0,
        lineHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(128,128,128,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(128,128,128,0.15)";
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block", flexShrink: 0 }}
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
