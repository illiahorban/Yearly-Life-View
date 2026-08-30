import React, { useRef, useState, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { motion, AnimatePresence } from "framer-motion";
import type { NoteEntry } from "../../types/calendar";
import { TrashIcon, GripIcon, CheckIcon } from "../icons/Icons";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { DraggableCard } from "./DraggableCard";
import { LangContext } from "../../constants/i18n";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, getEventColors, normaliseGrey, getPopoverPlacement } from "../../constants/colors";

const NOTE_LONG_PRESS_MS = 350;
const NOTE_LONG_PRESS_MOVE_TOLERANCE = 8;

export function NoteEntryItem({
  entry,
  idx,
  entriesCount,
  dark,
  modalBg,
  inputBg,
  borderColor,
  hoveredEntryId,
  setHoveredEntryId,
  updateEntry,
  updateEntryColor,
  handleNoteHeightChange,
  handleKey,
  noteHeights,
  colorBtnRefs,
  toggleColorPicker,
  colorPickerEntryId,
  setConfirmDeleteEntryId,
  autoFocus,
}: {
  key?: React.Key;
  entry: NoteEntry;
  idx: number;
  entriesCount: number;
  dark: boolean;
  modalBg?: string;
  inputBg: string;
  borderColor: string;
  hoveredEntryId: string | null;
  setHoveredEntryId: (id: string | null) => void;
  updateEntry: (id: string, text: string) => void;
  updateEntryColor: (id: string, color: string | undefined) => void;
  handleNoteHeightChange: (id: string, h: number) => void;
  handleKey: (e: React.KeyboardEvent) => void;
  noteHeights: Record<string, number>;
  colorBtnRefs: React.MutableRefObject<
    Record<string, HTMLButtonElement | null>
  >;
  toggleColorPicker: (id: string) => void;
  colorPickerEntryId: string | null;
  setConfirmDeleteEntryId: (id: string | null) => void;
  autoFocus?: boolean;
}) {
  const { t } = React.useContext(LangContext);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  const setInputRef = React.useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
  }, []);

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
        data-note-card="true"
        style={{ position: "relative" }}
        onMouseEnter={() => setHoveredEntryId(entry.id)}
        onMouseLeave={() => setHoveredEntryId(null)}
      >
        <TextareaAutosize
          ref={setInputRef}
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
          <div style={{ position: "relative", display: "inline-flex" }}>
            <button
              ref={(el) => {
                colorBtnRefs.current[entry.id] = el;
              }}
              onClick={(e) => {
                e.stopPropagation();
                const btn = colorBtnRefs.current[entry.id];
                setPlacement(getPopoverPlacement(btn));
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
            {colorPickerEntryId === entry.id && (
              <motion.div
                key="color-popover"
                initial={{
                  opacity: 0,
                  scale: 0.94,
                  y: placement === "top" ? 4 : -4,
                }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.94,
                  y: placement === "top" ? 4 : -4,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  ...(placement === "top"
                    ? { bottom: "calc(100% + 6px)" }
                    : { top: "calc(100% + 6px)" }),
                  right: 0,
                  zIndex: 200,
                  background:
                    modalBg ||
                    (dark
                      ? "rgba(30,30,30,0.95)"
                      : "rgba(255,255,255,0.95)"),
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  borderRadius: 12,
                  padding: 8,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                  border: "1px solid var(--border-soft)",
                  width: 136,
                  isolation: "isolate",
                }}
              >
                <div
                  style={{ position: "fixed", inset: 0, zIndex: -1 }}
                  onClick={() => toggleColorPicker(entry.id)}
                />
                <ColorSwatchGrid
                  colors={APPLE_COLORS.map((ac) => ({
                    key: ac.key,
                    hex: dark ? ac.dark : ac.light,
                    label: ac.label,
                  }))}
                  selected={entry.color ?? null}
                  onSelect={(hex) => {
                    updateEntryColor(entry.id, hex);
                    toggleColorPicker(entry.id);
                  }}
                  onClear={() => {
                    updateEntryColor(entry.id, undefined);
                    toggleColorPicker(entry.id);
                  }}
                  clearLabel={t("noColor")}
                  dark={dark}
                />
              </motion.div>
            )}
          </div>
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