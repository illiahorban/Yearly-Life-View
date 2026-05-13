import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";

// ─── Tiny localStorage helpers ────────────────────────────────────────────────

function ls<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fb; }
  catch { return fb; }
}
function lsSet(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfYear(y: number) { return new Date(y, 0, 1); }
function startOfNextYear(y: number) { return new Date(y+1, 0, 1); }
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - (x.getDay()+6)%7);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime()-a.getTime())/86_400_000); }

// ─── Types ────────────────────────────────────────────────────────────────────

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const WEEKDAYS = ["M","T","W","T","F","S","S"];
const WEEKS_PER_QUARTER = 13;
const TOTAL_WEEKS = 52;

type Quarter = { label: string; tint: string; darkTint: string; border: string; text: string; soft: string; darkSoft: string };
type Block = { id: string; weeks: number; label: string; color?: AppleColorKey };
type QuarterConfig = { blocks: Block[] };
type CalendarConfig = { quarters: QuarterConfig[] };
type DayState = "past" | "today" | "future" | "out";
type Milestone = { id: string; label: string; date: string; color: string; description?: string };
type Goal = { id: string; text: string; done: boolean };
type BlockGoals = { description: string; goals: Goal[] };

const APPLE_COLORS = [
  { key:"blue",   label:"Blue",   light:"#007aff", dark:"#0a84ff" },
  { key:"green",  label:"Green",  light:"#34c759", dark:"#30d158" },
  { key:"indigo", label:"Indigo", light:"#5856d6", dark:"#5e5ce6" },
  { key:"orange", label:"Orange", light:"#ff9500", dark:"#ff9f0a" },
  { key:"pink",   label:"Pink",   light:"#ff2d55", dark:"#ff375f" },
  { key:"purple", label:"Purple", light:"#af52de", dark:"#bf5af2" },
  { key:"red",    label:"Red",    light:"#ff3b30", dark:"#ff453a" },
  { key:"teal",   label:"Teal",   light:"#5ac8fa", dark:"#64d2ff" },
  { key:"yellow", label:"Yellow", light:"#ffcc00", dark:"#ffd60a" },
  { key:"mint",   label:"Mint",   light:"#00c7be", dark:"#63e6e2" },
  { key:"brown",  label:"Brown",  light:"#a2845e", dark:"#ac8e68" },
] as const;

type AppleColorKey = typeof APPLE_COLORS[number]["key"];
type QuarterMeta = { name: string; colorKey: AppleColorKey };

const DEFAULT_QUARTER_META: QuarterMeta[] = [
  { name:"Q1", colorKey:"blue" }, { name:"Q2", colorKey:"green" },
  { name:"Q3", colorKey:"yellow" }, { name:"Q4", colorKey:"orange" },
];

function hexToRgb(hex: string): [number,number,number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function resolveQuarter(meta: QuarterMeta, dark: boolean): Quarter {
  const ac = APPLE_COLORS.find(c => c.key === meta.colorKey) ?? APPLE_COLORS[0]!;
  const hex = dark ? ac.dark : ac.light;
  const [r,g,b] = hexToRgb(hex);
  // Adjust text color for low-contrast hues in light mode
  const textHex = (!dark && meta.colorKey==="yellow") ? "#9a7400"
                : (!dark && meta.colorKey==="mint")   ? "#008a82"
                : (!dark && meta.colorKey==="teal")   ? "#007ea5"
                : hex;
  return {
    label: meta.name,
    tint:     `rgba(${r},${g},${b},0.07)`,
    darkTint: `rgba(${r},${g},${b},0.14)`,
    border: hex,
    text: textHex,
    soft:     `rgba(${r},${g},${b},0.22)`,
    darkSoft: `rgba(${r},${g},${b},0.36)`,
  };
}

const MILESTONE_COLORS = ["#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#ff2d55","#5ac8fa"];

// ─── Config helpers ───────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2,10); }
function defaultBlock(): Block { return { id: makeId(), weeks: WEEKS_PER_QUARTER, label: "All weeks" }; }

function createSprintFromSelection(qConfig: QuarterConfig, selStart: number, selEnd: number): QuarterConfig {
  const selEndExcl = selEnd + 1;
  const newBlocks: Block[] = [];
  let cursor = 0;
  let sprintAdded = false;
  for (const block of qConfig.blocks) {
    const bStart = cursor;
    const bEnd = cursor + block.weeks;
    cursor = bEnd;
    if (bEnd <= selStart || bStart >= selEndExcl) {
      newBlocks.push(block);
    } else {
      const beforeWeeks = selStart - bStart;
      if (beforeWeeks > 0) newBlocks.push({ id: makeId(), weeks: beforeWeeks, label: block.label });
      if (!sprintAdded) {
        newBlocks.push({ id: makeId(), weeks: selEndExcl - selStart, label: "Sprint" });
        sprintAdded = true;
      }
      const afterWeeks = bEnd - selEndExcl;
      if (afterWeeks > 0) newBlocks.push({ id: makeId(), weeks: afterWeeks, label: block.label });
    }
  }
  return { blocks: newBlocks };
}
function defaultConfig(): CalendarConfig { return { quarters: [0,1,2,3].map(() => ({ blocks: [defaultBlock()] })) }; }
function loadConfig(year: number): CalendarConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = localStorage.getItem(`lifeCalendar:v1:${year}`);
    if (!raw) return defaultConfig();
    const p = JSON.parse(raw) as CalendarConfig;
    if (!p?.quarters || p.quarters.length !== 4) return defaultConfig();
    for (const q of p.quarters) {
      if (q.blocks.reduce((a,b) => a+(b.weeks||0), 0) !== WEEKS_PER_QUARTER) return defaultConfig();
    }
    return p;
  } catch { return defaultConfig(); }
}
function saveConfig(year: number, cfg: CalendarConfig) {
  try { localStorage.setItem(`lifeCalendar:v1:${year}`, JSON.stringify(cfg)); } catch {}
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  const MIN_YEAR = 2020, MAX_YEAR = 2030;
  const [viewYear, setViewYear] = useState(() => now.getFullYear());

  // Dark mode
  const [dark, setDark] = useState<boolean>(() => ls<boolean>("lifeCalendar:darkMode", false));
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    lsSet("lifeCalendar:darkMode", dark);
  }, [dark]);

  // Calendar config
  const [config, setConfig] = useState<CalendarConfig>(() => loadConfig(now.getFullYear()));
  useEffect(() => { setConfig(loadConfig(viewYear)); }, [viewYear]);
  useEffect(() => { saveConfig(viewYear, config); }, [viewYear, config]);

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>(() => ls<Milestone[]>("lifeCalendar:milestones", []));
  useEffect(() => { lsSet("lifeCalendar:milestones", milestones); }, [milestones]);
  const [milestonePanelOpen, setMilestonePanelOpen] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Record<string,string>>(() => ls<Record<string,string>>("lifeCalendar:notes", {}));
  const [openNote, setOpenNote] = useState<string|null>(null);
  const upsertNote = (key: string, text: string) => {
    setNotes(prev => {
      const next = { ...prev };
      if (text.trim()) next[key] = text.trim(); else delete next[key];
      lsSet("lifeCalendar:notes", next);
      return next;
    });
  };

  // Block goals
  const [blockGoals, setBlockGoals] = useState<Record<string,BlockGoals>>(() => ls<Record<string,BlockGoals>>("lifeCalendar:goals", {}));
  useEffect(() => { lsSet("lifeCalendar:goals", blockGoals); }, [blockGoals]);
  const [editGoalsBlockId, setEditGoalsBlockId] = useState<string|null>(null);
  const editGoalsBlock = useMemo(() => {
    if (!editGoalsBlockId) return null;
    for (const q of config.quarters) { const b = q.blocks.find(b => b.id === editGoalsBlockId); if (b) return b; }
    return null;
  }, [editGoalsBlockId, config]);

  const [settingsQuarter, setSettingsQuarter] = useState<number|null>(null);

  // Week selection for sprint creation
  const [weekSel, setWeekSel] = useState<{ qi: number; anchor: number; focus: number }|null>(null);
  const handleWeekLabelClick = (qi: number, qOffset: number) => {
    setWeekSel(prev => {
      if (!prev || prev.qi !== qi) return { qi, anchor: qOffset, focus: qOffset };
      if (prev.anchor === qOffset && prev.focus === qOffset) return null; // deselect
      return { ...prev, focus: qOffset };
    });
  };

  // Quarter meta (names + colors)
  const [quarterMeta, setQuarterMeta] = useState<QuarterMeta[]>(() => ls<QuarterMeta[]>("lifeCalendar:quarterMeta", DEFAULT_QUARTER_META));
  useEffect(() => { lsSet("lifeCalendar:quarterMeta", quarterMeta); }, [quarterMeta]);
  const [colorPickerQi, setColorPickerQi] = useState<number|null>(null);

  // Calendar data
  const weeks = useMemo(() => {
    const first = startOfWeekMonday(startOfYear(viewYear));
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const weekStart = addDays(first, i*7);
      return { weekStart, days: Array.from({ length: 7 }, (_, j) => addDays(weekStart, j)) };
    });
  }, [viewYear]);

  const yearProgress = useMemo(() => {
    const s = startOfYear(viewYear).getTime(), e = startOfNextYear(viewYear).getTime();
    return Math.max(0, Math.min(100, ((now.getTime()-s)/(e-s))*100));
  }, [now, viewYear]);

  const todayProgress = useMemo(() => {
    const s = startOfDay(now).getTime();
    return Math.max(0, Math.min(100, ((now.getTime()-s)/86_400_000)*100));
  }, [now]);

  const today = startOfDay(now);

  const currentWeekIndex = useMemo(() => weeks.findIndex(({ days }) => days.some(d => sameDay(d, today))), [weeks, today]);

  const daysCompleted = useMemo(() => {
    let n = 0;
    for (const { days } of weeks) for (const d of days) if (d.getFullYear()===viewYear && d<today) n++;
    return n;
  }, [weeks, today, viewYear]);
  const totalDays = (startOfNextYear(viewYear).getTime()-startOfYear(viewYear).getTime())/86_400_000;

  const milestonesMap = useMemo(() => {
    const m: Record<string,Milestone> = {};
    for (const ms of milestones) m[ms.date] = ms;
    return m;
  }, [milestones]);

  const nextMilestone = useMemo(() => {
    const todayStr = dateKey(today);
    return milestones.filter(m => m.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date))[0] ?? null;
  }, [milestones, today]);

  const nextMilestoneDays = useMemo(() => {
    if (!nextMilestone) return 0;
    const [y2,m2,d2] = nextMilestone.date.split("-").map(Number) as [number,number,number];
    return daysBetween(today, new Date(y2, m2-1, d2));
  }, [nextMilestone, today]);

  const weekRefs = useRef<Array<HTMLDivElement|null>>([]);
  const didScrollRef = useRef(false);
  useEffect(() => { didScrollRef.current = false; }, [viewYear]);
  useEffect(() => {
    if (didScrollRef.current || currentWeekIndex < 0 || viewYear !== now.getFullYear()) return;
    const el = weekRefs.current[currentWeekIndex];
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); didScrollRef.current = true; }
  }, [currentWeekIndex, viewYear]);

  const dayState = (d: Date): DayState => {
    if (d.getFullYear() !== viewYear) return "out";
    if (sameDay(d, today)) return "today";
    if (d < today) return "past";
    return "future";
  };

  const updateQuarter = (qi: number, next: QuarterConfig) => setConfig(prev => { const q = prev.quarters.slice(); q[qi]=next; return { quarters: q }; });
  const updateBlockLabel = (qi: number, blockId: string, label: string) => setConfig(prev => {
    const q = prev.quarters.slice();
    q[qi] = { blocks: q[qi]!.blocks.map(b => b.id===blockId ? { ...b, label } : b) };
    return { quarters: q };
  });
  const toggleGoal = (blockId: string, goalId: string) => setBlockGoals(prev => {
    const bg = prev[blockId]; if (!bg) return prev;
    return { ...prev, [blockId]: { ...bg, goals: bg.goals.map(g => g.id===goalId ? { ...g, done: !g.done } : g) } };
  });

  // Resolved quarters (color + label derived from meta)
  const resolvedQuarters = useMemo(() =>
    quarterMeta.map(m => resolveQuarter(m, dark)),
  [quarterMeta, dark]);

  const updateQuarterMeta = (qi: number, patch: Partial<QuarterMeta>) =>
    setQuarterMeta(prev => prev.map((m, i) => i===qi ? { ...m, ...patch } : m));

  // Theme-dependent surface values
  const headerBg = dark ? "rgba(22,22,24,0.90)" : "rgba(245,245,247,0.88)";
  const cardBg   = dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)";
  const modalBg  = dark ? "rgba(30,30,32,0.96)" : "rgba(255,255,255,0.93)";
  const overlayBg = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--bg)" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20" style={{ background: headerBg, backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: "1px solid var(--border-soft)" }}>
        <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setViewYear(y => Math.max(MIN_YEAR, y-1))} disabled={viewYear <= MIN_YEAR}
                style={{ width:28, height:28, borderRadius:8, background:overlayBg, border:"1px solid var(--border-soft)", color: viewYear<=MIN_YEAR ? "var(--text-tertiary)" : "var(--text-secondary)", cursor: viewYear<=MIN_YEAR ? "default" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, lineHeight:1, flexShrink:0 }}>‹</button>
              <h1 className="text-2xl sm:text-3xl font-semibold tabular-nums" style={{ color: "var(--text)", letterSpacing: "-0.02em", minWidth:"3.2ch", textAlign:"center" }}>{viewYear}</h1>
              <button onClick={() => setViewYear(y => Math.min(MAX_YEAR, y+1))} disabled={viewYear >= MAX_YEAR}
                style={{ width:28, height:28, borderRadius:8, background:overlayBg, border:"1px solid var(--border-soft)", color: viewYear>=MAX_YEAR ? "var(--text-tertiary)" : "var(--text-secondary)", cursor: viewYear>=MAX_YEAR ? "default" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, lineHeight:1, flexShrink:0 }}>›</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>{yearProgress.toFixed(1)}% complete</span>
              <IconButton title="Milestones" onClick={() => setMilestonePanelOpen(true)} bg={overlayBg}><FlagIcon /></IconButton>
              <IconButton title={dark ? "Light mode" : "Dark mode"} onClick={() => setDark(d => !d)} bg={overlayBg}>
                {dark ? <SunIcon /> : <MoonIcon />}
              </IconButton>
            </div>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden" style={{ background: "var(--border-soft)", borderRadius: 999 }}>
            <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${yearProgress}%`, background: "linear-gradient(90deg,#5ed47b 0%,#34c759 55%,#28a745 100%)", borderRadius: 999 }} />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            <span>{daysCompleted} of {totalDays} days</span>
            <span>{(totalDays-daysCompleted).toFixed(0)} days remaining</span>
          </div>

          {/* Milestone countdown */}
          <AnimatePresence>
            {nextMilestone && (
              <motion.div key="ms-countdown" initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }} className="mt-2">
                <button
                  onClick={() => setMilestonePanelOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{ background: `${nextMilestone.color}1a`, border: `1px solid ${nextMilestone.color}44`, color: nextMilestone.color, cursor: "pointer" }}
                >
                  <span style={{ width:6, height:6, borderRadius:999, background: nextMilestone.color, display:"inline-block", flexShrink:0 }} />
                  <span className="font-semibold">{nextMilestone.label}</span>
                  <span style={{ opacity:0.65 }}>·</span>
                  <span>{nextMilestoneDays === 0 ? "Today!" : `${nextMilestoneDays} day${nextMilestoneDays===1?"":"s"} away`}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sticky weekday labels — spacer = quarter-border(3) + blocksRenderer-px(12/16) + card-border(1) + rows-px(10/12) + week-label(56/64) - row-gap(12/16) */}
          <div className="mt-3 flex items-center gap-3 sm:gap-4">
            <div className="w-[82px] sm:w-[96px] shrink-0" />
            <div className="grid grid-cols-7 gap-2 sm:gap-3 flex-1">
              {WEEKDAYS.map((w,i) => <div key={i} className="text-center text-[10px] font-medium tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>{w}</div>)}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8">

        <LayoutGroup>
          <div className="flex flex-col gap-6">
            {/* Backdrop to close color picker */}
            {colorPickerQi !== null && (
              <div style={{ position:"fixed", inset:0, zIndex:38 }} onClick={() => setColorPickerQi(null)} />
            )}

            {[0,1,2,3].map(qi => {
              const quarter = resolvedQuarters[qi]!;
              const meta = quarterMeta[qi]!;
              const startIndex = qi * WEEKS_PER_QUARTER;
              const qConfig = config.quarters[qi]!;

              // Quarter time progress
              const qWeeks = weeks.slice(startIndex, startIndex + WEEKS_PER_QUARTER);
              const qAllDays = qWeeks.flatMap(w => w.days);
              const qPastDays = qAllDays.filter(d => dayState(d) === "past").length;
              const qHasToday = qAllDays.some(d => dayState(d) === "today");
              const qTotalDays = WEEKS_PER_QUARTER * 7;
              const qCompleted = qPastDays + (qHasToday ? todayProgress / 100 : 0);
              const qPct = Math.max(0, Math.min(100, (qCompleted / qTotalDays) * 100));

              return (
                <motion.section layout key={qi} className="overflow-hidden"
                  style={{ background: dark ? quarter.darkTint : quarter.tint, borderRadius: 18, borderLeft: `3px solid ${quarter.border}` }}
                >
                  {/* Quarter header */}
                  <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-1.5">
                    <div className="flex items-center gap-2">
                      {/* Color swatch */}
                      <div style={{ position:"relative" }}>
                        <button
                          onClick={() => setColorPickerQi(colorPickerQi === qi ? null : qi)}
                          title="Choose color"
                          style={{ width:13, height:13, borderRadius:999, background:quarter.border, border:`2px solid ${dark?"rgba(255,255,255,0.22)":"rgba(0,0,0,0.14)"}`, cursor:"pointer", display:"block", flexShrink:0 }}
                        />
                        <AnimatePresence>
                          {colorPickerQi === qi && (
                            <motion.div
                              initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.94, y:-4 }}
                              transition={{ type:"spring", stiffness:420, damping:28 }}
                              onClick={e => e.stopPropagation()}
                              style={{ position:"absolute", top:"calc(100% + 7px)", left:0, zIndex:40, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.22)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:152 }}
                            >
                              {APPLE_COLORS.map(ac => (
                                <button key={ac.key} onClick={() => { updateQuarterMeta(qi, { colorKey: ac.key }); setColorPickerQi(null); }}
                                  title={ac.label}
                                  style={{ width:20, height:20, borderRadius:999, background: dark ? ac.dark : ac.light, border: meta.colorKey===ac.key ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms ease" }}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Editable quarter name */}
                      <QuarterNameEditor value={meta.name} onChange={name => updateQuarterMeta(qi, { name })} color={quarter.text} />
                      <span className="text-[11px] tabular-nums" style={{ color:"var(--text-tertiary)" }}>Weeks {startIndex+1}–{startIndex+WEEKS_PER_QUARTER}</span>
                    </div>
                    <IconButton title="Configure sprints" onClick={() => setSettingsQuarter(qi)} bg={overlayBg} color={quarter.text}><GearIcon /></IconButton>
                  </div>

                  {/* Quarter progress bar */}
                  <div className="px-4 sm:px-5 pb-2.5">
                    <div className="flex items-center justify-between text-[10px] tabular-nums mb-1">
                      <span style={{ color:"var(--text-tertiary)" }}>Quarter progress</span>
                      <span style={{ color: quarter.text, fontWeight:600 }}>{qPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                      <motion.div initial={false} animate={{ width:`${qPct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                        style={{ height:"100%", background: quarter.border, borderRadius:999, opacity:0.88 }}
                      />
                    </div>
                  </div>

                  <div className="px-3 sm:px-4 pb-2 pt-0 flex flex-col gap-2">
                    <BlocksRenderer
                      qi={qi} quarter={quarter} qConfig={qConfig} startIndex={startIndex}
                      weeks={weeks} currentWeekIndex={currentWeekIndex} todayProgress={todayProgress}
                      dayState={dayState} weekRefs={weekRefs} notes={notes} milestonesMap={milestonesMap}
                      blockGoals={blockGoals} dark={dark} cardBg={cardBg} overlayBg={overlayBg}
                      weekSel={weekSel}
                      onNoteOpen={k => setOpenNote(k)}
                      onLabelChange={(bid, lbl) => updateBlockLabel(qi, bid, lbl)}
                      onGoalToggle={toggleGoal}
                      onEditGoals={bid => setEditGoalsBlockId(bid)}
                      onWeekLabelClick={handleWeekLabelClick}
                    />
                  </div>

                  {/* Sprint-from-selection action bar */}
                  <AnimatePresence>
                    {weekSel && weekSel.qi === qi && (
                      <motion.div
                        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:4 }}
                        transition={{ type:"spring", stiffness:380, damping:28 }}
                        className="mx-3 sm:mx-4 mb-3 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3"
                        style={{ background: dark ? quarter.darkSoft : quarter.soft, border:`1px solid ${quarter.border}55` }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] font-semibold" style={{ color: quarter.text }}>
                            {Math.abs(weekSel.focus - weekSel.anchor) + 1 === 1
                              ? `Week ${Math.min(weekSel.anchor, weekSel.focus) + startIndex + 1}`
                              : `Weeks ${Math.min(weekSel.anchor, weekSel.focus) + startIndex + 1}–${Math.max(weekSel.anchor, weekSel.focus) + startIndex + 1}`
                            }
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                            {Math.abs(weekSel.focus - weekSel.anchor) + 1} week{Math.abs(weekSel.focus - weekSel.anchor) + 1 !== 1 ? "s" : ""} · click another week number to adjust
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setWeekSel(null)}
                            style={{ height:30, paddingInline:12, borderRadius:9, border:`1px solid ${quarter.border}44`, background:"transparent", color:"var(--text-secondary)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                            Cancel
                          </button>
                          <button onClick={() => {
                            const selStart = Math.min(weekSel.anchor, weekSel.focus);
                            const selEnd   = Math.max(weekSel.anchor, weekSel.focus);
                            updateQuarter(qi, createSprintFromSelection(config.quarters[qi]!, selStart, selEnd));
                            setWeekSel(null);
                          }}
                            style={{ height:30, paddingInline:14, borderRadius:9, border:"none", background: quarter.border, color:"white", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${quarter.border}55` }}>
                            Create Sprint
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              );
            })}
          </div>
        </LayoutGroup>

        <footer className="mt-12 pb-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
          Life Calendar · {viewYear}
        </footer>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {settingsQuarter !== null && (
          <SprintSettingsModal
            key="sprint-settings"
            quarterIndex={settingsQuarter} quarter={resolvedQuarters[settingsQuarter]!}
            initial={config.quarters[settingsQuarter]!} dark={dark} modalBg={modalBg}
            onClose={() => setSettingsQuarter(null)}
            onSave={next => { updateQuarter(settingsQuarter, next); setSettingsQuarter(null); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openNote !== null && (
          <NoteModal key="note"
            dateKey={openNote} initial={notes[openNote] ?? ""} dark={dark} modalBg={modalBg}
            onSave={text => { upsertNote(openNote, text); setOpenNote(null); }}
            onClose={() => setOpenNote(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {milestonePanelOpen && (
          <MilestoneModal key="milestones"
            milestones={milestones} dark={dark} modalBg={modalBg}
            onClose={() => setMilestonePanelOpen(false)}
            onChange={m => { setMilestones(m); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editGoalsBlockId !== null && editGoalsBlock !== null && (
          <GoalsModal key="goals"
            blockId={editGoalsBlockId} blockLabel={editGoalsBlock.label}
            initial={blockGoals[editGoalsBlockId] ?? { description:"", goals:[] }}
            dark={dark} modalBg={modalBg}
            onSave={bg => { setBlockGoals(prev => ({ ...prev, [editGoalsBlockId!]: bg })); setEditGoalsBlockId(null); }}
            onClose={() => setEditGoalsBlockId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

function IconButton({ children, onClick, title, bg, color }: { children: React.ReactNode; onClick: () => void; title: string; bg: string; color?: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ width:30, height:30, borderRadius:8, background:bg, border:"1px solid var(--border-soft)", color: color ?? "var(--text-secondary)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}
    >{children}</button>
  );
}

// ─── BlocksRenderer ───────────────────────────────────────────────────────────

function BlocksRenderer({
  qi:_qi, quarter, qConfig, startIndex, weeks, currentWeekIndex, todayProgress,
  dayState, weekRefs, notes, milestonesMap, blockGoals, dark, cardBg, overlayBg,
  weekSel, onNoteOpen, onLabelChange, onGoalToggle, onEditGoals, onWeekLabelClick,
}: {
  qi: number; quarter: Quarter; qConfig: QuarterConfig; startIndex: number;
  weeks: Array<{ weekStart: Date; days: Date[] }>; currentWeekIndex: number; todayProgress: number;
  dayState: (d: Date) => DayState; weekRefs: React.MutableRefObject<Array<HTMLDivElement|null>>;
  notes: Record<string,string>; milestonesMap: Record<string,Milestone>;
  blockGoals: Record<string,BlockGoals>; dark: boolean; cardBg: string; overlayBg: string;
  weekSel: { qi: number; anchor: number; focus: number }|null;
  onNoteOpen: (key: string) => void; onLabelChange: (blockId: string, label: string) => void;
  onGoalToggle: (blockId: string, goalId: string) => void; onEditGoals: (blockId: string) => void;
  onWeekLabelClick: (qi: number, qOffset: number) => void;
}) {
  let cursor = 0;
  const blocks = qConfig.blocks.map(b => { const r = { start:cursor, end:cursor+b.weeks }; cursor+=b.weeks; return { ...b, ...r }; });
  const selMin = weekSel?.qi === _qi ? Math.min(weekSel.anchor, weekSel.focus) : -1;
  const selMax = weekSel?.qi === _qi ? Math.max(weekSel.anchor, weekSel.focus) : -2;
  const hasSelection = weekSel?.qi === _qi;

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {blocks.map(block => {
            const blockRows = weeks.slice(startIndex+block.start, startIndex+block.end);
            const allDays = blockRows.flatMap(r => r.days);
            const pastDays = allDays.filter(d => dayState(d)==="past").length;
            const hasToday = allDays.some(d => dayState(d)==="today");
            const totalDays = block.weeks * 7;
            const completedPortion = pastDays + (hasToday ? todayProgress/100 : 0);
            const timePct = Math.max(0, Math.min(100, (completedPortion/totalDays)*100));

            const bg = blockGoals[block.id];
            const activeGoals = bg?.goals.filter(g => g.text.trim()) ?? [];
            const goalPct = activeGoals.length > 0 ? (activeGoals.filter(g => g.done).length/activeGoals.length)*100 : null;
            const pct = timePct;
            const daysLeft = Math.max(0, totalDays - pastDays - (hasToday ? 1 : 0));
            const isFuture = pastDays===0 && !hasToday;
            const isComplete = pct >= 99.5;
            const effectiveQ = block.color ? resolveQuarter({ name: block.label, colorKey: block.color }, dark) : quarter;
            const softColor = dark ? effectiveQ.darkSoft : effectiveQ.soft;

            return (
              <motion.div layout key={block.id}
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                transition={{ type:"spring", stiffness:320, damping:30 }}
                style={{ background:cardBg, borderRadius:14, border:`1px solid ${softColor}`, backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)", overflow:"hidden" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 sm:px-3.5 pt-2.5 pb-1.5">
                  <BlockLabel value={block.label} onChange={v => onLabelChange(block.id, v)} color={effectiveQ.text} />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onEditGoals(block.id)} title="Sprint goals"
                      style={{ width:22, height:22, borderRadius:6, background:"transparent", border:"none", color: activeGoals.length>0 ? quarter.text : "var(--text-tertiary)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                    ><PencilIcon /></button>
                    <span className="text-[10px] tabular-nums" style={{ color:"var(--text-tertiary)" }}>{block.weeks} {block.weeks===1?"week":"weeks"}</span>
                  </div>
                </div>

                {/* Progress strip */}
                <div className="px-3 sm:px-3.5 pb-2">
                  <div className="flex items-center justify-between text-[10px] tabular-nums mb-1">
                    <span style={{ color:"var(--text-tertiary)" }}>{pastDays} of {totalDays} days</span>
                    <span style={{ color: isComplete ? "var(--apple-green)" : isFuture ? "var(--text-tertiary)" : effectiveQ.text, fontWeight:600 }}>{pct.toFixed(0)}%</span>
                    <span style={{ color:"var(--text-tertiary)" }}>{isComplete ? "done" : `${daysLeft} left`}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                    <motion.div initial={false} animate={{ width:`${pct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                      style={{ height:"100%", background: isComplete ? "linear-gradient(90deg,#5ed47b,#34c759)" : `linear-gradient(90deg,${effectiveQ.text},${effectiveQ.border})`, borderRadius:999, boxShadow: pct>0 ? `0 0 6px ${softColor}` : "none" }}
                    />
                  </div>
                  {goalPct !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" }}>
                        <motion.div initial={false} animate={{ width:`${goalPct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                          style={{ height:"100%", background:effectiveQ.border, borderRadius:999, opacity:0.72 }}
                        />
                      </div>
                      <span className="text-[9px] tabular-nums shrink-0" style={{ color:"var(--text-tertiary)" }}>
                        {activeGoals.filter(g=>g.done).length}/{activeGoals.length} goals
                      </span>
                    </div>
                  )}
                </div>

                {/* Checklist */}
                {activeGoals.length > 0 && (
                  <div className="px-3 sm:px-3.5 pb-2">
                    <div className="flex flex-col gap-1">
                      {activeGoals.map(goal => (
                        <label key={goal.id} className="flex items-start gap-2 cursor-pointer select-none"
                          onClick={() => onGoalToggle(block.id, goal.id)}
                          style={{ color: goal.done ? "var(--text-tertiary)" : "var(--text-secondary)" }}
                        >
                          <div style={{ width:14, height:14, borderRadius:4, flexShrink:0, marginTop:1, background: goal.done ? effectiveQ.border : "transparent", border:`1.5px solid ${goal.done ? effectiveQ.border : "var(--border-soft)"}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 150ms ease", cursor:"pointer" }}>
                            {goal.done && <CheckIcon />}
                          </div>
                          <span className="text-[11px] leading-snug" style={{ textDecoration: goal.done ? "line-through" : "none", opacity: goal.done ? 0.5 : 1 }}>
                            {goal.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sprint description */}
                {bg?.description && (
                  <div className="px-3 sm:px-3.5 pb-2">
                    <p className="text-[11px] leading-snug" style={{ color:"var(--text-tertiary)", borderLeft:`2px solid ${softColor}`, paddingLeft:8 }}>
                      {bg.description}
                    </p>
                  </div>
                )}

                {/* Week rows */}
                <div className="flex flex-col gap-2 sm:gap-2.5 px-2.5 sm:px-3 pb-3 pt-1">
                  {blockRows.map(({ days }, ri) => {
                    const wi = startIndex + block.start + ri;
                    const isCurrent = wi === currentWeekIndex;
                    return (
                      <div key={wi} ref={el => { weekRefs.current[wi] = el; }} className="flex items-center gap-3 sm:gap-4">
                        {(() => {
                          const qOffset = block.start + ri;
                          const isSel = qOffset >= selMin && qOffset <= selMax;
                          const isAnchor = hasSelection && (weekSel!.anchor === qOffset || weekSel!.focus === qOffset);
                          return (
                            <button type="button"
                              onClick={() => onWeekLabelClick(_qi, qOffset)}
                              title={hasSelection ? (isSel ? "Click to move end of selection" : "Extend selection here") : "Click to start sprint selection"}
                              className="w-14 sm:w-16 shrink-0 text-right text-[11px] tabular-nums"
                              style={{
                                color: isSel ? quarter.text : isCurrent ? quarter.text : "var(--text-tertiary)",
                                fontWeight: isSel || isCurrent ? 600 : 500,
                                background: isSel ? (dark ? quarter.darkSoft : quarter.soft) : "transparent",
                                borderRadius: 6,
                                padding: "2px 6px",
                                border: isAnchor ? `1.5px solid ${quarter.border}` : "1.5px solid transparent",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                outline: "none",
                                transition: "background 120ms, border 120ms, color 120ms",
                                opacity: hasSelection && !isSel ? 0.55 : 1,
                              }}
                            >Week {wi+1}</button>
                          );
                        })()}
                        <div className="grid grid-cols-7 gap-2 sm:gap-3 flex-1">
                          {days.map((d, di) => (
                            <DayTile key={di} date={d} state={dayState(d)} todayProgress={todayProgress}
                              note={notes[dateKey(d)]} milestone={milestonesMap[dateKey(d)]}
                              onOpen={() => { if (dayState(d)!=="out") onNoteOpen(dateKey(d)); }}
                            />
                          ))}
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

// ─── QuarterNameEditor ────────────────────────────────────────────────────────

function QuarterNameEditor({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement|null>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  const commit = () => { onChange(draft.trim() || value); setEditing(false); };
  if (editing) {
    return <input ref={ref} value={draft} onChange={e => setDraft(e.target.value.slice(0,20))} onBlur={commit}
      onKeyDown={e => { if (e.key==="Enter") commit(); if (e.key==="Escape") { setDraft(value); setEditing(false); } }}
      className="text-[11px] font-semibold tracking-widest uppercase bg-transparent outline-none"
      style={{ color, borderBottom:`1px solid ${color}`, minWidth:24, maxWidth:120, padding:"1px 2px" }}
    />;
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-[11px] font-semibold tracking-widest uppercase"
      style={{ color }} title="Click to rename"
    >{value}</button>
  );
}

// ─── BlockLabel ───────────────────────────────────────────────────────────────

function BlockLabel({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement|null>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  const commit = () => { onChange(draft.trim() || "Untitled sprint"); setEditing(false); };
  if (editing) {
    return <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key==="Enter") commit(); if (e.key==="Escape") { setDraft(value); setEditing(false); } }}
      className="text-[12px] font-semibold bg-transparent outline-none"
      style={{ color:"var(--text)", borderBottom:`1px solid ${color}`, minWidth:100, padding:"1px 2px" }}
    />;
  }
  return <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold tracking-tight text-left" style={{ color:"var(--text)", letterSpacing:"-0.01em" }} title="Click to rename">{value}</button>;
}

// ─── DayTile ──────────────────────────────────────────────────────────────────

function DayTile({ date, state, todayProgress, note, milestone, onOpen }: {
  date: Date; state: DayState; todayProgress: number;
  note?: string; milestone?: Milestone; onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isOut = state==="out", isPast = state==="past", isToday = state==="today";
  const hasNote = Boolean(note);
  const dayNumber = date.getDate(), monthAbbr = MONTHS[date.getMonth()];

  const base: React.CSSProperties = { borderRadius:12, aspectRatio:"1/1", cursor: isOut?"default":"pointer", transition:"box-shadow 200ms ease", position:"relative" };

  if (isOut) return <div style={{ ...base, background:"transparent", border:"1px dashed var(--border-soft)", opacity:0.35, cursor:"default" }} />;

  const tooltip = hovered && hasNote ? (
    <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)", zIndex:50, background:"rgba(29,29,31,0.96)", backdropFilter:"blur(16px) saturate(180%)", WebkitBackdropFilter:"blur(16px) saturate(180%)", color:"rgba(255,255,255,0.92)", fontSize:12, lineHeight:1.55, borderRadius:12, padding:"10px 12px", whiteSpace:"pre-wrap", width:240, wordBreak:"break-word", boxShadow:"0 8px 32px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.06) inset", border:"1px solid rgba(255,255,255,0.08)", pointerEvents:"none" }}>
      {note}
      <div style={{ position:"absolute", top:"100%", left:"50%", transform:"translateX(-50%)", width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderTop:"6px solid rgba(29,29,31,0.96)" }} />
    </div>
  ) : null;

  const dotColor = (isPast || isToday) ? "#007aff" : "#34c759";
  const dotGlow  = (isPast || isToday) ? "0 0 4px rgba(0,122,255,0.65)" : "0 0 4px rgba(52,199,89,0.65)";
  const noteDot = hasNote ? <div style={{ position:"absolute", top:5, right:5, width:6, height:6, borderRadius:999, background:dotColor, boxShadow:dotGlow, zIndex:5 }} /> : null;

  const msBar = milestone ? <div style={{ position:"absolute", top:0, left:0, right:0, height:3, borderRadius:"12px 12px 0 0", background:milestone.color, zIndex:4, opacity: isPast ? 0.6 : 1 }} /> : null;

  const hov = { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), onClick: onOpen };

  if (isPast) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ ...base, background:"linear-gradient(160deg,#5ed47b 0%,#34c759 60%,#2ab84f 100%)", color:"white", boxShadow: hovered ? "0 2px 8px rgba(40,167,69,0.38), inset 0 0 0 0.5px rgba(255,255,255,0.18)" : "0 1px 2px rgba(40,167,69,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.18)" }} {...hov}>
        {msBar}{tooltip}<Label number={dayNumber} month={monthAbbr} tone="onGreen" />{noteDot}
      </div>
    );
  }
  if (isToday) {
    return (
      <div className="flex flex-col items-center justify-center overflow-hidden" style={{ ...base, background:"var(--surface)", border:"1.5px solid var(--apple-green)", boxShadow: hovered ? "0 0 0 4px rgba(52,199,89,0.18),0 4px 18px rgba(52,199,89,0.28)" : "0 0 0 4px rgba(52,199,89,0.12),0 4px 14px rgba(52,199,89,0.18)", color:"var(--text)" }} {...hov}>
        {msBar}{tooltip}
        <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out" style={{ height:`${todayProgress}%`, background:"linear-gradient(180deg,rgba(94,212,123,0.85) 0%,#34c759 100%)" }} />
        <div className="relative z-10 flex flex-col items-center justify-center"><Label number={dayNumber} month={monthAbbr} tone="auto" /></div>
        {noteDot}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center" style={{ ...base, background:"var(--surface)", border:"1px solid var(--border-soft)", color:"var(--text-secondary)", boxShadow: hovered ? "0 2px 10px rgba(0,0,0,0.08)" : "0 1px 1px rgba(0,0,0,0.02)" }} {...hov}>
      {msBar}{tooltip}<Label number={dayNumber} month={monthAbbr} tone="muted" />{noteDot}
    </div>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ number, month, tone }: { number: number; month: string; tone: "onGreen"|"muted"|"auto" }) {
  const nc = tone==="onGreen" ? "white" : "var(--text)";
  const mc = tone==="onGreen" ? "rgba(255,255,255,0.85)" : tone==="muted" ? "var(--text-tertiary)" : "var(--text-secondary)";
  return (
    <div className="flex flex-col items-center justify-center leading-none select-none">
      <div className="text-base sm:text-lg font-semibold tabular-nums" style={{ color:nc, letterSpacing:"-0.02em" }}>{number}</div>
      <div className="mt-1 text-[9px] sm:text-[10px] font-medium tracking-widest" style={{ color:mc }}>{month}</div>
    </div>
  );
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({ dateKey: dk, initial, dark, modalBg, onSave, onClose }: {
  dateKey: string; initial: string; dark: boolean; modalBg: string;
  onSave: (text: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const areaRef = useRef<HTMLTextAreaElement|null>(null);
  useEffect(() => { areaRef.current?.focus(); }, []);
  const [y, m, d] = dk.split("-").map(Number) as [number,number,number];
  const label = new Date(y, m-1, d).toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
  const handleKey = (e: React.KeyboardEvent) => { if (e.key==="Escape") onClose(); if ((e.metaKey||e.ctrlKey) && e.key==="Enter") onSave(text); };
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background:"rgba(0,0,0,0.30)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)" }}
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0, scale:0.95, y:12 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.96, y:8 }}
        transition={{ type:"spring", stiffness:380, damping:30 }} onClick={e => e.stopPropagation()}
        style={{ width:"min(90vw,380px)", background:modalBg, backdropFilter:"saturate(180%) blur(24px)", WebkitBackdropFilter:"saturate(180%) blur(24px)", borderRadius:20, boxShadow:"0 8px 40px rgba(0,0,0,0.22)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden" }}
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"var(--text-tertiary)" }}>Day Note</div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-tight" style={{ color:"var(--text)" }}>{label}</div>
          </div>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer" }}>✕</button>
        </div>
        <div className="px-5 pb-2">
          <textarea ref={areaRef} value={text} onChange={e => setText(e.target.value.slice(0,320))} onKeyDown={handleKey}
            placeholder="Add a note, emoji, or reflection… ✨" maxLength={320} rows={4}
            style={{ width:"100%", resize:"none", outline:"none", border:`1px solid ${borderColor}`, borderRadius:12, padding:"10px 12px", fontSize:14, lineHeight:1.55, fontFamily:"inherit", background: dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.7)", color:"var(--text)", boxSizing:"border-box" }}
          />
          <div className="text-right text-[10px] tabular-nums mt-1" style={{ color:"var(--text-tertiary)" }}>{text.length} / 320</div>
        </div>
        <div className="px-5 pb-5 flex gap-2.5">
          {initial && <button onClick={() => onSave("")} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${borderColor}`, background:"rgba(255,59,48,0.08)", color:"#ff3b30", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Clear</button>}
          <button onClick={onClose} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          <button onClick={() => onSave(text)} style={{ flex:2, height:36, borderRadius:10, border:"none", background:"linear-gradient(135deg,#5ed47b 0%,#34c759 100%)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 8px rgba(52,199,89,0.35)" }}>Save <span style={{ opacity:0.65, fontSize:11 }}>⌘↵</span></button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── MilestoneModal ───────────────────────────────────────────────────────────

function MilestoneModal({ milestones, dark, modalBg, onClose, onChange }: {
  milestones: Milestone[]; dark: boolean; modalBg: string;
  onClose: () => void; onChange: (m: Milestone[]) => void;
}) {
  const [items, setItems] = useState<Milestone[]>(() => [...milestones].sort((a,b) => a.date.localeCompare(b.date)));
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDate, setDraftDate] = useState(dateKey(new Date()));
  const [draftColor, setDraftColor] = useState(MILESTONE_COLORS[4]!);
  const [draftDesc, setDraftDesc] = useState("");

  const add = () => {
    if (!draftLabel.trim()) return;
    setItems(prev => [...prev, { id:makeId(), label:draftLabel.trim(), date:draftDate, color:draftColor, description:draftDesc.trim()||undefined }].sort((a,b)=>a.date.localeCompare(b.date)));
    setDraftLabel("");
    setDraftDesc("");
  };

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputStyle: React.CSSProperties = { background: dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.03)", border:`1px solid ${borderColor}`, borderRadius:8, padding:"7px 10px", fontSize:13, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.34)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0, scale:0.96, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:8 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md"
        style={{ background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)", borderRadius:22, boxShadow:"0 24px 70px rgba(0,0,0,0.24)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden" }}
      >
        <div className="px-6 pt-6 pb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color:"var(--text)", letterSpacing:"-0.01em" }}>Milestones</h2>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer" }}>✕</button>
        </div>

        {/* Color picker + add form */}
        <div className="px-6 pb-4">
          <div className="flex gap-1.5 mb-2.5 flex-wrap">
            {MILESTONE_COLORS.map(c => (
              <button key={c} onClick={() => setDraftColor(c)}
                style={{ width:18, height:18, borderRadius:999, background:c, border: draftColor===c ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms ease" }}
              />
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input value={draftLabel} onChange={e => setDraftLabel(e.target.value)} placeholder="Label…"
              onKeyDown={e => { if (e.key==="Enter") add(); }}
              style={{ ...inputStyle, flex:2, width:"auto" }}
            />
            <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)}
              style={{ ...inputStyle, flex:1, width:"auto" }}
            />
            <button onClick={add} disabled={!draftLabel.trim()}
              style={{ height:36, paddingInline:14, borderRadius:9, background: draftLabel.trim()?"#007aff":"rgba(128,128,128,0.15)", color: draftLabel.trim()?"white":"var(--text-tertiary)", fontSize:13, fontWeight:600, border:"none", cursor: draftLabel.trim()?"pointer":"default", fontFamily:"inherit", flexShrink:0, transition:"background 150ms" }}>
              Add
            </button>
          </div>
          <div style={{ position:"relative" }}>
            <textarea value={draftDesc} onChange={e => setDraftDesc(e.target.value.slice(0,300))}
              placeholder="Description (optional, up to 300 chars)…" rows={2}
              style={{ ...inputStyle, width:"100%", resize:"none", lineHeight:1.5, borderRadius:10, padding:"8px 10px", paddingBottom:18 }}
            />
            <span style={{ position:"absolute", bottom:6, right:10, fontSize:10, color:"var(--text-tertiary)", pointerEvents:"none" }}>
              {draftDesc.length}/300
            </span>
          </div>
        </div>

        {/* List */}
        <div className="px-6 max-h-56 overflow-y-auto">
          {items.length === 0 && (
            <div className="py-6 text-center text-[13px]" style={{ color:"var(--text-tertiary)" }}>No milestones yet. Add one above.</div>
          )}
          <div className="flex flex-col gap-1.5 pb-3">
            {items.map(ms => {
              const [y2,m2,d2] = ms.date.split("-").map(Number) as [number,number,number];
              const lbl = new Date(y2,m2-1,d2).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
              return (
                <div key={ms.id} className="flex flex-col gap-1 px-2.5 py-2 rounded-xl"
                  style={{ background: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.025)", border:`1px solid ${borderColor}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div style={{ width:10, height:10, borderRadius:999, background:ms.color, flexShrink:0 }} />
                    <span className="flex-1 text-[13px] font-medium" style={{ color:"var(--text)" }}>{ms.label}</span>
                    <span className="text-[11px] tabular-nums" style={{ color:"var(--text-tertiary)" }}>{lbl}</span>
                    <button onClick={() => setItems(prev => prev.filter(x => x.id!==ms.id))}
                      style={{ color:"#ff3b30", background:"none", border:"none", cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 2px" }}>×</button>
                  </div>
                  {ms.description && (
                    <p className="text-[11px] leading-snug ml-5" style={{ color:"var(--text-tertiary)", margin:0 }}>{ms.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 flex gap-2.5 justify-end" style={{ borderTop:`1px solid ${borderColor}` }}>
          <button onClick={onClose} style={{ height:36, paddingInline:16, borderRadius:10, border:"1px solid var(--border-soft)", background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          <button onClick={() => { onChange(items); onClose(); }}
            style={{ height:36, paddingInline:20, borderRadius:10, border:"none", background:"linear-gradient(135deg,#5ed47b 0%,#34c759 100%)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 8px rgba(52,199,89,0.35)" }}>Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── GoalsModal ───────────────────────────────────────────────────────────────

function GoalsModal({ blockId:_bid, blockLabel, initial, dark, modalBg, onSave, onClose }: {
  blockId: string; blockLabel: string; initial: BlockGoals; dark: boolean; modalBg: string;
  onSave: (bg: BlockGoals) => void; onClose: () => void;
}) {
  const [description, setDescription] = useState(initial.description);
  const [goals, setGoals] = useState<Goal[]>(() => initial.goals.length > 0 ? initial.goals.map(g=>({...g})) : [{ id:makeId(), text:"", done:false }]);
  const activeGoals = goals.filter(g => g.text.trim());
  const canAdd = goals.length < 5;

  const save = () => onSave({ description:description.trim(), goals: goals.filter(g=>g.text.trim()) });

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.03)";

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.32)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0, scale:0.96, y:12 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:8 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-sm"
        style={{ background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)", borderRadius:22, boxShadow:"0 24px 70px rgba(0,0,0,0.22)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden" }}
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"var(--text-tertiary)" }}>Sprint Goals</div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-tight" style={{ color:"var(--text)" }}>{blockLabel}</div>
          </div>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer" }}>✕</button>
        </div>

        <div className="px-5 pb-3">
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0,200))}
            placeholder="Sprint description (optional)…" rows={2}
            style={{ width:"100%", resize:"none", outline:"none", border:`1px solid ${borderColor}`, borderRadius:10, padding:"8px 10px", fontSize:13, lineHeight:1.5, fontFamily:"inherit", background:inputBg, color:"var(--text)", boxSizing:"border-box" }}
          />
        </div>

        <div className="px-5 pb-3">
          <div className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color:"var(--text-tertiary)" }}>
            Goals ({activeGoals.length}/5)
          </div>
          <div className="flex flex-col gap-1.5">
            {goals.map((g, idx) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className="text-[11px] tabular-nums w-4 text-right shrink-0" style={{ color:"var(--text-tertiary)" }}>{idx+1}.</span>
                <input value={g.text} onChange={e => setGoals(prev => prev.map(x => x.id===g.id ? { ...x, text:e.target.value } : x))}
                  placeholder={`Goal ${idx+1}`}
                  style={{ flex:1, background:inputBg, border:`1px solid ${borderColor}`, borderRadius:8, padding:"6px 9px", fontSize:13, color:"var(--text)", outline:"none", fontFamily:"inherit" }}
                />
                <button onClick={() => setGoals(prev => prev.filter(x => x.id!==g.id))} disabled={goals.length===1}
                  style={{ color: goals.length===1?"var(--text-tertiary)":"#ff3b30", background:"none", border:"none", cursor: goals.length===1?"default":"pointer", fontSize:18, lineHeight:1, opacity: goals.length===1?0.3:1, padding:"0 2px", flexShrink:0 }}>×</button>
              </div>
            ))}
          </div>
          {canAdd && (
            <button onClick={() => setGoals(prev => [...prev, { id:makeId(), text:"", done:false }])}
              className="mt-2 text-[12px] font-medium"
              style={{ padding:"5px 10px", borderRadius:8, background:"rgba(0,122,255,0.09)", color:"#007aff", border:"1px solid rgba(0,122,255,0.18)", cursor:"pointer", fontFamily:"inherit" }}>
              + Add goal
            </button>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2.5">
          <button onClick={onClose} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          <button onClick={save} style={{ flex:2, height:36, borderRadius:10, border:"none", background:"linear-gradient(135deg,#5ed47b 0%,#34c759 100%)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 8px rgba(52,199,89,0.35)" }}>Save goals</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── SprintSettingsModal ──────────────────────────────────────────────────────

function SprintSettingsModal({ quarterIndex:_qi, quarter, initial, dark, modalBg, onClose, onSave }: {
  quarterIndex: number; quarter: Quarter; initial: QuarterConfig; dark: boolean; modalBg: string;
  onClose: () => void; onSave: (next: QuarterConfig) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => initial.blocks.map(b => ({ ...b })));
  const total = blocks.reduce((a,b) => a+(Number(b.weeks)||0), 0);
  const remaining = WEEKS_PER_QUARTER - total;
  const valid = total===WEEKS_PER_QUARTER && blocks.every(b => b.weeks>=1);
  const update = (id: string, patch: Partial<Block>) => setBlocks(prev => prev.map(b => b.id===id ? { ...b, ...patch } : b));
  const applyPreset = (parts: number[]) => setBlocks(parts.map((w,i) => ({ id:makeId(), weeks:w, label:`Sprint ${i+1}` })));
  const [colorPickerId, setColorPickerId] = useState<string|null>(null);

  const borderColor = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(20,20,25,0.38)", backdropFilter:"blur(14px) saturate(160%)", WebkitBackdropFilter:"blur(14px) saturate(160%)" }}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.18 }}
      onClick={onClose}
    >
      <motion.div onClick={e => e.stopPropagation()} initial={{ opacity:0, scale:0.96, y:8 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:4 }}
        transition={{ type:"spring", stiffness:360, damping:32 }} className="w-full max-w-md"
        style={{ background:modalBg, backdropFilter:"blur(30px) saturate(180%)", WebkitBackdropFilter:"blur(30px) saturate(180%)", borderRadius:22, boxShadow:"0 30px 80px rgba(0,0,0,0.22)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.6)"}` }}
      >
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ color:quarter.text, background: dark?quarter.darkTint:quarter.tint, border:`1px solid ${dark?quarter.darkSoft:quarter.soft}` }}>{quarter.label}</span>
            <h2 className="text-base font-semibold tracking-tight" style={{ color:"var(--text)", letterSpacing:"-0.01em" }}>Sprint configuration</h2>
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color:"var(--text-secondary)" }}>Group the 13 weeks of {quarter.label} into sprints.</p>
        </div>

        <div className="px-6">
          <div className="flex flex-wrap gap-1.5">
            {[{n:"1 × 13",p:[13]},{n:"2+2+2+2+2+2+1",p:[2,2,2,2,2,2,1]},{n:"3+3+3+4",p:[3,3,3,4]},{n:"4+4+5",p:[4,4,5]},{n:"6+7",p:[6,7]}].map(x => (
              <button key={x.n} onClick={() => applyPreset(x.p)} type="button" className="text-[11px] tabular-nums"
                style={{ padding:"5px 10px", borderRadius:999, background: dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.04)", color:"var(--text-secondary)", border:`1px solid ${borderColor}` }}>
                {x.n}
              </button>
            ))}
          </div>
        </div>

        {colorPickerId !== null && <div style={{ position:"fixed", inset:0, zIndex:49 }} onClick={() => setColorPickerId(null)} />}
        <div className="px-6 mt-4 max-h-72 overflow-auto">
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {blocks.map((b, idx) => {
                const bAc = b.color ? APPLE_COLORS.find(c => c.key === b.color) : null;
                const bHex = bAc ? (dark ? bAc.dark : bAc.light) : (dark ? quarter.darkSoft : quarter.soft);
                return (
                <motion.div layout key={b.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                  className="flex items-center gap-2" style={{ position:"relative" }}
                >
                  <div style={{ background: dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.025)", border:`1px solid ${borderColor}`, borderRadius:12, padding:"8px 10px", display:"flex", alignItems:"center", gap:8, flex:1 }}>
                    {/* Color dot */}
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <button type="button" onClick={() => setColorPickerId(colorPickerId === b.id ? null : b.id)}
                        title="Sprint color"
                        style={{ width:16, height:16, borderRadius:999, background: bHex, border:`2px solid ${dark?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.12)"}`, cursor:"pointer", display:"block" }}
                      />
                      <AnimatePresence>
                        {colorPickerId === b.id && (
                          <motion.div initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.94, y:-4 }}
                            transition={{ type:"spring", stiffness:420, damping:28 }}
                            onClick={e => e.stopPropagation()}
                            style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:55, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.26)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:160 }}
                          >
                            <button type="button" onClick={() => { update(b.id, { color: undefined }); setColorPickerId(null); }}
                              title="Quarter default"
                              style={{ width:20, height:20, borderRadius:999, background:"transparent", border: !b.color ? "2.5px solid var(--text)" : "2.5px solid var(--border-soft)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--text-tertiary)" }}>✕</button>
                            {APPLE_COLORS.map(ac => (
                              <button key={ac.key} type="button" onClick={() => { update(b.id, { color: ac.key }); setColorPickerId(null); }}
                                title={ac.label}
                                style={{ width:20, height:20, borderRadius:999, background: dark ? ac.dark : ac.light, border: b.color===ac.key ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms ease" }}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {/* Number badge */}
                    <div className="text-[10px] font-semibold tabular-nums flex items-center justify-center"
                      style={{ width:20, height:20, borderRadius:999, background: bAc ? `${bHex}22` : (dark?quarter.darkTint:quarter.tint), color: bAc ? bHex : quarter.text, flexShrink:0 }}>{idx+1}</div>
                    <input type="text" value={b.label} onChange={e => update(b.id, { label:e.target.value })} placeholder="Sprint label"
                      className="flex-1 bg-transparent outline-none text-[13px]" style={{ color:"var(--text)" }} />
                    <div className="flex items-center gap-1" style={{ background: dark?"rgba(255,255,255,0.06)":"white", border:`1px solid ${borderColor}`, borderRadius:8, padding:2 }}>
                      <button type="button" onClick={() => update(b.id, { weeks:Math.max(1,b.weeks-1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color:"var(--text-secondary)" }}>−</button>
                      <span className="text-[12px] font-semibold tabular-nums w-6 text-center" style={{ color:"var(--text)" }}>{b.weeks}</span>
                      <button type="button" onClick={() => update(b.id, { weeks:Math.min(WEEKS_PER_QUARTER,b.weeks+1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color:"var(--text-secondary)" }}>+</button>
                    </div>
                    <button type="button" onClick={() => setBlocks(prev => prev.filter(x => x.id!==b.id))} disabled={blocks.length===1}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ color: blocks.length===1?"var(--text-tertiary)":"#ff3b30", opacity: blocks.length===1?0.4:1 }}>
                      <TrashIcon />
                    </button>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
            <button type="button" onClick={() => setBlocks(prev => [...prev, { id:makeId(), weeks:Math.max(1,remaining>0?remaining:1), label:`Sprint ${prev.length+1}` }])}
              disabled={remaining<1} className="text-[12px] font-medium mt-1 self-start"
              style={{ padding:"6px 12px", borderRadius:10, color: remaining<1?"var(--text-tertiary)":quarter.text, background: remaining<1?(dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)"):(dark?quarter.darkTint:quarter.tint), border:`1px solid ${remaining<1?borderColor:(dark?quarter.darkSoft:quarter.soft)}`, opacity: remaining<1?0.6:1 }}>
              + Add sprint
            </button>
          </div>
        </div>

        <div className="px-6 mt-4">
          <div className="flex items-center justify-between text-[12px] tabular-nums px-3 py-2.5 rounded-xl"
            style={{ background: valid?"rgba(52,199,89,0.08)":"rgba(255,59,48,0.07)", color: valid?"#28a745":"#c00", border:`1px solid ${valid?"rgba(52,199,89,0.2)":"rgba(255,59,48,0.2)"}` }}>
            <span>Total: {total} / {WEEKS_PER_QUARTER} weeks</span>
            <span>{valid ? "Looks good" : remaining>0 ? `${remaining} week${remaining===1?"":"s"} unassigned` : `${-remaining} week${-remaining===1?"":"s"} over`}</span>
          </div>
        </div>

        <div className="px-6 py-5 mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-[13px] font-medium"
            style={{ padding:"8px 14px", borderRadius:10, color:"var(--text-secondary)", background:"transparent" }}>Cancel</button>
          <button type="button" onClick={() => valid && onSave({ blocks })} disabled={!valid} className="text-[13px] font-semibold"
            style={{ padding:"8px 16px", borderRadius:10, color:"white", background: valid?"linear-gradient(180deg,#5ed47b 0%,#34c759 100%)":"rgba(128,128,128,0.2)", boxShadow: valid?"0 1px 2px rgba(40,167,69,0.25)":"none", cursor: valid?"pointer":"not-allowed" }}>
            Save sprints
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GearIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
}
function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}
function FlagIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
}
function PencilIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function CheckIcon() {
  return <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="2 6 5 9 10 3"/></svg>;
}

export default App;
