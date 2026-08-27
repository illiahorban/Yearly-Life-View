import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CalendarConfig, QuarterConfig, Block, QuarterMeta, AppleColorKey } from "../../types/calendar";
import { WEEKS_PER_QUARTER, LangContext } from "../../constants/i18n";
import { APPLE_COLORS, getQuarterColors, adaptColor, achromaticStyle } from "../../constants/colors";
import { pluralWeeks } from "../../utils/plural";
import { makeId } from "../../utils/storage";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { TrashIcon, CheckIcon } from "../icons/Icons";

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
  const applyPreset = (parts: number[]) =>
    commitBlocks(
      parts.map((w, i) => ({
        id: makeId(),
        weeks: w,
        label: `${t("sprintLabel")} ${i + 1}`,
      })),
    );
  const [colorPickerAnchor, setColorPickerAnchor] = useState<{
    id: string;
    rect: DOMRect;
  } | null>(null);
  const activeColorPickerBlock = colorPickerAnchor
    ? blocks.find((b) => b.id === colorPickerAnchor.id)
    : null;
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [quarterColorOpen, setQuarterColorOpen] = useState(false);

  const borderColor = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ overflowY: "auto", overscrollBehavior: "contain" }}
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
            inset: 0,
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
                  onClick={() => setQuarterColorOpen((v) => !v)}
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
                <AnimatePresence>
                  {quarterColorOpen && (
                    <>
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 49 }}
                        onClick={() => setQuarterColorOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -4 }}
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 28,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          top: "calc(100% + 7px)",
                          left: 0,
                          zIndex: 50,
                          background: modalBg,
                          backdropFilter: "blur(20px)",
                          WebkitBackdropFilter: "blur(20px)",
                          borderRadius: 12,
                          padding: 8,
                          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                          border: "1px solid var(--border-soft)",
                          width: 136,
                        }}
                      >
                        <ColorSwatchGrid
                          colors={APPLE_COLORS.map((ac) => ({
                            key: ac.key,
                            hex: dark ? ac.dark : ac.light,
                            label: ac.label,
                          }))}
                          selected={(() => {
                            const ac = APPLE_COLORS.find(
                              (a) => a.key === colorKey,
                            );
                            return ac ? (dark ? ac.dark : ac.light) : null;
                          })()}
                          onSelect={(_hex, key) => {
                            onColorChange(
                              key as (typeof APPLE_COLORS)[number]["key"],
                            );
                            setQuarterColorOpen(false);
                          }}
                          dark={dark}
                        />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
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

          {colorPickerAnchor !== null && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 49 }}
              onClick={() => setColorPickerAnchor(null)}
            />
          )}
          <div className="px-6 mt-4 max-h-72 overflow-auto">
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
                  // Dot always shows the vivid colour — the block's own if set, else the quarter's fill
                  const bDotHex = bAc
                    ? dark
                      ? bAc.dark
                      : bAc.light
                    : quarter.border;
                  // Tint the sprint row itself using the same colour logic as note/event
                  // cards (getEventColors), so choosing a sprint colour visibly colours
                  // its row here, in the sprint distribution modal.
                  const bEc = bAc ? getEventColors(bHex, dark) : null;
                  // The row background stays transparent (bEc.bg), so its text sits directly on the
                  // modal's page background rather than a filled surface — use the literal colour for
                  // white/black/grey instead of getEventColors' contrast-flipped textTitle, consistent
                  // with the goal-text literal-colour fix.
                  const bTextColor = bAc
                    ? readableGoalTextColor(bHex, dark, "var(--text)")
                    : "var(--text)";
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
                          padding: "8px 10px",
                          display: "flex",
                          flexDirection: "row",
                          gap: 8,
                          flex: 1,
                          transition:
                            "background 200ms ease, border-color 200ms ease",
                        }}
                      >
                        {/* Left column: number badge top (aligned with first text line), color dot bottom */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexShrink: 0,
                            alignSelf: "stretch",
                          }}
                        >
                          {/* Badge wrapped in a container matching first-line height so it centres on the text baseline */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              height: 19,
                              flexShrink: 0,
                            }}
                          >
                            <div
                              className="text-[10px] font-semibold tabular-nums flex items-center justify-center"
                              style={{
                                width: 13,
                                height: 13,
                                borderRadius: 999,
                                background: bAc
                                  ? `${bHex}22`
                                  : dark
                                    ? quarter.darkTint
                                    : quarter.tint,
                                color: bAc ? bHex : quarter.text,
                                flexShrink: 0,
                                boxShadow: `0 0 0 2px ${bAc ? `${bHex}22` : dark ? quarter.darkTint : quarter.tint}, 0 1px 3px rgba(0,0,0,0.18)`,
                              }}
                            >
                              {idx + 1}
                            </div>
                          </div>
                          {/* Color dot — wrapped to match stepper-row height (28px) so they sit on the same axis */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              height: 28,
                              flexShrink: 0,
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                setColorPickerAnchor((prev) =>
                                  prev?.id === b.id ? null : { id: b.id, rect },
                                );
                              }}
                              title={t("sprintColor")}
                              style={{
                                width: 13,
                                height: 13,
                                borderRadius: 999,
                                background: bDotHex,
                                border: "none",
                                boxShadow:
                                  "0 0 0 2px rgba(255,255,255,0.92), 0 0 0 3.5px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.18)",
                                cursor: "pointer",
                                display: "block",
                                flexShrink: 0,
                                padding: 0,
                              }}
                            />
                          </div>
                        </div>
                        {/* Right column: textarea on top, stepper + actions on bottom */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <TextareaAutosize
                            value={b.label}
                            onChange={(e) => {
                              const newBlocks = blocksRef.current.map((x) =>
                                x.id === b.id
                                  ? { ...x, label: e.target.value }
                                  : x,
                              );
                              commitBlocks(newBlocks);
                            }}
                            placeholder={t("sprintLabelPlaceholder")}
                            minRows={1}
                            className="bg-transparent outline-none w-full resize-none"
                            style={{
                              color: bDotHex,
                              fontSize: 13,
                              fontWeight: 500,
                              lineHeight: 1.45,
                              fontFamily: "inherit",
                              padding: 0,
                              border: "none",
                              display: "block",
                              minWidth: 0,
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              overflow: "hidden",
                            }}
                          />
                          {/* Stepper + actions */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <div
                              className="flex items-center gap-1"
                              style={{
                                background: "rgba(120,120,128,0.20)",
                                border: "1px solid rgba(120,120,128,0.40)",
                                borderRadius: 8,
                                padding: 2,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  update(b.id, {
                                    weeks: Math.max(1, b.weeks - 1),
                                  })
                                }
                                className="w-6 h-6 rounded-md text-[14px]"
                                style={{
                                  color: bAc
                                    ? bTextColor
                                    : "var(--text-secondary)",
                                }}
                              >
                                −
                              </button>
                              <span
                                className="text-[12px] font-semibold tabular-nums w-6 text-center"
                                style={{ color: bTextColor }}
                              >
                                {b.weeks}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  update(b.id, {
                                    weeks: Math.min(weeksCapacity, b.weeks + 1),
                                  })
                                }
                                className="w-6 h-6 rounded-md text-[14px]"
                                style={{
                                  color: bAc
                                    ? bTextColor
                                    : "var(--text-secondary)",
                                }}
                              >
                                +
                              </button>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                                marginLeft: "auto",
                                flexShrink: 0,
                              }}
                            >
                              <button
                                type="button"
                                title={t("resetSprint")}
                                onClick={() => setConfirmResetId(b.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-md"
                                style={{ color: "#ff3b30", flexShrink: 0 }}
                              >
                                <svg
                                  width="12"
                                  height="12"
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
                                onClick={() => setConfirmDeleteId(b.id)}
                                disabled={blocks.length === 1}
                                className="w-7 h-7 flex items-center justify-center rounded-md"
                                style={{
                                  color:
                                    blocks.length === 1
                                      ? "var(--text-tertiary)"
                                      : "#ff3b30",
                                  opacity: blocks.length === 1 ? 0.4 : 1,
                                }}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {colorPickerAnchor &&
                activeColorPickerBlock &&
                typeof document !== "undefined" &&
                ReactDOM.createPortal(
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: -4 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 28,
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "fixed",
                        top: (() => {
                          const below = colorPickerAnchor.rect.bottom + 6;
                          const popupHeight = 130;
                          if (below + popupHeight <= window.innerHeight)
                            return Math.max(8, below);
                          return Math.max(
                            8,
                            Math.min(
                              colorPickerAnchor.rect.top - popupHeight - 6,
                              window.innerHeight - popupHeight - 8,
                            ),
                          );
                        })(),
                        left: Math.min(
                          Math.max(8, colorPickerAnchor.rect.left),
                          window.innerWidth - 152,
                        ),
                        zIndex: 60,
                        background: modalBg,
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        borderRadius: 12,
                        padding: 8,
                        boxShadow:
                          "0 8px 32px rgba(0,0,0,0.26), inset 0 0 0 1px var(--border-soft)",
                        width: 136,
                      }}
                    >
                      <ColorSwatchGrid
                        colors={APPLE_COLORS.map((ac) => ({
                          key: ac.key,
                          hex: dark ? ac.dark : ac.light,
                          label: ac.label,
                        }))}
                        selected={(() => {
                          if (!activeColorPickerBlock.color) return null;
                          const ac = APPLE_COLORS.find(
                            (a) => a.key === activeColorPickerBlock.color,
                          );
                          return ac ? (dark ? ac.dark : ac.light) : null;
                        })()}
                        onSelect={(_hex, key) => {
                          update(activeColorPickerBlock.id, {
                            color: key as (typeof APPLE_COLORS)[number]["key"],
                          });
                          setColorPickerAnchor(null);
                        }}
                        onClear={() => {
                          update(activeColorPickerBlock.id, {
                            color: undefined,
                          });
                          setColorPickerAnchor(null);
                        }}
                        clearLabel={t("quarterDefault")}
                        dark={dark}
                      />
                    </motion.div>
                  </AnimatePresence>,
                  document.body,
                )}
              <button
                type="button"
                onClick={() =>
                  commitBlocks([
                    ...blocksRef.current,
                    {
                      id: makeId(),
                      weeks: Math.max(1, remaining > 0 ? remaining : 1),
                      label: `${t("sprintLabel")} ${blocksRef.current.length + 1}`,
                    },
                  ])
                }
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
                color: valid ? "#28a745" : "#c00",
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
          if (confirmDeleteId)
            commitBlocks(
              blocksRef.current.filter((x) => x.id !== confirmDeleteId),
            );
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