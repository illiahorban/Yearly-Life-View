import React, { useState, useMemo, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { CalendarConfig, QuarterMeta, BlockGoals, DayGoals, AppleColorKey, Quarter } from "../../types/calendar";
import { startOfYear, startOfWeekMonday, addDays, sameDay, dateKey } from "../../utils/date-utils";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, resolveQuarter, goalCheckboxAchromaticStyle, normaliseGrey, readableGoalTextColor, goalCheckboxColors } from "../../constants/colors";
import { LangContext, WEEKS_PER_QUARTER } from "../../constants/i18n";
import { pluralCount } from "../../utils/plural";
import { HighlightText } from "../common/HighlightText";
import { SearchIcon, CheckIcon, GoalsIcon } from "../icons/Icons";

export function AllGoalsPanel({
  config,
  blockGoals,
  quarterGoals,
  yearGoals,
  viewYear,
  resolvedQuarters,
  dark,
  modalBg,
  onToggleGoal,
  onToggleQuarterGoal,
  onToggleYearGoal,
  onEditGoals,
  onEditQuarterGoals,
  onEditYearGoals,
  onClose,
}: {
  key?: React.Key;
  config: CalendarConfig;
  blockGoals: Record<string, BlockGoals>;
  quarterGoals: Record<number, BlockGoals>;
  yearGoals: BlockGoals;
  viewYear: number;
  resolvedQuarters: Quarter[];
  dark: boolean;
  modalBg: string;
  onToggleGoal: (blockId: string, goalId: string) => void;
  onToggleQuarterGoal: (qi: number, goalId: string) => void;
  onToggleYearGoal: (goalId: string) => void;
  onEditGoals: (blockId: string) => void;
  onEditQuarterGoals: (qi: number) => void;
  onEditYearGoals: () => void;
  onClose: () => void;
}) {
  const { t } = React.useContext(LangContext);
  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";

  const activeYearGoals = yearGoals.isDeleted
    ? []
    : yearGoals.goals.filter((g) => !g.isDeleted && g.text.trim());
  let totalGoals = activeYearGoals.length,
    doneGoals = activeYearGoals.filter((g) => g.done).length;
  config.quarters.forEach((qc, qi) => {
    const qGoals = quarterGoals[qi]?.isDeleted
      ? []
      : (quarterGoals[qi]?.goals.filter((g) => !g.isDeleted && g.text.trim()) ??
        []);
    totalGoals += qGoals.length;
    doneGoals += qGoals.filter((g) => g.done).length;
    qc.blocks.forEach((b) => {
      const bg = blockGoals[b.id];
      const active = bg?.isDeleted
        ? []
        : (bg?.goals.filter((g) => !g.isDeleted && g.text.trim()) ?? []);
      totalGoals += active.length;
      doneGoals += active.filter((g) => g.done).length;
    });
  });

  return ReactDOM.createPortal(
    <motion.div
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ overflowY: "auto", overscrollBehavior: "contain" }}
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
          background: "rgba(0,0,0,0.34)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col"
        style={{
          position: "relative",
          background: modalBg,
          backdropFilter: "saturate(180%) blur(28px)",
          WebkitBackdropFilter: "saturate(180%) blur(28px)",
          borderRadius: 22,
          boxShadow: `0 24px 70px rgba(0,0,0,0.24), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflow: "hidden",
          maxHeight: "calc(100dvh - 2rem)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${borderColor}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: totalGoals > 0 ? 10 : 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 650,
                  letterSpacing: "-0.01em",
                  color: "var(--text)",
                }}
              >
                {t("allGoals")}
              </h2>
              {totalGoals > 0 && (() => {
                const isAllDone = doneGoals === totalGoals;
                return (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: isAllDone ? 700 : 600,
                      color: isAllDone ? "#34c759" : "var(--text-tertiary)",
                      background: isAllDone
                        ? dark
                          ? "rgba(52, 199, 89, 0.18)"
                          : "rgba(52, 199, 89, 0.12)"
                        : dark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.06)",
                      borderRadius: 8,
                      padding: "2px 7px",
                    }}
                  >
                    {doneGoals}/{totalGoals}
                  </span>
                );
              })()}
            </div>
            <button
              onClick={onClose}
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
          {totalGoals > 0 && (
            <div
              style={{
                height: 4,
                borderRadius: 999,
                overflow: "hidden",
                background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 999,
                  background: "#34c759",
                  width: `${(doneGoals / totalGoals) * 100}%`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div
          className="overflow-y-auto flex-1"
          style={{ overscrollBehavior: "contain" }}
        >
          <>
            {/* Year goals section — always visible */}
            <div style={{ padding: "10px 12px 4px" }}>
              <div
                style={{
                  borderRadius: 16,
                  border: `1.5px solid ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}`,
                  overflow: "hidden",
                  background: dark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🎯</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: "var(--text)",
                      flex: 1,
                    }}
                  >
                    {viewYear}
                  </span>
                  {activeYearGoals.length > 0 && (() => {
                    const doneY = activeYearGoals.filter((g) => g.done).length;
                    const totalY = activeYearGoals.length;
                    const isAllDone = doneY === totalY;
                    return (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: isAllDone ? 600 : 400,
                          color: isAllDone ? "#34c759" : "var(--text-tertiary)",
                          flexShrink: 0,
                        }}
                      >
                        {doneY}/{totalY}
                      </span>
                    );
                  })()}
                  {activeYearGoals.length > 0 && (
                    <div
                      style={{
                        width: 40,
                        height: 3,
                        borderRadius: 999,
                        overflow: "hidden",
                        background: dark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.08)",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 999,
                          background: "#34c759",
                          width: `${(activeYearGoals.filter((g) => g.done).length / activeYearGoals.length) * 100}%`,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  )}
                  <button
                    onClick={onEditYearGoals}
                    title={t("yearGoals")}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: "transparent",
                      border: "none",
                      color: "var(--text-secondary)",
                      opacity: 0.7,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity =
                        "1";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity =
                        "0.7";
                    }}
                  >
                    <GoalsIcon />
                  </button>
                </div>
                {yearGoals.description.trim() && (
                  <p
                    style={{
                      margin: "0 14px 8px",
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      borderLeft: `2px solid rgba(128,128,128,0.3)`,
                      paddingLeft: 8,
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {yearGoals.description}
                  </p>
                )}
                {activeYearGoals.length === 0 ? (
                  <div
                    onClick={onEditYearGoals}
                    role="button"
                    style={{
                      padding: "0 14px 12px",
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      fontStyle: "italic",
                      cursor: "pointer",
                    }}
                  >
                    {t("yearGoals")} →
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "4px 14px 10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    {activeYearGoals.map((goal) => {
                      const gc =
                        normaliseGrey(goal.color) ?? goal.color ?? "#34c759";
                      return (
                        <label
                          key={goal.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            cursor: "pointer",
                            padding: "3px 0",
                          }}
                          onClick={() => onToggleYearGoal(goal.id)}
                        >
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 4,
                              flexShrink: 0,
                              marginTop: 1,
                              background: goal.done ? gc : "transparent",
                              border: `1.5px solid ${goal.done ? gc : goal.color ? gc : "var(--border-soft)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 150ms ease",
                            }}
                          >
                            {goal.done && <CheckIcon />}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              lineHeight: "1.45",
                              color: goal.done
                                ? "var(--text-tertiary)"
                                : readableGoalTextColor(
                                    goal.color,
                                    dark,
                                    "var(--text)",
                                  ),
                              textDecoration: goal.done
                                ? "line-through"
                                : "none",
                              opacity: goal.done ? 0.55 : 1,
                              transition: "all 150ms",
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
                )}
              </div>
            </div>

            {config.quarters.map((qc, qi) => {
              // eslint-disable-line
              const qr = resolvedQuarters[qi]!;
              const qGoals = quarterGoals[qi]?.isDeleted
                ? []
                : (quarterGoals[qi]?.goals.filter(
                    (g) => !g.isDeleted && g.text.trim(),
                  ) ?? []);
              const blocksWithGoals = qc.blocks
                .map((b) => {
                  const bg = blockGoals[b.id];
                  const goals = bg?.isDeleted
                    ? []
                    : (bg?.goals.filter((g) => !g.isDeleted && g.text.trim()) ??
                      []);
                  return { block: b, goals };
                })
                .filter((x) => x.goals.length > 0);
              if (qGoals.length === 0 && blocksWithGoals.length === 0)
                return null;

              const qSprintDone = blocksWithGoals.reduce(
                (s, x) => s + x.goals.filter((g) => g.done).length,
                0,
              );
              const qSprintTotal = blocksWithGoals.reduce(
                (s, x) => s + x.goals.length,
                0,
              );
              const qQDone = qGoals.filter((g) => g.done).length;
              const qTotal = qQDone + qSprintDone;
              const qAllTotal = qGoals.length + qSprintTotal;

              return (
                <div key={qi} style={{ padding: "10px 12px 6px" }}>
                  {/* Quarter container card */}
                  <div
                    style={{
                      borderRadius: 16,
                      border: `1.5px solid ${qr.border}`,
                      overflow: "hidden",
                      background: "transparent",
                    }}
                  >
                    {/* Quarter card header */}
                    {(() => {
                      const qHeaderText = readableGoalTextColor(
                        qr.nameColor,
                        dark,
                        "var(--text)",
                      );
                      return (
                        <div
                          style={{
                            padding: "10px 14px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              letterSpacing: "-0.01em",
                              color: qHeaderText,
                              flex: 1,
                            }}
                          >
                            {qr.label ?? t(`q${qi + 1}` as keyof typeof t)}
                          </span>
                          {(() => {
                            const isQuarterAllDone = qAllTotal > 0 && qTotal === qAllTotal;
                            return (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: isQuarterAllDone ? 600 : 400,
                                  color: isQuarterAllDone ? "#34c759" : qHeaderText,
                                  opacity: isQuarterAllDone ? 1 : 0.6,
                                  flexShrink: 0,
                                }}
                              >
                                {qTotal}/{qAllTotal}
                              </span>
                            );
                          })()}
                          {qAllTotal > 0 && (
                            <div
                              style={{
                                width: 40,
                                height: 3,
                                borderRadius: 999,
                                overflow: "hidden",
                                background: dark
                                  ? "rgba(255,255,255,0.15)"
                                  : "rgba(0,0,0,0.1)",
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  borderRadius: 999,
                                  background: "#34c759",
                                  width: `${(qTotal / qAllTotal) * 100}%`,
                                  transition: "width 0.4s ease",
                                }}
                              />
                            </div>
                          )}
                          <button
                            onClick={() => onEditQuarterGoals(qi)}
                            title={t("quarterGoals")}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              background: "transparent",
                              border: "none",
                              color: qHeaderText,
                              opacity: 0.6,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.opacity = "1";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.opacity = "0.6";
                            }}
                          >
                            <GoalsIcon />
                          </button>
                        </div>
                      );
                    })()}

                    {/* Quarter goals checkboxes */}
                    {qGoals.length > 0 && (
                      <div
                        style={{
                          padding: "4px 14px 8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 3,
                        }}
                      >
                        {qGoals.map((goal) => {
                          const cb = goalCheckboxColors(
                            goal.color,
                            dark,
                            qr.fill,
                            qr.key,
                          );
                          return (
                            <label
                              key={goal.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                                cursor: "pointer",
                                padding: "3px 0",
                                borderRadius: 6,
                              }}
                              onClick={() => onToggleQuarterGoal(qi, goal.id)}
                            >
                              <div
                                style={{
                                  boxSizing: "border-box",
                                  width: 14,
                                  height: 14,
                                  borderRadius: 4,
                                  flexShrink: 0,
                                  marginTop: 1,
                                  background: goal.done
                                    ? cb.doneBg
                                    : cb.emptyBg,
                                  border: `1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all 150ms ease",
                                }}
                              >
                                {goal.done && <CheckIcon color={cb.icon} />}
                              </div>
                              <span
                                style={{
                                  fontSize: 12,
                                  lineHeight: "1.45",
                                  color: goal.done
                                    ? `${qr.text}66`
                                    : readableGoalTextColor(
                                        goal.color,
                                        dark,
                                        qr.text,
                                      ),
                                  textDecoration: goal.done
                                    ? "line-through"
                                    : "none",
                                  opacity: goal.done ? 0.6 : 1,
                                  transition: "all 150ms",
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
                    )}

                    {/* Sprint blocks nested inside */}
                    {blocksWithGoals.length > 0 && (
                      <div
                        style={{
                          padding: "0 8px 8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                        }}
                      >
                        {blocksWithGoals.map(({ block, goals }) => {
                          const effectiveQ = block.color
                            ? resolveQuarter(
                                { name: block.label, colorKey: block.color },
                                dark,
                              )
                            : qr;
                          const sprintHeaderText = readableGoalTextColor(
                            effectiveQ.nameColor,
                            dark,
                            "var(--text)",
                          );
                          return (
                            <div
                              key={block.id}
                              style={{
                                borderRadius: 11,
                                border: `1.5px solid ${effectiveQ.border}`,
                                overflow: "hidden",
                                background: "transparent",
                              }}
                            >
                              <div
                                style={{
                                  padding: "6px 10px 5px",
                                  background: "transparent",
                                  borderBottom: `1px solid ${effectiveQ.border}55`,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: sprintHeaderText,
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {block.label}
                                </span>
                                {(() => {
                                  const doneSprintCount = goals.filter((g) => g.done).length;
                                  const totalSprintCount = goals.length;
                                  const isSprintAllDone = totalSprintCount > 0 && doneSprintCount === totalSprintCount;
                                  return (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: isSprintAllDone ? 600 : 400,
                                        color: isSprintAllDone ? "#34c759" : sprintHeaderText,
                                        opacity: isSprintAllDone ? 1 : 0.6,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {doneSprintCount}/{totalSprintCount}
                                    </span>
                                  );
                                })()}
                                <div
                                  style={{
                                    width: 36,
                                    height: 3,
                                    borderRadius: 999,
                                    overflow: "hidden",
                                    background: dark
                                      ? "rgba(255,255,255,0.15)"
                                      : "rgba(0,0,0,0.1)",
                                    flexShrink: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      borderRadius: 999,
                                      background: "#34c759",
                                      width: `${goals.length > 0 ? (goals.filter((g) => g.done).length / goals.length) * 100 : 0}%`,
                                      transition: "width 0.4s ease",
                                    }}
                                  />
                                </div>
                                <button
                                  onClick={() => onEditGoals(block.id)}
                                  title={t("sprintGoals")}
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 5,
                                    background: "transparent",
                                    border: "none",
                                    color: sprintHeaderText,
                                    opacity: 0.6,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => {
                                    (
                                      e.currentTarget as HTMLButtonElement
                                    ).style.opacity = "1";
                                  }}
                                  onMouseLeave={(e) => {
                                    (
                                      e.currentTarget as HTMLButtonElement
                                    ).style.opacity = "0.6";
                                  }}
                                >
                                  <GoalsIcon />
                                </button>
                              </div>
                              <div
                                style={{
                                  padding: "5px 8px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                }}
                              >
                                {goals.map((goal) => {
                                  const cb = goalCheckboxColors(
                                    goal.color,
                                    dark,
                                    effectiveQ.fill,
                                    effectiveQ.key,
                                  );
                                  return (
                                    <label
                                      key={goal.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 8,
                                        cursor: "pointer",
                                        padding: "3px 2px",
                                        borderRadius: 5,
                                      }}
                                      onClick={() =>
                                        onToggleGoal(block.id, goal.id)
                                      }
                                    >
                                      <div
                                        style={{
                                          boxSizing: "border-box",
                                          width: 13,
                                          height: 13,
                                          borderRadius: 3,
                                          flexShrink: 0,
                                          marginTop: 1,
                                          background: goal.done
                                            ? cb.doneBg
                                            : cb.emptyBg,
                                          border: `1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          transition: "all 150ms ease",
                                        }}
                                      >
                                        {goal.done && (
                                          <CheckIcon color={cb.icon} />
                                        )}
                                      </div>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          lineHeight: "1.45",
                                          color: goal.done
                                            ? "var(--text-tertiary)"
                                            : readableGoalTextColor(
                                                goal.color,
                                                dark,
                                                "var(--text-secondary)",
                                              ),
                                          textDecoration: goal.done
                                            ? "line-through"
                                            : "none",
                                          opacity: goal.done ? 0.55 : 1,
                                          transition: "all 150ms",
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ height: 6 }} />
          </>
          <div style={{ height: 12 }} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// ─── NotesPanel ───────────────────────────────────────────────────────────────