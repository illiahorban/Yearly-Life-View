import React, { useState, useEffect, useRef } from "react";
import { PencilIcon, CheckIcon } from "../icons/Icons";

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
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  const commit = () => {
    onChange(draft.trim() || "Untitled sprint");
  };
  return (
    <textarea
      value={draft}
      rows={1}
      onChange={(e) => {
        setDraft(e.target.value);
        autoResize(e.target);
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
      className="text-[12px] font-semibold bg-transparent outline-none"
      style={{
        color,
         borderBottom: "none",
        padding: "1px 2px",
        width: "100%",
        resize: "none",
        overflow: "hidden",
        lineHeight: 1.35,
        fontFamily: "inherit",
        display: "block",
      }}
    />
  );
}

// ─── Fire animation ───────────────────────────────────────────────────────────