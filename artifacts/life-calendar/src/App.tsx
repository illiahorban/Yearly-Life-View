import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { AnimatePresence, motion, LayoutGroup, Reorder, useDragControls } from "framer-motion";
import confetti from "canvas-confetti";
import TextareaAutosize from "react-textarea-autosize";

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
function monthsBetween(a: Date, b: Date) {
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

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
    milestones:"All Events", darkMode:"Dark mode", lightMode:"Light mode",
    lifeCalendarBtn:"Life Calendar", quarterProgress:"Quarter progress", expandFullscreen:"Expand to fullscreen", collapseFullscreen:"Collapse",
    search:"Search", searchPlaceholder:"Search notes and events…", searchResults:"results", searchNoResults:"No matches found", jumpTo:"Jump to",
    dayNotes:"Day Notes", eventsAndNotes:"Events & Notes", events:"Events",
    note:"Note", notes:"Notes", addNote:"Add note", addEvent:"Add event", addEventBtn:"Add event", save:"Save",
    notePlaceholder:"Add a note, emoji, or reflection… ✨", anotherNote:"Another note…",
    remove:"Remove", deleteConfirm:"Delete?", deleteEntryConfirm:"Remove this note?", deleteEventConfirm:"Delete this event?", deleteTplConfirm:"Delete this template?", deleteDayNotesConfirm:"Delete all notes for this day?", deleteGoalConfirm:"Delete this goal?", noMilestones:"No milestones yet. Add one above.",
    labelPlaceholder:"Label…", add:"Add",
    descPlaceholder:"Description (optional)…",
    repeatYearly:"Repeat every year", cancel:"Cancel", saveChanges:"Save changes",
    editDescPlaceholder:"Description (optional)…", footerBase:"Life Calendar",
    today:"Today", week:"Week", week2:"weeks", week5:"weeks", done:"done", left:"left", goals:"goals",
    allGoals:"All Goals", noGoalsYet:"No goals set yet. Open a sprint to add goals.",
    yearGoals:"Year Goals", yearDescPlaceholder:"Year vision or theme (optional)…",
    sprintGoals:"Sprint Goals", quarterGoals:"Quarter Goals", addGoal:"Add goal", saveGoals:"Save goals", goalsLabel:"Goals", goalPlaceholder:"Goal", sprintDescPlaceholder:"Sprint description (optional)…", quarterDescPlaceholder:"Quarter description (optional)…",
    overview:"Overview", dateOfBirth:"Date of Birth", lifeExpectancy:"Life Expectancy",
    years:"Years", months:"Months", weeks:"Weeks", days:"Days", elapsed:"elapsed",
    yr:"yr", mo:"mo", remaining:"remaining", born:"Born", age:"Age",
    sprintConfig:"Sprint configuration", sprintConfigDescription:"Group the 13 weeks of {quarter} into sprints.", saveSprints:"Save sprints", addSprint:"Add sprint",
    looksGood:"Looks good", unassigned:"unassigned", over:"over", total:"Total",
    q1:"Q1", q2:"Q2", q3:"Q3", q4:"Q4", todayCountdown:"Today!", daysShort:"d",
    chooseColor: "Choose color",
    dragNote: "Drag to reorder",
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
    dailyGoals: "Daily Goals", allDone: "All done! 🎉", goalCountLabel: "Number of goals:", goal: "Goal",
    streakDays: "day streak", streakDaysPlural: "day streak", weekGoalsDone: "goals done",
    resetGoals: "Reset", resetGoalsConfirm: "Reset all goals of this day?", yes: "Yes", no: "No",
    copyToTomorrow: "Copy to tomorrow", copiedToTomorrow: "Copied!",
    tomorrowHasGoals: "Tomorrow already has goals. Replace?", replace: "Replace",
    templates: "Templates", noTemplates: "No templates yet.", newTemplate: "New template", templateNamePlaceholder: "e.g. Morning routine, Work day…", addTemplateItem: "Add item", applyTemplate: "Apply", deleteTemplate: "Delete", saveTemplate: "Save template", templatesTitle: "Day Goal Templates", applyTemplateBtn: "Apply template", saveAsTemplate: "Save as template", savedAsTemplate: "Saved!",
  },
  ru: {
    complete:"выполнено", daysOf:"дней", of:"из", daysRemaining:"дней осталось",
    milestones:"Все события", darkMode:"Тёмная тема", lightMode:"Светлая тема",
    lifeCalendarBtn:"Календарь жизни", quarterProgress:"Прогресс квартала", expandFullscreen:"Развернуть на весь экран", collapseFullscreen:"Свернуть",
    search:"Поиск", searchPlaceholder:"Поиск по заметкам и событиям…", searchResults:"совпадений", searchNoResults:"Ничего не найдено", jumpTo:"Перейти к",
    dayNotes:"Заметки", eventsAndNotes:"События и заметки", events:"События",
    note:"Заметка", notes:"Заметки", addNote:"Добавить заметку", addEvent:"Добавить событие", addEventBtn:"Добавить событие", save:"Сохранить",
    notePlaceholder:"Заметка, мысль или эмодзи… ✨", anotherNote:"Ещё заметка…",
    remove:"Удалить", deleteConfirm:"Удалить?", deleteEntryConfirm:"Удалить эту заметку?", deleteEventConfirm:"Удалить это событие?", deleteTplConfirm:"Удалить этот шаблон?", deleteDayNotesConfirm:"Удалить все заметки этого дня?", deleteGoalConfirm:"Удалить эту цель?", noMilestones:"Нет событий. Добавьте выше.",
    labelPlaceholder:"Название…", add:"Добавить",
    descPlaceholder:"Описание (необязательно)…",
    repeatYearly:"Повторять каждый год", cancel:"Отмена", saveChanges:"Сохранить",
    editDescPlaceholder:"Описание (необязательно)…", footerBase:"Календарь жизни",
    today:"Сегодня", week:"неделя", week2:"недели", week5:"недель", done:"готово", left:"осталось", goals:"целей",
    allGoals:"Все цели", noGoalsYet:"Целей пока нет. Откройте спринт, чтобы добавить цели.",
    yearGoals:"Цели года", yearDescPlaceholder:"Видение или тема года (необязательно)…",
    sprintGoals:"Цели спринта", quarterGoals:"Цели квартала", addGoal:"Добавить цель", saveGoals:"Сохранить цели", goalsLabel:"Цели", goalPlaceholder:"Цель", sprintDescPlaceholder:"Описание спринта (необязательно)…", quarterDescPlaceholder:"Описание квартала (необязательно)…",
    overview:"Обзор", dateOfBirth:"Дата рождения", lifeExpectancy:"Продолж. жизни",
    years:"Годы", months:"Месяцы", weeks:"Недели", days:"Дни", elapsed:"прожито",
    yr:"лет", mo:"мес", remaining:"осталось", born:"Рождён(а)", age:"Возраст",
    sprintConfig:"Настройка спринтов", sprintConfigDescription:"Сгруппируйте 13 недель {quarter} в спринты.", saveSprints:"Сохранить", addSprint:"Спринт",
    looksGood:"Отлично", unassigned:"не распределено", over:"лишних", total:"Итого",
    q1:"К1", q2:"К2", q3:"К3", q4:"К4", todayCountdown:"Сегодня!", daysShort:"д",
    chooseColor: "Выбрать цвет",
    dragNote: "Потянуть, чтобы переставить",
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
    dailyGoals: "Цели дня", allDone: "Всё выполнено! 🎉", goalCountLabel: "Количество целей:", goal: "Цель",
    streakDays: "день подряд", streakDaysPlural: "дней подряд", weekGoalsDone: "целей выполнено",
    resetGoals: "Сбросить", resetGoalsConfirm: "Сбросить все цели этого дня?", yes: "Да", no: "Нет",
    copyToTomorrow: "Скопировать на завтра", copiedToTomorrow: "Скопировано!",
    tomorrowHasGoals: "На завтра уже есть цели. Заменить?", replace: "Заменить",
    templates: "Шаблоны", noTemplates: "Шаблонов пока нет.", newTemplate: "Новый шаблон", templateNamePlaceholder: "напр. Утро, Рабочий день…", addTemplateItem: "Добавить пункт", applyTemplate: "Применить", deleteTemplate: "Удалить", saveTemplate: "Сохранить шаблон", templatesTitle: "Шаблоны дневных целей", applyTemplateBtn: "Применить шаблон", saveAsTemplate: "Сохранить как шаблон", savedAsTemplate: "Сохранено!",
  },
};
type LangCtx = { t: (k: string) => string; months: string[]; weekdays: string[]; lang: Lang };
const LangContext = React.createContext<LangCtx>({ t: k => I18N.en[k] ?? k, months: MONTHS_I18N.en, weekdays: WEEKDAYS_I18N.en, lang: "en" });
const WEEKS_PER_QUARTER = 13;
const TOTAL_WEEKS = 52;

type Quarter = { key: AppleColorKey; label: string; tint: string; darkTint: string; border: string; fill: string; text: string; nameColor: string; soft: string; darkSoft: string };
type Block = { id: string; weeks: number; label: string; color?: AppleColorKey };
type QuarterConfig = { blocks: Block[] };
type CalendarConfig = { quarters: QuarterConfig[] };
type DayState = "past" | "today" | "future" | "out";
type Milestone = { id: string; label: string; date: string; color: string; description?: string; recurring?: boolean };
type Goal = { id: string; text: string; done: boolean; color?: string };
type BlockGoals = { description: string; goals: Goal[] };
type NoteEntry = { id: string; text: string; createdAt: number; color?: string };
type LifeSettings = { birthDate: string; lifespan: number };
type LifeView = "years" | "months" | "weeks" | "days";
type DayGoals = { count: number; done: boolean[]; labels?: string[]; colors?: (string|undefined)[] };
type DayTemplate = { id: string; name: string; items: string[] };

function fireConfettiCannons() {
  const colors = ["#ffd700","#ff6b6b","#51cf66","#74c0fc","#f783ac","#ff922b","#cc5de8"];
  const base = { zIndex: 9999, colors, disableForReducedMotion: true };

  // Two side cannons, angled steeply across the screen so particles travel the full width.
  confetti({ ...base, startVelocity: 65, spread: 80, ticks: 300, gravity: 0.75, particleCount: 150, origin: { x: -0.05, y: 0.8 }, angle: 55 });
  confetti({ ...base, startVelocity: 65, spread: 80, ticks: 300, gravity: 0.75, particleCount: 150, origin: { x: 1.05, y: 0.8 }, angle: 125 });
}

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
  { key:"black",  label:"Black",  light:"#121212", dark:"#121212" },
  { key:"grey",   label:"Grey",   light:"#8e8e93", dark:"#636366" },
  { key:"white",  label:"White",  light:"#ffffff", dark:"#ffffff" },
] as const;

/** Colour to draw the selection checkmark in so it reads on any swatch —
 *  dark ink on light/bright swatches, white ink on dark/saturated ones. */
function swatchCheckColor(hex: string): string {
  return luminanceOf(hex) > 0.6 ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.95)";
}

/** Position a fixed-position popover relative to an anchor rect, flipping above
 *  the anchor and clamping to both viewport edges so it never renders off-screen. */
function clampedPopoverPos(rect: DOMRect, popoverWidth: number, popoverHeight: number, gap = 7) {
  const below = rect.bottom + gap;
  const top = (below + popoverHeight <= window.innerHeight)
    ? Math.max(8, below)
    : Math.max(8, Math.min(rect.top - popoverHeight - gap, window.innerHeight - popoverHeight - 8));
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - popoverWidth - 8);
  return { top, left };
}

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
  const isAchromaticDark = meta.colorKey === "black" || meta.colorKey === "grey";
  // Adjust text color for low-contrast hues in light mode. Yellow is exempt: text/icons use
  // the exact same hex as the quarter's border/fill/day-tiles so every yellow element in the
  // UI matches one single shade (no separate darkened variant for legibility).
  const textHex = (!dark && meta.colorKey==="mint")   ? "#008a82"
                : (!dark && meta.colorKey==="teal")   ? "#007ea5"
                : meta.colorKey==="white"             ? (dark ? "#ebebf5" : "#3a3a3c")
                : isAchromaticDark                    ? (dark ? "#ffffff" : "#1c1c1e")
                : hex;
  // Black/Grey in dark mode: fill/text turn white so percent numbers, headers and icons
  // stay legible — the card/day-tile surface itself keeps each colour's true hue (grey
  // stays grey, black stays black), only the content drawn on top gets the contrast boost.
  const fill = (isAchromaticDark && dark) ? "#ffffff" : hex;
  // The sprint/quarter *name* and its "add goal" icon aren't drawn on top of a filled
  // colour surface the way percentages/progress bars are, so they don't need the
  // white/black contrast boost applied to `text` for legibility. For grey specifically,
  // keep them showing the actual grey swatch (a legible mid-tone in both themes) instead
  // of being swapped to white/black like the rest of the achromatic UI.
  const nameColor = meta.colorKey === "grey"  ? (dark ? "#aeaeb2" : "#8e8e93")
                   : meta.colorKey === "white" ? (dark ? "#ffffff" : "#18181b")
                   : meta.colorKey === "black" ? (dark ? "#e5e5e7" : "#121212")
                   : textHex;
  return {
    key: meta.colorKey,
    label: meta.name,
    tint:     `rgba(${r},${g},${b},0.07)`,
    darkTint: `rgba(${r},${g},${b},0.14)`,
    border: hex,
    fill,
    text: textHex,
    nameColor,
    soft:     `rgba(${r},${g},${b},0.22)`,
    darkSoft: `rgba(${r},${g},${b},0.36)`,
  };
}

/** Black/Grey in light mode wash the quarter card and the sprint/block card inside it
 *  with the *same* grey hue as the app's own "muted" text colours (week numbers, day
 *  counts, etc.) — those text spots don't know what colour the quarter is, so on every
 *  other colour they read fine (different hue = contrast), but on black/grey they sit
 *  right on top of a near-identical grey and disappear. Rather than fight the card's own
 *  wash colour, boost just this text: swap the theme's generic grey for solid dark ink
 *  (anchored to the same "#1c1c1e" already used for quarter.text) whenever the active
 *  quarter/block colour is achromatic and the theme is light.
 */
function mutedTextColors(colorKey: AppleColorKey, dark: boolean) {
  const isAchroLight = (colorKey === "black" || colorKey === "grey") && !dark;
  return {
    tertiary:  isAchroLight ? "rgba(28,28,30,0.62)" : "var(--text-tertiary)",
    secondary: isAchroLight ? "rgba(28,28,30,0.88)" : "var(--text-secondary)",
  };
}

const MILESTONE_COLORS = ["#007aff","#34c759","#5856d6","#ff9500","#ff2d55","#af52de","#ff3b30","#5ac8fa","#ffcc00","#00c7be","#a2845e","#121212","#8e8e93","#ffffff"];

/** Perceived luminance (0–1) of a hex colour, used to decide whether light or dark
 *  content reads best against it. */
function luminanceOf(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Returns a colour safe to use as goal-title text directly on the app's page
 *  background: the goal's own colour normally, but swapped for the theme's
 *  standard text colour when that colour would be unreadable against the
 *  current background (e.g. near-black text in dark mode, near-white text in
 *  light mode). `fallback` is used when the goal has no colour at all. */
function readableGoalTextColor(colorHex: string | undefined, dark: boolean, fallback: string): string {
  if (!colorHex) return fallback;
  // Mirror the inversion logic from getEventColors so summary labels stay legible.
  const _ach = achromaticStyle(colorHex, dark);
  if (_ach) {
    if (_ach.tier === "grey")  return "#71717a";
    if (_ach.tier === "black") return dark ? "#e5e5e7" : "#000000";
    /* white */                return dark ? "#ffffff" : "#18181b";
  }
  const lum = luminanceOf(colorHex);
  if (dark && lum < 0.25) return "var(--text)";
  if (!dark && lum > 0.75) return "var(--text)";
  return colorHex;
}

/** In dark mode, lift colours whose perceived luminance is below 0.45 so they stay legible on dark surfaces.
 *  Bright colours are returned unchanged; very dark ones become a visible mid-tone while keeping their hue. */
function adaptColor(hex: string, dark: boolean): string {
  if (!dark) return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum >= 0.45) return hex;
  const factor = Math.min(0.82, (0.55 - lum) / (1 - lum));
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/** Returns adaptive styles for achromatic colours (white/grey/black) that stay legible in both themes.
 *  Returns null for any chromatic (saturated) colour so callers fall back to adaptColor. */
type AchromaticStyle = { bg: string; border: string; text: string; marker: string; markerBorder?: string; ring?: string; tier: "black"|"grey"|"white" };
function achromaticStyle(hex: string, dark: boolean): AchromaticStyle | null {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  const maxC = Math.max(r,g,b);
  const sat = maxC === 0 ? 0 : (maxC - Math.min(r,g,b)) / maxC;
  if (sat > 0.18) return null;
  if (lum > 0.70) {
    // white — pure white border in both themes, as requested
    return dark
      ? { bg:"#ffffff", border:"#ffffff", text:"#18181b", marker:"#ffffff", tier:"white" }
      : { bg:"#ffffff", border:"#ffffff", text:"#18181b", marker:"#ffffff", tier:"white" };
  }
  if (lum < 0.12) {
    // black — pure black border in both themes, to match the white tier above
    return dark
      ? { bg:"#09090b", border:"#000000", text:"#ffffff", marker:"#27272a", tier:"black" }
      : { bg:"#000000", border:"#000000", text:"#ffffff", marker:"#000000", tier:"black" };
  }
  return dark
    ? { bg:"rgba(255,255,255,0.20)", border:"rgba(255,255,255,0.20)", text:"#ffffff", marker:"#a1a1aa", tier:"grey" }
    : { bg:"#e4e4e7",                border:"#e4e4e7",                text:"#27272a", marker:"#a1a1aa", tier:"grey" };
}

/** Maps any APPLE_COLORS hex variant (light or dark) to the canonical light-mode
 *  hex so achromaticStyle always classifies it correctly regardless of theme.
 *  Custom hex values not in APPLE_COLORS are returned unchanged. */
function resolveNoteHex(hex: string): string {
  const ac = APPLE_COLORS.find(c => c.light === hex || c.dark === hex);
  return ac ? ac.light : hex;
}

/** For the grey achromatic tier specifically, normalises any stored grey variant
 *  (light #8e8e93 or dark #636366) to the display grey #71717a (zinc-500) — a
 *  shade that renders equally vivid for both border lines and anti-aliased text
 *  on any background.  Returns the original hex unchanged for all other colours
 *  (including black and white). */
function normaliseGrey(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const tier = achromaticStyle(resolveNoteHex(hex), false)?.tier;
  return tier === "grey" ? "#71717a" : hex;
}

/** Mirror of achromaticStyle, tuned for the tiny sprint/quarter goal checkboxes:
 *  black gets a fully-opaque zinc-950/zinc-800 pairing (no translucency, so it never
 *  blends into a colored card), grey is a flat opaque zinc-500 chip (like the day-cell
 *  color indicators) instead of a translucent overlay, and white keeps a matching
 *  zinc-700/zinc-200 outline so its footprint lines up exactly with black's.
 *  Returns null for chromatic colours so callers fall back to the raw hex. */
type GoalCheckboxStyle = { bg: string; border: string; icon: string };
function goalCheckboxAchromaticStyle(hex: string, dark: boolean): GoalCheckboxStyle | null {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  const maxC = Math.max(r,g,b);
  const sat = maxC === 0 ? 0 : (maxC - Math.min(r,g,b)) / maxC;
  if (sat > 0.18) return null;
  if (lum > 0.70) {
    return { bg:"#ffffff", border:"#ffffff", icon:"#18181b" };
  }
  if (lum < 0.12) {
    return dark ? { bg:"#09090b", border:"#000000", icon:"#ffffff" } : { bg:"#000000", border:"#000000", icon:"#ffffff" };
  }
  return { bg:"#71717a", border:"#71717a", icon:"#ffffff" };
}

/** Resolves the background/border/checkmark colours for a single sprint or quarter
 *  goal checkbox, applying the opaque achromatic mirror above for black/grey/white
 *  and falling back to the plain chromatic colour (or the block/quarter accent)
 *  otherwise. `emptyBorder` is always defined so the outline is visible whether or
 *  not the goal is done, matching the box's fixed h/w regardless of colour. */
/** fallbackColorKey: the sprint/quarter AppleColorKey, used to derive achromatic checkbox
 *  colours from the raw APPLE_COLORS hex rather than from `fill`, which is overridden to
 *  "#ffffff" for black/grey in dark mode (for content contrast) and would produce a white
 *  checkbox on a dark card. */
function goalCheckboxColors(colorHex: string | undefined, dark: boolean, fallbackHex: string, fallbackColorKey?: string) {
  const ach = colorHex ? goalCheckboxAchromaticStyle(resolveNoteHex(colorHex), dark) : null;
  if (ach) {
    return { doneBg: ach.bg, doneBorder: ach.border, emptyBg: "transparent", emptyBorder: ach.border, icon: ach.icon };
  }

  if (colorHex) {
    return { doneBg: colorHex, doneBorder: colorHex, emptyBg: "transparent", emptyBorder: colorHex, icon: "#ffffff" };
  }

  // No colour chosen for this specific goal: keep the checkbox neutral instead of
  // inheriting the sprint/quarter accent colour, matching the day-goal checkbox default.
  return { doneBg: "#34c759", doneBorder: "#34c759", emptyBg: "transparent", emptyBorder: "var(--border-soft)", icon: "#ffffff" };
}

// ─── Centralized event/milestone color helper ─────────────────────────────────
// Returns all semantic color values needed to render an event card (background,
// title, description, icon, borders, marker bar, and inline-form surfaces) with
// guaranteed readable contrast in both light and dark themes.
type EventColors = {
  bg: string;            // card background
  textTitle: string;     // primary / title text
  textDesc: string;      // secondary / description text
  icon: string;          // action icon color
  border: string;        // normal card border colour (empty = use boxShadow ring instead)
  borderEditing: string; // border while inline edit form is open
  boxShadow: string;     // inset ring substitute (used when border is empty)
  marker: string;        // day-cell color bar segment
  formBg: string;        // input background inside card
  formBorder: string;    // input border inside card
};

function getEventColors(hex: string, dark: boolean): EventColors {
  // ── No-color path (empty string) ────────────────────────────────────────────
  if (!hex) {
    return {
      bg:            dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      textTitle:     "var(--text)",
      textDesc:      "var(--text-secondary)",
      icon:          "var(--text-secondary)",
      border:        dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
      borderEditing: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
      boxShadow:     "",
      marker:        dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.20)",
      formBg:        dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      formBorder:    dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    };
  }
  // ── Achromatic path (white / grey / black) ──────────────────────────────────
  const ach = achromaticStyle(hex, dark);
  if (ach) {
    // Grey  → unified #71717a (zinc-500) in both themes.
    // Black → text inverts in dark mode (#e5e5e7) so it stays legible; border
    //         keeps the literal black the user chose.
    // White → text inverts in light mode (#18181b); border keeps literal white.
    let textHex: string;
    if (ach.tier === "grey") {
      textHex = "#71717a";
    } else if (ach.tier === "black") {
      textHex = dark ? "#e5e5e7" : "#000000";
    } else {
      // white
      textHex = dark ? "#ffffff" : "#18181b";
    }
    // Border and editing border keep the literal selected colour unchanged.
    const borderHex = ach.tier === "grey" ? "#71717a" : resolveNoteHex(hex);
    return {
      bg:            "transparent",
      textTitle:     textHex,
      textDesc:      textHex,
      icon:          textHex,
      border:        borderHex,
      borderEditing: borderHex,
      boxShadow:     ach.ring ?? "",
      marker:        ach.marker,
      formBg:        dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      formBorder:    dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    };
  }

  // ── Chromatic path ───────────────────────────────────────────────────────────
  // adaptColor lifts very-dark hues in dark mode so they stay visible.
  const adapted = adaptColor(hex, dark);

  // Perceived luminance of the *original* hex determines text contrast on the
  // card surface.  In light mode the card bg is near-white with a subtle tint,
  // so very bright colours (yellow, mint, light-teal, orange) need a strongly
  // darkened variant to remain legible.  In dark mode adaptColor handles it.
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return {
    bg:            "transparent",
    textTitle:     hex,
    textDesc:      hex,
    icon:          hex,
    border:        `${hex}99`,
    borderEditing: `${hex}cc`,
    boxShadow:     "",
    marker:        adapted,
    formBg:        dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.70)",
    formBorder:    dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
  };
}

const LIFE_ACCENT = "#007aff";

function LifeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-1.5A6.5 6.5 0 0 1 12 13a6.5 6.5 0 0 1 6.5 6.5V21"/></svg>;
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2,10); }

// Reorders the subset of `list` whose id is in `orderedIds` into that new
// relative order, while leaving every other item's position untouched.
// Matching by id (not by any grouping key) keeps this safe for lists like
// milestones where a rendered day's items can be synthetic recurring copies
// that share an id with a differently-dated original.
function reorderByIds<T extends { id: string }>(list: T[], orderedIds: string[]): T[] {
  const byId = new Map(list.map(item => [item.id, item]));
  const targetSlots: number[] = [];
  list.forEach((item, i) => { if (byId.has(item.id) && orderedIds.includes(item.id)) targetSlots.push(i); });
  const reordered = orderedIds.map(id => byId.get(id)).filter((x): x is T => x !== undefined);
  const next = [...list];
  targetSlots.forEach((pos, i) => { if (reordered[i]) next[pos] = reordered[i]!; });
  return next;
}
function defaultBlock(): Block { return { id: makeId(), weeks: WEEKS_PER_QUARTER, label: "All weeks" }; }

/** Returns correct plural form of "week/неделя" for a given count and language. */
function pluralWeeks(n: number, lang: string, t: (k: string) => string): string {
  if (lang !== "ru") return `${n} ${n === 1 ? t("week") : t("week2")}`;
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${t("week")}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${t("week2")}`;
  return `${n} ${t("week5")}`;
}

function pluralDayStreak(n: number, lang: string): string {
  if (lang !== "ru") return `${n} day streak`;
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день подряд`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} дня подряд`;
  return `${n} дней подряд`;
}

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
  const searchBtnRef = React.useRef<HTMLDivElement>(null);
  const searchBarRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        searchBtnRef.current && !searchBtnRef.current.contains(target) &&
        searchBarRef.current && !searchBarRef.current.contains(target)
      ) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>(() => ls<Milestone[]>("lifeCalendar:milestones", []));
  useEffect(() => { lsSet("lifeCalendar:milestones", milestones); }, [milestones]);
  const [milestonePanelOpen, setMilestonePanelOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [lifeCalendarOpen, setLifeCalendarOpen] = useState(false);
  const [lifeSettings, setLifeSettings] = useState<LifeSettings>(() => ls<LifeSettings>("lifeCalendar:lifeSettings", { birthDate: "", lifespan: 80 }));
  useEffect(() => { lsSet("lifeCalendar:lifeSettings", lifeSettings); }, [lifeSettings]);

  // Day Goals
  const [dayGoals, setDayGoals] = useState<Record<string, DayGoals>>(() => ls<Record<string, DayGoals>>("lifeCalendar:dayGoals", {}));
  useEffect(() => { lsSet("lifeCalendar:dayGoals", dayGoals); }, [dayGoals]);
  // Day Templates
  const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>(() => ls<DayTemplate[]>("lifeCalendar:dayTemplates", []));
  useEffect(() => { lsSet("lifeCalendar:dayTemplates", dayTemplates); }, [dayTemplates]);
  const updateDayGoals = (dk: string, goals: DayGoals) => {
    setDayGoals(prev => ({ ...prev, [dk]: goals }));
  };
  const computeQuarterStreak = useCallback((qAllDays: Date[]): number => {
    const isDone = (dk: string) => { const g = dayGoals[dk]; return g != null && g.count > 0 && g.done.length >= g.count && g.done.every(Boolean); };
    const t0 = startOfDay(new Date());
    const relevant = qAllDays.filter(d => d <= t0).sort((a, b) => a.getTime() - b.getTime());
    if (relevant.length === 0) return 0;
    let idx = relevant.length - 1;
    if (!isDone(dateKey(relevant[idx]!))) idx--;
    let streak = 0;
    for (let i = idx; i >= 0; i--) { if (!isDone(dateKey(relevant[i]!))) break; streak++; }
    return streak;
  }, [dayGoals]);

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

  // Quarter goals
  const [quarterGoals, setQuarterGoals] = useState<Record<number, BlockGoals>>(() => ls<Record<number, BlockGoals>>("lifeCalendar:quarterGoals", {}));
  useEffect(() => { lsSet("lifeCalendar:quarterGoals", quarterGoals); }, [quarterGoals]);
  const [editGoalsQi, setEditGoalsQi] = useState<number|null>(null);

  // Year goals (keyed by year)
  const [yearGoals, setYearGoals] = useState<Record<number, BlockGoals>>(() => ls<Record<number, BlockGoals>>("lifeCalendar:yearGoals", {}));
  useEffect(() => { lsSet("lifeCalendar:yearGoals", yearGoals); }, [yearGoals]);
  const [editYearGoals, setEditYearGoals] = useState(false);
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
    return list.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);
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

  // When paging to a year other than the current one, start at the first week instead of
  // keeping whatever scroll offset the previous year was left at.
  useEffect(() => {
    if (viewYear !== now.getFullYear()) window.scrollTo({ top: 0, behavior: "auto" });
  }, [viewYear]);

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
    const updated = bg.goals.map(g => g.id===goalId ? { ...g, done: !g.done } : g);
    if (updated.filter(g => g.text.trim()).every(g => g.done) && updated.filter(g => g.text.trim()).length > 0) setTimeout(fireConfettiCannons, 80);
    return { ...prev, [blockId]: { ...bg, goals: updated } };
  });
  const toggleQuarterGoal = (qi: number, goalId: string) => setQuarterGoals(prev => {
    const bg = prev[qi] ?? { description: "", goals: [] };
    const updated = bg.goals.map(g => g.id === goalId ? { ...g, done: !g.done } : g);
    if (updated.filter(g => g.text.trim()).every(g => g.done) && updated.filter(g => g.text.trim()).length > 0) setTimeout(fireConfettiCannons, 80);
    return { ...prev, [qi]: { ...bg, goals: updated } };
  });
  const toggleYearGoal = (year: number, goalId: string) => setYearGoals(prev => {
    const bg = prev[year] ?? { description: "", goals: [] };
    const updated = bg.goals.map(g => g.id === goalId ? { ...g, done: !g.done } : g);
    if (updated.filter(g => g.text.trim()).every(g => g.done) && updated.filter(g => g.text.trim()).length > 0) setTimeout(fireConfettiCannons, 80);
    return { ...prev, [year]: { ...bg, goals: updated } };
  });

  // Resolved quarters (color + label derived from meta)
  const resolvedQuarters = useMemo(() =>
    quarterMeta.map(m => resolveQuarter(m, dark)),
  [quarterMeta, dark]);

  // Accent colour for the goals modal border — block's own colour if set, else the quarter's fill
  const editGoalsAccentColor = useMemo(() => {
    if (!editGoalsBlockId) return undefined;
    const qi = config.quarters.findIndex(q => q.blocks.some(b => b.id === editGoalsBlockId));
    if (qi < 0) return undefined;
    const block = config.quarters[qi]!.blocks.find(b => b.id === editGoalsBlockId);
    if (block?.color) {
      const ac = APPLE_COLORS.find(c => c.key === block.color);
      if (ac) return dark ? ac.dark : hexSaturate(ac.light, LIGHT_SAT_FACTOR);
    }
    return resolvedQuarters[qi]?.border;
  }, [editGoalsBlockId, config, resolvedQuarters, dark]);

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
                style={{ width:28, height:28, borderRadius:8, background:overlayBg, border:"1px solid var(--border-soft)", color: viewYear<=MIN_YEAR ? "var(--text-tertiary)" : "var(--text-secondary)", cursor: viewYear<=MIN_YEAR ? "default" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><ChevronLeftIcon /></button>
              <h1 className="text-2xl sm:text-3xl font-semibold tabular-nums" style={{ color: "var(--text)", letterSpacing: "-0.02em", minWidth:"3.2ch", textAlign:"center" }}>{viewYear}</h1>
              <button onClick={() => setViewYear(y => Math.min(MAX_YEAR, y+1))} disabled={viewYear >= MAX_YEAR}
                style={{ width:28, height:28, borderRadius:8, background:overlayBg, border:"1px solid var(--border-soft)", color: viewYear>=MAX_YEAR ? "var(--text-tertiary)" : "var(--text-secondary)", cursor: viewYear>=MAX_YEAR ? "default" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><ChevronRightIcon /></button>
            </div>
            <div className="flex items-center gap-2">
              <div ref={searchBtnRef}><IconButton title={t("search")} onClick={() => { setSearchOpen(o => !o); setSearchQuery(""); }} bg={searchOpen ? "rgba(0,122,255,0.15)" : overlayBg}><SearchIcon /></IconButton></div>
              <div style={{ width:1, height:16, background:"var(--border-soft)", flexShrink:0, margin:"0 2px" }} />
              <IconButton title={t("allGoals")} onClick={() => setGoalsOpen(o => !o)} bg={goalsOpen ? "rgba(52,199,89,0.15)" : overlayBg}><GoalsIcon /></IconButton>
              <IconButton title={t("notesPanel")} onClick={() => setNotesPanelOpen(true)} bg={overlayBg}><NotesIcon /></IconButton>
              <IconButton title={t("milestones")} onClick={() => setMilestonePanelOpen(true)} bg={overlayBg}><FlagIcon /></IconButton>
              <div style={{ width:1, height:16, background:"var(--border-soft)", flexShrink:0, margin:"0 2px" }} />
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
            <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${yearProgress}%`, background: "#34c759", borderRadius: 999 }} />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            <span>{daysCompleted} {t("of")} {totalDays} {t("daysOf")}</span>
            <span>{yearProgress.toFixed(1)}% {t("complete")}</span>
            <span>{(totalDays-daysCompleted).toFixed(0)} {t("daysRemaining")}</span>
          </div>

          {/* Milestone countdown — up to 20 upcoming */}
          <AnimatePresence>
            {nextMilestones.length > 0 && (
              <motion.div key="ms-countdown" initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth:"none" }}>
                {nextMilestones.map(ms => {
                  const [y2, m2, d2] = ms.date.split("-").map(Number) as [number,number,number];
                  const days = daysBetween(today, new Date(y2, m2-1, d2));
                  const ec = getEventColors(ms.color, dark);
                  const msColBg  = ec.bg;
                  const msColBdr = ec.borderEditing;
                  const msColTxt = dark && ec.border === "#ffffff" ? "#ffffff" : !dark && ec.border === "#000000" ? "#000000" : ec.textTitle;
                  const msColDot = ec.marker;
                  return (
                    <button key={ms.id}
                      onClick={() => setMilestonePanelOpen(true)}
                      className="h-7 inline-flex items-center justify-center gap-1.5 px-3 rounded-full text-[11px] font-medium shrink-0 box-border"
                      style={{ background:"transparent", border:`1.5px solid ${ec.border || "transparent"}`, color:msColTxt, cursor:"pointer" }}
                    >
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
          <div ref={searchBarRef}>
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
          </div>

          {/* Sticky weekday labels */}
          <div className="mt-3 px-[14px] sm:px-[18px] flex flex-row items-center">
            <div style={{ width:60, flexShrink:0 }} />
            <div className="grid grid-cols-7 gap-2 sm:gap-3" style={{ flex:1, minWidth:0 }}>
              {weekdays.map((w,i) => <div key={i} className="text-center text-[15px] font-medium tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>{w}</div>)}
            </div>
            <div style={{ width:60, flexShrink:0 }} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8">

        <LayoutGroup>
          <div className="flex flex-col gap-6">
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
              const qStreak = computeQuarterStreak(qAllDays);
              const mt = mutedTextColors(meta.colorKey, dark);

              return (
                <motion.section layout key={qi} className="overflow-visible"
                  style={{ background: "transparent", borderRadius: 18, border: `3px solid ${quarter.border}` }}
                >
                  {/* Sticky quarter header — sticks just below main app header */}
                  <div style={{ borderRadius:16 }}>
                  {/* Quarter header row */}
                  <div className="flex items-center justify-between px-4 sm:px-5 pb-0" style={{ paddingTop:18 }}>
                    <div className="flex flex-col items-start gap-0.5">
                      {/* Editable quarter name */}
                      <QuarterNameEditor value={meta.name} onChange={name => updateQuarterMeta(qi, { name })} color={quarter.nameColor} />
                      <span className="text-[10px] tabular-nums" style={{ color:mt.tertiary }}>{t("weeks")} {startIndex+1}–{startIndex+WEEKS_PER_QUARTER}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setEditGoalsQi(qi)} title={t("quarterGoals")}
                        style={{ width:28, height:28, borderRadius:8, background:"transparent", border:"none", color: (quarterGoals[qi]?.goals.filter(g=>g.text.trim()).length ?? 0) > 0 ? quarter.nameColor : mt.tertiary, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                      ><GoalsIcon /></button>
                      <IconButton title={t("sprintConfig")} onClick={() => setSettingsQuarter(qi)} bg={overlayBg} color={quarter.text}><GearIcon /></IconButton>
                    </div>
                  </div>
                  {/* Quarter progress */}
                  <div className="px-4 sm:px-5" style={{ paddingTop:0, paddingBottom:18 }}>
                    <div className="text-center tabular-nums" style={{ fontSize:11, fontWeight:700, marginBottom:4, color: !dark && quarter.key === "green" ? "var(--apple-green-deep)" : quarter.text }}>
                      {qPct.toFixed(0)}%
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                      <motion.div initial={false} animate={{ width:`${qPct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                        style={{ height:"100%", background: quarter.fill, borderRadius:999, opacity:0.88 }}
                      />
                    </div>
                    {/* Quarter goal progress bar */}
                    {(() => {
                      const qg = quarterGoals[qi];
                      const activeQGoals = qg?.goals.filter(g => g.text.trim()) ?? [];
                      if (activeQGoals.length === 0) return null;
                      const goalPct = (activeQGoals.filter(g => g.done).length / activeQGoals.length) * 100;
                      return (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" }}>
                            <motion.div initial={false} animate={{ width:`${goalPct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                              style={{ height:"100%", background: quarter.fill, borderRadius:999, opacity:0.72 }}
                            />
                          </div>
                          <span className="text-[9px] tabular-nums shrink-0" style={{ color:mt.tertiary }}>
                            {activeQGoals.filter(g=>g.done).length}/{activeQGoals.length} {t("goals")}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Quarter goal checklist */}
                  {(() => {
                    const qg = quarterGoals[qi];
                    const activeQGoals = qg?.goals.filter(g => g.text.trim()) ?? [];
                    if (activeQGoals.length === 0) return null;
                    return (
                      <div className="px-4 sm:px-5 pb-3">
                        {qg?.description ? (
                          <p className="text-[11px] leading-snug mb-2" style={{ color:mt.tertiary, borderLeft:`2px solid ${quarter.fill}`, paddingLeft:8, opacity:0.8, whiteSpace:"pre-wrap" }}>
                            {qg.description}
                          </p>
                        ) : null}
                        <div className="flex flex-col gap-1">
                          {activeQGoals.map(goal => {
                            const cb = goalCheckboxColors(goal.color, dark, quarter.fill, quarter.key);
                            return (
                              <label key={goal.id} className="flex items-start gap-2 cursor-pointer select-none"
                                onClick={() => toggleQuarterGoal(qi, goal.id)}
                                style={{ color: goal.done ? mt.tertiary : readableGoalTextColor(goal.color, dark, mt.secondary) }}
                              >
                                <div style={{ boxSizing:"border-box", width:14, height:14, borderRadius:4, flexShrink:0, marginTop:1, background: goal.done ? cb.doneBg : cb.emptyBg, border:`1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 150ms ease", cursor:"pointer" }}>
                                  {goal.done && <CheckIcon color={cb.icon} />}
                                </div>
                                <span className="text-[11px] leading-snug" style={{ textDecoration: goal.done ? "line-through" : "none", opacity: goal.done ? 0.5 : 1, minWidth:0, overflowWrap:"anywhere", wordBreak:"break-word" }}>
                                  {goal.text}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  </div>{/* end quarter header wrapper */}

                  <div className="pb-3 sm:pb-4 px-3 sm:px-4 pt-0 flex flex-col gap-2">
                    <BlocksRenderer
                      qi={qi} quarter={quarter} qConfig={qConfig} startIndex={startIndex}
                      weeks={weeks} currentWeekIndex={currentWeekIndex} todayProgress={todayProgress}
                      dayState={dayState} weekRefs={weekRefs} notes={notes} milestonesMap={milestonesMap}
                      blockGoals={blockGoals} dayGoalsMap={dayGoals} dark={dark} cardBg={cardBg} overlayBg={overlayBg}
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
            colorKey={quarterMeta[settingsQuarter]!.colorKey}
            onColorChange={key => updateQuarterMeta(settingsQuarter, { colorKey: key })}
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
            initDayGoals={dayGoals[openNote]}
            tomorrowInitGoals={(() => { const [yr,mo,dy] = openNote.split("-").map(Number); return dayGoals[dateKey(new Date(yr,mo-1,dy+1))]; })()}
            dayTemplates={dayTemplates}
            onSaveTemplates={setDayTemplates}
            onMilestoneUpdate={ms => setMilestones(prev => prev.map(m => m.id === ms.id ? ms : m))}
            onMilestoneAdd={ms => setMilestones(prev => [...prev, ms])}
            onMilestoneDelete={id => setMilestones(prev => prev.filter(m => m.id !== id))}
            onMilestoneReorder={ids => setMilestones(prev => reorderByIds(prev, ids))}
            onDayGoalsChange={g => updateDayGoals(openNote, g)}
            onCopyGoalsTo={(targetDk, g) => updateDayGoals(targetDk, g)}
            onSave={entries => upsertNotes(openNote, entries)}
            onClose={() => setOpenNote(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {goalsOpen && (
          <AllGoalsPanel key="goals-panel"
            config={config} blockGoals={blockGoals} resolvedQuarters={resolvedQuarters}
            quarterGoals={quarterGoals}
            yearGoals={yearGoals[viewYear] ?? { description:"", goals:[] }}
            viewYear={viewYear}
            dark={dark} modalBg={modalBg}
            onToggleGoal={toggleGoal}
            onToggleQuarterGoal={toggleQuarterGoal}
            onToggleYearGoal={goalId => toggleYearGoal(viewYear, goalId)}
            onEditGoals={id => { setEditGoalsBlockId(id); setGoalsOpen(false); }}
            onEditQuarterGoals={qi => { setEditGoalsQi(qi); setGoalsOpen(false); }}
            onEditYearGoals={() => { setEditYearGoals(true); setGoalsOpen(false); }}
            onClose={() => setGoalsOpen(false)}
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
            dark={dark} modalBg={modalBg} accentColor={editGoalsAccentColor}
            onSave={(bg, lbl) => { setBlockGoals(prev => ({ ...prev, [editGoalsBlockId!]: bg })); const qi = config.quarters.findIndex(q => q.blocks.some(b => b.id === editGoalsBlockId)); if (qi >= 0) updateBlockLabel(qi, editGoalsBlockId!, lbl); }}
            onClose={() => setEditGoalsBlockId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editGoalsQi !== null && (
          <GoalsModal key="quarter-goals"
            blockId={String(editGoalsQi)}
            blockLabel={quarterMeta[editGoalsQi]?.name ?? resolvedQuarters[editGoalsQi]?.label ?? ""}
            initial={quarterGoals[editGoalsQi] ?? { description:"", goals:[] }}
            dark={dark} modalBg={modalBg} accentColor={resolvedQuarters[editGoalsQi]?.fill}
            titleLabel={t("quarterGoals")}
            descPlaceholder={t("quarterDescPlaceholder")}
            onSave={(bg, lbl) => { setQuarterGoals(prev => ({ ...prev, [editGoalsQi!]: bg })); updateQuarterMeta(editGoalsQi!, { name: lbl }); }}
            onClose={() => setEditGoalsQi(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editYearGoals && (
          <GoalsModal key="year-goals"
            blockId={String(viewYear)}
            blockLabel={String(viewYear)}
            initial={yearGoals[viewYear] ?? { description:"", goals:[] }}
            dark={dark} modalBg={modalBg}
            titleLabel={t("yearGoals")}
            descPlaceholder={t("yearDescPlaceholder")}
            onSave={(bg) => { setYearGoals(prev => ({ ...prev, [viewYear]: bg })); }}
            onClose={() => setEditYearGoals(false)}
            onBack={() => { setEditYearGoals(false); setGoalsOpen(true); }}
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
          setQuarterGoals({});
          setYearGoals({});
          setMilestones([]);
          setDayGoals({});
          setDayTemplates([]);
          setConfig(defaultConfig());
          setQuarterMeta(DEFAULT_QUARTER_META);
          setLifeSettings({ birthDate: "", lifespan: 80 });
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
  dayState, weekRefs, notes, milestonesMap, blockGoals, dayGoalsMap, dark, cardBg, overlayBg,
  weekSel, matchedDates, activeMatchKey, onNoteOpen, onLabelChange, onGoalToggle, onEditGoals, onWeekLabelClick,
  onCreateSprint, onCancelSel,
}: {
  qi: number; quarter: Quarter; qConfig: QuarterConfig; startIndex: number;
  weeks: Array<{ weekStart: Date; days: Date[] }>; currentWeekIndex: number; todayProgress: number;
  dayState: (d: Date) => DayState; weekRefs: React.MutableRefObject<Array<HTMLDivElement|null>>;
  notes: Record<string,NoteEntry[]>; milestonesMap: Record<string,Milestone[]>;
  blockGoals: Record<string,BlockGoals>; dayGoalsMap: Record<string,DayGoals>; dark: boolean; cardBg: string; overlayBg: string;
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
            const blockStreak = (() => {
              const isDone = (dk: string) => { const g = dayGoalsMap[dk]; return g != null && g.count > 0 && g.done.length >= g.count && g.done.every(Boolean); };
              const t0 = startOfDay(new Date());
              const rel = allDays.filter(d => d <= t0).sort((a, b) => a.getTime() - b.getTime());
              if (rel.length === 0) return 0;
              let idx = rel.length - 1;
              if (!isDone(dateKey(rel[idx]!))) idx--;
              let s = 0;
              for (let i = idx; i >= 0; i--) { if (!isDone(dateKey(rel[i]!))) break; s++; }
              return s;
            })();
            const effectiveQ = block.color ? resolveQuarter({ name: block.label, colorKey: block.color }, dark) : quarter;
            const softColor = dark ? effectiveQ.darkSoft : effectiveQ.soft;
            const mt = mutedTextColors(block.color ?? quarter.key, dark);

            return (
              <motion.div layout key={block.id}
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                transition={{ type:"spring", stiffness:320, damping:30 }}
                style={{ background:cardBg, borderRadius:14, border:`2px solid ${effectiveQ.border}`, backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)", overflow:"visible" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 sm:px-3.5 pt-2.5 pb-1.5" style={{ position:"relative" }}>
                  <BlockLabel value={block.label} onChange={v => onLabelChange(block.id, v)} color={effectiveQ.nameColor} />
                  {blockStreak > 0 && (
                    <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"center", justifyContent:"center", gap:4, lineHeight:1 }}>
                      <span style={{ fontSize:11, filter:"drop-shadow(0 0 3px rgba(255,149,0,0.5))" }}>🔥</span>
                      <span style={{ fontSize:10, fontWeight:700, color:"#ff9500" }}>{pluralDayStreak(blockStreak, lang)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onEditGoals(block.id)} title={t("sprintGoals")}
                      style={{ width:22, height:22, borderRadius:6, background:"transparent", border:"none", color: activeGoals.length>0 ? effectiveQ.nameColor : mt.tertiary, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                    ><GoalsIcon /></button>
                    <span className="text-[10px] tabular-nums" style={{ color:mt.tertiary }}>{pluralWeeks(block.weeks, lang, t)}</span>
                  </div>
                </div>

                {/* Progress strip */}
                <div className="px-3 sm:px-3.5 pb-2">
                  <div className="relative flex items-center justify-between text-[10px] tabular-nums mb-1">
                    <span style={{ color:mt.tertiary }}>{pastDays} {t("of")} {totalDays} {t("daysOf")}</span>
                    <span style={{ position:"absolute", left:"50%", transform:"translateX(-50%)", color: isFuture ? mt.tertiary : effectiveQ.text, fontWeight:700 }}>{pct.toFixed(0)}%</span>
                    <span style={{ color:mt.tertiary }}>{isComplete ? t("done") : `${daysLeft} ${t("left")}`}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}>
                    <motion.div initial={false} animate={{ width:`${pct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                      style={{ height:"100%", background: effectiveQ.fill, borderRadius:999, boxShadow: pct>0 ? `0 0 6px ${softColor}` : "none" }}
                    />
                  </div>
                  {goalPct !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" }}>
                        <motion.div initial={false} animate={{ width:`${goalPct}%` }} transition={{ type:"spring", stiffness:120, damping:24 }}
                          style={{ height:"100%", background:effectiveQ.fill, borderRadius:999, opacity:0.72 }}
                        />
                      </div>
                      <span className="text-[9px] tabular-nums shrink-0" style={{ color:mt.tertiary }}>
                        {activeGoals.filter(g=>g.done).length}/{activeGoals.length} {t("goals")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sprint description */}
                {bg?.description && (
                  <div className="px-3 sm:px-3.5 pb-2">
                    <p className="text-[11px] leading-snug" style={{ color:mt.tertiary, borderLeft:`2px solid ${softColor}`, paddingLeft:8, whiteSpace:"pre-wrap" }}>
                      {bg.description}
                    </p>
                  </div>
                )}

                {/* Checklist */}
                {activeGoals.length > 0 && (
                  <div className="px-3 sm:px-3.5 pb-2">
                    <div className="flex flex-col gap-1">
                      {activeGoals.map(goal => {
                        const cb = goalCheckboxColors(goal.color, dark, effectiveQ.fill, effectiveQ.key);
                        return (
                          <label key={goal.id} className="flex items-start gap-2 cursor-pointer select-none"
                            onClick={() => onGoalToggle(block.id, goal.id)}
                            style={{ color: goal.done ? mt.tertiary : readableGoalTextColor(goal.color, dark, mt.secondary) }}
                          >
                            <div style={{ boxSizing:"border-box", width:14, height:14, borderRadius:4, flexShrink:0, marginTop:1, background: goal.done ? cb.doneBg : cb.emptyBg, border:`1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 150ms ease", cursor:"pointer" }}>
                              {goal.done && <CheckIcon color={cb.icon} />}
                            </div>
                            <span className="text-[11px] leading-snug" style={{ textDecoration: goal.done ? "line-through" : "none", opacity: goal.done ? 0.5 : 1, minWidth:0, overflowWrap:"anywhere", wordBreak:"break-word" }}>
                              {goal.text}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Week rows */}
                <div className="flex flex-col gap-2 sm:gap-2.5 pb-3 pt-1">
                  {blockRows.map(({ days }, ri) => {
                    const wi = startIndex + block.start + ri;
                    const qOffset = block.start + ri;
                    const isCurrent = wi === currentWeekIndex;
                    const isSel = qOffset >= selMin && qOffset <= selMax;
                    const isAnchor = hasSelection && (weekSel!.anchor === qOffset || weekSel!.focus === qOffset);
                    const isPanelOpen = hasSelection && qOffset === selMax;
                    const weekDone = days.reduce((s, d) => { const g = dayGoalsMap[dateKey(d)]; return s + (g ? g.done.filter(Boolean).length : 0); }, 0);
                    const weekTotal = days.reduce((s, d) => { const g = dayGoalsMap[dateKey(d)]; return s + (g ? g.count : 0); }, 0);
                    return (
                      <div key={wi} style={{ display:"flex", flexDirection:"column" }}>
                        {/* Three-column week row: [left 60px] [tiles flex-1] [right 60px] */}
                        <div ref={el => { weekRefs.current[wi] = el; }} style={{ display:"flex", flexDirection:"row", alignItems:"center" }}>
                          {/* LEFT COLUMN — week number, 60px, perfectly centered */}
                          <div style={{ width:60, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <button type="button"
                              onClick={() => onWeekLabelClick(_qi, qOffset)}
                              title={hasSelection ? (isSel ? t("clickMoveEndSelection") : t("extendSelectionHere")) : t("clickStartSprintSelection")}
                              style={{
                                color: isSel || isCurrent ? mt.secondary : mt.tertiary,
                                fontWeight: isCurrent ? 600 : 400,
                                background: "transparent",
                                borderRadius: 4,
                                padding: "2px 6px",
                                border: isAnchor ? `1.5px solid ${quarter.border}66` : "1.5px solid transparent",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                outline: "none",
                                transition: "color 120ms, border 120ms",
                                opacity: hasSelection && !isSel ? 0.4 : 1,
                              }}
                            >
                              <span className="text-[11px] sm:text-[13px] tabular-nums">{wi+1}</span>
                            </button>
                          </div>
                          {/* MIDDLE COLUMN — day tiles, fills remaining space */}
                          <div className="grid grid-cols-7 gap-2 sm:gap-3" style={{ flex:1, minWidth:0, justifyContent:"center" }}>
                            {days.map((d, di) => (
                              <DayTile key={di} date={d} state={dayState(d)} todayProgress={todayProgress}
                                notes={notes[dateKey(d)]} milestones={milestonesMap[dateKey(d)] ?? []}
                                dayGoals={dayGoalsMap[dateKey(d)]}
                                accentColor={effectiveQ.border}
                                highlighted={matchedDates.size > 0 ? matchedDates.has(dateKey(d)) : undefined}
                                isActiveMatch={activeMatchKey === dateKey(d)}
                                dark={dark}
                                onOpen={() => { if (dayState(d)!=="out") onNoteOpen(dateKey(d)); }}
                              />
                            ))}
                          </div>
                          {/* RIGHT COLUMN — goals counter, 60px, perfectly centered */}
                          <div style={{ width:60, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {weekTotal > 0 && (
                              <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:3 }}>
                                <span className="text-[10px] sm:text-[11px] tabular-nums" style={{ fontWeight:500, color: weekDone === weekTotal ? "#34c759" : "var(--text-tertiary)", lineHeight:1 }}>
                                  {weekDone}/{weekTotal}
                                </span>
                                {weekDone === weekTotal && (
                                  <svg width="8" height="7" viewBox="0 0 8 7" fill="none" style={{ flexShrink:0 }}>
                                    <path d="M1 3.5l2.2 2.2L7 1" stroke="#34c759" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Reserved accordion slot — always in DOM, opens with CSS height transition */}
                        <div style={{
                          overflow: "hidden",
                          maxHeight: isPanelOpen ? "72px" : "0",
                          opacity: isPanelOpen ? 1 : 0,
                          marginTop: isPanelOpen ? "8px" : "0",
                          transition: "max-height 0.3s ease-out, opacity 0.25s ease-out, margin-top 0.3s ease-out",
                          pointerEvents: isPanelOpen ? "auto" : "none",
                        }}>
                          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl"
                            style={{ background: dark ? quarter.darkSoft : quarter.soft, border:`1px solid ${quarter.border}55` }}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-[12px] font-semibold truncate" style={{ color: quarter.text }}>
                                {selMin === selMax
                                  ? `${t("week")} ${selMin + startIndex + 1}`
                                  : `${t("week")} ${selMin + startIndex + 1}–${selMax + startIndex + 1}`}
                              </span>
                              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                                {pluralWeeks(selMax - selMin + 1, lang, t)} · {t("clickWeekToAdjust")}
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
                          </div>
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
  const { t } = React.useContext(LangContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement|null>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  const commit = () => { onChange(draft.trim() || value); setEditing(false); };
  if (editing) {
    return <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key==="Enter") commit(); if (e.key==="Escape") { setDraft(value); setEditing(false); } }}
      className="text-[11px] font-semibold tracking-wide bg-transparent outline-none"
      style={{ color, borderBottom:`1px solid ${color}`, minWidth:24, maxWidth:120, padding:"1px 2px" }}
    />;
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-[11px] font-semibold tracking-wide"
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
  return <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold tracking-tight text-left" style={{ color, letterSpacing:"-0.01em" }} title={t("clickToRename")}>{value}</button>;
}

// ─── Fire animation ───────────────────────────────────────────────────────────
const FIRE_EPOCH = Date.now(); // fixed reference point — all tiles sync to this
if (typeof document !== "undefined" && !document.getElementById("lc-fire-style")) {
  const s = document.createElement("style");
  s.id = "lc-fire-style";
  s.textContent = `@keyframes lc-fire-pulse {
    0%,100%{box-shadow:0 0 0 1.5px #ff7722,0 0 6px 2px rgba(255,110,0,0.45),0 0 18px 5px rgba(255,50,0,0.26),0 0 32px 8px rgba(255,100,0,0.12);}
    50%{box-shadow:0 0 0 2px #ffaa00,0 0 12px 4px rgba(255,140,0,0.59),0 0 30px 9px rgba(255,70,0,0.36),0 0 50px 14px rgba(255,120,0,0.18);}
  }.lc-fire-tile{animation:lc-fire-pulse 4s ease-in-out infinite;}`;
  document.head.appendChild(s);
}

// ─── DayTile ──────────────────────────────────────────────────────────────────

function DayTile({ date, state, todayProgress, notes: dayNotes, milestones: dayMilestones, dayGoals, accentColor, highlighted, isActiveMatch, dark, onOpen }: {
  date: Date; state: DayState; todayProgress: number;
  notes?: NoteEntry[]; milestones: Milestone[]; dayGoals?: DayGoals; accentColor: string; highlighted?: boolean; isActiveMatch?: boolean; dark: boolean; onOpen: () => void;
}) {
  const isOut = state==="out";
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const hovered = tooltipRect !== null;
  const isPast = state==="past", isToday = state==="today";
  const isAllDone = dayGoals != null && dayGoals.count > 0 && dayGoals.done.length >= dayGoals.count && dayGoals.done.every(Boolean);
  // Pale accents (e.g. "White") are too light for a single flat text colour to read
  // against reliably: the tile is part accent-fill / part theme surface, and — for
  // "today" — that split moves as the day progresses. Very dark accents (e.g. "Black"
  // in light mode) hit the mirror-image problem: the theme's own dark ink then merges
  // into the dark fill. Either way a flat colour can't win on both sides, so both
  // extremes fall back to "invertPale", which uses mix-blend-mode instead of guessing
  // one colour (see Label for the mechanics).
  const isPaleAccent = luminanceOf(accentColor) > 0.80;    // e.g. White (#d2d2d6); yellow (#ffcc00 ≈ 0.77) must NOT be flagged here or mix-blend-mode:difference turns white text blue
  const isDeepAccent = luminanceOf(accentColor) < 0.3;     // e.g. Black
  const needsInvertText = (isPast || isToday) && (isPaleAccent || isDeepAccent);
  // For the today ring: black accent on dark bg and white accent on light bg are both
  // invisible. Swap to the opposite pole so the border and glow stay visible.
  const ringAccent = (dark  && luminanceOf(accentColor) < 0.12) ? "#e5e5e7"
                   : (!dark && luminanceOf(accentColor) > 0.90) ? "#27272a"
                   : accentColor;
  const labelTone: "onGreen" | "invertPale" | "muted" | "auto" =
    isPast ? (needsInvertText ? "invertPale" : "onGreen") : isToday ? (needsInvertText ? "invertPale" : "auto") : "muted";
  const microMarkers = dayGoals && dayGoals.count > 0 ? (
    <div style={{ position:"absolute", bottom:3, left:0, right:0, display:"flex", justifyContent:"center", alignItems:"center", gap:1, zIndex:6, pointerEvents:"none" }}>
      {Array.from({ length: Math.min(dayGoals.count, 10) }, (_, i) => {
        const done = dayGoals.done[i] ?? false;
        return done ? (
          <svg key={i} width="5" height="5" viewBox="0 0 6 6" fill="none" style={{ flexShrink:0 }}>
            <circle cx="3" cy="3" r="3" fill={isPast ? (isPaleAccent ? "rgba(24,24,27,0.16)" : "rgba(255,255,255,0.92)") : "#34c759"} />
            <path d="M1.5 3l1 1 2-2" stroke={isPast ? (isPaleAccent ? "#18181b" : accentColor) : "white"} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg key={i} width="5" height="5" viewBox="0 0 6 6" fill="none" style={{ flexShrink:0, opacity:0.5 }}>
            <circle cx="3" cy="3" r="2.5" stroke={isPast ? (isPaleAccent ? "rgba(24,24,27,0.55)" : "rgba(255,255,255,0.7)") : "var(--text-tertiary)"} strokeWidth="0.9"/>
          </svg>
        );
      })}
    </div>
  ) : null;
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
  const fireDelayRef = useRef<string | undefined>(undefined);
  if (isAllDone && fireDelayRef.current === undefined) {
    fireDelayRef.current = `${-(((Date.now() - FIRE_EPOCH) % 4000) / 1000).toFixed(3)}s`;
  } else if (!isAllDone) {
    fireDelayRef.current = undefined;
  }
  const base: React.CSSProperties = { borderRadius:12, aspectRatio:"1/1", cursor: isOut?"default":"pointer", transition: isAllDone ? "none" : "box-shadow 200ms ease", position:"relative", boxShadow: isAllDone ? undefined : highlightRing, ...(isAllDone ? { animationDelay: fireDelayRef.current } : {}) };

  // All hooks must run unconditionally on every render (regardless of `isOut`) to keep hook order
  // stable — this effect used to live after the early-return below, crashing when a tile toggled
  // in/out of the "out" state (e.g. when paging between years/months) because hook counts differed.
  useEffect(() => {
    if (!hovered) return;
    const hide = () => setTooltipRect(null);
    window.addEventListener("wheel", hide, { passive: true });
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => {
      window.removeEventListener("wheel", hide);
      window.removeEventListener("scroll", hide, { capture: true });
    };
  }, [hovered]);

  if (isOut) return <div style={{ ...base, background:"transparent", border:"1px dashed var(--border-soft)", opacity:0.35, cursor:"default" }} />;

  const hasEvents = dayMilestones.length > 0;
  const noteDot = hasNote ? (
    <div
      style={{ position:"absolute", top: hasEvents ? 10 : 4, right:4, width:"12px", height:"12px", minWidth:"12px", minHeight:"12px", background:"#007aff", boxShadow:"0 0 3px rgba(0,122,255,0.65)", zIndex:5 }}
      className="absolute flex flex-shrink-0 items-center justify-center rounded-full bg-[#007aff]">
      <span style={{ fontSize:7, color:"white", fontWeight:700, lineHeight:1 }}>{noteCount}</span>
    </div>
  ) : null;

  const msSep = dark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.20)";
  const msBar = dayMilestones.length > 0 ? (
    <div style={{ position:"absolute", top:0, left:0, right:0, height:6, borderRadius:"12px 12px 0 0", display:"flex", overflow:"hidden", zIndex:4 }}>
      {dayMilestones.map((ms, msIdx) => {
        const ec = getEventColors(ms.color, dark);
        const noColor = !ms.color;
        const isLast = msIdx === dayMilestones.length - 1;
        return (
          <React.Fragment key={ms.id}>
            <div style={{
              flex: 1,
              background: noColor ? "transparent" : ec.marker,
              borderBottom: noColor ? `1px solid ${msSep}` : "none",
              boxSizing: "border-box",
              boxShadow: noColor && dark ? "inset 0 1px 3px rgba(0,0,0,0.45)" : undefined,
            }} />
            {!isLast && <div style={{ width:1, flexShrink:0, background: msSep }} />}
          </React.Fragment>
        );
      })}
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
      const TW = 240;
      const LINE_H = 18.6, MAX_LINES = 10, PADDING_V = 22;
      const TH_EST = activeNotes.reduce((sum, n) => {
        const lineCount = Math.min(n.text.split("\n").length, MAX_LINES);
        return sum + lineCount * LINE_H + PADDING_V + 5;
      }, 0);
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
          {activeNotes.map((n, i) => {
            const lines = n.text.split("\n");
            const clipped = lines.length > MAX_LINES;
            const displayText = clipped ? lines.slice(0, MAX_LINES).join("\n") + "\n…" : n.text;
            return (
              <div key={n.id} style={{ marginTop: i > 0 ? 5 : 0, padding:"6px 9px", borderRadius:8, background: "rgba(255,255,255,0.06)", border: `1.5px solid ${getEventColors(n.color, dark).border || "rgba(255,255,255,0.08)"}`, whiteSpace:"pre-wrap", overflow:"hidden", maxHeight:`${MAX_LINES * LINE_H}px` }}>{displayText}</div>
            );
          })}
          {!arrowOnTop && <div style={{ position:"absolute", top:"100%", left:arrowLeft, width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderTop:"6px solid rgba(29,29,31,0.96)" }} />}
        </div>
      );
    })(),
    document.body
  ) : null;


  if (isPast) {
    return (
      <>
        <div ref={tileRef} data-datekey={dk} className={isAllDone ? "lc-fire-tile" : undefined} style={{ ...base }} {...hov}>
          <div className="flex flex-col items-center justify-center" style={{ position:"absolute", inset:0, borderRadius:12, overflow:"hidden", isolation:"isolate", background:`linear-gradient(160deg,${accentColor}cc 0%,${accentColor} 60%,${accentColor}dd 100%)`, color:"white", boxShadow: hovered ? `0 2px 8px ${accentColor}61, inset 0 0 0 0.5px rgba(255,255,255,0.18)` : `0 1px 2px ${accentColor}2e, inset 0 0 0 0.5px rgba(255,255,255,0.18)` }}>
            {msBar}
            <Label number={dayNumber} month={monthAbbr} tone={labelTone} />
            {noteDot}{microMarkers}
          </div>
        </div>
        {tooltipPortal}
      </>
    );
  }
  if (isToday) {
    return (
      <>
        <div ref={tileRef} data-datekey={dk} className={isAllDone ? "lc-fire-tile" : undefined} style={{ ...base }} {...hov}>
          <div className="flex flex-col items-center justify-center" style={{ position:"absolute", inset:0, borderRadius:12, overflow:"hidden", isolation:"isolate", background:"var(--surface)", border:`1.5px solid ${ringAccent}`, boxShadow: hovered ? `0 0 0 4px ${ringAccent}2e,0 4px 18px ${ringAccent}47` : `0 0 0 4px ${ringAccent}1e,0 4px 14px ${ringAccent}2e`, color:"var(--text)" }}>
            {msBar}
            {/* Fill layer: a plain sibling (no position/z-index tricks) so it paints into
                the SAME stacking context as the text below — `isolation: isolate` on the
                outer tile is what scopes mix-blend-mode, and any nested element that sets
                its own z-index would create a second, isolated stacking context and cut
                the text off from seeing this layer entirely. */}
            <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out" style={{ height:`${todayProgress}%`, background:accentColor }} />
            {/* Text layer: position:absolute WITHOUT an explicit z-index. Paint order inside
                a stacking context follows DOM order, so being declared after the fill layer
                above is enough to sit visually on top — no z-index needed, and adding one
                here would re-introduce the bug (a new isolated context that hides the fill
                from `mix-blend-mode: difference`). */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Label number={dayNumber} month={monthAbbr} tone={labelTone} />
            </div>
            {noteDot}{microMarkers}
          </div>
        </div>
        {tooltipPortal}
      </>
    );
  }
  return (
    <>
      <div ref={tileRef} data-datekey={dk} className={isAllDone ? "lc-fire-tile" : undefined} style={{ ...base }} {...hov}>
        <div className="flex flex-col items-center justify-center" style={{ position:"absolute", inset:0, borderRadius:12, overflow:"hidden", background:"var(--surface)", border:"1px solid var(--border-soft)", color:"var(--text-secondary)", boxShadow: hovered ? "0 2px 10px rgba(0,0,0,0.08)" : "0 1px 1px rgba(0,0,0,0.02)" }}>
          {msBar}<Label number={dayNumber} month={monthAbbr} tone={labelTone} />{noteDot}
          {microMarkers}
        </div>
      </div>
      {tooltipPortal}
    </>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ number, month, tone }: { number: number; month: string; tone: "onGreen"|"invertPale"|"muted"|"auto"|"gold"|"goldBright"|"silver"|"silverBright" }) {
  const isGold = tone === "gold";
  const isGoldBright = tone === "goldBright";
  const isSilver = tone === "silver";
  const isSilverBright = tone === "silverBright";
  const isOnGreen = tone === "onGreen";
  // "invertPale" is used for pale accents (e.g. "White") where a single flat text colour
  // can never work: the tile is part light fill / part theme surface, and which part is
  // which changes with fill % and light/dark mode. Instead of guessing a colour, we paint
  // the text pure white and let `mix-blend-mode: difference` invert it per-pixel against
  // whatever sits directly underneath — dark backdrop -> stays light, light fill -> flips
  // to near-black — so the boundary is always correct, at any fill level.
  const isInvertPale = tone === "invertPale";
  const nc = isOnGreen ? "white" : isInvertPale ? "#ffffff" : "var(--text)";
  const mc = isOnGreen ? "rgba(255,255,255,0.85)" : isInvertPale ? "#ffffff" : tone==="muted" ? "var(--text-tertiary)" : "var(--text-secondary)";
  // solid colours — work on any background without gradient-clip artefacts
  const goldCol  = "#e8b338";        // warm gold, readable on dark & light
  const silverCol = "#9e9eae";       // steel silver, readable on light/dark
  const goldBrightCol  = "#ffd700";  // bright gold on coloured accent bg
  const silverBrightCol = "rgba(255,255,255,0.62)"; // dimmed white on coloured bg
  const numColor =
    isGold ? goldCol : isGoldBright ? goldBrightCol :
    isSilver ? silverCol : isSilverBright ? silverBrightCol : nc;
  const monColor =
    isGold ? goldCol : isGoldBright ? goldBrightCol :
    isSilver ? silverCol : isSilverBright ? silverBrightCol : mc;
  // `mixBlendMode: "difference"` on both lines is what performs the auto-inversion.
  // It must be paired with `isolation: "isolate"` on an ancestor (set on the tile's
  // fill wrapper) so the blend only reacts to the fill/backdrop inside this tile,
  // not to unrelated elements elsewhere on the page.
  const numStyle: React.CSSProperties = { color: numColor, letterSpacing:"-0.02em", ...(isInvertPale ? { mixBlendMode: "difference" } : null) };
  const monStyle: React.CSSProperties = { color: monColor, ...(isInvertPale ? { mixBlendMode: "difference", opacity: 0.85 } : null) };
  return (
    <div className="flex flex-col items-center justify-center leading-none select-none">
      <div className="text-[21px] sm:text-[24px] font-semibold tabular-nums" style={numStyle}>{number}</div>
      <div className="mt-1 text-[12px] sm:text-[13px] font-medium tracking-widest" style={monStyle}>{month}</div>
    </div>
  );
}

// ─── NoteEntryItem ────────────────────────────────────────────────────────────
// A single draggable note row. Grabbing anywhere on the card (outside the
// textarea/buttons) and moving the mouse reorders it immediately; on touch
// devices the same grab requires a brief press-and-hold first so an ordinary
// scroll or tap doesn't accidentally pick a note up.
const NOTE_LONG_PRESS_MS = 350;
const NOTE_LONG_PRESS_MOVE_TOLERANCE = 8;

function NoteEntryItem({
  entry, idx, entriesCount, dark, inputBg, borderColor,
  hoveredEntryId, setHoveredEntryId,
  areaRefs, updateEntry, handleNoteHeightChange, setActiveEntryId, handleKey,
  noteHeights, colorBtnRefs, toggleColorPicker, colorPickerEntryId, setConfirmDeleteEntryId,
}: {
  entry: NoteEntry; idx: number; entriesCount: number; dark: boolean; inputBg: string; borderColor: string;
  hoveredEntryId: string | null; setHoveredEntryId: (id: string | null) => void;
  areaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  updateEntry: (id: string, text: string) => void;
  handleNoteHeightChange: (id: string, h: number) => void;
  setActiveEntryId: (id: string | null) => void;
  handleKey: (e: React.KeyboardEvent) => void;
  noteHeights: Record<string, number>;
  colorBtnRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  toggleColorPicker: (id: string) => void;
  colorPickerEntryId: string | null;
  setConfirmDeleteEntryId: (id: string | null) => void;
}) {
  const { t } = React.useContext(LangContext);
  const entryColor = entry.color;
  const ec = entryColor ? getEventColors(resolveNoteHex(entryColor), dark) : null;
  const tintedBg     = ec ? ec.bg         : inputBg;
  const tintedBorder = ec ? ec.border     : borderColor;
  const tintedText   = ec ? ec.textTitle  : "var(--text)";
  const noteAch = entryColor ? achromaticStyle(resolveNoteHex(entryColor), dark) : null;
  const notePlaceholderClass = noteAch ? `placeholder-note-${noteAch.tier}` : undefined;

  return (
    <DraggableCard id={entry.id} dark={dark}>
      <div
        style={{ position:"relative" }}
        onMouseEnter={() => setHoveredEntryId(entry.id)}
        onMouseLeave={() => setHoveredEntryId(null)}
      >
        <TextareaAutosize
          ref={el => { areaRefs.current[entry.id] = el; }}
          value={entry.text}
          onChange={e => updateEntry(entry.id, e.target.value)}
          onHeightChange={h => handleNoteHeightChange(entry.id, h)}
          onFocus={() => setActiveEntryId(entry.id)}
          onBlur={() => setActiveEntryId(null)}
          onKeyDown={handleKey}
          placeholder={idx === 0 ? t("notePlaceholder") : t("anotherNote")}
          minRows={1}
          className={notePlaceholderClass}
          style={{ width:"100%", resize:"none", outline:"none", border:`1.5px solid ${tintedBorder}`, borderRadius:12, padding:"10px 60px 10px 16px", fontSize:14, lineHeight:1.55, fontFamily:"inherit", background:tintedBg, color:tintedText, boxSizing:"border-box", display:"block", overflow:"hidden", transition:"background 200ms ease, border-color 200ms ease", cursor:"text" }}
        />
        <div style={{ position:"absolute", top: (noteHeights[entry.id] ?? 44) > 44 ? 8 : "50%", transform: (noteHeights[entry.id] ?? 44) > 44 ? "none" : "translateY(-50%)", right:8, display:"flex", alignItems:"center", gap:6, transition:"top 150ms", opacity:(hoveredEntryId===entry.id||colorPickerEntryId===entry.id)?1:0, pointerEvents:(hoveredEntryId===entry.id||colorPickerEntryId===entry.id)?"auto":"none", isolation:"isolate" }}>
          <button
            ref={el => { colorBtnRefs.current[entry.id] = el; }}
            onClick={e => { e.stopPropagation(); toggleColorPicker(entry.id); }}
            onPointerDown={e => e.stopPropagation()}
            title={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
            aria-label={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
            data-testid={`note-color-btn-${idx}`}
            style={{ width:19, height:19, borderRadius:999, flexShrink:0, background: normaliseGrey(entryColor) || "transparent", border: entryColor ? "1.5px solid rgba(255,255,255,0.85)" : "1.5px solid var(--border-soft)", boxShadow: entryColor ? "0 1px 3px rgba(0,0,0,0.18)" : undefined, boxSizing:"border-box", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", mixBlendMode:"normal", isolation:"isolate", marginRight:1 }}
          >
            {!entryColor && <span style={{ position:"absolute", width:"55%", height:"1.5px", background: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)", transform:"rotate(-45deg)" }} />}
          </button>
          <button onClick={() => setConfirmDeleteEntryId(entry.id)}
            onPointerDown={e => e.stopPropagation()}
            style={{ width:26, height:26, borderRadius:999, border:"none", background: dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)", color:"#ff3b30", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: hoveredEntryId === entry.id ? 1 : 0, pointerEvents: hoveredEntryId === entry.id ? "auto" : "none", transition:"opacity 150ms, background 0.1s" }}
            onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.28)":"rgba(255,59,48,0.22)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)"; }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>
          </button>
        </div>
      </div>
    </DraggableCard>
  );
}

// ─── DraggableCard ────────────────────────────────────────────────────────────
// Generic drag-handle wrapper reused by both notes and events: a fixed-width
// grip strip triggers the reorder drag (instantly on mouse, after a brief
// press-and-hold on touch) while the wrapped content keeps its own clicks,
// text editing, etc. untouched.
function DraggableCard({ id, dark, children }: { id: string; dark: boolean; children: React.ReactNode }) {
  const { t } = React.useContext(LangContext);
  const dragControls = useDragControls();
  const holdTimer = useRef<number | null>(null);
  const holdStartPos = useRef<{ x: number; y: number } | null>(null);
  const [handleHover, setHandleHover] = useState(false);
  const clearHoldTimer = () => {
    if (holdTimer.current !== null) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    holdStartPos.current = null;
  };
  const startDragFromHandle = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      holdStartPos.current = { x: e.clientX, y: e.clientY };
      holdTimer.current = window.setTimeout(() => { dragControls.start(e); }, NOTE_LONG_PRESS_MS);
    } else {
      dragControls.start(e);
    }
  };
  const cancelHoldOnMove = (e: React.PointerEvent) => {
    if (holdTimer.current === null || !holdStartPos.current) return;
    const dx = Math.abs(e.clientX - holdStartPos.current.x);
    const dy = Math.abs(e.clientY - holdStartPos.current.y);
    if (dx > NOTE_LONG_PRESS_MOVE_TOLERANCE || dy > NOTE_LONG_PRESS_MOVE_TOLERANCE) clearHoldTimer();
  };
  return (
    <Reorder.Item
      value={id}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      layout="position"
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
      transition={{ duration:0.2, ease:"easeOut" }}
      whileDrag={{ scale:1.02, boxShadow:"0 10px 28px rgba(0,0,0,0.22)", zIndex:5 }}
      style={{ overflow:"visible", listStyle:"none" }}
      // Dragging the handle moves the pointer across sibling textareas/inputs
      // while the mouse button is held — the browser's default is to treat
      // that as a text selection. Suspend selection app-wide for the drag.
      onDragStart={() => { document.body.style.userSelect = "none"; document.body.style.webkitUserSelect = "none" as any; }}
      onDragEnd={() => { document.body.style.userSelect = ""; document.body.style.webkitUserSelect = "" as any; }}
    >
      <div style={{ position:"relative", display:"flex", alignItems:"stretch", gap:2 }}>
        <div
          onPointerDown={startDragFromHandle}
          onPointerMove={cancelHoldOnMove}
          onPointerUp={clearHoldTimer}
          onPointerCancel={clearHoldTimer}
          onPointerLeave={clearHoldTimer}
          onMouseEnter={() => setHandleHover(true)}
          onMouseLeave={() => setHandleHover(false)}
          title={t("dragNote")}
          aria-label={t("dragNote")}
          style={{ width:16, flexShrink:0, borderRadius:8, cursor:"grab", display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none", background: handleHover ? (dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.045)") : "transparent", transition:"background 150ms" }}
        >
          <svg width="8" height="16" viewBox="0 0 8 16" fill={dark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.32)"}>
            <circle cx="2" cy="2" r="1.3" /><circle cx="6" cy="2" r="1.3" />
            <circle cx="2" cy="8" r="1.3" /><circle cx="6" cy="8" r="1.3" />
            <circle cx="2" cy="14" r="1.3" /><circle cx="6" cy="14" r="1.3" />
          </svg>
        </div>
        <div style={{ position:"relative", flex:1, minWidth:0 }}>{children}</div>
      </div>
    </Reorder.Item>
  );
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({ dateKey: dk, initial, dark, modalBg, dayMilestones, initDayGoals, tomorrowInitGoals, dayTemplates, onSaveTemplates, onMilestoneUpdate, onMilestoneAdd, onMilestoneDelete, onMilestoneReorder, onDayGoalsChange, onCopyGoalsTo, onSave, onClose }: {
  dateKey: string; initial: NoteEntry[]; dark: boolean; modalBg: string;
  dayMilestones: Milestone[];
  initDayGoals?: DayGoals;
  tomorrowInitGoals?: DayGoals;
  dayTemplates: DayTemplate[];
  onSaveTemplates: (templates: DayTemplate[]) => void;
  onMilestoneUpdate: (updated: Milestone) => void;
  onMilestoneAdd: (ms: Milestone) => void;
  onMilestoneDelete: (id: string) => void;
  onMilestoneReorder: (orderedIds: string[]) => void;
  onDayGoalsChange: (g: DayGoals) => void;
  onCopyGoalsTo: (targetDk: string, g: DayGoals) => void;
  onSave: (entries: NoteEntry[]) => void; onClose: () => void;
}) {
  const [entries, setEntries] = useState<NoteEntry[]>(() => initial);
  const [focusId, setFocusId] = useState<string|null>(null);
  const [goalsDraft, setGoalsDraft] = useState<DayGoals>(() => initDayGoals ?? { count: 0, done: [] });
  // Goals are stored as parallel arrays (no per-item id), but drag-reorder
  // needs a stable identity per item that survives position changes. This
  // local, non-persisted id list tracks 1:1 with goalsDraft's slots and is
  // kept in sync everywhere the slot count changes.
  const [goalIds, setGoalIds] = useState<string[]>(() => Array.from({ length: initDayGoals?.count ?? 0 }, () => makeId()));
  const [focusGoalIdx, setFocusGoalIdx] = useState<number|null>(null);
  const handleGoalAdd = () => {
    const n = goalsDraft.count + 1;
    const newDone = [...goalsDraft.done, false];
    const newLabels = [...(goalsDraft.labels ?? Array(goalsDraft.count).fill("")), ""];
    const newColors = [...(goalsDraft.colors ?? Array(goalsDraft.count).fill(undefined)), undefined];
    const g: DayGoals = { count: n, done: newDone, labels: newLabels, colors: newColors };
    setGoalsDraft(g); onDayGoalsChange(g);
    setGoalIds(prev => [...prev, makeId()]);
    setFocusGoalIdx(n - 1);
  };
  const handleGoalReorder = (newIds: string[]) => {
    const perm = newIds.map(id => goalIds.indexOf(id));
    const reorder = <T,>(arr: T[]): T[] => perm.map(idx => arr[idx]);
    const newDone = reorder(Array.from({ length: goalsDraft.count }, (_, i) => goalsDraft.done[i] ?? false));
    const newLabels = reorder(Array.from({ length: goalsDraft.count }, (_, i) => goalsDraft.labels?.[i] ?? ""));
    const newColors = reorder(Array.from({ length: goalsDraft.count }, (_, i) => goalsDraft.colors?.[i]));
    const g: DayGoals = { count: goalsDraft.count, done: newDone, labels: newLabels, colors: newColors };
    setGoalsDraft(g); onDayGoalsChange(g); setGoalIds(newIds);
  };
  const handleGoalToggle = (i: number) => {
    const newDone = Array.from({ length: goalsDraft.count }, (_, j) => j === i ? !(goalsDraft.done[j] ?? false) : (goalsDraft.done[j] ?? false));
    const g: DayGoals = { ...goalsDraft, done: newDone };
    setGoalsDraft(g); onDayGoalsChange(g);
    if (newDone.every(Boolean) && newDone.length > 0) setTimeout(fireConfettiCannons, 80);
  };
  const handleGoalLabelChange = (i: number, value: string) => {
    const newLabels = Array.from({ length: goalsDraft.count }, (_, j) => j === i ? value : (goalsDraft.labels?.[j] ?? ""));
    const g: DayGoals = { ...goalsDraft, labels: newLabels };
    setGoalsDraft(g); onDayGoalsChange(g);
  };
  const handleGoalColorChange = (i: number, color: string|undefined) => {
    const newColors: (string|undefined)[] = Array.from({ length: goalsDraft.count }, (_, j) => j === i ? color : goalsDraft.colors?.[j]);
    const g: DayGoals = { ...goalsDraft, colors: newColors };
    setGoalsDraft(g); onDayGoalsChange(g);
    setGoalColorPickerIdx(null);
  };
  const handleGoalDelete = (i: number) => {
    const newCount = goalsDraft.count - 1;
    if (newCount < 0) return;
    const newDone = goalsDraft.done.filter((_, j) => j !== i);
    const newLabels = (goalsDraft.labels ?? []).filter((_, j) => j !== i);
    const newColors = (goalsDraft.colors ?? []).filter((_, j) => j !== i);
    const g: DayGoals = { count: newCount, done: newDone, labels: newLabels, colors: newColors };
    setGoalsDraft(g); onDayGoalsChange(g);
    setGoalIds(prev => prev.filter((_, j) => j !== i));
  };
  const [hoveredGoalIdx, setHoveredGoalIdx] = useState<number|null>(null);
  const [goalColorPickerIdx, setGoalColorPickerIdx] = useState<number|null>(null);
  const [goalColorPickerPos, setGoalColorPickerPos] = useState<{top:number;left:number}|null>(null);
  const goalColorBtnRefs = useRef<(HTMLButtonElement|null)[]>([]);
  const goalColorPopoverRef = useRef<HTMLDivElement|null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteGoalIdx, setConfirmDeleteGoalIdx] = useState<number|null>(null);
  const handleGoalReset = () => {
    const g: DayGoals = { count: 0, done: [], labels: [] };
    setGoalsDraft(g); onDayGoalsChange(g); setConfirmReset(false);
    setGoalIds([]);
  };
  const [templateMgrOpen, setTemplateMgrOpen] = useState(false);
  const [saveTplPrefill, setSaveTplPrefill] = useState<string[] | null>(null);
  const applyTemplate = (tpl: DayTemplate) => {
    const items = tpl.items.filter(s => s.trim());
    const n = Math.max(1, items.length);
    const g: DayGoals = { count: n, done: Array(n).fill(false), labels: items.slice(0, n) };
    setGoalsDraft(g); onDayGoalsChange(g); setTemplateMgrOpen(false);
    setGoalIds(Array.from({ length: n }, () => makeId()));
  };
  const [copiedTomorrow, setCopiedTomorrow] = useState(false);
  const [confirmCopyTomorrow, setConfirmCopyTomorrow] = useState(false);
  const tomorrowDk = (() => {
    const [yr, mo, dy] = dk.split("-").map(Number) as [number,number,number];
    const t = new Date(yr, mo - 1, dy + 1);
    return dateKey(t);
  })();
  const tomorrowAlreadyHasGoals = (tomorrowInitGoals?.count ?? 0) > 0;
  const doCopyToTomorrow = () => {
    const g: DayGoals = { count: goalsDraft.count, done: Array(goalsDraft.count).fill(false), labels: goalsDraft.labels ? [...goalsDraft.labels] : [] };
    onCopyGoalsTo(tomorrowDk, g);
    setCopiedTomorrow(true);
    setConfirmCopyTomorrow(false);
    setTimeout(() => setCopiedTomorrow(false), 1800);
  };
  const handleCopyToTomorrow = () => {
    if (tomorrowAlreadyHasGoals) { setConfirmCopyTomorrow(true); } else { doCopyToTomorrow(); }
  };
  const _doneSlice = goalsDraft.done.slice(0, goalsDraft.count);
  const allGoalsDone = goalsDraft.count > 0 && _doneSlice.length === goalsDraft.count && _doneSlice.every(Boolean);
  const scrollBodyRef = useRef<HTMLDivElement|null>(null);
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
    if (focusId) {
      requestAnimationFrame(() => {
        const el = areaRefs.current[focusId];
        if (el) { el.focus({ preventScroll: true }); el.setSelectionRange(el.value.length, el.value.length); }
      });
    }
  }, [focusId]);

  // Note height tracking is now delegated entirely to <TextareaAutosize>
  // (react-textarea-autosize), which measures scrollHeight itself and keeps
  // it in sync via a ResizeObserver — no manual rAF/height-hack juggling.
  // We only keep the resulting heights around to position the hover-overlay
  // buttons (color/delete) below the placeholder-height threshold.
  const [noteHeights, setNoteHeights] = useState<Record<string,number>>({});
  const handleNoteHeightChange = (id: string, h: number) => {
    setNoteHeights(prev => prev[id] === h ? prev : { ...prev, [id]: h });
  };

  // Same idea as noteHeights above, but for day-goal rows: lets the hover
  // overlay (color/delete buttons) pin to the top-right corner once the goal
  // label wraps onto 2+ lines, instead of overlapping the wrapped text.
  const [goalHeights, setGoalHeights] = useState<Record<number,number>>({});
  const handleGoalHeightChange = (i: number, h: number) => {
    setGoalHeights(prev => prev[i] === h ? prev : { ...prev, [i]: h });
  };

  // Track whether a day-event's title wraps onto 2+ lines, so the edit/delete
  // buttons can stack vertically (delete on top, edit below) instead of side by side.

  const { t, lang } = React.useContext(LangContext);

  // Milestone inline edit state
  const msEditRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const msEditInputRef = React.useRef<HTMLTextAreaElement|null>(null);
  const [msEditId, setMsEditId] = useState<string|null>(null);
  const [msEditLabel, setMsEditLabel] = useState("");
  const [msEditDate, setMsEditDate] = useState("");
  const [msEditColor, setMsEditColor] = useState("");
  const [msEditDesc, setMsEditDesc] = useState("");
  const [msEditRecurring, setMsEditRecurring] = useState(false);
  const [msEditRecurSpinKey, setMsEditRecurSpinKey] = useState(0);
  const msEditColorBtnRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const msEditColorPopoverRef = React.useRef<HTMLDivElement|null>(null);
  const [msEditColorPickerOpen, setMsEditColorPickerOpen] = useState(false);
  const [msEditColorPickerPos, setMsEditColorPickerPos] = useState<{top:number;left:number}|null>(null);

  // New event form state
  const newLabelInputRef = React.useRef<HTMLTextAreaElement|null>(null);
  const addEventFormRef = React.useRef<HTMLDivElement|null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState(dk);
  const [newColor, setNewColor] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRecurSpinKey, setNewRecurSpinKey] = useState(0);
  const newColorBtnRef = React.useRef<HTMLButtonElement|null>(null);
  const newColorPopoverRef = React.useRef<HTMLDivElement|null>(null);
  const [newColorPickerOpen, setNewColorPickerOpen] = useState(false);
  const [newColorPickerPos, setNewColorPickerPos] = useState<{top:number;left:number}|null>(null);

  const submitNewEvent = () => {
    if (!newLabel.trim()) return;
    onMilestoneAdd({ id: makeId(), label: newLabel.trim(), date: newDate, color: newColor, description: newDesc.trim() || undefined, recurring: newRecurring || undefined });
    setNewLabel(""); setNewDesc(""); setNewRecurring(false); setNewColor(""); setNewDate(dk);
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

  React.useEffect(() => {
    if (!msEditId) return;
    const handler = (e: MouseEvent) => {
      const el = msEditRefs.current.get(msEditId);
      const popover = msEditColorPopoverRef.current;
      if (popover && popover.contains(e.target as Node)) return;
      if (el && !el.contains(e.target as Node)) {
        setMsEditId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [msEditId]);

  React.useEffect(() => {
    if (!msEditId) setMsEditColorPickerOpen(false);
  }, [msEditId]);

  React.useEffect(() => {
    if (!msEditId) return;
    const t = setTimeout(() => { const el = msEditInputRef.current; if (el) { el.focus({ preventScroll: true }); } }, 300);
    return () => clearTimeout(t);
  }, [msEditId]);

  React.useEffect(() => {
    if (!addEventOpen) return;
    const t = setTimeout(() => { const el = newLabelInputRef.current; if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } }, 320);
    return () => clearTimeout(t);
  }, [addEventOpen]);

  React.useEffect(() => {
    if (!addEventOpen) return;
    const handler = (e: MouseEvent) => {
      const popover = newColorPopoverRef.current;
      if (popover && popover.contains(e.target as Node)) return;
      if (addEventFormRef.current && !addEventFormRef.current.contains(e.target as Node)) {
        setAddEventOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addEventOpen]);

  React.useEffect(() => {
    if (!addEventOpen) setNewColorPickerOpen(false);
  }, [addEventOpen]);

  React.useEffect(() => {
    if (!newColorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      const popover = newColorPopoverRef.current;
      const btn = newColorBtnRef.current;
      if (popover && popover.contains(e.target as Node)) return;
      if (btn && btn.contains(e.target as Node)) return;
      setNewColorPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [newColorPickerOpen]);

  React.useEffect(() => {
    if (!msEditColorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      const popover = msEditColorPopoverRef.current;
      const btn = msEditId ? msEditColorBtnRefs.current.get(msEditId) ?? null : null;
      if (popover && popover.contains(e.target as Node)) return;
      if (btn && btn.contains(e.target as Node)) return;
      setMsEditColorPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [msEditColorPickerOpen]);

  React.useEffect(() => {
    if (goalColorPickerIdx === null) return;
    const handler = (e: MouseEvent) => {
      const popover = goalColorPopoverRef.current;
      const btn = goalColorBtnRefs.current[goalColorPickerIdx];
      if (popover && popover.contains(e.target as Node)) return;
      if (btn && btn.contains(e.target as Node)) return;
      setGoalColorPickerIdx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [goalColorPickerIdx]);

  const [y, m, d] = dk.split("-").map(Number) as [number,number,number];
  const label = new Date(y, m-1, d).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { weekday:"long", month:"long", day:"numeric" });
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)";
  const inputStyleMs: React.CSSProperties = { background: inputBg, border:`1px solid ${borderColor}`, borderRadius:8, padding:"6px 9px", fontSize:12, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };

  const addEntry = () => {
    const id = makeId();
    setEntries(prev => [...prev, { id, text: "", createdAt: Date.now() }]);
    // TextareaAutosize handles its own sizing on mount, so we only need to
    // focus the new (empty) note and scroll it into view once it's painted.
    requestAnimationFrame(() => {
      const body = scrollBodyRef.current;
      if (body) body.scrollTop = body.scrollHeight;
      areaRefs.current[id]?.focus();
    });
  };
  const updateEntry = (id: string, text: string) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, text } : e));
  const updateEntryColor = (id: string, color: string | undefined) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, color } : e));
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string|null>(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string|null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string|null>(null);
  const [confirmDeleteMsIdDay, setConfirmDeleteMsIdDay] = useState<string|null>(null);
  const [hoveredMsId, setHoveredMsId] = useState<string|null>(null);
  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    setConfirmDeleteEntryId(null);
  };
  const handleReorderEntryIds = (newIds: string[]) => {
    setEntries(prev => newIds.map(id => prev.find(e => e.id === id)!));
  };
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onSave(entries);
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (templateMgrOpen) {
    return (
      <DayTemplatesModal
        dark={dark} modalBg={modalBg}
        templates={dayTemplates}
        onSave={onSaveTemplates}
        onApply={applyTemplate}
        prefillItems={saveTplPrefill ?? undefined}
        onClose={() => { setTemplateMgrOpen(false); setSaveTplPrefill(null); }}
        onCloseAll={onClose}
      />
    );
  }

  return (
    <motion.div initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={() => { setColorPickerEntryId(null); onClose(); }}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)" }}
      />
      <motion.div initial={{ opacity:0, scale:0.95, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.96, y:8 }}
        transition={{ type:"spring", stiffness:380, damping:30 }} onClick={e => { e.stopPropagation(); setColorPickerEntryId(null); }}
        style={{ width:"min(92vw,400px)", background:modalBg, backdropFilter:"saturate(180%) blur(24px)", WebkitBackdropFilter:"saturate(180%) blur(24px)", borderRadius:22, boxShadow:"0 8px 48px rgba(0,0,0,0.26)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:"85vh" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-tight" style={{ color:"var(--text)" }}>{label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer", flexShrink:0 }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollBodyRef} style={{ flex:1, overflowY:"auto", minHeight:0, scrollbarWidth:"thin", scrollbarColor: dark?"rgba(255,255,255,0.20) transparent":"rgba(0,0,0,0.18) transparent" }}>

        {/* Daily Goals */}
        <div className="px-5 pt-1 shrink-0" style={{ borderBottom:"1px solid var(--border-soft)", paddingBottom: 12 }}>
          {/* Header row — only appears once goals exist */}
          {goalsDraft.count > 0 && (
          <div style={{ display:"flex", flexWrap:"nowrap", alignItems:"center", justifyContent:"flex-start", gap:6, marginBottom:8, userSelect:"none" }}>
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"var(--text-tertiary)", whiteSpace:"nowrap", flexShrink:0 }}>{t("dailyGoals")}</span>
            {!confirmReset && !confirmCopyTomorrow && (
              <button onClick={e => { e.stopPropagation(); setTemplateMgrOpen(true); }} title={t("applyTemplateBtn")}
                style={{ width:14, height:14, flexShrink:0, border:"none", background:"transparent", cursor:"pointer", color:"var(--text-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="11" height="4" rx="1"/></svg>
              </button>
            )}
            {goalsDraft.count > 0 && !confirmReset && !confirmCopyTomorrow && dayTemplates.length < 20 && (
              <button onClick={e => { e.stopPropagation(); const labels = (goalsDraft.labels ?? []).slice(0, goalsDraft.count).map(s => s.trim()).filter(Boolean); const items = labels.length > 0 ? labels : Array.from({ length: goalsDraft.count }, (_, i) => `${t("goal")} ${i + 1}`); setSaveTplPrefill(items); setTemplateMgrOpen(true); }} title={t("saveAsTemplate")}
                style={{ width:14, height:14, flexShrink:0, border:"none", background:"transparent", cursor:"pointer", color:"var(--text-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </button>
            )}
            {goalsDraft.count > 0 && !confirmReset && (
              <button onClick={e => { e.stopPropagation(); handleCopyToTomorrow(); }} title={t("copyToTomorrow")}
                style={{ width:14, height:14, flexShrink:0, border:"none", background:"transparent", cursor:"pointer", color: copiedTomorrow ? "#34c759" : "var(--text-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", padding:0, transition:"color 200ms" }}>
                {copiedTomorrow
                  ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <svg width="10" height="9" viewBox="0 0 11 10" fill="none"><rect x="0.5" y="0.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1"/><path d="M3 3h7v7H3z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fill="none"/></svg>
                }
              </button>
            )}
            {goalsDraft.count > 0 && !confirmReset && (
              <button onClick={e => { e.stopPropagation(); setConfirmReset(true); }} title={t("resetGoals")}
                style={{ width:14, height:14, flexShrink:0, border:"none", background:"transparent", cursor:"pointer", color:"#ff3b30", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
                <span style={{ fontSize:12, lineHeight:1, fontWeight:400 }}>↺</span>
              </button>
            )}
            {/* Spacer */}
            <div style={{ flex:1 }} />
            {/* Progress pill */}
            {goalsDraft.count > 0 && (
              <span style={{ fontSize:10, fontWeight:600, color: allGoalsDone ? "#34c759" : "var(--text-tertiary)", background: allGoalsDone ? (dark?"rgba(52,199,89,0.18)":"rgba(52,199,89,0.12)") : (dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)"), borderRadius:99, padding:"1px 7px", flexShrink:0, transition:"color 200ms, background 200ms" }}>
                {goalsDraft.done.filter(Boolean).length}/{goalsDraft.count}
              </span>
            )}
          </div>
          )}
          {/* Progress bar */}
          {goalsDraft.count > 0 && (
            <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)" }}>
              <motion.div
                initial={false}
                animate={{ width: `${(goalsDraft.done.filter(Boolean).length / goalsDraft.count) * 100}%` }}
                transition={{ type:"spring", stiffness:120, damping:24 }}
                style={{ height:"100%", borderRadius:999, background:"#34c759" }}
              />
            </div>
          )}
          {/* Body — always shown */}
          <div style={{ overflow:"visible" }}>
            {/* Confirm dialogs (copy-to-tomorrow / reset) */}
            {(confirmCopyTomorrow || confirmReset) && (
              <div style={{ display:"flex", flexWrap:"nowrap", alignItems:"center", gap:6, marginBottom:8 }}>
                {confirmCopyTomorrow ? (
                  <>
                    <span style={{ fontSize:11, color:"var(--text-tertiary)", flexShrink:0 }}>{t("tomorrowHasGoals")}</span>
                    <button onClick={() => setConfirmCopyTomorrow(false)} style={{ fontSize:11, padding:"1px 7px", borderRadius:5, border:`1px solid ${dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.12)"}`, background:"transparent", color:"var(--text-secondary)", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>{t("no")}</button>
                    <button onClick={doCopyToTomorrow} style={{ fontSize:11, padding:"1px 7px", borderRadius:5, border:"none", background:"#007aff", color:"white", cursor:"pointer", fontFamily:"inherit", fontWeight:600, flexShrink:0 }}>{t("replace")}</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize:11, color:"var(--text-tertiary)", flexShrink:0 }}>{t("deleteConfirm")}</span>
                    <button onClick={() => setConfirmReset(false)} style={{ fontSize:11, padding:"1px 7px", borderRadius:5, border:`1px solid ${dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.12)"}`, background:"transparent", color:"var(--text-secondary)", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>{t("no")}</button>
                    <button onClick={handleGoalReset} style={{ fontSize:11, padding:"1px 7px", borderRadius:5, border:"none", background:"#ff3b30", color:"white", cursor:"pointer", fontFamily:"inherit", fontWeight:600, flexShrink:0 }}>{t("remove")}</button>
                  </>
                )}
              </div>
            )}
            {goalsDraft.count > 0 && (
              <Reorder.Group
                as="div"
                axis="y"
                values={goalIds}
                onReorder={handleGoalReorder}
                className="flex flex-col gap-1.5"
                style={{ listStyle:"none", margin:0, padding:0 }}
              >
              <AnimatePresence initial={false}>
                {Array.from({length:goalsDraft.count},(_,i)=>{
                  const done = goalsDraft.done[i]??false;
                  const goalColor = goalsDraft.colors?.[i];
                  const ec = getEventColors(goalColor ?? "", dark);
                  const containerBg = ec.bg;
                  const containerBorder = ec.border;
                  const textColor = done ? "var(--text-tertiary)" : ec.textTitle;
                  const isHovered = hoveredGoalIdx === i;
                  const isColorOpen = goalColorPickerIdx === i;
                  const goalId = goalIds[i] ?? `goal-fallback-${i}`;
                  return (
                    <DraggableCard key={goalId} id={goalId} dark={dark}>
                    <div
                      onMouseEnter={() => setHoveredGoalIdx(i)}
                      onMouseLeave={() => setHoveredGoalIdx(null)}
                      style={{ position:"relative", display:"flex", alignItems:"center", gap:8, background: containerBg, border:`1.5px solid ${containerBorder}`, borderRadius:12, padding:"8px 59px 8px 10px", boxShadow: ec.boxShadow || undefined, transition:"background 150ms ease, border-color 150ms ease" }}>
                      {(() => { const _cbAch = goalColor ? goalCheckboxAchromaticStyle(resolveNoteHex(goalColor), dark) : null; const checkColor = _cbAch ? _cbAch.bg : (goalColor ?? "#34c759"); const uncheckedBorder = goalColor ? (_cbAch ? _cbAch.border : `${goalColor}80`) : "var(--border-soft)"; return (
                      <div onClick={()=>handleGoalToggle(i)} style={{ width:16,height:16,borderRadius:5,flexShrink:0,background:done?checkColor:"transparent",border:`1.5px solid ${done?checkColor:uncheckedBorder}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 150ms ease, border-color 150ms ease",cursor:"pointer" }}>
                        {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke={swatchCheckColor(checkColor)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      ); })()}
                      <TextareaAutosize
                        ref={el => { if (el && focusGoalIdx === i) { el.focus(); setFocusGoalIdx(null); } }}
                        value={goalsDraft.labels?.[i] ?? ""}
                        onChange={e => handleGoalLabelChange(i, e.target.value)}
                        onHeightChange={h => handleGoalHeightChange(i, h)}
                        onMouseDown={e => { if (goalColorPickerIdx !== null) setGoalColorPickerIdx(null); e.stopPropagation(); }}
                        placeholder={`${t("goal")} ${i+1}`}
                        minRows={1}
                        style={{ flex:1,background:"transparent",border:"none",outline:"none",resize:"none",overflow:"hidden",overflowWrap:"anywhere",wordBreak:"break-word",fontSize:13,color:textColor,textDecoration:done?"line-through":"none",opacity:done?0.55:1,transition:"color 150ms, opacity 150ms",lineHeight:1.35,fontFamily:"inherit",padding:0,cursor:"text",minWidth:0,display:"block",boxSizing:"border-box" }}
                      />
                      <div style={{ position:"absolute", top: (goalHeights[i] ?? 18) > 20 ? 8 : "50%", transform: (goalHeights[i] ?? 18) > 20 ? "none" : "translateY(-50%)", right:8, display:"flex", alignItems:"center", gap:6, transition:"top 150ms", opacity:(isHovered||isColorOpen)?1:0, pointerEvents:(isHovered||isColorOpen)?"auto":"none", isolation:"isolate" }}>
                        <button
                          ref={el => { goalColorBtnRefs.current[i] = el; }}
                          onClick={e => { e.stopPropagation(); if (goalColorPickerIdx===i) { setGoalColorPickerIdx(null); return; } const btn=goalColorBtnRefs.current[i]; if(btn){setGoalColorPickerPos(clampedPopoverPos(btn.getBoundingClientRect(), 152, 100));} setGoalColorPickerIdx(i); }}
                          onPointerDown={e => e.stopPropagation()}
                          title={t("chooseColor")}
                          aria-label={t("chooseColor")}
                          style={{ width:19, height:19, borderRadius:999, flexShrink:0, background: normaliseGrey(goalColor) || "transparent", border: goalColor ? "1.5px solid rgba(255,255,255,0.85)" : "1.5px solid var(--border-soft)", boxShadow: goalColor ? "0 1px 3px rgba(0,0,0,0.18)" : undefined, boxSizing:"border-box", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", mixBlendMode:"normal", isolation:"isolate", marginRight:1 }}
                        >
                          {!goalColor && <span style={{ position:"absolute", width:"55%", height:"1.5px", background: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)", transform:"rotate(-45deg)" }} />}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteGoalIdx(i); }}
                          onPointerDown={e => e.stopPropagation()}
                          style={{ width:26,height:26,borderRadius:999,border:"none",background:dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)",color:"#ff3b30",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.1s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.28)":"rgba(255,59,48,0.22)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)"; }}>
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>
                        </button>
                      </div>
                    </div>
                    </DraggableCard>
                  );
                })}
              </AnimatePresence>
              </Reorder.Group>
            )}
            {goalsDraft.count > 0 && allGoalsDone && (
              <div className="mt-0.5 text-center text-[12px] font-semibold" style={{ color:"#34c759" }}>{t("allDone")}</div>
            )}
            {!confirmCopyTomorrow && !confirmReset && (
              <button onClick={e => { e.stopPropagation(); handleGoalAdd(); }}
                style={{ width:"100%", height:32, borderRadius:9, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginTop: goalsDraft.count > 0 ? 8 : 0 }}>
                <span style={{ fontSize:14, lineHeight:1 }}>+</span> {t("addGoal")}
              </button>
            )}
            {goalColorPickerIdx !== null && goalColorPickerPos && ReactDOM.createPortal(
              <motion.div
                key="goal-color-popover"
                ref={goalColorPopoverRef}
                initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                transition={{ type:"spring", stiffness:420, damping:28 }}
                onClick={e => e.stopPropagation()}
                style={{ position:"fixed", top:goalColorPickerPos.top, left:goalColorPickerPos.left, zIndex:300, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:152, isolation:"isolate" }}
              >
                <div style={{ position:"fixed", inset:0, zIndex:-1 }} onClick={() => setGoalColorPickerIdx(null)} />
                <button onClick={() => handleGoalColorChange(goalColorPickerIdx, undefined)}
                  title={t("noColor")}
                  style={{ width:20, height:20, borderRadius:999, background:dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)", border:!goalsDraft.colors?.[goalColorPickerIdx]?`1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}`:"1.5px solid transparent", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
                </button>
                {APPLE_COLORS.map(ac => {
                  const hex = dark ? ac.dark : hexSaturate(ac.light, LIGHT_SAT_FACTOR);
                  const selected = goalsDraft.colors?.[goalColorPickerIdx] === hex;
                  return (
                    <button key={ac.key} onClick={() => handleGoalColorChange(goalColorPickerIdx, hex)}
                      title={ac.label}
                      style={{ width:20, height:20, borderRadius:999, background:hex, border:"1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow:(ac.key==="white"||ac.key==="grey")?"inset 0 0 0 1px rgba(0,0,0,0.15)":undefined, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform:selected?"scale(1.08)":"scale(1)" }}>
                      {selected && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color:swatchCheckColor(hex) }}>✓</span>}
                    </button>
                  );
                })}
              </motion.div>,
              document.body
            )}
          </div>
        </div>

        {/* Milestones for this day */}
        {dayMilestones.length > 0 && (
          <div className="px-5 pt-3 pb-0 shrink-0">
            <div className="text-[10px] font-semibold tracking-widest uppercase mb-1.5" style={{ color:"var(--text-tertiary)" }}>{t("events")}</div>
            <Reorder.Group
              as="div"
              axis="y"
              values={dayMilestones.map(ms => ms.id)}
              onReorder={onMilestoneReorder}
              className="flex flex-col gap-1.5"
              style={{ listStyle:"none", margin:0, padding:0 }}
            >
            <AnimatePresence initial={false}>
              {dayMilestones.map(ms => {
                const isEditing = msEditId === ms.id;
                const ec2 = getEventColors(isEditing ? msEditColor : ms.color, dark);
                const cardBg  = ec2.bg;
                const cardBdr = isEditing ? ec2.borderEditing : ec2.border;
                const cardTxt = ec2.textTitle;
                const cardFormTxt = ec2.textTitle;
                const cardFormSec = ec2.textDesc;
                const cardFormBdr = ec2.formBorder;
                const cardFormBg  = ec2.formBg;
                const hovering = hoveredMsId === ms.id && !isEditing;
                return (
                  <DraggableCard key={ms.id} id={ms.id} dark={dark}>
                  <div
                    style={{ position:"relative", borderRadius:12, overflow:"hidden", background:cardBg, border: `1.5px solid ${ec2.border || "transparent"}`, boxShadow: ec2.boxShadow || undefined, transition:"background 0.25s ease, border-color 0.25s ease" }}
                    onMouseEnter={() => setHoveredMsId(ms.id)}
                    onMouseLeave={() => setHoveredMsId(null)}>
                    {/* View row — collapses when editing */}
                    <div style={{ maxHeight: isEditing ? 0 : "none", opacity: isEditing ? 0 : 1, overflow:"hidden", transition:"max-height 0.3s ease-in-out, opacity 0.18s ease-in-out", pointerEvents: isEditing ? "none" : "auto" }}>
                      {/* Card view — pure CSS Flexbox, no JS measurement, no absolute positioning.
                           Card height = content height only (no min-height).
                           align-items:center → buttons auto-centre on short cards.
                           flex-wrap on buttons → × stays right, ✎ wraps below on tall cards. */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px" }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <span className="text-[13px] font-semibold leading-snug"
                            style={{ color:cardTxt, wordBreak:"break-all", overflowWrap:"anywhere", display:"block" }}>
                            {ms.label}
                          </span>
                          {ms.description && (
                            <div className="text-[11px] leading-snug"
                              style={{ marginTop:3, color:cardFormSec, wordBreak:"break-all", overflowWrap:"anywhere" }}>
                              {ms.description}
                            </div>
                          )}
                          {ms.recurring && (
                            <div style={{ display:"inline-flex", alignItems:"center", gap:3, marginTop:5, padding:"2px 6px 2px 4px", borderRadius:5, background: dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)" }}>
                              <span style={{ fontSize:10, lineHeight:1, color:cardFormSec, opacity:0.7 }}>↻</span>
                              <span style={{ fontSize:10, lineHeight:1, color:cardFormSec, opacity:0.65 }}>{t("repeatYearly")}</span>
                            </div>
                          )}
                        </div>
                        {/* Buttons in document flow — flex-wrap + row-reverse: × first in DOM = always top-right */}
                        <div style={{ display:"flex", flexDirection:"row-reverse", flexWrap:"wrap", gap:6, maxWidth:70, flexShrink:0, alignSelf:"flex-start", opacity: hovering ? 1 : 0, pointerEvents: hovering ? "auto" : "none", transition:"opacity 0.15s ease-in-out" }}>
                          <button onClick={() => setConfirmDeleteMsIdDay(ms.id)} title={t("remove")}
                            style={{ width:26, height:26, borderRadius:999, border:"none", background: dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)", color:"#ff3b30", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.1s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.28)":"rgba(255,59,48,0.22)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)"; }}>
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>
                          </button>
                          <button onClick={() => startMsEdit(ms)} title={t("edit")}
                            style={{ width:26, height:26, borderRadius:999, border:"none", background: dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)", color: dark?"rgba(255,255,255,0.8)":"rgba(0,0,0,0.65)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.1s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)"; }}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Edit form — expands when editing */}
                    <div ref={el => { if (el) msEditRefs.current.set(ms.id, el); else msEditRefs.current.delete(ms.id); }} style={{ maxHeight: isEditing ? "2000px" : 0, opacity: isEditing ? 1 : 0, overflow:"hidden", transition:"max-height 0.35s ease-in-out, opacity 0.22s ease-in-out", pointerEvents: isEditing ? "auto" : "none" }}>
                      <div className="flex flex-col gap-1.5" style={{ padding:"8px 10px" }}>
                        <div className="flex gap-1.5" style={{ isolation:"isolate", alignItems:"flex-start" }}>
                          <TextareaAutosize ref={msEditInputRef} value={msEditLabel} onChange={e => setMsEditLabel(e.target.value)}
                            onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); saveMsEdit(); } if (e.key==="Escape") setMsEditId(null); }}
                            placeholder={t("labelPlaceholder")} minRows={1}
                            style={{ ...inputStyleMs, flex:1, minWidth:0, resize:"none", overflow:"hidden", lineHeight:1.5, color:cardFormTxt, background:cardFormBg, border:`1px solid ${cardFormBdr}` } as any} />
                        </div>
                        <div style={{ position:"relative" }}>
                          <TextareaAutosize value={msEditDesc} onChange={e => setMsEditDesc(e.target.value)}
                            placeholder={t("editDescPlaceholder")} minRows={2}
                            style={{ ...inputStyleMs, width:"100%", resize:"none", overflow:"hidden", lineHeight:1.5, borderRadius:8, padding:"5px 9px", display:"block", color:cardFormTxt, background:cardFormBg, border:`1px solid ${cardFormBdr}` } as any} />
                        </div>
                        {msEditColorPickerOpen && msEditColorPickerPos && ReactDOM.createPortal(
                          <motion.div
                            key="ms-edit-color-popover"
                            ref={msEditColorPopoverRef}
                            initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                            transition={{ type:"spring", stiffness:420, damping:28 }}
                            onClick={e => e.stopPropagation()}
                            style={{ position:"fixed", top:msEditColorPickerPos.top, left:msEditColorPickerPos.left, zIndex:300, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:156, isolation:"isolate" }}
                          >
                            <div style={{ position:"fixed", inset:0, zIndex:-1 }} onClick={() => setMsEditColorPickerOpen(false)} />
                            <button onClick={() => { setMsEditColor(""); setMsEditColorPickerOpen(false); }}
                              title={t("noColor")}
                              style={{ width:20, height:20, borderRadius:999, background:dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)", border: msEditColor==="" ? `1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}` : "1.5px solid transparent", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
                            </button>
                            {MILESTONE_COLORS.map(c => (
                              <button key={c} onClick={() => { setMsEditColor(msEditColor === c ? "" : c); setMsEditColorPickerOpen(false); }}
                                title={c}
                                style={{ width:20, height:20, borderRadius:999, background:c, border: msEditColor===c ? "1.5px solid var(--text)" : "1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow: (c==="#ffffff" || c==="#8e8e93") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform: msEditColor===c ? "scale(1.08)" : "scale(1)" }}>
                                {msEditColor===c && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color:swatchCheckColor(c) }}>✓</span>}
                              </button>
                            ))}
                          </motion.div>,
                          document.body
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5" style={{ isolation:"isolate", marginLeft:2 }}>
                            <button
                              ref={el => { if (el) msEditColorBtnRefs.current.set(ms.id, el); else msEditColorBtnRefs.current.delete(ms.id); }}
                              onClick={e => { e.stopPropagation(); if (msEditColorPickerOpen) { setMsEditColorPickerOpen(false); return; } const btn = msEditColorBtnRefs.current.get(ms.id); if (btn) { setMsEditColorPickerPos(clampedPopoverPos(btn.getBoundingClientRect(), 156, 100)); } setMsEditColorPickerOpen(true); }}
                              title={t("chooseColor")}
                              style={{ width:19, height:19, borderRadius:999, flexShrink:0, background: normaliseGrey(msEditColor) || "transparent", border: msEditColor ? "1.5px solid rgba(255,255,255,0.85)" : "1.5px solid var(--border-soft)", boxShadow: msEditColor ? "0 1px 3px rgba(0,0,0,0.18)" : undefined, boxSizing:"border-box", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {!msEditColor && <span style={{ position:"absolute", width:"55%", height:"1.5px", background: dark?"rgba(255,255,255,0.55)":"rgba(0,0,0,0.35)", transform:"rotate(-45deg)" }} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => { const next = !msEditRecurring; setMsEditRecurring(next); if (next) setMsEditRecurSpinKey(k => k + 1); }}
                              title={t("repeatYearly")}
                              style={{ flexShrink:0, width:26, height:26, borderRadius:999, border:"none", background:"transparent", cursor:"pointer", fontSize:18, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center", color: msEditRecurring ? "var(--apple-green)" : cardFormSec, opacity: msEditRecurring ? 1 : 0.55, transition:"color 150ms, opacity 150ms" }}>
                              <span key={msEditRecurSpinKey} className={msEditRecurring ? "recur-spin-once" : undefined} style={{ display:"inline-block" }}>↻</span>
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setMsEditId(null)}
                              style={{ height:26, padding:"0 10px", borderRadius:7, border:`1px solid ${cardFormBdr}`, background:"transparent", color:cardFormSec, fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>{t("cancel")}</button>
                            <button onClick={saveMsEdit} disabled={!msEditLabel.trim()}
                              style={{ height:26, padding:"0 12px", borderRadius:7, border:"none", background: msEditLabel.trim()?"#007aff":"rgba(128,128,128,0.15)", color: msEditLabel.trim()?"white":"var(--text-tertiary)", fontSize:11, fontWeight:600, cursor: msEditLabel.trim()?"pointer":"default", fontFamily:"inherit", flexShrink:0 }}>{t("saveChanges")}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  </DraggableCard>
                );
              })}
            </AnimatePresence>
            </Reorder.Group>
          </div>
        )}

        {/* Add event form */}
        <div className={`px-5 ${dayMilestones.length > 0 ? "pt-1.5" : "pt-3"} pb-0 shrink-0`}>
          {/* Button — collapses when form open or limit reached */}
          <div style={{ maxHeight: (addEventOpen || dayMilestones.length >= 10) ? 0 : "40px", opacity: (addEventOpen || dayMilestones.length >= 10) ? 0 : 1, overflow:"hidden", transition:"max-height 0.3s ease-in-out, opacity 0.18s ease-in-out", pointerEvents: (addEventOpen || dayMilestones.length >= 10) ? "none" : "auto" }}>
            <button onClick={() => setAddEventOpen(true)}
              style={{ width:"100%", height:32, borderRadius:9, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
              <span style={{ fontSize:14, lineHeight:1 }}>+</span> {t("addEvent")}
            </button>
          </div>
          {/* Form — expands when open */}
          <div ref={addEventFormRef} style={{ maxHeight: addEventOpen ? "2000px" : 0, opacity: addEventOpen ? 1 : 0, overflow:"hidden", transition:"max-height 0.35s ease-in-out, opacity 0.22s ease-in-out", pointerEvents: addEventOpen ? "auto" : "none" }}>
            {(() => {
              const ecNew = getEventColors(newColor, dark);
              const cardBg     = ecNew.bg;
              const cardBorder = ecNew.border || (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)");
              const inputBg     = ecNew.formBg;
              const inputBorder = `1px solid ${ecNew.formBorder}`;
              const inputText   = ecNew.textTitle || "var(--text)";
              const inputStyle: React.CSSProperties = { background: inputBg, border: inputBorder, borderRadius:8, padding:"6px 9px", fontSize:12, color: inputText, outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
              const labelText   = ecNew.icon || "var(--text-secondary)";
              const cancelBorder  = `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}`;
              const cancelColor   = "var(--text-secondary)";
              const submitBg      = newLabel.trim() ? "#007aff" : "rgba(128,128,128,0.15)";
              const submitColor   = newLabel.trim() ? "#ffffff" : "var(--text-tertiary)";
              return (
            <div style={{ background: cardBg, border:`1.5px solid ${cardBorder}`, boxShadow: ecNew.boxShadow || undefined, borderRadius:12, padding:"10px 12px", display:"flex", flexDirection:"column", gap:8, transition:"background 0.25s ease, border-color 0.25s ease" }}>
              <div className="flex items-center gap-1.5" style={{ isolation:"isolate" }}>
                <TextareaAutosize ref={newLabelInputRef} value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); submitNewEvent(); } if (e.key==="Escape") setAddEventOpen(false); }}
                  placeholder={t("labelPlaceholder")}
                  minRows={1}
                  style={{ ...inputStyle, flex:1, minWidth:0, resize:"none", overflow:"hidden", lineHeight:1.5 } as any} />
              </div>
              <div style={{ position:"relative" }}>
                <TextareaAutosize value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder={t("descPlaceholder")} minRows={2}
                  style={{ ...inputStyle, width:"100%", resize:"none", overflow:"hidden", lineHeight:1.5, display:"block" } as any} />
              </div>
              {newColorPickerOpen && newColorPickerPos && ReactDOM.createPortal(
                <motion.div
                  key="new-event-color-popover"
                  ref={newColorPopoverRef}
                  initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                  transition={{ type:"spring", stiffness:420, damping:28 }}
                  onClick={e => e.stopPropagation()}
                  style={{ position:"fixed", top:newColorPickerPos.top, left:newColorPickerPos.left, zIndex:300, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:156, isolation:"isolate" }}
                >
                  <div style={{ position:"fixed", inset:0, zIndex:-1 }} onClick={() => setNewColorPickerOpen(false)} />
                  <button onClick={() => { setNewColor(""); setNewColorPickerOpen(false); }}
                    title={t("noColor")}
                    style={{ width:20, height:20, borderRadius:999, background:dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)", border: newColor==="" ? `1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}` : "1.5px solid transparent", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
                  </button>
                  {MILESTONE_COLORS.map(c => (
                    <button key={c} onClick={() => { setNewColor(newColor === c ? "" : c); setNewColorPickerOpen(false); }}
                      title={c}
                      style={{ width:20, height:20, borderRadius:999, background:c, border: newColor===c ? `1.5px solid var(--text)` : "1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow: (c==="#ffffff" || c==="#8e8e93") ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform: newColor===c ? "scale(1.08)" : "scale(1)" }}>
                      {newColor===c && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color:swatchCheckColor(c) }}>✓</span>}
                    </button>
                  ))}
                </motion.div>,
                document.body
              )}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5" style={{ isolation:"isolate", marginLeft:2 }}>
                  <button
                    ref={newColorBtnRef}
                    onClick={e => { e.stopPropagation(); if (newColorPickerOpen) { setNewColorPickerOpen(false); return; } const btn = newColorBtnRef.current; if (btn) { setNewColorPickerPos(clampedPopoverPos(btn.getBoundingClientRect(), 156, 100)); } setNewColorPickerOpen(true); }}
                    title={t("chooseColor")}
                    style={{ width:19, height:19, borderRadius:999, flexShrink:0, background: normaliseGrey(newColor) || "transparent", border: newColor ? "1.5px solid rgba(255,255,255,0.85)" : `1.5px solid var(--border-soft)`, boxShadow: newColor ? "0 1px 3px rgba(0,0,0,0.18)" : undefined, boxSizing:"border-box", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", mixBlendMode:"normal", isolation:"isolate" }}>
                    {!newColor && <span style={{ position:"absolute", width:"55%", height:"1.5px", background: dark?"rgba(255,255,255,0.55)":"rgba(0,0,0,0.35)", transform:"rotate(-45deg)" }} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { const next = !newRecurring; setNewRecurring(next); if (next) setNewRecurSpinKey(k => k + 1); }}
                    title={t("repeatYearly")}
                    style={{ flexShrink:0, width:26, height:26, borderRadius:999, border:"none", background:"transparent", cursor:"pointer", fontSize:18, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center", color: newRecurring ? "var(--apple-green)" : labelText, opacity: newRecurring ? 1 : 0.55, transition:"color 150ms, opacity 150ms" }}>
                    <span key={newRecurSpinKey} className={newRecurring ? "recur-spin-once" : undefined} style={{ display:"inline-block" }}>↻</span>
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setAddEventOpen(false)}
                    style={{ height:28, padding:"0 12px", borderRadius:7, border: cancelBorder, background:"transparent", color: cancelColor, fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>{t("cancel")}</button>
                  <button onClick={submitNewEvent} disabled={!newLabel.trim()}
                    style={{ height:28, padding:"0 14px", borderRadius:7, border:"none", background: submitBg, color: submitColor, fontSize:12, fontWeight:600, cursor: newLabel.trim()?"pointer":"default", fontFamily:"inherit", flexShrink:0 }}>{t("addEventBtn")}</button>
                </div>
              </div>
            </div>
              );
            })()}
          </div>
        </div>

        {/* Divider between events/add-event and notes */}
        <div className="mt-3 h-px shrink-0" style={{ background:"var(--border-soft)" }} />

        {/* Notes section label — only appears once notes exist */}
        {entries.length > 0 && (
          <div className="px-5 pt-3 shrink-0">
            <div className="text-[10px] font-semibold tracking-widest uppercase mb-1.5" style={{ color:"var(--text-tertiary)" }}>{t("notes")}</div>
          </div>
        )}

        {/* Notes list — drag the card itself to reorder (press-and-hold first on touch) */}
        {entries.length > 0 && (
          <div className="px-5 pb-2" onScroll={() => setColorPickerEntryId(null)}>
            <Reorder.Group
              as="div"
              axis="y"
              values={entries.map(e => e.id)}
              onReorder={handleReorderEntryIds}
              className="flex flex-col gap-1.5"
              style={{ listStyle:"none", margin:0, padding:0 }}
            >
              <AnimatePresence initial={false}>
                {entries.map((entry, idx) => (
                  <NoteEntryItem
                    key={entry.id}
                    entry={entry}
                    idx={idx}
                    entriesCount={entries.length}
                    dark={dark}
                    inputBg={inputBg}
                    borderColor={borderColor}
                    hoveredEntryId={hoveredEntryId}
                    setHoveredEntryId={setHoveredEntryId}
                    areaRefs={areaRefs}
                    updateEntry={updateEntry}
                    handleNoteHeightChange={handleNoteHeightChange}
                    setActiveEntryId={setActiveEntryId}
                    handleKey={handleKey}
                    noteHeights={noteHeights}
                    colorBtnRefs={colorBtnRefs}
                    toggleColorPicker={toggleColorPicker}
                    colorPickerEntryId={colorPickerEntryId}
                    setConfirmDeleteEntryId={setConfirmDeleteEntryId}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>
          </div>
        )}

        {/* Add note button */}
        <div className={`px-5 pb-3 ${entries.length === 0 ? "pt-3" : ""}`}>
          <button onClick={addEntry}
            style={{ width:"100%", height:34, borderRadius:10, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> {t("addNote")}
          </button>
        </div>

        </div>{/* end scrollable body */}

      </motion.div>
      {colorPickerEntryId !== null && colorPickerPos && ReactDOM.createPortal(
        <motion.div
          key="color-popover"
          initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
          transition={{ type:"spring", stiffness:420, damping:28 }}
          onClick={e => e.stopPropagation()}
          style={{ position:"fixed", top:colorPickerPos.top, left:colorPickerPos.left, zIndex:200, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:152, isolation:"isolate", mixBlendMode:"normal" }}
        >
            {(() => {
              const entry = entries.find(e => e.id === colorPickerEntryId);
              const entryColor = entry?.color;
              return (
                <>
                  <button onClick={() => { updateEntryColor(colorPickerEntryId, undefined); setColorPickerEntryId(null); }}
                    title={t("noColor")}
                    style={{ width:20, height:20, borderRadius:999, background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", border: !entryColor ? `1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}` : "1.5px solid transparent", cursor:"pointer", position:"relative", mixBlendMode:"normal", isolation:"isolate" }}
                  >
                    <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
                  </button>
                  {APPLE_COLORS.map(ac => {
                    const hex = dark ? ac.dark : ac.light;
                    const selected = entryColor === hex;
                    return (
                      <button key={ac.key} onClick={() => { updateEntryColor(colorPickerEntryId, hex); setColorPickerEntryId(null); }}
                        title={ac.label}
                        style={{ width:20, height:20, borderRadius:999, background:hex, border:"1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow: (ac.key==="white" || ac.key==="grey") ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined, mixBlendMode:"normal", isolation:"isolate", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform: selected ? "scale(1.08)" : "scale(1)" }}
                      >
                        {selected && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color: swatchCheckColor(hex) }}>✓</span>}
                      </button>
                    );
                  })}
                </>
              );
            })()}
        </motion.div>,
        document.body
      )}
      <ConfirmDialog
        open={confirmDeleteEntryId !== null}
        onClose={() => setConfirmDeleteEntryId(null)}
        onConfirm={() => { if (confirmDeleteEntryId) deleteEntry(confirmDeleteEntryId); }}
        message={t("deleteEntryConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
      <ConfirmDialog
        open={confirmDeleteMsIdDay !== null}
        onClose={() => setConfirmDeleteMsIdDay(null)}
        onConfirm={() => { if (confirmDeleteMsIdDay) { onMilestoneDelete(confirmDeleteMsIdDay); setConfirmDeleteMsIdDay(null); } }}
        message={t("deleteEventConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleGoalReset}
        message={t("resetGoalsConfirm")}
        confirmLabel={t("resetGoals")}
        dark={dark}
      />
      <ConfirmDialog
        open={confirmDeleteGoalIdx !== null}
        onClose={() => setConfirmDeleteGoalIdx(null)}
        onConfirm={() => { if (confirmDeleteGoalIdx !== null) { handleGoalDelete(confirmDeleteGoalIdx); setConfirmDeleteGoalIdx(null); } }}
        message={t("deleteGoalConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
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

// ─── AllGoalsPanel ────────────────────────────────────────────────────────────

function AllGoalsPanel({ config, blockGoals, quarterGoals, yearGoals, viewYear, resolvedQuarters, dark, modalBg, onToggleGoal, onToggleQuarterGoal, onToggleYearGoal, onEditGoals, onEditQuarterGoals, onEditYearGoals, onClose }: {
  config: CalendarConfig;
  blockGoals: Record<string, BlockGoals>;
  quarterGoals: Record<number, { description: string; goals: Goal[] }>;
  yearGoals: { description: string; goals: Goal[] };
  viewYear: number;
  resolvedQuarters: Quarter[];
  dark: boolean; modalBg: string;
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

  const activeYearGoals = yearGoals.goals.filter(g => g.text.trim());
  let totalGoals = activeYearGoals.length, doneGoals = activeYearGoals.filter(g => g.done).length;
  config.quarters.forEach((qc, qi) => {
    const qGoals = quarterGoals[qi]?.goals.filter(g => g.text.trim()) ?? [];
    totalGoals += qGoals.length;
    doneGoals += qGoals.filter(g => g.done).length;
    qc.blocks.forEach(b => {
      const bg = blockGoals[b.id];
      const active = bg?.goals.filter(g => g.text.trim()) ?? [];
      totalGoals += active.length;
      doneGoals += active.filter(g => g.done).length;
    });
  });

  return ReactDOM.createPortal(
    <motion.div initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.34)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      />
      <motion.div initial={{ opacity:0, scale:0.96, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:8 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md flex flex-col"
        style={{ background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)", borderRadius:22, boxShadow:"0 24px 70px rgba(0,0,0,0.24)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden", maxHeight:"82vh" }}
      >
        {/* Header */}
        <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${borderColor}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: totalGoals > 0 ? 10 : 0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <h2 style={{ margin:0, fontSize:17, fontWeight:650, letterSpacing:"-0.01em", color:"var(--text)" }}>{t("allGoals")}</h2>
              {totalGoals > 0 && (
                <span style={{ fontSize:11, fontWeight:600, color:"var(--text-tertiary)", background: dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)", borderRadius:8, padding:"2px 7px" }}>{doneGoals}/{totalGoals}</span>
              )}
            </div>
            <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer", flexShrink:0 }}>✕</button>
          </div>
          {totalGoals > 0 && (
            <div style={{ height:4, borderRadius:999, overflow:"hidden", background: dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)" }}>
              <div style={{ height:"100%", borderRadius:999, background:"#34c759", width:`${(doneGoals/totalGoals)*100}%`, transition:"width 0.4s ease" }} />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <>
          {/* Year goals section — always visible */}
          <div style={{ padding:"10px 12px 4px" }}>
              <div style={{ borderRadius:16, border:`1.5px solid ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.12)"}`, overflow:"hidden", background: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.03)" }}>
                <div style={{ padding:"10px 14px 8px", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>🎯</span>
                  <span style={{ fontSize:12, fontWeight:700, letterSpacing:"-0.01em", color:"var(--text)", flex:1 }}>{viewYear}</span>
                  {activeYearGoals.length > 0 && (
                    <span style={{ fontSize:11, color:"var(--text-tertiary)", flexShrink:0 }}>{activeYearGoals.filter(g=>g.done).length}/{activeYearGoals.length}</span>
                  )}
                  {activeYearGoals.length > 0 && (
                    <div style={{ width:40, height:3, borderRadius:999, overflow:"hidden", background: dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.08)", flexShrink:0 }}>
                      <div style={{ height:"100%", borderRadius:999, background:"#34c759", width:`${(activeYearGoals.filter(g=>g.done).length/activeYearGoals.length)*100}%`, transition:"width 0.4s ease" }} />
                    </div>
                  )}
                  <button onClick={onEditYearGoals} title={t("yearGoals")}
                    style={{ width:22, height:22, borderRadius:6, background:"transparent", border:"none", color:"var(--text-secondary)", opacity:0.7, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; }}
                  ><GoalsIcon /></button>
                </div>
                {yearGoals.description.trim() && (
                  <p style={{ margin:"0 14px 8px", fontSize:11, color:"var(--text-tertiary)", borderLeft:`2px solid rgba(128,128,128,0.3)`, paddingLeft:8, lineHeight:"1.5", whiteSpace:"pre-wrap" }}>{yearGoals.description}</p>
                )}
                {activeYearGoals.length === 0 ? (
                  <div onClick={onEditYearGoals} role="button"
                    style={{ padding:"0 14px 12px", fontSize:12, color:"var(--text-tertiary)", fontStyle:"italic", cursor:"pointer" }}
                  >{t("yearGoals")} →</div>
                ) : (
                  <div style={{ padding:"4px 14px 10px", display:"flex", flexDirection:"column", gap:3 }}>
                    {activeYearGoals.map(goal => {
                      const gc = normaliseGrey(goal.color) ?? goal.color ?? "#34c759";
                      return (
                        <label key={goal.id} style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer", padding:"3px 0" }}
                          onClick={() => onToggleYearGoal(goal.id)}
                        >
                          <div style={{ width:14, height:14, borderRadius:4, flexShrink:0, marginTop:1, background: goal.done ? gc : "transparent", border:`1.5px solid ${goal.done ? gc : goal.color ? gc : "var(--border-soft)"}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 150ms ease" }}>
                            {goal.done && <CheckIcon />}
                          </div>
                          <span style={{ fontSize:12, lineHeight:"1.45", color: goal.done ? "var(--text-tertiary)" : readableGoalTextColor(goal.color, dark, "var(--text)"), textDecoration: goal.done ? "line-through" : "none", opacity: goal.done ? 0.55 : 1, transition:"all 150ms", minWidth:0, overflowWrap:"anywhere", wordBreak:"break-word" }}>{goal.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {config.quarters.map((qc, qi) => { // eslint-disable-line
              const qr = resolvedQuarters[qi]!;
              const qGoals = quarterGoals[qi]?.goals.filter(g => g.text.trim()) ?? [];
              const blocksWithGoals = qc.blocks.map(b => {
                const bg = blockGoals[b.id];
                const goals = bg?.goals.filter(g => g.text.trim()) ?? [];
                return { block: b, goals };
              }).filter(x => x.goals.length > 0);
              if (qGoals.length === 0 && blocksWithGoals.length === 0) return null;

              const qSprintDone = blocksWithGoals.reduce((s, x) => s + x.goals.filter(g => g.done).length, 0);
              const qSprintTotal = blocksWithGoals.reduce((s, x) => s + x.goals.length, 0);
              const qQDone = qGoals.filter(g => g.done).length;
              const qTotal = qQDone + qSprintDone;
              const qAllTotal = qGoals.length + qSprintTotal;

              return (
                <div key={qi} style={{ padding:"10px 12px 6px" }}>
                  {/* Quarter container card */}
                  <div style={{ borderRadius:16, border:`1.5px solid ${qr.border}`, overflow:"hidden", background:"transparent" }}>

                    {/* Quarter card header */}
                    {(() => { const qHeaderText = readableGoalTextColor(qr.nameColor, dark, "var(--text)"); return (
                    <div style={{ padding:"10px 14px 8px", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, letterSpacing:"-0.01em", color: qHeaderText, flex:1 }}>{qr.label ?? t(`q${qi+1}` as keyof typeof t)}</span>
                      <span style={{ fontSize:11, color: qHeaderText, opacity:0.6, flexShrink:0 }}>{qTotal}/{qAllTotal}</span>
                      {qAllTotal > 0 && (
                        <div style={{ width:40, height:3, borderRadius:999, overflow:"hidden", background: dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.1)", flexShrink:0 }}>
                          <div style={{ height:"100%", borderRadius:999, background:qr.fill, width:`${(qTotal/qAllTotal)*100}%`, transition:"width 0.4s ease" }} />
                        </div>
                      )}
                      <button onClick={() => onEditQuarterGoals(qi)} title={t("quarterGoals")}
                        style={{ width:22, height:22, borderRadius:6, background:"transparent", border:"none", color: qHeaderText, opacity:0.6, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; }}
                      ><GoalsIcon /></button>
                    </div>
                    ); })()}

                    {/* Quarter goals checkboxes */}
                    {qGoals.length > 0 && (
                      <div style={{ padding:"4px 14px 8px", display:"flex", flexDirection:"column", gap:3 }}>
                        {qGoals.map(goal => {
                          const cb = goalCheckboxColors(goal.color, dark, qr.fill, qr.key);
                          return (
                            <label key={goal.id} style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer", padding:"3px 0", borderRadius:6 }}
                              onClick={() => onToggleQuarterGoal(qi, goal.id)}
                            >
                              <div style={{ boxSizing:"border-box", width:14, height:14, borderRadius:4, flexShrink:0, marginTop:1, background: goal.done ? cb.doneBg : cb.emptyBg, border:`1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 150ms ease" }}>
                                {goal.done && <CheckIcon color={cb.icon} />}
                              </div>
                              <span style={{ fontSize:12, lineHeight:"1.45", color: goal.done ? `${qr.text}66` : readableGoalTextColor(goal.color, dark, qr.text), textDecoration: goal.done ? "line-through" : "none", opacity: goal.done ? 0.6 : 1, transition:"all 150ms", minWidth:0, overflowWrap:"anywhere", wordBreak:"break-word" }}>{goal.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Sprint blocks nested inside */}
                    {blocksWithGoals.length > 0 && (
                      <div style={{ padding:"0 8px 8px", display:"flex", flexDirection:"column", gap:5 }}>
                        {blocksWithGoals.map(({ block, goals }) => {
                          const effectiveQ = block.color ? resolveQuarter({ name: block.label, colorKey: block.color }, dark) : qr;
                          const sprintHeaderText = readableGoalTextColor(effectiveQ.nameColor, dark, "var(--text)");
                          return (
                            <div key={block.id} style={{ borderRadius:11, border:`1.5px solid ${effectiveQ.border}`, overflow:"hidden", background:"transparent" }}>
                              <div style={{ padding:"6px 10px 5px", background:"transparent", borderBottom:`1px solid ${effectiveQ.border}55`, display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ fontSize:11, fontWeight:600, color: sprintHeaderText, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{block.label}</span>
                                <span style={{ fontSize:10, color: sprintHeaderText, opacity:0.6, flexShrink:0 }}>{goals.filter(g=>g.done).length}/{goals.length}</span>
                                <button onClick={() => onEditGoals(block.id)} title={t("sprintGoals")}
                                  style={{ width:20, height:20, borderRadius:5, background:"transparent", border:"none", color: sprintHeaderText, opacity:0.6, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; }}
                                ><GoalsIcon /></button>
                              </div>
                              <div style={{ padding:"5px 8px", display:"flex", flexDirection:"column", gap:2 }}>
                                {goals.map(goal => {
                                  const cb = goalCheckboxColors(goal.color, dark, effectiveQ.fill, effectiveQ.key);
                                  return (
                                    <label key={goal.id} style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer", padding:"3px 2px", borderRadius:5 }}
                                      onClick={() => onToggleGoal(block.id, goal.id)}
                                    >
                                      <div style={{ boxSizing:"border-box", width:13, height:13, borderRadius:3, flexShrink:0, marginTop:1, background: goal.done ? cb.doneBg : cb.emptyBg, border:`1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 150ms ease" }}>
                                        {goal.done && <CheckIcon color={cb.icon} />}
                                      </div>
                                      <span style={{ fontSize:11, lineHeight:"1.45", color: goal.done ? "var(--text-tertiary)" : readableGoalTextColor(goal.color, dark, "var(--text-secondary)"), textDecoration: goal.done ? "line-through" : "none", opacity: goal.done ? 0.55 : 1, transition:"all 150ms", minWidth:0, overflowWrap:"anywhere", wordBreak:"break-word" }}>{goal.text}</span>
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
            <div style={{ height:6 }} />
          </>
          <div style={{ height:12 }} />
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─── NotesPanel ───────────────────────────────────────────────────────────────

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
  const [draftColorPickerOpen, setDraftColorPickerOpen] = useState(false);
  const [draftColorPickerPos, setDraftColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const draftColorBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const draftTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [hoveredDk, setHoveredDk] = useState<string | null>(null);
  const [confirmDeleteDk, setConfirmDeleteDk] = useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!showAddForm) return;
    const timer = setTimeout(() => draftTextareaRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [showAddForm]);

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

  const toggleDraftColorPicker = () => {
    if (draftColorPickerOpen) { setDraftColorPickerOpen(false); return; }
    const btn = draftColorBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDraftColorPickerPos({ top: rect.bottom + 7, left: rect.right - 152 });
    }
    setDraftColorPickerOpen(true);
  };

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)";

  return (
    <motion.div initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.34)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      />
      <motion.div layout initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md"
        style={{ background: modalBg, backdropFilter: "saturate(180%) blur(28px)", WebkitBackdropFilter: "saturate(180%) blur(28px)", borderRadius: 22, boxShadow: "0 24px 70px rgba(0,0,0,0.24)", border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`, overflowY: "auto", maxHeight: "82vh" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${borderColor}` }}>
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
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", padding: 2 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg></button>
            )}
          </div>
        </div>

        {/* Add note — button or inline form */}
        <div style={{ padding: "12px 20px 14px", borderBottom: `1px solid ${borderColor}` }}>
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              style={{ width: "100%", height: 34, borderRadius: 10, border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"}`, background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {t("addNote")}
            </button>
          ) : (
            <>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <textarea
                  ref={draftTextareaRef}
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  placeholder={t("notePlaceholder")}
                  rows={2}
                  style={{ width: "100%", borderRadius: 10, border: `${draftColor ? "1.5px" : "1px"} solid ${draftColor ? getEventColors(resolveNoteHex(draftColor), dark).border : borderColor}`, background: draftColor ? getEventColors(resolveNoteHex(draftColor), dark).bg : inputBg, color: draftColor ? getEventColors(resolveNoteHex(draftColor), dark).textTitle : "var(--text)", fontSize: 13, padding: "8px 32px 8px 10px", fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box", display: "block", transition: "background 200ms ease" }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draftText.trim()) {
                      e.preventDefault();
                      onAddNote(draftDate, { id: makeId(), text: draftText.trim(), createdAt: Date.now(), color: draftColor ?? undefined });
                      setDraftText(""); setDraftColor(null); setDraftDate(dateKey(new Date())); setDraftColorPickerOpen(false); setShowAddForm(false);
                    }
                    if (e.key === "Escape") { setShowAddForm(false); setDraftText(""); setDraftColor(null); setDraftColorPickerOpen(false); }
                  }}
                />
                <button
                  ref={draftColorBtnRef}
                  onClick={e => { e.stopPropagation(); toggleDraftColorPicker(); }}
                  title={t("chooseColor")}
                  style={{ position: "absolute", top: 10, right: 10, width: 13, height: 13, borderRadius: 999, background: draftColor ?? (dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)"), border: "none", boxShadow: "0 0 0 2px rgba(255,255,255,0.92), 0 0 0 3.5px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.18)", cursor: "pointer", display: "block", padding: 0 }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} lang={lang}
                  style={{ flex: 1, borderRadius: 9, border: `1px solid ${borderColor}`, background: inputBg, color: "var(--text)", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }}
                />
                <button
                  onClick={() => { setShowAddForm(false); setDraftText(""); setDraftColor(null); setDraftDate(dateKey(new Date())); setDraftColorPickerOpen(false); }}
                  style={{ height: 34, paddingInline: 12, borderRadius: 9, border: `1px solid ${borderColor}`, background: "transparent", color: "var(--text-secondary)", fontWeight: 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>
                  {t("cancel")}
                </button>
                <button
                  onClick={() => {
                    if (!draftText.trim()) return;
                    onAddNote(draftDate, { id: makeId(), text: draftText.trim(), createdAt: Date.now(), color: draftColor ?? undefined });
                    setDraftText(""); setDraftColor(null); setDraftDate(dateKey(new Date())); setDraftColorPickerOpen(false); setShowAddForm(false);
                  }}
                  disabled={!draftText.trim()}
                  style={{ height: 34, paddingInline: 16, borderRadius: 9, border: "none", background: draftText.trim() ? "linear-gradient(135deg,#5ed47b 0%,#34c759 100%)" : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"), color: draftText.trim() ? "white" : "var(--text-tertiary)", fontWeight: 600, fontSize: 13, cursor: draftText.trim() ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap" as const, transition: "background 150ms, color 150ms" }}>
                  {t("add")}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{quarter.label}</span>
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
                            {entries.map((e, i) => {
                              const eec = e.color ? getEventColors(resolveNoteHex(e.color), dark) : null;
                              return (
                              <div key={i} style={{
                                padding: e.color ? "8px 10px 8px 12px" : "2px 0",
                                borderRadius: e.color ? 12 : 0,
                                border: eec ? `1.5px solid ${eec.border}` : "none",
                                background: eec ? eec.bg : "transparent",
                                overflow: "hidden",
                              }}>
                                <span style={{ fontSize: 13, color: eec ? eec.textTitle : "var(--text)", lineHeight: 1.55, display: "block", wordBreak: "break-word" }}>
                                  <HighlightText text={e.text} query={q} />
                                </span>
                              </div>
                              );
                            })}
                          </div>
                        </button>
                        {hoveredDk === dk && (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteDk(dk); }}
                            title={t("remove")}
                            style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 999, background: dark ? "rgba(255,59,48,0.15)" : "rgba(255,59,48,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff3b30", flexShrink: 0, transition: "background 0.1s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.28)":"rgba(255,59,48,0.22)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)"; }}>
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>
                          </button>
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
      {draftColorPickerOpen && draftColorPickerPos && ReactDOM.createPortal(
        <motion.div
          key="draft-color-popover"
          initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
          transition={{ type:"spring", stiffness:420, damping:28 }}
          onClick={e => e.stopPropagation()}
          style={{ position:"fixed", top:draftColorPickerPos.top, left:draftColorPickerPos.left, zIndex:200, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:152, isolation:"isolate" }}
        >
          <div style={{ position:"fixed", inset:0, zIndex:-1 }} onClick={() => setDraftColorPickerOpen(false)} />
          <button onClick={() => { setDraftColor(null); setDraftColorPickerOpen(false); }}
            title={t("noColor")}
            style={{ width:20, height:20, borderRadius:999, background:dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)", border: draftColor===null ? `1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}` : "1.5px solid transparent", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
          </button>
          {APPLE_COLORS.map(ac => {
            const hex = dark ? ac.dark : ac.light;
            const selected = draftColor === hex;
            return (
              <button key={ac.key} onClick={() => { setDraftColor(selected ? null : hex); setDraftColorPickerOpen(false); }}
                title={ac.label}
                style={{ width:20, height:20, borderRadius:999, background:hex, border: selected ? `1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}` : "1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow:(ac.key==="white"||ac.key==="grey")?"inset 0 0 0 1px rgba(0,0,0,0.15)":undefined, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform:selected?"scale(1.08)":"scale(1)" }}>
                {selected && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color:swatchCheckColor(hex) }}>✓</span>}
              </button>
            );
          })}
        </motion.div>,
        document.body
      )}
      <ConfirmDialog
        open={confirmDeleteDk !== null}
        onClose={() => setConfirmDeleteDk(null)}
        onConfirm={() => { if (confirmDeleteDk) onDeleteDayNotes(confirmDeleteDk); }}
        message={t("deleteDayNotesConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
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
  const [confirmDeleteMsId, setConfirmDeleteMsId] = useState<string|null>(null);
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
  const [draftColor, setDraftColor] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftRecurring, setDraftRecurring] = useState(false);
  const [draftRecurSpinKey, setDraftRecurSpinKey] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draftColorPickerOpen, setDraftColorPickerOpen] = useState(false);
  const [draftColorPickerPos, setDraftColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const draftLabelInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const draftColorBtnRef = React.useRef<HTMLButtonElement | null>(null);

  const [editId, setEditId] = useState<string|null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);
  const [editRecurSpinKey, setEditRecurSpinKey] = useState(0);
  const [editColorPickerOpen, setEditColorPickerOpen] = useState(false);
  const [editColorPickerPos, setEditColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const editColorBtnRef = React.useRef<HTMLButtonElement | null>(null);

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
    const newItems = items.map(ms => ms.id === editId
      ? { ...ms, label: editLabel.trim(), date: editDate, color: editColor, description: editDesc.trim() || undefined, recurring: editRecurring || undefined }
      : ms
    ).sort((a,b) => a.date.localeCompare(b.date));
    setItems(newItems);
    onChange(newItems);
    setEditId(null);
  };

  React.useEffect(() => {
    if (!showAddForm) return;
    const timer = setTimeout(() => draftLabelInputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [showAddForm]);

  const resetDraft = () => {
    setDraftLabel(""); setDraftDesc(""); setDraftColor(""); setDraftRecurring(false);
    setDraftColorPickerOpen(false); setShowAddForm(false);
  };

  const add = () => {
    if (!draftLabel.trim()) return;
    const newItems = [...items, { id:makeId(), label:draftLabel.trim(), date:draftDate, color:draftColor, description:draftDesc.trim()||undefined, recurring: draftRecurring || undefined }].sort((a,b)=>a.date.localeCompare(b.date));
    setItems(newItems);
    onChange(newItems);
    resetDraft();
  };

  const [hoveredId, setHoveredId] = useState<string|null>(null);


  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputStyle: React.CSSProperties = { background: dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.03)", border:`1px solid ${borderColor}`, borderRadius:8, padding:"7px 10px", fontSize:13, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };

  return (
    <motion.div initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.34)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      />
      <motion.div layout initial={{ opacity:0, scale:0.96, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:8 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md"
        style={{ background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)", borderRadius:22, boxShadow:"0 24px 70px rgba(0,0,0,0.24)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflowY:"auto", maxHeight:"82vh" }}
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
                style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", padding:2 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg></button>
            )}
          </div>
        </div>

        {/* Add event — button or card form */}
        <div className="px-6 py-3" style={{ borderTop: `1px solid ${borderColor}` }}>
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)}
              style={{ width:"100%", height:32, borderRadius:9, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
              <span style={{ fontSize:14, lineHeight:1 }}>+</span> {t("addEvent")}
            </button>
          ) : (
            (() => {
              const ecDraft = getEventColors(draftColor, dark);
              const isWhite = draftColor === "#ffffff";
              const cardBg     = isWhite ? "#ffffff" : ecDraft.bg;
              const cardBorder = isWhite ? "#d4d4d8" : (ecDraft.border || (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"));
              const inputBg    = isWhite ? "transparent" : ecDraft.formBg;
              const inputBorder = isWhite ? "1px solid #d4d4d8" : `1px solid ${ecDraft.formBorder}`;
              const inputText  = isWhite ? "#18181b" : "var(--text)";
              const draftInputStyle: React.CSSProperties = { background:inputBg, border:inputBorder, borderRadius:8, padding:"6px 9px", fontSize:12, color:inputText, outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"background 0.25s ease, border-color 0.25s ease" };
              const labelText  = isWhite ? "#18181b" : "var(--text-secondary)";
              const cancelBorder = isWhite ? "1px solid #a1a1aa" : `1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)"}`;
              const cancelColor  = isWhite ? "#18181b" : "var(--text-secondary)";
              const submitBg   = draftLabel.trim() ? "#007aff" : (isWhite ? "#e4e4e7" : "rgba(128,128,128,0.15)");
              const submitColor = draftLabel.trim() ? "#ffffff" : (isWhite ? "#71717a" : "var(--text-tertiary)");
              return (
                <div style={{ background:cardBg, border:`1px solid ${cardBorder}`, boxShadow:ecDraft.boxShadow||undefined, borderRadius:12, padding:"10px 12px", display:"flex", flexDirection:"column", gap:8, transition:"background 0.25s ease, border-color 0.25s ease" }}>
                  <textarea ref={draftLabelInputRef} value={draftLabel} rows={1}
                    onChange={e => { setDraftLabel(e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
                    onKeyDown={e => { if (e.key==="Escape") resetDraft(); }}
                    placeholder={t("labelPlaceholder")}
                    className={isWhite ? "placeholder-dark" : undefined}
                    style={{ ...draftInputStyle, width:"100%", resize:"none", overflow:"hidden", lineHeight:1.5, display:"block" }}
                  />
                  <textarea value={draftDesc} rows={2}
                    onChange={e => { setDraftDesc(e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
                    placeholder={t("descPlaceholder")}
                    className={isWhite?"placeholder-dark":undefined}
                    style={{ ...draftInputStyle, width:"100%", resize:"none", overflow:"hidden", lineHeight:1.5, display:"block" }}
                  />
                  <div className="flex items-center" style={{ isolation:"isolate", flexWrap:"nowrap", gap:8 }}>
                    <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)}
                      lang={lang} style={{ ...draftInputStyle, flex:"0 0 104px", minWidth:0, width:104, padding:"0 6px" }}
                    />
                    <button
                      ref={draftColorBtnRef}
                      onClick={e => { e.stopPropagation(); if (draftColorPickerOpen) { setDraftColorPickerOpen(false); return; } const btn = draftColorBtnRef.current; if (btn) { setDraftColorPickerPos(clampedPopoverPos(btn.getBoundingClientRect(), 156, 100)); } setDraftColorPickerOpen(true); }}
                      title={t("chooseColor")}
                      style={{ width:16, height:16, borderRadius:999, flexShrink:0, background:draftColor||"transparent", border:draftColor?"1.5px solid rgba(255,255,255,0.85)":`1.5px solid ${isWhite?"#a1a1aa":"var(--border-soft)"}`, boxShadow:draftColor?"0 1px 3px rgba(0,0,0,0.18)":undefined, boxSizing:"border-box", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", mixBlendMode:"normal", isolation:"isolate" }}>
                      {!draftColor && <span style={{ position:"absolute", width:"55%", height:"1.5px", background:isWhite?"rgba(0,0,0,0.35)":(dark?"rgba(255,255,255,0.55)":"rgba(0,0,0,0.35)"), transform:"rotate(-45deg)" }} />}
                    </button>
                    <button type="button"
                      onClick={() => { const next = !draftRecurring; setDraftRecurring(next); if (next) setDraftRecurSpinKey(k => k + 1); }}
                      title={t("repeatYearly")}
                      style={{ flexShrink:0, width:20, height:20, borderRadius:999, border:"none", background:"transparent", cursor:"pointer", fontSize:14, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center", color:draftRecurring?"var(--apple-green)":labelText, opacity:draftRecurring?1:0.55, transition:"color 150ms, opacity 150ms" }}>
                      <span key={draftRecurSpinKey} className={draftRecurring?"recur-spin-once":undefined} style={{ display:"inline-block" }}>↻</span>
                    </button>
                    <div className="flex items-center" style={{ gap:8, flexShrink:0, marginLeft:"auto" }}>
                      <button onClick={resetDraft}
                        style={{ height:28, padding:"0 9px", borderRadius:7, border:cancelBorder, background:"transparent", color:cancelColor, fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit", flexShrink:0, whiteSpace:"nowrap" }}>{t("cancel")}</button>
                      <button onClick={add} disabled={!draftLabel.trim()}
                        style={{ height:28, padding:"0 10px", borderRadius:7, border:"none", background:submitBg, color:submitColor, fontSize:11, fontWeight:600, cursor:draftLabel.trim()?"pointer":"default", fontFamily:"inherit", flexShrink:0, whiteSpace:"nowrap" }}>{t("addEventBtn")}</button>
                    </div>
                  </div>
                  {draftColorPickerOpen && draftColorPickerPos && ReactDOM.createPortal(
                    <motion.div key="ms-draft-color-popover"
                      initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                      transition={{ type:"spring", stiffness:420, damping:28 }}
                      onClick={e => e.stopPropagation()}
                      style={{ position:"fixed", top:draftColorPickerPos.top, left:draftColorPickerPos.left, zIndex:300, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:156, isolation:"isolate" }}
                    >
                      <div style={{ position:"fixed", inset:0, zIndex:-1 }} onClick={() => setDraftColorPickerOpen(false)} />
                      <button onClick={() => { setDraftColor(""); setDraftColorPickerOpen(false); }} title={t("noColor")}
                        style={{ width:20, height:20, borderRadius:999, background:isWhite?"rgba(0,0,0,0.06)":(dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)"), border:draftColor===""?`1.5px solid ${isWhite?"#18181b":(dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)")}`:"1.5px solid transparent", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
                      </button>
                      {MILESTONE_COLORS.map(c => (
                        <button key={c} onClick={() => { setDraftColor(draftColor===c?"":c); setDraftColorPickerOpen(false); }} title={c}
                          style={{ width:20, height:20, borderRadius:999, background:c, border:draftColor===c?`1.5px solid ${isWhite?"#18181b":"var(--text)"}`:"1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow:(c==="#ffffff"||c==="#8e8e93")?"inset 0 0 0 1px rgba(0,0,0,0.15)":undefined, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform:draftColor===c?"scale(1.08)":"scale(1)" }}>
                          {draftColor===c && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color:swatchCheckColor(c) }}>✓</span>}
                        </button>
                      ))}
                    </motion.div>,
                    document.body
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* List */}
        <div className="px-6 pt-3" style={{ borderTop: `1px solid ${borderColor}` }}>
          {items.length === 0 && (
            <div className="py-6 text-center text-[13px]" style={{ color:"var(--text-tertiary)" }}>{t("noMilestones")}</div>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <div className="py-6 text-center text-[13px]" style={{ color:"var(--text-tertiary)" }}>{t("searchNoResults")}</div>
          )}
          <div className="flex flex-col gap-1.5 pb-3">
            {(() => {
              // Group consecutive events by date
              const dateGroups: { date: string; lbl: string; qi: number; items: Milestone[] }[] = [];
              for (const ms of filteredItems) {
                const last = dateGroups[dateGroups.length - 1];
                if (last && last.date === ms.date) {
                  last.items.push(ms);
                } else {
                  const [y2,m2,d2] = ms.date.split("-").map(Number) as [number,number,number];
                  const lbl = new Date(y2,m2-1,d2).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month:"short", day:"numeric", year:"numeric" });
                  dateGroups.push({ date: ms.date, lbl, qi: quarterOf(ms.date), items: [ms] });
                }
              }

              const renderCard = (ms: Milestone, showDate: boolean) => {
                const isEditing = editId === ms.id;
                const ec3 = getEventColors(isEditing ? editColor : ms.color, dark);
                const rcBg      = ec3.bg;
                const rcBdr     = isEditing ? ec3.borderEditing : ec3.border;
                const rcTxt     = ec3.textTitle;
                const rcSecTxt  = ec3.textDesc;
                const rcBdrForm = ec3.formBorder;
                const rcBgForm  = ec3.formBg;
                const hovering = hoveredId === ms.id;
                return (
                  <div key={ms.id} className="flex flex-col px-2.5 py-2.5 rounded-xl"
                    style={{ position:"relative", minHeight:36, background:rcBg, border: `1.5px solid ${ec3.border || "transparent"}`, boxShadow: ec3.boxShadow || undefined, transition:"background 0.25s ease, border-color 0.25s ease" }}
                    onMouseEnter={() => setHoveredId(ms.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-2" style={{ isolation:"isolate" }}>
                        <textarea value={editLabel} rows={1}
                          ref={el => { if (el) { el.style.height="auto"; el.style.height=el.scrollHeight+"px"; } }}
                          onChange={e => { setEditLabel(e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
                          onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); saveEdit(); } if (e.key==="Escape") cancelEdit(); }}
                          placeholder={t("labelPlaceholder")} autoFocus
                          style={{ ...inputStyle, width:"100%", resize:"none", overflow:"hidden", fontSize:13, fontWeight:600, lineHeight:1.35, display:"block", color:rcTxt, background:"transparent", border:`1px solid ${rcBdrForm}` }}
                        />
                        <textarea value={editDesc} rows={2}
                          ref={el => { if (el) { el.style.height="auto"; el.style.height=el.scrollHeight+"px"; } }}
                          onChange={e => { setEditDesc(e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
                          placeholder={t("editDescPlaceholder")}
                          style={{ ...inputStyle, width:"100%", resize:"none", overflow:"hidden", fontSize:11, fontWeight:400, lineHeight:1.375, display:"block", color:rcSecTxt, background:"transparent", border:`1px solid ${rcBdrForm}` }}
                        />
                        <div className="flex items-center" style={{ gap:8, flexWrap:"nowrap" }}>
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                            lang={lang} style={{ ...inputStyle, flex:"0 0 104px", minWidth:0, width:104, padding:"0 6px", color:rcTxt, background:rcBgForm, border:`1px solid ${rcBdrForm}` }}
                          />
                          <button
                            ref={editColorBtnRef}
                            onClick={e => { e.stopPropagation(); if (editColorPickerOpen) { setEditColorPickerOpen(false); return; } const btn = editColorBtnRef.current; if (btn) { setEditColorPickerPos(clampedPopoverPos(btn.getBoundingClientRect(), 156, 100)); } setEditColorPickerOpen(true); }}
                            title={t("chooseColor")}
                            style={{ width:16, height:16, borderRadius:999, flexShrink:0, background:editColor||"transparent", border:editColor?"1.5px solid rgba(255,255,255,0.85)":"1.5px solid var(--border-soft)", boxShadow:editColor?"0 1px 3px rgba(0,0,0,0.18)":undefined, boxSizing:"border-box", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", mixBlendMode:"normal", isolation:"isolate" }}>
                            {!editColor && <span style={{ position:"absolute", width:"55%", height:"1.5px", background: dark?"rgba(255,255,255,0.55)":"rgba(0,0,0,0.35)", transform:"rotate(-45deg)" }} />}
                          </button>
                          <button type="button"
                            onClick={() => { const next = !editRecurring; setEditRecurring(next); if (next) setEditRecurSpinKey(k => k + 1); }}
                            title={t("repeatYearly")}
                            style={{ flexShrink:0, width:20, height:20, borderRadius:999, border:"none", background:"transparent", cursor:"pointer", fontSize:14, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center", color:editRecurring?"var(--apple-green)":rcSecTxt, opacity:editRecurring?1:0.55, transition:"color 150ms, opacity 150ms" }}>
                            <span key={editRecurSpinKey} className={editRecurring?"recur-spin-once":undefined} style={{ display:"inline-block" }}>↻</span>
                          </button>
                          <div className="flex items-center" style={{ gap:8, flexShrink:0, marginLeft:"auto" }}>
                            <button onClick={cancelEdit}
                              style={{ height:28, padding:"0 9px", borderRadius:7, border:`1px solid ${rcBdrForm}`, background:"transparent", color:rcSecTxt, fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit", flexShrink:0, whiteSpace:"nowrap" }}>
                              {t("cancel")}
                            </button>
                            <button onClick={saveEdit} disabled={!editLabel.trim()}
                              style={{ height:28, padding:"0 10px", borderRadius:7, border:"none", background: editLabel.trim()?"#007aff":"rgba(128,128,128,0.15)", color: editLabel.trim()?"#ffffff":"var(--text-tertiary)", fontSize:11, fontWeight:600, cursor: editLabel.trim()?"pointer":"default", fontFamily:"inherit", flexShrink:0, whiteSpace:"nowrap" }}>
                              {t("saveChanges")}
                            </button>
                          </div>
                        </div>
                        {editColorPickerOpen && editColorPickerPos && ReactDOM.createPortal(
                          <motion.div key="ms-edit-color-popover"
                            initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                            transition={{ type:"spring", stiffness:420, damping:28 }}
                            onClick={e => e.stopPropagation()}
                            style={{ position:"fixed", top:editColorPickerPos.top, left:editColorPickerPos.left, zIndex:300, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:156, isolation:"isolate" }}
                          >
                            <div style={{ position:"fixed", inset:0, zIndex:-1 }} onClick={() => setEditColorPickerOpen(false)} />
                            <button onClick={() => { setEditColor(""); setEditColorPickerOpen(false); }} title={t("noColor")}
                              style={{ width:20, height:20, borderRadius:999, background:dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)", border:editColor===""?`1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}`:"1.5px solid transparent", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
                            </button>
                            {MILESTONE_COLORS.map(c => (
                              <button key={c} onClick={() => { setEditColor(editColor===c?"":c); setEditColorPickerOpen(false); }} title={c}
                                style={{ width:20, height:20, borderRadius:999, background:c, border:editColor===c?`1.5px solid ${dark?"var(--text)":"var(--text)"}`:"1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow:(c==="#ffffff"||c==="#8e8e93")?"inset 0 0 0 1px rgba(0,0,0,0.15)":undefined, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform:editColor===c?"scale(1.08)":"scale(1)" }}>
                                {editColor===c && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color:swatchCheckColor(c) }}>✓</span>}
                              </button>
                            ))}
                          </motion.div>,
                          document.body
                        )}
                      </div>
                    ) : (
                      /* Card view — pure CSS Flexbox, no JS measurement, no absolute positioning */
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          {showDate && (
                            <div className="text-[11px] tabular-nums" style={{ color:"var(--text-tertiary)", marginBottom:2 }}>{dateGroups.find(g => g.items.some(x => x.id === ms.id))?.lbl}</div>
                          )}
                          <span className="text-[13px] font-semibold"
                            style={{ color:rcTxt, wordBreak:"break-all", overflowWrap:"anywhere", display:"block" }}>
                            <HighlightText text={ms.label} query={q} />
                          </span>
                          {ms.description && (
                            <div className="text-[11px] leading-snug"
                              style={{ marginTop:3, color:rcSecTxt, wordBreak:"break-all", overflowWrap:"anywhere" }}>
                              <HighlightText text={ms.description} query={q} />
                            </div>
                          )}
                          {ms.recurring && (
                            <div style={{ display:"inline-flex", alignItems:"center", gap:3, marginTop:5, padding:"2px 6px 2px 4px", borderRadius:5, background: dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)" }}>
                              <span style={{ fontSize:10, lineHeight:1, color:rcSecTxt, opacity:0.7 }}>↻</span>
                              <span style={{ fontSize:10, lineHeight:1, color:rcSecTxt, opacity:0.65 }}>{t("repeatYearly")}</span>
                            </div>
                          )}
                        </div>
                        {/* Buttons in document flow — flex-wrap + row-reverse: × first in DOM = always top-right */}
                        <div style={{ display:"flex", flexDirection:"row-reverse", flexWrap:"wrap", gap:6, maxWidth:70, flexShrink:0, alignSelf:"flex-start", opacity: hovering ? 1 : 0, pointerEvents: hovering ? "auto" : "none", transition:"opacity 0.15s ease-in-out" }}>
                          <button onClick={() => setConfirmDeleteMsId(ms.id)} title={t("delete")}
                            style={{ width:26, height:26, borderRadius:999, border:"none", background: dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)", color:"#ff3b30", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.1s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.28)":"rgba(255,59,48,0.22)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)"; }}>
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>
                          </button>
                          <button onClick={() => startEdit(ms)} title={t("edit")}
                            style={{ width:26, height:26, borderRadius:999, border:"none", background: dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)", color: dark?"rgba(255,255,255,0.8)":"rgba(0,0,0,0.65)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.1s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)"; }}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"/></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return dateGroups.map((group, gi) => {
                const prevGroup = dateGroups[gi - 1];
                const _showQHeader = !prevGroup || group.qi !== prevGroup.qi;
                const isMulti = group.items.length > 1;
                return (
                  <React.Fragment key={group.date}>
                    {_showQHeader && (
                      <div className="flex items-center gap-1.5 pt-1.5 pb-0 px-0.5">
                        <span style={{ width:8, height:8, borderRadius:"50%", background: resolvedQuarters[group.qi]?.tint, border:`2px solid ${resolvedQuarters[group.qi]?.border}`, flexShrink:0, display:"inline-block" }} />
                        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"var(--text-tertiary)" }}>
                          {resolvedQuarters[group.qi]?.label ?? t("q" + String(group.qi + 1))}
                        </span>
                        <span className="text-[10px]" style={{ color:"var(--text-tertiary)" }}>· {quarterCounts[group.qi]}</span>
                      </div>
                    )}
                    <div style={{ borderRadius:14, border:`1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"}`, overflow:"hidden" }}>
                      <div style={{ padding:"6px 10px 5px", background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", borderBottom:`1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}`, display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:11, fontWeight:600, color:"var(--text-secondary)", letterSpacing:"0.01em" }}>{group.lbl}</span>
                        {isMulti && <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>· {group.items.length}</span>}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:4, padding:"6px 6px" }}>
                        {group.items.map(ms => renderCard(ms, false))}
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>

      </motion.div>
      <ConfirmDialog
        open={confirmDeleteMsId !== null}
        onClose={() => setConfirmDeleteMsId(null)}
        onConfirm={() => {
          if (confirmDeleteMsId) {
            const newItems = items.filter(x => x.id !== confirmDeleteMsId);
            setItems(newItems);
            onChange(newItems);
            setConfirmDeleteMsId(null);
          }
        }}
        message={t("deleteEventConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
    </motion.div>
  );
}

// ─── GoalsModal ───────────────────────────────────────────────────────────────

function GoalsModal({ blockId:_bid, blockLabel, initial, dark, modalBg, accentColor, titleLabel, descPlaceholder, onSave, onClose, onBack }: {
  blockId: string; blockLabel: string; initial: BlockGoals; dark: boolean; modalBg: string;
  accentColor?: string; titleLabel?: string; descPlaceholder?: string;
  onSave: (bg: BlockGoals, label: string) => void; onClose: () => void; onBack?: () => void;
}) {
  const { t } = React.useContext(LangContext);
  const [label, setLabel] = useState(blockLabel);
  const [description, setDescription] = useState(initial.description);
  const [goals, setGoals] = useState<Goal[]>(() => initial.goals.map(g=>({...g})));
  const activeGoals = goals.filter(g => g.text.trim());
  const canAdd = true;

  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string|null>(null);
  const [hoveredGoalId, setHoveredGoalId] = useState<string|null>(null);

  // Tracks each goal-text field's rendered height so the row can grow as text
  // wraps onto multiple lines, and so the color/delete overlay buttons can pin
  // to the top-right corner instead of overlapping the wrapped text.
  const [goalInputHeights, setGoalInputHeights] = useState<Record<string,number>>({});
  const handleGoalInputHeightChange = (id: string, h: number) => {
    setGoalInputHeights(prev => prev[id] === h ? prev : { ...prev, [id]: h });
  };

  // Color picker state
  const colorBtnRefs = useRef<Record<string, HTMLButtonElement|null>>({});
  const [colorPickerGoalId, setColorPickerGoalId] = useState<string|null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ top:number; left:number }|null>(null);
  const toggleColorPicker = (id: string) => {
    if (colorPickerGoalId === id) { setColorPickerGoalId(null); return; }
    const btn = colorBtnRefs.current[id];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setColorPickerPos({ top: rect.bottom + 7, left: Math.min(rect.right - 152, window.innerWidth - 164) });
    }
    setColorPickerGoalId(id);
  };
  const setGoalColor = (id: string, color: string|undefined) => {
    setGoals(prev => prev.map(x => x.id===id ? { ...x, color } : x));
    setColorPickerGoalId(null);
  };

  // Auto-save: persist label/description/goals as soon as they change, so no
  // explicit Save button (or Cancel) is needed. Skip the very first render so
  // we don't immediately re-persist the untouched `initial` data. Blank goal
  // rows are kept blank while live-typing (they're filtered out elsewhere as
  // inactive); the "Goal N" fallback name is only stamped in on close, so an
  // untouched row left blank by the user still gets a sensible label.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    onSave({ description:description.trim(), goals }, label.trim() || blockLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, description, goals]);

  const finalize = (after: () => void) => {
    onSave({ description:description.trim(), goals: goals.map((g, i) => g.text.trim() ? g : { ...g, text: `${t("goal")} ${i + 1}` }) }, label.trim() || blockLabel);
    after();
  };

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.03)";

  return (
    <>
    <motion.div initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => { setColorPickerGoalId(null); finalize(onClose); }}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", backdropFilter:"blur(5px)", WebkitBackdropFilter:"blur(5px)" }}
      />
      <motion.div layout initial={{ opacity:0, scale:0.96, y:12 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:8 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => { e.stopPropagation(); setColorPickerGoalId(null); }}
        className="w-full max-w-sm"
        style={{ background:modalBg, backdropFilter:"saturate(180%) blur(28px)", WebkitBackdropFilter:"saturate(180%) blur(28px)", borderRadius:22, boxShadow: accentColor ? `0 24px 70px rgba(0,0,0,0.22), 0 0 0 1.5px ${accentColor}` : "0 24px 70px rgba(0,0,0,0.22)", border:`1.5px solid ${accentColor ?? (dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)")}`, overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:"85vh" }}
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 shrink-0">
          {onBack && (
            <button onClick={() => finalize(onBack)} title={t("back")} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", border:"none", cursor:"pointer", flexShrink:0, marginTop:1 }}>
              <ChevronLeftIcon />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color:"var(--text-tertiary)" }}>{titleLabel ?? t("sprintGoals")}</div>
            <input
              value={label} onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
              style={{ width:"100%", background:"transparent", border:"none", outline:"none", fontSize:15, fontWeight:600, letterSpacing:"-0.01em", color:"var(--text)", fontFamily:"inherit", padding:0 }}
            />
          </div>
          <button onClick={() => finalize(onClose)} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer", flexShrink:0 }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:"auto", minHeight:0, scrollbarWidth:"thin", scrollbarColor: dark?"rgba(255,255,255,0.20) transparent":"rgba(0,0,0,0.18) transparent" }}>

        <div className="px-5 pb-3">
          <TextareaAutosize value={description} onChange={e => setDescription(e.target.value)}
            placeholder={descPlaceholder ?? t("sprintDescPlaceholder")} minRows={2}
            style={{ width:"100%", resize:"none", overflow:"hidden", outline:"none", border:`1px solid ${borderColor}`, borderRadius:10, padding:"8px 10px", fontSize:13, lineHeight:1.5, fontFamily:"inherit", background:inputBg, color:"var(--text)", boxSizing:"border-box", display:"block" }}
          />
        </div>

        <div style={{ height:1, background:borderColor }} />

        {goals.length === 0 ? (
          <div className="px-5 py-3">
            <button onClick={() => setGoals(prev => [...prev, { id:makeId(), text:"", done:false }])}
              style={{ width:"100%", height:34, borderRadius:10, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <span style={{ fontSize:16, lineHeight:1 }}>+</span> {t("addGoal")}
            </button>
          </div>
        ) : (
        <div className="px-5 pt-3 pb-3">
          <div className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color:"var(--text-tertiary)" }}>
            {t("goalsLabel")} ({activeGoals.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {goals.map((g, idx) => {
              const gc = g.color;
              const ec = getEventColors(gc ?? "", dark);
              const inputBackground = ec.bg;
              const inputBorderColor = ec.border;
              const ach = gc ? achromaticStyle(resolveNoteHex(gc), dark) : null;
              // White/black/grey show their literal colour as text instead of the
              // auto-inverted "readable ink" colour getEventColors returns for achromatic
              // hues — mirrors the day-goal fix.
              const inputTextColor = ec.textTitle;
              const placeholderClass = ach ? `placeholder-goal-${ach.tier}` : undefined;
              const dotBorder = ach?.tier === "white" ? "1.5px solid rgba(0,0,0,0.35)" : `1.5px solid ${dark?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.9)"}`;
              return (
                <div key={g.id} className="flex items-center gap-2"
                  onMouseEnter={() => setHoveredGoalId(g.id)}
                  onMouseLeave={() => setHoveredGoalId(null)}
                >
                  <span className="text-[11px] tabular-nums w-4 text-right shrink-0" style={{ color:"var(--text-tertiary)" }}>{idx+1}.</span>
                  <div style={{ flex:1, position:"relative" }}>
                    <TextareaAutosize value={g.text} onChange={e => setGoals(prev => prev.map(x => x.id===g.id ? { ...x, text:e.target.value } : x))}
                      onHeightChange={h => handleGoalInputHeightChange(g.id, h)}
                      placeholder={`${t("goalPlaceholder")} ${idx+1}`}
                      className={placeholderClass}
                      minRows={1}
                      style={{ width:"100%", resize:"none", overflow:"hidden", overflowWrap:"anywhere", wordBreak:"break-word", background:inputBackground, border:`1.5px solid ${inputBorderColor}`, borderRadius:12, padding:"8px 59px 8px 10px", fontSize:13, lineHeight:1.4, color:inputTextColor, outline:"none", fontFamily:"inherit", boxSizing:"border-box", display:"block", boxShadow: ec.boxShadow || undefined, transition:"background 200ms ease, border-color 200ms ease, color 200ms ease" }}
                    />
                    <div style={{ position:"absolute", top: (goalInputHeights[g.id] ?? 20) > 24 ? 8 : "50%", transform: (goalInputHeights[g.id] ?? 20) > 24 ? "none" : "translateY(-50%)", right:8, display:"flex", alignItems:"center", gap:6, transition:"top 150ms", opacity:(hoveredGoalId===g.id||colorPickerGoalId===g.id)?1:0, pointerEvents:(hoveredGoalId===g.id||colorPickerGoalId===g.id)?"auto":"none", isolation:"isolate" }}>
                      <button
                        ref={el => { colorBtnRefs.current[g.id] = el; }}
                        onClick={e => { e.stopPropagation(); toggleColorPicker(g.id); }}
                        onPointerDown={e => e.stopPropagation()}
                        title={t("chooseColor")}
                        aria-label={t("chooseColor")}
                        style={{ width:20, height:20, borderRadius:999, flexShrink:0, background: normaliseGrey(gc) || "transparent", border: gc ? "1.5px solid rgba(255,255,255,0.85)" : "1.5px solid var(--border-soft)", boxShadow: gc ? "0 1px 3px rgba(0,0,0,0.18)" : undefined, boxSizing:"border-box", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", mixBlendMode:"normal", isolation:"isolate" }}
                      >
                        {!gc && <span style={{ position:"absolute", width:"55%", height:"1.5px", background: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)", transform:"rotate(-45deg)" }} />}
                      </button>
                      <button onClick={() => setConfirmDeleteGoalId(g.id)}
                        onPointerDown={e => e.stopPropagation()}
                        style={{ width:20, height:20, borderRadius:999, border:"none", boxSizing:"border-box", background: dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)", color:"#ff3b30", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.1s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.28)":"rgba(255,59,48,0.22)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = dark?"rgba(255,59,48,0.15)":"rgba(255,59,48,0.1)"; }}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {canAdd && (
            <button onClick={() => setGoals(prev => [...prev, { id:makeId(), text:"", done:false }])}
              className="mt-2"
              style={{ width:"100%", height:34, borderRadius:10, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.13)"}`, background:"transparent", color:"var(--text-secondary)", fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <span style={{ fontSize:16, lineHeight:1 }}>+</span> {t("addGoal")}
            </button>
          )}
        </div>
        )}

        </div>{/* end scrollable body */}
      </motion.div>
    </motion.div>
    {colorPickerGoalId !== null && colorPickerPos && ReactDOM.createPortal(
      <AnimatePresence>
        <motion.div
          key="goal-color-popover"
          initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.94, y:-4 }}
          transition={{ type:"spring", stiffness:420, damping:28 }}
          onClick={e => e.stopPropagation()}
          style={{ position:"fixed", top:colorPickerPos.top, left:colorPickerPos.left, zIndex:200, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.28)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:152, isolation:"isolate", mixBlendMode:"normal" }}
        >
          <button onClick={() => setGoalColor(colorPickerGoalId, undefined)}
            title={t("noColor")}
            style={{ width:20, height:20, borderRadius:999, background: dark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.06)", border: !goals.find(g=>g.id===colorPickerGoalId)?.color ? `1.5px solid ${dark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)"}` : "1.5px solid transparent", cursor:"pointer", position:"relative", mixBlendMode:"normal", isolation:"isolate" }}
          >
            <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--text-tertiary)" }}>✕</span>
          </button>
          {APPLE_COLORS.map(ac => {
            const hex = dark ? ac.dark : ac.light;
            const cur = goals.find(g=>g.id===colorPickerGoalId)?.color;
            const selected = cur === hex;
            return (
              <button key={ac.key} onClick={() => setGoalColor(colorPickerGoalId, hex)}
                title={ac.label}
                style={{ width:20, height:20, borderRadius:999, background:hex, border:"1.5px solid transparent", cursor:"pointer", transition:"transform 120ms ease", boxShadow: (ac.key==="white"||ac.key==="grey") ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined, mixBlendMode:"normal", isolation:"isolate", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", transform: selected ? "scale(1.08)" : "scale(1)" }}
              >
                {selected && <span style={{ fontSize:11, lineHeight:1, fontWeight:700, color: swatchCheckColor(hex) }}>✓</span>}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>,
      document.body
    )}
    <ConfirmDialog
      open={confirmDeleteGoalId !== null}
      onClose={() => setConfirmDeleteGoalId(null)}
      onConfirm={() => { if (confirmDeleteGoalId) { setGoals(prev => prev.filter(x => x.id !== confirmDeleteGoalId)); setConfirmDeleteGoalId(null); } }}
      message={t("deleteGoalConfirm")}
      confirmLabel={t("remove")}
      dark={dark}
    />
    </>
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
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={e => { e.stopPropagation(); onClose(); }}
        >
          <motion.div
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            transition={{ duration:0.28, ease:"easeOut" }}
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
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            transition={{ duration:0.28, ease:"easeOut" }}
            style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", backdropFilter:"blur(10px) saturate(160%)", WebkitBackdropFilter:"blur(10px) saturate(160%)" }}
          />
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

function SprintSettingsModal({ quarterIndex:_qi, quarter, initial, dark, modalBg, colorKey, onColorChange, onClose, onSave, onResetBlock }: {
  quarterIndex: number; quarter: Quarter; initial: QuarterConfig; dark: boolean; modalBg: string;
  colorKey: AppleColorKey; onColorChange: (key: AppleColorKey) => void;
  onClose: () => void; onSave: (next: QuarterConfig) => void; onResetBlock: (blockId: string) => void;
}) {
  const { t, lang } = React.useContext(LangContext);
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
  const [quarterColorOpen, setQuarterColorOpen] = useState(false);

  const borderColor = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  return (
    <>
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, background:"rgba(20,20,25,0.38)", backdropFilter:"blur(14px) saturate(160%)", WebkitBackdropFilter:"blur(14px) saturate(160%)" }}
      />
      <motion.div onClick={e => e.stopPropagation()} initial={{ opacity:0, scale:0.96, y:8 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:4 }}
        transition={{ type:"spring", stiffness:360, damping:32 }} className="w-full max-w-md"
        style={{ background:modalBg, backdropFilter:"blur(30px) saturate(180%)", WebkitBackdropFilter:"blur(30px) saturate(180%)", borderRadius:22, boxShadow:"0 30px 80px rgba(0,0,0,0.22)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.6)"}` }}
      >
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-2">
            <div style={{ position:"relative" }}>
              <button type="button" onClick={() => setQuarterColorOpen(v => !v)} title={t("chooseColor")}
                style={{ width:13, height:13, borderRadius:999, background:quarter.border, border:"none", boxShadow:"0 0 0 2px rgba(255,255,255,0.92), 0 0 0 3.5px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.18)", cursor:"pointer", display:"block", flexShrink:0 }}
              />
              <AnimatePresence>
                {quarterColorOpen && (
                  <>
                    <div style={{ position:"fixed", inset:0, zIndex:49 }} onClick={() => setQuarterColorOpen(false)} />
                    <motion.div
                      initial={{ opacity:0, scale:0.94, y:-4 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.94, y:-4 }}
                      transition={{ type:"spring", stiffness:420, damping:28 }}
                      onClick={e => e.stopPropagation()}
                      style={{ position:"absolute", top:"calc(100% + 7px)", left:0, zIndex:50, background:modalBg, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:12, padding:8, boxShadow:"0 8px 32px rgba(0,0,0,0.22)", border:"1px solid var(--border-soft)", display:"flex", flexWrap:"wrap", gap:5, width:152 }}
                    >
                      {APPLE_COLORS.map(ac => {
                        const selected = colorKey === ac.key;
                        const swatchHex = dark ? ac.dark : hexSaturate(ac.light, LIGHT_SAT_FACTOR);
                        return (
                          <button key={ac.key} onClick={() => { onColorChange(ac.key); setQuarterColorOpen(false); }}
                            title={ac.label}
                            style={{ width:20, height:20, borderRadius:999, background: swatchHex, border:"1.5px solid rgba(128,128,128,0.28)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transform: selected ? "scale(1.08)" : "scale(1)", transition:"transform 120ms ease" }}
                          >
                            {selected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={swatchCheckColor(swatchHex)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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
                // Dot always shows the vivid colour — the block's own if set, else the quarter's fill
                const bDotHex = bAc ? (dark ? bAc.dark : hexSaturate(bAc.light, LIGHT_SAT_FACTOR)) : quarter.border;
                // Tint the sprint row itself using the same colour logic as note/event
                // cards (getEventColors), so choosing a sprint colour visibly colours
                // its row here, in the sprint distribution modal.
                const bEc = bAc ? getEventColors(bHex, dark) : null;
                // The row background stays transparent (bEc.bg), so its text sits directly on the
                // modal's page background rather than a filled surface — use the literal colour for
                // white/black/grey instead of getEventColors' contrast-flipped textTitle, consistent
                // with the goal-text literal-colour fix.
                const bTextColor = bAc ? readableGoalTextColor(bHex, dark, "var(--text)") : "var(--text)";
                return (
                <motion.div layout key={b.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                  className="flex items-center gap-2" style={{ position:"relative" }}
                >
                  <div style={{ background: bEc ? bEc.bg : (dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.025)"), border:`1px solid ${bEc ? bEc.border : borderColor}`, borderRadius:12, padding:"8px 10px", display:"flex", alignItems:"center", gap:8, flex:1, transition:"background 200ms ease, border-color 200ms ease" }}>
                    {/* bEc.bg is transparent once a colour is picked; the neutral rgba
                        fallback above only applies when no sprint colour is chosen. */}
                    {/* Color dot */}
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <button type="button" onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setColorPickerAnchor(prev => prev?.id === b.id ? null : { id: b.id, rect });
                      }}
                        title={t("sprintColor")}
                        style={{ width:16, height:16, borderRadius:999, background: bDotHex, border:"none", boxShadow:"0 0 0 2px rgba(255,255,255,0.92), 0 0 0 3.5px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.18)", cursor:"pointer", display:"block" }}
                      />
                    </div>
                    {/* Number badge */}
                    <div className="text-[10px] font-semibold tabular-nums flex items-center justify-center"
                      style={{ width:20, height:20, borderRadius:999, background: bAc ? `${bHex}22` : (dark?quarter.darkTint:quarter.tint), color: bAc ? bHex : quarter.text, flexShrink:0 }}>{idx+1}</div>
                    <input type="text" value={b.label} onChange={e => update(b.id, { label:e.target.value })} placeholder={t("sprintLabelPlaceholder")}
                      className="flex-1 bg-transparent outline-none text-[13px]" style={{ color: bTextColor }} />
                    <div className="flex items-center gap-1" style={{ background:"rgba(120,120,128,0.20)", border:"1px solid rgba(120,120,128,0.40)", borderRadius:8, padding:2 }}>
                      <button type="button" onClick={() => update(b.id, { weeks:Math.max(1,b.weeks-1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color: bAc ? bTextColor : "var(--text-secondary)" }}>−</button>
                      <span className="text-[12px] font-semibold tabular-nums w-6 text-center" style={{ color: bTextColor }}>{b.weeks}</span>
                      <button type="button" onClick={() => update(b.id, { weeks:Math.min(WEEKS_PER_QUARTER,b.weeks+1) })} className="w-6 h-6 rounded-md text-[14px]" style={{ color: bAc ? bTextColor : "var(--text-secondary)" }}>+</button>
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
                      style={{ width:20, height:20, borderRadius:999, background: dark ? ac.dark : hexSaturate(ac.light, LIGHT_SAT_FACTOR), border: activeColorPickerBlock.color===ac.key ? "2.5px solid var(--text)" : "2.5px solid transparent", cursor:"pointer", transition:"border 120ms ease", boxShadow: (ac.key==="white" || ac.key==="grey") && !dark ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }}
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
            <span>{t("total")}: {total} / {WEEKS_PER_QUARTER} {t("week5")}</span>
            <span>{valid ? t("looksGood") : remaining>0 ? `${pluralWeeks(remaining, lang, t)} ${t("unassigned")}` : `${pluralWeeks(-remaining, lang, t)} ${t("over")}`}</span>
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
  const [view, setView] = useState<LifeView>("years");
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
  // Age/remaining are derived from exact calendar months so they always sum to exactly `lifespan` years.
  const ageMonthsTotal = useMemo(() => birthDate ? monthsBetween(birthDate, today) : 0, [birthDate, today]);
  const lifespanMonths = settings.lifespan * 12;
  const ageYears = Math.floor(ageMonthsTotal / 12);
  const ageMonths = ageMonthsTotal % 12;
  const remainingMonthsTotal = Math.max(0, lifespanMonths - ageMonthsTotal);
  const remainingYears = Math.floor(remainingMonthsTotal / 12);
  const remainingMonths = remainingMonthsTotal % 12;

  const { cols, cellPx, gapPx, totalUnits, currentUnit, labelW, headerH } = useMemo(() => {
    const ls = settings.lifespan;
    let c: number, gap: number, total: number, curr: number;
    switch (view) {
      case "years":  c = 10;  gap = 3; total = ls + 1;   curr = birthDate ? today.getFullYear() - birthDate.getFullYear() : 0; break;
      case "months": c = 12;  gap = 1; total = ls * 12;  curr = Math.floor(ageDays / 30.44);  break;
      case "weeks":  c = 52;  gap = 1; total = ls * 52;  curr = Math.floor(ageDays / 7);      break;
      default:       c = 0;   gap = 1; total = ls * 365; curr = ageDays;                      break;
    }
    const showLbl = view === "months" || view === "weeks";
    const lw = showLbl ? 26 : 0;
    const lh = showLbl ? 12 : 0;
    const gridW = Math.max(100, Math.min(window.innerWidth * 0.94, 560) - 48 - lw - 4);
    let cell: number;
    if (view === "days") {
      cell = 5;
    } else {
      const gridH = Math.max(160, Math.round(window.innerHeight * 0.95) - 320 - lh);
      const rows = Math.ceil(total / c);
      const fromH = (gridH - gap * Math.max(0, rows - 1)) / rows;
      const fromW = (gridW - gap * Math.max(0, c - 1)) / c;
      const natural = Math.max(1, Math.floor(Math.min(fromH, fromW)));
      // For months/weeks: enforce a minimum so cells never become illegible;
      // if natural size is already above the minimum (small lifespan), use it as-is.
      const minCell = view === "months" ? 5 : view === "weeks" ? 4 : 1;
      cell = Math.max(minCell, natural);
    }
    return { cols: c, cellPx: cell, gapPx: gap, totalUnits: total, currentUnit: curr, labelW: lw, headerH: lh };
  }, [view, settings.lifespan, ageDays, birthDate, today]);

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)";
  const inputStyle: React.CSSProperties = {
    background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
    border: `1px solid ${borderColor}`,
    borderRadius: 8, padding: "7px 10px", fontSize: 13,
    color: "var(--text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  const viewLabels: Record<LifeView, string> = { years: t("years"), months: t("months"), weeks: t("weeks"), days: t("days") };

  return (
    <motion.div initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      className="fixed inset-0 z-50 flex justify-center p-4"
      style={{ overflowY:"auto", alignItems:(view === "months" || view === "weeks") ? "flex-start" : "center" }}
      onClick={onClose}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.40)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", pointerEvents:"none" }}
      />
      <motion.div layout initial={{ opacity:0, scale:0.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.96, y:12 }}
        transition={{ type:"spring", stiffness:360, damping:30 }} onClick={e => e.stopPropagation()}
        style={{
          width: isFullscreen ? "100vw" : "min(96vw,560px)",
          height: isFullscreen ? "100vh" : undefined,
          maxWidth: isFullscreen ? "100%" : undefined,
          maxHeight: isFullscreen ? "100%" : (view === "months" || view === "weeks") ? undefined : "96vh",
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
                  <div style={{ height:"100%", width:`${pct}%`, background:LIFE_ACCENT, borderRadius:999, transition:"width 700ms ease" }} />
                </div>
                <div className="mt-1.5 text-[11px] tabular-nums leading-snug" style={{ color:"var(--text-tertiary)" }}>
                  {t("born")} {new Date(settings.birthDate + "T00:00:00").toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" })}{remainingYears > 0 ? ` · ${remainingYears} ${t("yr")} ${remainingMonths} ${t("mo")} ${t("remaining")}` : ""}
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
            <div className="px-6 pb-5" style={{ flex: isFullscreen ? "1 1 0" : "0 0 auto", overflow: "auto", maxHeight: isFullscreen ? undefined : view === "days" ? 260 : undefined, minHeight: 0 }}>
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
              {(view === "months" || view === "weeks") ? (() => {
                const rows = Math.ceil(totalUnits / cols);
                const lblFontSize = Math.min(8, Math.max(6, cellPx));
                const yearInterval = Math.max(1, Math.ceil(9 / (cellPx + gapPx)));
                const birthYear = birthDate ? birthDate.getFullYear() : null;
                const showColAt = (ci: number) =>
                  view === "months" ? true : (ci === 0 || ci === 12 || ci === 25 || ci === 38 || ci === 51);
                return (
                  <div style={{ display:"inline-flex", flexDirection:"column", gap: gapPx }}>
                    {/* Column header row */}
                    <div style={{ display:"flex", alignItems:"flex-end", gap: gapPx, height: headerH, paddingLeft: labelW + gapPx }}>
                      {Array.from({ length: cols }, (_, ci) => (
                        <div key={ci} style={{
                          width: cellPx, flexShrink: 0,
                          textAlign: "center", fontSize: Math.min(7, cellPx),
                          color: "var(--text-tertiary)", lineHeight: 1,
                          overflow: "visible", whiteSpace: "nowrap",
                          opacity: showColAt(ci) ? 1 : 0,
                        }}>{ci + 1}</div>
                      ))}
                    </div>
                    {/* Rows with year labels */}
                    {Array.from({ length: rows }, (_, ri) => {
                      const yearNum = birthYear !== null ? birthYear + ri : ri + 1;
                      const showYear = ri % yearInterval === 0;
                      return (
                        <div key={ri} style={{ display:"flex", alignItems:"center", gap: gapPx, height: cellPx }}>
                          {/* Year label */}
                          <div style={{
                            width: labelW, height: cellPx, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "flex-end",
                            paddingRight: 3,
                            fontSize: lblFontSize, lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
                            color: "var(--text-tertiary)",
                            overflow: "hidden", whiteSpace: "nowrap",
                            opacity: showYear ? 1 : 0,
                          }}>{yearNum}</div>
                          {/* Cells */}
                          {Array.from({ length: Math.min(cols, totalUnits - ri * cols) }, (_, ci) => {
                            const i = ri * cols + ci;
                            const isPast = i < currentUnit;
                            const isCurrent = i === currentUnit;
                            const radius = Math.max(0, Math.floor(cellPx / 5));
                            return (
                              <div key={ci} style={{
                                width: cellPx, height: cellPx, borderRadius: radius, flexShrink: 0,
                                background: isPast ? LIFE_ACCENT : isCurrent ? `${LIFE_ACCENT}66` : (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"),
                                border: (cellPx >= 3 && isCurrent) ? `${Math.max(1, Math.round(cellPx / 6))}px solid ${LIFE_ACCENT}` : "none",
                                boxShadow: (cellPx >= 5 && isCurrent) ? `0 0 0 2px ${LIFE_ACCENT}44` : "none",
                              }} />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div style={{ display:"grid", gridTemplateColumns: view === "days" ? `repeat(auto-fill, ${cellPx}px)` : `repeat(${cols}, ${cellPx}px)`, gap:`${gapPx}px`, width:"100%" }}>
                  {Array.from({ length: totalUnits }, (_, i) => {
                    const isPast = i < currentUnit;
                    const isCurrent = i === currentUnit;
                    const radius = Math.max(0, Math.floor(cellPx / 5));
                    const showBorder = cellPx >= 3;
                    const showYearLabel = view === "years" && cellPx >= 18 && birthDate !== null;
                    const yearLabel = showYearLabel ? birthDate!.getFullYear() + i : null;
                    const yearFontSize = Math.max(7, Math.min(11, Math.floor(cellPx * 0.22)));
                    return (
                      <div key={i} style={{
                        width: cellPx, height: cellPx, borderRadius: radius, flexShrink: 0,
                        background: isPast ? LIFE_ACCENT : isCurrent ? `${LIFE_ACCENT}66` : (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"),
                        border: showBorder
                          ? (isCurrent ? `${Math.max(1, Math.round(cellPx / 6))}px solid ${LIFE_ACCENT}` : "none")
                          : "none",
                        boxShadow: (cellPx >= 5 && isCurrent) ? `0 0 0 2px ${LIFE_ACCENT}44` : "none",
                        display: showYearLabel ? "flex" : undefined,
                        alignItems: showYearLabel ? "center" : undefined,
                        justifyContent: showYearLabel ? "center" : undefined,
                        overflow: showYearLabel ? "hidden" : undefined,
                      }}>
                        {showYearLabel && (
                          <span style={{
                            fontSize: yearFontSize, lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
                            color: isPast ? "rgba(255,255,255,0.75)" : isCurrent ? "#fff" : (dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)"),
                            userSelect: "none", pointerEvents: "none",
                          }}>{yearLabel}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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

// ─── DayTemplatesModal ────────────────────────────────────────────────────────

function DayTemplatesModal({ dark, modalBg, templates, onSave, onApply, onClose, onCloseAll, prefillItems }: {
  dark: boolean; modalBg: string;
  templates: DayTemplate[];
  onSave: (templates: DayTemplate[]) => void;
  onApply?: (tpl: DayTemplate) => void;
  onClose: () => void;
  onCloseAll?: () => void;
  prefillItems?: string[];
}) {
  const { t } = React.useContext(LangContext);
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)";
  const inputStyle: React.CSSProperties = { background: inputBg, border:`1px solid ${borderColor}`, borderRadius:8, padding:"6px 10px", fontSize:12, color:"var(--text)", outline:"none", fontFamily:"inherit", boxSizing:"border-box", width:"100%" };

  // local draft of templates
  const [draft, setDraft] = useState<DayTemplate[]>(() => templates.map(t => ({ ...t, items: [...t.items] })));
  const [editingId, setEditingId] = useState<string|null>(() => prefillItems ? "__new__" : null);
  // form state for create / edit
  const [formName, setFormName] = useState("");
  const [formItems, setFormItems] = useState<string[]>(() => {
    if (prefillItems && prefillItems.length > 0) {
      return [...prefillItems];
    }
    return [""];
  });

  const startNew = () => {
    setEditingId("__new__");
    setFormName("");
    setFormItems([""]);
  };
  const startEdit = (tpl: DayTemplate) => {
    setEditingId(tpl.id);
    setFormName(tpl.name);
    setFormItems(tpl.items.length > 0 ? [...tpl.items] : [""]);
  };
  const cancelEdit = () => setEditingId(null);

  const saveForm = () => {
    const name = formName.trim();
    if (!name) return;
    const items = formItems.map(s => s.trim()).filter(s => s.length > 0);
    if (items.length === 0) return;
    if (editingId === "__new__") {
      const newTpl: DayTemplate = { id: makeId(), name, items };
      const updated = [...draft, newTpl];
      setDraft(updated);
      onSave(updated);
    } else {
      const updated = draft.map(tpl => tpl.id === editingId ? { ...tpl, name, items } : tpl);
      setDraft(updated);
      onSave(updated);
    }
    setEditingId(null);
  };
  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null);
  const deleteTpl = (id: string) => {
    const updated = draft.filter(tpl => tpl.id !== id);
    setDraft(updated);
    onSave(updated);
    setConfirmDeleteId(null);
  };
  const addItem = () => { if (formItems.length < 10) setFormItems(prev => [...prev, ""]); };
  const removeItem = (i: number) => setFormItems(prev => prev.filter((_, j) => j !== i));
  const updateItem = (i: number, v: string) => setFormItems(prev => prev.map((s, j) => j === i ? v : s));

  const editing = editingId !== null;

  return (
    <motion.div initial={false} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onCloseAll ?? onClose}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.22, ease:"easeOut" }}
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)" }}
      />
      <motion.div layout initial={{ opacity:0, scale:0.95, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.96, y:8 }}
        transition={{ type:"spring", stiffness:380, damping:30 }} onClick={e => e.stopPropagation()}
        style={{ width:"min(92vw,400px)", background:modalBg, backdropFilter:"saturate(180%) blur(24px)", WebkitBackdropFilter:"saturate(180%) blur(24px)", borderRadius:22, boxShadow:"0 8px 48px rgba(0,0,0,0.26)", border:`1px solid ${dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)"}`, overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:"80vh" }}
      >
        {/* Header */}
        <div style={{ padding:"18px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, borderBottom:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)"}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {onApply && (
              <button onClick={onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", border:"none", cursor:"pointer", flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--text-tertiary)" }}>{t("settings")}</div>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--text)", marginTop:2 }}>{t("templatesTitle")}</div>
            </div>
          </div>
          <button onClick={onCloseAll ?? onClose} style={{ width:26, height:26, borderRadius:99, background:"rgba(128,128,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-secondary)", fontSize:14, border:"none", cursor:"pointer" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:"auto", flex:1, padding:"12px 20px 16px" }}>
          {editing ? (
            /* ── Edit / Create form ── */
            <div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--text-tertiary)", marginBottom:4 }}>{t("newTemplate")}</div>
                <input
                  value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder={t("templateNamePlaceholder")}
                  style={{ ...inputStyle, fontSize:13, fontWeight:600 }}
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveForm(); } if (e.key === "Escape") cancelEdit(); }}
                />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {formItems.map((item, i) => (
                  <div key={i} style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <div style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${borderColor}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:10, color:"var(--text-tertiary)", fontWeight:600 }}>{i+1}</span>
                    </div>
                    <input
                      value={item} onChange={e => updateItem(i, e.target.value)}
                      placeholder={`${t("goal")} ${i+1}`}
                      style={{ ...inputStyle, flex:1 }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (i === formItems.length-1 && formItems.length < 10) addItem(); } if (e.key === "Escape") cancelEdit(); }}
                    />
                    {formItems.length > 1 && (
                      <button onClick={() => removeItem(i)} style={{ width:18, height:18, border:"none", background:"transparent", cursor:"pointer", color:"#ff3b30", display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {formItems.length < 10 && (
                <button onClick={addItem} style={{ marginTop:8, fontSize:11, color:"#007aff", border:"none", background:"transparent", cursor:"pointer", padding:0, fontFamily:"inherit", fontWeight:600 }}>
                  + {t("addTemplateItem")}
                </button>
              )}
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                <button onClick={cancelEdit} style={{ flex:1, padding:"7px 0", borderRadius:9, border:`1px solid ${borderColor}`, background:"transparent", color:"var(--text-secondary)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{t("cancel")}</button>
                <button onClick={saveForm} disabled={!formName.trim() || formItems.every(s=>!s.trim())} style={{ flex:2, padding:"7px 0", borderRadius:9, border:"none", background:"#007aff", color:"white", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity: (!formName.trim() || formItems.every(s=>!s.trim())) ? 0.4 : 1 }}>{t("saveTemplate")}</button>
              </div>
            </div>
          ) : (
            /* ── Templates list ── */
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {draft.length === 0 ? (
                <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text-tertiary)", fontSize:13 }}>{t("noTemplates")}</div>
              ) : (
                draft.map(tpl => (
                  <div key={tpl.id} style={{ borderRadius:10, border:`1px solid ${borderColor}`, padding:"10px 12px", background: dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.02)" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{tpl.name}</span>
                      <div style={{ display:"flex", gap:4 }}>
                        {onApply && (
                          <button onClick={() => onApply(tpl)} style={{ height:24, padding:"0 9px", borderRadius:5, border:"none", background:"#007aff", cursor:"pointer", color:"white", fontSize:11, fontWeight:700, fontFamily:"inherit", display:"flex", alignItems:"center" }}>
                            {t("applyTemplate")}
                          </button>
                        )}
                        <button onClick={() => startEdit(tpl)} style={{ width:24, height:24, borderRadius:5, border:`1px solid ${borderColor}`, background:"transparent", cursor:"pointer", color:"var(--text-secondary)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => setConfirmDeleteId(tpl.id)} style={{ width:24, height:24, borderRadius:5, border:`1px solid rgba(255,59,48,0.3)`, background:"transparent", cursor:"pointer", color:"#ff3b30", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      {tpl.items.filter(s=>s.trim()).map((item, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ width:5, height:5, borderRadius:99, background:"var(--text-tertiary)", flexShrink:0 }} />
                          <span style={{ fontSize:11, color:"var(--text-secondary)" }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {draft.length < 20 && (
                <button onClick={startNew} style={{ width:"100%", padding:"9px 0", borderRadius:10, border:`1.5px dashed ${dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.14)"}`, background:"transparent", color:"#007aff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginTop:2 }}>
                  + {t("newTemplate")}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    <ConfirmDialog
      open={confirmDeleteId !== null}
      onClose={() => setConfirmDeleteId(null)}
      onConfirm={() => { if (confirmDeleteId) deleteTpl(confirmDeleteId); }}
      message={t("deleteTplConfirm")}
      confirmLabel={t("remove")}
      dark={dark}
    />
    </motion.div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" style={{ display:"block" }}>
      <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
      <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
      <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
    </svg>
  );
}
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
function GoalsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}
function FlagIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
}
function PencilIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function CheckIcon({ color = "white" }: { color?: string }) {
  return <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="2 6 5 9 10 3"/></svg>;
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function NotesIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
}
function ChevronLeftIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevronRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6"/></svg>;
}

export default App;
