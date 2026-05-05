import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";

import {
  MONTHS, WEEKDAYS, QUARTERS, WEEKS_PER_QUARTER, TOTAL_WEEKS, makeId,
  type Block, type QuarterConfig, type CalendarConfig, type DayState, type Notes,
  type Milestone, type DayNote, type Goal,
} from "./types";
import {
  startOfDay, startOfYear, startOfNextYear, startOfWeekMonday, addDays, sameDay, dateKey,
  loadConfig, saveConfig, loadNotes, saveNotes, loadMilestones, saveMilestones,
  loadDarkMode, saveDarkMode, defaultConfig,
} from "./storage";
import { NoteModal } from "./NoteModal";
import { MilestoneCountdown, MilestoneModal } from "./MilestonePanel";
import { StatsPanel } from "./StatsPanel";
import { LifetimeView } from "./LifetimeView";

// ── Today line ────────────────────────────────────────────────────────────────
function TodayLine({ pct }: { pct: number }) {
  return (
    <div
      aria-hidden
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ top: `${pct}%`, transform: "translateY(-50%)", height: 2, transition: "top 1s ease-out" }}
    >
      <div style={{
        height: "100%", width: "100%", borderRadius: 999,
        background: "linear-gradient(90deg, rgba(52,199,89,0) 0%, rgba(94,212,123,0.95) 12%, #34c759 50%, rgba(94,212,123,0.95) 88%, rgba(52,199,89,0) 100%)",
        boxShadow: "0 0 4px rgba(52,199,89,0.95), 0 0 12px rgba(52,199,89,0.65), 0 0 24px rgba(52,199,89,0.3)",
      }} />
      <div style={{
        position: "absolute", right: 0, top: "50%",
        width: 8, height: 8, marginTop: -4, borderRadius: 999,
        background: "#34c759",
        boxShadow: "0 0 6px rgba(52,199,89,1), 0 0 14px rgba(52,199,89,0.8)",
      }} />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const realYear = now.getFullYear();
  const [viewYear, setViewYear] = useState(realYear);

  // ── Preferences ─────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => loadDarkMode());
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    saveDarkMode(darkMode);
  }, [darkMode]);

  const [view, setView] = useState<"year" | "lifetime">("year");
  const [showStats, setShowStats] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // ── Config ───────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<CalendarConfig>(() => loadConfig(realYear));
  useEffect(() => { setConfig(loadConfig(viewYear)); }, [viewYear]);
  useEffect(() => { saveConfig(viewYear, config); }, [viewYear, config]);

  // ── Notes ────────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Notes>(() => loadNotes(realYear));
  useEffect(() => { setNotes(loadNotes(viewYear)); }, [viewYear]);
  useEffect(() => { saveNotes(viewYear, notes); }, [viewYear, notes]);

  // ── Milestones ───────────────────────────────────────────────────────────────
  const [milestones, setMilestones] = useState<Milestone[]>(() => loadMilestones());
  useEffect(() => { saveMilestones(milestones); }, [milestones]);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [settingsQuarter, setSettingsQuarter] = useState<number | null>(null);
  const [noteDay, setNoteDay] = useState<Date | null>(null);
  const [showMilestones, setShowMilestones] = useState(false);

  // ── Calendar math ─────────────────────────────────────────────────────────────
  const weeks = useMemo(() => {
    const firstMonday = startOfWeekMonday(startOfYear(viewYear));
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const weekStart = addDays(firstMonday, i * 7);
      const days = Array.from({ length: 7 }, (_, j) => addDays(weekStart, j));
      return { weekStart, days };
    });
  }, [viewYear]);

  const yearProgress = useMemo(() => {
    const start = startOfYear(viewYear).getTime();
    const end = startOfNextYear(viewYear).getTime();
    return Math.max(0, Math.min(100, ((now.getTime() - start) / (end - start)) * 100));
  }, [now, viewYear]);

  const todayProgress = useMemo(() => {
    const start = startOfDay(now).getTime();
    return Math.max(0, Math.min(100, ((now.getTime() - start) / 86_400_000) * 100));
  }, [now]);

  const today = startOfDay(now);
  const isCurrentYear = viewYear === realYear;

  const currentWeekIndex = useMemo(() => {
    if (!isCurrentYear) return -1;
    return weeks.findIndex(({ days }) => days.some((d) => sameDay(d, today)));
  }, [weeks, today, isCurrentYear]);

  const weekProgress = useMemo(() => {
    if (currentWeekIndex < 0) return 0;
    const w = weeks[currentWeekIndex]!;
    const start = w.weekStart.getTime();
    return Math.max(0, Math.min(100, ((now.getTime() - start) / (7 * 86_400_000)) * 100));
  }, [weeks, currentWeekIndex, now]);

  const currentQuarterIndex = currentWeekIndex >= 0 ? Math.floor(currentWeekIndex / WEEKS_PER_QUARTER) : -1;

  const daysCompleted = useMemo(() => {
    let n = 0;
    for (const { days } of weeks) for (const d of days) if (d.getFullYear() === viewYear && d < today) n++;
    return n;
  }, [weeks, today, viewYear]);

  const totalDays = Math.round((startOfNextYear(viewYear).getTime() - startOfYear(viewYear).getTime()) / 86_400_000);

  const dayState = useCallback((d: Date): DayState => {
    if (d.getFullYear() !== viewYear) return "out";
    if (!isCurrentYear) return d < startOfYear(realYear) ? "past" : d.getFullYear() < realYear ? "past" : "future";
    if (sameDay(d, today)) return "today";
    if (d < today) return "past";
    return "future";
  }, [viewYear, isCurrentYear, today, realYear]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  const weekRefs = useRef<Array<HTMLDivElement | null>>([]);
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (didScrollRef.current || currentWeekIndex < 0) return;
    const raf = requestAnimationFrame(() => {
      const el = weekRefs.current[currentWeekIndex];
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); didScrollRef.current = true; }
    });
    return () => cancelAnimationFrame(raf);
  }, [currentWeekIndex, weeks]);
  useEffect(() => { didScrollRef.current = false; }, [viewYear]);

  // ── Config mutations ──────────────────────────────────────────────────────────
  const updateQuarter = (qi: number, next: QuarterConfig) => {
    setConfig((prev) => { const q = prev.quarters.slice(); q[qi] = next; return { quarters: q }; });
  };
  const updateBlockLabel = (qi: number, blockId: string, label: string) => {
    setConfig((prev) => {
      const q = prev.quarters.slice();
      q[qi] = { blocks: q[qi]!.blocks.map((b) => (b.id === blockId ? { ...b, label } : b)) };
      return { quarters: q };
    });
  };

  // ── Notes mutations ───────────────────────────────────────────────────────────
  const saveNote = (d: Date, note: DayNote) => {
    setNotes((prev) => ({ ...prev, [dateKey(d)]: note }));
  };
  const deleteNote = (d: Date) => {
    setNotes((prev) => { const next = { ...prev }; delete next[dateKey(d)]; return next; });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-20" style={{
        background: "var(--header-bg)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid var(--border-soft)",
      }}>
        <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-5 pb-4">
          {/* Row 1: year + controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setViewYear((y) => y - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: "var(--border-soft)", color: "var(--text-secondary)" }} aria-label="Previous year">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums" style={{ color: "var(--text)", letterSpacing: "-0.03em", minWidth: 68, textAlign: "center" }}>
                {viewYear}
              </h1>
              <button onClick={() => setViewYear((y) => y + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: "var(--border-soft)", color: "var(--text-secondary)" }} aria-label="Next year">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              {viewYear !== realYear && (
                <button onClick={() => setViewYear(realYear)} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(52,199,89,0.12)", color: "var(--apple-green)", border: "1px solid rgba(52,199,89,0.25)" }}>Today</button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Stats toggle */}
              <IconBtn active={showStats} onClick={() => setShowStats((v) => !v)} title="Stats" activeColor="#34c759">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
              </IconBtn>
              {/* Focus mode */}
              <IconBtn active={focusMode} onClick={() => setFocusMode((v) => !v)} title="Focus mode" activeColor="#ff9500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h1M20 12h1M12 3v1M12 20v1M5.6 5.6l.7.7M17.7 17.7l.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7"/></svg>
              </IconBtn>
              {/* Lifetime view */}
              <IconBtn active={view === "lifetime"} onClick={() => setView((v) => v === "year" ? "lifetime" : "year")} title="Lifetime view" activeColor="#0a84ff">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="7" height="7" rx="1"/><rect x="9" y="3" width="7" height="7" rx="1"/><rect x="16" y="3" width="7" height="7" rx="1"/><rect x="2" y="10" width="7" height="7" rx="1"/><rect x="9" y="10" width="7" height="7" rx="1"/><rect x="16" y="10" width="7" height="7" rx="1"/><rect x="2" y="17" width="7" height="7" rx="1"/><rect x="9" y="17" width="7" height="7" rx="1"/><rect x="16" y="17" width="7" height="7" rx="1"/></svg>
              </IconBtn>
              {/* Milestones */}
              <IconBtn active={showMilestones} onClick={() => setShowMilestones(true)} title="Milestones" activeColor="#af52de">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              </IconBtn>
              {/* Dark mode */}
              <IconBtn active={darkMode} onClick={() => setDarkMode((v) => !v)} title="Dark mode" activeColor="#636366">
                {darkMode
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                }
              </IconBtn>
            </div>
          </div>

          {/* Progress bar */}
          {isCurrentYear && (
            <>
              <div className="mt-3 h-1.5 w-full overflow-hidden" style={{ background: "var(--border-soft)", borderRadius: 999 }}>
                <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${yearProgress}%`, background: "linear-gradient(90deg, #5ed47b 0%, #34c759 55%, #28a745 100%)", borderRadius: 999 }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                <span>{daysCompleted} of {totalDays} days</span>
                <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{yearProgress.toFixed(1)}% complete</span>
                <span>{totalDays - daysCompleted} remaining</span>
              </div>
            </>
          )}

          {/* Stats panel */}
          <AnimatePresence initial={false}>
            {showStats && (
              <motion.div key="stats" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
                <StatsPanel year={viewYear} now={now} weeks={weeks} notes={notes} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Milestone countdown */}
          {isCurrentYear && milestones.length > 0 && (
            <MilestoneCountdown milestones={milestones} today={today} onOpen={() => setShowMilestones(true)} />
          )}
        </div>
      </header>

      {/* ── Content ── */}
      {view === "lifetime" ? (
        <LifetimeView
          currentYear={realYear}
          selectedYear={viewYear}
          onSelectYear={(y) => { setViewYear(y); setView("year"); }}
        />
      ) : (
        <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8">
          {/* Weekday header */}
          <div className="mb-4 flex items-center gap-3 sm:gap-4 px-1">
            <div className="w-14 sm:w-16 shrink-0" />
            <div className="grid grid-cols-7 gap-2 sm:gap-3 flex-1" style={{ color: "var(--text-tertiary)" }}>
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="text-center text-[10px] font-medium tracking-widest uppercase">{w}</div>
              ))}
            </div>
          </div>

          <LayoutGroup>
            <div className="flex flex-col gap-6">
              {[0, 1, 2, 3].map((qi) => {
                const quarter = QUARTERS[qi]!;
                const startIndex = qi * WEEKS_PER_QUARTER;
                const qConfig = config.quarters[qi]!;
                const isCollapsed = focusMode && currentQuarterIndex !== -1 && qi !== currentQuarterIndex;

                if (isCollapsed) {
                  const qDone = weeks.slice(startIndex, startIndex + WEEKS_PER_QUARTER).flatMap(w => w.days).filter(d => dayState(d) === "past").length;
                  const qPct = Math.round(qDone / (WEEKS_PER_QUARTER * 7) * 100);
                  return (
                    <motion.div key={qi} layout
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                      style={{ background: quarter.tint, borderRadius: 14, borderLeft: `3px solid ${quarter.border}` }}
                      onClick={() => setFocusMode(false)}
                    >
                      <span className="text-[11px] font-bold tracking-widest" style={{ color: quarter.text }}>{quarter.label}</span>
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                        <div style={{ width: `${qPct}%`, height: "100%", background: quarter.border, borderRadius: 999 }} />
                      </div>
                      <span className="text-[10px] tabular-nums" style={{ color: quarter.text }}>{qPct}%</span>
                    </motion.div>
                  );
                }

                return (
                  <motion.section layout key={qi} className="overflow-hidden"
                    style={{ background: quarter.tint, borderRadius: 18, borderLeft: `3px solid ${quarter.border}` }}
                  >
                    <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2">
                      <div className="flex items-baseline gap-3">
                        <div className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: quarter.text }}>{quarter.label}</div>
                        <div className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>Weeks {startIndex + 1}–{startIndex + WEEKS_PER_QUARTER}</div>
                      </div>
                      <button type="button" onClick={() => setSettingsQuarter(qi)}
                        className="flex items-center justify-center"
                        style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(0,0,0,0.06)", color: quarter.text }}
                        aria-label={`Configure ${quarter.label} sprints`}
                      >
                        <GearIcon />
                      </button>
                    </div>

                    <div className="px-3 sm:px-4 pb-4 pt-1 flex flex-col gap-2">
                      <BlocksRenderer
                        quarter={quarter}
                        qConfig={qConfig}
                        startIndex={startIndex}
                        weeks={weeks}
                        currentWeekIndex={currentWeekIndex}
                        weekProgress={weekProgress}
                        todayProgress={todayProgress}
                        dayState={dayState}
                        notes={notes}
                        weekRefs={weekRefs}
                        onLabelChange={(blockId, label) => updateBlockLabel(qi, blockId, label)}
                        onTileClick={(d) => setNoteDay(d)}
                      />
                    </div>
                  </motion.section>
                );
              })}
            </div>
          </LayoutGroup>

          <footer className="mt-12 pb-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
            Life Calendar · {viewYear}
          </footer>
        </main>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {settingsQuarter !== null && (
          <SprintSettingsModal
            key="sprint"
            quarterIndex={settingsQuarter}
            quarter={QUARTERS[settingsQuarter]!}
            initial={config.quarters[settingsQuarter]!}
            onClose={() => setSettingsQuarter(null)}
            onSave={(next) => { updateQuarter(settingsQuarter, next); setSettingsQuarter(null); }}
          />
        )}
        {noteDay !== null && (
          <NoteModal
            key="note"
            date={noteDay}
            existing={notes[dateKey(noteDay)]}
            onSave={(n) => { saveNote(noteDay, n); setNoteDay(null); }}
            onDelete={() => { deleteNote(noteDay); setNoteDay(null); }}
            onClose={() => setNoteDay(null)}
          />
        )}
        {showMilestones && (
          <MilestoneModal
            key="milestone"
            milestones={milestones}
            onSave={setMilestones}
            onClose={() => setShowMilestones(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Icon button ───────────────────────────────────────────────────────────────
function IconBtn({ active, onClick, title, activeColor, children }: {
  active: boolean; onClick: () => void; title: string; activeColor: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="flex items-center justify-center"
      style={{
        width: 30, height: 30, borderRadius: 9,
        background: active ? `${activeColor}18` : "var(--border-soft)",
        border: `1.5px solid ${active ? `${activeColor}55` : "transparent"}`,
        color: active ? activeColor : "var(--text-secondary)",
        transition: "background 150ms, color 150ms, border-color 150ms",
      }}
    >
      {children}
    </button>
  );
}

// ── Blocks renderer ───────────────────────────────────────────────────────────
function BlocksRenderer({
  quarter, qConfig, startIndex, weeks, currentWeekIndex, weekProgress, todayProgress, dayState, notes, weekRefs, onLabelChange, onTileClick,
}: {
  quarter: typeof QUARTERS[0];
  qConfig: QuarterConfig;
  startIndex: number;
  weeks: Array<{ weekStart: Date; days: Date[] }>;
  currentWeekIndex: number;
  weekProgress: number;
  todayProgress: number;
  dayState: (d: Date) => DayState;
  notes: Notes;
  weekRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  onLabelChange: (blockId: string, label: string) => void;
  onTileClick: (d: Date) => void;
}) {
  let cursor = 0;
  const blocks = qConfig.blocks.map((b) => {
    const range = { start: cursor, end: cursor + b.weeks };
    cursor += b.weeks;
    return { ...b, ...range };
  });

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {blocks.map((block) => {
            const blockRows = weeks.slice(startIndex + block.start, startIndex + block.end);
            const allDays = blockRows.flatMap((r) => r.days);
            const pastDays = allDays.filter((d) => dayState(d) === "past").length;
            const hasToday = allDays.some((d) => dayState(d) === "today");
            const totalDaysInBlock = block.weeks * 7;
            const completedPortion = pastDays + (hasToday ? todayProgress / 100 : 0);
            const pct = Math.max(0, Math.min(100, (completedPortion / totalDaysInBlock) * 100));
            const daysLeft = Math.max(0, totalDaysInBlock - pastDays - (hasToday ? 1 : 0));
            const isFuture = pastDays === 0 && !hasToday;
            const isComplete = pct >= 100;

            return (
              <motion.div layout key={block.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                style={{
                  background: "rgba(255,255,255,0.55)", borderRadius: 14,
                  border: `1px solid ${quarter.soft}`,
                  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", overflow: "hidden",
                }}
              >
                {/* Block header */}
                <div className="flex items-center justify-between px-3 sm:px-3.5 pt-2.5 pb-1.5">
                  <BlockLabel value={block.label} onChange={(v) => onLabelChange(block.id, v)} color={quarter.text} />
                  <div className="text-[10px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                    {block.weeks} {block.weeks === 1 ? "week" : "weeks"}
                  </div>
                </div>

                {/* Sprint progress */}
                <div className="px-3 sm:px-3.5 pb-2">
                  <div className="flex items-center justify-between text-[10px] tabular-nums mb-1">
                    <span style={{ color: "var(--text-tertiary)" }}>{pastDays} of {totalDaysInBlock} days</span>
                    <span style={{ color: isComplete ? "var(--apple-green)" : isFuture ? "var(--text-tertiary)" : quarter.text, fontWeight: 600 }}>
                      {pct.toFixed(0)}%
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>{isComplete ? "done ✓" : `${daysLeft} left`}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                    <motion.div
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 24 }}
                      style={{
                        height: "100%", borderRadius: 999,
                        background: isComplete ? "linear-gradient(90deg, #5ed47b, #34c759)" : `linear-gradient(90deg, ${quarter.text}, ${quarter.border})`,
                        boxShadow: pct > 0 ? `0 0 6px ${quarter.soft}` : "none",
                      }}
                    />
                  </div>
                </div>

                {/* Week rows */}
                <div className="flex flex-col gap-2 sm:gap-2.5 px-2.5 sm:px-3 pb-3 pt-1">
                  {blockRows.map(({ days }, ri) => {
                    const wi = startIndex + block.start + ri;
                    const isCurrent = wi === currentWeekIndex;
                    return (
                      <div key={wi} ref={(el) => { weekRefs.current[wi] = el; }} className="flex items-center gap-3 sm:gap-4">
                        <div className="w-14 sm:w-16 shrink-0 text-right text-[11px] tabular-nums select-none"
                          style={{ color: isCurrent ? quarter.text : "var(--text-tertiary)", fontWeight: isCurrent ? 600 : 500 }}>
                          Week {wi + 1}
                        </div>
                        <div className="grid grid-cols-7 gap-2 sm:gap-3 flex-1 relative">
                          {days.map((d, di) => (
                            <DayTile
                              key={di}
                              date={d}
                              state={dayState(d)}
                              todayProgress={todayProgress}
                              note={notes[dateKey(d)]}
                              isInCurrentWeek={isCurrent}
                              weekPct={weekProgress}
                              onClick={() => dayState(d) !== "out" && onTileClick(d)}
                            />
                          ))}
                          {isCurrent && <TodayLine pct={weekProgress} />}
                        </div>
                      </div>
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

// ── Block label ───────────────────────────────────────────────────────────────
function BlockLabel({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const commit = () => { onChange(draft.trim() || "Untitled sprint"); setEditing(false); };
  if (editing) {
    return (
      <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="text-[12px] font-semibold bg-transparent outline-none"
        style={{ color: "var(--text)", borderBottom: `1px solid ${color}`, minWidth: 100, padding: "1px 2px" }} />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold tracking-tight text-left"
      style={{ color: "var(--text)", letterSpacing: "-0.01em" }} title="Click to rename">
      {value}
    </button>
  );
}

// ── Day tile ──────────────────────────────────────────────────────────────────
function DayTile({ date, state, todayProgress, note, isInCurrentWeek, weekPct, onClick }: {
  date: Date; state: DayState; todayProgress: number;
  note: DayNote | undefined; isInCurrentWeek: boolean; weekPct: number;
  onClick: () => void;
}) {
  const isOut   = state === "out";
  const isPast  = state === "past";
  const isToday = state === "today";

  const baseStyle: React.CSSProperties = {
    borderRadius: 12, aspectRatio: "1 / 1",
    transition: "transform 150ms ease, box-shadow 150ms ease",
    cursor: isOut ? "default" : "pointer",
    position: "relative",
  };

  const dayNumber = date.getDate();
  const monthAbbr = MONTHS[date.getMonth()];
  const hasNote = !!note;

  if (isOut) return <div style={{ ...baseStyle, background: "transparent", border: "1px dashed var(--border-soft)", opacity: 0.4, cursor: "default" }} />;

  if (isPast) {
    return (
      <div onClick={onClick} className="relative flex flex-col items-center justify-center group"
        style={{ ...baseStyle, background: "linear-gradient(160deg, #5ed47b 0%, #34c759 60%, #2ab84f 100%)", color: "white", boxShadow: "0 1px 2px rgba(40,167,69,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.18)" }}>
        <Label number={dayNumber} month={monthAbbr} tone="onGreen" />
        {hasNote && <NoteDot emoji={note!.emoji} />}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12 }} />
      </div>
    );
  }

  if (isToday) {
    return (
      <div onClick={onClick} className="relative flex flex-col items-center justify-center overflow-hidden group"
        style={{ ...baseStyle, background: "var(--surface)", border: "1.5px solid var(--apple-green)", boxShadow: "0 0 0 4px rgba(52,199,89,0.12), 0 4px 14px rgba(52,199,89,0.18)", color: "var(--text)" }}
        aria-label={`Today, ${todayProgress.toFixed(0)}% elapsed`}>
        {/* Today tint from above (today line) */}
        {isInCurrentWeek && (
          <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `${weekPct}%`, background: "linear-gradient(180deg, rgba(52,199,89,0.18), rgba(52,199,89,0.09))", transition: "height 1s ease-out" }} />
        )}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <Label number={dayNumber} month={monthAbbr} tone="auto" />
        </div>
        {hasNote && <NoteDot emoji={note!.emoji} />}
      </div>
    );
  }

  // Future
  const showTint = isInCurrentWeek;
  return (
    <div onClick={onClick} className="relative flex flex-col items-center justify-center group overflow-hidden"
      style={{ ...baseStyle, background: "var(--surface)", border: "1px solid var(--border-soft)", color: "var(--text-secondary)", boxShadow: "0 1px 1px rgba(0,0,0,0.02)" }}>
      {showTint && (
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `${weekPct}%`, background: "linear-gradient(180deg, rgba(52,199,89,0.15), rgba(52,199,89,0.07))", transition: "height 1s ease-out" }} />
      )}
      <div className="relative z-10"><Label number={dayNumber} month={monthAbbr} tone="muted" /></div>
      {hasNote && <NoteDot emoji={note!.emoji} />}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: "rgba(0,0,0,0.03)", borderRadius: 12 }} />
    </div>
  );
}

function NoteDot({ emoji }: { emoji: string }) {
  return (
    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center" style={{ width: 14, height: 14 }}>
      {emoji
        ? <span style={{ fontSize: 10, lineHeight: 1 }}>{emoji}</span>
        : <div style={{ width: 5, height: 5, borderRadius: 999, background: "var(--apple-green)", boxShadow: "0 0 4px rgba(52,199,89,0.6)" }} />
      }
    </div>
  );
}

function Label({ number, month, tone }: { number: number; month: string; tone: "onGreen" | "muted" | "auto" }) {
  const numberColor = tone === "onGreen" ? "white" : "var(--text)";
  const monthColor = tone === "onGreen" ? "rgba(255,255,255,0.85)" : tone === "muted" ? "var(--text-tertiary)" : "var(--text-secondary)";
  return (
    <div className="flex flex-col items-center justify-center leading-none select-none">
      <div className="text-base sm:text-lg font-semibold tabular-nums" style={{ color: numberColor, letterSpacing: "-0.02em" }}>{number}</div>
      <div className="mt-0.5 text-[9px] sm:text-[10px] font-medium tracking-widest" style={{ color: monthColor }}>{month}</div>
    </div>
  );
}

// ── Sprint settings modal ─────────────────────────────────────────────────────
function SprintSettingsModal({ quarterIndex: _qi, quarter, initial, onClose, onSave }: {
  quarterIndex: number; quarter: typeof QUARTERS[0];
  initial: QuarterConfig; onClose: () => void; onSave: (next: QuarterConfig) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => initial.blocks.map((b) => ({ ...b, goals: b.goals ?? [] })));

  const total = blocks.reduce((a, b) => a + (Number(b.weeks) || 0), 0);
  const remaining = WEEKS_PER_QUARTER - total;
  const valid = total === WEEKS_PER_QUARTER && blocks.every((b) => b.weeks >= 1);

  const updateBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBlock = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const addBlock = () => setBlocks((prev) => [...prev, { id: makeId(), weeks: Math.max(1, remaining > 0 ? remaining : 1), label: `Sprint ${prev.length + 1}`, goals: [] }]);
  const applyPreset = (parts: number[]) => setBlocks(parts.map((w, i) => ({ id: makeId(), weeks: w, label: `Sprint ${i + 1}`, goals: [] })));

  const addGoal = (blockId: string) => updateBlock(blockId, {
    goals: [...(blocks.find((b) => b.id === blockId)?.goals ?? []), { id: makeId(), text: "", done: false }],
  });
  const updateGoal = (blockId: string, goalId: string, patch: Partial<Goal>) => updateBlock(blockId, {
    goals: blocks.find((b) => b.id === blockId)!.goals.map((g) => g.id === goalId ? { ...g, ...patch } : g),
  });
  const removeGoal = (blockId: string, goalId: string) => updateBlock(blockId, {
    goals: blocks.find((b) => b.id === blockId)!.goals.filter((g) => g.id !== goalId),
  });

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.38)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="w-full max-w-md flex flex-col"
        style={{ background: "var(--surface)", borderRadius: 22, boxShadow: "0 30px 80px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.4) inset", border: "1px solid var(--border-soft)", maxHeight: "88vh", overflow: "hidden" }}>

        <div className="px-6 pt-6 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ color: quarter.text, background: quarter.tint, border: `1px solid ${quarter.soft}` }}>
              {quarter.label}
            </span>
            <h2 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>Sprint configuration</h2>
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>Group the 13 weeks into sprints. Each can have goals and a label.</p>
        </div>

        {/* Presets */}
        <div className="px-6 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {[{ name: "1 × 13", parts: [13] }, { name: "3+3+3+4", parts: [3,3,3,4] }, { name: "4+4+5", parts: [4,4,5] }, { name: "6+7", parts: [6,7] }, { name: "2wk sprints", parts: [2,2,2,2,2,2,1] }].map((p) => (
              <button key={p.name} onClick={() => applyPreset(p.parts)} type="button"
                className="text-[11px] tabular-nums px-2.5 py-1 rounded-full"
                style={{ background: "var(--border-soft)", color: "var(--text-secondary)", border: "1px solid var(--border-soft)" }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Blocks */}
        <div className="flex-1 overflow-auto px-6 mt-4">
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {blocks.map((b, idx) => (
                <motion.div layout key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="flex flex-col gap-1.5"
                  style={{ background: "var(--border-soft)", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 10px" }}>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-semibold flex items-center justify-center"
                      style={{ width: 22, height: 22, borderRadius: 999, background: quarter.tint, color: quarter.text }}>{idx + 1}</div>
                    <input type="text" value={b.label} onChange={(e) => updateBlock(b.id, { label: e.target.value })}
                      placeholder="Sprint label" className="flex-1 bg-transparent outline-none text-[13px]"
                      style={{ color: "var(--text)" }} />
                    <div className="flex items-center gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "2px" }}>
                      <button type="button" onClick={() => updateBlock(b.id, { weeks: Math.max(1, b.weeks - 1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color: "var(--text-secondary)" }}>−</button>
                      <span className="text-[12px] font-semibold tabular-nums w-6 text-center" style={{ color: "var(--text)" }}>{b.weeks}</span>
                      <button type="button" onClick={() => updateBlock(b.id, { weeks: Math.min(WEEKS_PER_QUARTER, b.weeks + 1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color: "var(--text-secondary)" }}>+</button>
                    </div>
                    <button type="button" onClick={() => removeBlock(b.id)} disabled={blocks.length === 1}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ color: blocks.length === 1 ? "var(--text-tertiary)" : "#ff3b30", opacity: blocks.length === 1 ? 0.4 : 1 }}>
                      <TrashIcon />
                    </button>
                  </div>
                  {/* Goals */}
                  {b.goals.length > 0 && (
                    <div className="flex flex-col gap-1 pl-7">
                      {b.goals.map((g) => (
                        <div key={g.id} className="flex items-center gap-1.5">
                          <input type="checkbox" checked={g.done} onChange={(e) => updateGoal(b.id, g.id, { done: e.target.checked })}
                            className="rounded" style={{ accentColor: quarter.border }} />
                          <input type="text" value={g.text} onChange={(e) => updateGoal(b.id, g.id, { text: e.target.value })}
                            placeholder="Goal…" className="flex-1 bg-transparent outline-none text-[12px]"
                            style={{ color: "var(--text)", textDecoration: g.done ? "line-through" : "none", opacity: g.done ? 0.55 : 1 }} />
                          <button type="button" onClick={() => removeGoal(b.id, g.id)} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: "var(--text-tertiary)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => addGoal(b.id)} className="text-[10px] font-medium ml-7 self-start"
                    style={{ color: quarter.text, opacity: 0.75 }}>+ add goal</button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button type="button" onClick={addBlock} disabled={remaining < 1} className="text-[12px] font-medium mt-1 self-start px-3 py-1.5 rounded-xl"
              style={{ color: remaining < 1 ? "var(--text-tertiary)" : quarter.text, background: remaining < 1 ? "var(--border-soft)" : quarter.tint, border: `1px solid ${remaining < 1 ? "var(--border)" : quarter.soft}`, opacity: remaining < 1 ? 0.6 : 1 }}>
              + Add sprint
            </button>
          </div>
        </div>

        {/* Validation */}
        <div className="px-6 mt-4 shrink-0">
          <div className="flex items-center justify-between text-[12px] tabular-nums px-3 py-2.5 rounded-xl"
            style={{ background: valid ? "rgba(52,199,89,0.08)" : "rgba(255,59,48,0.07)", color: valid ? "#28a745" : "#c00", border: `1px solid ${valid ? "rgba(52,199,89,0.2)" : "rgba(255,59,48,0.2)"}` }}>
            <span>Total: {total} / {WEEKS_PER_QUARTER} weeks</span>
            <span>{valid ? "Looks good ✓" : remaining > 0 ? `${remaining} wk unassigned` : `${-remaining} wk over`}</span>
          </div>
        </div>

        <div className="px-6 py-5 flex items-center justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="text-[13px] font-medium px-4 py-2 rounded-xl" style={{ color: "var(--text-secondary)", background: "var(--border-soft)" }}>Cancel</button>
          <button type="button" onClick={() => valid && onSave({ blocks })} disabled={!valid}
            className="text-[13px] font-semibold px-4 py-2 rounded-xl"
            style={{ color: "white", background: valid ? "linear-gradient(180deg, #5ed47b 0%, #34c759 100%)" : "rgba(0,0,0,0.15)", boxShadow: valid ? "0 1px 2px rgba(40,167,69,0.25)" : "none", cursor: valid ? "pointer" : "not-allowed" }}>
            Save sprints
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

export default App;
