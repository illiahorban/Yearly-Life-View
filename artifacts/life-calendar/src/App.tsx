import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
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

const _JUMP_EN_FULL = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const _JUMP_EN_SHORT = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const _JUMP_RU_FULL = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const _JUMP_RU_GEN  = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const _JUMP_RU_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function _jumpFindMonth(name: string): number {
  const n = name.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (_JUMP_EN_FULL[i]===n || _JUMP_EN_SHORT[i]===n || _JUMP_RU_FULL[i]===n || _JUMP_RU_GEN[i]===n || _JUMP_RU_SHORT[i]===n) return i;
  }
  return -1;
}
function parseDateQuery(s: string): Date | null {
  const q = s.trim();
  if (q.length < 3) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const d = new Date(q + "T00:00:00"); return isNaN(d.getTime()) ? null : d;
  }
  const numMatch = q.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (numMatch) {
    const day = parseInt(numMatch[1]), month = parseInt(numMatch[2]) - 1;
    let year = new Date().getFullYear();
    if (numMatch[3]) year = numMatch[3].length === 2 ? 2000 + parseInt(numMatch[3]) : parseInt(numMatch[3]);
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = new Date(year, month, day);
    return (d.getDate()===day && d.getMonth()===month) ? d : null;
  }
  const lower = q.toLowerCase();
  const dmY = lower.match(/^(\d{1,2})\s+([a-zа-яё]+)(?:[,\s]+(\d{4}))?$/);
  if (dmY) {
    const day = parseInt(dmY[1]), mi = _jumpFindMonth(dmY[2]), year = dmY[3] ? parseInt(dmY[3]) : new Date().getFullYear();
    if (mi===-1 || day<1 || day>31) return null;
    const d = new Date(year, mi, day);
    return (d.getDate()===day && d.getMonth()===mi) ? d : null;
  }
  const mdY = lower.match(/^([a-zа-яё]+)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/);
  if (mdY) {
    const mi = _jumpFindMonth(mdY[1]), day = parseInt(mdY[2]), year = mdY[3] ? parseInt(mdY[3]) : new Date().getFullYear();
    if (mi===-1 || day<1 || day>31) return null;
    const d = new Date(year, mi, day);
    return (d.getDate()===day && d.getMonth()===mi) ? d : null;
  }
  return null;
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

type Lang = "en" | "ru";
const MONTHS_I18N: Record<Lang, string[]> = {
  en: ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"],
  ru: ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"],
};
const WEEKDAYS_I18N: Record<Lang, string[]> = {
  en: ["M","T","W","T","F","S","S"],
  ru: ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],
};
const I18N: Record<Lang, Record<string, string>> = {
  en: {
    complete:"complete", daysOf:"days", of:"of", daysRemaining:"days remaining",
    milestones:"Milestones", darkMode:"Dark mode", lightMode:"Light mode",
    lifeCalendarBtn:"Life Calendar", quarterProgress:"Quarter progress", expandFullscreen:"Expand to fullscreen", collapseFullscreen:"Collapse",
    search:"Search", searchPlaceholder:"Search notes and events…", searchResults:"results", searchNoResults:"No matches found", jumpTo:"Jump to",
    dayNotes:"Day Notes", eventsAndNotes:"Events & Notes", events:"Events",
    note:"Note", addNote:"Add note", addEvent:"Add event", addEventBtn:"Add event", save:"Save",
    notePlaceholder:"Add a note, emoji, or reflection… ✨", anotherNote:"Another note…",
    remove:"Remove", noMilestones:"No milestones yet. Add one above.",
    labelPlaceholder:"Label…", add:"Add",
    descPlaceholder:"Description (optional, up to 300 chars)…",
    repeatYearly:"↻ Repeat yearly", cancel:"Cancel", saveChanges:"Save changes",
    editDescPlaceholder:"Description (optional)…", footerBase:"Life Calendar",
    today:"Today", week:"Week", done:"done", left:"left", goals:"goals",
    sprintGoals:"Sprint Goals", addGoal:"Add goal", saveGoals:"Save goals", goalsLabel:"Goals", goalPlaceholder:"Goal", sprintDescPlaceholder:"Sprint description (optional)…",
    overview:"Overview", dateOfBirth:"Date of Birth", lifeExpectancy:"Life Expectancy",
    years:"Years", months:"Months", weeks:"Weeks", days:"Days", elapsed:"elapsed",
    yr:"yr", mo:"mo", remaining:"remaining", born:"Born", age:"Age",
    sprintConfig:"Sprint configuration", sprintConfigDescription:"Group the 13 weeks of {quarter} into sprints.", saveSprints:"Save sprints", addSprint:"Add sprint",
    looksGood:"Looks good", unassigned:"unassigned", over:"over", total:"Total",
    q1:"Q1", q2:"Q2", q3:"Q3", q4:"Q4", todayCountdown:"Today!", daysShort:"d",
    chooseColor: "Choose color",
    noColor: "No color",
    clickToRename: "Click to rename",
    edit: "Edit",
    switchToRussian: "Switch to Russian",
    switchToEnglish: "Switch to English",
    sprintColor: "Sprint color",
    quarterDefault: "Quarter default",
    clickStartSprintSelection: "Click to start sprint selection",
    clickMoveEndSelection: "Click to move end of selection",
    extendSelectionHere: "Extend selection here",
    createSprint: "Create Sprint",
    clickWeekToAdjust: "click week number to adjust",
    sprintLabel: "Sprint",
    allWeeks: "All weeks",
    enterBirthDate: "Enter your date of birth",
    birthDateSubtitle: "We'll map your life's journey across time",
    resetSprint: "Reset sprint",
    resetSprintConfirm: "This will permanently delete all notes, goals and events for this sprint. This cannot be undone.",
    resetSprintBtn: "Reset",
    settings: "Settings",
    sprintLabelPlaceholder: "Sprint label",
    deleteSprint: "Delete sprint",
    deleteSprintConfirm: "Are you sure you want to delete this sprint? Its weeks will be unassigned.",
    deleteSprintBtn: "Delete",
    factoryReset: "Factory reset",
    factoryResetWarn1Title: "Step 1 of 2",
    factoryResetWarn1: "All notes, goals and events will be permanently deleted. This cannot be undone.",
    factoryResetWarn2Title: "Step 2 of 2",
    factoryResetWarn2: "All sprint configurations, labels and colors will be reset to defaults.",
    factoryResetBtn: "Reset everything",
    nextStep: "Next →",
    back: "← Back",
    allNotes: "All Notes",
    noNotesInQuarter: "No notes",
    noNotesAtAll: "No notes yet. Click a day or use + to add one.",
    notesPanel: "Notes",
    notesSearchPlaceholder: "Search notes…",
    eventsSearchPlaceholder: "Search events…",
    addNotePickDate: "Choose a date:",
    openNote: "Open",
  },
  ru: {
    complete:"выполнено", daysOf:"дней", of:"из", daysRemaining:"дней осталось",
    milestones:"События", darkMode:"Тёмная тема", lightMode:"Светлая тема",
    lifeCalendarBtn:"Календарь жизни", quarterProgress:"Прогресс квартала", expandFullscreen:"Развернуть на весь экран", collapseFullscreen:"Свернуть",
    search:"Поиск", searchPlaceholder:"Поиск по заметкам и событиям…", searchResults:"совпадений", searchNoResults:"Ничего не найдено", jumpTo:"Перейти к",
    dayNotes:"Заметки", eventsAndNotes:"События и заметки", events:"События",
    note:"Заметка", addNote:"Добавить заметку", addEvent:"Добавить событие", addEventBtn:"Добавить событие", save:"Сохранить",
    notePlaceholder:"Заметка, мысль или эмодзи… ✨", anotherNote:"Ещё заметка…",
    remove:"Удалить", noMilestones:"Нет событий. Добавьте выше.",
    labelPlaceholder:"Название…", add:"Добавить",
    descPlaceholder:"Описание (необязательно, до 300 символов)…",
    repeatYearly:"↻ Повторять ежегодно", cancel:"Отмена", saveChanges:"Сохранить",
    editDescPlaceholder:"Описание (необязательно)…", footerBase:"Календарь жизни",
    today:"Сегодня", week:"Неделя", done:"готово", left:"осталось", goals:"целей",
    sprintGoals:"Цели спринта", addGoal:"Добавить цель", saveGoals:"Сохранить цели", goalsLabel:"Цели", goalPlaceholder:"Цель", sprintDescPlaceholder:"Описание спринта (необязательно)…",
    overview:"Обзор", dateOfBirth:"Дата рождения", lifeExpectancy:"Продолж. жизни",
    years:"Годы", months:"Месяцы", weeks:"Недели", days:"Дни", elapsed:"прожито",
    yr:"лет", mo:"мес", remaining:"осталось", born:"Рождён(а)", age:"Возраст",
    sprintConfig:"Настройка спринтов", sprintConfigDescription:"Сгруппируйте 13 недель {quarter} в спринты.", saveSprints:"Сохранить", addSprint:"Спринт",
    looksGood:"Отлично", unassigned:"не распределено", over:"лишних", total:"Итого",
    q1:"К1", q2:"К2", q3:"К3", q4:"К4", todayCountdown:"Сегодня!", daysShort:"д",
    chooseColor: "Выбрать цвет",
    noColor: "Без цвета",
    clickToRename: "Нажмите для переименования",
    edit: "Изменить",
    switchToRussian: "Переключить на русский",
    switchToEnglish: "Переключить на английский",
    sprintColor: "Цвет спринта",
    quarterDefault: "По умолчанию для квартала",
    clickStartSprintSelection: "Нажмите, чтобы начать выбор спринта",
    clickMoveEndSelection: "Нажмите, чтобы переместить конец выделения",
    extendSelectionHere: "Расширить выделение здесь",
    createSprint: "Создать спринт",
    clickWeekToAdjust: "нажмите номер недели",
    sprintLabel: "Спринт",
    allWeeks: "Все недели",
    enterBirthDate: "Введите дату рождения",
    birthDateSubtitle: "Мы покажем ваш жизненный путь во времени",
    resetSprint: "Сбросить спринт",
    resetSprintConfirm: "Все заметки, цели и события этого спринта будут удалены без возможности восстановления.",
    resetSprintBtn: "Сбросить",
    settings: "Настройки",
    sprintLabelPlaceholder: "Название спринта",
    deleteSprint: "Удалить спринт",
    deleteSprintConfirm: "Вы уверены, что хотите удалить этот спринт? Его недели станут нераспределёнными.",
    deleteSprintBtn: "Удалить",
    factoryReset: "Сброс к заводским",
    factoryResetWarn1Title: "Шаг 1 из 2",
    factoryResetWarn1: "Все заметки, цели и события будут удалены без возможности восстановления.",
    factoryResetWarn2Title: "Шаг 2 из 2",
    factoryResetWarn2: "Все спринты, их названия и цвета будут сброшены до настроек по умолчанию.",
    factoryResetBtn: "Сбросить всё",
    nextStep: "Далее →",
    back: "← Назад",
    allNotes: "Все заметки",
    noNotesInQuarter: "Нет заметок",
    noNotesAtAll: "Заметок пока нет. Нажмите на день или используйте + для добавления.",
    notesPanel: "Заметки",
    notesSearchPlaceholder: "Поиск по заметкам…",
    eventsSearchPlaceholder: "Поиск по событиям…",
    addNotePickDate: "Выберите дату:",
    openNote: "Открыть",
  },
};
type LangCtx = { t: (k: string) => string; months: string[]; weekdays: string[]; lang: Lang };
const LangContext = React.createContext<LangCtx>({ t: k => I18N.en[k] ?? k, months: MONTHS_I18N.en, weekdays: WEEKDAYS_I18N.en, lang: "en" });
const WEEKS_PER_QUARTER = 13;
const TOTAL_WEEKS = 52;

type Quarter = { key: AppleColorKey; label: string; tint: string; darkTint: string; border: string; text: string; soft: string; darkSoft: string };
type Block = { id: string; weeks: number; label: string; color?: AppleColorKey };
type QuarterConfig = { blocks: Block[] };
type CalendarConfig = { quarters: QuarterConfig[] };
type DayState = "past" | "today" | "future" | "out";
type Milestone = { id: string; label: string; date: string; color: string; description?: string; recurring?: boolean };
type Goal = { id: string; text: string; done: boolean };
type BlockGoals = { description: string; goals: Goal[] };
type NoteEntry = { id: string; text: string; createdAt: number; color?: string };
type LifeSettings = { birthDate: string; lifespan: number };
type LifeView = "years" | "months" | "weeks" | "days";

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
  { key:"black",  label:"Black",  light:"#1c1c1e", dark:"#3a3a3c" },
  { key:"grey",   label:"Grey",   light:"#8e8e93", dark:"#636366" },
  { key:"white",  label:"White",  light:"#c7c7cc", dark:"#ebebf5" },
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

// ─── Color helpers: RGB <-> HSL and saturation adjust ──────────────────────
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function saturateRgbaString(rgba: string, factor: number) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!m) return rgba;
  const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  const { h, s, l } = rgbToHsl(r, g, b);
  const ns = Math.min(1, s * factor);
  const [nr, ng, nb] = hslToRgb(h, ns, l);
  return `rgba(${nr},${ng},${nb},${a})`;
}

const LIGHT_SAT_FACTOR = 1.2;
function hexSaturate(hex: string, factor: number) {
  const [r,g,b] = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r,g,b);
  const ns = Math.min(1, s * factor);
  const [nr, ng, nb] = hslToRgb(h, ns, l);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

function resolveQuarter(meta: QuarterMeta, dark: boolean): Quarter {
  const ac = APPLE_COLORS.find(c => c.key === meta.colorKey) ?? APPLE_COLORS[0]!;
  const rawHex = dark ? ac.dark : ac.light;
  const hex = (!dark) ? hexSaturate(rawHex, LIGHT_SAT_FACTOR) : rawHex;
  const [r,g,b] = hexToRgb(hex);
  // Adjust text color for low-contrast hues in light mode
  const textHex = (!dark && meta.colorKey==="yellow") ? "#9a7400"
                : (!dark && meta.colorKey==="mint")   ? "#008a82"
                : (!dark && meta.colorKey==="teal")   ? "#007ea5"
                : meta.colorKey==="white"             ? (dark ? "#ebebf5" : "#3a3a3c")
                : hex;
  return {
    key: meta.colorKey,
    label: meta.name,
    tint:     `rgba(${r},${g},${b},0.07)`,
    darkTint: `rgba(${r},${g},${b},0.14)`,
    border: hex,
    text: textHex,
    soft:     `rgba(${r},${g},${b},0.22)`,
    darkSoft: `rgba(${r},${g},${b},0.36)`,
  };
}

const MILESTONE_COLORS = ["#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#ff2d55","#5ac8fa","#1c1c1e","#8e8e93","#c7c7cc"];
const LIFE_ACCENT = "#007aff";

function LifeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-1.5A6.5 6.5 0 0 1 12 13a6.5 6.5 0 0 1 6.5 6.5V21"/></svg>;
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2,10); }
function defaultBlock(): Block { return { id: makeId(), weeks: WEEKS_PER_QUARTER, label: "All weeks" }; }

function createSprintFromSelection(qConfig: QuarterConfig, selStart: number, selEnd: number, sprintLabel: string): QuarterConfig {
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
        newBlocks.push({ id: makeId(), weeks: selEndExcl - selStart, label: sprintLabel });
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

  const MIN_YEAR = 2020, MAX_YEAR = 2040;
  const [viewYear, setViewYear] = useState(() => now.getFullYear());

  // Dark mode
  const [dark, setDark] = useState<boolean>(() => ls<boolean>("lifeCalendar:darkMode", false));
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    lsSet("lifeCalendar:darkMode", dark);
  }, [dark]);

  const [lang, setLang] = useState<Lang>(() => ls<string>("lifeCalendar:lang", "en") === "ru" ? "ru" : "en");
  useEffect(() => { lsSet("lifeCalendar:lang", lang); document.documentElement.lang = lang; }, [lang]);
  const t = (k: string) => I18N[lang][k] ?? I18N.en[k] ?? k;
  const months = MONTHS_I18N[lang];
  const weekdays = WEEKDAYS_I18N[lang];

  // Calendar config
  const [config, setConfig] = useState<CalendarConfig>(() => loadConfig(now.getFullYear()));
  useEffect(() => { setConfig(loadConfig(viewYear)); }, [viewYear]);
  useEffect(() => { saveConfig(viewYear, config); }, [viewYear, config]);

  // Settings dropdown
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [factoryResetStep, setFactoryResetStep] = useState(0);
  const settingsRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) { setSettingsOpen(false); setFactoryResetStep(0); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>(() => ls<Milestone[]>("lifeCalendar:milestones", []));
  useEffect(() => { lsSet("lifeCalendar:milestones", milestones); }, [milestones]);
  const [milestonePanelOpen, setMilestonePanelOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [lifeCalendarOpen, setLifeCalendarOpen] = useState(false);
  const [lifeSettings, setLifeSettings] = useState<LifeSettings>(() => ls<LifeSettings>("lifeCalendar:lifeSettings", { birthDate: "", lifespan: 80 }));
  useEffect(() => { lsSet("lifeCalendar:lifeSettings", lifeSettings); }, [lifeSettings]);

  // Notes
  const [notes, setNotes] = useState<Record<string, NoteEntry[]>>(() => {
    const raw = ls<Record<string, unknown>>("lifeCalendar:notes", {});
    const migrated: Record<string, NoteEntry[]> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string") {
        if ((v as string).trim()) migrated[k] = [{ id: makeId(), text: v as string, createdAt: Date.now() }];
      } else if (Array.isArray(v)) {
        migrated[k] = v as NoteEntry[];
      }
    }
    return migrated;
  });
  useEffect(() => { lsSet("lifeCalendar:notes", notes); }, [notes]);
  const [openNote, setOpenNote] = useState<string|null>(null);
  const upsertNotes = (key: string, entries: NoteEntry[]) => {
    setNotes(prev => {
      const next = { ...prev };
      const valid = entries.filter(e => e.text.trim());
      if (valid.length > 0) next[key] = valid; else delete next[key];
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
    const m: Record<string, Milestone[]> = {};
    for (const ms of milestones) {
      if (!m[ms.date]) m[ms.date] = [];
      m[ms.date]!.push(ms);
      if (ms.recurring) {
        const parts = ms.date.split("-");
        const key = `${viewYear}-${parts[1]}-${parts[2]}`;
        if (key !== ms.date) {
          if (!m[key]) m[key] = [];
          m[key]!.push({ ...ms, date: key });
        }
      }
    }
    return m;
  }, [milestones, viewYear]);

  const nextMilestones = useMemo(() => {
    const todayStr = dateKey(today);
    const thisYear = today.getFullYear();
    const list: Milestone[] = [];
    for (const ms of milestones) {
      if (ms.recurring) {
        const parts = ms.date.split("-");
        for (const yr of [thisYear, thisYear + 1]) {
          const key = `${yr}-${parts[1]}-${parts[2]}`;
          if (key >= todayStr) { list.push({ ...ms, date: key }); break; }
        }
      } else {
        if (ms.date >= todayStr) list.push(ms);
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)).slice(0, 10);
  }, [milestones, today]);

  const matchedDates = useMemo<Set<string>>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set();
    const result = new Set<string>();
    for (const [key, entries] of Object.entries(notes)) {
      if (entries.some(e => e.text.toLowerCase().includes(q))) result.add(key);
    }
    for (const ms of milestones) {
      const matchLabel = ms.label.toLowerCase().includes(q);
      const matchDesc = ms.description?.toLowerCase().includes(q) ?? false;
      if (matchLabel || matchDesc) result.add(ms.date);
    }
    return result;
  }, [searchQuery, notes, milestones]);

  const matchedDatesArray = useMemo(() => Array.from(matchedDates).sort(), [matchedDates]);
  const [searchIndex, setSearchIndex] = useState(0);
  useEffect(() => { setSearchIndex(0); }, [matchedDatesArray]);

  const scrollToMatch = React.useCallback((idx: number) => {
    const key = matchedDatesArray[idx];
    if (!key) return;
    const el = document.querySelector<HTMLElement>(`[data-datekey="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate([
        { boxShadow: "0 0 0 4px #ff9f0a, 0 0 20px 6px rgba(255,159,10,0.6)" },
        { boxShadow: "0 0 0 2px #ff9f0a, 0 0 8px 2px rgba(255,159,10,0.45)" },
      ], { duration: 600, easing: "ease-out" });
    }
  }, [matchedDatesArray]);

  const navigateMatch = React.useCallback((dir: 1 | -1) => {
    if (!matchedDatesArray.length) return;
    const next = (searchIndex + dir + matchedDatesArray.length) % matchedDatesArray.length;
    setSearchIndex(next);
    scrollToMatch(next);
  }, [searchIndex, matchedDatesArray, scrollToMatch]);

  const parsedJumpDate = useMemo(() => {
    if (matchedDatesArray.length > 0) return null;
    return parseDateQuery(searchQuery);
  }, [searchQuery, matchedDatesArray.length]);

  const scrollToDateKey = React.useCallback((key: string) => {
    const el = document.querySelector<HTMLElement>(`[data-datekey="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate([
        { boxShadow: "0 0 0 4px #30d158, 0 0 20px 6px rgba(48,209,88,0.6)" },
        { boxShadow: "0 0 0 2px #30d158, 0 0 8px 2px rgba(48,209,88,0.3)" },
      ], { duration: 700, easing: "ease-out" });
    }
  }, []);

  const weekRefs = useRef<Array<HTMLDivElement|null>>([]);
  const didScrollRef = useRef(false);
  useEffect(() => { didScrollRef.current = false; }, [viewYear]);
  useEffect(() => {
    if (didScrollRef.current || currentWeekIndex < 0 || viewYear !== now.getFullYear()) return;
    const el = weekRefs.current[currentWeekIndex];
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); didScrollRef.current = true; }
  }, [currentWeekIndex, viewYear]);

  const [showTodayBtn, setShowTodayBtn] = useState(false);
  const scrollToToday = () => {
    if (viewYear !== now.getFullYear()) {
      setViewYear(now.getFullYear());
    } else {
      weekRefs.current[currentWeekIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  useEffect(() => {
    if (viewYear !== now.getFullYear()) { setShowTodayBtn(true); return; }
    if (currentWeekIndex < 0) { setShowTodayBtn(false); return; }
    const el = weekRefs.current[currentWeekIndex];
    if (!el) { setShowTodayBtn(false); return; }
    const obs = new IntersectionObserver(([e]) => setShowTodayBtn(!e!.isIntersecting), { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [viewYear, currentWeekIndex]);

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
  const SAT_FACTOR = 1.2; // increase saturation in light mode by 20%
  const headerBg = dark ? "rgba(22,22,24,0.90)" : saturateRgbaString("rgba(245,245,247,0.88)", SAT_FACTOR);
  const cardBg   = dark ? "rgba(255,255,255,0.06)" : saturateRgbaString("rgba(255,255,255,0.55)", SAT_FACTOR);
  const modalBg  = dark ? "rgba(30,30,32,0.96)" : saturateRgbaString("rgba(255,255,255,0.93)", SAT_FACTOR);
  const overlayBg = dark ? "rgba(255,255,255,0.08)" : saturateRgbaString("rgba(0,0,0,0.05)", SAT_FACTOR);

  return (
    <LangContext.Provider value={{ t, months, weekdays, lang }}>
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
              <IconButton title={t("search")} onClick={() => { setSearchOpen(o => !o); setSearchQuery(""); }} bg={searchOpen ? "rgba(0,122,255,0.15)" : overlayBg}><SearchIcon /></IconButton>
              <IconButton title={t("notesPanel")} onClick={() => setNotesPanelOpen(true)} bg={overlayBg}><NotesIcon /></IconButton>
              <IconButton title={t("milestones")} onClick={() => setMilestonePanelOpen(true)} bg={overlayBg}><FlagIcon /></IconButton>
              <IconButton title={t("lifeCalendarBtn")} onClick={() => setLifeCalendarOpen(true)} bg={overlayBg}><LifeIcon /></IconButton>
              <div style={{ width:1, height:16, background:"var(--border-soft)", flexShrink:0 }} />
              {/* Settings gear */}
              <div ref={settingsRef} style={{ position:"relative" }}>
                <IconButton
                  title={t("settings")}
                  onClick={() => setSettingsOpen(o => !o)}
                  bg={settingsOpen ? "rgba(0,122,255,0.13)" : overlayBg}
                >
                  <span style={{ display:"inline-flex", transition:"transform 320ms cubic-bezier(0.34,1.56,0.64,1)", transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                    <GearIcon />
                  </span>
                </IconButton>
                <div style={{ position:"absolute", top:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)", zIndex:50 }}>
                  <AnimatePresence>
                    {settingsOpen && (
                      <motion.div
                        key="settings-menu"
                        initial={{ opacity:0, y:-8, scale:0.95 }}
                        animate={{ opacity:1, y:0, scale:1 }}
                        exit={{ opacity:0, y:-8, scale:0.95 }}
                        transition={{ type:"spring", stiffness:380, damping:28 }}
                        style={{ background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:"4px", boxShadow:"0 8px 32px rgba(0,0,0,0.22)", border:"1px solid var(--border-soft)", display:"flex", flexDirection:"column", gap:3, width:38 }}
                      >
                        <IconButton title={dark ? t("lightMode") : t("darkMode")} onClick={() => setDark(d => !d)} bg={overlayBg}>
                          {dark ? <SunIcon /> : <MoonIcon />}
                        </IconButton>
                        <IconButton title={lang==="en" ? t("switchToRussian") : t("switchToEnglish")} onClick={() => setLang(l => l==="en"?"ru":"en")} bg={overlayBg}>
                          <span style={{ fontSize:10, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1 }}>{lang==="en"?"RU":"EN"}</span>
                        </IconButton>
                        <div style={{ height:1, background:"var(--border-soft)", margin:"1px 2px" }} />
                        <IconButton title={t("factoryReset")} onClick={() => { setFactoryResetStep(1); setSettingsOpen(false); }} bg={overlayBg} color="#ff3b30">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/></svg>
                        </IconButton>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden" style={{ background: "var(--border-soft)", borderRadius: 999 }}>
            <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${yearProgress}%`, background: "linear-gradient(90deg,#5ed47b 0%,#34c759 55%,#28a745 100%)", borderRadius: 999 }} />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            <span>{daysCompleted} {t("of")} {totalDays} {t("daysOf")}</span>
            <span>{yearProgress.toFixed(1)}% {t("complete")}</span>
            <span>{(totalDays-daysCompleted).toFixed(0)} {t("daysRemaining")}</span>
          </div>

          {/* Milestone countdown — up to 7 upcoming */}
          <AnimatePresence>
            {nextMilestones.length > 0 && (
              <motion.div key="ms-countdown" initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth:"none" }}>
                {nextMilestones.map(ms => {
                  const [y2, m2, d2] = ms.date.split("-").map(Number) as [number,number,number];
                  const days = daysBetween(today, new Date(y2, m2-1, d2));
                  return (
                    <button key={ms.id}
                      onClick={() => setMilestonePanelOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
                      style={{ background:`${ms.color}1a`, border:`1px solid ${ms.color}44`, color:ms.color, cursor:"pointer" }}
                    >
                      <span style={{ width:6, height:6, borderRadius:999, background:ms.color, display:"inline-block", flexShrink:0 }} />
                      <span className="font-semibold">{ms.label}</span>
                      <span style={{ opacity:0.65 }}>·</span>
                      <span>{days === 0 ? t("todayCountdown") : `${days}${t("daysShort")}`}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search bar */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div key="search-bar" initial={{ opacity:0, height:0, marginTop:0 }} animate={{ opacity:1, height:"auto", marginTop:10 }} exit={{ opacity:0, height:0, marginTop:0 }} transition={{ duration:0.2, ease:"easeInOut" }} style={{ overflow:"hidden" }}>
                <div className="relative flex items-center">
                  <div style={{ position:"absolute", left:10, color:"var(--text-tertiary)", pointerEvents:"none", display:"flex" }}><SearchIcon /></div>
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
                      if (e.key === "Enter") {
                        if (parsedJumpDate) { scrollToDateKey(dateKey(parsedJumpDate)); }
                        else { e.shiftKey ? navigateMatch(-1) : navigateMatch(1); }
                      }
                    }}
                    placeholder={t("searchPlaceholder")}
                    style={{ width:"100%", paddingLeft:34, paddingRight: matchedDatesArray.length > 0 ? 112 : parsedJumpDate ? 180 : 34, paddingTop:8, paddingBottom:8, borderRadius:10, background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", border:"1px solid var(--border-soft)", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"inherit" }}
                  />
                  {searchQuery.trim() && (
                    <div style={{ position:"absolute", right:6, display:"flex", alignItems:"center", gap:4 }}>
                      {matchedDatesArray.length > 0 ? (
                        <>
                          <span style={{ fontSize:11, color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>
                            {searchIndex + 1} {t("of")} {matchedDatesArray.length}
                          </span>
                          <button type="button" onClick={() => navigateMatch(-1)} style={{ width:20, height:20, borderRadius:5, background:"transparent", border:"none", cursor:"pointer", color:"var(--text-secondary)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, padding:0 }}>↑</button>
                          <button type="button" onClick={() => navigateMatch(1)} style={{ width:20, height:20, borderRadius:5, background:"transparent", border:"none", cursor:"pointer", color:"var(--text-secondary)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, padding:0 }}>↓</button>
                        </>
                      ) : parsedJumpDate ? (
                        <button
                          type="button"
                          onClick={() => scrollToDateKey(dateKey(parsedJumpDate))}
                          style={{ display:"flex", alignItems:"center", gap:4, paddingLeft:8, paddingRight:8, paddingTop:3, paddingBottom:3, borderRadius:7, background: dark ? "rgba(48,209,88,0.15)" : "rgba(48,209,88,0.12)", border:"1px solid rgba(48,209,88,0.35)", cursor:"pointer", color:"#30d158", fontSize:11, fontWeight:500, whiteSpace:"nowrap", fontFamily:"inherit" }}
                        >
                          <span style={{ fontSize:12 }}>↵</span>
                          {t("jumpTo")} {parsedJumpDate.getDate()} {MONTHS_I18N[lang][parsedJumpDate.getMonth()]} {parsedJumpDate.getFullYear()}
                        </button>
                      ) : (
                        <span style={{ fontSize:11, color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{t("searchNoResults")}</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sticky weekday labels */}
          <div className="mt-3 flex items-center gap-3 sm:gap-4 pl-[26px] pr-[23px] sm:pl-[32px] sm:pr-[29px]">
            <div className="w-20 sm:w-24 shrink-0" />
            <div className="grid grid-cols-7 gap-2 sm:gap-3 flex-1">
              {weekdays.map((w,i) => <div key={i} className="text-center text-[15px] font-medium tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>{w}</div>)}
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
                  style={{ background: dark ? quarter.darkTint : quarter.tint.replace("0.07", "0.18"), borderRadius: 18, border: `2px solid ${quarter.border}` }}
                >
                  {/* Quarter header */}
                  <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-1.5">
                    <div className="flex items-center gap-2">
                      {/* Color swatch */}
                      <div style={{ position:"relative" }}>
                        <button
                          onClick={() => setColorPickerQi(colorPickerQi === qi ? null : qi)}
                          title={t("chooseColor")}
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
                                  style={{ width:20, height:20, borderRadius:999, background: dark ? ac.dark : ac.light, border: meta.colorKey===ac.key ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms ease", boxShadow: (ac.key==="white" || ac.key==="grey") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Editable quarter name */}
                      <QuarterNameEditor value={meta.name} onChange={name => updateQuarterMeta(qi, { name })} color={quarter.text} />
                      <span className="text-[11px] tabular-nums" style={{ color:"var(--text-tertiary)" }}>{t("weeks")} {startIndex+1}–{startIndex+WEEKS_PER_QUARTER}</span>
                    </div>
                    <IconButton title={t("sprintConfig")} onClick={() => setSettingsQuarter(qi)} bg={overlayBg} color={quarter.text}><GearIcon /></IconButton>
                  </div>

                  {/* Quarter progress bar */}
                  <div className="px-4 sm:px-5 pb-5">
                    <div className="flex items-center justify-between text-[10px] tabular-nums mb-0.5">
                      <span style={{ color:"var(--text-tertiary)" }}>{t("quarterProgress")}</span>
                    </div>
                    <div className="text-center tabular-nums mb-1" style={{ fontSize:11, fontWeight:700, color: !dark && quarter.key === "green" ? "var(--apple-green-deep)" : quarter.text }}>
                      {qPct.toFixed(0)}%
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                      <motion.div initial={false} animate={{ width:`${qPct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                        style={{ height:"100%", background: quarter.border, borderRadius:999, opacity:0.88 }}
                      />
                    </div>
                  </div>

                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 flex flex-col gap-2">
                    <BlocksRenderer
                      qi={qi} quarter={quarter} qConfig={qConfig} startIndex={startIndex}
                      weeks={weeks} currentWeekIndex={currentWeekIndex} todayProgress={todayProgress}
                      dayState={dayState} weekRefs={weekRefs} notes={notes} milestonesMap={milestonesMap}
                      blockGoals={blockGoals} dark={dark} cardBg={cardBg} overlayBg={overlayBg}
                      weekSel={weekSel} matchedDates={matchedDates} activeMatchKey={matchedDatesArray[searchIndex]}
                      onNoteOpen={k => setOpenNote(k)}
                      onLabelChange={(bid, lbl) => updateBlockLabel(qi, bid, lbl)}
                      onGoalToggle={toggleGoal}
                      onEditGoals={bid => setEditGoalsBlockId(bid)}
                      onWeekLabelClick={handleWeekLabelClick}
                      onCreateSprint={(selStart, selEnd) => { updateQuarter(qi, createSprintFromSelection(config.quarters[qi]!, selStart, selEnd, t("sprintLabel"))); setWeekSel(null); }}
                      onCancelSel={() => setWeekSel(null)}
                    />
                  </div>
                </motion.section>
              );
            })}
          </div>
        </LayoutGroup>

        <footer className="mt-12 pb-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
          {t("footerBase")} · {viewYear}
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
            onResetBlock={(blockId) => {
              const qi = settingsQuarter;
              const qBlocks = config.quarters[qi]!.blocks;
              let cursor = 0, blockStart = 0, blockEnd = 0;
              for (const b of qBlocks) {
                if (b.id === blockId) { blockStart = cursor; blockEnd = cursor + b.weeks; break; }
                cursor += b.weeks;
              }
              const si = qi * WEEKS_PER_QUARTER;
              const blockWeeks = weeks.slice(si + blockStart, si + blockEnd);
              const keys = new Set(blockWeeks.flatMap(w => w.days).map(d => dateKey(d)));
              setNotes(prev => { const n = { ...prev }; keys.forEach(k => delete n[k]); return n; });
              setBlockGoals(prev => { const n = { ...prev }; delete n[blockId]; return n; });
              setMilestones(prev => prev.filter(m => !keys.has(m.date)));
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openNote !== null && (
          <NoteModal key="note"
            dateKey={openNote} initial={notes[openNote] ?? []} dark={dark} modalBg={modalBg}
            dayMilestones={milestonesMap[openNote] ?? []}
            onMilestoneUpdate={ms => setMilestones(prev => prev.map(m => m.id === ms.id ? ms : m))}
            onMilestoneAdd={ms => setMilestones(prev => [...prev, ms])}
            onSave={entries => { upsertNotes(openNote, entries); setOpenNote(null); }}
            onClose={() => setOpenNote(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notesPanelOpen && (
          <NotesPanel key="notes-panel"
            notes={notes} weeks={weeks} resolvedQuarters={resolvedQuarters}
            dark={dark} modalBg={modalBg}
            onOpenNote={key => setOpenNote(key)}
            onAddNote={(dk, entry) => upsertNotes(dk, [...(notes[dk] ?? []), entry])}
            onDeleteDayNotes={dk => upsertNotes(dk, [])}
            onClose={() => setNotesPanelOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {milestonePanelOpen && (
          <MilestoneModal key="milestones"
            milestones={milestones} resolvedQuarters={resolvedQuarters} weeks={weeks} dark={dark} modalBg={modalBg}
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
            onSave={(bg, lbl) => { setBlockGoals(prev => ({ ...prev, [editGoalsBlockId!]: bg })); const qi = config.quarters.findIndex(q => q.blocks.some(b => b.id === editGoalsBlockId)); if (qi >= 0) updateBlockLabel(qi, editGoalsBlockId!, lbl); setEditGoalsBlockId(null); }}
            onClose={() => setEditGoalsBlockId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lifeCalendarOpen && (
          <LifeCalendarModal key="life-cal"
            dark={dark} modalBg={modalBg}
            settings={lifeSettings}
            onSettingsChange={setLifeSettings}
            onClose={() => setLifeCalendarOpen(false)}
          />
        )}
      </AnimatePresence>

      <FactoryResetDialog
        open={factoryResetStep >= 1}
        onClose={() => setFactoryResetStep(0)}
        onConfirm={() => {
          setNotes({});
          setBlockGoals({});
          setMilestones([]);
          setConfig(defaultConfig());
          setQuarterMeta(DEFAULT_QUARTER_META);
        }}
        dark={dark}
      />

      <AnimatePresence>
        {showTodayBtn && (
          <motion.button
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
            transition={{ duration:0.18 }}
            onClick={scrollToToday}
            style={{ position:"fixed", bottom:20, right:20, zIndex:15, height:28, paddingInline:10, borderRadius:999, background: dark?"rgba(36,36,40,0.88)":"rgba(242,242,247,0.88)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", border:`1px solid ${dark?"rgba(255,255,255,0.11)":"rgba(0,0,0,0.08)"}`, color:"var(--text-secondary)", fontSize:11, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:5, boxShadow:"0 2px 10px rgba(0,0,0,0.10)" }}
          >
            <span style={{ width:5, height:5, borderRadius:999, background:"var(--text-tertiary)", flexShrink:0 }} />
            {t("today")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </LangContext.Provider>
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
  weekSel, matchedDates, activeMatchKey, onNoteOpen, onLabelChange, onGoalToggle, onEditGoals, onWeekLabelClick,
  onCreateSprint, onCancelSel,
}: {
  qi: number; quarter: Quarter; qConfig: QuarterConfig; startIndex: number;
  weeks: Array<{ weekStart: Date; days: Date[] }>; currentWeekIndex: number; todayProgress: number;
  dayState: (d: Date) => DayState; weekRefs: React.MutableRefObject<Array<HTMLDivElement|null>>;
  notes: Record<string,NoteEntry[]>; milestonesMap: Record<string,Milestone[]>;
  blockGoals: Record<string,BlockGoals>; dark: boolean; cardBg: string; overlayBg: string;
  weekSel: { qi: number; anchor: number; focus: number }|null;
  matchedDates: Set<string>; activeMatchKey?: string;
  onNoteOpen: (key: string) => void; onLabelChange: (blockId: string, label: string) => void;
  onGoalToggle: (blockId: string, goalId: string) => void; onEditGoals: (blockId: string) => void;
  onWeekLabelClick: (qi: number, qOffset: number) => void;
  onCreateSprint: (selStart: number, selEnd: number) => void;
  onCancelSel: () => void;
}) {
  const { t, lang } = React.useContext(LangContext);
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
                style={{ background:softColor, borderRadius:14, border:`1px solid ${softColor}`, backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)", overflow:"hidden" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 sm:px-3.5 pt-2.5 pb-1.5">
                  <BlockLabel value={block.label} onChange={v => onLabelChange(block.id, v)} color={effectiveQ.text} />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onEditGoals(block.id)} title={t("sprintGoals")}
                      style={{ width:22, height:22, borderRadius:6, background:"transparent", border:"none", color: activeGoals.length>0 ? quarter.text : "var(--text-tertiary)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                    ><PencilIcon /></button>
                    <span className="text-[10px] tabular-nums" style={{ color:"var(--text-tertiary)" }}>{block.weeks} {t("week")}</span>
                  </div>
                </div>

                {/* Progress strip */}
                <div className="px-3 sm:px-3.5 pb-2">
                  <div className="flex items-center justify-between text-[10px] tabular-nums mb-1">
                    <span style={{ color:"var(--text-tertiary)" }}>{pastDays} {t("of")} {totalDays} {t("daysOf")}</span>
                    <span style={{ color: isFuture ? "var(--text-tertiary)" : effectiveQ.text, fontWeight:700 }}>{pct.toFixed(0)}%</span>
                    <span style={{ color:"var(--text-tertiary)" }}>{isComplete ? t("done") : `${daysLeft} ${t("left")}`}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                    <motion.div initial={false} animate={{ width:`${pct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                      style={{ height:"100%", background: `linear-gradient(90deg,${effectiveQ.text},${effectiveQ.border})`, borderRadius:999, boxShadow: pct>0 ? `0 0 6px ${softColor}` : "none" }}
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
                        {activeGoals.filter(g=>g.done).length}/{activeGoals.length} {t("goals")}
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
                    const qOffset = block.start + ri;
                    const isCurrent = wi === currentWeekIndex;
                    const isSel = qOffset >= selMin && qOffset <= selMax;
                    const isAnchor = hasSelection && (weekSel!.anchor === qOffset || weekSel!.focus === qOffset);
                    return (
                      <React.Fragment key={wi}>
                        <div ref={el => { weekRefs.current[wi] = el; }} className="flex items-center gap-3 sm:gap-4">
                          <button type="button"
                            onClick={() => onWeekLabelClick(_qi, qOffset)}
                            title={hasSelection ? (isSel ? t("clickMoveEndSelection") : t("extendSelectionHere")) : t("clickStartSprintSelection")}
                            className={`w-20 sm:w-24 shrink-0 text-[15px] tabular-nums whitespace-nowrap ${lang === "en" ? "text-center" : "text-right"}`}
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
                          >{lang === "en" ? `${t("week")}\u00A0\u00A0${wi+1}` : `${t("week")} ${wi+1}`}</button>
                          <div className="grid grid-cols-7 gap-2 sm:gap-3 flex-1">
                            {days.map((d, di) => (
                              <DayTile key={di} date={d} state={dayState(d)} todayProgress={todayProgress}
                                notes={notes[dateKey(d)]} milestones={milestonesMap[dateKey(d)] ?? []}
                                accentColor={effectiveQ.border}
                                highlighted={matchedDates.size > 0 ? matchedDates.has(dateKey(d)) : undefined}
                                isActiveMatch={activeMatchKey === dateKey(d)}
                                onOpen={() => { if (dayState(d)!=="out") onNoteOpen(dateKey(d)); }}
                              />
                            ))}
                          </div>
                        </div>
                        <AnimatePresence>
                          {hasSelection && qOffset === selMax && (
                            <motion.div
                              key="sprint-action"
                              initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                              transition={{ type:"spring", stiffness:380, damping:28 }}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl"
                              style={{ background: dark ? quarter.darkSoft : quarter.soft, border:`1px solid ${quarter.border}55` }}
                            >
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[12px] font-semibold truncate" style={{ color: quarter.text }}>
                                  {selMin === selMax
                                    ? `${t("week")} ${selMin + startIndex + 1}`
                                    : `${t("week")} ${selMin + startIndex + 1}–${selMax + startIndex + 1}`}
                                </span>
                                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                                  {selMax - selMin + 1} {t("week")}{lang === "en" && selMax - selMin + 1 !== 1 ? "s" : ""} · {t("clickWeekToAdjust")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={onCancelSel}
                                  style={{ height:28, paddingInline:10, borderRadius:8, border:`1px solid ${quarter.border}44`, background:"transparent", color:"var(--text-secondary)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                                  {t("cancel")}
                                </button>
                                <button onClick={() => onCreateSprint(selMin, selMax)}
                                  style={{ height:28, paddingInline:12, borderRadius:8, border:"none", background: quarter.border, color:"white", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${quarter.border}55` }}>
                                  {t("createSprint")}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
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
  const { t } = React.useContext(LangContext);
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
      style={{ color }} title={t("clickToRename")}
    >{value}</button>
  );
}

// ─── BlockLabel ───────────────────────────────────────────────────────────────

function BlockLabel({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const { t } = React.useContext(LangContext);
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
  return <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold tracking-tight text-left" style={{ color:"var(--text)", letterSpacing:"-0.01em" }} title={t("clickToRename")}>{value}</button>;
}

// ─── DayTile ──────────────────────────────────────────────────────────────────

function DayTile({ date, state, todayProgress, notes: dayNotes, milestones: dayMilestones, accentColor, highlighted, isActiveMatch, onOpen }: {
  date: Date; state: DayState; todayProgress: number;
  notes?: NoteEntry[]; milestones: Milestone[]; accentColor: string; highlighted?: boolean; isActiveMatch?: boolean; onOpen: () => void;
}) {
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const hovered = tooltipRect !== null;
  const isOut = state==="out", isPast = state==="past", isToday = state==="today";
  const activeNotes = dayNotes?.filter(n => n.text.trim()) ?? [];
  const hasNote = activeNotes.length > 0;
  const noteCount = activeNotes.length;
  const { months: ctxMonths } = React.useContext(LangContext);
  const dayNumber = date.getDate(), monthAbbr = ctxMonths[date.getMonth()]!;

  const dk = dateKey(date);
  const highlightRing = isActiveMatch
    ? "0 0 0 3px #ff9f0a, 0 0 16px 4px rgba(255,159,10,0.65)"
    : highlighted === true ? "0 0 0 2px #ff9f0a, 0 0 8px 2px rgba(255,159,10,0.45)"
    : highlighted === false ? "none" : undefined;
  const base: React.CSSProperties = { borderRadius:12, aspectRatio:"1/1", cursor: isOut?"default":"pointer", transition:"box-shadow 200ms ease", position:"relative", boxShadow: highlightRing };

  if (isOut) return <div style={{ ...base, background:"transparent", border:"1px dashed var(--border-soft)", opacity:0.35, cursor:"default" }} />;

  const hasEvents = dayMilestones.length > 0;
  const noteDot = hasNote ? (
    <div
      style={{ position:"absolute", top: hasEvents ? 10 : 4, right:4, width:"12px", height:"12px", minWidth:"12px", minHeight:"12px", background:"#007aff", boxShadow:"0 0 3px rgba(0,122,255,0.65)", zIndex:5 }}
      className="absolute flex flex-shrink-0 items-center justify-center rounded-full bg-[#007aff]">
      <span style={{ fontSize:7, color:"white", fontWeight:700, lineHeight:1 }}>{noteCount}</span>
    </div>
  ) : null;

  const msBar = dayMilestones.length > 0 ? (
    <div style={{ position:"absolute", top:0, left:0, right:0, height:6, borderRadius:"12px 12px 0 0", display:"flex", overflow:"hidden", zIndex:4, opacity: isPast ? 0.6 : 1 }}>
      {dayMilestones.map(ms => <div key={ms.id} style={{ flex:1, background:ms.color }} />)}
    </div>
  ) : null;

  const handleMouseEnter = () => {
    if (hasNote && tileRef.current) setTooltipRect(tileRef.current.getBoundingClientRect());
  };
  const handleMouseLeave = () => setTooltipRect(null);
  const hov = { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, onClick: onOpen };

  // Compute portal tooltip position so it never clips outside viewport
  const tooltipPortal = hovered && tooltipRect && hasNote ? ReactDOM.createPortal(
    (() => {
      const TW = 240, TH_EST = activeNotes.length * 60;
      const spaceAbove = tooltipRect.top;
      const showBelow = spaceAbove < TH_EST + 20;
      const top = showBelow ? tooltipRect.bottom + 8 : tooltipRect.top - 8;
      const arrowOnTop = showBelow;
      // horizontal: clamp so tooltip stays inside viewport
      const rawLeft = tooltipRect.left + tooltipRect.width / 2 - TW / 2;
      const left = Math.max(8, Math.min(rawLeft, window.innerWidth - TW - 8));
      const arrowLeft = tooltipRect.left + tooltipRect.width / 2 - left - 6;
      return (
        <div style={{ position:"fixed", top, left, width:TW, zIndex:9999, background:"rgba(29,29,31,0.96)", backdropFilter:"blur(16px) saturate(180%)", WebkitBackdropFilter:"blur(16px) saturate(180%)", color:"rgba(255,255,255,0.92)", fontSize:12, lineHeight:1.55, borderRadius:12, padding:"10px 12px", wordBreak:"break-word", boxShadow:"0 8px 32px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.06) inset", border:"1px solid rgba(255,255,255,0.08)", pointerEvents:"none", transform: showBelow ? "none" : "translateY(-100%)" }}>
          {arrowOnTop && <div style={{ position:"absolute", bottom:"100%", left:arrowLeft, width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderBottom:"6px solid rgba(29,29,31,0.96)" }} />}
          {activeNotes.map((n, i) => (
            <div key={n.id} style={{ marginTop: i > 0 ? 5 : 0, padding:"6px 9px", borderRadius:8, background: n.color ? `color-mix(in srgb, ${n.color} 28%, rgba(255,255,255,0.04))` : "rgba(255,255,255,0.06)", border: n.color ? `1px solid color-mix(in srgb, ${n.color} 50%, rgba(255,255,255,0.12))` : "1px solid rgba(255,255,255,0.08)", whiteSpace:"pre-wrap" }}>{n.text}</div>
          ))}
          {!arrowOnTop && <div style={{ position:"absolute", top:"100%", left:arrowLeft, width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderTop:"6px solid rgba(29,29,31,0.96)" }} />}
        </div>
      );
    })(),
    document.body
  ) : null;

  if (isPast) {
    return (
      <>
        <div ref={tileRef} data-datekey={dk} style={{ ...base }} {...hov}>
          <div className="flex flex-col items-center justify-center" style={{ position:"absolute", inset:0, borderRadius:12, overflow:"hidden", background:`linear-gradient(160deg,${accentColor}cc 0%,${accentColor} 60%,${accentColor}dd 100%)`, color:"white", boxShadow: hovered ? `0 2px 8px ${accentColor}61, inset 0 0 0 0.5px rgba(255,255,255,0.18)` : `0 1px 2px ${accentColor}2e, inset 0 0 0 0.5px rgba(255,255,255,0.18)` }}>
            {msBar}<Label number={dayNumber} month={monthAbbr} tone="onGreen" />{noteDot}
          </div>
        </div>
        {tooltipPortal}
      </>
    );
  }
  if (isToday) {
    return (
      <>
        <div ref={tileRef} data-datekey={dk} style={{ ...base }} {...hov}>
          <div className="flex flex-col items-center justify-center" style={{ position:"absolute", inset:0, borderRadius:12, overflow:"hidden", background:"var(--surface)", border:`1.5px solid ${accentColor}`, boxShadow: hovered ? `0 0 0 4px ${accentColor}2e,0 4px 18px ${accentColor}47` : `0 0 0 4px ${accentColor}1e,0 4px 14px ${accentColor}2e`, color:"var(--text)" }}>
            {msBar}
            <div className="relative w-full h-full overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out" style={{ height:`${todayProgress}%`, background:`linear-gradient(180deg,${accentColor}d9 0%,${accentColor} 100%)` }} />
              <div className="relative z-10 flex h-full w-full flex-col items-center justify-center"><Label number={dayNumber} month={monthAbbr} tone="auto" /></div>
            </div>
            {noteDot}
          </div>
        </div>
        {tooltipPortal}
      </>
    );
  }
  return (
    <>
      <div ref={tileRef} data-datekey={dk} style={{ ...base }} {...hov}>
        <div className="flex flex-col items-center justify-center" style={{ position:"absolute", inset:0, borderRadius:12, overflow:"hidden", background:"var(--surface)", border:"1px solid var(--border-soft)", color:"var(--text-secondary)", boxShadow: hovered ? "0 2px 10px rgba(0,0,0,0.08)" : "0 1px 1px rgba(0,0,0,0.02)" }}>
          {msBar}<Label number={dayNumber} month={monthAbbr} tone="muted" />{noteDot}
        </div>
      </div>
      {tooltipPortal}
    </>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ number, month, tone }: { number: number; month: string; tone: "onGreen"|"muted"|"auto" }) {
  const nc = tone==="onGreen" ? "white" : "var(--text)";
  const mc = tone==="onGreen" ? "rgba(255,255,255,0.85)" : tone==="muted" ? "var(--text-tertiary)" : "var(--text-secondary)";
  return (
    <div className="flex flex-col items-center justify-center leading-none select-none">
      <div className="text-[21px] sm:text-[24px] font-semibold tabular-nums" style={{ color:nc, letterSpacing:"-0.02em" }}>{number}</div>
      <div className="mt-1 text-[12px] sm:text-[13px] font-medium tracking-widest" style={{ color:mc }}>{month}</div>
    </div>
  );
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({ dateKey: dk, initial, dark, modalBg, dayMilestones, onMilestoneUpdate, onMilestoneAdd, onSave, onClose }: {
  dateKey: string; initial: NoteEntry[]; dark: boolean; modalBg: string;
  dayMilestones: Milestone[];
  onMilestoneUpdate: (updated: Milestone) => void;
  onMilestoneAdd: (ms: Milestone) => void;
  onSave: (entries: NoteEntry[]) => void; onClose: () => void;
}) {
  const [entries, setEntries] = useState<NoteEntry[]>(() =>
    initial.length > 0 ? initial : [{ id: makeId(), text: "", createdAt: Date.now() }]
  );
  const [focusId, setFocusId] = useState<string|null>(initial.length === 0 ? (entries[0]?.id ?? null) : null);
  const areaRefs = useRef<Record<string, HTMLTextAreaElement|null>>({});
  const colorBtnRefs = useRef<Record<string, HTMLButtonElement|null>>({});
  const [colorPickerEntryId, setColorPickerEntryId] = useState<string | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const toggleColorPicker = (id: string) => {
    if (colorPickerEntryId === id) { setColorPickerEntryId(null); return; }
    const btn = colorBtnRefs.current[id];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setColorPickerPos({ top: rect.bottom + 7, left: rect.right - 152 });
    }
    setColorPickerEntryId(id);
  };

  useEffect(() => {
    if (focusId) { const el = areaRefs.current[focusId]; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  }, [focusId]);

  const { t, lang } = React.useContext(LangContext);

  // Milestone inline edit state
  const [msEditId, setMsEditId] = useState<string|null>(null);
  const [msEditLabel, setMsEditLabel] = useState("");
  const [msEditDate, setMsEditDate] = useState("");
  const [msEditColor, setMsEditColor] = useState(MILESTONE_COLORS[0]!);
  const [msEditDesc, setMsEditDesc] = useState("");
  const [msEditRecurring, setMsEditRecurring] = useState(false);

  // New event form state
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState(dk);
  const [newColor, setNewColor] = useState(MILESTONE_COLORS[4]!);
  const [newDesc, setNewDesc] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);

  const submitNewEvent = () => {
    if (!newLabel.trim()) return;
    onMilestoneAdd({ id: makeId(), label: newLabel.trim(), date: newDate, color: newColor, description: newDesc.trim() || undefined, recurring: newRecurring || undefined });
    setNewLabel(""); setNewDesc(""); setNewRecurring(false); setNewColor(MILESTONE_COLORS[4]!); setNewDate(dk);
    setAddEventOpen(false);
  };

  const startMsEdit = (ms: Milestone) => {
    setMsEditId(ms.id); setMsEditLabel(ms.label);
    setMsEditDate(ms.date); setMsEditColor(ms.color); setMsEditDesc(ms.description ?? "");
    setMsEditRecurring(ms.recurring ?? false);
  };
  const saveMsEdit = () => {
    if (!msEditLabel.trim() || !msEditId) return;
    const orig = dayMilestones.find(m => m.id === msEditId);
    if (orig) onMilestoneUpdate({ ...orig, label: msEditLabel.trim(), date: msEditDate, color: msEditColor, description: msEditDesc.trim() || undefined, recurring: msEditRecurring || undefined });
    setMsEditId(null);
  };

  const [y, m, d] = dk.split("-").map(Number) as [number,number,number];
  const label = new Date(y, m-1, d).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { weekday:"long", month:"long", day:"numeric" });
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)";
  const inputStyleMs: React.CSSProperties = { background: inputBg, border:`1px solid ${borderColor}`, borderRadius:8, padding:"6px 9px", fontSize:12, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };

  const addEntry = () => {
    const id = makeId();
    setEntries(prev => [...prev, { id, text: "", createdAt: Date.now() }]);
    setFocusId(id);
  };
  const updateEntry = (id: string, text: string) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, text: text.slice(0, 320) } : e));
  const updateEntryColor = (id: string, color: string | undefined) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, color } : e));
  const deleteEntry = (id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id));
  const handleSave = () => { onSave(entries); onClose(); };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.32)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)" }}
      onClick={onClose}
    >
      <motion.div layout initial={{ opacity:0, scale:0.95, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.96, y:8 }}
        transition={{ type:"spring", stiffness:380, damping:30 }} onClick={e => { e.stopPropagation(); setColorPickerEntryId(null); }}
        style={{ width:"min(92vw,400px)", background:modalBg, backdropFilter:"saturate(180%) blur(24px)", WebkitBackdropFilter:"saturate(180%) blur(24px)", borderRadius:22, boxShadow:"0 8px 48px rgba(0,0,0,0.26)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:"85vh" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between shrink-0">
          <div>
            <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"var(--text-tertiary)" }}>
              {dayMilestones.length > 0 ? t("eventsAndNotes") : t("dayNotes")}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-tight" style={{ color:"var(--text)" }}>{label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer", flexShrink:0 }}>✕</button>
        </div>

        {/* Milestones for this day */}
        {dayMilestones.length > 0 && (
          <div className="px-5 pb-3 shrink-0">
            <div className="text-[10px] font-semibold tracking-widest uppercase mb-1.5" style={{ color:"var(--text-tertiary)" }}>{t("events")}</div>
            <div className="flex flex-col gap-1.5">
              {dayMilestones.map(ms => {
                const isEditing = msEditId === ms.id;
                return (
                  <div key={ms.id} className="flex flex-col gap-1.5 px-2.5 py-2 rounded-xl"
                    style={{ background: isEditing ? `${ms.color}14` : `${ms.color}18`, border:`1px solid ${isEditing ? ms.color+"55" : ms.color+"33"}`, transition:"border 150ms" }}>
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1 flex-wrap">
                          {MILESTONE_COLORS.map(c => (
                            <button key={c} onClick={() => setMsEditColor(c)}
                              style={{ width:14, height:14, borderRadius:999, background:c, border: msEditColor===c ? "2px solid var(--text)" : "2px solid transparent", cursor:"pointer", transition:"border 120ms", boxShadow: (c==="#c7c7cc" || c==="#8e8e93") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }} />
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <input value={msEditLabel} onChange={e => setMsEditLabel(e.target.value)}
                            onKeyDown={e => { if (e.key==="Enter") saveMsEdit(); if (e.key==="Escape") setMsEditId(null); }}
                            placeholder={t("labelPlaceholder")} autoFocus style={{ ...inputStyleMs, flex:2, width:"auto" }} />
                          <input type="date" value={msEditDate} onChange={e => setMsEditDate(e.target.value)}
                            lang={lang} style={{ ...inputStyleMs, flex:1, width:"auto" }} />
                        </div>
                        <div style={{ position:"relative" }}>
                          <textarea value={msEditDesc} onChange={e => setMsEditDesc(e.target.value.slice(0,300))}
                            placeholder={t("editDescPlaceholder")} rows={2}
                            style={{ ...inputStyleMs, width:"100%", resize:"none", lineHeight:1.5, borderRadius:8, padding:"6px 9px", paddingBottom:16, display:"block" }} />
                          <span style={{ position:"absolute", bottom:4, right:8, fontSize:10, color:"var(--text-tertiary)", pointerEvents:"none" }}>{msEditDesc.length}/300</span>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ width:"fit-content" }}>
                          <input type="checkbox" checked={msEditRecurring} onChange={e => setMsEditRecurring(e.target.checked)}
                            style={{ width:13, height:13, accentColor:"#007aff", cursor:"pointer" }} />
                          <span className="text-[12px]" style={{ color:"var(--text-secondary)" }}>{t("repeatYearly")}</span>
                        </label>
                        <div className="flex gap-1.5">
                          <button onClick={() => setMsEditId(null)}
                            style={{ flex:1, height:28, borderRadius:7, border:`1px solid ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{t("cancel")}</button>
                          <button onClick={saveMsEdit} disabled={!msEditLabel.trim()}
                            style={{ flex:2, height:28, borderRadius:7, border:"none", background: msEditLabel.trim()?"#007aff":"rgba(128,128,128,0.15)", color: msEditLabel.trim()?"white":"var(--text-tertiary)", fontSize:12, fontWeight:600, cursor: msEditLabel.trim()?"pointer":"default", fontFamily:"inherit" }}>{t("saveChanges")}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span style={{ width:8, height:8, borderRadius:999, background:ms.color, flexShrink:0, marginTop:3 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-[13px] font-semibold leading-snug" style={{ color:ms.color }}>
                            {ms.label}
                            {ms.recurring && <span title={t("repeatYearly")} style={{ fontSize:10, opacity:0.7 }}>↻</span>}
                          </div>
                          {ms.description && <div className="text-[11px] mt-0.5 leading-snug" style={{ color:"var(--text-secondary)" }}>{ms.description}</div>}
                        </div>
                        <button onClick={() => startMsEdit(ms)} title={t("edit")}
                          style={{ color:"var(--text-secondary)", background:"none", border:"none", cursor:"pointer", fontSize:12, lineHeight:1, padding:"1px 2px", opacity:0.6, flexShrink:0, transform:"scaleX(-1)" }}>✎</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 mb-0 h-px" style={{ background:"var(--border-soft)" }} />
          </div>
        )}

        {/* Add event form */}
        <div className="px-5 pb-3 shrink-0">
          {!addEventOpen ? (
            <button onClick={() => setAddEventOpen(true)}
              style={{ width:"100%", height:32, borderRadius:9, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
              <span style={{ fontSize:14, lineHeight:1 }}>+</span> {t("addEvent")}
            </button>
          ) : (
            <div style={{ background: dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.02)", border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)"}`, borderRadius:12, padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
              <div className="flex gap-1 flex-wrap">
                {MILESTONE_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    style={{ width:14, height:14, borderRadius:999, background:c, border: newColor===c ? "2px solid var(--text)" : "2px solid transparent", cursor:"pointer", transition:"border 120ms", boxShadow: (c==="#c7c7cc" || c==="#8e8e93") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }} />
                ))}
              </div>
              <div className="flex gap-1.5">
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter") submitNewEvent(); if (e.key==="Escape") setAddEventOpen(false); }}
                  placeholder={t("labelPlaceholder")} autoFocus
                  style={{ background: dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.7)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.06)"}`, borderRadius:8, padding:"6px 9px", fontSize:12, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" as const, flex:2, width:"auto" }} />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  lang={lang}
                  style={{ background: dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.7)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.06)"}`, borderRadius:8, padding:"6px 9px", fontSize:12, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" as const, flex:1, width:"auto" }} />
              </div>
              <div style={{ position:"relative" }}>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value.slice(0,300))}
                  placeholder={t("descPlaceholder")} rows={2}
                  style={{ background: dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.7)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.06)"}`, borderRadius:8, padding:"6px 9px", paddingBottom:16, fontSize:12, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" as const, width:"100%", resize:"none", lineHeight:1.5, display:"block" }} />
                <span style={{ position:"absolute", bottom:4, right:8, fontSize:10, color:"var(--text-tertiary)", pointerEvents:"none" }}>{newDesc.length}/300</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ width:"fit-content" }}>
                <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)}
                  style={{ width:13, height:13, accentColor:"#007aff", cursor:"pointer" }} />
                <span style={{ fontSize:12, color:"var(--text-secondary)" }}>{t("repeatYearly")}</span>
              </label>
              <div className="flex gap-1.5">
                <button onClick={() => setAddEventOpen(false)}
                  style={{ flex:1, height:28, borderRadius:7, border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{t("cancel")}</button>
                <button onClick={submitNewEvent} disabled={!newLabel.trim()}
                  style={{ flex:2, height:28, borderRadius:7, border:"none", background: newLabel.trim()?"#007aff":"rgba(128,128,128,0.15)", color: newLabel.trim()?"white":"var(--text-tertiary)", fontSize:12, fontWeight:600, cursor: newLabel.trim()?"pointer":"default", fontFamily:"inherit" }}>{t("addEventBtn")}</button>
              </div>
            </div>
          )}
          {(dayMilestones.length > 0 || addEventOpen) && <div className="mt-3 h-px" style={{ background:"var(--border-soft)" }} />}
        </div>

        {/* Scrollable notes list */}
        <div className="px-5 pb-2 flex flex-col gap-3 overflow-y-auto" onScroll={() => setColorPickerEntryId(null)}>
          <AnimatePresence initial={false}>
            {entries.map((entry, idx) => {
              const entryColor = entry.color;
              const tintedBg = entryColor
                ? `color-mix(in srgb, ${entryColor} ${dark ? 22 : 16}%, ${dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)"})`
                : inputBg;
              const tintedBorder = entryColor
                ? `color-mix(in srgb, ${entryColor} 55%, ${borderColor})`
                : borderColor;
              return (
              <motion.div key={entry.id}
                initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                transition={{ type:"spring", stiffness:360, damping:28 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium" style={{ color:"var(--text-tertiary)" }}>
                    {entries.length > 1 ? `${t("note")} ${idx + 1}` : t("note")}
                  </span>
                  {entries.length > 1 && (
                    <button onClick={() => deleteEntry(entry.id)}
                      style={{ height:18, paddingInline:6, borderRadius:5, border:"none", background:"rgba(255,59,48,0.1)", color:"#ff3b30", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                      {t("remove")}
                    </button>
                  )}
                </div>
                <div style={{ position:"relative" }}>
                  <textarea
                    ref={el => { areaRefs.current[entry.id] = el; }}
                    value={entry.text}
                    onChange={e => updateEntry(entry.id, e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={idx === 0 ? t("notePlaceholder") : t("anotherNote")}
                    rows={3}
                    style={{ width:"100%", resize:"none", outline:"none", border:`1px solid ${tintedBorder}`, borderRadius:12, padding:"10px 34px 10px 12px", fontSize:14, lineHeight:1.55, fontFamily:"inherit", background:tintedBg, color:"var(--text)", boxSizing:"border-box", display:"block", transition:"background 200ms ease, border-color 200ms ease" }}
                  />
                  <div style={{ position:"absolute", top:8, right:8 }}>
                    <button
                      ref={el => { colorBtnRefs.current[entry.id] = el; }}
                      onClick={e => { e.stopPropagation(); toggleColorPicker(entry.id); }}
                      title={`${t("chooseColor")} — ${entries.length > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
                      aria-label={`${t("chooseColor")} — ${entries.length > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
                      data-testid={`note-color-btn-${idx}`}
                      style={{ width:16, height:16, borderRadius:999, background: entryColor ?? (dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)"), border:`2px solid ${dark?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.9)"}`, boxShadow:"0 1px 3px rgba(0,0,0,0.25)", cursor:"pointer", display:"block", flexShrink:0, padding:0 }}
                    />
                  </div>
                </div>
                <div className="text-right text-[10px] tabular-nums mt-0.5" style={{ color:"var(--text-tertiary)" }}>{entry.text.length} / 320</div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Add note button */}
        <div className="px-5 pb-3 shrink-0">
          <button onClick={addEntry}
            style={{ width:"100%", height:34, borderRadius:10, border:`1.5px dashed ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> {t("addNote")}
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2.5 shrink-0">
          <button onClick={onClose} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{t("cancel")}</button>
          <button onClick={handleSave} style={{ flex:2, height:36, borderRadius:10, border:"none", background:"#007aff", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 8px rgba(0,122,255,0.35)" }}>{t("save")} <span style={{ opacity:0.65, fontSize:11 }}>⌘↵</span></button>
        </div>
      </motion.div>
      {colorPickerEntryId !== null && colorPickerPos && ReactDOM.createPortal(
        <AnimatePresence>
          <motion.div
            key="color-popover"
            initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.94, y:-4 }}
            transition={{ type:"spring", stiffness:420, damping:28 }}
            onClick={e => e.stopPropagation()}
            style={{ position:"fixed", top:colorPickerPos.top, left:colorPickerPos.left, zIndex:200, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:152 }}
          >
            {(() => {
              const entry = entries.find(e => e.id === colorPickerEntryId);
              const entryColor = entry?.color;
              return (
                <>
                  <button onClick={() => { updateEntryColor(colorPickerEntryId, undefined); setColorPickerEntryId(null); }}
                    title={t("noColor")}
                    style={{ width:20, height:20, borderRadius:999, background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", border: !entryColor ? "2.5px solid var(--text)" : `2.5px solid ${dark?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.12)"}`, cursor:"pointer", position:"relative" }}
                  >
                    <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
                  </button>
                  {APPLE_COLORS.map(ac => {
                    const hex = dark ? ac.dark : ac.light;
                    return (
                      <button key={ac.key} onClick={() => { updateEntryColor(colorPickerEntryId, hex); setColorPickerEntryId(null); }}
                        title={ac.label}
                        style={{ width:20, height:20, borderRadius:999, background:hex, border: entryColor===hex ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms ease", boxShadow: (ac.key==="white" || ac.key==="grey") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }}
                      />
                    );
                  })}
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

// ─── NotesPanel ───────────────────────────────────────────────────────────────

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: "rgba(255,204,0,0.45)", color: "inherit", borderRadius: 3, padding: "0 1px" }}>{part}</mark>
          : part
      )}
    </>
  );
}

function NotesPanel({ notes, weeks, resolvedQuarters, dark, modalBg, onOpenNote, onAddNote, onDeleteDayNotes, onClose }: {
  notes: Record<string, NoteEntry[]>;
  weeks: { weekStart: Date; days: Date[] }[];
  resolvedQuarters: Quarter[];
  dark: boolean; modalBg: string;
  onOpenNote: (key: string) => void;
  onAddNote: (dk: string, entry: NoteEntry) => void;
  onDeleteDayNotes: (dk: string) => void;
  onClose: () => void;
}) {
  const { t, months, lang } = React.useContext(LangContext);
  const [query, setQuery] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftDate, setDraftDate] = useState(dateKey(new Date()));
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const [hoveredDk, setHoveredDk] = useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const q = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    const qGroups: { dateKey: string; entries: NoteEntry[] }[][] = [[], [], [], []];
    const dateToQi: Record<string, number> = {};
    weeks.forEach((w, wi) => {
      const qi = Math.min(3, Math.floor(wi / WEEKS_PER_QUARTER));
      w.days.forEach(d => { dateToQi[dateKey(d)] = qi; });
    });
    for (const [dk, allEntries] of Object.entries(notes)) {
      const entries = q
        ? allEntries.filter(e => e.text.toLowerCase().includes(q))
        : allEntries;
      if (!entries.length) continue;
      const qi = dateToQi[dk] ?? -1;
      if (qi >= 0) qGroups[qi]!.push({ dateKey: dk, entries });
    }
    qGroups.forEach(g => g.sort((a, b) => a.dateKey.localeCompare(b.dateKey)));
    return qGroups;
  }, [notes, weeks, q]);

  const totalCount = grouped.reduce((s, g) => s + g.length, 0);
  const allDaysCount = useMemo(() => {
    let n = 0;
    const dateToQi: Record<string, number> = {};
    weeks.forEach((w, wi) => {
      const qi = Math.min(3, Math.floor(wi / WEEKS_PER_QUARTER));
      w.days.forEach(d => { dateToQi[dateKey(d)] = qi; });
    });
    for (const [dk, entries] of Object.entries(notes)) {
      if (entries.length && dateToQi[dk] !== undefined) n++;
    }
    return n;
  }, [notes, weeks]);

  const formatDate = (dk: string) => {
    const [, m, d] = dk.split("-").map(Number);
    return `${d} ${months[m! - 1]}`;
  };

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.34)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}
      onClick={onClose}
    >
      <motion.div layout initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md flex flex-col"
        style={{ background: modalBg, backdropFilter: "saturate(180%) blur(28px)", WebkitBackdropFilter: "saturate(180%) blur(28px)", borderRadius: 22, boxShadow: "0 24px 70px rgba(0,0,0,0.24)", border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`, overflow: "hidden", maxHeight: "82vh" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 650, letterSpacing: "-0.01em", color: "var(--text)" }}>{t("allNotes")}</h2>
              {allDaysCount > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", borderRadius: 8, padding: "2px 7px" }}>{allDaysCount}</span>
              )}
            </div>
            <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer", flexShrink:0 }}>✕</button>
          </div>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none", display: "flex" }}>
              <SearchIcon />
            </div>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("notesSearchPlaceholder")}
              style={{ width: "100%", paddingLeft: 34, paddingRight: query ? 30 : 12, paddingTop: 8, paddingBottom: 8, borderRadius: 10, background: inputBg, border: `1px solid ${borderColor}`, fontSize: 13, color: "var(--text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            {query && (
              <button onClick={() => setQuery("")}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
            )}
          </div>
        </div>

        {/* Add note form */}
        <div style={{ padding: "12px 20px 14px", borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 9, alignItems: "center" }}>
            <button onClick={() => setDraftColor(null)} title={t("noColor")}
              style={{ width: 20, height: 20, borderRadius: 999, background: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)", border: draftColor === null ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor: "pointer", transition: "border 120ms ease", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>
              ∅
            </button>
            {APPLE_COLORS.map(ac => {
              const c = dark ? ac.dark : ac.light;
              return (
                <button key={ac.key} onClick={() => setDraftColor(c)} title={ac.label}
                  style={{ width: 20, height: 20, borderRadius: 999, background: c, border: draftColor === c ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor: "pointer", transition: "border 120ms ease", flexShrink: 0, boxShadow: (ac.key === "white" || ac.key === "grey") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }}
                />
              );
            })}
          </div>
          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            placeholder={t("notePlaceholder")}
            rows={2}
            style={{ width: "100%", borderRadius: 10, border: `1px solid ${borderColor}`, background: draftColor ? (dark ? `color-mix(in srgb, ${draftColor} 14%, ${inputBg})` : `color-mix(in srgb, ${draftColor} 10%, rgba(255,255,255,0.9))`) : inputBg, color: "var(--text)", fontSize: 13, padding: "8px 10px", fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box", display: "block", marginBottom: 8, transition: "background 200ms ease" }}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draftText.trim()) {
                e.preventDefault();
                onAddNote(draftDate, { id: makeId(), text: draftText.trim(), createdAt: Date.now(), color: draftColor ?? undefined });
                setDraftText(""); setDraftColor(null); setDraftDate(dateKey(new Date()));
              }
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} lang={lang}
              style={{ flex: 1, borderRadius: 9, border: `1px solid ${borderColor}`, background: inputBg, color: "var(--text)", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }}
            />
            <button
              onClick={() => {
                if (!draftText.trim()) return;
                onAddNote(draftDate, { id: makeId(), text: draftText.trim(), createdAt: Date.now(), color: draftColor ?? undefined });
                setDraftText(""); setDraftColor(null); setDraftDate(dateKey(new Date()));
              }}
              disabled={!draftText.trim()}
              style={{ height: 34, paddingInline: 16, borderRadius: 9, border: "none", background: draftText.trim() ? "linear-gradient(135deg,#5ed47b 0%,#34c759 100%)" : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"), color: draftText.trim() ? "white" : "var(--text-tertiary)", fontWeight: 600, fontSize: 13, cursor: draftText.trim() ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap" as const, transition: "background 150ms, color 150ms" }}>
              {t("add")}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {allDaysCount === 0 && !draftText ? (
            <p style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, padding: "24px 0", margin: 0 }}>{t("noNotesAtAll")}</p>
          ) : totalCount === 0 && q ? (
            <p style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, padding: "24px 0", margin: 0 }}>{t("searchNoResults")}</p>
          ) : (
            grouped.map((group, qi) => {
              if (group.length === 0) return null;
              const quarter = resolvedQuarters[qi]!;
              return (
                <div key={qi}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: quarter.tint, border: `2px solid ${quarter.border}`, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)" }}>{quarter.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>{group.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {group.map(({ dateKey: dk, entries }) => (
                      <div key={dk} style={{ position: "relative" }}
                        onMouseEnter={() => setHoveredDk(dk)}
                        onMouseLeave={() => setHoveredDk(null)}
                      >
                        <button onClick={() => { onOpenNote(dk); onClose(); }}
                          style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 36px 10px 12px", borderRadius: 12, background: hoveredDk === dk ? (dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)") : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"), border: `1px solid ${borderColor}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "background 150ms", width: "100%" }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 600, color: quarter.text, letterSpacing: "0.01em" }}>{formatDate(dk)}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {entries.slice(0, 3).map((e, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                                {e.color && (
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: e.color, flexShrink: 0, opacity: 0.9 }} />
                                )}
                                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                  <HighlightText text={e.text} query={q} />
                                </span>
                              </div>
                            ))}
                            {entries.length > 3 && (
                              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>+{entries.length - 3}</span>
                            )}
                          </div>
                        </button>
                        {hoveredDk === dk && (
                          <button
                            onClick={e => { e.stopPropagation(); onDeleteDayNotes(dk); }}
                            title={t("remove")}
                            style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 6, background: dark ? "rgba(255,59,48,0.18)" : "rgba(255,59,48,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff3b30", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── MilestoneModal ───────────────────────────────────────────────────────────

function MilestoneModal({ milestones, resolvedQuarters, weeks, dark, modalBg, onClose, onChange }: {
  milestones: Milestone[]; resolvedQuarters: Quarter[]; weeks: { weekStart: Date; days: Date[] }[]; dark: boolean; modalBg: string;
  onClose: () => void; onChange: (m: Milestone[]) => void;
}) {
  const { t, lang } = React.useContext(LangContext);
  const [items, setItems] = useState<Milestone[]>(() => [...milestones].sort((a,b) => a.date.localeCompare(b.date)));
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!q) return items;
    return items.filter(ms => ms.label.toLowerCase().includes(q) || (ms.description ?? "").toLowerCase().includes(q));
  }, [items, q]);

  const dateToQi = useMemo(() => {
    const map: Record<string, number> = {};
    weeks.forEach((w, wi) => {
      const qi = Math.min(3, Math.floor(wi / WEEKS_PER_QUARTER));
      w.days.forEach(d => { map[dateKey(d)] = qi; });
    });
    return map;
  }, [weeks]);
  const quarterOf = (dateStr: string) => {
    const known = dateToQi[dateStr];
    if (known !== undefined) return known;
    const m = parseInt(dateStr.split("-")[1]!, 10);
    return Math.ceil(m / 3) - 1;
  };
  const quarterCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    filteredItems.forEach(ms => { counts[quarterOf(ms.date)]!++; });
    return counts;
  }, [filteredItems, dateToQi]);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDate, setDraftDate] = useState(dateKey(new Date()));
  const [draftColor, setDraftColor] = useState(MILESTONE_COLORS[4]!);
  const [draftDesc, setDraftDesc] = useState("");

  const [draftRecurring, setDraftRecurring] = useState(false);

  const [editId, setEditId] = useState<string|null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editColor, setEditColor] = useState(MILESTONE_COLORS[0]!);
  const [editDesc, setEditDesc] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);

  const startEdit = (ms: Milestone) => {
    setEditId(ms.id);
    setEditLabel(ms.label);
    setEditDate(ms.date);
    setEditColor(ms.color);
    setEditDesc(ms.description ?? "");
    setEditRecurring(ms.recurring ?? false);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = () => {
    if (!editLabel.trim()) return;
    setItems(prev => prev.map(ms => ms.id === editId
      ? { ...ms, label: editLabel.trim(), date: editDate, color: editColor, description: editDesc.trim() || undefined, recurring: editRecurring || undefined }
      : ms
    ).sort((a,b) => a.date.localeCompare(b.date)));
    setEditId(null);
  };

  const add = () => {
    if (!draftLabel.trim()) return;
    setItems(prev => [...prev, { id:makeId(), label:draftLabel.trim(), date:draftDate, color:draftColor, description:draftDesc.trim()||undefined, recurring: draftRecurring || undefined }].sort((a,b)=>a.date.localeCompare(b.date)));
    setDraftLabel("");
    setDraftDesc("");
    setDraftRecurring(false);
  };

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputStyle: React.CSSProperties = { background: dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.03)", border:`1px solid ${borderColor}`, borderRadius:8, padding:"7px 10px", fontSize:13, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.34)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      onClick={onClose}
    >
      <motion.div layout initial={{ opacity:0, scale:0.96, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:8 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md"
        style={{ background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)", borderRadius:22, boxShadow:"0 24px 70px rgba(0,0,0,0.24)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden" }}
      >
        <div className="px-6 pt-6 pb-3 flex items-center justify-between">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <h2 className="text-base font-semibold" style={{ color:"var(--text)", letterSpacing:"-0.01em" }}>{t("milestones")}</h2>
            {items.length > 0 && (
              <span style={{ fontSize:11, fontWeight:600, color:"var(--text-tertiary)", background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", borderRadius:8, padding:"2px 7px" }}>
                {q ? filteredItems.length : items.length}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer" }}>✕</button>
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
          <div style={{ position:"relative" }}>
            <div style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-tertiary)", pointerEvents:"none", display:"flex" }}>
              <SearchIcon />
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("eventsSearchPlaceholder")}
              style={{ ...inputStyle, width:"100%", paddingLeft:34, paddingRight: query ? 30 : 12 }}
            />
            {query && (
              <button onClick={() => setQuery("")}
                style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text-tertiary)", fontSize:14, lineHeight:1, padding:2 }}>×</button>
            )}
          </div>
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
            <input value={draftLabel} onChange={e => setDraftLabel(e.target.value)} placeholder={t("labelPlaceholder")}
              onKeyDown={e => { if (e.key==="Enter") add(); }}
              style={{ ...inputStyle, flex:2, width:"auto" }}
            />
            <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)}
              lang={lang} style={{ ...inputStyle, flex:1, width:"auto" }}
            />
            <button onClick={add} disabled={!draftLabel.trim()}
              style={{ height:36, paddingInline:14, borderRadius:9, background: draftLabel.trim()?"#007aff":"rgba(128,128,128,0.15)", color: draftLabel.trim()?"white":"var(--text-tertiary)", fontSize:13, fontWeight:600, border:"none", cursor: draftLabel.trim()?"pointer":"default", fontFamily:"inherit", flexShrink:0, transition:"background 150ms" }}>
              {t("add")}
            </button>
          </div>
          <div style={{ position:"relative" }}>
            <textarea value={draftDesc} onChange={e => setDraftDesc(e.target.value.slice(0,300))}
              placeholder={t("descPlaceholder")} rows={2}
              style={{ ...inputStyle, width:"100%", resize:"none", lineHeight:1.5, borderRadius:10, padding:"8px 10px", paddingBottom:18 }}
            />
            <span style={{ position:"absolute", bottom:6, right:10, fontSize:10, color:"var(--text-tertiary)", pointerEvents:"none" }}>
              {draftDesc.length}/300
            </span>
          </div>
          <label className="flex items-center gap-1.5 mt-2 cursor-pointer select-none" style={{ width:"fit-content" }}>
            <input type="checkbox" checked={draftRecurring} onChange={e => setDraftRecurring(e.target.checked)}
              style={{ width:13, height:13, accentColor:"#007aff", cursor:"pointer" }}
            />
            <span className="text-[12px]" style={{ color:"var(--text-secondary)" }}>{t("repeatYearly")}</span>
          </label>
        </div>

        {/* List */}
        <div className="px-6 max-h-64 overflow-y-auto">
          {items.length === 0 && (
            <div className="py-6 text-center text-[13px]" style={{ color:"var(--text-tertiary)" }}>{t("noMilestones")}</div>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <div className="py-6 text-center text-[13px]" style={{ color:"var(--text-tertiary)" }}>{t("searchNoResults")}</div>
          )}
          <div className="flex flex-col gap-1.5 pb-3">
            {filteredItems.map((ms, _msIdx) => {
              const [y2,m2,d2] = ms.date.split("-").map(Number) as [number,number,number];
              const lbl = new Date(y2,m2-1,d2).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month:"short", day:"numeric", year:"numeric" });
              const isEditing = editId === ms.id;
              const _q = quarterOf(ms.date);
              const _prevMs = filteredItems[_msIdx - 1];
              const _prevQ = _prevMs ? quarterOf(_prevMs.date) : -1;
              const _showQHeader = _q !== _prevQ;
              return (
                <React.Fragment key={ms.id}>
                  {_showQHeader && (
                    <div className="flex items-center gap-1.5 pt-1.5 pb-0 px-0.5">
                      <span style={{ width:8, height:8, borderRadius:"50%", background: resolvedQuarters[_q]?.tint, border:`2px solid ${resolvedQuarters[_q]?.border}`, flexShrink:0, display:"inline-block" }} />
                      <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"var(--text-tertiary)" }}>
                        {resolvedQuarters[_q]?.label ?? t("q" + String(_q + 1))}
                      </span>
                      <span className="text-[10px]" style={{ color:"var(--text-tertiary)" }}>· {quarterCounts[_q]}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 px-2.5 py-2.5 rounded-xl"
                    style={{ background: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.025)", border:`1px solid ${isEditing ? ms.color+"66" : borderColor}`, transition:"border 150ms" }}
                  >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      {/* Edit color row */}
                      <div className="flex gap-1 flex-wrap">
                        {MILESTONE_COLORS.map(c => (
                          <button key={c} onClick={() => setEditColor(c)}
                            style={{ width:16, height:16, borderRadius:999, background:c, border: editColor===c ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms" }}
                          />
                        ))}
                      </div>
                      {/* Edit label + date row */}
                      <div className="flex gap-2">
                        <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                          onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") cancelEdit(); }}
                          placeholder={t("labelPlaceholder")} autoFocus
                          style={{ ...inputStyle, flex:2, width:"auto" }}
                        />
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          lang={lang} style={{ ...inputStyle, flex:1, width:"auto" }}
                        />
                      </div>
                      {/* Edit description */}
                      <div style={{ position:"relative" }}>
                        <textarea value={editDesc} onChange={e => setEditDesc(e.target.value.slice(0,300))}
                          placeholder={t("editDescPlaceholder")} rows={2}
                          style={{ ...inputStyle, width:"100%", resize:"none", lineHeight:1.5, borderRadius:10, padding:"7px 10px", paddingBottom:18 }}
                        />
                        <span style={{ position:"absolute", bottom:6, right:10, fontSize:10, color:"var(--text-tertiary)", pointerEvents:"none" }}>{editDesc.length}/300</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ width:"fit-content" }}>
                        <input type="checkbox" checked={editRecurring} onChange={e => setEditRecurring(e.target.checked)}
                          style={{ width:13, height:13, accentColor:"#007aff", cursor:"pointer" }}
                        />
                        <span className="text-[12px]" style={{ color:"var(--text-secondary)" }}>{t("repeatYearly")}</span>
                      </label>
                      {/* Edit action row */}
                      <div className="flex gap-2">
                        <button onClick={cancelEdit}
                          style={{ flex:1, height:30, borderRadius:8, border:`1px solid ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                          {t("cancel")}
                        </button>
                        <button onClick={saveEdit} disabled={!editLabel.trim()}
                          style={{ flex:2, height:30, borderRadius:8, border:"none", background: editLabel.trim()?"#007aff":"rgba(128,128,128,0.15)", color: editLabel.trim()?"white":"var(--text-tertiary)", fontSize:12, fontWeight:600, cursor: editLabel.trim()?"pointer":"default", fontFamily:"inherit" }}>
                          {t("saveChanges")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <div style={{ width:10, height:10, borderRadius:999, background:ms.color, flexShrink:0 }} />
                        <span className="flex-1 text-[13px] font-medium" style={{ color:"var(--text)" }}><HighlightText text={ms.label} query={q} /></span>
                        {ms.recurring && <span title={t("repeatYearly")} style={{ fontSize:11, color:"var(--text-tertiary)", flexShrink:0 }}>↻</span>}
                        <span className="text-[11px] tabular-nums" style={{ color:"var(--text-tertiary)" }}>{lbl}</span>
                        <button onClick={() => startEdit(ms)} title={t("edit")}
                          style={{ color:"var(--text-secondary)", background:"none", border:"none", cursor:"pointer", fontSize:13, lineHeight:1, padding:"0 2px", opacity:0.7, display:"inline-flex", transform:"scaleX(-1)" }}>✎</button>
                        <button onClick={() => setItems(prev => prev.filter(x => x.id!==ms.id))}
                          style={{ color:"#ff3b30", background:"none", border:"none", cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 2px" }}>×</button>
                      </div>
                      {ms.description && (
                        <p className="text-[11px] leading-snug ml-5" style={{ color:"var(--text-tertiary)", margin:0 }}><HighlightText text={ms.description} query={q} /></p>
                      )}
                    </>
                  )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 flex gap-2.5 justify-end" style={{ borderTop:`1px solid ${borderColor}` }}>
          <button onClick={onClose} style={{ height:36, paddingInline:16, borderRadius:10, border:"1px solid var(--border-soft)", background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{t("cancel")}</button>
          <button onClick={() => { onChange(items); onClose(); }}
            style={{ height:36, paddingInline:20, borderRadius:10, border:"none", background:"linear-gradient(135deg,#5ed47b 0%,#34c759 100%)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 8px rgba(52,199,89,0.35)" }}>{t("save")}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── GoalsModal ───────────────────────────────────────────────────────────────

function GoalsModal({ blockId:_bid, blockLabel, initial, dark, modalBg, onSave, onClose }: {
  blockId: string; blockLabel: string; initial: BlockGoals; dark: boolean; modalBg: string;
  onSave: (bg: BlockGoals, label: string) => void; onClose: () => void;
}) {
  const { t } = React.useContext(LangContext);
  const [label, setLabel] = useState(blockLabel);
  const [description, setDescription] = useState(initial.description);
  const [goals, setGoals] = useState<Goal[]>(() => initial.goals.length > 0 ? initial.goals.map(g=>({...g})) : [{ id:makeId(), text:"", done:false }]);
  const activeGoals = goals.filter(g => g.text.trim());
  const canAdd = goals.length < 10;

  const save = () => onSave({ description:description.trim(), goals: goals.filter(g=>g.text.trim()) }, label.trim() || blockLabel);

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.03)";

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.32)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      onClick={onClose}
    >
      <motion.div layout initial={{ opacity:0, scale:0.96, y:12 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:8 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-sm"
        style={{ background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)", borderRadius:22, boxShadow:"0 24px 70px rgba(0,0,0,0.22)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden" }}
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color:"var(--text-tertiary)" }}>{t("sprintGoals")}</div>
            <input
              value={label} onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
              style={{ width:"100%", background:"transparent", border:"none", outline:"none", fontSize:15, fontWeight:600, letterSpacing:"-0.01em", color:"var(--text)", fontFamily:"inherit", padding:0 }}
            />
          </div>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer", flexShrink:0 }}>✕</button>
        </div>

        <div className="px-5 pb-3">
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0,200))}
            placeholder={t("sprintDescPlaceholder")} rows={2}
            style={{ width:"100%", resize:"none", outline:"none", border:`1px solid ${borderColor}`, borderRadius:10, padding:"8px 10px", fontSize:13, lineHeight:1.5, fontFamily:"inherit", background:inputBg, color:"var(--text)", boxSizing:"border-box" }}
          />
        </div>

        <div className="px-5 pb-3">
          <div className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color:"var(--text-tertiary)" }}>
            {t("goalsLabel")} ({activeGoals.length}/10)
          </div>
          <div className="flex flex-col gap-1.5">
            {goals.map((g, idx) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className="text-[11px] tabular-nums w-4 text-right shrink-0" style={{ color:"var(--text-tertiary)" }}>{idx+1}.</span>
                <input value={g.text} onChange={e => setGoals(prev => prev.map(x => x.id===g.id ? { ...x, text:e.target.value } : x))}
                  placeholder={`${t("goalPlaceholder")} ${idx+1}`}
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
              + {t("addGoal")}
            </button>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2.5">
          <button onClick={onClose} style={{ flex:1, height:36, borderRadius:10, border:`1px solid ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{t("cancel")}</button>
          <button onClick={save} style={{ flex:2, height:36, borderRadius:10, border:"none", background:"linear-gradient(135deg,#5ed47b 0%,#34c759 100%)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 8px rgba(52,199,89,0.35)" }}>{t("saveGoals")}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ open, onClose, onConfirm, message, confirmLabel, dark }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  message: string; confirmLabel: string; dark: boolean;
}) {
  const { t } = React.useContext(LangContext);
  const modalBg = dark ? "rgba(28,28,30,0.97)" : "rgba(255,255,255,0.97)";
  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-overlay"
          className="fixed inset-0 flex items-center justify-center p-6"
          style={{ zIndex: 60 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", backdropFilter:"blur(10px) saturate(160%)", WebkitBackdropFilter:"blur(10px) saturate(160%)" }}
          />
          <motion.div
            key="confirm-card"
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{
              position: "relative",
              width: "min(92vw, 320px)",
              background: modalBg,
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              borderRadius: 20,
              padding: "20px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.08)",
              border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
              display: "flex", flexDirection: "column", gap: 16,
            }}
          >
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <span style={{ color:"#ff3b30", flexShrink:0, marginTop:2 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              <p style={{ fontSize:13, lineHeight:1.55, color:"var(--text-secondary)", margin:0 }}>{message}</p>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button type="button" onClick={onClose}
                style={{ padding:"7px 16px", borderRadius:10, fontSize:13, fontWeight:500, background: dark?"rgba(255,255,255,0.10)":"rgba(0,0,0,0.07)", color:"var(--text-secondary)", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                {t("cancel")}
              </button>
              <button type="button" onClick={() => { onConfirm(); onClose(); }}
                style={{ padding:"7px 16px", borderRadius:10, fontSize:13, fontWeight:600, background:"#ff3b30", color:"white", border:"none", cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 10px rgba(255,59,48,0.4)" }}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── FactoryResetDialog ───────────────────────────────────────────────────────

function FactoryResetDialog({ open, onClose, onConfirm, dark }: {
  open: boolean; onClose: () => void; onConfirm: () => void; dark: boolean;
}) {
  const { t } = React.useContext(LangContext);
  const [step, setStep] = useState(1);
  const modalBg = dark ? "rgba(28,28,30,0.97)" : "rgba(255,255,255,0.97)";

  useEffect(() => { if (open) setStep(1); }, [open]);

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="factory-reset-overlay"
          className="fixed inset-0 flex items-center justify-center p-6"
          style={{ zIndex: 60 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", backdropFilter:"blur(10px) saturate(160%)", WebkitBackdropFilter:"blur(10px) saturate(160%)" }} />
          <motion.div
            key="factory-reset-card"
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{
              position: "relative",
              width: "min(92vw, 340px)",
              background: modalBg,
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              borderRadius: 20,
              padding: "20px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.08)",
              border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
              display: "flex", flexDirection: "column", gap: 16, overflow: "hidden",
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div key="step1"
                  initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}
                  transition={{ type:"spring", stiffness:420, damping:32 }}
                  style={{ display:"flex", flexDirection:"column", gap:14 }}
                >
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                    <span style={{ color:"#ff9500", flexShrink:0, marginTop:2 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </span>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"#ff9500", letterSpacing:"0.06em", textTransform:"uppercase" }}>{t("factoryResetWarn1Title")}</span>
                      <p style={{ fontSize:13, lineHeight:1.55, color:"var(--text-secondary)", margin:0 }}>{t("factoryResetWarn1")}</p>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                    <button type="button" onClick={onClose}
                      style={{ padding:"7px 16px", borderRadius:10, fontSize:13, fontWeight:500, background: dark?"rgba(255,255,255,0.10)":"rgba(0,0,0,0.07)", color:"var(--text-secondary)", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                      {t("cancel")}
                    </button>
                    <button type="button" onClick={() => setStep(2)}
                      style={{ padding:"7px 16px", borderRadius:10, fontSize:13, fontWeight:600, background:"#ff9500", color:"white", border:"none", cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 10px rgba(255,149,0,0.4)" }}>
                      {t("nextStep")}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="step2"
                  initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}
                  transition={{ type:"spring", stiffness:420, damping:32 }}
                  style={{ display:"flex", flexDirection:"column", gap:14 }}
                >
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                    <span style={{ color:"#ff3b30", flexShrink:0, marginTop:2 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </span>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"#ff3b30", letterSpacing:"0.06em", textTransform:"uppercase" }}>{t("factoryResetWarn2Title")}</span>
                      <p style={{ fontSize:13, lineHeight:1.55, color:"var(--text-secondary)", margin:0 }}>{t("factoryResetWarn2")}</p>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                    <button type="button" onClick={() => setStep(1)}
                      style={{ padding:"7px 16px", borderRadius:10, fontSize:13, fontWeight:500, background: dark?"rgba(255,255,255,0.10)":"rgba(0,0,0,0.07)", color:"var(--text-secondary)", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                      {t("back")}
                    </button>
                    <button type="button" onClick={() => { onConfirm(); onClose(); }}
                      style={{ padding:"7px 16px", borderRadius:10, fontSize:13, fontWeight:600, background:"#ff3b30", color:"white", border:"none", cursor:"pointer", fontFamily:"inherit", boxShadow:"0 2px 10px rgba(255,59,48,0.4)" }}>
                      {t("factoryResetBtn")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── SprintSettingsModal ──────────────────────────────────────────────────────

function SprintSettingsModal({ quarterIndex:_qi, quarter, initial, dark, modalBg, onClose, onSave, onResetBlock }: {
  quarterIndex: number; quarter: Quarter; initial: QuarterConfig; dark: boolean; modalBg: string;
  onClose: () => void; onSave: (next: QuarterConfig) => void; onResetBlock: (blockId: string) => void;
}) {
  const { t } = React.useContext(LangContext);
  const [blocks, setBlocks] = useState<Block[]>(() => initial.blocks.map(b => ({ ...b })));
  const total = blocks.reduce((a,b) => a+(Number(b.weeks)||0), 0);
  const remaining = WEEKS_PER_QUARTER - total;
  const valid = total===WEEKS_PER_QUARTER && blocks.every(b => b.weeks>=1);
  const update = (id: string, patch: Partial<Block>) => setBlocks(prev => prev.map(b => b.id===id ? { ...b, ...patch } : b));
  const applyPreset = (parts: number[]) => setBlocks(parts.map((w,i) => ({ id:makeId(), weeks:w, label:`${t("sprintLabel")} ${i+1}` })));
  const [colorPickerAnchor, setColorPickerAnchor] = useState<{ id:string; rect: DOMRect } | null>(null);
  const activeColorPickerBlock = colorPickerAnchor ? blocks.find(b => b.id === colorPickerAnchor.id) : null;
  const [confirmResetId, setConfirmResetId] = useState<string|null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null);

  const borderColor = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  return (
    <>
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
            <h2 className="text-base font-semibold tracking-tight" style={{ color:"var(--text)", letterSpacing:"-0.01em" }}>{t("sprintConfig")}</h2>
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color:"var(--text-secondary)" }}>{t("sprintConfigDescription").replace("{quarter}", quarter.label)}</p>
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

        {colorPickerAnchor !== null && <div style={{ position:"fixed", inset:0, zIndex:49 }} onClick={() => setColorPickerAnchor(null)} />}
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
                      <button type="button" onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setColorPickerAnchor(prev => prev?.id === b.id ? null : { id: b.id, rect });
                      }}
                        title={t("sprintColor")}
                        style={{ width:16, height:16, borderRadius:999, background: bHex, border:`2px solid ${dark?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.12)"}`, cursor:"pointer", display:"block" }}
                      />
                    </div>
                    {/* Number badge */}
                    <div className="text-[10px] font-semibold tabular-nums flex items-center justify-center"
                      style={{ width:20, height:20, borderRadius:999, background: bAc ? `${bHex}22` : (dark?quarter.darkTint:quarter.tint), color: bAc ? bHex : quarter.text, flexShrink:0 }}>{idx+1}</div>
                    <input type="text" value={b.label} onChange={e => update(b.id, { label:e.target.value })} placeholder={t("sprintLabelPlaceholder")}
                      className="flex-1 bg-transparent outline-none text-[13px]" style={{ color:"var(--text)" }} />
                    <div className="flex items-center gap-1" style={{ background: dark?"rgba(255,255,255,0.06)":"white", border:`1px solid ${borderColor}`, borderRadius:8, padding:2 }}>
                      <button type="button" onClick={() => update(b.id, { weeks:Math.max(1,b.weeks-1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color:"var(--text-secondary)" }}>−</button>
                      <span className="text-[12px] font-semibold tabular-nums w-6 text-center" style={{ color:"var(--text)" }}>{b.weeks}</span>
                      <button type="button" onClick={() => update(b.id, { weeks:Math.min(WEEKS_PER_QUARTER,b.weeks+1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color:"var(--text-secondary)" }}>+</button>
                    </div>
                    <button type="button" title={t("resetSprint")} onClick={() => setConfirmResetId(b.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ color:"#ff3b30", flexShrink:0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(b.id)} disabled={blocks.length===1}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ color: blocks.length===1?"var(--text-tertiary)":"#ff3b30", opacity: blocks.length===1?0.4:1 }}>
                      <TrashIcon />
                    </button>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>

            {colorPickerAnchor && activeColorPickerBlock && typeof document !== "undefined" && ReactDOM.createPortal(
              <AnimatePresence>
                <motion.div initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.94, y:-4 }}
                  transition={{ type:"spring", stiffness:420, damping:28 }} onClick={e => e.stopPropagation()}
                  style={{
                    position:"fixed",
                    top: (() => {
                      const below = colorPickerAnchor.rect.bottom + 6;
                      const popupHeight = 220;
                      if (below + popupHeight <= window.innerHeight) return Math.max(8, below);
                      return Math.max(8, Math.min(colorPickerAnchor.rect.top - popupHeight - 6, window.innerHeight - popupHeight - 8));
                    })(),
                    left: Math.min(Math.max(8, colorPickerAnchor.rect.left), window.innerWidth - 168),
                    zIndex:60,
                    background:modalBg,
                    backdropFilter:"blur(20px)",
                    WebkitBackdropFilter:"blur(20px)",
                    borderRadius:12,
                    padding:8,
                    boxShadow:"0 8px 32px rgba(0,0,0,0.26)",
                    border:"1px solid var(--border-soft)",
                    display:"flex",
                    flexWrap:"wrap",
                    gap:5,
                    width:160,
                  }}
                >
                  <button type="button" onClick={() => { update(activeColorPickerBlock.id, { color: undefined }); setColorPickerAnchor(null); }}
                    title={t("quarterDefault")}
                    style={{ width:20, height:20, borderRadius:999, background:"transparent", border: !activeColorPickerBlock.color ? "2.5px solid var(--text)" : "2.5px solid var(--border-soft)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--text-tertiary)" }}>✕</button>
                  {APPLE_COLORS.map(ac => (
                    <button key={ac.key} type="button" onClick={() => { update(activeColorPickerBlock.id, { color: ac.key }); setColorPickerAnchor(null); }}
                      title={ac.label}
                      style={{ width:20, height:20, borderRadius:999, background: dark ? ac.dark : ac.light, border: activeColorPickerBlock.color===ac.key ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms ease", boxShadow: (ac.key==="white" || ac.key==="grey") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>, document.body)
            }
            <button type="button" onClick={() => setBlocks(prev => [...prev, { id:makeId(), weeks:Math.max(1,remaining>0?remaining:1), label:`${t("sprintLabel")} ${prev.length+1}` }])}
              disabled={remaining<1} className="text-[12px] font-medium mt-1 self-start"
              style={{ padding:"6px 12px", borderRadius:10, color: remaining<1?"var(--text-tertiary)":quarter.text, background: remaining<1?(dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)"):(dark?quarter.darkTint:quarter.tint), border:`1px solid ${remaining<1?borderColor:(dark?quarter.darkSoft:quarter.soft)}`, opacity: remaining<1?0.6:1 }}>
              + {t("addSprint")}
            </button>
          </div>
        </div>

        <div className="px-6 mt-4">
          <div className="flex items-center justify-between text-[12px] tabular-nums px-3 py-2.5 rounded-xl"
            style={{ background: valid?"rgba(52,199,89,0.08)":"rgba(255,59,48,0.07)", color: valid?"#28a745":"#c00", border:`1px solid ${valid?"rgba(52,199,89,0.2)":"rgba(255,59,48,0.2)"}` }}>
            <span>{t("total")}: {total} / {WEEKS_PER_QUARTER} {t("week")}</span>
            <span>{valid ? t("looksGood") : remaining>0 ? `${remaining} ${t("week")} ${t("unassigned")}` : `${-remaining} ${t("week")} ${t("over")}`}</span>
          </div>
        </div>

        <div className="px-6 py-5 mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-[13px] font-medium"
            style={{ padding:"8px 14px", borderRadius:10, color:"var(--text-secondary)", background:"transparent" }}>{t("cancel")}</button>
          <button type="button" onClick={() => valid && onSave({ blocks })} disabled={!valid} className="text-[13px] font-semibold"
            style={{ padding:"8px 16px", borderRadius:10, color:"white", background: valid?"linear-gradient(180deg,#5ed47b 0%,#34c759 100%)":"rgba(128,128,128,0.2)", boxShadow: valid?"0 1px 2px rgba(40,167,69,0.25)":"none", cursor: valid?"pointer":"not-allowed" }}>
            {t("saveSprints")}
          </button>
        </div>
      </motion.div>
    </motion.div>

    <ConfirmDialog
      open={confirmResetId !== null}
      onClose={() => setConfirmResetId(null)}
      onConfirm={() => { if (confirmResetId) onResetBlock(confirmResetId); }}
      message={t("resetSprintConfirm")}
      confirmLabel={t("resetSprintBtn")}
      dark={dark}
    />
    <ConfirmDialog
      open={confirmDeleteId !== null}
      onClose={() => setConfirmDeleteId(null)}
      onConfirm={() => { if (confirmDeleteId) setBlocks(prev => prev.filter(x => x.id !== confirmDeleteId)); }}
      message={t("deleteSprintConfirm")}
      confirmLabel={t("deleteSprintBtn")}
      dark={dark}
    />
    </>
  );
}

// ─── LifeCalendarModal ────────────────────────────────────────────────────────

function LifeCalendarModal({ dark, modalBg, settings, onSettingsChange, onClose }: {
  dark: boolean; modalBg: string;
  settings: LifeSettings;
  onSettingsChange: (s: LifeSettings) => void;
  onClose: () => void;
}) {
  const { t, lang } = React.useContext(LangContext);
  const [view, setView] = useState<LifeView>("weeks");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lifespanDraft, setLifespanDraft] = useState(String(settings.lifespan));

  const handleSetView = (v: LifeView) => {
    if (v !== "days") setIsFullscreen(false);
    setView(v);
  };

  const today = useMemo(() => startOfDay(new Date()), []);
  const birthDate = useMemo(() => {
    if (!settings.birthDate) return null;
    return startOfDay(new Date(settings.birthDate + "T00:00:00"));
  }, [settings.birthDate]);

  const ageDays = useMemo(() => birthDate ? Math.max(0, daysBetween(birthDate, today)) : 0, [birthDate, today]);
  const lifespanDays = settings.lifespan * 365.25;
  const pct = Math.min(100, (ageDays / lifespanDays) * 100);
  const ageYears = Math.floor(ageDays / 365.25);
  const ageMonths = Math.floor((ageDays % 365.25) / 30.44);
  const remainingDays = Math.max(0, lifespanDays - ageDays);
  const remainingYears = Math.floor(remainingDays / 365.25);
  const remainingMonths = Math.floor((remainingDays % 365.25) / 30.44);

  const { cols, cellPx, gapPx, totalUnits, currentUnit } = useMemo(() => {
    const gridH = Math.max(160, Math.round(window.innerHeight * 0.95) - 320);
    const gridW = Math.max(200, Math.min(window.innerWidth * 0.94, 560) - 48);
    const ls = settings.lifespan;
    let c: number, gap: number, total: number, curr: number;
    switch (view) {
      case "years":  c = 10;  gap = 3; total = ls;       curr = Math.floor(ageDays / 365.25); break;
      case "months": c = 12;  gap = 1; total = ls * 12;  curr = Math.floor(ageDays / 30.44);  break;
      case "weeks":  c = 52;  gap = 1; total = ls * 52;  curr = Math.floor(ageDays / 7);      break;
      default:       c = 0;   gap = 1; total = ls * 365; curr = ageDays;                      break;
    }
    let cell: number;
    if (view === "days") {
      cell = 5;
    } else {
      const rows = Math.ceil(total / c);
      const fromH = (gridH - gap * Math.max(0, rows - 1)) / rows;
      const fromW = (gridW - gap * Math.max(0, c - 1)) / c;
      cell = Math.max(1, Math.floor(Math.min(fromH, fromW)));
    }
    return { cols: c, cellPx: cell, gapPx: gap, totalUnits: total, currentUnit: curr };
  }, [view, settings.lifespan, ageDays]);

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)";
  const inputStyle: React.CSSProperties = {
    background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
    border: `1px solid ${borderColor}`,
    borderRadius: 8, padding: "7px 10px", fontSize: 13,
    color: "var(--text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const viewLabels: Record<LifeView, string> = { years: t("years"), months: t("months"), weeks: t("weeks"), days: t("days") };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.40)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)" }}
      onClick={onClose}
    >
      <motion.div layout initial={{ opacity:0, scale:0.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.96, y:12 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        style={{
          width: isFullscreen ? "100vw" : "min(96vw,560px)",
          height: isFullscreen ? "100vh" : undefined,
          maxWidth: isFullscreen ? "100%" : undefined,
          maxHeight: isFullscreen ? "100%" : "96vh",
          borderRadius: isFullscreen ? 0 : 24,
          background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)",
          boxShadow:"0 24px 80px rgba(0,0,0,0.28)",
          border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`,
          overflow:"hidden", display:"flex", flexDirection:"column",
          transition:"width 0.3s ease-in-out, height 0.3s ease-in-out, border-radius 0.3s ease-in-out, max-height 0.3s ease-in-out",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"var(--text-tertiary)" }}>{t("overview")}</div>
            <h2 className="text-[17px] font-semibold mt-0.5" style={{ color:"var(--text)", letterSpacing:"-0.02em" }}>{t("lifeCalendarBtn")}</h2>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer" }}>✕</button>
        </div>

        {/* Settings row */}
        <div className="px-6 pb-4 shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-medium tracking-wide uppercase" style={{ color:"var(--text-tertiary)" }}>{t("dateOfBirth")}</label>
              <input type="date" value={settings.birthDate}
                onChange={e => onSettingsChange({ ...settings, birthDate: e.target.value })}
                lang={lang} style={{ ...inputStyle, width:"100%" }}
              />
            </div>
            <div className="flex flex-col gap-1" style={{ width:130 }}>
              <label className="text-[10px] font-medium tracking-wide uppercase" style={{ color:"var(--text-tertiary)" }}>{t("lifeExpectancy")}</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={lifespanDraft} min={20} max={120}
                  onChange={e => setLifespanDraft(e.target.value)}
                  onBlur={() => {
                    const v = Math.max(20, Math.min(120, Number(lifespanDraft) || 80));
                    setLifespanDraft(String(v));
                    onSettingsChange({ ...settings, lifespan: v });
                  }}
                  style={{ ...inputStyle, flex:1, textAlign:"center" }}
                />
                <span className="text-[12px] shrink-0" style={{ color:"var(--text-tertiary)" }}>{t("yr")}</span>
              </div>
            </div>
          </div>
        </div>

        {birthDate ? (
          <>
            {/* Stats card */}
            <div className="px-6 pb-4 shrink-0">
              <div className="rounded-2xl px-4 py-3" style={{ background:`${LIFE_ACCENT}12`, border:`1px solid ${LIFE_ACCENT}28` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold" style={{ color:LIFE_ACCENT }}>
                    {t("age")}: {ageYears} {t("yr")}{ageMonths > 0 ? ` ${ageMonths} ${t("mo")}` : ""}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color:LIFE_ACCENT }}>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.08)" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${LIFE_ACCENT}cc,${LIFE_ACCENT})`, borderRadius:999, transition:"width 700ms ease" }} />
                </div>
                <div className="mt-1.5 text-[11px] tabular-nums leading-snug" style={{ color:"var(--text-tertiary)" }}>
                  {remainingYears > 0 ? `${remainingYears} ${t("yr")} ${remainingMonths} ${t("mo")} ${t("remaining")} · ` : ""}{t("born")} {new Date(settings.birthDate + "T00:00:00").toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" })}
                </div>
              </div>
            </div>

            {/* View switcher */}
            <div className="px-6 pb-3 shrink-0">
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)" }}>
                {(["years","months","weeks","days"] as LifeView[]).map(v => (
                  <button key={v} onClick={() => handleSetView(v)}
                    className="flex-1 py-1.5 rounded-lg text-[12px] transition-all"
                    style={{
                      background: view===v ? (dark?"rgba(255,255,255,0.13)":"rgba(255,255,255,0.9)") : "transparent",
                      color: view===v ? "var(--text)" : "var(--text-secondary)",
                      border:"none", cursor:"pointer", fontFamily:"inherit",
                      boxShadow: view===v ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                      fontWeight: view===v ? 600 : 400,
                    }}
                  >{viewLabels[v]}</button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="px-6 pb-5" style={{ flex: isFullscreen ? "1 1 0" : "0 0 auto", overflow: "auto", maxHeight: isFullscreen ? undefined : (view === "days" ? 260 : undefined), minHeight: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] tabular-nums" style={{ color:"var(--text-tertiary)" }}>
                  {Math.min(currentUnit, totalUnits).toLocaleString()} {t("of")} {totalUnits.toLocaleString()} {viewLabels[view]} {t("elapsed")}
                </div>
                {view === "days" && (
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(f => !f)}
                    title={isFullscreen ? t("collapseFullscreen") : t("expandFullscreen")}
                    style={{ width:24, height:24, borderRadius:6, background:"transparent", border:"none", cursor:"pointer", color:"var(--text-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"color 150ms" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
                  >
                    {isFullscreen ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 1H1v4M9 1h4v4M5 13H1V9M9 13h4V9"/>
                        <path d="M4 4l2 2M10 4l-2 2M4 10l2-2M10 10l-2-2"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <div style={{ display:"grid", gridTemplateColumns: view === "days" ? `repeat(auto-fill, ${cellPx}px)` : `repeat(${cols}, ${cellPx}px)`, gap:`${gapPx}px`, width:"100%" }}>
                {Array.from({ length: totalUnits }, (_, i) => {
                  const isPast = i < currentUnit;
                  const isCurrent = i === currentUnit;
                  const radius = Math.max(0, Math.floor(cellPx / 5));
                  const showBorder = cellPx >= 3;
                  return (
                    <div key={i} style={{
                      width: cellPx, height: cellPx, borderRadius: radius, flexShrink: 0,
                      background: isPast ? LIFE_ACCENT : isCurrent ? `${LIFE_ACCENT}66` : (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"),
                      border: showBorder
                        ? (isCurrent ? `${Math.max(1, Math.round(cellPx / 6))}px solid ${LIFE_ACCENT}` : "none")
                        : "none",
                      boxShadow: (cellPx >= 5 && isCurrent) ? `0 0 0 2px ${LIFE_ACCENT}44` : "none",
                    }} />
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 pb-12 flex flex-col items-center justify-center text-center" style={{ flex:1, minHeight:200 }}>
            <div className="text-4xl mb-3">🗓️</div>
            <div className="text-[15px] font-semibold" style={{ color:"var(--text)" }}>{t("enterBirthDate")}</div>
            <div className="mt-1 text-[13px]" style={{ color:"var(--text-tertiary)" }}>{t("birthDateSubtitle")}</div>
          </div>
        )}
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
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function NotesIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
}

export default App;
