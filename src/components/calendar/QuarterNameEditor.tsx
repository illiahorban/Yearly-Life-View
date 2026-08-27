import React, { useState, useEffect, useRef } from "react";
import { PencilIcon, CheckIcon } from "../icons/Icons";

export function QuarterNameEditor({
  value,
  onChange,
  color,
  underline = true,
}: {
  value: string;
  onChange: (v: string) => void;
  color: string;
  underline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    onChange(draft.trim() || value);
  };
  // CSS grid trick: sizer span drives grid cell height; textarea fills it — no layout shift on mode switch
  const sharedTextStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    lineHeight: 1.35,
    fontFamily: "inherit",
    padding: "1px 0",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
    gridArea: "1/1",
  };
  return (
    <div
      style={{
        display: "inline-grid",
        maxWidth: "100%",
      }}
    >
      <textarea
        value={draft}
        rows={1}
        cols={1}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          commit();
        }}
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
          borderBottom: underline ? `1px solid ${color}` : "none",
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
        {draft + "\u200b"}
      </span>
    </div>
  );
}

// ─── BlockLabel ───────────────────────────────────────────────────────────────