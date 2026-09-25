import React, { useState, useMemo, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import TextareaAutosize from "react-textarea-autosize";
import type { CalendarConfig, QuarterConfig, Block, QuarterMeta, AppleColorKey, Quarter } from "../../types/calendar";
import { WEEKS_PER_QUARTER, LangContext } from "../../constants/i18n";
import { APPLE_COLORS, getQuarterColors, adaptColor, achromaticStyle, getEventColors, readableGoalTextColor, resolveNoteHex } from "../../constants/colors";
import { pluralWeeks } from "../../utils/plural";
import { makeId } from "../../utils/storage";
import { ColorPickerPopover } from "../common/ColorPickerPopover";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { QuarterNameEditor } from "../calendar/QuarterNameEditor";
import { TrashIcon, CheckIcon } from "../icons/Icons";
import { useIsMobile } from "../../hooks/use-mobile";
import { useVisualViewport } from "../../hooks/use-visual-viewport";

export function SprintSettingsModal({
  quarterIndex: _qi,
  quarter,
  initial,
  dark,
  modalBg,
  colorKey,
  onColorChange,
  onClose,
  onSave,
  onAutoSave,
  onResetBlock,
  quarterName,
  onQuarterNameChange,
  weeksCapacity,
}: {
  key?: React.Key;
  quarterIndex: number;
  quarter: Quarter;
  initial: QuarterConfig;
  dark: boolean;
  modalBg: string;
  colorKey: AppleColorKey;
  onColorChange: (key: AppleColorKey) => void;
  onClose: () => void;
  onSave: (next: QuarterConfig) => void;
  onAutoSave: (next: QuarterConfig) => void;
  onResetBlock: (blockId: string) => void;
  quarterName: string;
  onQuarterNameChange: (name: string) => void;
  weeksCapacity: number;
}) {
  const { t, lang } = React.useContext(LangContext);
  const isMobile = useIsMobile();
  const { height: vvHeight, offsetTop: vvOffsetTop } = useVisualViewport();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);
  const [blocks, setBlocks] = useState<Block[]>(() =>
    initial.blocks.map((b) => ({ ...b })),
  );
  const blocksRef = useRef(blocks);
  const commitBlocks = (next: Block[]) => {
    blocksRef.current = next;
    setBlocks(next);
    onAutoSave({ blocks: next });
  };
  const total = blocks.reduce((a, b) => a + (Number(b.weeks) || 0), 0);
  const remaining = weeksCapacity - total;
  const valid = total === weeksCapacity && blocks.every((b) => b.weeks >= 1);
  const update = (id: string, patch: Partial<Block>) =>
    commitBlocks(
      blocksRef.current.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  const applyPreset = (parts: number[]) => {
    commitBlocks(
      parts.map((w, i) => ({
        id: makeId(),
        weeks: w,
        label: `${t("sprintLabel")} ${i + 1}`,
      })),
    );
  };
  const [activeColorPickerBlockId, setActiveColorPickerBlockId] = useState<
    string | null
  >(null);
  const [blockColorAnchor, setBlockColorAnchor] =
    useState<HTMLElement | null>(null);
  const blockInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const activeColorPickerBlock = activeColorPickerBlockId
    ? blocks.find((b) => b.id === activeColorPickerBlockId)
    : null;
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [quarterColorOpen, setQuarterColorOpen] = useState(false);
  const [quarterColorAnchor, setQuarterColorAnchor] =
    useState<HTMLElement | null>(null);

  const borderColor = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  return (
    <>
      <motion.div
        className="flex items-center justify-center p-3 sm:p-4 pointer-events-auto"
        style={{
          position: "fixed",
          top: `${vvOffsetTop}px`,
          left: 0,
          right: 0,
          height: `${vvHeight}px`,
          zIndex: 60,
          overflow: "hidden",
          overscrollBehavior: "contain",
        }}
        initial={false}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            position: "fixed",
            inset: "-100vh -100vw",
            width: "300vw",
            height: "300vh",
            background: "rgba(20,20,25,0.38)",
            backdropFilter: "blur(14px) saturate(160%)",
            WebkitBackdropFilter: "blur(14px) saturate(160%)",
          }}
        />
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 4 }}
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
          className="w-full max-w-md"
          style={{
            position: "relative",
            background: modalBg,
            backdropFilter: "blur(30px) saturate(180%)",
            WebkitBackdropFilter: "blur(30px) saturate(180%)",
            borderRadius: 22,
            boxShadow: `0 30px 80px rgba(0,0,0,0.22), 0 0 0 2px ${quarter.border}`,
            border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.6)"}`,
            overflowY: "auto",
            maxHeight: `${Math.max(160, vvHeight - (isMobile ? 16 : 32))}px`,
          }}
        >
          <div className="px-6 pt-6 pb-3">
            <h2
              className="text-base font-semibold tracking-tight mb-2"
              style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              {t("sprintConfig")}
            </h2>
            <div className="flex items-center gap-2">
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuarterColorAnchor(e.currentTarget);
                    setQuarterColorOpen((v) => !v);
                  }}
                  title={t("chooseColor")}
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 999,
                    background: quarter.border,
                    border: "none",
                    boxShadow:
                      "0 0 0 2px rgba(255,255,255,0.92), 0 0 0 3.5px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.18)",
                    cursor: "pointer",
                    display: "block",
                    flexShrink: 0,
                  }}
                />
                <ColorPickerPopover
                  isOpen={quarterColorOpen}
                  onClose={() => setQuarterColorOpen(false)}
                  anchorEl={quarterColorAnchor}
                  dark={dark}
                  modalBg={modalBg}
                  selected={colorKey}
                  onSelect={(_hex, key) => {
                    onColorChange(
                      key as (typeof APPLE_COLORS)[number]["key"],
                    );
                    setQuarterColorOpen(false);
                  }}
                />
              </div>
              <div
                className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-xl"
                style={{
                  color: quarter.text,
                  border: `1px solid ${dark ? quarter.darkSoft : quarter.soft}`,
                  width: "fit-content",
                  maxWidth: "calc(100% - 1.5rem)",
                }}
              >
                <QuarterNameEditor
                  value={quarterName}
                  onChange={onQuarterNameChange}
                  color={quarter.text}
                  underline={false}
                />
              </div>
            </div>
            <p
              className="mt-1.5 text-[13px]"
              style={{
                color: "var(--text-secondary)",
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {t("sprintConfigDescription")}
            </p>
          </div>

          <div className="px-6">
            <div className="flex flex-wrap gap-1.5">
              {(weeksCapacity === 13
                ? [
                    { n: "1 × 13", p: [13] },
                    { n: "2+2+2+2+2+2+1", p: [2, 2, 2, 2, 2, 2, 1] },
                    { n: "3+3+3+4", p: [3, 3, 3, 4] },
                    { n: "4+4+5", p: [4, 4, 5] },
                    { n: "6+7", p: [6, 7] },
                  ]
                : [
                    { n: `1 × ${weeksCapacity}`, p: [weeksCapacity] },
                    { n: "4+4+6", p: [4, 4, 6] },
                    { n: "5+4+5", p: [5, 4, 5] },
                    { n: "7+7", p: [7, 7] },
                    { n: "5+5+4", p: [5, 5, 4] },
                  ]
              ).map((x) => (
                <button
                  key={x.n}
                  onClick={() => applyPreset(x.p)}
                  type="button"
                  className="text-[11px] tabular-nums"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: dark
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(0,0,0,0.04)",
                    color: "var(--text-secondary)",
                    border: "none",
                    boxShadow: `0 0 0 1px ${borderColor}`,
                  }}
                >
                  {x.n}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 mt-4 max-h-80 overflow-auto">
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {blocks.map((b, idx) => {
                  const bAc = b.color
                    ? APPLE_COLORS.find((c) => c.key === b.color)
                    : null;
                  const bHex = bAc
                    ? dark
                      ? bAc.dark
                      : bAc.light
                    : dark
                      ? quarter.darkSoft
                      : quarter.soft;
                  const bDotHex = bAc
                    ? dark
                      ? bAc.dark
                      : bAc.light
                    : quarter.border;
                  const bEc = bAc ? getEventColors(bHex, dark) : null;
                  const bTextColor = bAc
                    ? readableGoalTextColor(bHex, dark, "var(--text)")
                    : "var(--text)";
                  const bAch = bAc
                    ? achromaticStyle(resolveNoteHex(bDotHex), dark)
                    : null;
                  const bPlaceholderClass = bAch
                    ? `placeholder-goal-${bAch.tier}`
                    : undefined;

                  const renderInput = (fontSize = isMobile ? 15 : 13) => (
                    <TextareaAutosize
                      key={`sprint-label-${b.id}-${b.color || "none"}`}
                      ref={(el) => {
                        blockInputRefs.current[b.id] = el;
                      }}
                      value={b.label}
                      onChange={(e) => {
                        const newBlocks = blocksRef.current.map((x) =>
                          x.id === b.id ? { ...x, label: e.target.value } : x,
                        );
                        commitBlocks(newBlocks);
                      }}
                      placeholder={t("sprintLabelPlaceholder")}
                      minRows={1}
                      className={`${bPlaceholderClass || ""} bg-transparent outline-none w-full resize-none event-form-input`.trim()}
                      style={{
                        color: bDotHex,
                        fontSize,
                        fontWeight: 500,
                        lineHeight: 1.4,
                        fontFamily: "inherit",
                        padding: 0,
                        border: "none",
                        display: "block",
                        minWidth: 0,
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        overflow: "hidden",
                        // @ts-ignore
                        "--event-ph-color": bDotHex,
                      }}
                    />
                  );

                  const renderColorDot = (size = 14) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBlockColorAnchor(e.currentTarget);
                        setActiveColorPickerBlockId((prev) => (prev === b.id ? null : b.id));
                      }}
                      title={t("sprintColor")}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: 999,
                        background: bDotHex,
                        border: "none",
                        boxShadow: "0 0 0 1.5px rgba(255,255,255,0.92), 0 0 0 3px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.2)",
                        cursor: "pointer",
                        display: "block",
                        flexShrink: 0,
                        padding: 0,
                      }}
                    />
                  );

                  const renderActions = () => (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        title={t("resetSprint")}
                        onClick={() => setConfirmResetId(b.id)}
                        className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                        style={{
                          width: 24,
                          height: 24,
                          color: "var(--text-secondary)",
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#ff3b30";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title={t("deleteSprintBtn") || "Удалить"}
                        onClick={() => setConfirmDeleteId(b.id)}
                        disabled={blocks.length === 1}
                        className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                        style={{
                          width: 24,
                          height: 24,
                          color: blocks.length === 1 ? "var(--text-tertiary)" : "var(--text-secondary)",
                          opacity: blocks.length === 1 ? 0.35 : 1,
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (blocks.length > 1) {
                            e.currentTarget.style.color = "#ff3b30";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = blocks.length === 1 ? "var(--text-tertiary)" : "var(--text-secondary)";
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  );

                  const renderStepper = () => (
                    <div
                      className="flex items-center flex-shrink-0"
                      style={{
                        background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                        border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                        borderRadius: 7,
                        padding: 1.5,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => update(b.id, { weeks: Math.max(1, b.weeks - 1) })}
                        className="flex items-center justify-center rounded transition-colors text-[13px] leading-none cursor-pointer"
                        style={{
                          width: 20,
                          height: 20,
                          color: bTextColor,
                        }}
                      >
                        −
                      </button>
                      <span
                        className="text-[11px] font-semibold tabular-nums text-center select-none"
                        style={{
                          color: bTextColor,
                          paddingLeft: 2,
                          paddingRight: 2,
                          minWidth: 20,
                        }}
                      >
                        {b.weeks}
                      </span>
                      <button
                        type="button"
                        onClick={() => update(b.id, { weeks: Math.min(weeksCapacity, b.weeks + 1) })}
                        className="flex items-center justify-center rounded transition-colors text-[13px] leading-none cursor-pointer"
                        style={{
                          width: 20,
                          height: 20,
                          color: bTextColor,
                        }}
                      >
                        +
                      </button>
                    </div>
                  );

                  return (
                    <motion.div
                      layout
                      key={b.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-center gap-2"
                      style={{ position: "relative" }}
                    >
                      <div
                        style={{
                          background: bEc
                            ? bEc.bg
                            : dark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.025)",
                          border: `1px solid ${bEc ? bEc.border : borderColor}`,
                          borderRadius: 12,
                          padding: "6px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          flex: 1,
                          minWidth: 0,
                          transition:
                            "background 200ms ease, border-color 200ms ease",
                        }}
                      >
                        <span
                          className="text-[10px] font-bold tabular-nums w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0"
                          style={{
                            background: bAc
                              ? `${bHex}20`
                              : dark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.05)",
                            color: bAc ? bHex : "var(--text-secondary)",
                          }}
                        >
                          {idx + 1}
                        </span>
                        {renderColorDot(13)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {renderInput()}
                        </div>
                        {renderStepper()}
                        {renderActions()}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <ColorPickerPopover
                isOpen={Boolean(activeColorPickerBlock && blockColorAnchor)}
                onClose={() => {
                  setActiveColorPickerBlockId(null);
                  setBlockColorAnchor(null);
                }}
                anchorEl={blockColorAnchor}
                dark={dark}
                modalBg={modalBg}
                selected={activeColorPickerBlock?.color ?? null}
                onSelect={(_hex, key) => {
                  if (activeColorPickerBlock) {
                    const blockId = activeColorPickerBlock.id;
                    update(blockId, {
                      color: key as (typeof APPLE_COLORS)[number]["key"],
                    });
                    setTimeout(() => {
                      blockInputRefs.current[blockId]?.focus();
                    }, 0);
                  }
                  setActiveColorPickerBlockId(null);
                  setBlockColorAnchor(null);
                }}
                onClear={() => {
                  if (activeColorPickerBlock) {
                    const blockId = activeColorPickerBlock.id;
                    update(blockId, {
                      color: undefined,
                    });
                    setTimeout(() => {
                      blockInputRefs.current[blockId]?.focus();
                    }, 0);
                  }
                  setActiveColorPickerBlockId(null);
                  setBlockColorAnchor(null);
                }}
                clearLabel={t("quarterDefault")}
              />
              <button
                type="button"
                onClick={() => {
                  commitBlocks([
                    ...blocksRef.current,
                    {
                      id: makeId(),
                      weeks: Math.max(1, remaining > 0 ? remaining : 1),
                      label: `${t("sprintLabel")} ${blocksRef.current.length + 1}`,
                    },
                  ]);
                }}
                disabled={remaining < 1}
                className="text-[12px] font-medium mt-1 self-start"
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  color: remaining < 1 ? "var(--text-tertiary)" : quarter.text,
                  background:
                    remaining < 1
                      ? dark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.04)"
                      : dark
                        ? quarter.darkTint
                        : quarter.tint,
                  border: `1px solid ${remaining < 1 ? borderColor : dark ? quarter.darkSoft : quarter.soft}`,
                  opacity: remaining < 1 ? 0.6 : 1,
                }}
              >
                + {t("addSprint")}
              </button>
            </div>
          </div>

          <div className="px-6 mt-4">
            <div
              className="flex items-center justify-between text-[12px] tabular-nums px-3 py-2.5 rounded-xl"
              style={{
                background: valid
                  ? "rgba(52,199,89,0.08)"
                  : "rgba(255,59,48,0.07)",
                color: valid ? "#34c759" : "#c00",
                border: `1px solid ${valid ? "rgba(52,199,89,0.2)" : "rgba(255,59,48,0.2)"}`,
              }}
            >
              <span>
                {t("total")}: {total} / {weeksCapacity} {t("week5")}
              </span>
              <span>
                {valid
                  ? t("looksGood")
                  : remaining > 0
                    ? `${pluralWeeks(remaining, lang, t)} ${t("unassigned")}`
                    : `${pluralWeeks(-remaining, lang, t)} ${t("over")}`}
              </span>
            </div>
          </div>

          <div className="px-6 py-5 mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-medium"
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                color: "var(--text-secondary)",
                background: "transparent",
              }}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => valid && onSave({ blocks: blocksRef.current })}
              disabled={!valid}
              className="text-[13px] font-semibold"
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                color: "white",
                background: valid ? "#34c759" : "rgba(128,128,128,0.2)",
                boxShadow: valid ? "0 1px 2px rgba(40,167,69,0.25)" : "none",
                cursor: valid ? "pointer" : "not-allowed",
              }}
            >
              {t("saveSprints")}
            </button>
          </div>
        </motion.div>
      </motion.div>

      <ConfirmDialog
        open={confirmResetId !== null}
        onClose={() => setConfirmResetId(null)}
        onConfirm={() => {
          if (confirmResetId) onResetBlock(confirmResetId);
        }}
        message={t("resetSprintConfirm")}
        confirmLabel={t("resetSprintBtn")}
        dark={dark}
      />
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) {
            commitBlocks(
              blocksRef.current.filter((x) => x.id !== confirmDeleteId),
            );
          }
        }}
        message={t("deleteSprintConfirm")}
        confirmLabel={t("deleteSprintBtn")}
        dark={dark}
      />
    </>
  );
}

// ─── LifeGridCanvas ────────────────────────────────────────────────────────
// Highly optimized canvas for rendering high-density life grids (Days, Weeks, Months, Years)
// Supports optional left-side year markers for multi-row views.