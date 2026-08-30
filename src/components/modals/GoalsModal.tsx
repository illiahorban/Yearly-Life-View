import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import TextareaAutosize from "react-textarea-autosize";
import type { BlockGoals, Goal, AppleColorKey } from "../../types/calendar";
import { useIsMobile } from "../../hooks/use-mobile";
import { useVisualViewport } from "../../hooks/use-visual-viewport";
import { makeId, newTimestamps } from "../../utils/storage";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, goalCheckboxAchromaticStyle, getEventColors, normaliseGrey } from "../../constants/colors";
import { LangContext } from "../../constants/i18n";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { GripIcon, TrashIcon, GoalsIcon, CheckIcon, ChevronLeftIcon } from "../icons/Icons";

export function GoalsModal({
  blockId: _bid,
  blockLabel,
  initial,
  dark,
  modalBg,
  accentColor,
  titleLabel,
  descPlaceholder,
  onSave,
  onClose,
  onBack,
}: {
  key?: React.Key;
  blockId: string;
  blockLabel: string;
  initial: BlockGoals;
  dark: boolean;
  modalBg: string;
  accentColor?: string;
  titleLabel?: string;
  descPlaceholder?: string;
  onSave: (bg: BlockGoals, label: string) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const { t } = React.useContext(LangContext);
  const isMobile = useIsMobile();
  const { height: vvHeight, offsetTop: vvOffsetTop, isKeyboardOpen } = useVisualViewport();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const [label, setLabel] = useState(blockLabel);
  const labelRef = useRef(label);
  const [description, setDescription] = useState(initial.description);
  const descriptionRef = useRef(description);
  const [goals, setGoals] = useState<Goal[]>(() =>
    initial.goals.filter((g) => !g.isDeleted).map((g) => ({ ...g })),
  );
  const goalsRef = useRef(goals);
  const commitGoalsDraft = (next: Goal[]) => {
    goalsRef.current = next;
    setGoals(next);
    onSave(
      {
        description: descriptionRef.current.trim(),
        goals: next,
      },
      labelRef.current.trim() || blockLabel,
    );
  };
  const commitLabel = (next: string) => {
    labelRef.current = next;
    setLabel(next);
    onSave(
      { description: descriptionRef.current.trim(), goals: goalsRef.current },
      next.trim() || blockLabel,
    );
  };
  const commitDescription = (next: string) => {
    descriptionRef.current = next;
    setDescription(next);
    onSave(
      { description: next.trim(), goals: goalsRef.current },
      labelRef.current.trim() || blockLabel,
    );
  };
  const activeGoals = goals.filter((g) => !g.isDeleted && g.text.trim());
  const canAdd = true;

  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string | null>(
    null,
  );
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);

  // Tracks each goal-text field's rendered height so the row can grow as text
  // wraps onto multiple lines, and so the color/delete overlay buttons can pin
  // to the top-right corner instead of overlapping the wrapped text.
  const [goalInputHeights, setGoalInputHeights] = useState<
    Record<string, number>
  >({});
  const handleGoalInputHeightChange = (id: string, h: number) => {
    setGoalInputHeights((prev) =>
      prev[id] === h ? prev : { ...prev, [id]: h },
    );
  };

  // Color picker state
  const [colorPickerGoalId, setColorPickerGoalId] = useState<string | null>(
    null,
  );
  const toggleColorPicker = (id: string) => {
    setColorPickerGoalId(colorPickerGoalId === id ? null : id);
  };
  const setGoalColor = (id: string, color: string | undefined) => {
    commitGoalsDraft(
      goalsRef.current.map((x) => (x.id === id ? { ...x, color } : x)),
    );
    setColorPickerGoalId(null);
  };

  const finalize = (after: () => void) => {
    onSave(
      {
        description: descriptionRef.current.trim(),
        goals: goalsRef.current.map((g, i) =>
          g.text.trim() ? g : { ...g, text: `${t("goal")} ${i + 1}` },
        ),
      },
      labelRef.current.trim() || blockLabel,
    );
    after();
  };

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.03)";

  return (
    <>
      <motion.div
        initial={false}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-auto"
        style={{
          position: "fixed",
          top: `${vvOffsetTop}px`,
          left: 0,
          right: 0,
          height: `${vvHeight}px`,
          overflow: "hidden",
          overscrollBehavior: "contain",
          transition: "top 0.15s ease-out, height 0.15s ease-out",
        }}
        onClick={() => {
          setColorPickerGoalId(null);
          finalize(onClose);
        }}
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
            background: "rgba(0,0,0,0.36)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          onClick={(e) => {
            e.stopPropagation();
            setColorPickerGoalId(null);
          }}
          style={{
            position: "relative",
            width: "min(92vw,400px)",
            background: modalBg,
            backdropFilter: "saturate(180%) blur(28px)",
            WebkitBackdropFilter: "saturate(180%) blur(28px)",
            borderRadius: 22,
            boxShadow: accentColor
              ? `0 20px 60px rgba(0,0,0,0.28), 0 0 0 1.5px ${accentColor}`
              : `0 20px 60px rgba(0,0,0,0.28), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
            border: `1.5px solid ${accentColor ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)")}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: `${Math.max(160, vvHeight - (isMobile ? 16 : 32))}px`,
            transition: "max-height 0.15s ease-out",
          }}
        >
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 shrink-0">
            {onBack && (
              <button
                onClick={() => finalize(onBack)}
                title={t("back")}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 99,
                  background: "rgba(128,128,128,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <ChevronLeftIcon />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] font-semibold tracking-widest uppercase mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {titleLabel ?? t("sprintGoals")}
              </div>
              <input
                value={label}
                onChange={(e) => commitLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  padding: 0,
                }}
              />
            </div>
            <button
              onClick={() => finalize(onClose)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 99,
                background: "rgba(128,128,128,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                fontSize: 14,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overscrollBehavior: "contain",
              minHeight: 0,
              scrollbarWidth: "thin",
              scrollbarColor: dark
                ? "rgba(255,255,255,0.20) transparent"
                : "rgba(0,0,0,0.18) transparent",
            }}
          >
            <div className="px-5 pb-3">
              <TextareaAutosize
                value={description}
                onChange={(e) => commitDescription(e.target.value)}
                placeholder={descPlaceholder ?? t("sprintDescPlaceholder")}
                minRows={2}
                style={{
                  width: "100%",
                  resize: "none",
                  overflow: "hidden",
                  outline: "none",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                  background: inputBg,
                  color: "var(--text)",
                  boxSizing: "border-box",
                  display: "block",
                }}
              />
            </div>

            <div style={{ height: 1, background: borderColor }} />

            {goals.length === 0 ? (
              <div className="px-5 py-3">
                <button
                  onClick={() =>
                    commitGoalsDraft([
                      ...goalsRef.current,
                      {
                        id: makeId(),
                        text: "",
                        done: false,
                        ...newTimestamps(),
                      },
                    ])
                  }
                  style={{
                    width: "100%",
                    height: 34,
                    borderRadius: 10,
                    border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"}`,
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>{" "}
                  {t("addGoal")}
                </button>
              </div>
            ) : (
              <div className="px-5 pt-3 pb-3">
                <div
                  className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {t("goalsLabel")} ({activeGoals.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {goals.map((g, idx) => {
                    const gc = g.color;
                    const ec = getEventColors(gc ?? "", dark);
                    const inputBackground = ec.bg;
                    const inputBorderColor = ec.border;
                    const ach = gc
                      ? achromaticStyle(resolveNoteHex(gc), dark)
                      : null;
                    // White/black/grey show their literal colour as text instead of the
                    // auto-inverted "readable ink" colour getEventColors returns for achromatic
                    // hues — mirrors the day-goal fix.
                    const inputTextColor = ec.textTitle;
                    const placeholderClass = ach
                      ? `placeholder-goal-${ach.tier}`
                      : undefined;
                    const dotBorder =
                      ach?.tier === "white"
                        ? "1.5px solid rgba(0,0,0,0.35)"
                        : `1.5px solid ${dark ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.9)"}`;
                    return (
                      <div
                        key={g.id}
                        className="flex items-center gap-2"
                        onMouseEnter={() => setHoveredGoalId(g.id)}
                        onMouseLeave={() => setHoveredGoalId(null)}
                      >
                        <span
                          className="text-[11px] tabular-nums w-4 text-right shrink-0"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {idx + 1}.
                        </span>
                        <div style={{ flex: 1, position: "relative" }}>
                          <TextareaAutosize
                            value={g.text}
                            onChange={(e) =>
                              commitGoalsDraft(
                                goalsRef.current.map((x) =>
                                  x.id === g.id
                                    ? { ...x, text: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            onHeightChange={(h) =>
                              handleGoalInputHeightChange(g.id, h)
                            }
                            placeholder={`${t("goalPlaceholder")} ${idx + 1}`}
                            className={placeholderClass}
                            minRows={1}
                            style={{
                              width: "100%",
                              resize: "none",
                              overflow: "hidden",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              background: inputBackground,
                              border: `1.5px solid ${inputBorderColor}`,
                              borderRadius: 12,
                              padding: "8px 59px 8px 10px",
                              fontSize: 13,
                              lineHeight: 1.4,
                              color: inputTextColor,
                              outline: "none",
                              fontFamily: "inherit",
                              boxSizing: "border-box",
                              display: "block",
                              boxShadow: ec.boxShadow || undefined,
                              transition:
                                "background 200ms ease, border-color 200ms ease, color 200ms ease",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              top:
                                (goalInputHeights[g.id] ?? 20) > 24 ? 8 : "50%",
                              transform:
                                (goalInputHeights[g.id] ?? 20) > 24
                                  ? "none"
                                  : "translateY(-50%)",
                              right: 8,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              transition: "top 150ms",
                              opacity:
                                hoveredGoalId === g.id ||
                                colorPickerGoalId === g.id
                                  ? 1
                                  : 0,
                              pointerEvents:
                                hoveredGoalId === g.id ||
                                colorPickerGoalId === g.id
                                  ? "auto"
                                  : "none",
                              isolation: "isolate",
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleColorPicker(g.id);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              title={t("chooseColor")}
                              aria-label={t("chooseColor")}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 999,
                                flexShrink: 0,
                                background: normaliseGrey(gc) || "transparent",
                                border: "none",
                                boxShadow: gc
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
                              }}
                            >
                              {!gc && (
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
                            {colorPickerGoalId === g.id && (
                              <motion.div
                                key="goal-color-popover"
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
                                  top: "calc(100% + 6px)",
                                  right: 0,
                                  zIndex: 200,
                                  background: modalBg,
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
                                  style={{
                                    position: "fixed",
                                    inset: 0,
                                    zIndex: -1,
                                  }}
                                  onClick={() => setColorPickerGoalId(null)}
                                />
                                <ColorSwatchGrid
                                  colors={APPLE_COLORS.map((ac) => ({
                                    key: ac.key,
                                    hex: dark ? ac.dark : ac.light,
                                    label: ac.label,
                                  }))}
                                  selected={
                                    goals.find(
                                      (x) => x.id === colorPickerGoalId,
                                    )?.color ?? null
                                  }
                                  onSelect={(hex) =>
                                    setGoalColor(colorPickerGoalId, hex)
                                  }
                                  onClear={() =>
                                    setGoalColor(colorPickerGoalId, undefined)
                                  }
                                  clearLabel={t("noColor")}
                                  dark={dark}
                                />
                              </motion.div>
                            )}
                            <button
                              onClick={() => setConfirmDeleteGoalId(g.id)}
                              onPointerDown={(e) => e.stopPropagation()}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 999,
                                border: "none",
                                boxSizing: "border-box",
                                background: dark
                                  ? "rgba(255,59,48,0.15)"
                                  : "rgba(255,59,48,0.1)",
                                color: "#ff3b30",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
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
                      </div>
                    );
                  })}
                </div>
                {canAdd && (
                  <button
                    onClick={() =>
                      commitGoalsDraft([
                        ...goalsRef.current,
                        {
                          id: makeId(),
                          text: "",
                          done: false,
                          ...newTimestamps(),
                        },
                      ])
                    }
                    className="mt-2"
                    style={{
                      width: "100%",
                      height: 34,
                      borderRadius: 10,
                      border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"}`,
                      background: "transparent",
                      color: "var(--text-secondary)",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>{" "}
                    {t("addGoal")}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* end scrollable body */}
        </motion.div>
      </motion.div>
      <ConfirmDialog
        open={confirmDeleteGoalId !== null}
        onClose={() => setConfirmDeleteGoalId(null)}
        onConfirm={() => {
          if (confirmDeleteGoalId) {
            commitGoalsDraft(
              goalsRef.current.filter((x) => x.id !== confirmDeleteGoalId),
            );
            setConfirmDeleteGoalId(null);
          }
        }}
        message={t("deleteGoalConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
    </>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────