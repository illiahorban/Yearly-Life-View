import React, { useRef, useState, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { motion, AnimatePresence } from "framer-motion";
import type { NoteEntry } from "../../types/calendar";
import { TrashIcon, GripIcon, CheckIcon } from "../icons/Icons";
import { ColorPickerPopover } from "../common/ColorPickerPopover";
import { DraggableCard } from "./DraggableCard";
import { LangContext } from "../../constants/i18n";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, getEventColors, normaliseGrey } from "../../constants/colors";
import { useIsMobile } from "../../hooks/use-mobile";
import { haptics } from "../../utils/haptics";
import { isGhostBlocked } from "../../lib/utils";

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
  isFocused,
  onFocus,
  onBlur,
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
  toggleColorPicker: (id: string, anchorEl: HTMLElement) => void;
  colorPickerEntryId: string | null;
  setConfirmDeleteEntryId: (id: string | null) => void;
  autoFocus?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
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

  const isMobile = useIsMobile();
  const entryColor = entry.color;
  const ec = getEventColors(entryColor ? resolveNoteHex(entryColor) : "", dark, { isMobile });
  const tintedBg = ec.bg;
  const tintedBorder = ec.border;
  const tintedText = entryColor ? ec.textTitle : "var(--text)";
  const noteAch = entryColor
    ? achromaticStyle(resolveNoteHex(entryColor), dark)
    : null;
  const notePlaceholderClass = noteAch
    ? `placeholder-note-${noteAch.tier}`
    : undefined;

  const isColorOpen = colorPickerEntryId === entry.id;
  const isActionVisible = isMobile
    ? isFocused || isColorOpen
    : hoveredEntryId === entry.id || isColorOpen;
  const lastColorPointerTimeRef = useRef(0);

  return (
    <DraggableCard id={entry.id} dark={dark}>
      <div
        data-note-card="true"
        style={{ position: "relative" }}
        onMouseEnter={() => {
          if (!isMobile) setHoveredEntryId(entry.id);
        }}
        onMouseLeave={() => {
          if (!isMobile) setHoveredEntryId(null);
        }}
      >
        <TextareaAutosize
          key={`note-entry-${entry.id}`}
          ref={setInputRef}
          value={entry.text}
          onChange={(e) => updateEntry(entry.id, e.target.value)}
          onHeightChange={(h) => handleNoteHeightChange(entry.id, h)}
          onKeyDown={handleKey}
          onPointerDown={(e) => {
            if (isGhostBlocked()) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }}
          onFocus={(e) => {
            if (isGhostBlocked()) {
              if (!isFocused) {
                e.currentTarget.blur();
                return;
              }
            }
            onFocus();
          }}
          onMouseDown={(e) => {
            if (isGhostBlocked()) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }}
          onBlur={onBlur}
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
            fontSize: isMobile ? 16 : 14,
            lineHeight: 1.55,
            fontFamily: "inherit",
            background: tintedBg,
            color: tintedText,
            boxSizing: "border-box",
            boxShadow: ec.boxShadow || undefined,
            display: "block",
            overflow: "hidden",
            transition: "background 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
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
            opacity: isActionVisible ? 1 : 0,
            pointerEvents: isActionVisible ? "auto" : "none",
            isolation: "isolate",
            transition: "opacity 150ms ease",
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
              type="button"
              onPointerDown={(e) => {
                e.preventDefault(); // Prevents input blur, keeps keyboard open!
                e.stopPropagation();
                lastColorPointerTimeRef.current = Date.now();
                haptics.selection();
                toggleColorPicker(entry.id, e.currentTarget);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (Date.now() - lastColorPointerTimeRef.current < 400) return;
                haptics.selection();
                toggleColorPicker(entry.id, e.currentTarget);
              }}
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
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.impactLight();
              setConfirmDeleteEntryId(entry.id);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
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