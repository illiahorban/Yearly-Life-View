import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKS_PER_QUARTER = 13;
const TOTAL_WEEKS = 52;

type Quarter = {
  label: string;
  tint: string;
  border: string;
  text: string;
  soft: string;
};

const QUARTERS: Quarter[] = [
  { label: "Q1", tint: "rgba(0,122,255,0.045)",  border: "#0a84ff", text: "#0a84ff", soft: "rgba(10,132,255,0.18)" },
  { label: "Q2", tint: "rgba(52,199,89,0.05)",   border: "#34c759", text: "#28a745", soft: "rgba(52,199,89,0.20)" },
  { label: "Q3", tint: "rgba(255,204,0,0.07)",   border: "#ffcc00", text: "#b58900", soft: "rgba(255,204,0,0.28)" },
  { label: "Q4", tint: "rgba(255,149,0,0.06)",   border: "#ff9500", text: "#c2410c", soft: "rgba(255,149,0,0.22)" },
];

type Block = { id: string; weeks: number; label: string };
type QuarterConfig = { blocks: Block[] };
type CalendarConfig = { quarters: QuarterConfig[] };

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultQuarterConfig(): QuarterConfig {
  return {
    blocks: [{ id: makeId(), weeks: WEEKS_PER_QUARTER, label: "All weeks" }],
  };
}

function defaultConfig(): CalendarConfig {
  return { quarters: [0, 1, 2, 3].map(() => defaultQuarterConfig()) };
}

function loadConfig(year: number): CalendarConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = window.localStorage.getItem(`lifeCalendar:v1:${year}`);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as CalendarConfig;
    if (!parsed?.quarters || parsed.quarters.length !== 4) return defaultConfig();
    for (const q of parsed.quarters) {
      const sum = q.blocks.reduce((a, b) => a + (b.weeks || 0), 0);
      if (sum !== WEEKS_PER_QUARTER) return defaultConfig();
    }
    return parsed;
  } catch {
    return defaultConfig();
  }
}

function saveConfig(year: number, cfg: CalendarConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`lifeCalendar:v1:${year}`, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfYear(year: number) { return new Date(year, 0, 1); }
function startOfNextYear(year: number) { return new Date(year + 1, 0, 1); }
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const dow = x.getDay();
  const diff = (dow + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type DayState = "past" | "today" | "future" | "out";

function App() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const year = now.getFullYear();

  const [config, setConfig] = useState<CalendarConfig>(() => loadConfig(new Date().getFullYear()));

  useEffect(() => {
    setConfig(loadConfig(year));
  }, [year]);

  useEffect(() => {
    saveConfig(year, config);
  }, [year, config]);

  const weeks = useMemo(() => {
    const firstMonday = startOfWeekMonday(startOfYear(year));
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const weekStart = addDays(firstMonday, i * 7);
      const days = Array.from({ length: 7 }, (_, j) => addDays(weekStart, j));
      return { weekStart, days };
    });
  }, [year]);

  const yearProgress = useMemo(() => {
    const start = startOfYear(year).getTime();
    const end = startOfNextYear(year).getTime();
    return Math.max(0, Math.min(100, ((now.getTime() - start) / (end - start)) * 100));
  }, [now, year]);

  const today = startOfDay(now);

  const currentWeekIndex = useMemo(() => {
    return weeks.findIndex(({ days }) => days.some((d) => sameDay(d, today)));
  }, [weeks, today]);

  const weekProgress = useMemo(() => {
    if (currentWeekIndex < 0) return 0;
    const w = weeks[currentWeekIndex]!;
    const start = w.weekStart.getTime();
    const end = start + 7 * 86_400_000;
    return Math.max(0, Math.min(100, ((now.getTime() - start) / (end - start)) * 100));
  }, [weeks, currentWeekIndex, now]);

  const weekRefs = useRef<Array<HTMLDivElement | null>>([]);
  const didScrollRef = useRef(false);

  useEffect(() => {
    if (didScrollRef.current || currentWeekIndex < 0) return;
    const el = weekRefs.current[currentWeekIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      didScrollRef.current = true;
    }
  }, [currentWeekIndex]);

  const dayState = (d: Date): DayState => {
    if (d.getFullYear() !== year) return "out";
    if (sameDay(d, today)) return "today";
    if (d < today) return "past";
    return "future";
  };

  const daysCompleted = useMemo(() => {
    let n = 0;
    for (const { days } of weeks) for (const d of days) if (d.getFullYear() === year && d < today) n++;
    return n;
  }, [weeks, today, year]);

  const totalDays = (startOfNextYear(year).getTime() - startOfYear(year).getTime()) / 86_400_000;

  const [settingsQuarter, setSettingsQuarter] = useState<number | null>(null);

  const updateQuarter = (qi: number, next: QuarterConfig) => {
    setConfig((prev) => {
      const quarters = prev.quarters.slice();
      quarters[qi] = next;
      return { quarters };
    });
  };

  const updateBlockLabel = (qi: number, blockId: string, label: string) => {
    setConfig((prev) => {
      const quarters = prev.quarters.slice();
      const q = quarters[qi]!;
      quarters[qi] = {
        blocks: q.blocks.map((b) => (b.id === blockId ? { ...b, label } : b)),
      };
      return { quarters };
    });
  };

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: "rgba(245,245,247,0.85)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-7 pb-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
              {year}
            </h1>
            <div className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {yearProgress.toFixed(1)}% complete
            </div>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden" style={{ background: "var(--border-soft)", borderRadius: 999 }}>
            <div
              className="h-full transition-[width] duration-700 ease-out"
              style={{
                width: `${yearProgress}%`,
                background: "linear-gradient(90deg, #5ed47b 0%, #34c759 55%, #28a745 100%)",
                borderRadius: 999,
              }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            <span>{daysCompleted} of {totalDays} days</span>
            <span>{(totalDays - daysCompleted).toFixed(0)} days remaining</span>
          </div>
        </div>
      </header>

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
              return (
                <motion.section
                  layout
                  key={qi}
                  className="overflow-hidden"
                  style={{
                    background: quarter.tint,
                    borderRadius: 18,
                    borderLeft: `3px solid ${quarter.border}`,
                  }}
                >
                  <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2">
                    <div className="flex items-baseline gap-3">
                      <div className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: quarter.text }}>
                        {quarter.label}
                      </div>
                      <div className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                        Weeks {startIndex + 1}–{startIndex + WEEKS_PER_QUARTER}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsQuarter(qi)}
                      className="flex items-center justify-center"
                      style={{
                        width: 28, height: 28,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(0,0,0,0.06)",
                        color: quarter.text,
                        transition: "transform 150ms ease, background 150ms ease",
                      }}
                      aria-label={`Configure ${quarter.label} sprints`}
                      title="Configure sprints"
                      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <GearIcon />
                    </button>
                  </div>

                  <div className="px-3 sm:px-4 pb-4 pt-1 flex flex-col gap-2">
                    <BlocksRenderer
                      qi={qi}
                      quarter={quarter}
                      qConfig={qConfig}
                      startIndex={startIndex}
                      weeks={weeks}
                      currentWeekIndex={currentWeekIndex}
                      weekProgress={weekProgress}
                      dayState={dayState}
                      weekRefs={weekRefs}
                      onLabelChange={(blockId, label) => updateBlockLabel(qi, blockId, label)}
                    />
                  </div>
                </motion.section>
              );
            })}
          </div>
        </LayoutGroup>

        <footer className="mt-12 pb-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
          Life Calendar · {year}
        </footer>
      </main>

      <AnimatePresence>
        {settingsQuarter !== null && (
          <SprintSettingsModal
            quarterIndex={settingsQuarter}
            quarter={QUARTERS[settingsQuarter]!}
            initial={config.quarters[settingsQuarter]!}
            onClose={() => setSettingsQuarter(null)}
            onSave={(next) => {
              updateQuarter(settingsQuarter, next);
              setSettingsQuarter(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BlocksRenderer({
  qi: _qi, quarter, qConfig, startIndex, weeks, currentWeekIndex, weekProgress, dayState, weekRefs, onLabelChange,
}: {
  qi: number;
  quarter: Quarter;
  qConfig: QuarterConfig;
  startIndex: number;
  weeks: Array<{ weekStart: Date; days: Date[] }>;
  currentWeekIndex: number;
  weekProgress: number;
  dayState: (d: Date) => DayState;
  weekRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  onLabelChange: (blockId: string, label: string) => void;
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
            return (
              <motion.div
                layout
                key={block.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                style={{
                  background: "rgba(255,255,255,0.55)",
                  borderRadius: 14,
                  border: `1px solid ${quarter.soft}`,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  overflow: "hidden",
                }}
              >
                <div className="flex items-center justify-between px-3 sm:px-3.5 pt-2.5 pb-1.5">
                  <BlockLabel
                    value={block.label}
                    onChange={(v) => onLabelChange(block.id, v)}
                    color={quarter.text}
                  />
                  <div className="text-[10px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                    {block.weeks} {block.weeks === 1 ? "week" : "weeks"}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:gap-2.5 px-2.5 sm:px-3 pb-3 pt-1">
                  {blockRows.map(({ days }, ri) => {
                    const wi = startIndex + block.start + ri;
                    const isCurrent = wi === currentWeekIndex;
                    return (
                      <div
                        key={wi}
                        ref={(el) => { weekRefs.current[wi] = el; }}
                        className="flex items-center gap-3 sm:gap-4"
                      >
                        <div
                          className="w-14 sm:w-16 shrink-0 text-right text-[11px] tabular-nums select-none"
                          style={{
                            color: isCurrent ? quarter.text : "var(--text-tertiary)",
                            fontWeight: isCurrent ? 600 : 500,
                          }}
                        >
                          Week {wi + 1}
                        </div>
                        <div className="grid grid-cols-7 gap-2 sm:gap-3 flex-1 relative">
                          {days.map((d, di) => (
                            <DayTile
                              key={di}
                              date={d}
                              state={dayState(d)}
                              isInCurrentWeek={isCurrent}
                              weekPct={weekProgress}
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

function BlockLabel({
  value, onChange, color,
}: { value: string; onChange: (v: string) => void; color: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || "Untitled sprint";
    onChange(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="text-[12px] font-semibold bg-transparent outline-none"
        style={{
          color: "var(--text)",
          borderBottom: `1px solid ${color}`,
          minWidth: 100,
          padding: "1px 2px",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-[12px] font-semibold tracking-tight text-left"
      style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
      title="Click to rename"
    >
      {value}
    </button>
  );
}

function SprintSettingsModal({
  quarterIndex: _qi, quarter, initial, onClose, onSave,
}: {
  quarterIndex: number;
  quarter: Quarter;
  initial: QuarterConfig;
  onClose: () => void;
  onSave: (next: QuarterConfig) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => initial.blocks.map((b) => ({ ...b })));

  const total = blocks.reduce((a, b) => a + (Number(b.weeks) || 0), 0);
  const remaining = WEEKS_PER_QUARTER - total;
  const valid = total === WEEKS_PER_QUARTER && blocks.every((b) => b.weeks >= 1);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };
  const addBlock = () => {
    setBlocks((prev) => [
      ...prev,
      { id: makeId(), weeks: Math.max(1, remaining > 0 ? remaining : 1), label: `Sprint ${prev.length + 1}` },
    ]);
  };

  const applyPreset = (parts: number[]) => {
    setBlocks(parts.map((w, i) => ({ id: makeId(), weeks: w, label: `Sprint ${i + 1}` })));
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(20,20,25,0.35)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="w-full max-w-md"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderRadius: 22,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.6) inset",
          border: "1px solid rgba(255,255,255,0.6)",
        }}
      >
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center text-[10px] font-semibold uppercase tracking-widest"
              style={{
                color: quarter.text,
                background: quarter.tint,
                border: `1px solid ${quarter.soft}`,
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              {quarter.label}
            </span>
            <h2 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
              Sprint configuration
            </h2>
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Group the 13 weeks of {quarter.label} into sprints. Each sprint can have its own label.
          </p>
        </div>

        <div className="px-6">
          <div className="flex flex-wrap gap-1.5">
            {[
              { name: "1 × 13", parts: [13] },
              { name: "2 + 2 + 2 + 2 + 2 + 2 + 1", parts: [2, 2, 2, 2, 2, 2, 1] },
              { name: "3 + 3 + 3 + 4", parts: [3, 3, 3, 4] },
              { name: "4 + 4 + 5", parts: [4, 4, 5] },
              { name: "6 + 7", parts: [6, 7] },
            ].map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p.parts)}
                type="button"
                className="text-[11px] tabular-nums"
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.04)",
                  color: "var(--text-secondary)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 mt-4 max-h-[320px] overflow-auto">
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {blocks.map((b, idx) => (
                <motion.div
                  layout
                  key={b.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2"
                  style={{
                    background: "rgba(0,0,0,0.025)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    borderRadius: 12,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    className="text-[10px] font-semibold tabular-nums"
                    style={{
                      width: 22, height: 22,
                      borderRadius: 999,
                      background: quarter.tint,
                      color: quarter.text,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={b.label}
                    onChange={(e) => updateBlock(b.id, { label: e.target.value })}
                    placeholder="Sprint label"
                    className="flex-1 bg-transparent outline-none text-[13px]"
                    style={{ color: "var(--text)" }}
                  />
                  <div
                    className="flex items-center gap-1"
                    style={{
                      background: "white",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 8,
                      padding: "2px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => updateBlock(b.id, { weeks: Math.max(1, b.weeks - 1) })}
                      className="w-6 h-6 rounded-md text-[14px]"
                      style={{ color: "var(--text-secondary)" }}
                      aria-label="Decrease weeks"
                    >−</button>
                    <span className="text-[12px] font-semibold tabular-nums w-6 text-center" style={{ color: "var(--text)" }}>
                      {b.weeks}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateBlock(b.id, { weeks: Math.min(WEEKS_PER_QUARTER, b.weeks + 1) })}
                      className="w-6 h-6 rounded-md text-[14px]"
                      style={{ color: "var(--text-secondary)" }}
                      aria-label="Increase weeks"
                    >+</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(b.id)}
                    disabled={blocks.length === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-md"
                    style={{
                      color: blocks.length === 1 ? "var(--text-tertiary)" : "#ff3b30",
                      opacity: blocks.length === 1 ? 0.4 : 1,
                    }}
                    aria-label="Remove sprint"
                    title="Remove sprint"
                  >
                    <TrashIcon />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            <button
              type="button"
              onClick={addBlock}
              disabled={remaining < 1}
              className="text-[12px] font-medium mt-1 self-start"
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                color: remaining < 1 ? "var(--text-tertiary)" : quarter.text,
                background: remaining < 1 ? "rgba(0,0,0,0.04)" : quarter.tint,
                border: `1px solid ${remaining < 1 ? "rgba(0,0,0,0.06)" : quarter.soft}`,
                opacity: remaining < 1 ? 0.6 : 1,
              }}
            >
              + Add sprint
            </button>
          </div>
        </div>

        <div className="px-6 mt-5">
          <div
            className="flex items-center justify-between text-[12px] tabular-nums px-3 py-2.5"
            style={{
              background: valid ? "rgba(52,199,89,0.08)" : "rgba(255,59,48,0.07)",
              color: valid ? "#28a745" : "#c00",
              borderRadius: 10,
              border: `1px solid ${valid ? "rgba(52,199,89,0.2)" : "rgba(255,59,48,0.2)"}`,
            }}
          >
            <span>Total: {total} / {WEEKS_PER_QUARTER} weeks</span>
            <span>
              {valid
                ? "Looks good"
                : remaining > 0
                  ? `${remaining} week${remaining === 1 ? "" : "s"} unassigned`
                  : `${-remaining} week${-remaining === 1 ? "" : "s"} over the limit`}
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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => valid && onSave({ blocks })}
            disabled={!valid}
            className="text-[13px] font-semibold"
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              color: "white",
              background: valid
                ? "linear-gradient(180deg, #5ed47b 0%, #34c759 100%)"
                : "rgba(0,0,0,0.15)",
              boxShadow: valid ? "0 1px 2px rgba(40,167,69,0.25)" : "none",
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            Save sprints
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TodayLine({ pct }: { pct: number }) {
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{
        top: `${pct}%`,
        transform: "translateY(-50%)",
        height: 2,
        transition: "top 1s ease-out",
      }}
      aria-hidden
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          background:
            "linear-gradient(90deg, rgba(52,199,89,0) 0%, rgba(94,212,123,0.95) 12%, #34c759 50%, rgba(94,212,123,0.95) 88%, rgba(52,199,89,0) 100%)",
          borderRadius: 999,
          boxShadow:
            "0 0 4px rgba(52,199,89,0.95), 0 0 10px rgba(52,199,89,0.7), 0 0 20px rgba(52,199,89,0.4)",
        }}
      />
      <div
        className="absolute top-1/2"
        style={{
          left: "calc(100% - 2px)",
          width: 8,
          height: 8,
          marginTop: -4,
          borderRadius: 999,
          background: "#34c759",
          boxShadow:
            "0 0 6px rgba(52,199,89,1), 0 0 14px rgba(52,199,89,0.8), 0 0 24px rgba(52,199,89,0.4)",
        }}
      />
    </div>
  );
}

function DayTile({
  date, state, isInCurrentWeek, weekPct,
}: { date: Date; state: DayState; isInCurrentWeek: boolean; weekPct: number }) {
  const isOut = state === "out";
  const isPast = state === "past";
  const isToday = state === "today";

  const baseStyle: React.CSSProperties = {
    borderRadius: 12,
    aspectRatio: "1 / 1",
    transition: "transform 200ms ease, box-shadow 200ms ease",
  };

  const dayNumber = date.getDate();
  const monthAbbr = MONTHS[date.getMonth()];

  if (isOut) {
    return (
      <div style={{ ...baseStyle, background: "transparent", border: "1px dashed var(--border-soft)", opacity: 0.5 }} />
    );
  }

  if (isPast) {
    return (
      <div
        className="relative flex flex-col items-center justify-center"
        style={{
          ...baseStyle,
          background: "linear-gradient(160deg, #5ed47b 0%, #34c759 60%, #2ab84f 100%)",
          color: "white",
          boxShadow: "0 1px 2px rgba(40,167,69,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.18)",
        }}
      >
        <Label number={dayNumber} month={monthAbbr} tone="onGreen" />
      </div>
    );
  }

  // Future or today (today is part of current week, not yet "past")
  // In the current week, render a soft tint above the today line.
  const showTint = isInCurrentWeek;

  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        ...baseStyle,
        background: "var(--surface)",
        border: isToday
          ? "1.5px solid var(--apple-green)"
          : "1px solid var(--border-soft)",
        color: "var(--text-secondary)",
        boxShadow: isToday
          ? "0 0 0 4px rgba(52,199,89,0.10), 0 2px 10px rgba(52,199,89,0.18)"
          : "0 1px 1px rgba(0,0,0,0.02)",
      }}
      aria-label={isToday ? "Today" : undefined}
    >
      {showTint && (
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: `${weekPct}%`,
            background:
              "linear-gradient(180deg, rgba(52,199,89,0.18) 0%, rgba(52,199,89,0.10) 100%)",
            transition: "height 1s ease-out",
          }}
        />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <Label number={dayNumber} month={monthAbbr} tone={isToday ? "auto" : "muted"} />
      </div>
    </div>
  );
}

function Label({
  number, month, tone,
}: { number: number; month: string; tone: "onGreen" | "muted" | "auto" }) {
  const numberColor = tone === "onGreen" ? "white" : "var(--text)";
  const monthColor =
    tone === "onGreen" ? "rgba(255,255,255,0.85)" :
    tone === "muted" ? "var(--text-tertiary)" : "var(--text-secondary)";
  return (
    <div className="flex flex-col items-center justify-center leading-none select-none">
      <div className="text-base sm:text-lg font-semibold tabular-nums" style={{ color: numberColor, letterSpacing: "-0.02em" }}>
        {number}
      </div>
      <div className="mt-1 text-[9px] sm:text-[10px] font-medium tracking-widest" style={{ color: monthColor }}>
        {month}
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default App;
