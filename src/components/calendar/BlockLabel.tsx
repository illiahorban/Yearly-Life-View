import React, { useState, useEffect } from "react";

export function BlockLabel({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    onChange(draft.trim() || "Untitled sprint");
  };

  // CSS grid trick: sizer span drives grid cell height; textarea fills it — no layout shift
  const sharedTextStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    lineHeight: 1.35,
    fontFamily: "inherit",
    padding: "1px 0",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    gridArea: "1/1",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        display: "inline-grid",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <textarea
        value={draft}
        rows={1}
        cols={1}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
          }
        }}
        className="bg-transparent outline-none"
        style={{
          ...sharedTextStyle,
          color,
          resize: "none",
          overflow: "hidden",
          width: "100%",
          borderBottom: "none",
        }}
      />
      {/* invisible sizer that mirrors the text — drives the grid row height */}
      <span
        aria-hidden
        style={{
          ...sharedTextStyle,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {(draft || "Untitled sprint") + "\u200b"}
      </span>
    </div>
  );
}

// ─── Fire animation ───────────────────────────────────────────────────────────