import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { QuarterConfig, Quarter, QuarterMeta, DayState, Milestone, NoteEntry, DayGoals, BlockGoals, AppleColorKey } from "../../types/calendar";
import { startOfYear, startOfWeekMonday, startOfDay, addDays, sameDay, dateKey } from "../../utils/date-utils";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, resolveQuarter, mutedTextColors, readableGoalTextColor, goalCheckboxAchromaticStyle, goalCheckboxColors } from "../../constants/colors";
import { WEEKS_PER_QUARTER, LangContext } from "../../constants/i18n";
import { pluralWeeks, pluralDayStreak } from "../../utils/plural";
import { QuarterNameEditor } from "./QuarterNameEditor";
import { BlockLabel } from "./BlockLabel";
import { DayTile } from "./DayTile";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { GoalsIcon, FlagIcon, CheckIcon } from "../icons/Icons";

export function BlocksRenderer({
  qi: _qi,
  quarter,
  qConfig,
  startIndex,
  weeks,
  currentWeekIndex,
  todayProgress,
  dayState,
  weekRefs,
  notes,
  milestonesMap,
  blockGoals,
  dayGoalsMap,
  dark,
  isCompactViewport,
  cardBg,
  overlayBg,
  weekSel,
  matchedDates,
  activeMatchKey,
  onNoteOpen,
  onLabelChange,
  onGoalToggle,
  onEditGoals,
  onWeekLabelClick,
  onCreateSprint,
  onCancelSel,
  viewYear,
}: {
  qi: number;
  quarter: Quarter;
  qConfig: QuarterConfig;
  startIndex: number;
  weeks: Array<{ weekStart: Date; days: Date[] }>;
  currentWeekIndex: number;
  todayProgress: number;
  viewYear: number;
  dayState: (d: Date) => DayState;
  weekRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  notes: Record<string, NoteEntry[]>;
  milestonesMap: Record<string, Milestone[]>;
  blockGoals: Record<string, BlockGoals>;
  dayGoalsMap: Record<string, DayGoals>;
  dark: boolean;
  isCompactViewport: boolean;
  cardBg: string;
  overlayBg: string;
  weekSel: { qi: number; anchor: number; focus: number } | null;
  matchedDates: Set<string>;
  activeMatchKey?: string;
  onNoteOpen: (key: string) => void;
  onLabelChange: (blockId: string, label: string) => void;
  onGoalToggle: (blockId: string, goalId: string) => void;
  onEditGoals: (blockId: string) => void;
  onWeekLabelClick: (qi: number, qOffset: number) => void;
  onCreateSprint: (selStart: number, selEnd: number) => void;
  onCancelSel: () => void;
}) {
  const { t, lang } = React.useContext(LangContext);
  let cursor = 0;
  const blocks = qConfig.blocks.map((b) => {
    const r = { start: cursor, end: cursor + b.weeks };
    cursor += b.weeks;
    return { ...b, ...r };
  });
  const selMin =
    weekSel?.qi === _qi ? Math.min(weekSel.anchor, weekSel.focus) : -1;
  const selMax =
    weekSel?.qi === _qi ? Math.max(weekSel.anchor, weekSel.focus) : -2;
  const hasSelection = weekSel?.qi === _qi;

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {blocks.map((block) => {
            const blockRows = weeks.slice(
              startIndex + block.start,
              startIndex + block.end,
            );
            const allDays = blockRows.flatMap((r) => r.days);
            // Count only days that belong to the viewed year so that cross-year
            // grid weeks (e.g. Dec 29-31 from the prior year in Q1's first week)
            // are excluded from the sprint's day counter.
            const yearDays = allDays.filter(
              (d) => d.getFullYear() === viewYear,
            );
            const totalDays = yearDays.length;
            const _now = startOfDay(new Date());
            const pastDays = yearDays.filter((d) => d < _now).length;
            const hasToday = yearDays.some((d) => sameDay(d, _now));
            const completedPortion =
              pastDays + (hasToday ? todayProgress / 100 : 0);
            const timePct =
              totalDays > 0
                ? Math.max(
                    0,
                    Math.min(100, (completedPortion / totalDays) * 100),
                  )
                : 0;

            const bg = blockGoals[block.id];
            const activeGoals = bg?.isDeleted
              ? []
              : (bg?.goals.filter((g) => !g.isDeleted && g.text.trim()) ?? []);
            const goalPct =
              activeGoals.length > 0
                ? (activeGoals.filter((g) => g.done).length /
                    activeGoals.length) *
                  100
                : null;
            const pct = timePct;
            const daysLeft = Math.max(
              0,
              totalDays - pastDays - (hasToday ? 1 : 0),
            );
            const isFuture = yearDays.length > 0 && yearDays[0]! > _now;
            const isComplete =
              yearDays.length > 0 && yearDays[yearDays.length - 1]! < _now;
            const blockStreak = (() => {
              const isDone = (dk: string) => {
                const g = dayGoalsMap[dk];
                return (
                  g != null &&
                  !g.isDeleted &&
                  g.count > 0 &&
                  g.done.length >= g.count &&
                  g.done.every(Boolean)
                );
              };
              const t0 = startOfDay(new Date());
              const rel = allDays
                .filter((d) => d <= t0)
                .sort((a, b) => a.getTime() - b.getTime());
              if (rel.length === 0) return 0;
              let idx = rel.length - 1;
              if (!isDone(dateKey(rel[idx]!))) idx--;
              let s = 0;
              for (let i = idx; i >= 0; i--) {
                if (!isDone(dateKey(rel[i]!))) break;
                s++;
              }
              return s;
            })();
            const effectiveQ = block.color
              ? resolveQuarter(
                  { name: block.label, colorKey: block.color },
                  dark,
                )
              : quarter;
            const softColor = dark ? effectiveQ.darkSoft : effectiveQ.soft;
            const mt = mutedTextColors(block.color ?? quarter.key, dark);

            return (
              <motion.div
                layout
                key={block.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                style={{
                  background: "transparent",
                  borderRadius: 14,
                  border: `2px solid ${effectiveQ.border}`,
                  overflow: "visible",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-2 sm:px-3.5 pt-3 pb-1"
                  style={{ position: "relative" }}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <BlockLabel
                      value={block.label}
                      onChange={(v) => onLabelChange(block.id, v)}
                      color={effectiveQ.nameColor}
                    />
                  </div>
                  {blockStreak > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        lineHeight: 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          filter: "drop-shadow(0 0 3px rgba(255,149,0,0.5))",
                        }}
                      >
                        🔥
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ff9500",
                        }}
                      >
                        {pluralDayStreak(blockStreak, lang)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditGoals(block.id)}
                      title={t("sprintGoals")}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: "transparent",
                        border: "none",
                        color:
                          activeGoals.length > 0
                            ? effectiveQ.nameColor
                            : mt.tertiary,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <GoalsIcon
                        style={{
                          paddingTop: 0,
                          paddingLeft: 0,
                          paddingRight: 0,
                          marginLeft: 6,
                          marginTop: 0,
                          marginBottom: 0,
                          marginRight: -6,
                        }}
                      />
                    </button>
                    <span
                      className="text-[10px] tabular-nums"
                      style={{ color: mt.tertiary }}
                    >
                      {pluralWeeks(block.weeks, lang, t)}
                    </span>
                  </div>
                </div>

                {/* Progress strip */}
                <div className="px-2 sm:px-3.5 pt-0.5 pb-2">
                  <div
                    className="text-center tabular-nums"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      marginBottom: 3,
                      paddingLeft: 0,
                      paddingTop: 0,
                      marginLeft: 0,
                      marginTop: -6,
                      color: isFuture
                        ? mt.tertiary
                        : !dark &&
                            (block.color === "green" ||
                              (!block.color && quarter.key === "green"))
                          ? "var(--apple-green-deep)"
                          : effectiveQ.text,
                    }}
                  >
                    {pct.toFixed(0)}%
                  </div>
                  <div
                    className="w-full h-1 rounded-full overflow-hidden shrink-0"
                    style={{
                      height: 4,
                      minHeight: 4,
                      maxHeight: 4,
                      background: dark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  >
                    <motion.div
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 24,
                      }}
                      style={{
                        height: 4,
                        minHeight: 4,
                        maxHeight: 4,
                        background: effectiveQ.fill,
                        borderRadius: 999,
                        boxShadow: pct > 0 ? `0 0 6px ${softColor}` : "none",
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums">
                    <span style={{ color: mt.tertiary }}>
                      {pastDays} {t("of")} {totalDays} {t("daysOf")}
                    </span>
                    <span style={{ color: mt.tertiary }}>
                      {isComplete ? t("done") : `${daysLeft} ${t("left")}`}
                    </span>
                  </div>
                  {goalPct !== null && (() => {
                    const doneCount = activeGoals.filter((g) => g.done).length;
                    const isAllDone = activeGoals.length > 0 && doneCount === activeGoals.length;
                    return (
                      <div style={{ marginTop: 6 }}>
                        <div className="mb-1 flex justify-center">
                          <span
                            className="text-[10px] tabular-nums transition-colors"
                            style={{
                              color: isAllDone
                                ? "#34c759"
                                : dark
                                  ? "rgba(255,255,255,0.4)"
                                  : "rgba(0,0,0,0.4)",
                              fontWeight: isAllDone ? 600 : 500,
                            }}
                          >
                            {doneCount}/{activeGoals.length} {t("goals")}
                          </span>
                        </div>
                        <div
                          className="w-full rounded-full overflow-hidden shrink-0"
                          style={{
                            height: 3,
                            minHeight: 3,
                            maxHeight: 3,
                            background: dark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.06)",
                          }}
                        >
                          <motion.div
                            initial={false}
                            animate={{ width: `${goalPct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 120,
                              damping: 24,
                            }}
                            style={{
                              height: 3,
                              minHeight: 3,
                              maxHeight: 3,
                              background: "#34c759",
                              borderRadius: 999,
                              boxShadow:
                                goalPct > 0
                                  ? "0 0 6px rgba(52,199,89,0.35)"
                                  : "none",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Sprint description */}
                {bg?.description && (
                  <div
                    className="px-2 sm:px-3.5 pb-2"
                    style={{
                      paddingBottom: 4,
                    }}
                  >
                    <div
                      className="flex items-stretch gap-1.5"
                    >
                      <span
                        className="w-[2px] rounded-full flex-shrink-0 self-stretch my-0.5"
                        style={{ background: effectiveQ.fill }}
                      />
                      <p
                        className="text-[11px] leading-snug"
                        style={{
                          color: mt.tertiary,
                          paddingLeft: 0,
                          paddingTop: 0,
                          paddingBottom: 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {bg.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Checklist */}
                {activeGoals.length > 0 && (
                  <div
                    className="px-2 sm:px-3.5 pb-2"
                    style={{
                      paddingTop: bg?.description ? 5 : undefined,
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      {activeGoals.map((goal) => {
                        const cb = goalCheckboxColors(
                          goal.color,
                          dark,
                          effectiveQ.fill,
                          effectiveQ.key,
                        );
                        return (
                          <label
                            key={goal.id}
                            className="flex items-start gap-2 cursor-pointer select-none"
                            onClick={() => onGoalToggle(block.id, goal.id)}
                            style={{
                              color: goal.done
                                ? mt.tertiary
                                : readableGoalTextColor(
                                    goal.color,
                                    dark,
                                    mt.secondary,
                                  ),
                            }}
                          >
                            <div
                              style={{
                                boxSizing: "border-box",
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                flexShrink: 0,
                                marginTop: 1,
                                background: goal.done ? cb.doneBg : cb.emptyBg,
                                border: `1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 150ms ease",
                                cursor: "pointer",
                              }}
                            >
                              {goal.done && <CheckIcon color={cb.icon} />}
                            </div>
                            <span
                              className="text-[11px] leading-snug"
                              style={{
                                textDecoration: goal.done
                                  ? "line-through"
                                  : "none",
                                opacity: goal.done ? 0.5 : 1,
                                minWidth: 0,
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                              }}
                            >
                              {goal.text}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Week rows */}
                <div className="flex flex-col gap-[2.67px] sm:gap-1.5 pb-3 pt-1">
                  {blockRows.map(({ days }, ri) => {
                    const wi = startIndex + block.start + ri;
                    const qOffset = block.start + ri;
                    const isCurrent = wi === currentWeekIndex;
                    const isSel = qOffset >= selMin && qOffset <= selMax;
                    const isPanelOpen = hasSelection && qOffset === selMax;
                    const weekDone = days.reduce((s, d) => {
                      const g = dayGoalsMap[dateKey(d)];
                      return s + (g ? g.done.filter(Boolean).length : 0);
                    }, 0);
                    const weekTotal = days.reduce((s, d) => {
                      const g = dayGoalsMap[dateKey(d)];
                      return s + (g ? g.count : 0);
                    }, 0);
                    return (
                      <motion.div
                        key={wi}
                        layout="position"
                        className="transform-gpu will-change-transform"
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        {/* Three-column week row: [left 60px] [tiles flex-1] [right 60px] */}
                        <div
                          ref={(el) => {
                            weekRefs.current[wi] = el;
                          }}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          {/* LEFT COLUMN — week number, responsive width */}
                          <div
                            className="lc-side-col"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              type="button"
                              className="lc-week-label"
                              onClick={() => onWeekLabelClick(_qi, qOffset)}
                              title={
                                hasSelection
                                  ? isSel
                                    ? t("clickMoveEndSelection")
                                    : t("extendSelectionHere")
                                  : t("clickStartSprintSelection")
                              }
                              style={{
                                color: isCurrent
                                  ? "var(--text)"
                                  : isSel
                                    ? mt.secondary
                                    : mt.tertiary,
                                fontWeight: isCurrent ? 600 : 400,
                                background: "transparent",
                                 borderRadius: 12,
                                 padding: 0,
                                border: "none",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 lineHeight: 1,
                                boxShadow: isSel
                                   ? `inset 0 0 0 1.5px ${effectiveQ.border}`
                                  : "inset 0 0 0 1.5px transparent",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                outline: "none",
                                 transition: "color 120ms, box-shadow 120ms",
                                opacity: hasSelection && !isSel ? 0.4 : 1,
                              }}
                            >
                              <span className="text-[11px] sm:text-[13px] tabular-nums">
                                {wi + 1}
                              </span>
                            </button>
                          </div>
                          {/* MIDDLE COLUMN — day tiles, fills remaining space */}
                          <div
                            className="grid grid-cols-7 gap-[2.67px] sm:gap-1.5"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              justifyContent: "center",
                            }}
                          >
                            {days.map((d, di) => (
                              <DayTile
                                key={di}
                                date={d}
                                state={dayState(d)}
                                todayProgress={todayProgress}
                                notes={notes[dateKey(d)]}
                                milestones={milestonesMap[dateKey(d)] ?? []}
                                dayGoals={dayGoalsMap[dateKey(d)]}
                                accentColor={effectiveQ.tileFill}
                                highlighted={
                                  matchedDates.size > 0
                                    ? matchedDates.has(dateKey(d))
                                    : undefined
                                }
                                isActiveMatch={activeMatchKey === dateKey(d)}
                                dark={dark}
                                isCompactViewport={isCompactViewport}
                                onOpen={() => {
                                  if (dayState(d) !== "out")
                                    onNoteOpen(dateKey(d));
                                }}
                              />
                            ))}
                          </div>
                          {/* RIGHT COLUMN — goals counter (vertical fraction) */}
                          <div
                            className="lc-side-col"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {weekTotal > 0 && (
                              <div
                                className="lc-week-counter"
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 1.5,
                                  lineHeight: 1,
                                  userSelect: "none",
                                }}
                                title={`${weekDone} из ${weekTotal} целей выполнено`}
                              >
                                {/* Верхний этаж: остаток невыполненных целей (серый) */}
                                <span
                                  className="text-[11px] sm:text-[13px] tabular-nums"
                                  style={{
                                    fontWeight: 500,
                                    color: "var(--text-tertiary)",
                                    lineHeight: 1,
                                    textDecoration: "none",
                                    borderBottom: "none",
                                  }}
                                >
                                  {Math.max(0, weekTotal - weekDone)}
                                </span>
                                {/* Разделительная горизонтальная черта дроби */}
                                <div
                                  className="w-[12px] sm:w-[15px]"
                                  style={{
                                    height: 1,
                                    backgroundColor: "var(--border-subtle, rgba(255,255,255,0.15))",
                                    borderRadius: 0.5,
                                  }}
                                />
                                {/* Нижний этаж: выполненные цели (зеленый при > 0, серый при 0) */}
                                <span
                                  className="text-[11px] sm:text-[13px] tabular-nums"
                                  style={{
                                    fontWeight: weekDone > 0 ? 600 : 500,
                                    color: weekDone > 0 ? "#34c759" : "var(--text-tertiary)",
                                    lineHeight: 1,
                                    textDecoration: "none",
                                    borderBottom: "none",
                                  }}
                                >
                                  {weekDone}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <AnimatePresence initial={false} mode="popLayout">
                          {isPanelOpen && (
                            <motion.div
                              key={`week-selection-panel-${_qi}-${qOffset}`}
                              initial={{ y: "100%", opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: "100%", opacity: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 35,
                              }}
                              className="transform-gpu will-change-transform"
                              style={{
                                overflow: "hidden",
                                marginTop: 8,
                                WebkitTapHighlightColor: "transparent",
                              }}
                            >
                              <div
                                data-week-selection-panel
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl transform-gpu will-change-transform"
                                style={{
                                  background: "transparent",
                                  border: `1px solid ${quarter.border}55`,
                                  WebkitTapHighlightColor: "transparent",
                                }}
                              >
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span
                                    className="text-[12px] font-semibold truncate"
                                    style={{ color: quarter.text }}
                                  >
                                    {selMin === selMax
                                      ? `${t("week")} ${selMin + startIndex + 1}`
                                      : `${t("week")} ${selMin + startIndex + 1}–${selMax + startIndex + 1}`}
                                  </span>
                                  <span
                                    className="text-[10px]"
                                    style={{ color: "var(--text-tertiary)" }}
                                  >
                                    {pluralWeeks(selMax - selMin + 1, lang, t)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={onCancelSel}
                                    className="transform-gpu will-change-transform"
                                    style={{
                                      height: 28,
                                      paddingInline: 10,
                                      borderRadius: 8,
                                      border: `1px solid ${quarter.border}44`,
                                      background: "transparent",
                                      color: "var(--text-secondary)",
                                      fontSize: 12,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      WebkitTapHighlightColor: "transparent",
                                    }}
                                  >
                                    {t("cancel")}
                                  </motion.button>
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => onCreateSprint(selMin, selMax)}
                                    className="transform-gpu will-change-transform"
                                    style={{
                                      height: 28,
                                      paddingInline: 12,
                                      borderRadius: 8,
                                      border:
                                        quarter.key === "white" && !dark
                                          ? "1px solid rgba(0,0,0,0.15)"
                                          : "none",
                                      background: quarter.border,
                                      color:
                                        quarter.key === "white"
                                          ? "#000000"
                                          : "white",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      boxShadow: `0 2px 8px ${quarter.border}55`,
                                      WebkitTapHighlightColor: "transparent",
                                    }}
                                  >
                                    {t("createSprint")}
                                  </motion.button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

// ─── QuarterNameEditor ────────────────────────────────────────────────────────