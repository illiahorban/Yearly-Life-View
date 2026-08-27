import React from "react";

export function IconButton({
  children,
  onClick,
  title,
  bg,
  color,
  "aria-expanded": ariaExpanded,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  bg: string;
  color?: string;
  "aria-expanded"?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-expanded={ariaExpanded}
      className="lc-icon-btn"
      style={{
        position: "relative",
        width: 30,
        height: 30,
        borderRadius: 8,
        background: bg,
        border: "none",
        boxShadow: "0 0 0 1px var(--border-soft)",
        color: color ?? "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── BlocksRenderer ───────────────────────────────────────────────────────────