import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LifeSettings, LifeView } from "../../types/calendar";
import { startOfDay, startOfYear, addDays, sameDay, daysBetween, monthsBetween, addYears, dayOfYear } from "../../utils/date-utils";
import { LIFE_ACCENT } from "../../constants/colors";
import { LangContext } from "../../constants/i18n";
import { pluralUnits, pluralCount } from "../../utils/plural";
import { LifeGridCanvas } from "../calendar/LifeGridCanvas";
import { LifeIcon } from "../icons/Icons";

export function LifeCalendarModal({
  dark,
  modalBg,
  settings,
  onSettingsChange,
  onClose,
}: {
  key?: string;
  dark: boolean;
  modalBg: string;
  settings: LifeSettings;
  onSettingsChange: (s: LifeSettings) => void;
  onClose: () => void;
}) {
  const { t, lang } = React.useContext(LangContext);
  const [view, setView] = useState<LifeView>("years");
  const [lifespanDraft, setLifespanDraft] = useState(String(settings.lifespan));

  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(startOfDay(new Date())),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 400,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const birthDate = useMemo(() => {
    if (!settings.birthDate) return null;
    return startOfDay(new Date(settings.birthDate + "T00:00:00"));
  }, [settings.birthDate]);

  const ageDays = useMemo(
    () => (birthDate ? Math.max(0, daysBetween(birthDate, today)) : 0),
    [birthDate, today],
  );

  const lifespanEnd = useMemo(
    () => (birthDate ? addYears(birthDate, settings.lifespan) : null),
    [birthDate, settings.lifespan],
  );

  const lifespanDays =
    lifespanEnd && birthDate
      ? Math.max(1, daysBetween(birthDate, lifespanEnd))
      : settings.lifespan * 365.25;

  const pct = Math.min(100, (ageDays / lifespanDays) * 100);

  const ageMonthsTotal = useMemo(
    () => (birthDate ? monthsBetween(birthDate, today) : 0),
    [birthDate, today],
  );

  const lifespanMonths = settings.lifespan * 12;
  const ageYears = Math.floor(ageMonthsTotal / 12);
  const ageMonths = ageMonthsTotal % 12;

  const { remYears, remMonths, remWeeks, remDays } = useMemo(() => {
    if (!lifespanEnd || lifespanEnd <= today)
      return { remYears: 0, remMonths: 0, remWeeks: 0, remDays: 0 };
    const totalMonths = monthsBetween(today, lifespanEnd);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const anchor = new Date(today.getTime());
    anchor.setMonth(anchor.getMonth() + totalMonths);
    const leftover = Math.max(
      0,
      Math.round((lifespanEnd.getTime() - anchor.getTime()) / 86_400_000),
    );
    return {
      remYears: years,
      remMonths: months,
      remWeeks: Math.floor(leftover / 7),
      remDays: leftover % 7,
    };
  }, [lifespanEnd, today]);

  const { remHours, remMinutes, remSeconds } = useMemo(() => {
    if (!lifespanEnd || lifespanEnd <= now)
      return { remHours: 0, remMinutes: 0, remSeconds: 0 };
    const totalSecs = Math.floor(
      (lifespanEnd.getTime() - now.getTime()) / 1000,
    );
    return {
      remHours: Math.floor(totalSecs / 3600) % 24,
      remMinutes: Math.floor(totalSecs / 60) % 60,
      remSeconds: totalSecs % 60,
    };
  }, [lifespanEnd, now]);

  // ── Dynamic Whole-Life Screen-Fit Calculation ───────────────────────────
  const layout = useMemo(() => {
    const ls = settings.lifespan;
    const isMobile = viewportSize.width < 640;
    const modalW = Math.min(viewportSize.width * 0.96, isMobile ? 520 : 640);
    const modalMaxH = Math.min(viewportSize.height * 0.94, viewportSize.height - 24);

    // Approximate height occupied by static elements (Header + inputs + compact stats + tabs + legend)
    const fixedContentH = isMobile ? 275 : 295;
    const availH = Math.max(120, modalMaxH - fixedContentH);

    let cols = 10;
    let rows = ls + 1;
    let gapPx = 1;
    let showYearLabels = false;
    let labelW = 0;
    let totalUnits = ls + 1;
    let currentCell = 0;
    let displayCurr = 0;
    let displayTotal = 0;

    switch (view) {
      case "years": {
        cols = isMobile ? 10 : 10;
        totalUnits = ls + 1;
        rows = Math.ceil(totalUnits / cols);
        gapPx = isMobile ? 2.5 : 4;
        showYearLabels = false;
        labelW = 0;
        currentCell = birthDate ? Math.max(0, today.getFullYear() - birthDate.getFullYear()) : 0;
        displayCurr = ageYears;
        displayTotal = ls;
        break;
      }
      case "months": {
        cols = 12;
        totalUnits = (ls + 1) * 12;
        rows = ls + 1;
        gapPx = 1;
        showYearLabels = true;
        labelW = isMobile ? 36 : 40;
        currentCell = birthDate
          ? Math.max(0, (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth())
          : 0;
        displayCurr = ageMonthsTotal;
        displayTotal = ls * 12;
        break;
      }
      case "weeks": {
        cols = 52;
        totalUnits = (ls + 1) * 52;
        rows = ls + 1;
        gapPx = 1;
        showYearLabels = true;
        labelW = isMobile ? 36 : 40;
        currentCell = birthDate
          ? Math.max(0, Math.floor(daysBetween(startOfYear(birthDate.getFullYear()), today) / 7))
          : 0;
        displayCurr = Math.floor(ageDays / 7);
        displayTotal = Math.floor(lifespanDays / 7);
        break;
      }
      case "days": {
        totalUnits = Math.max(1, Math.round(lifespanDays));
        displayCurr = ageDays;
        displayTotal = Math.round(lifespanDays);
        currentCell = Math.max(0, Math.min(ageDays, totalUnits - 1));
        gapPx = 1;
        showYearLabels = false;
        labelW = 0;
        break;
      }
    }

    currentCell = Math.max(0, Math.min(currentCell, totalUnits - 1));
    displayCurr = Math.max(0, Math.min(displayCurr, displayTotal));

    const padRight = (view === "months" || view === "weeks") ? 12 : 4;
    const availW = Math.max(80, modalW - (isMobile ? 28 : 48) - labelW - padRight);

    let cellPx = 4;

    if (view === "years") {
      const fromW = (availW - gapPx * (cols - 1)) / cols;
      const fromH = (availH - gapPx * (rows - 1)) / rows;
      cellPx = Math.max(14, Math.floor(Math.min(fromW, fromH)));
    } else if (view === "months") {
      const padY = 28;
      const effectiveAvailH = Math.max(80, availH - padY);
      const fromW = (availW - gapPx * (cols - 1)) / cols;
      const fromH = (effectiveAvailH - gapPx * (rows - 1)) / rows;
      // In months, fit height so the whole life fits vertically on one screen
      cellPx = Math.max(2.6, Math.min(fromW, fromH));
      cellPx = Math.floor(cellPx * 10) / 10;
    } else if (view === "weeks") {
      const padY = 26;
      const effectiveAvailH = Math.max(80, availH - padY);
      const fromW = (availW - gapPx * (cols - 1)) / cols;
      const fromH = (effectiveAvailH - gapPx * (rows - 1)) / rows;
      // In weeks, fit both width (52 cols) and height (80+ rows)
      cellPx = Math.max(2.2, Math.min(fromW, fromH));
      cellPx = Math.floor(cellPx * 10) / 10;
    } else {
      // Days: compute optimal matrix to fit all ~30,000 days into availW x availH without scroll
      let bestCell = 1;
      for (const candidate of [3, 2.5, 2, 1.5, 1]) {
        const pitch = candidate + gapPx;
        const maxC = Math.floor(availW / pitch);
        const maxR = Math.floor(availH / pitch);
        if (maxC * maxR >= totalUnits) {
          bestCell = candidate;
          break;
        }
      }
      cellPx = bestCell;
      const pitch = cellPx + gapPx;
      const maxCols = Math.max(1, Math.floor(availW / pitch));
      const maxRows = Math.max(1, Math.floor(availH / pitch));
      const idealCols = Math.ceil(Math.sqrt((totalUnits * availW) / availH));
      const minCols = Math.ceil(totalUnits / maxRows);
      cols = Math.max(1, Math.min(maxCols, Math.max(idealCols, minCols)));
      rows = Math.ceil(totalUnits / cols);
    }

    return {
      cols,
      rows,
      cellPx,
      gapPx,
      labelW,
      showYearLabels,
      totalUnits,
      currentCell,
      displayCurr,
      displayTotal,
      modalW,
      availH,
    };
  }, [
    view,
    settings.lifespan,
    birthDate,
    today,
    ageYears,
    ageMonthsTotal,
    ageDays,
    lifespanDays,
    viewportSize.width,
    viewportSize.height,
  ]);

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)";
  const inputStyle: React.CSSProperties = {
    background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: "6px 9px",
    fontSize: 12,
    color: "var(--text)",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const viewLabels: Record<LifeView, string> = {
    years: t("years"),
    months: t("months"),
    weeks: t("weeks"),
    days: t("days"),
  };

  return (
    <motion.div
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{ overflow: "hidden" }}
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
          background: "rgba(0,0,0,0.40)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          pointerEvents: "none",
        }}
      />
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(96vw, ${layout.modalW}px)`,
          maxHeight: "min(96dvh, calc(100svh - 1rem))",
          borderRadius: 22,
          background: modalBg,
          backdropFilter: "saturate(180%) blur(28px)",
          WebkitBackdropFilter: "saturate(180%) blur(28px)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.28), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease-in-out, max-height 0.25s ease-in-out",
        }}
      >
        {/* Fixed Header */}
        <div className="px-4 sm:px-6 pt-4 pb-2.5 flex items-center justify-between shrink-0">
          <div>
            <h2
              className="text-[16px] sm:text-[17px] font-semibold"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              {t("lifeCalendarBtn")}
            </h2>
          </div>
          <button
            type="button"
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
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Container (Fit-to-Screen default, with fallback scroll for tiny viewports) */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 flex flex-col pt-0 pb-3">
          {/* Settings row */}
          <div className="px-4 sm:px-6 pb-2.5 shrink-0">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                alignItems: "end",
              }}
            >
              <div className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
                <label
                  className="text-[9px] sm:text-[10px] font-medium tracking-wide uppercase"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {t("dateOfBirth")}
                </label>
                <input
                  type="date"
                  value={settings.birthDate}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, birthDate: e.target.value })
                  }
                  lang={lang}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    boxSizing: "border-box",
                    WebkitAppearance: "none",
                    appearance: "none",
                  }}
                />
              </div>
              <div className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
                <label
                  className="text-[9px] sm:text-[10px] font-medium tracking-wide uppercase"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {t("lifeExpectancy")}, {t("yr")}
                </label>
                <input
                  type="number"
                  value={lifespanDraft}
                  min={20}
                  max={120}
                  onChange={(e) => {
                    setLifespanDraft(e.target.value);
                    const n = Number(e.target.value);
                    if (n >= 20 && n <= 120)
                      onSettingsChange({ ...settings, lifespan: n });
                  }}
                  onBlur={() => {
                    const v = Math.max(
                      20,
                      Math.min(120, Number(lifespanDraft) || 80),
                    );
                    setLifespanDraft(String(v));
                    onSettingsChange({ ...settings, lifespan: v });
                  }}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    boxSizing: "border-box",
                    textAlign: "center",
                  }}
                />
              </div>
            </div>
          </div>

          {birthDate ? (
            <>
              {/* Compact Stats Card */}
              <div className="px-4 sm:px-6 pb-2 shrink-0">
                <div
                  className="rounded-xl px-3.5 py-2"
                  style={{
                    background: `${LIFE_ACCENT}12`,
                    border: `1px solid ${LIFE_ACCENT}28`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[12px] sm:text-[13px] font-semibold"
                      style={{ color: LIFE_ACCENT }}
                    >
                      {t("age")}: {ageYears} {t("yr")}
                      {ageMonths > 0 ? ` ${ageMonths} ${t("mo")}` : ""}
                    </span>
                    <span
                      className="text-[12px] sm:text-[13px] font-semibold tabular-nums"
                      style={{ color: LIFE_ACCENT }}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{
                      background: dark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.08)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: LIFE_ACCENT,
                        borderRadius: 999,
                        transition: "width 700ms ease",
                      }}
                    />
                  </div>
                  {(remYears > 0 ||
                    remMonths > 0 ||
                    remWeeks > 0 ||
                    remDays > 0 ||
                    remHours > 0 ||
                    remMinutes > 0 ||
                    remSeconds > 0) && (
                    <div
                      className="mt-1 text-[10.5px] tabular-nums leading-tight flex items-center justify-between"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <span>{t("remainingLabel")}</span>
                      <span style={{ color: LIFE_ACCENT, fontWeight: 600 }}>
                        {remYears > 0 && (
                          <>
                            {pluralCount(
                              remYears,
                              lang,
                              t,
                              "year1",
                              "year2",
                              "year5",
                            )}{" "}
                          </>
                        )}
                        {remMonths > 0 && (
                          <>
                            {pluralCount(
                              remMonths,
                              lang,
                              t,
                              "month1",
                              "month2",
                              "month5",
                            )}{" "}
                          </>
                        )}
                        {remWeeks > 0 && (
                          <>
                            {pluralCount(
                              remWeeks,
                              lang,
                              t,
                              "week",
                              "week2",
                              "week5",
                            )}{" "}
                          </>
                        )}
                        {remDays > 0 && (
                          <>
                            {pluralCount(
                              remDays,
                              lang,
                              t,
                              "day1",
                              "day2",
                              "day5",
                            )}{" "}
                          </>
                        )}
                        <span>
                          {remSeconds} {t("sec")}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* View Switcher */}
              <div className="px-4 sm:px-6 pb-2 shrink-0">
                <div
                  className="flex gap-1 p-0.5 rounded-lg"
                  style={{
                    background: dark
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(0,0,0,0.05)",
                  }}
                >
                  {(["years", "months", "weeks", "days"] as LifeView[]).map(
                    (v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className="flex-1 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-[12px] transition-all"
                        style={{
                          background:
                            view === v
                              ? dark
                                ? "rgba(255,255,255,0.13)"
                                : "rgba(255,255,255,0.9)"
                              : "transparent",
                          color:
                            view === v ? "var(--text)" : "var(--text-secondary)",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          boxShadow:
                            view === v ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                          fontWeight: view === v ? 600 : 400,
                        }}
                      >
                        {viewLabels[v]}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Grid Legend and Count */}
              <div className="px-4 sm:px-6 pb-1.5 flex items-center justify-between shrink-0">
                <div
                  className="text-[10px] tabular-nums"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {layout.displayCurr.toLocaleString()} {t("of")}{" "}
                  {layout.displayTotal.toLocaleString()}{" "}
                  {pluralUnits(layout.displayTotal, view, lang, t)} {t("elapsed")}
                </div>
                {(() => {
                  const rem = Math.max(0, layout.displayTotal - layout.displayCurr);
                  return rem > 0 ? (
                    <span
                      className="text-[10px] tabular-nums"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {rem.toLocaleString()} {pluralUnits(rem, view, lang, t)}{" "}
                      {t("remaining")}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Canvas / HTML Grid Container */}
              <div
                className="px-2 sm:px-4 flex flex-col items-center justify-start sm:justify-center min-h-0 py-2"
                style={{
                  flex: "1 1 auto",
                  width: "100%",
                }}
              >
                {view === "years" ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${layout.cols}, ${layout.cellPx}px)`,
                      gap: `${layout.gapPx}px`,
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    {Array.from({ length: layout.totalUnits }, (_, i) => {
                      const isPast = i < layout.currentCell;
                      const isCurrent = i === layout.currentCell;
                      const radius = Math.max(0, Math.floor(layout.cellPx / 5));
                      const showBorder = layout.cellPx >= 3;
                      const showYearLabel =
                        layout.cellPx >= 16 && birthDate !== null;
                      const yearLabel = showYearLabel
                        ? birthDate!.getFullYear() + i
                        : null;
                      const yearFontSize = Math.max(
                        7,
                        Math.min(11, Math.floor(layout.cellPx * 0.24)),
                      );
                      return (
                        <div
                          key={i}
                          style={{
                            width: layout.cellPx,
                            height: layout.cellPx,
                            borderRadius: radius,
                            flexShrink: 0,
                            background: isPast
                              ? LIFE_ACCENT
                              : isCurrent
                                ? `${LIFE_ACCENT}66`
                                : dark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.07)",
                            border: showBorder
                              ? isCurrent
                                ? `${Math.max(1, Math.round(layout.cellPx / 6))}px solid ${LIFE_ACCENT}`
                                : "none"
                              : "none",
                            boxShadow:
                              layout.cellPx >= 5 && isCurrent
                                ? `0 0 0 2px ${LIFE_ACCENT}44`
                                : "none",
                            display: showYearLabel ? "flex" : undefined,
                            alignItems: showYearLabel ? "center" : undefined,
                            justifyContent: showYearLabel ? "center" : undefined,
                            overflow: showYearLabel ? "hidden" : undefined,
                          }}
                        >
                          {showYearLabel && (
                            <span
                              style={{
                                fontSize: yearFontSize,
                                lineHeight: 1,
                                fontVariantNumeric: "tabular-nums",
                                color: isPast
                                  ? "rgba(255,255,255,0.85)"
                                  : isCurrent
                                    ? "#fff"
                                    : dark
                                      ? "rgba(255,255,255,0.4)"
                                      : "rgba(0,0,0,0.35)",
                                userSelect: "none",
                                pointerEvents: "none",
                              }}
                            >
                              {yearLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <LifeGridCanvas
                    totalUnits={layout.totalUnits}
                    currentCell={layout.currentCell}
                    cellPx={layout.cellPx}
                    gapPx={layout.gapPx}
                    numCols={layout.cols}
                    dark={dark}
                    birthYear={birthDate ? birthDate.getFullYear() : null}
                    showYearLabels={layout.showYearLabels}
                    labelWidth={layout.labelW}
                    viewType={view}
                  />
                )}
              </div>
            </>
          ) : (
            <div
              className="px-6 pb-12 flex flex-col items-center justify-center text-center"
              style={{ flex: 1, minHeight: 200 }}
            >
              <div className="text-4xl mb-3">🗓️</div>
              <div
                className="text-[15px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                {t("enterBirthDate")}
              </div>
              <div
                className="mt-1 text-[13px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t("birthDateSubtitle")}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}


// ─── DayTemplatesModal ────────────────────────────────────────────────────────