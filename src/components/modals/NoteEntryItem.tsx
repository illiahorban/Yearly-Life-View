import React, { useRef, useState, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { motion, AnimatePresence } from "framer-motion";
import type { NoteEntry } from "../../types/calendar";
import { TrashIcon, GripIcon, CheckIcon } from "../icons/Icons";
import { ColorPickerPopover } from "../common/ColorPickerPopover";
import { DraggableCard } from "./DraggableCard";
import { LangContext } from "../../constants/i18n";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, getEventColors, normaliseGrey } from "../../constants/colors";
import { haptics } from "../../utils/haptics";

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
          key={`note-entry-${entry.id}-${entryColor || "none"}`}
          ref={setInputRef}
          value={entry.text}
          onChange={(e) => updateEntry(entry.id, e.target.value)}
          onHeightChange={(h) => handleNoteHeightChange(entry.id, h)}
          onKeyDown={handleKey}
          placeholder={idx === 0 ? t("notePlaceholder") : t("anotherNote")}
          minRows={1}
          className={`${notePlaceholderClass || ""} event-form-input`.trim()}
          style={{
            width: "100%",
            resize: "none",
            outline: "none",
            border: `1px solid ${tintedBorder}`,
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
            // @ts-ignore
            "--event-ph-color": tintedText,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 10,
            transform: "none",
            right: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity:
              hoveredEntryId === entry.id ||
              colorPickerEntryId === entry.id
                ? 1
                : 0,
            pointerEvents:
              hoveredEntryId === entry.id ||
              colorPickerEntryId === entry.id
                ? "auto"
                : "none",
            isolation: "isolate",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              ref={(el) => {
                colorBtnRefs.current[entry.id] = el;
              }}
              onClick={(e) => {
                e.stopPropagation();
                haptics.selection();
                toggleColorPicker(entry.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
              aria-label={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
              data-testid={`note-color-btn-${idx}`}
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                flexShrink: 0,
                background: normaliseGrey(entryColor) || "transparent",
                border: entryColor
                  ? (dark ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(0,0,0,0.18)")
                  : (dark ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(0,0,0,0.20)"),
                boxShadow: "none",
                boxSizing: "border-box",
                cursor: "pointer",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: 0,
                padding: 0,
                lineHeight: 0,
                mixBlendMode: "normal",
                isolation: "isolate",
              }}
            >
              {!entryColor && (
                <span
                  style={{
                    position: "absolute",
                    width: "55%",
                    height: "1px",
                    background: dark
                      ? "rgba(255,255,255,0.55)"
                      : "rgba(0,0,0,0.35)",
                    transform: "rotate(-45deg)",
                  }}
                />
              )}
            </button>
            <ColorPickerPopover
              isOpen={colorPickerEntryId === entry.id}
              onClose={() => toggleColorPicker(entry.id)}
              anchorEl={colorBtnRefs.current[entry.id]}
              dark={dark}
              modalBg={modalBg}
              selected={entry.color ?? null}
              onSelect={(hex) => {
                updateEntryColor(
                  entry.id,
                  entry.color === hex ? undefined : hex,
                );
                toggleColorPicker(entry.id);
                setTimeout(() => {
                  textareaRef.current?.focus();
                }, 0);
              }}
              onClear={() => {
                updateEntryColor(entry.id, undefined);
                toggleColorPicker(entry.id);
                setTimeout(() => {
                  textareaRef.current?.focus();
                }, 0);
              }}
              clearLabel={t("noColor")}
            />
          </div>
          <button
            onClick={() => {
              haptics.impactLight();
              setConfirmDeleteEntryId(entry.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              border: "none",
              boxSizing: "border-box",
              background: dark ? "rgba(255,59,48,0.15)" : "rgba(255,59,48,0.1)",
              color: "#ff3b30",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              margin: 0,
              padding: 0,
              lineHeight: 0,
              transition: "background 0.1s",
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
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              style={{ display: "block" }}
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