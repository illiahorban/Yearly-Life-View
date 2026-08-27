import React, { useRef, useState, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import type { NoteEntry } from "../../types/calendar";
import { TrashIcon, GripIcon, CheckIcon } from "../icons/Icons";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { DraggableCard } from "./DraggableCard";
import { LangContext } from "../../constants/i18n";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, getEventColors, normaliseGrey } from "../../constants/colors";

const NOTE_LONG_PRESS_MS = 350;
const NOTE_LONG_PRESS_MOVE_TOLERANCE = 8;

export function NoteEntryItem({
  entry,
  idx,
  entriesCount,
  dark,
  inputBg,
  borderColor,
  hoveredEntryId,
  setHoveredEntryId,
  updateEntry,
  handleNoteHeightChange,
  handleKey,
  noteHeights,
  colorBtnRefs,
  toggleColorPicker,
  colorPickerEntryId,
  setConfirmDeleteEntryId,
}: {
  key?: React.Key;
  entry: NoteEntry;
  idx: number;
  entriesCount: number;
  dark: boolean;
  inputBg: string;
  borderColor: string;
  hoveredEntryId: string | null;
  setHoveredEntryId: (id: string | null) => void;
  updateEntry: (id: string, text: string) => void;
  handleNoteHeightChange: (id: string, h: number) => void;
  handleKey: (e: React.KeyboardEvent) => void;
  noteHeights: Record<string, number>;
  colorBtnRefs: React.MutableRefObject<
    Record<string, HTMLButtonElement | null>
  >;
  toggleColorPicker: (id: string) => void;
  colorPickerEntryId: string | null;
  setConfirmDeleteEntryId: (id: string | null) => void;
}) {
  const { t } = React.useContext(LangContext);
  const entryColor = entry.color;
  const ec = entryColor
    ? getEventColors(resolveNoteHex(entryColor), dark)
    : null;
  const tintedBg = ec ? ec.bg : inputBg;
  const tintedBorder = ec ? ec.border : borderColor;
  const tintedText = ec ? ec.textTitle : "var(--text)";
  const noteAch = entryColor
    ? achromaticStyle(resolveNoteHex(entryColor), dark)
    : null;
  const notePlaceholderClass = noteAch
    ? `placeholder-note-${noteAch.tier}`
    : undefined;

  return (
    <DraggableCard id={entry.id} dark={dark}>
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setHoveredEntryId(entry.id)}
        onMouseLeave={() => setHoveredEntryId(null)}
      >
        <TextareaAutosize
          value={entry.text}
          onChange={(e) => updateEntry(entry.id, e.target.value)}
          onHeightChange={(h) => handleNoteHeightChange(entry.id, h)}
          onKeyDown={handleKey}
          placeholder={idx === 0 ? t("notePlaceholder") : t("anotherNote")}
          minRows={1}
          className={notePlaceholderClass}
          style={{
            width: "100%",
            resize: "none",
            outline: "none",
            border: `1.5px solid ${tintedBorder}`,
            borderRadius: 12,
            padding: "10px 60px 10px 16px",
            fontSize: 14,
            lineHeight: 1.55,
            fontFamily: "inherit",
            background: tintedBg,
            color: tintedText,
            boxSizing: "border-box",
            display: "block",
            overflow: "hidden",
            transition: "background 200ms ease, border-color 200ms ease",
            cursor: "text",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: (noteHeights[entry.id] ?? 44) > 44 ? 8 : "50%",
            transform:
              (noteHeights[entry.id] ?? 44) > 44 ? "none" : "translateY(-50%)",
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "top 150ms",
            opacity:
              hoveredEntryId === entry.id || colorPickerEntryId === entry.id
                ? 1
                : 0,
            pointerEvents:
              hoveredEntryId === entry.id || colorPickerEntryId === entry.id
                ? "auto"
                : "none",
            isolation: "isolate",
          }}
        >
          <button
            ref={(el) => {
              colorBtnRefs.current[entry.id] = el;
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleColorPicker(entry.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
            aria-label={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
            data-testid={`note-color-btn-${idx}`}
            style={{
              width: 19,
              height: 19,
              borderRadius: 999,
              flexShrink: 0,
              background: normaliseGrey(entryColor) || "transparent",
              border: "none",
              boxShadow: entryColor
                ? "0 0 0 1.5px rgba(255,255,255,0.85), 0 1px 3px rgba(0,0,0,0.18)"
                : "0 0 0 1.5px var(--border-soft)",
              boxSizing: "border-box",
              cursor: "pointer",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mixBlendMode: "normal",
              isolation: "isolate",
              marginRight: 1,
            }}
          >
            {!entryColor && (
              <span
                style={{
                  position: "absolute",
                  width: "55%",
                  height: "1.5px",
                  background: dark
                    ? "rgba(255,255,255,0.55)"
                    : "rgba(0,0,0,0.35)",
                  transform: "rotate(-45deg)",
                }}
              />
            )}
          </button>
          <button
            onClick={() => setConfirmDeleteEntryId(entry.id)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: "none",
              background: dark ? "rgba(255,59,48,0.15)" : "rgba(255,59,48,0.1)",
              color: "#ff3b30",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: hoveredEntryId === entry.id ? 1 : 0,
              pointerEvents: hoveredEntryId === entry.id ? "auto" : "none",
              transition: "opacity 150ms, background 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = dark
                ? "rgba(255,59,48,0.28)"
                : "rgba(255,59,48,0.22)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = dark
                ? "rgba(255,59,48,0.15)"
                : "rgba(255,59,48,0.1)";
            }}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
            </svg>
          </button>
        </div>
      </div>
    </DraggableCard>
  );
}

// ─── DraggableCard ────────────────────────────────────────────────────────────
// Generic drag-handle wrapper reused by both notes and events: a fixed-width
// grip strip triggers the reorder drag (instantly on mouse, after a brief
// press-and-hold on touch) while the wrapped content keeps its own clicks,
// text editing, etc. untouched.