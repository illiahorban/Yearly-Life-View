import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import {
  AnimatePresence,
  motion,
  LayoutGroup,
  Reorder,
  useDragControls,
} from "framer-motion";
import confetti from "canvas-confetti";
import TextareaAutosize from "react-textarea-autosize";
import { useSyncEngine } from "./lib/use-sync";
import type {
  AppSnapshot,
  SyncMilestone,
  SyncNoteEntry,
  SyncDayTemplate,
  SyncBlockGoals,
  SyncDayGoals,
} from "./lib/sync-types";
import { useIsMobile } from "./hooks/use-mobile";

// ─── Tiny localStorage helpers ────────────────────────────────────────────────

function ls<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try {
    const r = localStorage.getItem(key);
    return r ? (JSON.parse(r) as T) : fb;
  } catch {
    return fb;
  }
}
function lsSet(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const _JUMP_EN_FULL = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const _JUMP_EN_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const _JUMP_RU_FULL = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];
const _JUMP_RU_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const _JUMP_RU_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
function _jumpFindMonth(name: string): number {
  const n = name.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (
      _JUMP_EN_FULL[i] === n ||
      _JUMP_EN_SHORT[i] === n ||
      _JUMP_RU_FULL[i] === n ||
      _JUMP_RU_GEN[i] === n ||
      _JUMP_RU_SHORT[i] === n
    )
      return i;
  }
  return -1;
}
function parseDateQuery(s: string): Date | null {
  const q = s.trim();
  if (q.length < 3) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const d = new Date(q + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  const numMatch = q.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (numMatch) {
    const day = parseInt(numMatch[1]),
      month = parseInt(numMatch[2]) - 1;
    let year = new Date().getFullYear();
    if (numMatch[3])
      year =
        numMatch[3].length === 2
          ? 2000 + parseInt(numMatch[3])
          : parseInt(numMatch[3]);
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = new Date(year, month, day);
    return d.getDate() === day && d.getMonth() === month ? d : null;
  }
  const lower = q.toLowerCase();
  const dmY = lower.match(/^(\d{1,2})\s+([a-zа-яё]+)(?:[,\s]+(\d{4}))?$/);
  if (dmY) {
    const day = parseInt(dmY[1]),
      mi = _jumpFindMonth(dmY[2]),
      year = dmY[3] ? parseInt(dmY[3]) : new Date().getFullYear();
    if (mi === -1 || day < 1 || day > 31) return null;
    const d = new Date(year, mi, day);
    return d.getDate() === day && d.getMonth() === mi ? d : null;
  }
  const mdY = lower.match(/^([a-zа-яё]+)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/);
  if (mdY) {
    const mi = _jumpFindMonth(mdY[1]),
      day = parseInt(mdY[2]),
      year = mdY[3] ? parseInt(mdY[3]) : new Date().getFullYear();
    if (mi === -1 || day < 1 || day > 31) return null;
    const d = new Date(year, mi, day);
    return d.getDate() === day && d.getMonth() === mi ? d : null;
  }
  return null;
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfYear(y: number) {
  return new Date(y, 0, 1);
}
function startOfNextYear(y: number) {
  return new Date(y + 1, 0, 1);
}
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function monthsBetween(a: Date, b: Date) {
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}
function addYears(d: Date, years: number) {
  const x = new Date(d);
  const month = x.getMonth();
  x.setFullYear(x.getFullYear() + years);
  // Keep leap-day birthdays on the last valid day of February.
  if (x.getMonth() !== month) x.setDate(0);
  return x;
}
/** Number of grid weeks needed to cover the full calendar year.
 *  The grid starts on the Monday of the week containing Jan 1 and must
 *  reach at least the Sunday of the week containing Dec 31 — mirroring
 *  how Q1's first week already shows a few days from the previous year.
 *  Result is 52 for most years, 53 for years whose Dec 31 falls after
 *  week 52 ends (e.g. 2015, 2020, 2026, 2032). */
function dayOfYear(d: Date): number {
  return Math.round(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
}

function gridWeeksForYear(year: number): number {
  const gridStart = startOfWeekMonday(startOfYear(year));
  const dec31 = new Date(year, 11, 31);
  return Math.ceil((daysBetween(gridStart, dec31) + 1) / 7);
}

// ─── Types ────────────────────────────────────────────────────────────────────

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Lang = "en" | "ru";
const MONTHS_I18N: Record<Lang, string[]> = {
  en: [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ],
  ru: [
    "ЯНВ",
    "ФЕВ",
    "МАР",
    "АПР",
    "МАЙ",
    "ИЮН",
    "ИЮЛ",
    "АВГ",
    "СЕН",
    "ОКТ",
    "НОЯ",
    "ДЕК",
  ],
};
const WEEKDAYS_I18N: Record<Lang, string[]> = {
  en: ["M", "T", "W", "T", "F", "S", "S"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
};
const I18N: Record<Lang, Record<string, string>> = {
  en: {
    complete: "complete",
    daysOf: "days",
    of: "of",
    daysRemaining: "days remaining",
    milestones: "All Events",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    lifeCalendarBtn: "Life Calendar",
    quarterProgress: "Quarter progress",
    expandFullscreen: "Expand calendar",
    collapseFullscreen: "Collapse calendar",
    search: "Search",
    searchPlaceholder: "Search notes and events…",
    searchResults: "results",
    searchNoResults: "No matches found",
    jumpTo: "Jump to",
    dayNotes: "Day Notes",
    eventsAndNotes: "Events & Notes",
    events: "Events",
    note: "Note",
    notes: "Notes",
    addNote: "Add note",
    addEvent: "Add event",
    addEventBtn: "Add event",
    save: "Save",
    notePlaceholder: "Add a note, emoji, or reflection… ✨",
    anotherNote: "Another note…",
    remove: "Remove",
    deleteConfirm: "Delete?",
    deleteEntryConfirm: "Remove this note?",
    deleteEventConfirm: "Delete this event?",
    deleteTplConfirm: "Delete this template?",
    deleteDayNotesConfirm: "Delete all notes for this day?",
    deleteGoalConfirm: "Delete this goal?",
    noMilestones: "No milestones yet. Add one above.",
    labelPlaceholder: "Label…",
    add: "Add",
    descPlaceholder: "Description (optional)…",
    repeatYearly: "Repeat every year",
    cancel: "Cancel",
    saveChanges: "Save changes",
    editDescPlaceholder: "Description (optional)…",
    footerBase: "Life Calendar",
    today: "Today",
    week: "Week",
    week2: "weeks",
    week5: "weeks",
    done: "done",
    left: "left",
    goals: "goals",
    allGoals: "All Goals",
    noGoalsYet: "No goals set yet. Open a sprint to add goals.",
    yearGoals: "Year Goals",
    yearDescPlaceholder: "Year vision or theme (optional)…",
    sprintGoals: "Sprint Goals",
    quarterGoals: "Quarter Goals",
    addGoal: "Add goal",
    saveGoals: "Save goals",
    goalsLabel: "Goals",
    goalPlaceholder: "Goal",
    sprintDescPlaceholder: "Sprint description (optional)…",
    quarterDescPlaceholder: "Quarter description (optional)…",
    overview: "Overview",
    dateOfBirth: "Date of Birth",
    lifeExpectancy: "Life Expectancy",
    years: "Years",
    months: "Months",
    weeks: "Weeks",
    days: "Days",
    elapsed: "elapsed",
    year1: "year",
    yearN: "years",
    month1: "month",
    monthN: "months",
    day1: "day",
    dayN: "days",
    yr: "yr",
    mo: "mo",
    wk: "wk",
    hr: "hr",
    min: "min",
    sec: "sec",
    remaining: "remaining",
    remainingLabel: "Remaining:",
    born: "Born",
    age: "Age",
    hour1: "hour",
    hourN: "hours",
    minute1: "minute",
    minuteN: "minutes",
    second1: "second",
    secondN: "seconds",
    sprintConfig: "Sprint configuration",
    sprintConfigDescription: "Group the 13 weeks of the quarter into sprints.",
    saveSprints: "Save sprints",
    addSprint: "Add sprint",
    looksGood: "Looks good",
    unassigned: "unassigned",
    over: "over",
    total: "Total",
    q1: "Q1",
    q2: "Q2",
    q3: "Q3",
    q4: "Q4",
    todayCountdown: "Today!",
    daysShort: "d",
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
    resetSprintConfirm:
      "This will permanently delete all notes, goals and events for this sprint. This cannot be undone.",
    resetSprintBtn: "Reset",
    settings: "Settings",
    sprintLabelPlaceholder: "Sprint label",
    deleteSprint: "Delete sprint",
    deleteSprintConfirm:
      "Are you sure you want to delete this sprint? Its weeks will be unassigned.",
    deleteSprintBtn: "Delete",
    factoryReset: "Factory reset",
    factoryResetWarn1Title: "Step 1 of 2",
    factoryResetWarn1:
      "All notes, goals and events will be permanently deleted. This cannot be undone.",
    factoryResetWarn2Title: "Step 2 of 2",
    factoryResetWarn2:
      "All sprint configurations, labels and colors will be reset to defaults.",
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
    dailyGoals: "Daily Goals",
    allDone: "All done! 🎉",
    goalCountLabel: "Number of goals:",
    goal: "Goal",
    streakDays: "day streak",
    streakDaysPlural: "day streak",
    weekGoalsDone: "goals done",
    resetGoals: "Reset",
    resetGoalsConfirm: "Reset all goals of this day?",
    yes: "Yes",
    no: "No",
    copyToTomorrow: "Copy to tomorrow",
    copiedToTomorrow: "Copied!",
    tomorrowHasGoals: "Tomorrow already has goals. Replace?",
    replace: "Replace",
    templates: "Templates",
    noTemplates: "No templates yet.",
    newTemplate: "New template",
    templateNamePlaceholder: "e.g. Morning routine, Work day…",
    addTemplateItem: "Add item",
    applyTemplate: "Apply",
    deleteTemplate: "Delete",
    saveTemplate: "Save template",
    templatesTitle: "Day Goal Templates",
    applyTemplateBtn: "Apply template",
    saveAsTemplate: "Save as template",
    savedAsTemplate: "Saved!",
    signInGoogle: "Sign in with Google",
    signOut: "Sign out",
    signOutAccount: "Sign out of account",
    signOutConfirm:
      "Sign out of your account?\nYour local data will be kept, but syncing will stop.",
    googleProfile: "Google profile",
    syncSynced: "Synced",
    syncSyncing: "Syncing…",
    syncUploading: "Uploading…",
    syncError: "Sync error",
    syncStatus: "Sync status",
  },
  ru: {
    complete: "выполнено",
    daysOf: "дней",
    of: "из",
    daysRemaining: "дней осталось",
    milestones: "Все события",
    darkMode: "Тёмная тема",
    lightMode: "Светлая тема",
    lifeCalendarBtn: "Календарь жизни",
    quarterProgress: "Прогресс квартала",
    expandFullscreen: "Развернуть календарь",
    collapseFullscreen: "Свернуть календарь",
    search: "Поиск",
    searchPlaceholder: "Поиск по заметкам и событиям…",
    searchResults: "совпадений",
    searchNoResults: "Ничего не найдено",
    jumpTo: "Перейти к",
    dayNotes: "Заметки",
    eventsAndNotes: "События и заметки",
    events: "События",
    note: "Заметка",
    notes: "Заметки",
    addNote: "Добавить заметку",
    addEvent: "Добавить событие",
    addEventBtn: "Добавить событие",
    save: "Сохранить",
    notePlaceholder: "Заметка, мысль или эмодзи… ✨",
    anotherNote: "Ещё заметка…",
    remove: "Удалить",
    deleteConfirm: "Удалить?",
    deleteEntryConfirm: "Удалить эту заметку?",
    deleteEventConfirm: "Удалить это событие?",
    deleteTplConfirm: "Удалить этот шаблон?",
    deleteDayNotesConfirm: "Удалить все заметки этого дня?",
    deleteGoalConfirm: "Удалить эту цель?",
    noMilestones: "Нет событий. Добавьте выше.",
    labelPlaceholder: "Название…",
    add: "Добавить",
    descPlaceholder: "Описание (необязательно)…",
    repeatYearly: "Повторять каждый год",
    cancel: "Отмена",
    saveChanges: "Сохранить",
    editDescPlaceholder: "Описание (необязательно)…",
    footerBase: "Календарь жизни",
    today: "Сегодня",
    week: "неделя",
    week2: "недели",
    week5: "недель",
    done: "готово",
    left: "осталось",
    goals: "целей",
    allGoals: "Все цели",
    noGoalsYet: "Целей пока нет. Откройте спринт, чтобы добавить цели.",
    yearGoals: "Цели года",
    yearDescPlaceholder: "Видение или тема года (необязательно)…",
    sprintGoals: "Цели спринта",
    quarterGoals: "Цели квартала",
    addGoal: "Добавить цель",
    saveGoals: "Сохранить цели",
    goalsLabel: "Цели",
    goalPlaceholder: "Цель",
    sprintDescPlaceholder: "Описание спринта (необязательно)…",
    quarterDescPlaceholder: "Описание квартала (необязательно)…",
    overview: "Обзор",
    dateOfBirth: "Дата рождения",
    lifeExpectancy: "Продолж. жизни",
    years: "Годы",
    months: "Месяцы",
    weeks: "Недели",
    days: "Дни",
    elapsed: "прожито",
    year1: "год",
    year2: "года",
    year5: "лет",
    month1: "месяц",
    month2: "месяца",
    month5: "месяцев",
    day1: "день",
    day2: "дня",
    day5: "дней",
    yr: "лет",
    mo: "мес",
    wk: "нед",
    hr: "ч",
    min: "мин",
    sec: "с",
    remaining: "осталось",
    remainingLabel: "Осталось:",
    born: "Рождён(а)",
    age: "Возраст",
    hour1: "час",
    hour2: "часа",
    hour5: "часов",
    minute1: "минута",
    minute2: "минуты",
    minute5: "минут",
    second1: "секунда",
    second2: "секунды",
    second5: "секунд",
    sprintConfig: "Настройка спринтов",
    sprintConfigDescription: "Сгруппируйте 13 недель квартала в спринты.",
    saveSprints: "Сохранить",
    addSprint: "Спринт",
    looksGood: "Отлично",
    unassigned: "не распределено",
    over: "лишних",
    total: "Итого",
    q1: "К1",
    q2: "К2",
    q3: "К3",
    q4: "К4",
    todayCountdown: "Сегодня!",
    daysShort: "д",
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
    resetSprintConfirm:
      "Все заметки, цели и события этого спринта будут удалены без возможности восстановления.",
    resetSprintBtn: "Сбросить",
    settings: "Настройки",
    sprintLabelPlaceholder: "Название спринта",
    deleteSprint: "Удалить спринт",
    deleteSprintConfirm:
      "Вы уверены, что хотите удалить этот спринт? Его недели станут нераспределёнными.",
    deleteSprintBtn: "Удалить",
    factoryReset: "Сброс к заводским",
    factoryResetWarn1Title: "Шаг 1 из 2",
    factoryResetWarn1:
      "Все заметки, цели и события будут удалены без возможности восстановления.",
    factoryResetWarn2Title: "Шаг 2 из 2",
    factoryResetWarn2:
      "Все спринты, их названия и цвета будут сброшены до настроек по умолчанию.",
    factoryResetBtn: "Сбросить всё",
    nextStep: "Далее →",
    back: "← Назад",
    allNotes: "Все заметки",
    noNotesInQuarter: "Нет заметок",
    noNotesAtAll:
      "Заметок пока нет. Нажмите на день или используйте + для добавления.",
    notesPanel: "Заметки",
    notesSearchPlaceholder: "Поиск по заметкам…",
    eventsSearchPlaceholder: "Поиск по событиям…",
    addNotePickDate: "Выберите дату:",
    openNote: "Открыть",
    dailyGoals: "Цели дня",
    allDone: "Всё выполнено! 🎉",
    goalCountLabel: "Количество целей:",
    goal: "Цель",
    streakDays: "день подряд",
    streakDaysPlural: "дней подряд",
    weekGoalsDone: "целей выполнено",
    resetGoals: "Сбросить",
    resetGoalsConfirm: "Сбросить все цели этого дня?",
    yes: "Да",
    no: "Нет",
    copyToTomorrow: "Скопировать на завтра",
    copiedToTomorrow: "Скопировано!",
    tomorrowHasGoals: "На завтра уже есть цели. Заменить?",
    replace: "Заменить",
    templates: "Шаблоны",
    noTemplates: "Шаблонов пока нет.",
    newTemplate: "Новый шаблон",
    templateNamePlaceholder: "напр. Утро, Рабочий день…",
    addTemplateItem: "Добавить пункт",
    applyTemplate: "Применить",
    deleteTemplate: "Удалить",
    saveTemplate: "Сохранить шаблон",
    templatesTitle: "Шаблоны дневных целей",
    applyTemplateBtn: "Применить шаблон",
    saveAsTemplate: "Сохранить как шаблон",
    savedAsTemplate: "Сохранено!",
    signInGoogle: "Войти через Google",
    signOut: "Выйти",
    signOutAccount: "Выйти из аккаунта",
    signOutConfirm:
      "Выйти из аккаунта?\nЛокальные данные сохранятся, но синхронизация остановится.",
    googleProfile: "Профиль Google",
    syncSynced: "Синхронизировано",
    syncSyncing: "Синхронизация…",
    syncUploading: "Загрузка…",
    syncError: "Ошибка синхронизации",
    syncStatus: "Статус синхронизации",
  },
};
type LangCtx = {
  t: (k: string) => string;
  months: string[];
  weekdays: string[];
  lang: Lang;
};
const LangContext = React.createContext<LangCtx>({
  t: (k) => I18N.en[k] ?? k,
  months: MONTHS_I18N.en,
  weekdays: WEEKDAYS_I18N.en,
  lang: "en",
});
const WEEKS_PER_QUARTER = 13;
const TOTAL_WEEKS = 52;

type Quarter = {
  key: AppleColorKey;
  label: string;
  tint: string;
  darkTint: string;
  border: string;
  fill: string;
  tileFill: string;
  text: string;
  nameColor: string;
  soft: string;
  darkSoft: string;
};
type Block = {
  id: string;
  weeks: number;
  label: string;
  color?: AppleColorKey;
};
type QuarterConfig = { blocks: Block[] };
type TimestampFields = { createdAt?: number; updatedAt?: number };
type CalendarConfig = { quarters: QuarterConfig[] } & TimestampFields;
type DayState = "past" | "today" | "future" | "out";
type Milestone = {
  id: string;
  label: string;
  date: string;
  color: string;
  description?: string;
  recurring?: boolean;
} & TimestampFields & { isDeleted?: boolean };
type Goal = {
  id: string;
  text: string;
  done: boolean;
  color?: string;
  isDeleted?: boolean;
} & TimestampFields;
type BlockGoals = {
  description: string;
  goals: Goal[];
  isDeleted?: boolean;
} & TimestampFields;
type NoteEntry = {
  id: string;
  text: string;
  createdAt?: number;
  color?: string;
  isDeleted?: boolean;
} & TimestampFields;
type LifeSettings = { birthDate: string; lifespan: number } & TimestampFields;
type LifeView = "years" | "months" | "weeks" | "days";
type DayGoals = {
  count: number;
  done: boolean[];
  labels?: string[];
  colors?: (string | undefined)[];
  isDeleted?: boolean;
} & TimestampFields;
type DayTemplate = {
  id: string;
  name: string;
  items: string[];
} & TimestampFields & { isDeleted?: boolean };
type QuarterMetaForSync = { name?: string; color?: string }[];

function fireConfettiCannons() {
  const colors = [
    "#ffd700",
    "#ff6b6b",
    "#51cf66",
    "#74c0fc",
    "#f783ac",
    "#ff922b",
    "#cc5de8",
  ];
  const base = { zIndex: 9999, colors, disableForReducedMotion: true };

  // Two side cannons, angled steeply across the screen so particles travel the full width.
  confetti({
    ...base,
    startVelocity: 65,
    spread: 80,
    ticks: 300,
    gravity: 0.75,
    particleCount: 150,
    origin: { x: -0.05, y: 0.8 },
    angle: 55,
  });
  confetti({
    ...base,
    startVelocity: 65,
    spread: 80,
    ticks: 300,
    gravity: 0.75,
    particleCount: 150,
    origin: { x: 1.05, y: 0.8 },
    angle: 125,
  });
}

const APPLE_COLORS = [
  { key: "blue", label: "Blue", light: "#007aff", dark: "#0a84ff" },
  { key: "green", label: "Green", light: "#34c759", dark: "#30d158" },
  { key: "indigo", label: "Indigo", light: "#5856d6", dark: "#5e5ce6" },
  { key: "orange", label: "Orange", light: "#ff9500", dark: "#ff9f0a" },
  { key: "pink", label: "Pink", light: "#ff2d55", dark: "#ff375f" },
  { key: "purple", label: "Purple", light: "#af52de", dark: "#bf5af2" },
  { key: "red", label: "Red", light: "#ff3b30", dark: "#ff453a" },
  { key: "teal", label: "Teal", light: "#5ac8fa", dark: "#64d2ff" },
  { key: "yellow", label: "Yellow", light: "#ffcc00", dark: "#ffd60a" },
  { key: "mint", label: "Mint", light: "#00c7be", dark: "#63e6e2" },
  { key: "brown", label: "Brown", light: "#a2845e", dark: "#ac8e68" },
  { key: "black", label: "Black", light: "#121212", dark: "#121212" },
  { key: "grey", label: "Grey", light: "#8e8e93", dark: "#636366" },
  { key: "white", label: "White", light: "#ffffff", dark: "#ffffff" },
] as const;

/** Colour to draw the selection checkmark in so it reads on any swatch —
 *  dark ink on light/bright swatches, white ink on dark/saturated ones. */
function swatchCheckColor(hex: string): string {
  return luminanceOf(hex) > 0.6 ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.95)";
}

/** Unified 3 × 5 colour swatch grid used by every colour-picker popover.
 *  Pass pre-computed hex values so the component stays display-only. */
function ColorSwatchGrid({
  colors,
  selected,
  onSelect,
  onClear,
  clearLabel,
  dark,
}: {
  colors: readonly { key: string; hex: string; label: string }[];
  selected?: string | null;
  onSelect: (hex: string, key: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  dark: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 20px)",
        gap: 5,
      }}
    >
      {onClear && (
        <button
          onClick={onClear}
          title={clearLabel ?? "—"}
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            background: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            border: "none",
            boxShadow: !selected
              ? `0 0 0 1.5px ${dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}`
              : undefined,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>✕</span>
        </button>
      )}
      {colors.map((c) => {
        const sel = selected === c.hex;
        return (
          <button
            key={c.key}
            onClick={() => onSelect(c.hex, c.key)}
            title={c.label}
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: c.hex,
              border: "none",
              cursor: "pointer",
              transition: "transform 120ms ease",
              boxShadow: sel
                ? `0 0 0 2px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.22)${c.key === "white" || c.key === "grey" ? ", inset 0 0 0 1px rgba(0,0,0,0.15)" : ""}`
                : c.key === "white" || c.key === "grey"
                  ? "inset 0 0 0 1px rgba(0,0,0,0.15)"
                  : undefined,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: sel ? "scale(1.08)" : "scale(1)",
              flexShrink: 0,
            }}
          >
            {sel && (
              <span
                style={{
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: swatchCheckColor(c.hex),
                }}
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Position a fixed-position popover relative to an anchor rect, flipping above
 *  the anchor and clamping to both viewport edges so it never renders off-screen. */
function clampedPopoverPos(
  rect: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  gap = 7,
) {
  const below = rect.bottom + gap;
  const top =
    below + popoverHeight <= window.innerHeight
      ? Math.max(8, below)
      : Math.max(
          8,
          Math.min(
            rect.top - popoverHeight - gap,
            window.innerHeight - popoverHeight - 8,
          ),
        );
  const left = Math.min(
    Math.max(8, rect.left),
    window.innerWidth - popoverWidth - 8,
  );
  return { top, left };
}

type AppleColorKey = (typeof APPLE_COLORS)[number]["key"];
type QuarterMeta = { name: string; colorKey: AppleColorKey };

const DEFAULT_QUARTER_META: QuarterMeta[] = [
  { name: "Q1", colorKey: "blue" },
  { name: "Q2", colorKey: "green" },
  { name: "Q3", colorKey: "yellow" },
  { name: "Q4", colorKey: "orange" },
];

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ─── Color helpers: RGB <-> HSL and saturation adjust ──────────────────────
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function saturateRgbaString(rgba: string, factor: number) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!m) return rgba;
  const r = Number(m[1]),
    g = Number(m[2]),
    b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  const { h, s, l } = rgbToHsl(r, g, b);
  const ns = Math.min(1, s * factor);
  const [nr, ng, nb] = hslToRgb(h, ns, l);
  return `rgba(${nr},${ng},${nb},${a})`;
}

const LIGHT_SAT_FACTOR = 1.2;
function hexSaturate(hex: string, factor: number) {
  const [r, g, b] = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const ns = Math.min(1, s * factor);
  const [nr, ng, nb] = hslToRgb(h, ns, l);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

function resolveQuarter(meta: QuarterMeta, dark: boolean): Quarter {
  const ac =
    APPLE_COLORS.find((c) => c.key === meta.colorKey) ?? APPLE_COLORS[0]!;
  const rawHex = dark ? ac.dark : ac.light;
  const hex = rawHex;
  const [r, g, b] = hexToRgb(hex);
  const isAchromaticDark =
    meta.colorKey === "black" || meta.colorKey === "grey";
  // Adjust text color for low-contrast hues in light mode. Yellow is exempt: text/icons use
  // the exact same hex as the quarter's border/fill/day-tiles so every yellow element in the
  // UI matches one single shade (no separate darkened variant for legibility).
  const textHex =
    !dark && meta.colorKey === "mint"
      ? "#008a82"
      : !dark && meta.colorKey === "teal"
        ? "#007ea5"
        : meta.colorKey === "white"
          ? dark
            ? "#ebebf5"
            : "#3a3a3c"
          : isAchromaticDark
            ? dark
              ? "#ffffff"
              : "#1c1c1e"
            : hex;
  // Black/Grey in dark mode: fill/text turn white so percent numbers, headers and icons
  // stay legible — the card/day-tile surface itself keeps each colour's true hue (grey
  // stays grey, black stays black), only the content drawn on top gets the contrast boost.
  const fill = isAchromaticDark && dark ? "#ffffff" : hex;
  // tileFill is the colour used as the day-cell background. `fill` is wrong here:
  // black/grey in dark mode get fill="#ffffff" (for text contrast) but a white cell
  // in dark mode shows the wrong colour entirely. White in light mode gets fill="#ffffff"
  // which merges with the page and makes cells invisible. Use the actual hue instead,
  // except white-in-light-mode which needs a visible off-white (#e0e0e5) so cells don't
  // vanish against the white page background.
  const tileFill =
    isAchromaticDark && dark
      ? hex // grey/black in dark: actual dark hue
      : meta.colorKey === "white"
        ? "#e0e0e5" // white in both modes: off-white, visible against any bg without inverting content
        : hex;
  // The sprint/quarter *name* and its "add goal" icon aren't drawn on top of a filled
  // colour surface the way percentages/progress bars are, so they don't need the
  // white/black contrast boost applied to `text` for legibility. For grey specifically,
  // keep them showing the actual grey swatch (a legible mid-tone in both themes) instead
  // of being swapped to white/black like the rest of the achromatic UI.
  const nameColor =
    meta.colorKey === "grey"
      ? dark
        ? "#aeaeb2"
        : "#8e8e93"
      : meta.colorKey === "white"
        ? dark
          ? "#ffffff"
          : "#18181b"
        : meta.colorKey === "black"
          ? dark
            ? "#e5e5e7"
            : "#121212"
          : textHex;
  return {
    key: meta.colorKey,
    label: meta.name,
    tint: `rgba(${r},${g},${b},0.07)`,
    darkTint: `rgba(${r},${g},${b},0.14)`,
    border: hex,
    fill,
    tileFill,
    text: textHex,
    nameColor,
    soft: `rgba(${r},${g},${b},0.22)`,
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
    tertiary: isAchroLight ? "rgba(28,28,30,0.62)" : "var(--text-tertiary)",
    secondary: isAchroLight ? "rgba(28,28,30,0.88)" : "var(--text-secondary)",
  };
}

const MILESTONE_COLORS = [
  "#007aff",
  "#34c759",
  "#5856d6",
  "#ff9500",
  "#ff2d55",
  "#af52de",
  "#ff3b30",
  "#5ac8fa",
  "#ffcc00",
  "#00c7be",
  "#a2845e",
  "#121212",
  "#8e8e93",
  "#ffffff",
];

/** Perceived luminance (0–1) of a hex colour, used to decide whether light or dark
 *  content reads best against it. */
function luminanceOf(hex: string): number {
  const h = hex.replace("#", "");
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
function readableGoalTextColor(
  colorHex: string | undefined,
  dark: boolean,
  fallback: string,
): string {
  if (!colorHex) return fallback;
  // Mirror the inversion logic from getEventColors so summary labels stay legible.
  const _ach = achromaticStyle(colorHex, dark);
  if (_ach) {
    if (_ach.tier === "grey") return "#71717a";
    if (_ach.tier === "black") return dark ? "#e5e5e7" : "#000000";
    /* white */ return dark ? "#ffffff" : "#18181b";
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
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum >= 0.45) return hex;
  const factor = Math.min(0.82, (0.55 - lum) / (1 - lum));
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Returns adaptive styles for achromatic colours (white/grey/black) that stay legible in both themes.
 *  Returns null for any chromatic (saturated) colour so callers fall back to adaptColor. */
type AchromaticStyle = {
  bg: string;
  border: string;
  text: string;
  marker: string;
  markerBorder?: string;
  ring?: string;
  tier: "black" | "grey" | "white";
};
function achromaticStyle(hex: string, dark: boolean): AchromaticStyle | null {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const maxC = Math.max(r, g, b);
  const sat = maxC === 0 ? 0 : (maxC - Math.min(r, g, b)) / maxC;
  if (sat > 0.18) return null;
  if (lum > 0.7) {
    // white — pure white border in both themes, as requested
    return dark
      ? {
          bg: "#ffffff",
          border: "#ffffff",
          text: "#18181b",
          marker: "#ffffff",
          tier: "white",
        }
      : {
          bg: "#ffffff",
          border: "#ffffff",
          text: "#18181b",
          marker: "#ffffff",
          tier: "white",
        };
  }
  if (lum < 0.12) {
    // black — pure black border in both themes, to match the white tier above
    return dark
      ? {
          bg: "#09090b",
          border: "#000000",
          text: "#ffffff",
          marker: "#27272a",
          tier: "black",
        }
      : {
          bg: "#000000",
          border: "#000000",
          text: "#ffffff",
          marker: "#000000",
          tier: "black",
        };
  }
  return dark
    ? {
        bg: "rgba(255,255,255,0.20)",
        border: "rgba(255,255,255,0.20)",
        text: "#ffffff",
        marker: "#a1a1aa",
        tier: "grey",
      }
    : {
        bg: "#e4e4e7",
        border: "#e4e4e7",
        text: "#27272a",
        marker: "#a1a1aa",
        tier: "grey",
      };
}

/** Maps any APPLE_COLORS hex variant (light or dark) to the canonical light-mode
 *  hex so achromaticStyle always classifies it correctly regardless of theme.
 *  Custom hex values not in APPLE_COLORS are returned unchanged. */
function resolveNoteHex(hex: string): string {
  const ac = APPLE_COLORS.find((c) => c.light === hex || c.dark === hex);
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
function goalCheckboxAchromaticStyle(
  hex: string,
  dark: boolean,
): GoalCheckboxStyle | null {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const maxC = Math.max(r, g, b);
  const sat = maxC === 0 ? 0 : (maxC - Math.min(r, g, b)) / maxC;
  if (sat > 0.18) return null;
  if (lum > 0.7) {
    return { bg: "#ffffff", border: "#ffffff", icon: "#18181b" };
  }
  if (lum < 0.12) {
    return dark
      ? { bg: "#09090b", border: "#000000", icon: "#ffffff" }
      : { bg: "#000000", border: "#000000", icon: "#ffffff" };
  }
  return { bg: "#71717a", border: "#71717a", icon: "#ffffff" };
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
function goalCheckboxColors(
  colorHex: string | undefined,
  dark: boolean,
  fallbackHex: string,
  fallbackColorKey?: string,
) {
  const ach = colorHex
    ? goalCheckboxAchromaticStyle(resolveNoteHex(colorHex), dark)
    : null;
  if (ach) {
    return {
      doneBg: ach.bg,
      doneBorder: ach.border,
      emptyBg: "transparent",
      emptyBorder: ach.border,
      icon: ach.icon,
    };
  }

  if (colorHex) {
    return {
      doneBg: colorHex,
      doneBorder: colorHex,
      emptyBg: "transparent",
      emptyBorder: colorHex,
      icon: "#ffffff",
    };
  }

  // No colour chosen for this specific goal: keep the checkbox neutral instead of
  // inheriting the sprint/quarter accent colour, matching the day-goal checkbox default.
  return {
    doneBg: "#34c759",
    doneBorder: "#34c759",
    emptyBg: "transparent",
    emptyBorder: "var(--border-soft)",
    icon: "#ffffff",
  };
}

// ─── Centralized event/milestone color helper ─────────────────────────────────
// Returns all semantic color values needed to render an event card (background,
// title, description, icon, borders, marker bar, and inline-form surfaces) with
// guaranteed readable contrast in both light and dark themes.
type EventColors = {
  bg: string; // card background
  textTitle: string; // primary / title text
  textDesc: string; // secondary / description text
  icon: string; // action icon color
  border: string; // normal card border colour (empty = use boxShadow ring instead)
  borderEditing: string; // border while inline edit form is open
  boxShadow: string; // inset ring substitute (used when border is empty)
  marker: string; // day-cell color bar segment
  formBg: string; // input background inside card
  formBorder: string; // input border inside card
};

function getEventColors(hex: string, dark: boolean): EventColors {
  // ── No-color path (empty string) ────────────────────────────────────────────
  if (!hex) {
    return {
      bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      textTitle: "var(--text)",
      textDesc: "var(--text-secondary)",
      icon: "var(--text-secondary)",
      border: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
      borderEditing: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
      boxShadow: "",
      marker: dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.20)",
      formBg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      formBorder: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
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
      bg: "transparent",
      textTitle: textHex,
      textDesc: textHex,
      icon: textHex,
      border: borderHex,
      borderEditing: borderHex,
      boxShadow: ach.ring ?? "",
      marker: ach.marker,
      formBg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      formBorder: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
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
    bg: "transparent",
    textTitle: hex,
    textDesc: hex,
    icon: hex,
    border: `${hex}99`,
    borderEditing: `${hex}cc`,
    boxShadow: "",
    marker: adapted,
    formBg: dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.70)",
    formBorder: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
  };
}

const LIFE_ACCENT = "#007aff";

function LifeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21v-1.5A6.5 6.5 0 0 1 12 13a6.5 6.5 0 0 1 6.5 6.5V21" />
    </svg>
  );
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function validTimestamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function withTimestamps<T extends TimestampFields>(
  value: T,
  fallback = Date.now(),
): T & Required<TimestampFields> {
  const updatedAt = validTimestamp(
    value.updatedAt,
    validTimestamp(value.createdAt, fallback),
  );
  const createdAt = validTimestamp(value.createdAt, updatedAt);
  return { ...value, createdAt, updatedAt };
}

function newTimestamps(): Required<TimestampFields> {
  const timestamp = Date.now();
  return { createdAt: timestamp, updatedAt: timestamp };
}

function normalizeGoals(goals: Goal[], fallback: number): Goal[] {
  return goals.map((goal) => ({
    ...withTimestamps(goal, fallback),
    isDeleted: goal.isDeleted ?? false,
  }));
}

function normalizeBlockGoals(value: BlockGoals, fallback: number): BlockGoals {
  const stamped = withTimestamps(value, fallback);
  return {
    ...stamped,
    isDeleted: value.isDeleted ?? false,
    goals: normalizeGoals(value.goals ?? [], fallback),
  };
}

function normalizeMilestone(
  value: Milestone,
  fallback: number,
): Milestone & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

function normalizeNote(
  value: NoteEntry,
  fallback: number,
): NoteEntry & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

function normalizeDayTemplate(
  value: DayTemplate,
  fallback: number,
): DayTemplate & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

function normalizeDayGoals(
  value: DayGoals,
  fallback: number,
): DayGoals & Required<TimestampFields> {
  return {
    ...withTimestamps(value, fallback),
    isDeleted: value.isDeleted ?? false,
  };
}

function normalizeLifeSettings(
  value: LifeSettings,
  fallback: number,
): LifeSettings & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

function updateBlockGoals(
  previous: BlockGoals | undefined,
  next: BlockGoals,
): BlockGoals {
  const changedAt = Date.now();
  const prior = previous ? normalizeBlockGoals(previous, changedAt) : undefined;
  const base = normalizeBlockGoals(next, changedAt);
  const previousById = new Map(
    (prior?.goals ?? []).map((goal) => [goal.id, goal]),
  );
  const incomingIds = new Set(base.goals.map((goal) => goal.id));
  const removed = (prior?.goals ?? [])
    .filter((goal) => !incomingIds.has(goal.id) && !goal.isDeleted)
    .map((goal) => ({ ...goal, updatedAt: changedAt, isDeleted: true }));
  const existingTombstones = (prior?.goals ?? []).filter(
    (goal) => !incomingIds.has(goal.id) && goal.isDeleted,
  );
  return {
    ...base,
    isDeleted: false,
    createdAt: prior?.createdAt ?? base.createdAt,
    updatedAt: changedAt,
    goals: [
      ...base.goals.map((goal) => {
        const old = previousById.get(goal.id);
        const changed =
          !old ||
          old.text !== goal.text ||
          old.done !== goal.done ||
          old.color !== goal.color ||
          old.isDeleted !== goal.isDeleted;
        return {
          ...goal,
          createdAt: old?.createdAt ?? goal.createdAt,
          updatedAt: changed ? changedAt : old.updatedAt,
          isDeleted: goal.isDeleted ?? false,
        };
      }),
      ...removed,
      ...existingTombstones,
    ],
  };
}

// Reorders the subset of `list` whose id is in `orderedIds` into that new
// relative order, while leaving every other item's position untouched.
// Matching by id (not by any grouping key) keeps this safe for lists like
// milestones where a rendered day's items can be synthetic recurring copies
// that share an id with a differently-dated original.
function reorderByIds<T extends { id: string }>(
  list: T[],
  orderedIds: string[],
): T[] {
  const byId = new Map(list.map((item) => [item.id, item]));
  const targetSlots: number[] = [];
  list.forEach((item, i) => {
    if (byId.has(item.id) && orderedIds.includes(item.id)) targetSlots.push(i);
  });
  const reordered = orderedIds
    .map((id) => byId.get(id))
    .filter((x): x is T => x !== undefined);
  const next = [...list];
  targetSlots.forEach((pos, i) => {
    if (reordered[i]) next[pos] = reordered[i]!;
  });
  return next;
}
function defaultBlock(): Block {
  return { id: makeId(), weeks: WEEKS_PER_QUARTER, label: "All weeks" };
}

/** Returns correct plural form of "week/неделя" for a given count and language. */
function pluralWeeks(
  n: number,
  lang: string,
  t: (k: string) => string,
): string {
  if (lang !== "ru") return `${n} ${n === 1 ? t("week") : t("week2")}`;
  const mod10 = n % 10,
    mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${t("week")}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return `${n} ${t("week2")}`;
  return `${n} ${t("week5")}`;
}

/** Returns correct plural form of unit label (years/months/weeks/days) for a count. */
function pluralUnits(
  n: number,
  view: LifeView,
  lang: string,
  t: (k: string) => string,
): string {
  if (lang !== "ru") {
    if (view === "years") return n === 1 ? t("year1") : t("yearN");
    if (view === "months") return n === 1 ? t("month1") : t("monthN");
    if (view === "weeks") return n === 1 ? t("week") : t("week2");
    return n === 1 ? t("day1") : t("dayN");
  }
  // Standard Russian three-form rule applied to the total count.
  const m10 = n % 10,
    m100 = n % 100;
  const one = m10 === 1 && m100 !== 11;
  const few = m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20);
  if (view === "years") return one ? t("year1") : few ? t("year2") : t("year5");
  if (view === "months")
    return one ? t("month1") : few ? t("month2") : t("month5");
  if (view === "weeks") return one ? t("week") : few ? t("week2") : t("week5");
  return one ? t("day1") : few ? t("day2") : t("day5");
}

function pluralDayStreak(n: number, lang: string): string {
  if (lang !== "ru") return `${n} day streak`;
  const mod10 = n % 10,
    mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день подряд`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return `${n} дня подряд`;
  return `${n} дней подряд`;
}

/** Generic plural helper: k1=singular, k2=few (ru), k5=many (ru) / kN=plural (en). */
function pluralCount(
  n: number,
  lang: string,
  t: (k: string) => string,
  k1: string,
  k2: string,
  k5: string,
): string {
  if (lang !== "ru") return `${n} ${n === 1 ? t(k1) : t(k5)}`;
  const m10 = n % 10,
    m100 = n % 100;
  const one = m10 === 1 && m100 !== 11;
  const few = m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20);
  return `${n} ${one ? t(k1) : few ? t(k2) : t(k5)}`;
}

function createSprintFromSelection(
  qConfig: QuarterConfig,
  selStart: number,
  selEnd: number,
  sprintLabel: string,
): QuarterConfig {
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
      if (beforeWeeks > 0)
        newBlocks.push({
          id: makeId(),
          weeks: beforeWeeks,
          label: block.label,
        });
      if (!sprintAdded) {
        newBlocks.push({
          id: makeId(),
          weeks: selEndExcl - selStart,
          label: sprintLabel,
        });
        sprintAdded = true;
      }
      const afterWeeks = bEnd - selEndExcl;
      if (afterWeeks > 0)
        newBlocks.push({ id: makeId(), weeks: afterWeeks, label: block.label });
    }
  }
  return { blocks: newBlocks };
}
function defaultConfig(q4Cap = WEEKS_PER_QUARTER): CalendarConfig {
  return {
    ...newTimestamps(),
    quarters: [0, 1, 2, 3].map((qi) => ({
      blocks: [
        {
          id: makeId(),
          weeks: qi === 3 ? q4Cap : WEEKS_PER_QUARTER,
          label: "All weeks",
        },
      ],
    })),
  };
}
function loadConfig(year: number): CalendarConfig {
  const q4Cap = gridWeeksForYear(year) - 3 * WEEKS_PER_QUARTER;
  if (typeof window === "undefined") return defaultConfig(q4Cap);
  try {
    const raw = localStorage.getItem(`lifeCalendar:v1:${year}`);
    if (!raw) return defaultConfig(q4Cap);
    const p = withTimestamps(JSON.parse(raw) as CalendarConfig);
    if (!p?.quarters || p.quarters.length !== 4) return defaultConfig(q4Cap);
    for (let qi = 0; qi < 4; qi++) {
      const cap = qi === 3 ? q4Cap : WEEKS_PER_QUARTER;
      if (
        p.quarters[qi]!.blocks.reduce((a, b) => a + (b.weeks || 0), 0) !== cap
      )
        return defaultConfig(q4Cap);
    }
    return p;
  } catch {
    return defaultConfig(q4Cap);
  }
}
function saveConfig(year: number, cfg: CalendarConfig) {
  try {
    localStorage.setItem(
      `lifeCalendar:v1:${year}`,
      JSON.stringify(withTimestamps(cfg)),
    );
  } catch {}
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const isMobile = useIsMobile();
  const isCompactViewport = useMediaQuery("(max-width: 639px)");
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const MIN_YEAR = 2020,
    MAX_YEAR = 2040;
  const [viewYear, setViewYear] = useState(() => now.getFullYear());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const yearPickerRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!yearPickerOpen || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (
        yearPickerRef.current &&
        !yearPickerRef.current.contains(e.target as Node)
      )
        setYearPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [yearPickerOpen, isMobile]);

  // Dark mode
  const [dark, setDark] = useState<boolean>(() =>
    ls<boolean>("lifeCalendar:darkMode", false),
  );
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    lsSet("lifeCalendar:darkMode", dark);
  }, [dark]);

  const [lang, setLang] = useState<Lang>(() =>
    ls<string>("lifeCalendar:lang", "ru") === "ru" ? "ru" : "en",
  );
  useEffect(() => {
    lsSet("lifeCalendar:lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (k: string) => I18N[lang][k] ?? I18N.en[k] ?? k;
  const months = MONTHS_I18N[lang];
  const weekdays = WEEKDAYS_I18N[lang];

  // Calendar config
  const [config, setConfig] = useState<CalendarConfig>(() =>
    loadConfig(now.getFullYear()),
  );
  useEffect(() => {
    setConfig(loadConfig(viewYear));
  }, [viewYear]);
  useEffect(() => {
    saveConfig(viewYear, config);
  }, [viewYear, config]);

  // Settings dropdown
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [factoryResetStep, setFactoryResetStep] = useState(0);
  const settingsRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsOpen && !profileOpen) return;
    if (isMobile) return;

    // Desktop: close without blocking the click that opened another area.
    const handler = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
        setProfileOpen(false);
        setFactoryResetStep(0);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen, profileOpen, isMobile]);

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsOpen) setProfileOpen(false);
  }, [settingsOpen]);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchBtnRef = React.useRef<HTMLDivElement>(null);
  const searchBarRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchOpen || isMobile) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        searchBtnRef.current &&
        !searchBtnRef.current.contains(target) &&
        searchBarRef.current &&
        !searchBarRef.current.contains(target)
      ) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen, isMobile]);

  // On mobile, a tap outside any currently open header menu closes that menu
  // first. Capture it before React's click handlers so the same tap cannot
  // also open the newly tapped area. The next tap then opens it.
  useEffect(() => {
    if (!isMobile) return;

    const handler = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;

      const activeAreas: HTMLElement[] = [];
      if (yearPickerOpen && yearPickerRef.current)
        activeAreas.push(yearPickerRef.current);
      if (searchOpen) {
        if (searchBtnRef.current) activeAreas.push(searchBtnRef.current);
        if (searchBarRef.current) activeAreas.push(searchBarRef.current);
      }
      if ((settingsOpen || profileOpen) && settingsRef.current)
        activeAreas.push(settingsRef.current);
      if (activeAreas.length === 0) return;

      if (activeAreas.some((area) => area.contains(target))) return;

      closeMobileWindows();
      e.stopPropagation();
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [
    isMobile,
    yearPickerOpen,
    searchOpen,
    settingsOpen,
    profileOpen,
  ]);

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    const fallback = Date.now();
    return ls<Milestone[]>("lifeCalendar:milestones", []).map((item) =>
      normalizeMilestone(item, fallback),
    );
  });
  useEffect(() => {
    lsSet("lifeCalendar:milestones", milestones);
  }, [milestones]);
  // Deleted milestones stay in this state as tombstones so the sync snapshot
  // can propagate the deletion. All user-facing views use activeMilestones.
  const activeMilestones = useMemo(
    () => milestones.filter((m) => !m.isDeleted),
    [milestones],
  );
  const [milestonePanelOpen, setMilestonePanelOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [lifeCalendarOpen, setLifeCalendarOpen] = useState(false);
  const [lifeSettings, setLifeSettings] = useState<LifeSettings>(() => {
    const fallback = Date.now();
    return normalizeLifeSettings(
      ls<LifeSettings>("lifeCalendar:lifeSettings", {
        birthDate: "",
        lifespan: 80,
      }),
      fallback,
    );
  });
  useEffect(() => {
    lsSet("lifeCalendar:lifeSettings", lifeSettings);
  }, [lifeSettings]);

  // Day Goals
  const [dayGoals, setDayGoals] = useState<Record<string, DayGoals>>(() => {
    const fallback = Date.now();
    const raw = ls<Record<string, DayGoals>>("lifeCalendar:dayGoals", {});
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        normalizeDayGoals(value, fallback),
      ]),
    );
  });
  useEffect(() => {
    lsSet("lifeCalendar:dayGoals", dayGoals);
  }, [dayGoals]);
  // Day Templates
  const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>(() => {
    const fallback = Date.now();
    return ls<DayTemplate[]>("lifeCalendar:dayTemplates", []).map((item) =>
      normalizeDayTemplate(item, fallback),
    );
  });
  useEffect(() => {
    lsSet("lifeCalendar:dayTemplates", dayTemplates);
  }, [dayTemplates]);
  const updateDayGoals = (dk: string, goals: DayGoals) => {
    setDayGoals((prev) => {
      const previous = prev[dk];
      const now3 = Date.now();
      return {
        ...prev,
        [dk]: {
          ...goals,
          createdAt:
            previous?.createdAt ?? validTimestamp(goals.createdAt, now3),
          updatedAt: now3,
          isDeleted: goals.isDeleted ?? false,
        },
      };
    });
  };
  const computeQuarterStreak = useCallback(
    (qAllDays: Date[]): number => {
      const isDone = (dk: string) => {
        const g = dayGoals[dk];
        return (
          g != null &&
          !g.isDeleted &&
          g.count > 0 &&
          g.done.length >= g.count &&
          g.done.every(Boolean)
        );
      };
      const t0 = startOfDay(new Date());
      const relevant = qAllDays
        .filter((d) => d <= t0)
        .sort((a, b) => a.getTime() - b.getTime());
      if (relevant.length === 0) return 0;
      let idx = relevant.length - 1;
      if (!isDone(dateKey(relevant[idx]!))) idx--;
      let streak = 0;
      for (let i = idx; i >= 0; i--) {
        if (!isDone(dateKey(relevant[i]!))) break;
        streak++;
      }
      return streak;
    },
    [dayGoals],
  );

  // Notes
  const [notes, setNotes] = useState<Record<string, NoteEntry[]>>(() => {
    const raw = ls<Record<string, unknown>>("lifeCalendar:notes", {});
    const migrated: Record<string, NoteEntry[]> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string") {
        if ((v as string).trim())
          migrated[k] = [
            { id: makeId(), text: v as string, ...newTimestamps() },
          ];
      } else if (Array.isArray(v)) {
        const fallback = Date.now();
        migrated[k] = (v as NoteEntry[]).map((entry) =>
          normalizeNote(entry, fallback),
        );
      }
    }
    return migrated;
  });
  useEffect(() => {
    lsSet("lifeCalendar:notes", notes);
  }, [notes]);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const upsertNotes = (key: string, entries: NoteEntry[]) => {
    setNotes((prev) => {
      const next = { ...prev };
      const previous = prev[key] ?? [];
      const previousById = new Map(previous.map((entry) => [entry.id, entry]));
      const changedAt = Date.now();
      const incomingIds = new Set(entries.map((entry) => entry.id));
      const valid = entries
        .filter((e) => e.text.trim() || e.isDeleted)
        .map((entry) => {
          const old = previousById.get(entry.id);
          const changed =
            !old ||
            old.text !== entry.text ||
            old.color !== entry.color ||
            old.isDeleted !== entry.isDeleted;
          const stamped = normalizeNote(entry, changedAt);
          return {
            ...stamped,
            createdAt: old?.createdAt ?? stamped.createdAt,
            updatedAt: changed
              ? changedAt
              : (old?.updatedAt ?? stamped.updatedAt),
          };
        });
      const removed = previous
        .filter((entry) => !incomingIds.has(entry.id))
        .map((entry) =>
          entry.isDeleted
            ? entry
            : {
                ...normalizeNote(entry, changedAt),
                updatedAt: changedAt,
                isDeleted: true,
              },
        );
      const merged = [...valid, ...removed];
      if (merged.length > 0) next[key] = merged;
      else delete next[key];
      lsSet("lifeCalendar:notes", next);
      return next;
    });
  };

  // Block goals
  const [blockGoals, setBlockGoals] = useState<Record<string, BlockGoals>>(
    () => {
      const fallback = Date.now();
      const raw = ls<Record<string, BlockGoals>>("lifeCalendar:goals", {});
      return Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [
          key,
          normalizeBlockGoals(value, fallback),
        ]),
      );
    },
  );
  useEffect(() => {
    lsSet("lifeCalendar:goals", blockGoals);
  }, [blockGoals]);
  const [editGoalsBlockId, setEditGoalsBlockId] = useState<string | null>(null);

  // Quarter goals
  const [quarterGoals, setQuarterGoals] = useState<Record<number, BlockGoals>>(
    () => {
      const fallback = Date.now();
      const raw = ls<Record<number, BlockGoals>>(
        "lifeCalendar:quarterGoals",
        {},
      );
      return Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [
          key,
          normalizeBlockGoals(value, fallback),
        ]),
      );
    },
  );
  useEffect(() => {
    lsSet("lifeCalendar:quarterGoals", quarterGoals);
  }, [quarterGoals]);
  const [editGoalsQi, setEditGoalsQi] = useState<number | null>(null);

  // Year goals (keyed by year)
  const [yearGoals, setYearGoals] = useState<Record<number, BlockGoals>>(() => {
    const fallback = Date.now();
    const raw = ls<Record<number, BlockGoals>>("lifeCalendar:yearGoals", {});
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        normalizeBlockGoals(value, fallback),
      ]),
    );
  });
  useEffect(() => {
    lsSet("lifeCalendar:yearGoals", yearGoals);
  }, [yearGoals]);
  const [editYearGoals, setEditYearGoals] = useState(false);
  const editGoalsBlock = useMemo(() => {
    if (!editGoalsBlockId) return null;
    for (const q of config.quarters) {
      const b = q.blocks.find((b) => b.id === editGoalsBlockId);
      if (b) return b;
    }
    return null;
  }, [editGoalsBlockId, config]);

  const [settingsQuarter, setSettingsQuarter] = useState<number | null>(null);

  // Week selection for sprint creation
  const [weekSel, setWeekSel] = useState<{
    qi: number;
    anchor: number;
    focus: number;
  } | null>(null);
  const handleWeekLabelClick = (qi: number, qOffset: number) => {
    if (isMobile && hasMobileWindowOpen && !weekSel) {
      closeMobileWindows();
      return;
    }
    setWeekSel((prev) => {
      if (!prev || prev.qi !== qi)
        return { qi, anchor: qOffset, focus: qOffset };
      if (prev.anchor === qOffset && prev.focus === qOffset) return null; // deselect
      return { ...prev, focus: qOffset };
    });
  };
  useEffect(() => {
    if (!weekSel) return;

    const handleOutsideWeekSelection = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(".lc-week-label") ||
        target.closest("[data-week-selection-panel]")
      ) {
        return;
      }
      setWeekSel(null);
      // On mobile this is the first-tap close. Prevent the same tap from
      // opening another calendar action underneath the selection panel.
      if (isMobile) event.stopPropagation();
    };

    const eventName = isMobile ? "click" : "pointerdown";
    document.addEventListener(eventName, handleOutsideWeekSelection, isMobile);
    return () =>
      document.removeEventListener(eventName, handleOutsideWeekSelection, isMobile);
  }, [weekSel, isMobile]);

  // Quarter meta (names + colors)
  const [quarterMeta, setQuarterMeta] = useState<QuarterMeta[]>(() =>
    ls<QuarterMeta[]>("lifeCalendar:quarterMeta", DEFAULT_QUARTER_META),
  );
  useEffect(() => {
    lsSet("lifeCalendar:quarterMeta", quarterMeta);
  }, [quarterMeta]);

  const hasMobileWindowOpen =
    yearPickerOpen ||
    settingsOpen ||
    profileOpen ||
    factoryResetStep > 0 ||
    confirmSignOut ||
    searchOpen ||
    milestonePanelOpen ||
    notesPanelOpen ||
    goalsOpen ||
    lifeCalendarOpen ||
    openNote !== null ||
    editGoalsBlockId !== null ||
    editGoalsQi !== null ||
    editYearGoals ||
    settingsQuarter !== null ||
    weekSel !== null;

  const closeMobileWindows = () => {
    setYearPickerOpen(false);
    setSettingsOpen(false);
    setProfileOpen(false);
    setFactoryResetStep(0);
    setConfirmSignOut(false);
    setSearchOpen(false);
    setSearchQuery("");
    setMilestonePanelOpen(false);
    setNotesPanelOpen(false);
    setGoalsOpen(false);
    setLifeCalendarOpen(false);
    setOpenNote(null);
    setEditGoalsBlockId(null);
    setEditGoalsQi(null);
    setEditYearGoals(false);
    setSettingsQuarter(null);
    setWeekSel(null);
  };

  // On a phone, a tap on another work area first dismisses the currently
  // visible window. The second tap performs the new action. This prevents
  // one tap from both closing one panel and opening another underneath it.
  const runMobileWindowAction = (targetIsOpen: boolean, action: () => void) => {
    if (isMobile && hasMobileWindowOpen && !targetIsOpen) {
      closeMobileWindows();
      return;
    }
    action();
  };

  // ── Google Drive Sync ──────────────────────────────────────────────────────

  /** Build a full snapshot from current React state for upload. */
  const buildSnapshot = useCallback((): AppSnapshot => {
    const now2 = Date.now();
    const stamp = <T extends TimestampFields>(x: T) => withTimestamps(x, now2);

    const snapshotMilestones: SyncMilestone[] = milestones.map((m) => ({
      ...stamp(m),
      id: m.id,
      label: m.label,
      date: m.date,
      color: m.color,
      description: m.description,
      recurring: m.recurring,
      isDeleted: m.isDeleted ?? false,
    }));

    const snapshotNotes: Record<
      string,
      import("./lib/sync-types").SyncNoteEntry[]
    > = {};
    for (const [k, entries] of Object.entries(notes)) {
      snapshotNotes[k] = entries.map((e) => {
        const timestamps = stamp(e);
        return {
          ...timestamps,
          id: e.id,
          text: e.text,
          color: e.color,
          isDeleted: e.isDeleted ?? false,
        };
      });
    }

    const snapshotDayGoals: Record<string, SyncDayGoals> = {};
    for (const [k, g] of Object.entries(dayGoals)) {
      snapshotDayGoals[k] = {
        ...stamp(g),
        count: g.count,
        done: g.done,
        labels: g.labels,
        colors: g.colors,
        isDeleted: g.isDeleted ?? false,
      };
    }

    const snapshotDayTemplates: import("./lib/sync-types").SyncDayTemplate[] =
      dayTemplates.map((dt) => ({
        ...stamp(dt),
        id: dt.id,
        name: dt.name,
        items: dt.items,
        isDeleted: dt.isDeleted ?? false,
      }));

    const snapshotBlockGoals: Record<string, SyncBlockGoals> = {};
    for (const [k, v] of Object.entries(blockGoals)) {
      const block = normalizeBlockGoals(v, now2);
      snapshotBlockGoals[k] = {
        ...stamp(block),
        description: block.description,
        goals: block.goals.map((goal) => ({
          ...stamp(goal),
          id: goal.id,
          text: goal.text,
          done: goal.done,
          color: goal.color,
          isDeleted: goal.isDeleted ?? false,
        })),
        isDeleted: block.isDeleted ?? false,
      };
    }

    const snapshotQuarterGoals: Record<string, SyncBlockGoals> = {};
    for (const [k, v] of Object.entries(quarterGoals)) {
      const block = normalizeBlockGoals(v, now2);
      snapshotQuarterGoals[String(k)] = {
        ...stamp(block),
        description: block.description,
        goals: block.goals.map((goal) => ({
          ...stamp(goal),
          id: goal.id,
          text: goal.text,
          done: goal.done,
          color: goal.color,
          isDeleted: goal.isDeleted ?? false,
        })),
        isDeleted: block.isDeleted ?? false,
      };
    }

    const snapshotYearGoals: Record<string, SyncBlockGoals> = {};
    for (const [k, v] of Object.entries(yearGoals)) {
      const block = normalizeBlockGoals(v, now2);
      snapshotYearGoals[String(k)] = {
        ...stamp(block),
        description: block.description,
        goals: block.goals.map((goal) => ({
          ...stamp(goal),
          id: goal.id,
          text: goal.text,
          done: goal.done,
          color: goal.color,
          isDeleted: goal.isDeleted ?? false,
        })),
        isDeleted: block.isDeleted ?? false,
      };
    }

    // Collect all loaded calendar configs from localStorage
    const snapshotCalendarConfigs: Record<
      string,
      import("./lib/sync-types").SyncCalendarConfig
    > = {};
    for (let y = 2020; y <= 2040; y++) {
      const raw = localStorage.getItem(`lifeCalendar:v1:${y}`);
      if (raw) {
        try {
          const cfg = JSON.parse(raw) as Record<string, unknown>;
          // updatedAt is embedded alongside the CalendarConfig fields by applySnapshot.
          // Strip it out so `data` only contains the actual config (quarters, etc.),
          // matching the shape that Drive stores and snapshotFingerprint compares.
          const {
            createdAt: storedCreatedAt,
            updatedAt: storedUpdatedAt,
            ...dataOnly
          } = cfg;
          const timestamps = withTimestamps(
            {
              createdAt:
                typeof storedCreatedAt === "number"
                  ? storedCreatedAt
                  : undefined,
              updatedAt:
                typeof storedUpdatedAt === "number"
                  ? storedUpdatedAt
                  : undefined,
            },
            now2,
          );
          snapshotCalendarConfigs[String(y)] = {
            data: dataOnly as CalendarConfig,
            ...timestamps,
          };
        } catch {
          /* skip */
        }
      }
    }

    return {
      version: 1,
      exportedAt: now2,
      resetAt: Number(localStorage.getItem("lifeCalendar:resetAt") ?? 0) || 0,
      logoutAt: 0,
      milestones: snapshotMilestones,
      lifeSettings: {
        ...stamp(lifeSettings),
        birthDate: lifeSettings.birthDate,
        lifespan: lifeSettings.lifespan,
      },
      dayGoals: snapshotDayGoals,
      dayTemplates: snapshotDayTemplates,
      notes: snapshotNotes,
      blockGoals: snapshotBlockGoals,
      quarterGoals: snapshotQuarterGoals,
      yearGoals: snapshotYearGoals,
      quarterMeta: (() => {
        const created = Number(
          localStorage.getItem("lifeCalendar:quarterMeta:createdAt"),
        );
        const updated = Number(
          localStorage.getItem("lifeCalendar:quarterMeta:updatedAt"),
        );
        const timestamps = withTimestamps(
          { createdAt: created, updatedAt: updated },
          now2,
        );
        if (!created)
          localStorage.setItem(
            "lifeCalendar:quarterMeta:createdAt",
            String(timestamps.createdAt),
          );
        if (!updated)
          localStorage.setItem(
            "lifeCalendar:quarterMeta:updatedAt",
            String(timestamps.updatedAt),
          );
        return { data: quarterMeta, ...timestamps };
      })(),
      calendarConfigs: snapshotCalendarConfigs,
    };
  }, [
    milestones,
    notes,
    dayGoals,
    dayTemplates,
    blockGoals,
    quarterGoals,
    yearGoals,
    quarterMeta,
    lifeSettings,
  ]);

  /** Apply a merged snapshot from Drive back into React state. */
  const applySnapshot = useCallback(
    (snapshot: AppSnapshot) => {
      // Milestones — retain tombstones locally so a page reload can protect a
      // recent deletion from an older cloud snapshot. Views filter them out.
      const stateFallback = Date.now();
      const localResetAt =
        Number(localStorage.getItem("lifeCalendar:resetAt") ?? 0) || 0;
      const isFactoryResetSnapshot = (snapshot.resetAt ?? 0) > localResetAt;

      if (isFactoryResetSnapshot) {
        // A factory reset is authoritative across devices. Remove local
        // year-specific configs that are absent from the empty snapshot.
        for (let y = 2020; y <= 2040; y++) {
          localStorage.removeItem(`lifeCalendar:v1:${y}`);
        }
      }

      const ms = (snapshot.milestones as Milestone[]).map((item) =>
        normalizeMilestone(item, stateFallback),
      );
      setMilestones(ms);
      lsSet("lifeCalendar:milestones", ms);

      // Life settings
      const normalizedLifeSettings = normalizeLifeSettings(
        snapshot.lifeSettings,
        stateFallback,
      );
      setLifeSettings(normalizedLifeSettings);
      lsSet("lifeCalendar:lifeSettings", normalizedLifeSettings);

      // Day goals
      const dg: Record<string, DayGoals> = {};
      for (const [k, v] of Object.entries(snapshot.dayGoals))
        dg[k] = normalizeDayGoals(v, stateFallback);
      setDayGoals(dg);
      lsSet("lifeCalendar:dayGoals", dg);

      // Day templates
      const dt = (snapshot.dayTemplates as DayTemplate[]).map((t) =>
        normalizeDayTemplate(t, stateFallback),
      );
      setDayTemplates(dt);
      lsSet("lifeCalendar:dayTemplates", dt);

      // Notes — retain deleted entries as tombstones for future conflict-safe sync.
      const mergedNotes: Record<string, NoteEntry[]> = {};
      for (const [k, entries] of Object.entries(snapshot.notes)) {
        const normalized = (entries as NoteEntry[])
          .map((e) => normalizeNote(e, stateFallback))
          .filter((e) => e.isDeleted || e.text.trim());
        if (normalized.length) mergedNotes[k] = normalized;
      }
      setNotes(mergedNotes);
      lsSet("lifeCalendar:notes", mergedNotes);

      // Block / quarter / year goals
      const bg: Record<string, BlockGoals> = {};
      for (const [k, v] of Object.entries(snapshot.blockGoals))
        bg[k] = normalizeBlockGoals(v, stateFallback);
      setBlockGoals(bg);
      lsSet("lifeCalendar:goals", bg);

      const qg: Record<number, BlockGoals> = {};
      for (const [k, v] of Object.entries(snapshot.quarterGoals))
        qg[Number(k)] = normalizeBlockGoals(v, stateFallback);
      setQuarterGoals(qg);
      lsSet("lifeCalendar:quarterGoals", qg);

      const yg: Record<number, BlockGoals> = {};
      for (const [k, v] of Object.entries(snapshot.yearGoals))
        yg[Number(k)] = normalizeBlockGoals(v, stateFallback);
      setYearGoals(yg);
      lsSet("lifeCalendar:yearGoals", yg);

      // Quarter meta — also persist the updatedAt so buildSnapshot can read it
      // back without falling back to Date.now() (which breaks the fingerprint).
      if (snapshot.quarterMeta?.data) {
        const qm = snapshot.quarterMeta.data as QuarterMeta[];
        if (Array.isArray(qm) && qm.length === 4) {
          setQuarterMeta(qm);
          lsSet("lifeCalendar:quarterMeta", qm);
          if (snapshot.quarterMeta.createdAt) {
            localStorage.setItem(
              "lifeCalendar:quarterMeta:createdAt",
              String(snapshot.quarterMeta.createdAt),
            );
          }
          if (snapshot.quarterMeta.updatedAt) {
            localStorage.setItem(
              "lifeCalendar:quarterMeta:updatedAt",
              String(snapshot.quarterMeta.updatedAt),
            );
          }
        }
      } else if (isFactoryResetSnapshot) {
        setQuarterMeta(DEFAULT_QUARTER_META);
        lsSet("lifeCalendar:quarterMeta", DEFAULT_QUARTER_META);
        localStorage.removeItem("lifeCalendar:quarterMeta:createdAt");
        localStorage.removeItem("lifeCalendar:quarterMeta:updatedAt");
      }

      // Calendar configs — embed updatedAt inside the stored object so buildSnapshot
      // can read it back and produce a stable fingerprint (prevents sync loop).
      for (const [yr, cfg] of Object.entries(snapshot.calendarConfigs)) {
        if (cfg?.data) {
          localStorage.setItem(
            `lifeCalendar:v1:${yr}`,
            JSON.stringify({
              ...cfg.data,
              createdAt: cfg.createdAt,
              updatedAt: cfg.updatedAt,
            }),
          );
        }
      }
      localStorage.setItem(
        "lifeCalendar:resetAt",
        String(snapshot.resetAt ?? 0),
      );
      // Reload config for current viewYear
      setConfig(loadConfig(viewYear));
    },
    [viewYear],
  );

  // Wire up sync engine
  const {
    syncStatus,
    syncActivity,
    userInfo,
    signIn: googleSignIn,
    signOut: googleSignOut,
    resetCloudData,
    triggerSync,
    markDirty,
  } = useSyncEngine({
    applySnapshot,
    getLocalSnapshot: buildSnapshot,
  });

  // Notify sync engine of any state change (debounced inside the hook)
  const syncDirtyRef = useRef(0);
  useEffect(() => {
    syncDirtyRef.current++;
    if (syncDirtyRef.current <= 1) return; // skip initial mount
    markDirty(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    milestones,
    notes,
    dayGoals,
    dayTemplates,
    blockGoals,
    quarterGoals,
    yearGoals,
    quarterMeta,
    lifeSettings,
    config,
  ]);

  // ── Sync status label helper ──────────────────────────────────────────────

  const syncLabel = useMemo(() => {
    if (syncStatus === "synced") return t("syncSynced");
    if (syncStatus === "syncing") return t("syncSyncing");
    if (syncStatus === "uploading") return t("syncUploading");
    if (syncStatus === "error") return t("syncError");
    return t("syncNow");
  }, [syncStatus, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncColor = useMemo(() => {
    if (syncStatus === "error") return "#ff3b30";
    if (syncStatus === "synced") return "#34c759";
    if (syncStatus === "syncing" || syncStatus === "uploading")
      return "#ff9500";
    return "var(--text-secondary)";
  }, [syncStatus]);

  // The gear is quiet during no-op background polls, but reports real Drive
  // activity when a remote device changed the shared calendar.
  const gearSyncColor = useMemo(() => {
    if (!userInfo) return "var(--text-secondary)";
    if (syncStatus === "error") return "#ff3b30";
    if (syncActivity === "downloading" || syncActivity === "uploading")
      return "#ff9500";
    return "#34c759";
  }, [syncActivity, syncStatus, userInfo]);

  // Q4 may need 14 weeks when the year's Dec 31 falls after week 52 ends.
  const q4Weeks = useMemo(
    () => gridWeeksForYear(viewYear) - 3 * WEEKS_PER_QUARTER,
    [viewYear],
  );

  // Calendar data — extend to cover the Sunday of the week containing Dec 31,
  // mirroring how Q1 already shows cross-year days from the previous year.
  const weeks = useMemo(() => {
    const first = startOfWeekMonday(startOfYear(viewYear));
    const numWeeks = gridWeeksForYear(viewYear);
    return Array.from({ length: numWeeks }, (_, i) => {
      const weekStart = addDays(first, i * 7);
      return {
        weekStart,
        days: Array.from({ length: 7 }, (_, j) => addDays(weekStart, j)),
      };
    });
  }, [viewYear]);

  const yearProgress = useMemo(() => {
    const s = startOfYear(viewYear).getTime(),
      e = startOfNextYear(viewYear).getTime();
    return Math.max(0, Math.min(100, ((now.getTime() - s) / (e - s)) * 100));
  }, [now, viewYear]);

  const todayProgress = useMemo(() => {
    const s = startOfDay(now).getTime();
    return Math.max(0, Math.min(100, ((now.getTime() - s) / 86_400_000) * 100));
  }, [now]);

  const today = startOfDay(now);

  const currentWeekIndex = useMemo(
    () => weeks.findIndex(({ days }) => days.some((d) => sameDay(d, today))),
    [weeks, today],
  );

  const daysCompleted = useMemo(() => {
    let n = 0;
    for (const { days } of weeks)
      for (const d of days) if (d.getFullYear() === viewYear && d < today) n++;
    return n;
  }, [weeks, today, viewYear]);
  const totalDays =
    (startOfNextYear(viewYear).getTime() - startOfYear(viewYear).getTime()) /
    86_400_000;

  const milestonesMap = useMemo(() => {
    const m: Record<string, Milestone[]> = {};
    for (const ms of activeMilestones) {
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
    for (const ms of activeMilestones) {
      if (ms.recurring) {
        const parts = ms.date.split("-");
        for (const yr of [thisYear, thisYear + 1]) {
          const key = `${yr}-${parts[1]}-${parts[2]}`;
          if (key >= todayStr) {
            list.push({ ...ms, date: key });
            break;
          }
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
      if (entries.some((e) => e.text.toLowerCase().includes(q)))
        result.add(key);
    }
    for (const ms of activeMilestones) {
      const matchLabel = ms.label.toLowerCase().includes(q);
      const matchDesc = ms.description?.toLowerCase().includes(q) ?? false;
      if (matchLabel || matchDesc) result.add(ms.date);
    }
    return result;
  }, [searchQuery, notes, milestones]);

  const matchedDatesArray = useMemo(
    () => Array.from(matchedDates).sort(),
    [matchedDates],
  );
  const [searchIndex, setSearchIndex] = useState(0);
  useEffect(() => {
    setSearchIndex(0);
  }, [matchedDatesArray]);

  const scrollToMatch = React.useCallback(
    (idx: number) => {
      const key = matchedDatesArray[idx];
      if (!key) return;
      const el = document.querySelector<HTMLElement>(`[data-datekey="${key}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.animate(
          [
            {
              boxShadow: "0 0 0 4px #ff9f0a, 0 0 20px 6px rgba(255,159,10,0.6)",
            },
            {
              boxShadow: "0 0 0 2px #ff9f0a, 0 0 8px 2px rgba(255,159,10,0.45)",
            },
          ],
          { duration: 600, easing: "ease-out" },
        );
      }
    },
    [matchedDatesArray],
  );

  const navigateMatch = React.useCallback(
    (dir: 1 | -1) => {
      if (!matchedDatesArray.length) return;
      const next =
        (searchIndex + dir + matchedDatesArray.length) %
        matchedDatesArray.length;
      setSearchIndex(next);
      scrollToMatch(next);
    },
    [searchIndex, matchedDatesArray, scrollToMatch],
  );

  const parsedJumpDate = useMemo(() => {
    if (matchedDatesArray.length > 0) return null;
    return parseDateQuery(searchQuery);
  }, [searchQuery, matchedDatesArray.length]);

  const scrollToDateKey = React.useCallback((key: string) => {
    const el = document.querySelector<HTMLElement>(`[data-datekey="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate(
        [
          { boxShadow: "0 0 0 4px #30d158, 0 0 20px 6px rgba(48,209,88,0.6)" },
          { boxShadow: "0 0 0 2px #30d158, 0 0 8px 2px rgba(48,209,88,0.3)" },
        ],
        { duration: 700, easing: "ease-out" },
      );
    }
  }, []);

  const weekRefs = useRef<Array<HTMLDivElement | null>>([]);
  const calendarScrollRef = useRef<HTMLElement | null>(null);
  const didScrollRef = useRef(false);
  useEffect(() => {
    didScrollRef.current = false;
  }, [viewYear]);

  // When paging to a year other than the current one, start at the first week instead of
  // keeping whatever scroll offset the previous year was left at.
  useEffect(() => {
    if (viewYear !== now.getFullYear())
      calendarScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [viewYear]);

  useEffect(() => {
    if (
      didScrollRef.current ||
      currentWeekIndex < 0 ||
      viewYear !== now.getFullYear()
    )
      return;
    const el = weekRefs.current[currentWeekIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      didScrollRef.current = true;
    }
  }, [currentWeekIndex, viewYear]);

  const [showTodayBtn, setShowTodayBtn] = useState(false);
  const scrollToToday = () => {
    if (viewYear !== now.getFullYear()) {
      setViewYear(now.getFullYear());
    } else {
      weekRefs.current[currentWeekIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };
  useEffect(() => {
    if (viewYear !== now.getFullYear()) {
      setShowTodayBtn(true);
      return;
    }
    if (currentWeekIndex < 0) {
      setShowTodayBtn(false);
      return;
    }
    const el = weekRefs.current[currentWeekIndex];
    if (!el) {
      setShowTodayBtn(false);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => setShowTodayBtn(!e!.isIntersecting),
      { root: calendarScrollRef.current, threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [viewYear, currentWeekIndex]);

  const dayState = (d: Date): DayState => {
    if (d.getFullYear() !== viewYear) return "out";
    if (sameDay(d, today)) return "today";
    if (d < today) return "past";
    return "future";
  };

  const updateQuarter = (qi: number, next: QuarterConfig) =>
    setConfig((prev) => {
      const q = prev.quarters.slice();
      q[qi] = next;
      return {
        ...withTimestamps(prev),
        createdAt: prev.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        quarters: q,
      };
    });
  const updateBlockLabel = (qi: number, blockId: string, label: string) =>
    setConfig((prev) => {
      const q = prev.quarters.slice();
      q[qi] = {
        blocks: q[qi]!.blocks.map((b) =>
          b.id === blockId ? { ...b, label } : b,
        ),
      };
      return {
        ...withTimestamps(prev),
        createdAt: prev.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        quarters: q,
      };
    });
  const toggleGoal = (blockId: string, goalId: string) =>
    setBlockGoals((prev) => {
      const bg = prev[blockId];
      if (!bg) return prev;
      const updated = bg.goals.map((g) =>
        g.id === goalId ? { ...g, done: !g.done } : g,
      );
      const active = updated.filter((g) => !g.isDeleted && g.text.trim());
      if (active.every((g) => g.done) && active.length > 0)
        setTimeout(fireConfettiCannons, 80);
      return {
        ...prev,
        [blockId]: updateBlockGoals(bg, { ...bg, goals: updated }),
      };
    });
  const toggleQuarterGoal = (qi: number, goalId: string) =>
    setQuarterGoals((prev) => {
      const bg = prev[qi] ?? { description: "", goals: [] };
      const updated = bg.goals.map((g) =>
        g.id === goalId ? { ...g, done: !g.done } : g,
      );
      const active = updated.filter((g) => !g.isDeleted && g.text.trim());
      if (active.every((g) => g.done) && active.length > 0)
        setTimeout(fireConfettiCannons, 80);
      return {
        ...prev,
        [qi]: updateBlockGoals(prev[qi], { ...bg, goals: updated }),
      };
    });
  const toggleYearGoal = (year: number, goalId: string) =>
    setYearGoals((prev) => {
      const bg = prev[year] ?? { description: "", goals: [] };
      const updated = bg.goals.map((g) =>
        g.id === goalId ? { ...g, done: !g.done } : g,
      );
      const active = updated.filter((g) => !g.isDeleted && g.text.trim());
      if (active.every((g) => g.done) && active.length > 0)
        setTimeout(fireConfettiCannons, 80);
      return {
        ...prev,
        [year]: updateBlockGoals(prev[year], { ...bg, goals: updated }),
      };
    });

  // Resolved quarters (color + label derived from meta)
  const resolvedQuarters = useMemo(
    () => quarterMeta.map((m) => resolveQuarter(m, dark)),
    [quarterMeta, dark],
  );

  // Accent colour for the goals modal border — block's own colour if set, else the quarter's fill
  const editGoalsAccentColor = useMemo(() => {
    if (!editGoalsBlockId) return undefined;
    const qi = config.quarters.findIndex((q) =>
      q.blocks.some((b) => b.id === editGoalsBlockId),
    );
    if (qi < 0) return undefined;
    const block = config.quarters[qi]!.blocks.find(
      (b) => b.id === editGoalsBlockId,
    );
    if (block?.color) {
      const ac = APPLE_COLORS.find((c) => c.key === block.color);
      if (ac) return dark ? ac.dark : ac.light;
    }
    return resolvedQuarters[qi]?.border;
  }, [editGoalsBlockId, config, resolvedQuarters, dark]);

  const updateQuarterMeta = (qi: number, patch: Partial<QuarterMeta>) => {
    const changedAt = Date.now();
    setQuarterMeta((prev) =>
      prev.map((m, i) => (i === qi ? { ...m, ...patch } : m)),
    );
    if (!localStorage.getItem("lifeCalendar:quarterMeta:createdAt")) {
      localStorage.setItem(
        "lifeCalendar:quarterMeta:createdAt",
        String(changedAt),
      );
    }
    localStorage.setItem(
      "lifeCalendar:quarterMeta:updatedAt",
      String(changedAt),
    );
  };

  // Theme-dependent surface values
  const headerBg = dark ? "rgba(22,22,24,0.90)" : "rgba(245,245,247,0.88)";
  const cardBg = dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)";
  const modalBg = dark ? "rgba(30,30,32,0.96)" : "rgba(255,255,255,0.93)";
  const overlayBg = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  return (
    <LangContext.Provider value={{ t, months, weekdays, lang }}>
      <div
        className="fixed inset-0 flex h-screen h-[100dvh] w-full flex-col overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50 w-full shrink-0 touch-none"
          style={{
            background: headerBg,
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <div className="mx-auto max-w-3xl px-3 sm:px-8 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-1.5"
                ref={yearPickerRef}
                style={{ position: "relative" }}
              >
                <button
                  onClick={() =>
                    runMobileWindowAction(yearPickerOpen, () =>
                      setYearPickerOpen((o) => !o),
                    )
                  }
                  style={{
                    background: "none",
                    border: "none",
                    padding: "0 2px",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  <h1
                    className="text-2xl sm:text-3xl font-semibold tabular-nums"
                    style={{
                      color: "var(--text)",
                      letterSpacing: "-0.02em",
                      minWidth: "3.2ch",
                      textAlign: "center",
                      textDecoration: yearPickerOpen
                        ? "underline var(--text-tertiary)"
                        : "none",
                      textUnderlineOffset: 4,
                    }}
                  >
                    {viewYear}
                  </h1>
                </button>
                {yearPickerOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: dark
                        ? "rgba(30,30,32,0.97)"
                        : "rgba(255,255,255,0.97)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: 12,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                      padding: "6px 4px",
                      zIndex: 200,
                      minWidth: 80,
                      maxHeight: 260,
                      overflowY: "auto",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                    }}
                  >
                    {Array.from(
                      { length: MAX_YEAR - MIN_YEAR + 1 },
                      (_, i) => MIN_YEAR + i,
                    ).map((y) => (
                      <button
                        key={y}
                        onClick={() => {
                          setViewYear(y);
                          setYearPickerOpen(false);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "6px 16px",
                          borderRadius: 8,
                          border: "none",
                          background:
                            y === viewYear ? "rgba(0,122,255,0.15)" : "none",
                          color:
                            y === viewYear
                              ? "#007aff"
                              : y === now.getFullYear()
                                ? "var(--text)"
                                : "var(--text-secondary)",
                          fontWeight:
                            y === viewYear
                              ? 600
                              : y === now.getFullYear()
                                ? 500
                                : 400,
                          fontSize: 15,
                          cursor: "pointer",
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <div ref={searchBtnRef}>
                  <IconButton
                    title={t("search")}
                    onClick={() => {
                      runMobileWindowAction(searchOpen, () => {
                        setSearchOpen((o) => !o);
                        setSearchQuery("");
                      });
                    }}
                    bg={searchOpen ? "rgba(0,122,255,0.15)" : overlayBg}
                  >
                    <SearchIcon />
                  </IconButton>
                </div>
                <div
                  style={{
                    width: 1,
                    height: 16,
                    background: "var(--border-soft)",
                    flexShrink: 0,
                    margin: "0 2px",
                  }}
                />
                <IconButton
                  title={t("allGoals")}
                  onClick={() =>
                    runMobileWindowAction(goalsOpen, () =>
                      setGoalsOpen((o) => !o),
                    )
                  }
                  bg={goalsOpen ? "rgba(52,199,89,0.15)" : overlayBg}
                >
                  <GoalsIcon />
                </IconButton>
                <IconButton
                  title={t("notesPanel")}
                  onClick={() =>
                    runMobileWindowAction(notesPanelOpen, () =>
                      setNotesPanelOpen(true),
                    )
                  }
                  bg={overlayBg}
                >
                  <NotesIcon />
                </IconButton>
                <IconButton
                  title={t("milestones")}
                  onClick={() =>
                    runMobileWindowAction(milestonePanelOpen, () =>
                      setMilestonePanelOpen(true),
                    )
                  }
                  bg={overlayBg}
                >
                  <FlagIcon />
                </IconButton>
                <div
                  style={{
                    width: 1,
                    height: 16,
                    background: "var(--border-soft)",
                    flexShrink: 0,
                    margin: "0 2px",
                  }}
                />
                <div className="flex">
                  <IconButton
                    title={t("lifeCalendarBtn")}
                    onClick={() =>
                      runMobileWindowAction(lifeCalendarOpen, () =>
                        setLifeCalendarOpen(true),
                      )
                    }
                    bg={overlayBg}
                  >
                    <LifeIcon />
                  </IconButton>
                </div>
                {false && (
                  <React.Fragment>
                    {/* ── Google Drive Sync ────────────────────────────── */}
                    {userInfo ? (
                      <div ref={profileRef} style={{ position: "relative" }}>
                        <button
                          type="button"
                          title={`${userInfo!.name} — ${t("googleProfile")}`}
                          aria-label={`${userInfo!.name} — ${t("googleProfile")}`}
                          aria-expanded={profileOpen}
                          onClick={() => {
                            setProfileOpen((o) => !o);
                            setSettingsOpen(false);
                          }}
                          style={{
                            position: "relative",
                            width: 30,
                            height: 30,
                            borderRadius: 999,
                            border: "none",
                            boxShadow: "inset 0 0 0 1.5px var(--border-soft)",
                            overflow: "visible",
                            cursor: "pointer",
                            padding: 0,
                            background: "var(--bg-secondary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {userInfo!.picture ? (
                            <img
                              src={userInfo!.picture}
                              alt=""
                              width={30}
                              height={30}
                              style={{
                                display: "block",
                                width: 30,
                                height: 30,
                                borderRadius: "inherit",
                                objectFit: "cover",
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {userInfo!.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              right: -1,
                              bottom: -1,
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: syncColor,
                              boxShadow: "0 0 0 2px var(--bg)",
                            }}
                          />
                        </button>
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            right: 0,
                            zIndex: 50,
                          }}
                        >
                          <AnimatePresence>
                            {profileOpen && (
                              <motion.div
                                key="profile-menu"
                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 380,
                                  damping: 28,
                                }}
                                style={{
                                  width: 228,
                                  background: modalBg,
                                  backdropFilter: "blur(20px)",
                                  WebkitBackdropFilter: "blur(20px)",
                                  borderRadius: 12,
                                  padding: "8px",
                                  boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                                  border: "none",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                }}
                              >
                                <div
                                  style={{
                                    padding: "4px 6px 6px",
                                    minWidth: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: "var(--text-tertiary)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    {t("googleProfile")}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text)",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {userInfo!.email}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                    padding: "7px 8px",
                                    borderRadius: 8,
                                    background: overlayBg,
                                    color: syncColor,
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  <span
                                    aria-hidden="true"
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: 999,
                                      background: syncColor,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>{syncLabel}</span>
                                </div>
                                <div
                                  style={{
                                    height: 1,
                                    background: "var(--border-soft)",
                                    margin: "1px 2px",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProfileOpen(false);
                                    setConfirmSignOut(true);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: "transparent",
                                    color: "#ff3b30",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    textAlign: "left",
                                  }}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M10 17l5-5-5-5" />
                                    <path d="M15 12H3" />
                                    <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
                                  </svg>
                                  {t("signOutAccount")}
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title={t("signInGoogle")}
                        onClick={() => void googleSignIn()}
                        aria-label={t("signInGoogle")}
                        style={{
                          width: 30,
                          height: 30,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          borderRadius: 8,
                          border: "none",
                          boxShadow: "0 0 0 1px var(--border-soft)",
                          background: overlayBg,
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: 1.2,
                        }}
                      >
                        {/* Google "G" logo */}
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          style={{ flexShrink: 0 }}
                        >
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                      </button>
                    )}
                  </React.Fragment>
                )}
                <div
                  style={{
                    width: 1,
                    height: 16,
                    background: "var(--border-soft)",
                    flexShrink: 0,
                  }}
                />
                {/* Settings gear */}
                <div ref={settingsRef} style={{ position: "relative" }}>
                  <IconButton
                    title={t("settings")}
                    onClick={() => {
                      runMobileWindowAction(settingsOpen, () => {
                        if (settingsOpen) setProfileOpen(false);
                        setSettingsOpen((o) => !o);
                      });
                    }}
                    bg={settingsOpen ? "rgba(0,122,255,0.13)" : overlayBg}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        transition:
                          "transform 320ms cubic-bezier(0.34,1.56,0.64,1)",
                        transform: settingsOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      <GearIcon />
                    </span>
                    <span
                      aria-hidden="true"
                      title={syncLabel}
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: gearSyncColor,
                        boxShadow: "0 0 0 2px var(--bg)",
                        pointerEvents: "none",
                      }}
                    />
                  </IconButton>
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 50,
                    }}
                  >
                    <AnimatePresence>
                      {settingsOpen && (
                        <motion.div
                          key="settings-menu"
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 28,
                          }}
                          className="lc-settings-panel"
                          style={{
                            position: "relative",
                            boxSizing: "border-box",
                            background: dark
                              ? "rgb(28,28,30)"
                              : "rgb(255,255,255)",
                            borderRadius: 12,
                            padding: "4px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                            border: "1px solid var(--border-soft)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            width: 40,
                          }}
                        >
                          {/* Google Drive — first shared settings control */}
                          <IconButton
                            title={
                              userInfo
                                ? `${userInfo.name} — ${t("googleProfile")}`
                                : t("signInGoogle")
                            }
                            aria-expanded={userInfo ? profileOpen : undefined}
                            onClick={() => {
                              if (userInfo) setProfileOpen((o) => !o);
                              else {
                                setSettingsOpen(false);
                                void googleSignIn();
                              }
                            }}
                            bg={dark ? "rgb(44,44,46)" : "rgb(232,232,237)"}
                          >
                            {userInfo?.picture ? (
                              <img
                                src={userInfo.picture}
                                alt=""
                                width={18}
                                height={18}
                                style={{
                                  display: "block",
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : userInfo ? (
                              <span
                                style={{
                                  width: 15,
                                  height: 15,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 15,
                                  lineHeight: 1,
                                  fontWeight: 700,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {userInfo.name.charAt(0).toUpperCase()}
                              </span>
                            ) : (
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                style={{ flexShrink: 0 }}
                              >
                                <path
                                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                  fill="#4285F4"
                                />
                                <path
                                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                  fill="#34A853"
                                />
                                <path
                                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                  fill="#FBBC05"
                                />
                                <path
                                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                  fill="#EA4335"
                                />
                              </svg>
                            )}
                          </IconButton>
                          {userInfo && profileOpen && (
                            <motion.div
                              initial={{ opacity: 0, x: -6, scale: 0.98 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -6, scale: 0.98 }}
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 28,
                              }}
                              style={{
                                position: "absolute",
                                top: 4,
                                ...(isMobile
                                  ? { right: "calc(100% + 8px)" }
                                  : { left: "calc(100% + 8px)" }),
                                width: "max-content",
                                maxWidth: "min(280px, calc(100vw - 32px))",
                                padding: "8px",
                                background: dark
                                  ? "rgb(28,28,30)"
                                  : "rgb(255,255,255)",
                                borderRadius: 12,
                                boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                                border: "1px solid var(--border-soft)",
                                zIndex: 2,
                              }}
                            >
                              <div style={{ padding: "0 2px", minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "var(--text-tertiary)",
                                    marginBottom: 3,
                                  }}
                                >
                                  {t("googleProfile")}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--text)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {userInfo.email}
                                </div>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 7,
                                  marginTop: 7,
                                  padding: "7px 8px",
                                  borderRadius: 8,
                                  background: dark
                                    ? "rgb(44,44,46)"
                                    : "rgb(232,232,237)",
                                  color: syncColor,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                <span
                                  aria-hidden="true"
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 999,
                                    background: syncColor,
                                    flexShrink: 0,
                                  }}
                                />
                                <span>{syncLabel}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setProfileOpen(false);
                                  setSettingsOpen(false);
                                  setConfirmSignOut(true);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 7,
                                  width: "100%",
                                  marginTop: 6,
                                  padding: "7px 8px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: "transparent",
                                  color: "#ff3b30",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  textAlign: "left",
                                }}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M10 17l5-5-5-5" />
                                  <path d="M15 12H3" />
                                  <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
                                </svg>
                                {t("signOutAccount")}
                              </button>
                            </motion.div>
                          )}
                          <IconButton
                            title={dark ? t("lightMode") : t("darkMode")}
                            onClick={() => setDark((d) => !d)}
                            bg={dark ? "rgb(44,44,46)" : "rgb(232,232,237)"}
                          >
                            {dark ? <SunIcon /> : <MoonIcon />}
                          </IconButton>
                          <IconButton
                            title={
                              lang === "en"
                                ? t("switchToRussian")
                                : t("switchToEnglish")
                            }
                            onClick={() =>
                              setLang((l) => (l === "en" ? "ru" : "en"))
                            }
                            bg={dark ? "rgb(44,44,46)" : "rgb(232,232,237)"}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                                lineHeight: 1,
                              }}
                            >
                              {lang === "en" ? "RU" : "EN"}
                            </span>
                          </IconButton>
                          <div
                            style={{
                              height: 1,
                              background: "var(--border-soft)",
                              margin: "1px 2px",
                            }}
                          />
                          <IconButton
                            title={t("factoryReset")}
                            onClick={() => {
                              setFactoryResetStep(1);
                              setSettingsOpen(false);
                            }}
                            bg={dark ? "rgb(44,44,46)" : "rgb(232,232,237)"}
                            color="#ff3b30"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="1 4 1 10 7 10" />
                              <path d="M3.51 15a9 9 0 1 0 .49-5" />
                            </svg>
                          </IconButton>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="mt-3 h-1.5 w-full overflow-hidden"
              style={{ background: "var(--border-soft)", borderRadius: 999 }}
            >
              <div
                className="h-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${yearProgress}%`,
                  background: "#34c759",
                  borderRadius: 999,
                }}
              />
            </div>

            <div
              className="mt-2 flex items-center justify-between text-xs tabular-nums"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>
                {daysCompleted} {t("of")} {totalDays} {t("daysOf")}
              </span>
              <span>
                {yearProgress.toFixed(1)}% {t("complete")}
              </span>
              <span>
                {(totalDays - daysCompleted).toFixed(0)} {t("daysRemaining")}
              </span>
            </div>

            {/* Milestone countdown — up to 20 upcoming */}
            <AnimatePresence>
              {nextMilestones.length > 0 && (
                <motion.div
                  key="ms-countdown"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5"
                  style={{ scrollbarWidth: "none" }}
                >
                  {nextMilestones.map((ms) => {
                    const [y2, m2, d2] = ms.date.split("-").map(Number) as [
                      number,
                      number,
                      number,
                    ];
                    const days = daysBetween(today, new Date(y2, m2 - 1, d2));
                    const ec = getEventColors(ms.color, dark);
                    const msColBg = ec.bg;
                    const msColBdr = ec.borderEditing;
                    const msColTxt =
                      dark && ec.border === "#ffffff"
                        ? "#ffffff"
                        : !dark && ec.border === "#000000"
                          ? "#000000"
                          : ec.textTitle;
                    const msColDot = ec.marker;
                    return (
                      <button
                        key={ms.id}
                        onClick={() =>
                          runMobileWindowAction(
                            milestonePanelOpen,
                            () => setMilestonePanelOpen(true),
                          )
                        }
                        className="h-7 inline-flex items-center justify-center gap-1.5 px-3 rounded-full text-[11px] font-medium shrink-0 box-border"
                        style={{
                          background: "transparent",
                          border: `1.5px solid ${ec.border || "transparent"}`,
                          color: msColTxt,
                          cursor: "pointer",
                        }}
                      >
                        <span className="font-semibold">{ms.label}</span>
                        <span style={{ opacity: 0.65 }}>·</span>
                        <span>
                          {days === 0
                            ? t("todayCountdown")
                            : `${days}${t("daysShort")}`}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search bar */}
            <div
              ref={searchBarRef}
              style={
                isMobile
                  ? {
                      position: "relative",
                      height: searchOpen ? 52 : 0,
                      overflow: "visible",
                    }
                  : undefined
              }
            >
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    key="search-bar"
                    initial={
                      isMobile
                        ? { opacity: 0, y: -8 }
                        : { opacity: 0, height: 0, marginTop: 0 }
                    }
                    animate={
                      isMobile
                        ? { opacity: 1, y: 0 }
                        : { opacity: 1, height: "auto", marginTop: 10 }
                    }
                    exit={
                      isMobile
                        ? { opacity: 0, y: -8 }
                        : { opacity: 0, height: 0, marginTop: 0 }
                    }
                    transition={
                      isMobile
                        ? {
                            type: "spring",
                            stiffness: 400,
                            damping: 35,
                          }
                        : { duration: 0.2, ease: "easeInOut" }
                    }
                    className={isMobile ? "transform-gpu will-change-transform" : undefined}
                    style={{
                      ...(isMobile
                        ? {
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            marginTop: 10,
                            WebkitTapHighlightColor: "transparent",
                          }
                        : {
                            overflow: "hidden",
                            willChange: "height, opacity",
                          }),
                    }}
                  >
                    <div className="relative flex items-center">
                      <div
                        style={{
                          position: "absolute",
                          left: 10,
                          color: "var(--text-tertiary)",
                          pointerEvents: "none",
                          display: "flex",
                        }}
                      >
                        <SearchIcon />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setSearchOpen(false);
                            setSearchQuery("");
                          }
                          if (e.key === "Enter") {
                            if (parsedJumpDate) {
                              scrollToDateKey(dateKey(parsedJumpDate));
                            } else {
                              e.shiftKey ? navigateMatch(-1) : navigateMatch(1);
                            }
                          }
                        }}
                        placeholder={t("searchPlaceholder")}
                        style={{
                          width: "100%",
                          paddingLeft: 34,
                          paddingRight:
                            matchedDatesArray.length > 0
                              ? 112
                              : parsedJumpDate
                                ? 180
                                : 34,
                          paddingTop: 8,
                          paddingBottom: 8,
                          ...(isMobile
                            ? {
                                height: 42,
                                paddingTop: 9,
                                paddingBottom: 9,
                                lineHeight: "22px",
                              }
                            : {}),
                          borderRadius: 10,
                          background: dark
                            ? "rgba(255,255,255,0.07)"
                            : "rgba(0,0,0,0.05)",
                          border: "1px solid var(--border-soft)",
                          color: "var(--text)",
                          fontSize: isMobile ? 16 : 13,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                      {searchQuery.trim() && (
                        <div
                          style={{
                            position: "absolute",
                            right: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {matchedDatesArray.length > 0 ? (
                            <>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-tertiary)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {searchIndex + 1} {t("of")}{" "}
                                {matchedDatesArray.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => navigateMatch(-1)}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 5,
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-secondary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  padding: 0,
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => navigateMatch(1)}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 5,
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-secondary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  padding: 0,
                                }}
                              >
                                ↓
                              </button>
                            </>
                          ) : parsedJumpDate ? (
                            <button
                              type="button"
                              onClick={() =>
                                scrollToDateKey(dateKey(parsedJumpDate))
                              }
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                paddingLeft: 8,
                                paddingRight: 8,
                                paddingTop: 3,
                                paddingBottom: 3,
                                borderRadius: 7,
                                background: dark
                                  ? "rgba(48,209,88,0.15)"
                                  : "rgba(48,209,88,0.12)",
                                border: "1px solid rgba(48,209,88,0.35)",
                                cursor: "pointer",
                                color: "#30d158",
                                fontSize: 11,
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                fontFamily: "inherit",
                              }}
                            >
                              <span style={{ fontSize: 12 }}>↵</span>
                              {t("jumpTo")} {parsedJumpDate.getDate()}{" "}
                              {MONTHS_I18N[lang][parsedJumpDate.getMonth()]}{" "}
                              {parsedJumpDate.getFullYear()}
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t("searchNoResults")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sticky weekday labels */}
            <div className="mt-3 px-[13px] sm:px-[21px] flex flex-row items-center">
              <div className="lc-side-col" />
              <div
                className="grid grid-cols-7 gap-1 sm:gap-3"
                style={{ flex: 1, minWidth: 0 }}
              >
                {weekdays.map((w, i) => (
                  <div
                    key={i}
                    className="text-center text-[10px] sm:text-[15px] font-medium tracking-widest uppercase"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="lc-side-col" />
            </div>
          </div>
        </header>

        <main
          ref={calendarScrollRef}
          className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="mx-auto max-w-3xl px-3 py-4 sm:px-8 sm:py-8">
            <LayoutGroup>
              <div className="flex flex-col gap-3 sm:gap-6">
              {[0, 1, 2, 3].map((qi) => {
                const quarter = resolvedQuarters[qi]!;
                const meta = quarterMeta[qi]!;
                const qWeeksCount = qi === 3 ? q4Weeks : WEEKS_PER_QUARTER;
                const startIndex = qi * WEEKS_PER_QUARTER;
                const qConfig = config.quarters[qi]!;

                // Quarter day counters: count grid cells that belong to the current year.
                // Q1 may start with a few days from the previous year (grid begins on the
                // Monday before Jan 1), and Q4 may end with a few days from the next year
                // (the 53rd week completes the last partial week of Dec). Filtering to
                // viewYear gives the actual cells the user sees for this year.
                const qWeeks = weeks.slice(
                  startIndex,
                  startIndex + qWeeksCount,
                );
                const qAllDays = qWeeks.flatMap((w) => w.days);
                const qYearDays = qAllDays.filter(
                  (d) => d.getFullYear() === viewYear,
                );
                const qTotalDays = qYearDays.length;
                const qPastDays = qYearDays.filter((d) => d < today).length;
                const qHasToday = qYearDays.some((d) => sameDay(d, today));
                const qCompleted =
                  qPastDays + (qHasToday ? todayProgress / 100 : 0);
                const qPct =
                  qTotalDays > 0
                    ? Math.max(
                        0,
                        Math.min(100, (qCompleted / qTotalDays) * 100),
                      )
                    : 0;
                const qRemainingDays = Math.max(
                  0,
                  qTotalDays - qPastDays - (qHasToday ? 1 : 0),
                );
                const qIsComplete =
                  qYearDays.length > 0 &&
                  qYearDays[qYearDays.length - 1]! < today;
                const qStreak = computeQuarterStreak(qAllDays);
                const qDayStart =
                  qYearDays.length > 0 ? dayOfYear(qYearDays[0]!) : 0;
                const qDayEnd =
                  qYearDays.length > 0
                    ? dayOfYear(qYearDays[qYearDays.length - 1]!)
                    : 0;
                const mt = mutedTextColors(meta.colorKey, dark);

                return (
                  <motion.section
                    layout
                    key={qi}
                    className="overflow-visible"
                    style={{
                      background: "transparent",
                      borderRadius: 18,
                      border: `3px solid ${quarter.border}`,
                    }}
                  >
                    {/* Sticky quarter header — sticks just below main app header */}
                    <div style={{ borderRadius: 16 }}>
                      {/* Quarter header row */}
                      <div
                        className="flex items-center justify-between px-3 sm:px-5 pb-0"
                        style={{ paddingTop: 18 }}
                      >
                        <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0 mr-2">
                          {/* Editable quarter name */}
                          <QuarterNameEditor
                            value={meta.name}
                            onChange={(name) => updateQuarterMeta(qi, { name })}
                            color={quarter.nameColor}
                            underline={false}
                          />
                          <span
                            className="text-[10px] tabular-nums"
                            style={{ color: mt.tertiary }}
                          >
                            {t("weeks")} {startIndex + 1}–
                            {startIndex + qWeeksCount}
                            <span
                              style={{
                                display: "inline-block",
                                width: 3,
                                height: 3,
                                borderRadius: "50%",
                                background: mt.tertiary,
                                margin: "0 4px",
                                verticalAlign: "middle",
                              }}
                            />
                            {t("days")} {qDayStart}–{qDayEnd}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              runMobileWindowAction(
                                editGoalsQi === qi,
                                () => setEditGoalsQi(qi),
                              )
                            }
                            title={t("quarterGoals")}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: "transparent",
                              border: "none",
                              color:
                                (quarterGoals[qi]?.goals.filter(
                                  (g) => !g.isDeleted && g.text.trim(),
                                ).length ?? 0) > 0
                                  ? quarter.nameColor
                                  : mt.tertiary,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <GoalsIcon />
                          </button>
                          <IconButton
                            title={t("sprintConfig")}
                            onClick={() =>
                              runMobileWindowAction(
                                settingsQuarter === qi,
                                () => setSettingsQuarter(qi),
                              )
                            }
                            bg={overlayBg}
                            color={quarter.text}
                          >
                            <GearIcon />
                          </IconButton>
                        </div>
                      </div>
                      {/* Quarter progress */}
                      <div
                        className="px-3 sm:px-5"
                        style={{ paddingTop: 0, paddingBottom: 18 }}
                      >
                        <div
                          className="text-center tabular-nums"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            marginBottom: 4,
                            color:
                              !dark && quarter.key === "green"
                                ? "var(--apple-green-deep)"
                                : quarter.text,
                          }}
                        >
                          {qPct.toFixed(0)}%
                        </div>
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{
                            background: dark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.06)",
                          }}
                        >
                          <motion.div
                            initial={false}
                            animate={{ width: `${qPct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 120,
                              damping: 24,
                            }}
                            style={{
                              height: "100%",
                              background: quarter.fill,
                              borderRadius: 999,
                              opacity: 0.88,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums">
                          <span style={{ color: mt.tertiary }}>
                            {qPastDays} {t("of")} {qTotalDays} {t("daysOf")}
                          </span>
                          <span style={{ color: mt.tertiary }}>
                            {qIsComplete
                              ? t("elapsed")
                              : `${qRemainingDays} ${t("daysRemaining")}`}
                          </span>
                        </div>
                        {/* Quarter goal progress bar */}
                        {(() => {
                          const qg = quarterGoals[qi];
                          const activeQGoals =
                            qg?.goals.filter(
                              (g) => !g.isDeleted && g.text.trim(),
                            ) ?? [];
                          if (activeQGoals.length === 0) return null;
                          const goalPct =
                            (activeQGoals.filter((g) => g.done).length /
                              activeQGoals.length) *
                            100;
                          return (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div
                                className="flex-1 h-0.5 rounded-full overflow-hidden"
                                style={{
                                  background: dark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.04)",
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
                                    height: "100%",
                                    background: quarter.fill,
                                    borderRadius: 999,
                                    opacity: 0.72,
                                  }}
                                />
                              </div>
                              <span
                                className="text-[9px] tabular-nums shrink-0"
                                style={{ color: mt.tertiary }}
                              >
                                {activeQGoals.filter((g) => g.done).length}/
                                {activeQGoals.length} {t("goals")}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      {/* Quarter goal checklist */}
                      {(() => {
                        const qg = quarterGoals[qi];
                        const activeQGoals =
                          qg?.goals.filter(
                            (g) => !g.isDeleted && g.text.trim(),
                          ) ?? [];
                        if (activeQGoals.length === 0) return null;
                        return (
                          <div className="px-3 sm:px-5 pb-3">
                            {qg?.description ? (
                              <p
                                className="text-[11px] leading-snug mb-2"
                                style={{
                                  color: mt.tertiary,
                                  borderLeft: `2px solid ${quarter.fill}`,
                                  paddingLeft: 8,
                                  opacity: 0.8,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {qg.description}
                              </p>
                            ) : null}
                            <div className="flex flex-col gap-1">
                              {activeQGoals.map((goal) => {
                                const cb = goalCheckboxColors(
                                  goal.color,
                                  dark,
                                  quarter.fill,
                                  quarter.key,
                                );
                                return (
                                  <label
                                    key={goal.id}
                                    className="flex items-start gap-2 cursor-pointer select-none"
                                    onClick={() =>
                                      toggleQuarterGoal(qi, goal.id)
                                    }
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
                                        background: goal.done
                                          ? cb.doneBg
                                          : cb.emptyBg,
                                        border: `1.5px solid ${goal.done ? cb.doneBorder : cb.emptyBorder}`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        transition: "all 150ms ease",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {goal.done && (
                                        <CheckIcon color={cb.icon} />
                                      )}
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
                        );
                      })()}
                    </div>
                    {/* end quarter header wrapper */}

                    <div className="pb-3 sm:pb-4 px-2 sm:px-4 pt-0 flex flex-col gap-2">
                      <BlocksRenderer
                        qi={qi}
                        quarter={quarter}
                        qConfig={qConfig}
                        startIndex={startIndex}
                        weeks={weeks}
                        currentWeekIndex={currentWeekIndex}
                        todayProgress={todayProgress}
                        dayState={dayState}
                        weekRefs={weekRefs}
                        notes={notes}
                        milestonesMap={milestonesMap}
                        blockGoals={blockGoals}
                        dayGoalsMap={dayGoals}
                        dark={dark}
                        isCompactViewport={isCompactViewport}
                        cardBg={cardBg}
                        overlayBg={overlayBg}
                        weekSel={weekSel}
                        matchedDates={matchedDates}
                        activeMatchKey={matchedDatesArray[searchIndex]}
                        onNoteOpen={(k) =>
                          runMobileWindowAction(
                            openNote === k,
                            () => setOpenNote(k),
                          )
                        }
                        onLabelChange={(bid, lbl) =>
                          updateBlockLabel(qi, bid, lbl)
                        }
                        onGoalToggle={toggleGoal}
                        onEditGoals={(bid) =>
                          runMobileWindowAction(
                            editGoalsBlockId === bid,
                            () => setEditGoalsBlockId(bid),
                          )
                        }
                        onWeekLabelClick={handleWeekLabelClick}
                        onCreateSprint={(selStart, selEnd) => {
                          updateQuarter(
                            qi,
                            createSprintFromSelection(
                              config.quarters[qi]!,
                              selStart,
                              selEnd,
                              t("sprintLabel"),
                            ),
                          );
                          setWeekSel(null);
                        }}
                        onCancelSel={() => setWeekSel(null)}
                        viewYear={viewYear}
                      />
                    </div>
                  </motion.section>
                );
              })}
              </div>
            </LayoutGroup>

            <footer
              className="mt-12 pb-8 text-center text-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("footerBase")} · {viewYear}
            </footer>
          </div>
        </main>

        {/* ── Modals ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {settingsQuarter !== null && (
            <SprintSettingsModal
              key="sprint-settings"
              quarterIndex={settingsQuarter}
              quarter={resolvedQuarters[settingsQuarter]!}
              initial={config.quarters[settingsQuarter]!}
              dark={dark}
              modalBg={modalBg}
              colorKey={quarterMeta[settingsQuarter]!.colorKey}
              onColorChange={(key) =>
                updateQuarterMeta(settingsQuarter, { colorKey: key })
              }
              onClose={() => setSettingsQuarter(null)}
              onAutoSave={(next) => updateQuarter(settingsQuarter, next)}
              quarterName={quarterMeta[settingsQuarter]!.name}
              onQuarterNameChange={(name) =>
                updateQuarterMeta(settingsQuarter, { name })
              }
              weeksCapacity={
                settingsQuarter === 3 ? q4Weeks : WEEKS_PER_QUARTER
              }
              onSave={(next) => {
                updateQuarter(settingsQuarter, next);
                setSettingsQuarter(null);
              }}
              onResetBlock={(blockId) => {
                const qi = settingsQuarter;
                const qBlocks = config.quarters[qi]!.blocks;
                let cursor = 0,
                  blockStart = 0,
                  blockEnd = 0;
                for (const b of qBlocks) {
                  if (b.id === blockId) {
                    blockStart = cursor;
                    blockEnd = cursor + b.weeks;
                    break;
                  }
                  cursor += b.weeks;
                }
                const si = qi * WEEKS_PER_QUARTER;
                const blockWeeks = weeks.slice(si + blockStart, si + blockEnd);
                const keys = new Set(
                  blockWeeks.flatMap((w) => w.days).map((d) => dateKey(d)),
                );
                const deletedAt = Date.now();
                setNotes((prev) => {
                  const next = { ...prev };
                  keys.forEach((k) => {
                    const entries = next[k];
                    if (!entries) return;
                    next[k] = entries.map((entry) => ({
                      ...entry,
                      updatedAt: deletedAt,
                      isDeleted: true,
                    }));
                  });
                  return next;
                });
                setBlockGoals((prev) => {
                  const block = prev[blockId];
                  return block
                    ? {
                        ...prev,
                        [blockId]: {
                          ...block,
                          updatedAt: deletedAt,
                          isDeleted: true,
                          goals: block.goals.map((goal) => ({
                            ...goal,
                            updatedAt: deletedAt,
                            isDeleted: true,
                          })),
                        },
                      }
                    : prev;
                });
                setDayGoals((prev) => {
                  const next = { ...prev };
                  keys.forEach((k) => {
                    const goals = next[k];
                    if (!goals) return;
                    next[k] = {
                      count: 0,
                      done: [],
                      labels: [],
                      colors: [],
                      createdAt: goals.createdAt,
                      updatedAt: deletedAt,
                      isDeleted: true,
                    };
                  });
                  return next;
                });
                setMilestones((prev) => {
                  const deletedAt = Date.now();
                  return prev.map((m) =>
                    keys.has(m.date)
                      ? { ...m, updatedAt: deletedAt, isDeleted: true }
                      : m,
                  );
                });
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {openNote !== null && (
            <NoteModal
              key="note"
              dateKey={openNote}
              initial={(notes[openNote] ?? []).filter(
                (entry) => !entry.isDeleted,
              )}
              dark={dark}
              modalBg={modalBg}
              dayMilestones={milestonesMap[openNote] ?? []}
              initDayGoals={dayGoals[openNote]}
              tomorrowInitGoals={(() => {
                const [yr, mo, dy] = openNote.split("-").map(Number);
                return dayGoals[dateKey(new Date(yr, mo - 1, dy + 1))];
              })()}
              dayTemplates={dayTemplates.filter(
                (template) => !template.isDeleted,
              )}
              onSaveTemplates={(templates) =>
                setDayTemplates((prev) => {
                  const previousById = new Map(
                    prev.map((template) => [template.id, template]),
                  );
                  const changedAt = Date.now();
                  const next = templates.map((template) => {
                    const previous = previousById.get(template.id);
                    const unchanged =
                      previous &&
                      previous.name === template.name &&
                      previous.items.join("\u0000") ===
                        template.items.join("\u0000");
                    return {
                      ...template,
                      createdAt:
                        previous?.createdAt ?? template.createdAt ?? changedAt,
                      updatedAt: unchanged
                        ? (previous.updatedAt ?? changedAt)
                        : changedAt,
                    };
                  });
                  const incomingIds = new Set(
                    templates.map((template) => template.id),
                  );
                  const removed = prev
                    .filter((template) => !incomingIds.has(template.id))
                    .map((template) =>
                      template.isDeleted
                        ? template
                        : {
                            ...template,
                            updatedAt: changedAt,
                            isDeleted: true,
                          },
                    );
                  return [...next, ...removed];
                })
              }
              onMilestoneUpdate={(ms) =>
                setMilestones((prev) =>
                  prev.map((m) =>
                    m.id === ms.id
                      ? {
                          ...ms,
                          createdAt: m.createdAt ?? ms.createdAt ?? Date.now(),
                          updatedAt: Date.now(),
                          isDeleted: false,
                        }
                      : m,
                  ),
                )
              }
              onMilestoneAdd={(ms) =>
                setMilestones((prev) => [
                  ...prev,
                  { ...ms, ...newTimestamps(), isDeleted: false },
                ])
              }
              onMilestoneDelete={(id) =>
                setMilestones((prev) =>
                  prev.map((m) =>
                    m.id === id
                      ? { ...m, updatedAt: Date.now(), isDeleted: true }
                      : m,
                  ),
                )
              }
              onMilestoneReorder={(ids) =>
                setMilestones((prev) => reorderByIds(prev, ids))
              }
              onDayGoalsChange={(g) => updateDayGoals(openNote, g)}
              onCopyGoalsTo={(targetDk, g) => updateDayGoals(targetDk, g)}
              onSave={(entries) => upsertNotes(openNote, entries)}
              onClose={() => setOpenNote(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {goalsOpen && (
            <AllGoalsPanel
              key="goals-panel"
              config={config}
              blockGoals={blockGoals}
              resolvedQuarters={resolvedQuarters}
              quarterGoals={quarterGoals}
              yearGoals={yearGoals[viewYear] ?? { description: "", goals: [] }}
              viewYear={viewYear}
              dark={dark}
              modalBg={modalBg}
              onToggleGoal={toggleGoal}
              onToggleQuarterGoal={toggleQuarterGoal}
              onToggleYearGoal={(goalId) => toggleYearGoal(viewYear, goalId)}
              onEditGoals={(id) => {
                runMobileWindowAction(editGoalsBlockId === id, () => {
                  setEditGoalsBlockId(id);
                  setGoalsOpen(false);
                });
              }}
              onEditQuarterGoals={(qi) => {
                runMobileWindowAction(editGoalsQi === qi, () => {
                  setEditGoalsQi(qi);
                  setGoalsOpen(false);
                });
              }}
              onEditYearGoals={() => {
                runMobileWindowAction(editYearGoals, () => {
                  setEditYearGoals(true);
                  setGoalsOpen(false);
                });
              }}
              onClose={() => setGoalsOpen(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {notesPanelOpen && (
            <NotesPanel
              key="notes-panel"
              notes={notes}
              weeks={weeks}
              resolvedQuarters={resolvedQuarters}
              dark={dark}
              modalBg={modalBg}
              onOpenNote={(key) =>
                runMobileWindowAction(
                  openNote === key,
                  () => setOpenNote(key),
                )
              }
              onAddNote={(dk, entry) =>
                upsertNotes(dk, [...(notes[dk] ?? []), entry])
              }
              onDeleteDayNotes={(dk) => upsertNotes(dk, [])}
              onClose={() => setNotesPanelOpen(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {milestonePanelOpen && (
            <MilestoneModal
              key="milestones"
              milestones={activeMilestones}
              resolvedQuarters={resolvedQuarters}
              weeks={weeks}
              dark={dark}
              modalBg={modalBg}
              onClose={() => setMilestonePanelOpen(false)}
              onChange={(m) => {
                setMilestones((prev) => {
                  const changedAt = Date.now();
                  const nextIds = new Set(m.map((item) => item.id));
                  const removed = prev
                    .filter((item) => !item.isDeleted && !nextIds.has(item.id))
                    .map((item) => ({
                      ...item,
                      updatedAt: changedAt,
                      isDeleted: true,
                    }));
                  const next = m.map((item) => {
                    const previous = prev.find(
                      (existing) => existing.id === item.id,
                    );
                    const changed =
                      !previous ||
                      previous.label !== item.label ||
                      previous.date !== item.date ||
                      previous.color !== item.color ||
                      previous.description !== item.description ||
                      previous.recurring !== item.recurring;
                    return {
                      ...item,
                      createdAt:
                        previous?.createdAt ?? item.createdAt ?? changedAt,
                      updatedAt: changed
                        ? changedAt
                        : (previous.updatedAt ?? changedAt),
                      isDeleted: false,
                    };
                  });
                  return [
                    ...prev.filter((item) => item.isDeleted),
                    ...next,
                    ...removed,
                  ];
                });
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editGoalsBlockId !== null && editGoalsBlock !== null && (
            <GoalsModal
              key="goals"
              blockId={editGoalsBlockId}
              blockLabel={editGoalsBlock.label}
              initial={
                blockGoals[editGoalsBlockId] ?? { description: "", goals: [] }
              }
              dark={dark}
              modalBg={modalBg}
              accentColor={editGoalsAccentColor}
              onSave={(bg, lbl) => {
                setBlockGoals((prev) => ({
                  ...prev,
                  [editGoalsBlockId!]: updateBlockGoals(
                    prev[editGoalsBlockId!],
                    bg,
                  ),
                }));
                const qi = config.quarters.findIndex((q) =>
                  q.blocks.some((b) => b.id === editGoalsBlockId),
                );
                if (qi >= 0) updateBlockLabel(qi, editGoalsBlockId!, lbl);
              }}
              onClose={() => setEditGoalsBlockId(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editGoalsQi !== null && (
            <GoalsModal
              key="quarter-goals"
              blockId={String(editGoalsQi)}
              blockLabel={
                quarterMeta[editGoalsQi]?.name ??
                resolvedQuarters[editGoalsQi]?.label ??
                ""
              }
              initial={
                quarterGoals[editGoalsQi] ?? { description: "", goals: [] }
              }
              dark={dark}
              modalBg={modalBg}
              accentColor={resolvedQuarters[editGoalsQi]?.fill}
              titleLabel={t("quarterGoals")}
              descPlaceholder={t("quarterDescPlaceholder")}
              onSave={(bg, lbl) => {
                setQuarterGoals((prev) => ({
                  ...prev,
                  [editGoalsQi!]: updateBlockGoals(prev[editGoalsQi!], bg),
                }));
                updateQuarterMeta(editGoalsQi!, { name: lbl });
              }}
              onClose={() => setEditGoalsQi(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editYearGoals && (
            <GoalsModal
              key="year-goals"
              blockId={String(viewYear)}
              blockLabel={String(viewYear)}
              initial={yearGoals[viewYear] ?? { description: "", goals: [] }}
              dark={dark}
              modalBg={modalBg}
              titleLabel={t("yearGoals")}
              descPlaceholder={t("yearDescPlaceholder")}
              onSave={(bg) => {
                setYearGoals((prev) => ({
                  ...prev,
                  [viewYear]: updateBlockGoals(prev[viewYear], bg),
                }));
              }}
              onClose={() => setEditYearGoals(false)}
              onBack={() => {
                setEditYearGoals(false);
                setGoalsOpen(true);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lifeCalendarOpen && (
            <LifeCalendarModal
              key="life-cal"
              dark={dark}
              modalBg={modalBg}
              settings={lifeSettings}
              onSettingsChange={(next) =>
                setLifeSettings((previous) => ({
                  ...next,
                  createdAt: previous.createdAt ?? next.createdAt ?? Date.now(),
                  updatedAt: Date.now(),
                }))
              }
              onClose={() => setLifeCalendarOpen(false)}
            />
          )}
        </AnimatePresence>

        <FactoryResetDialog
          open={factoryResetStep >= 1}
          onClose={() => setFactoryResetStep(0)}
          onConfirm={async () => {
            try {
              // Replace Drive with the empty snapshot first. This preserves
              // the Google session and prevents stale cloud data from
              // returning if the browser is closed during the reset.
              const resetSnapshot = await resetCloudData();

              // Remove only this app's calendar data. The gSync:* auth keys
              // must survive so the Google account remains connected.
              Object.keys(localStorage)
                .filter((key) => key.startsWith("lifeCalendar:"))
                .forEach((key) => localStorage.removeItem(key));

              // Apply factory defaults immediately without a page reload.
              // This keeps the signed-in Google account and updates the
              // visible calendar in the same operation.
              setDark(false);
              setLang("ru");
              applySnapshot(resetSnapshot);
              await triggerSync(resetSnapshot);
              setFactoryResetStep(0);
            } catch (e) {
              console.error("Ошибка при сбросе данных календаря:", e);
              window.alert(
                lang === "ru"
                  ? "Не удалось завершить сброс: данные Google Drive не были изменены."
                  : "The reset could not finish: Google Drive data was not changed.",
              );
              return;
            }
          }}
          dark={dark}
        />

        <ConfirmDialog
          open={confirmSignOut}
          onClose={() => setConfirmSignOut(false)}
          onConfirm={() => {
            void googleSignOut(buildSnapshot());
          }}
          message={t("signOutConfirm")}
          confirmLabel={t("signOutAccount")}
          dark={dark}
        />

        <AnimatePresence>
          {showTodayBtn && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              onClick={scrollToToday}
              style={{
                position: "fixed",
                bottom: 20,
                right: 20,
                zIndex: 15,
                height: 28,
                paddingInline: 10,
                borderRadius: 999,
                background: dark
                  ? "rgba(36,36,40,0.88)"
                  : "rgba(242,242,247,0.88)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                boxShadow: `0 0 0 1px ${dark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.08)"}, 0 2px 10px rgba(0,0,0,0.10)`,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "var(--text-tertiary)",
                  flexShrink: 0,
                }}
              />
              {t("today")}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </LangContext.Provider>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

function IconButton({
  children,
  onClick,
  title,
  bg,
  color,
  "aria-expanded": ariaExpanded,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  bg: string;
  color?: string;
  "aria-expanded"?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-expanded={ariaExpanded}
      className="lc-icon-btn"
      style={{
        position: "relative",
        width: 30,
        height: 30,
        borderRadius: 8,
        background: bg,
        border: "none",
        boxShadow: "0 0 0 1px var(--border-soft)",
        color: color ?? "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── BlocksRenderer ───────────────────────────────────────────────────────────

function BlocksRenderer({
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
                  background: cardBg,
                  borderRadius: 14,
                  border: `2px solid ${effectiveQ.border}`,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  overflow: "visible",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-2 sm:px-3.5 pt-2.5 pb-1.5"
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
                      <GoalsIcon />
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
                <div className="px-2 sm:px-3.5 pb-2">
                  <div className="relative flex items-center justify-between text-[10px] tabular-nums mb-1">
                    <span style={{ color: mt.tertiary }}>
                      {pastDays} {t("of")} {totalDays} {t("daysOf")}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        color: isFuture ? mt.tertiary : effectiveQ.text,
                        fontWeight: 700,
                      }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                    <span style={{ color: mt.tertiary }}>
                      {isComplete ? t("done") : `${daysLeft} ${t("left")}`}
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{
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
                        height: "100%",
                        background: effectiveQ.fill,
                        borderRadius: 999,
                        boxShadow: pct > 0 ? `0 0 6px ${softColor}` : "none",
                      }}
                    />
                  </div>
                  {goalPct !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="flex-1 h-0.5 rounded-full overflow-hidden"
                        style={{
                          background: dark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(0,0,0,0.04)",
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
                            height: "100%",
                            background: effectiveQ.fill,
                            borderRadius: 999,
                            opacity: 0.72,
                          }}
                        />
                      </div>
                      <span
                        className="text-[9px] tabular-nums shrink-0"
                        style={{ color: mt.tertiary }}
                      >
                        {activeGoals.filter((g) => g.done).length}/
                        {activeGoals.length} {t("goals")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sprint description */}
                {bg?.description && (
                  <div className="px-2 sm:px-3.5 pb-2">
                    <p
                      className="text-[11px] leading-snug"
                      style={{
                        color: mt.tertiary,
                        borderLeft: `2px solid ${softColor}`,
                        paddingLeft: 8,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {bg.description}
                    </p>
                  </div>
                )}

                {/* Checklist */}
                {activeGoals.length > 0 && (
                  <div className="px-2 sm:px-3.5 pb-2">
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
                <div className="flex flex-col gap-2 sm:gap-2.5 pb-3 pt-1">
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
                                color:
                                  isSel || isCurrent
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
                            className="grid grid-cols-7 gap-1 sm:gap-3"
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
                          {/* RIGHT COLUMN — goals counter, responsive width */}
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
                                style={{
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <span
                                  className="lc-week-counter text-[10px] sm:text-[11px] tabular-nums"
                                  style={{
                                    fontWeight: 500,
                                    color:
                                      weekDone === weekTotal
                                        ? "#34c759"
                                        : "var(--text-tertiary)",
                                    lineHeight: 1,
                                    textDecoration: "none",
                                    borderBottom: "none",
                                  }}
                                >
                                  {weekDone}/{weekTotal}
                                </span>
                                {weekDone === weekTotal && (
                                  <svg
                                    width="8"
                                    height="7"
                                    viewBox="0 0 8 7"
                                    fill="none"
                                    style={{ flexShrink: 0 }}
                                  >
                                    <path
                                      d="M1 3.5l2.2 2.2L7 1"
                                      stroke="#34c759"
                                      strokeWidth="1.3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
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
                                      border: "none",
                                      background: quarter.border,
                                      color: "white",
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

function QuarterNameEditor({
  value,
  onChange,
  color,
  underline = true,
}: {
  value: string;
  onChange: (v: string) => void;
  color: string;
  underline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    onChange(draft.trim() || value);
  };
  // CSS grid trick: sizer span drives grid cell height; textarea fills it — no layout shift on mode switch
  const sharedTextStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    lineHeight: 1.35,
    fontFamily: "inherit",
    padding: "1px 0",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
    gridArea: "1/1",
  };
  return (
    <div
      style={{
        display: "inline-grid",
        maxWidth: "100%",
      }}
    >
      <textarea
        value={draft}
        rows={1}
        cols={1}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
          }
        }}
        className="bg-transparent outline-none"
        style={{
          ...sharedTextStyle,
          color,
          resize: "none",
          overflow: "hidden",
          width: "100%",
          borderBottom: underline ? `1px solid ${color}` : "none",
        }}
      />
      {/* invisible sizer that mirrors the text — drives the grid row height */}
      <span
        aria-hidden
        style={{
          ...sharedTextStyle,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {draft + "\u200b"}
      </span>
    </div>
  );
}

// ─── BlockLabel ───────────────────────────────────────────────────────────────

function BlockLabel({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  const commit = () => {
    onChange(draft.trim() || "Untitled sprint");
  };
  return (
    <textarea
      value={draft}
      rows={1}
      onChange={(e) => {
        setDraft(e.target.value);
        autoResize(e.target);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(value);
        }
      }}
      className="text-[12px] font-semibold bg-transparent outline-none"
      style={{
        color,
         borderBottom: "none",
        padding: "1px 2px",
        width: "100%",
        resize: "none",
        overflow: "hidden",
        lineHeight: 1.35,
        fontFamily: "inherit",
        display: "block",
      }}
    />
  );
}

// ─── Fire animation ───────────────────────────────────────────────────────────
const FIRE_EPOCH = Date.now(); // fixed reference point — all tiles sync to this
if (
  typeof document !== "undefined" &&
  !document.getElementById("lc-fire-style")
) {
  const s = document.createElement("style");
  s.id = "lc-fire-style";
  s.textContent = `@keyframes lc-fire-pulse {
    0%,100%{opacity:0.55;}
    50%{opacity:1;}
  }.lc-fire-glow{position:absolute;inset:0;border-radius:12px;pointer-events:none;box-shadow:0 0 0 2px #ff7722,0 0 10px 3px rgba(255,110,0,0.45),0 0 24px 7px rgba(255,80,0,0.25);animation:lc-fire-pulse 5s ease-in-out infinite;will-change:opacity;}
  .lc-goal-markers{padding:3px 0;}
  @media(max-width:639px){
     .lc-goal-markers{padding:0;margin-bottom:0;max-width:100%;}
    .lc-fire-glow{box-shadow:0 0 0 1.5px #ff7722,0 0 10px 3px rgba(255,110,0,0.45),0 0 24px 7px rgba(255,80,0,0.25);}
  }
  @media(min-width:640px){
    .lc-goal-dot{width:6px!important;height:6px!important;}
  }`;
  document.head.appendChild(s);
}

// ─── DayTile ──────────────────────────────────────────────────────────────────

function DayTile({
  date,
  state,
  todayProgress,
  notes: dayNotes,
  milestones: dayMilestones,
  dayGoals,
  accentColor,
  highlighted,
  isActiveMatch,
  dark,
  isCompactViewport,
  onOpen,
}: {
  date: Date;
  state: DayState;
  todayProgress: number;
  notes?: NoteEntry[];
  milestones: Milestone[];
  dayGoals?: DayGoals;
  accentColor: string;
  highlighted?: boolean;
  isActiveMatch?: boolean;
  dark: boolean;
  isCompactViewport: boolean;
  onOpen: () => void;
}) {
  const isOut = state === "out";
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const hovered = tooltipRect !== null;
  // Long-press state (touch/pen only)
  const holdTimerRef = useRef<number | null>(null);
  const holdStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressActiveRef = useRef(false);
  const isPast = state === "past",
    isToday = state === "today";
  const isAllDone =
    dayGoals != null &&
    dayGoals.count > 0 &&
    dayGoals.done.length >= dayGoals.count &&
    dayGoals.done.every(Boolean);
  // Pale accents (e.g. "White") are too light for a single flat text colour to read
  // against reliably: the tile is part accent-fill / part theme surface, and — for
  // "today" — that split moves as the day progresses. Very dark accents (e.g. "Black"
  // in light mode) hit the mirror-image problem: the theme's own dark ink then merges
  // into the dark fill. Either way a flat colour can't win on both sides, so both
  // extremes fall back to "invertPale", which uses mix-blend-mode instead of guessing
  // one colour (see Label for the mechanics).
  const isPaleAccent = luminanceOf(accentColor) > 0.8; // e.g. White (#d2d2d6); yellow (#ffcc00 ≈ 0.77) must NOT be flagged here or mix-blend-mode:difference turns white text blue
  const isDeepAccent = luminanceOf(accentColor) < 0.3; // e.g. Black
  const needsInvertText = (isPast || isToday) && (isPaleAccent || isDeepAccent);
  // When the accent is near-black in dark mode the ring is invisible (black-on-black).
  // Use white so the today outline is clearly legible — same principle iOS uses for
  // dark-coloured elements: give them a light border so they read on a dark surface.
  const ringAccent =
    dark && luminanceOf(accentColor) < 0.12 ? "#ffffff" : accentColor;
  // isPaleAccent (white) → explicit dark text rather than mix-blend-mode trickery, which can
  // be unreliable across `contain:paint` / `isolation:isolate` boundaries in Chrome.
  // In light mode, today's tile background is var(--surface) (light/white) and the accent
  // fill only covers the bottom portion — white ("onGreen") text would be invisible on the
  // unfilled surface. Use "muted" (var(--text), dark in light mode) so the label is readable
  // at any fill level; all normal accents are bright enough to keep dark text legible on fill.
  const labelTone: "onGreen" | "invertPale" | "darkOnLight" | "muted" | "auto" =
    isPast
      ? isPaleAccent
        ? "darkOnLight"
        : needsInvertText
          ? "invertPale"
          : "onGreen"
      : isToday
        ? isPaleAccent
          ? "darkOnLight"
          : needsInvertText
            ? "invertPale"
            : dark
              ? "onGreen"
              : "muted"
        : "muted";
  const microMarkers =
    dayGoals && dayGoals.count > 0
      ? (() => {
          const onFill = isPast || isToday;
          const indicatorLimit = isCompactViewport ? 6 : 8;
          const showPlus = dayGoals.count > indicatorLimit;
          const dotCount = showPlus ? indicatorLimit - 1 : dayGoals.count;
          const allDone = showPlus
            ? Array.from(
                { length: dayGoals.count },
                (_, i) => dayGoals.done[i] ?? false,
              ).every(Boolean)
            : false;
          const dots = Array.from({ length: dotCount }, (_, i) => {
            const done = dayGoals.done[i] ?? false;
            return done ? (
              <svg
                key={i}
                width="5"
                height="5"
                viewBox="0 0 6 6"
                fill="none"
                className="lc-goal-dot"
                style={{ flexShrink: 0, overflow: "hidden" }}
              >
                <rect
                  x="0"
                  y="0"
                  width="6"
                  height="6"
                  rx="1.2"
                  fill={
                    onFill
                      ? isPaleAccent
                        ? "rgba(24,24,27,0.16)"
                        : "rgba(255,255,255,0.92)"
                      : "#34c759"
                  }
                />
                <path
                  d="M1.4 3l1.1 1.1 2.1-2.2"
                  stroke={
                    onFill ? (isPaleAccent ? "#18181b" : accentColor) : "white"
                  }
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                key={i}
                width="5"
                height="5"
                viewBox="0 0 6 6"
                fill="none"
                className="lc-goal-dot"
                style={{ flexShrink: 0, opacity: 0.5, overflow: "hidden" }}
              >
                <rect
                  x="0.75"
                  y="0.75"
                  width="4.5"
                  height="4.5"
                  rx="1"
                  stroke={
                    onFill
                      ? isPaleAccent
                        ? "rgba(24,24,27,0.55)"
                        : "rgba(255,255,255,0.85)"
                      : "var(--text-tertiary)"
                  }
                  strokeWidth="1.5"
                />
              </svg>
            );
          });
          const plusColor = allDone
            ? onFill
              ? isPaleAccent
                ? "rgba(24,24,27,0.16)"
                : "rgba(255,255,255,0.92)"
              : "#34c759"
            : onFill
              ? isPaleAccent
                ? "rgba(24,24,27,0.55)"
                : "rgba(255,255,255,0.85)"
              : "var(--text-tertiary)";
          const plusDot = showPlus ? (
            <svg
              key="plus"
              width="5"
              height="5"
              viewBox="-0.5 -0.5 7 7"
              fill="none"
              className="lc-goal-dot"
              style={{
                flexShrink: 0,
                overflow: "hidden",
                opacity: allDone ? 1 : 0.5,
              }}
            >
              <path
                d="M3 1v4M1 3h4"
                stroke={plusColor}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : null;
          return (
            <div
              className="lc-goal-markers"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 1,
                pointerEvents: "none",
              }}
            >
              {dots}
              {plusDot}
            </div>
          );
        })()
      : null;
  const activeNotes = dayNotes?.filter((n) => n.text.trim()) ?? [];
  const hasNote = activeNotes.length > 0;
  const noteCount = activeNotes.length;
  const { months: ctxMonths } = React.useContext(LangContext);
  const dayNumber = date.getDate(),
    monthAbbr = ctxMonths[date.getMonth()]!;

  const dk = dateKey(date);
  const highlightRing = isActiveMatch
    ? "0 0 0 3px #ff9f0a, 0 0 16px 4px rgba(255,159,10,0.65)"
    : highlighted === true
      ? "0 0 0 2px #ff9f0a, 0 0 8px 2px rgba(255,159,10,0.45)"
      : highlighted === false
        ? "none"
        : undefined;
  const fireDelayRef = useRef<string | undefined>(undefined);
  if (isAllDone && fireDelayRef.current === undefined) {
    fireDelayRef.current = `${-(((Date.now() - FIRE_EPOCH) % 4000) / 1000).toFixed(3)}s`;
  } else if (!isAllDone) {
    fireDelayRef.current = undefined;
  }
  const base: React.CSSProperties = {
    borderRadius: 12,
    aspectRatio: "1/1",
    cursor: isOut ? "default" : "pointer",
    transition: isAllDone ? "none" : "box-shadow 200ms ease",
    position: "relative",
    overflow: "visible",
    boxShadow: isAllDone ? undefined : highlightRing,
  };

  // All hooks must run unconditionally on every render (regardless of `isOut`) to keep hook order
  // stable — this effect used to live after the early-return below, crashing when a tile toggled
  // in/out of the "out" state (e.g. when paging between years/months) because hook counts differed.
  useEffect(() => {
    if (!hovered) return;
    const hide = () => setTooltipRect(null);
    const hideOnOutsidePointer = (e: PointerEvent) => {
      if (tileRef.current && !tileRef.current.contains(e.target as Node))
        hide();
    };
    window.addEventListener("wheel", hide, { passive: true });
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    window.addEventListener("pointerdown", hideOnOutsidePointer, {
      passive: true,
    });
    return () => {
      window.removeEventListener("wheel", hide);
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("pointerdown", hideOnOutsidePointer);
    };
  }, [hovered]);
  // Cleanup long-press timer on unmount to prevent setState after unmount
  useEffect(
    () => () => {
      if (holdTimerRef.current !== null)
        window.clearTimeout(holdTimerRef.current);
    },
    [],
  );

  if (isOut)
    return (
      <div
        style={{
          ...base,
          background: "transparent",
          boxShadow: "inset 0 0 0 1px var(--border-soft)",
          opacity: 0.25,
          cursor: "default",
        }}
      />
    );

  const hasEvents = dayMilestones.length > 0;
  const noteDot = hasNote ? (
    <div
      style={{
        position: "absolute",
        background: "#007aff",
        boxShadow: "0 0 3px rgba(0,122,255,0.65)",
        zIndex: 5,
      }}
      className={`absolute ${hasEvents ? "top-[8px] right-[2px] sm:top-2.5 sm:right-1" : "top-1 right-1"} flex h-[8px] w-[8px] min-h-[8px] min-w-[8px] flex-shrink-0 items-center justify-center rounded-full bg-[#007aff] sm:h-3 sm:w-3 sm:min-h-3 sm:min-w-3`}
    >
      <span
        className="text-[5px] sm:text-[8px]"
        style={{ color: "white", fontWeight: 700, lineHeight: 1 }}
      >
        {noteCount}
      </span>
    </div>
  ) : null;

  const msSep = dark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.20)";
  const msBar =
    dayMilestones.length > 0 ? (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          borderRadius: "12px 12px 0 0",
          display: "flex",
          overflow: "hidden",
          zIndex: 4,
        }}
      >
        {dayMilestones.map((ms, msIdx) => {
          const ec = getEventColors(ms.color, dark);
          const noColor = !ms.color;
          const isLast = msIdx === dayMilestones.length - 1;
          return (
            <React.Fragment key={ms.id}>
              <div
                style={{
                  flex: 1,
                  background: noColor ? "transparent" : ec.marker,
                  borderBottom: noColor ? `1px solid ${msSep}` : "none",
                  boxSizing: "border-box",
                  boxShadow:
                    noColor && dark
                      ? "inset 0 1px 3px rgba(0,0,0,0.45)"
                      : undefined,
                }}
              />
              {!isLast && (
                <div style={{ width: 1, flexShrink: 0, background: msSep }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    ) : null;

  // ── Desktop: show tooltip on hover ──────────────────────────────────────────
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (hasNote && tileRef.current)
      setTooltipRect(tileRef.current.getBoundingClientRect());
  };
  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    setTooltipRect(null);
  };

  // ── Touch/pen: long-press shows tooltip, short tap opens modal ───────────────
  const cancelHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartPos.current = null;
  };
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    longPressActiveRef.current = false;
    holdStartPos.current = { x: e.clientX, y: e.clientY };
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      holdStartPos.current = null;
      longPressActiveRef.current = true;
      if (hasNote && tileRef.current)
        setTooltipRect(tileRef.current.getBoundingClientRect());
    }, 400);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (
      e.pointerType === "mouse" ||
      holdTimerRef.current === null ||
      !holdStartPos.current
    )
      return;
    const dx = Math.abs(e.clientX - holdStartPos.current.x);
    const dy = Math.abs(e.clientY - holdStartPos.current.y);
    if (dx > 8 || dy > 8) cancelHold();
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    cancelHold();
    // Hide preview as soon as the finger lifts
    setTooltipRect(null);
  };
  const handleClick = (e: React.MouseEvent) => {
    // If a long-press just revealed the preview, swallow the click
    if (longPressActiveRef.current) {
      longPressActiveRef.current = false;
      return;
    }
    onOpen();
  };

  const hov = {
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: cancelHold,
    onClick: handleClick,
  };

  // Compute portal tooltip position so it never clips outside viewport
  const tooltipPortal =
    hovered && tooltipRect && hasNote
      ? ReactDOM.createPortal(
          (() => {
            const TW = 240;
            const LINE_H = 18.6,
              MAX_LINES = 10,
              PADDING_V = 22;
            const TH_EST = activeNotes.reduce((sum, n) => {
              const lineCount = Math.min(n.text.split("\n").length, MAX_LINES);
              return sum + lineCount * LINE_H + PADDING_V + 5;
            }, 0);
            const spaceAbove = tooltipRect.top;
            const showBelow = spaceAbove < TH_EST + 20;
            const top = showBelow
              ? tooltipRect.bottom + 8
              : tooltipRect.top - 8;
            const arrowOnTop = showBelow;
            // horizontal: clamp so tooltip stays inside viewport
            const rawLeft = tooltipRect.left + tooltipRect.width / 2 - TW / 2;
            const left = Math.max(
              8,
              Math.min(rawLeft, window.innerWidth - TW - 8),
            );
            const arrowLeft =
              tooltipRect.left + tooltipRect.width / 2 - left - 6;
            return (
              <div
                style={{
                  position: "fixed",
                  top,
                  left,
                  width: TW,
                  zIndex: 9999,
                  background: "rgba(29,29,31,0.96)",
                  backdropFilter: "blur(16px) saturate(180%)",
                  WebkitBackdropFilter: "blur(16px) saturate(180%)",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  borderRadius: 12,
                  padding: "10px 12px",
                  wordBreak: "break-word",
                  boxShadow:
                    "0 8px 32px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.06) inset",
                  border: "1px solid rgba(255,255,255,0.08)",
                  pointerEvents: "none",
                  transform: showBelow ? "none" : "translateY(-100%)",
                }}
              >
                {arrowOnTop && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: arrowLeft,
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderBottom: "6px solid rgba(29,29,31,0.96)",
                    }}
                  />
                )}
                {activeNotes.map((n, i) => {
                  const lines = n.text.split("\n");
                  const clipped = lines.length > MAX_LINES;
                  const displayText = clipped
                    ? lines.slice(0, MAX_LINES).join("\n") + "\n…"
                    : n.text;
                  return (
                    <div
                      key={n.id}
                      style={{
                        marginTop: i > 0 ? 5 : 0,
                        padding: "6px 9px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.06)",
                        border: `1.5px solid ${getEventColors(n.color ?? "", dark).border || "rgba(255,255,255,0.08)"}`,
                        whiteSpace: "pre-wrap",
                        overflow: "hidden",
                        maxHeight: `${MAX_LINES * LINE_H}px`,
                      }}
                    >
                      {displayText}
                    </div>
                  );
                })}
                {!arrowOnTop && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: arrowLeft,
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: "6px solid rgba(29,29,31,0.96)",
                    }}
                  />
                )}
              </div>
            );
          })(),
          document.body,
        )
      : null;

  if (isPast) {
    return (
      <>
        <div
          ref={tileRef}
          data-datekey={dk}
          className={isAllDone ? "lc-fire-tile" : undefined}
          style={{ ...base }}
          {...hov}
        >
          {isAllDone && (
            <div
              className="lc-fire-glow"
              style={{ animationDelay: fireDelayRef.current }}
            />
          )}
           <div
             className="flex flex-col items-center pb-2"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              overflow: "hidden",
              isolation: "isolate",
              contain: "paint",
              background: accentColor,
              color: "white",
              boxShadow: hovered
                ? `0 2px 8px ${accentColor}61, inset 0 0 0 0.5px rgba(255,255,255,0.18)`
                : `0 1px 2px ${accentColor}2e, inset 0 0 0 0.5px rgba(255,255,255,0.18)`,
            }}
          >
            {msBar}
            <div style={{ flex: 1 }} />
            <Label number={dayNumber} month={monthAbbr} tone={labelTone} />
             <div
               className="flex items-center justify-center"
               style={{
                 flex: 1,
                 width: "100%",
                 overflow: "visible",
                 transform: "translateY(-2px)",
               }}
            >
              {microMarkers}
            </div>
            {noteDot}
          </div>
        </div>
        {tooltipPortal}
      </>
    );
  }
  if (isToday) {
    return (
      <>
        <div
          ref={tileRef}
          data-datekey={dk}
          className={isAllDone ? "lc-fire-tile" : undefined}
          style={{ ...base }}
          {...hov}
        >
          {isAllDone && (
            <div
              className="lc-fire-glow"
              style={{ animationDelay: fireDelayRef.current }}
            />
          )}
          <div
            className="flex flex-col items-center justify-center"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              overflow: "hidden",
              isolation: "isolate",
              contain: "paint",
              background: "var(--surface)",
              color: "var(--text)",
            }}
          >
            {msBar}
            {/* Fill layer: a plain sibling (no position/z-index tricks) so it paints into
                the SAME stacking context as the text below — `isolation: isolate` on the
                outer tile is what scopes mix-blend-mode, and any nested element that sets
                its own z-index would create a second, isolated stacking context and cut
                the text off from seeing this layer entirely.
                borderRadius matches the container (12px) so no corner gaps appear between
                the fill and the ring overlay that renders on top. */}
            <div
              className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
              style={{
                height: `${todayProgress}%`,
                background: accentColor,
                borderRadius: "0 0 12px 12px",
              }}
            />
            {/* Text layer: position:absolute WITHOUT an explicit z-index. Paint order inside
                a stacking context follows DOM order, so being declared after the fill layer
                above is enough to sit visually on top — no z-index needed, and adding one
                here would re-introduce the bug (a new isolated context that hides the fill
                from `mix-blend-mode: difference`). */}
             <div className="absolute inset-0 flex flex-col items-center pb-2">
              <div style={{ flex: 1 }} />
              <Label number={dayNumber} month={monthAbbr} tone={labelTone} />
               <div
                 className="flex items-center justify-center"
                 style={{
                   flex: 1,
                   width: "100%",
                   overflow: "visible",
                   transform: "translateY(-2px)",
                 }}
              >
                {microMarkers}
              </div>
            </div>
            {noteDot}
            {/* Ring overlay — last in DOM so it paints above the fill and text layers,
                keeping the outline fully visible at every fill level including 100%. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 12,
                boxShadow: `inset 0 0 0 1.5px ${ringAccent}`,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
        {tooltipPortal}
      </>
    );
  }
  return (
    <>
      <div
        ref={tileRef}
        data-datekey={dk}
        className={isAllDone ? "lc-fire-tile" : undefined}
        style={{ ...base }}
        {...hov}
      >
        {isAllDone && (
          <div
            className="lc-fire-glow"
            style={{ animationDelay: fireDelayRef.current }}
          />
        )}
        <div
          className="flex flex-col items-center pb-2"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            overflow: "hidden",
            contain: "paint",
            background: "var(--surface)",
            border: "1px solid var(--border-soft)",
            color: "var(--text-secondary)",
            boxShadow: hovered
              ? "0 2px 10px rgba(0,0,0,0.08)"
              : "0 1px 1px rgba(0,0,0,0.02)",
          }}
        >
          {msBar}
          <div style={{ flex: 1 }} />
          <Label number={dayNumber} month={monthAbbr} tone={labelTone} />
          <div
            className="flex items-center justify-center"
            style={{
              flex: 1,
              width: "100%",
              overflow: "visible",
              transform: "translateY(-2px)",
            }}
          >
            {microMarkers}
          </div>
          {noteDot}
        </div>
      </div>
      {tooltipPortal}
    </>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({
  number,
  month,
  tone,
}: {
  number: number;
  month: string;
  tone:
    | "onGreen"
    | "invertPale"
    | "darkOnLight"
    | "muted"
    | "auto"
    | "gold"
    | "goldBright"
    | "silver"
    | "silverBright";
}) {
  const isGold = tone === "gold";
  const isGoldBright = tone === "goldBright";
  const isSilver = tone === "silver";
  const isSilverBright = tone === "silverBright";
  const isOnGreen = tone === "onGreen";
  // "invertPale" is used for pale accents where a single flat text colour can't win reliably
  // (mix-blend-mode: difference). "darkOnLight" is used specifically for the white quarter
  // accent (tileFill ≈ #e0e0e5): a pale background that needs explicit dark ink rather than
  // the blend-mode trick (which can misbehave across contain:paint / isolation:isolate).
  const isInvertPale = tone === "invertPale";
  const isDarkOnLight = tone === "darkOnLight";
  const nc = isOnGreen
    ? "white"
    : isInvertPale
      ? "#ffffff"
      : isDarkOnLight
        ? "#18181b"
        : "var(--text)";
  const mc = isOnGreen
    ? "rgba(255,255,255,0.85)"
    : isInvertPale
      ? "#ffffff"
      : isDarkOnLight
        ? "rgba(24,24,27,0.65)"
        : tone === "muted"
          ? "var(--text-tertiary)"
          : "var(--text-secondary)";
  // solid colours — work on any background without gradient-clip artefacts
  const goldCol = "#e8b338"; // warm gold, readable on dark & light
  const silverCol = "#9e9eae"; // steel silver, readable on light/dark
  const goldBrightCol = "#ffd700"; // bright gold on coloured accent bg
  const silverBrightCol = "rgba(255,255,255,0.62)"; // dimmed white on coloured bg
  const numColor = isGold
    ? goldCol
    : isGoldBright
      ? goldBrightCol
      : isSilver
        ? silverCol
        : isSilverBright
          ? silverBrightCol
          : nc;
  const monColor = isGold
    ? goldCol
    : isGoldBright
      ? goldBrightCol
      : isSilver
        ? silverCol
        : isSilverBright
          ? silverBrightCol
          : mc;
  // `mixBlendMode: "difference"` on both lines is what performs the auto-inversion.
  // It must be paired with `isolation: "isolate"` on an ancestor (set on the tile's
  // fill wrapper) so the blend only reacts to the fill/backdrop inside this tile,
  // not to unrelated elements elsewhere on the page.
  const numStyle: React.CSSProperties = {
    color: numColor,
    letterSpacing: "-0.02em",
    ...(isInvertPale ? { mixBlendMode: "difference" } : null),
  };
  const monStyle: React.CSSProperties = {
    color: monColor,
    ...(isInvertPale ? { mixBlendMode: "difference", opacity: 0.85 } : null),
  };
  return (
    <div
      className="lc-label flex flex-col items-center justify-center leading-none select-none"
      style={{ transform: "translateZ(0)", willChange: "transform" }}
    >
      <div
        className="text-[15px] sm:text-[24px] font-semibold tabular-nums"
        style={{ ...numStyle, textDecoration: "none", borderBottom: "none" }}
      >
        {number}
      </div>
      <div
        className="mt-0.5 sm:mt-1 text-[9px] sm:text-[13px] font-medium tracking-widest"
        style={{ ...monStyle, textDecoration: "none", borderBottom: "none" }}
      >
        {month}
      </div>
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
  entry,
  idx,
  entriesCount,
  dark,
  inputBg,
  borderColor,
  hoveredEntryId,
  setHoveredEntryId,
  updateEntry,
  handleNoteHeightChange,
  handleKey,
  noteHeights,
  colorBtnRefs,
  toggleColorPicker,
  colorPickerEntryId,
  setConfirmDeleteEntryId,
}: {
  entry: NoteEntry;
  idx: number;
  entriesCount: number;
  dark: boolean;
  inputBg: string;
  borderColor: string;
  hoveredEntryId: string | null;
  setHoveredEntryId: (id: string | null) => void;
  updateEntry: (id: string, text: string) => void;
  handleNoteHeightChange: (id: string, h: number) => void;
  handleKey: (e: React.KeyboardEvent) => void;
  noteHeights: Record<string, number>;
  colorBtnRefs: React.MutableRefObject<
    Record<string, HTMLButtonElement | null>
  >;
  toggleColorPicker: (id: string) => void;
  colorPickerEntryId: string | null;
  setConfirmDeleteEntryId: (id: string | null) => void;
}) {
  const { t } = React.useContext(LangContext);
  const entryColor = entry.color;
  const ec = entryColor
    ? getEventColors(resolveNoteHex(entryColor), dark)
    : null;
  const tintedBg = ec ? ec.bg : inputBg;
  const tintedBorder = ec ? ec.border : borderColor;
  const tintedText = ec ? ec.textTitle : "var(--text)";
  const noteAch = entryColor
    ? achromaticStyle(resolveNoteHex(entryColor), dark)
    : null;
  const notePlaceholderClass = noteAch
    ? `placeholder-note-${noteAch.tier}`
    : undefined;

  return (
    <DraggableCard id={entry.id} dark={dark}>
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setHoveredEntryId(entry.id)}
        onMouseLeave={() => setHoveredEntryId(null)}
      >
        <TextareaAutosize
          value={entry.text}
          onChange={(e) => updateEntry(entry.id, e.target.value)}
          onHeightChange={(h) => handleNoteHeightChange(entry.id, h)}
          onKeyDown={handleKey}
          placeholder={idx === 0 ? t("notePlaceholder") : t("anotherNote")}
          minRows={1}
          className={notePlaceholderClass}
          style={{
            width: "100%",
            resize: "none",
            outline: "none",
            border: `1.5px solid ${tintedBorder}`,
            borderRadius: 12,
            padding: "10px 60px 10px 16px",
            fontSize: 14,
            lineHeight: 1.55,
            fontFamily: "inherit",
            background: tintedBg,
            color: tintedText,
            boxSizing: "border-box",
            display: "block",
            overflow: "hidden",
            transition: "background 200ms ease, border-color 200ms ease",
            cursor: "text",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: (noteHeights[entry.id] ?? 44) > 44 ? 8 : "50%",
            transform:
              (noteHeights[entry.id] ?? 44) > 44 ? "none" : "translateY(-50%)",
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "top 150ms",
            opacity:
              hoveredEntryId === entry.id || colorPickerEntryId === entry.id
                ? 1
                : 0,
            pointerEvents:
              hoveredEntryId === entry.id || colorPickerEntryId === entry.id
                ? "auto"
                : "none",
            isolation: "isolate",
          }}
        >
          <button
            ref={(el) => {
              colorBtnRefs.current[entry.id] = el;
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleColorPicker(entry.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
            aria-label={`${t("chooseColor")} — ${entriesCount > 1 ? `${t("note")} ${idx + 1}` : t("note")}`}
            data-testid={`note-color-btn-${idx}`}
            style={{
              width: 19,
              height: 19,
              borderRadius: 999,
              flexShrink: 0,
              background: normaliseGrey(entryColor) || "transparent",
              border: "none",
              boxShadow: entryColor
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
              marginRight: 1,
            }}
          >
            {!entryColor && (
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
          <button
            onClick={() => setConfirmDeleteEntryId(entry.id)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: "none",
              background: dark ? "rgba(255,59,48,0.15)" : "rgba(255,59,48,0.1)",
              color: "#ff3b30",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: hoveredEntryId === entry.id ? 1 : 0,
              pointerEvents: hoveredEntryId === entry.id ? "auto" : "none",
              transition: "opacity 150ms, background 0.1s",
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
    </DraggableCard>
  );
}

// ─── DraggableCard ────────────────────────────────────────────────────────────
// Generic drag-handle wrapper reused by both notes and events: a fixed-width
// grip strip triggers the reorder drag (instantly on mouse, after a brief
// press-and-hold on touch) while the wrapped content keeps its own clicks,
// text editing, etc. untouched.
function DraggableCard({
  id,
  dark,
  children,
}: {
  id: string;
  dark: boolean;
  children: React.ReactNode;
}) {
  const { t } = React.useContext(LangContext);
  const dragControls = useDragControls();
  const holdTimer = useRef<number | null>(null);
  const holdStartPos = useRef<{ x: number; y: number } | null>(null);
  const [handleHover, setHandleHover] = useState(false);
  // Cleanup long-press timer on unmount
  useEffect(
    () => () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current);
        holdTimer.current = null;
        document.body.style.userSelect = "";
        (document.body.style as any).webkitUserSelect = "";
      }
    },
    [],
  );
  const clearHoldTimer = () => {
    const wasHolding = holdTimer.current !== null;
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdStartPos.current = null;
    // If the hold was cancelled before drag started, restore selection.
    // If drag already started (timer fired, holdTimer = null), onDragEnd handles cleanup.
    if (wasHolding) {
      document.body.style.userSelect = "";
      (document.body.style as any).webkitUserSelect = "";
    }
  };
  const startDragFromHandle = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      holdStartPos.current = { x: e.clientX, y: e.clientY };
      // Suppress text selection immediately so moving the finger during the
      // hold period doesn't select text on sibling nodes.
      document.body.style.userSelect = "none";
      (document.body.style as any).webkitUserSelect = "none";
      holdTimer.current = window.setTimeout(() => {
        dragControls.start(e);
      }, NOTE_LONG_PRESS_MS);
    } else {
      dragControls.start(e);
    }
  };
  const cancelHoldOnMove = (e: React.PointerEvent) => {
    if (holdTimer.current === null || !holdStartPos.current) return;
    const dx = Math.abs(e.clientX - holdStartPos.current.x);
    const dy = Math.abs(e.clientY - holdStartPos.current.y);
    if (
      dx > NOTE_LONG_PRESS_MOVE_TOLERANCE ||
      dy > NOTE_LONG_PRESS_MOVE_TOLERANCE
    )
      clearHoldTimer();
  };
  return (
    <Reorder.Item
      value={id}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
        zIndex: 5,
      }}
      style={{ overflow: "visible", listStyle: "none" }}
      // Dragging the handle moves the pointer across sibling textareas/inputs
      // while the mouse button is held — the browser's default is to treat
      // that as a text selection. Suspend selection app-wide for the drag.
      onDragStart={() => {
        document.body.style.userSelect = "none";
        document.body.style.webkitUserSelect = "none" as any;
      }}
      onDragEnd={() => {
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "" as any;
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          gap: 2,
        }}
      >
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
          style={{
            width: 16,
            flexShrink: 0,
            borderRadius: 8,
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
            background: handleHover
              ? dark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.045)"
              : "transparent",
            transition: "background 150ms",
          }}
        >
          <svg
            width="8"
            height="16"
            viewBox="0 0 8 16"
            fill={dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.32)"}
          >
            <circle cx="2" cy="2" r="1.3" />
            <circle cx="6" cy="2" r="1.3" />
            <circle cx="2" cy="8" r="1.3" />
            <circle cx="6" cy="8" r="1.3" />
            <circle cx="2" cy="14" r="1.3" />
            <circle cx="6" cy="14" r="1.3" />
          </svg>
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </div>
    </Reorder.Item>
  );
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({
  dateKey: dk,
  initial,
  dark,
  modalBg,
  dayMilestones,
  initDayGoals,
  tomorrowInitGoals,
  dayTemplates,
  onSaveTemplates,
  onMilestoneUpdate,
  onMilestoneAdd,
  onMilestoneDelete,
  onMilestoneReorder,
  onDayGoalsChange,
  onCopyGoalsTo,
  onSave,
  onClose,
}: {
  dateKey: string;
  initial: NoteEntry[];
  dark: boolean;
  modalBg: string;
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
  onSave: (entries: NoteEntry[]) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<NoteEntry[]>(() => initial);
  const entriesRef = useRef(entries);
  const commitEntries = (next: NoteEntry[]) => {
    entriesRef.current = next;
    setEntries(next);
    onSave(next);
  };
  const [goalsDraft, setGoalsDraft] = useState<DayGoals>(
    () => initDayGoals ?? { count: 0, done: [] },
  );
  // React may batch several taps into one render on mobile. Keep the latest
  // draft synchronously so a second fast tap never builds on stale state.
  const goalsDraftRef = useRef(goalsDraft);
  const commitGoalsDraft = (next: DayGoals) => {
    goalsDraftRef.current = next;
    setGoalsDraft(next);
    onDayGoalsChange(next);
  };
  // Goals are stored as parallel arrays (no per-item id), but drag-reorder
  // needs a stable identity per item that survives position changes. This
  // local, non-persisted id list tracks 1:1 with goalsDraft's slots and is
  // kept in sync everywhere the slot count changes.
  const [goalIds, setGoalIds] = useState<string[]>(() =>
    Array.from({ length: initDayGoals?.count ?? 0 }, () => makeId()),
  );
  const handleGoalAdd = () => {
    const current = goalsDraftRef.current;
    const n = current.count + 1;
    const newDone = [...current.done, false];
    const newLabels = [
      ...(current.labels ?? Array(current.count).fill("")),
      "",
    ];
    const newColors = [
      ...(current.colors ?? Array(current.count).fill(undefined)),
      undefined,
    ];
    const g: DayGoals = {
      count: n,
      done: newDone,
      labels: newLabels,
      colors: newColors,
    };
    commitGoalsDraft(g);
    setGoalIds((prev) => [...prev, makeId()]);
  };
  const handleGoalReorder = (newIds: string[]) => {
    const current = goalsDraftRef.current;
    const perm = newIds.map((id) => goalIds.indexOf(id));
    const reorder = <T,>(arr: T[]): T[] => perm.map((idx) => arr[idx]);
    const newDone = reorder(
      Array.from({ length: current.count }, (_, i) => current.done[i] ?? false),
    );
    const newLabels = reorder(
      Array.from(
        { length: current.count },
        (_, i) => current.labels?.[i] ?? "",
      ),
    );
    const newColors = reorder(
      Array.from({ length: current.count }, (_, i) => current.colors?.[i]),
    );
    const g: DayGoals = {
      count: current.count,
      done: newDone,
      labels: newLabels,
      colors: newColors,
    };
    commitGoalsDraft(g);
    setGoalIds(newIds);
  };
  const handleGoalToggle = (i: number) => {
    const current = goalsDraftRef.current;
    const newDone = Array.from({ length: current.count }, (_, j) =>
      j === i ? !(current.done[j] ?? false) : (current.done[j] ?? false),
    );
    const g: DayGoals = { ...current, done: newDone };
    commitGoalsDraft(g);
    if (newDone.every(Boolean) && newDone.length > 0)
      setTimeout(fireConfettiCannons, 80);
  };
  const handleGoalLabelChange = (i: number, value: string) => {
    const current = goalsDraftRef.current;
    const newLabels = Array.from({ length: current.count }, (_, j) =>
      j === i ? value : (current.labels?.[j] ?? ""),
    );
    const g: DayGoals = { ...current, labels: newLabels };
    commitGoalsDraft(g);
  };
  const handleGoalColorChange = (i: number, color: string | undefined) => {
    const current = goalsDraftRef.current;
    const newColors: (string | undefined)[] = Array.from(
      { length: current.count },
      (_, j) => (j === i ? color : current.colors?.[j]),
    );
    const g: DayGoals = { ...current, colors: newColors };
    commitGoalsDraft(g);
    setGoalColorPickerIdx(null);
  };
  const handleGoalDelete = (i: number) => {
    const current = goalsDraftRef.current;
    const newCount = current.count - 1;
    if (newCount < 0) return;
    const newDone = current.done.filter((_, j) => j !== i);
    const newLabels = (current.labels ?? []).filter((_, j) => j !== i);
    const newColors = (current.colors ?? []).filter((_, j) => j !== i);
    const g: DayGoals = {
      count: newCount,
      done: newDone,
      labels: newLabels,
      colors: newColors,
    };
    commitGoalsDraft(g);
    setGoalIds((prev) => prev.filter((_, j) => j !== i));
  };
  const [hoveredGoalIdx, setHoveredGoalIdx] = useState<number | null>(null);
  const [goalColorPickerIdx, setGoalColorPickerIdx] = useState<number | null>(
    null,
  );
  const [goalColorPickerPos, setGoalColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const goalColorBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const goalColorPopoverRef = useRef<HTMLDivElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteGoalIdx, setConfirmDeleteGoalIdx] = useState<
    number | null
  >(null);
  const handleGoalReset = () => {
    const g: DayGoals = { count: 0, done: [], labels: [], isDeleted: true };
    commitGoalsDraft(g);
    setConfirmReset(false);
    setGoalIds([]);
  };
  const [templateMgrOpen, setTemplateMgrOpen] = useState(false);
  const [saveTplPrefill, setSaveTplPrefill] = useState<string[] | null>(null);
  const applyTemplate = (tpl: DayTemplate) => {
    const items = tpl.items.filter((s) => s.trim());
    const n = Math.max(1, items.length);
    const g: DayGoals = {
      count: n,
      done: Array(n).fill(false),
      labels: items.slice(0, n),
    };
    commitGoalsDraft(g);
    setTemplateMgrOpen(false);
    setGoalIds(Array.from({ length: n }, () => makeId()));
  };
  const [copiedTomorrow, setCopiedTomorrow] = useState(false);
  const [confirmCopyTomorrow, setConfirmCopyTomorrow] = useState(false);
  const tomorrowDk = (() => {
    const [yr, mo, dy] = dk.split("-").map(Number) as [number, number, number];
    const t = new Date(yr, mo - 1, dy + 1);
    return dateKey(t);
  })();
  const tomorrowAlreadyHasGoals = (tomorrowInitGoals?.count ?? 0) > 0;
  const doCopyToTomorrow = () => {
    const current = goalsDraftRef.current;
    const g: DayGoals = {
      count: current.count,
      done: Array(current.count).fill(false),
      labels: current.labels ? [...current.labels] : [],
    };
    onCopyGoalsTo(tomorrowDk, g);
    setCopiedTomorrow(true);
    setConfirmCopyTomorrow(false);
    setTimeout(() => setCopiedTomorrow(false), 1800);
  };
  const handleCopyToTomorrow = () => {
    if (tomorrowAlreadyHasGoals) {
      setConfirmCopyTomorrow(true);
    } else {
      doCopyToTomorrow();
    }
  };
  const _doneSlice = goalsDraft.done.slice(0, goalsDraft.count);
  const allGoalsDone =
    goalsDraft.count > 0 &&
    _doneSlice.length === goalsDraft.count &&
    _doneSlice.every(Boolean);
  const colorBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [colorPickerEntryId, setColorPickerEntryId] = useState<string | null>(
    null,
  );
  const [colorPickerPos, setColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const toggleColorPicker = (id: string) => {
    if (colorPickerEntryId === id) {
      setColorPickerEntryId(null);
      return;
    }
    const btn = colorBtnRefs.current[id];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setColorPickerPos({ top: rect.bottom + 7, left: rect.right - 152 });
    }
    setColorPickerEntryId(id);
  };

  // Note height tracking is now delegated entirely to <TextareaAutosize>
  // (react-textarea-autosize), which measures scrollHeight itself and keeps
  // it in sync via a ResizeObserver — no manual rAF/height-hack juggling.
  // We only keep the resulting heights around to position the hover-overlay
  // buttons (color/delete) below the placeholder-height threshold.
  const [noteHeights, setNoteHeights] = useState<Record<string, number>>({});
  const handleNoteHeightChange = (id: string, h: number) => {
    setNoteHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  };

  // Same idea as noteHeights above, but for day-goal rows: lets the hover
  // overlay (color/delete buttons) pin to the top-right corner once the goal
  // label wraps onto 2+ lines, instead of overlapping the wrapped text.
  const [goalHeights, setGoalHeights] = useState<Record<number, number>>({});
  const handleGoalHeightChange = (i: number, h: number) => {
    setGoalHeights((prev) => (prev[i] === h ? prev : { ...prev, [i]: h }));
  };

  // Track whether a day-event's title wraps onto 2+ lines, so the edit/delete
  // buttons can stack vertically (delete on top, edit below) instead of side by side.

  const { t, lang } = React.useContext(LangContext);

  // Milestone inline edit state
  const msEditRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const [msEditId, setMsEditId] = useState<string | null>(null);
  const [msEditLabel, setMsEditLabel] = useState("");
  const [msEditDate, setMsEditDate] = useState("");
  const [msEditColor, setMsEditColor] = useState("");
  const [msEditDesc, setMsEditDesc] = useState("");
  const [msEditRecurring, setMsEditRecurring] = useState(false);
  const [msEditRecurSpinKey, setMsEditRecurSpinKey] = useState(0);
  const msEditColorBtnRefs = React.useRef<Map<string, HTMLButtonElement>>(
    new Map(),
  );
  const msEditColorPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const [msEditColorPickerOpen, setMsEditColorPickerOpen] = useState(false);
  const [msEditColorPickerPos, setMsEditColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // New event form state
  const addEventFormRef = React.useRef<HTMLDivElement | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState(dk);
  const [newColor, setNewColor] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRecurSpinKey, setNewRecurSpinKey] = useState(0);
  const newColorBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const newColorPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const [newColorPickerOpen, setNewColorPickerOpen] = useState(false);
  const [newColorPickerPos, setNewColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const submitNewEvent = () => {
    if (!newLabel.trim()) return;
    onMilestoneAdd({
      id: makeId(),
      label: newLabel.trim(),
      date: newDate,
      color: newColor,
      description: newDesc.trim() || undefined,
      recurring: newRecurring || undefined,
    });
    setNewLabel("");
    setNewDesc("");
    setNewRecurring(false);
    setNewColor("");
    setNewDate(dk);
    setAddEventOpen(false);
  };

  const startMsEdit = (ms: Milestone) => {
    setMsEditId(ms.id);
    setMsEditLabel(ms.label);
    setMsEditDate(ms.date);
    setMsEditColor(ms.color);
    setMsEditDesc(ms.description ?? "");
    setMsEditRecurring(ms.recurring ?? false);
  };
  const saveMsEdit = () => {
    if (!msEditLabel.trim() || !msEditId) return;
    const orig = dayMilestones.find((m) => m.id === msEditId);
    if (orig)
      onMilestoneUpdate({
        ...orig,
        label: msEditLabel.trim(),
        date: msEditDate,
        color: msEditColor,
        description: msEditDesc.trim() || undefined,
        recurring: msEditRecurring || undefined,
      });
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
    if (!addEventOpen) return;
    const handler = (e: MouseEvent) => {
      const popover = newColorPopoverRef.current;
      if (popover && popover.contains(e.target as Node)) return;
      if (
        addEventFormRef.current &&
        !addEventFormRef.current.contains(e.target as Node)
      ) {
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
      const btn = msEditId
        ? (msEditColorBtnRefs.current.get(msEditId) ?? null)
        : null;
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

  const [y, m, d] = dk.split("-").map(Number) as [number, number, number];
  const label = new Date(y, m - 1, d).toLocaleDateString(
    lang === "ru" ? "ru-RU" : "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)";
  const inputStyleMs: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: "6px 9px",
    fontSize: 12,
    color: "var(--text)",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const addEntry = () => {
    const id = makeId();
    commitEntries([
      ...entriesRef.current,
      { id, text: "", ...newTimestamps() },
    ]);
  };
  const updateEntry = (id: string, text: string) =>
    commitEntries(
      entriesRef.current.map((e) => (e.id === id ? { ...e, text } : e)),
    );
  const updateEntryColor = (id: string, color: string | undefined) =>
    commitEntries(
      entriesRef.current.map((e) => (e.id === id ? { ...e, color } : e)),
    );
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<
    string | null
  >(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const [confirmDeleteMsIdDay, setConfirmDeleteMsIdDay] = useState<
    string | null
  >(null);
  const [hoveredMsId, setHoveredMsId] = useState<string | null>(null);
  const deleteEntry = (id: string) => {
    commitEntries(entriesRef.current.filter((e) => e.id !== id));
    setConfirmDeleteEntryId(null);
  };
  const handleReorderEntryIds = (newIds: string[]) => {
    commitEntries(
      newIds.map((id) => entriesRef.current.find((e) => e.id === id)!),
    );
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (templateMgrOpen) {
    return (
      <DayTemplatesModal
        dark={dark}
        modalBg={modalBg}
        templates={dayTemplates}
        onSave={onSaveTemplates}
        onApply={applyTemplate}
        prefillItems={saveTplPrefill ?? undefined}
        onClose={() => {
          setTemplateMgrOpen(false);
          setSaveTplPrefill(null);
        }}
        onCloseAll={onClose}
      />
    );
  }

  return (
    <motion.div
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ overflowY: "auto", overscrollBehavior: "contain" }}
      onClick={() => {
        setColorPickerEntryId(null);
        onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.32)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => {
          e.stopPropagation();
          if (colorPickerEntryId !== null) setColorPickerEntryId(null);
        }}
        style={{
          position: "relative",
          width: "min(92vw,400px)",
          background: modalBg,
          backdropFilter: "saturate(180%) blur(24px)",
          WebkitBackdropFilter: "saturate(180%) blur(24px)",
          borderRadius: 22,
          boxShadow: `0 8px 48px rgba(0,0,0,0.26), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100svh - 2rem)",
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: "var(--text)" }}
              >
                {label}
              </span>
            </div>
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

        {/* Scrollable body */}
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
          {/* Daily Goals */}
          <div
            className="px-5 pt-1 shrink-0"
            style={{
              borderBottom: "1px solid var(--border-soft)",
              paddingBottom: 12,
            }}
          >
            {/* Header row — only appears once goals exist */}
            {goalsDraft.count > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "nowrap",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 6,
                  marginBottom: 8,
                  userSelect: "none",
                }}
              >
                <span
                  className="text-[10px] font-semibold tracking-widest uppercase"
                  style={{
                    color: "var(--text-tertiary)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {t("dailyGoals")}
                </span>
                {!confirmReset && !confirmCopyTomorrow && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTemplateMgrOpen(true);
                    }}
                    title={t("applyTemplateBtn")}
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "var(--text-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="4" rx="1" />
                      <rect x="3" y="10" width="18" height="4" rx="1" />
                      <rect x="3" y="17" width="11" height="4" rx="1" />
                    </svg>
                  </button>
                )}
                {goalsDraft.count > 0 &&
                  !confirmReset &&
                  !confirmCopyTomorrow &&
                  dayTemplates.length < 20 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const labels = (goalsDraft.labels ?? [])
                          .slice(0, goalsDraft.count)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const items =
                          labels.length > 0
                            ? labels
                            : Array.from(
                                { length: goalsDraft.count },
                                (_, i) => `${t("goal")} ${i + 1}`,
                              );
                        setSaveTplPrefill(items);
                        setTemplateMgrOpen(true);
                      }}
                      title={t("saveAsTemplate")}
                      style={{
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                    </button>
                  )}
                {goalsDraft.count > 0 && !confirmReset && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyToTomorrow();
                    }}
                    title={t("copyToTomorrow")}
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: copiedTomorrow
                        ? "#34c759"
                        : "var(--text-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      transition: "color 200ms",
                    }}
                  >
                    {copiedTomorrow ? (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="10"
                        height="9"
                        viewBox="0 0 11 10"
                        fill="none"
                      >
                        <rect
                          x="0.5"
                          y="0.5"
                          width="7"
                          height="7"
                          rx="1.5"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <path
                          d="M3 3h7v7H3z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    )}
                  </button>
                )}
                {goalsDraft.count > 0 && !confirmReset && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmReset(true);
                    }}
                    title={t("resetGoals")}
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#ff3b30",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <span
                      style={{ fontSize: 12, lineHeight: 1, fontWeight: 400 }}
                    >
                      ↺
                    </span>
                  </button>
                )}
                {/* Spacer */}
                <div style={{ flex: 1 }} />
                {/* Progress pill */}
                {goalsDraft.count > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: allGoalsDone ? "#34c759" : "var(--text-tertiary)",
                      background: allGoalsDone
                        ? dark
                          ? "rgba(52,199,89,0.18)"
                          : "rgba(52,199,89,0.12)"
                        : dark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.06)",
                      borderRadius: 99,
                      padding: "1px 7px",
                      flexShrink: 0,
                      transition: "color 200ms, background 200ms",
                    }}
                  >
                    {goalsDraft.done.filter(Boolean).length}/{goalsDraft.count}
                  </span>
                )}
              </div>
            )}
            {/* Progress bar */}
            {goalsDraft.count > 0 && (
              <div
                className="h-1 rounded-full overflow-hidden mb-2"
                style={{
                  background: dark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.07)",
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    width: `${(goalsDraft.done.filter(Boolean).length / goalsDraft.count) * 100}%`,
                  }}
                  transition={{ type: "spring", stiffness: 120, damping: 24 }}
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "#34c759",
                  }}
                />
              </div>
            )}
            {/* Body — always shown */}
            <div style={{ overflow: "visible" }}>
              {/* Confirm dialogs (copy-to-tomorrow / reset) */}
              {(confirmCopyTomorrow || confirmReset) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  {confirmCopyTomorrow ? (
                    <>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          flexShrink: 0,
                        }}
                      >
                        {t("tomorrowHasGoals")}
                      </span>
                      <button
                        onClick={() => setConfirmCopyTomorrow(false)}
                        style={{
                          fontSize: 11,
                          padding: "1px 7px",
                          borderRadius: 5,
                          border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
                          background: "transparent",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          flexShrink: 0,
                        }}
                      >
                        {t("no")}
                      </button>
                      <button
                        onClick={doCopyToTomorrow}
                        style={{
                          fontSize: 11,
                          padding: "1px 7px",
                          borderRadius: 5,
                          border: "none",
                          background: "#007aff",
                          color: "white",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {t("replace")}
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          flexShrink: 0,
                        }}
                      >
                        {t("deleteConfirm")}
                      </span>
                      <button
                        onClick={() => setConfirmReset(false)}
                        style={{
                          fontSize: 11,
                          padding: "1px 7px",
                          borderRadius: 5,
                          border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
                          background: "transparent",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          flexShrink: 0,
                        }}
                      >
                        {t("no")}
                      </button>
                      <button
                        onClick={handleGoalReset}
                        style={{
                          fontSize: 11,
                          padding: "1px 7px",
                          borderRadius: 5,
                          border: "none",
                          background: "#ff3b30",
                          color: "white",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {t("remove")}
                      </button>
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
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                >
                  <AnimatePresence initial={false}>
                    {Array.from({ length: goalsDraft.count }, (_, i) => {
                      const done = goalsDraft.done[i] ?? false;
                      const goalColor = goalsDraft.colors?.[i];
                      const ec = getEventColors(goalColor ?? "", dark);
                      const containerBg = ec.bg;
                      const containerBorder = ec.border;
                      const textColor = done
                        ? "var(--text-tertiary)"
                        : ec.textTitle;
                      const isHovered = hoveredGoalIdx === i;
                      const isColorOpen = goalColorPickerIdx === i;
                      const goalId = goalIds[i] ?? `goal-fallback-${i}`;
                      return (
                        <DraggableCard key={goalId} id={goalId} dark={dark}>
                          <div
                            onMouseEnter={() => setHoveredGoalIdx(i)}
                            onMouseLeave={() => setHoveredGoalIdx(null)}
                            style={{
                              position: "relative",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              background: containerBg,
                              border: `1.5px solid ${containerBorder}`,
                              borderRadius: 12,
                              padding: "8px 59px 8px 10px",
                              boxShadow: ec.boxShadow || undefined,
                              transition:
                                "background 150ms ease, border-color 150ms ease",
                            }}
                          >
                            {(() => {
                              const _cbAch = goalColor
                                ? goalCheckboxAchromaticStyle(
                                    resolveNoteHex(goalColor),
                                    dark,
                                  )
                                : null;
                              const checkColor = _cbAch
                                ? _cbAch.bg
                                : (goalColor ?? "#34c759");
                              const uncheckedBorder = goalColor
                                ? _cbAch
                                  ? _cbAch.border
                                  : `${goalColor}80`
                                : "var(--border-soft)";
                              return (
                                <div
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleGoalToggle(i);
                                  }}
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 5,
                                    flexShrink: 0,
                                    background: done
                                      ? checkColor
                                      : "transparent",
                                    border: `1.5px solid ${done ? checkColor : uncheckedBorder}`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition:
                                      "background 150ms ease, border-color 150ms ease",
                                    cursor: "pointer",
                                  }}
                                >
                                  {done && (
                                    <svg
                                      width="10"
                                      height="8"
                                      viewBox="0 0 10 8"
                                      fill="none"
                                    >
                                      <path
                                        d="M1 4l3 3 5-6"
                                        stroke={swatchCheckColor(checkColor)}
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                              );
                            })()}
                            <TextareaAutosize
                              value={goalsDraft.labels?.[i] ?? ""}
                              onChange={(e) =>
                                handleGoalLabelChange(i, e.target.value)
                              }
                              onHeightChange={(h) =>
                                handleGoalHeightChange(i, h)
                              }
                              onMouseDown={(e) => {
                                if (goalColorPickerIdx !== null)
                                  setGoalColorPickerIdx(null);
                                e.stopPropagation();
                              }}
                              placeholder={`${t("goal")} ${i + 1}`}
                              minRows={1}
                              style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                resize: "none",
                                overflow: "hidden",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                fontSize: 13,
                                color: textColor,
                                textDecoration: done ? "line-through" : "none",
                                opacity: done ? 0.55 : 1,
                                transition: "color 150ms, opacity 150ms",
                                lineHeight: 1.35,
                                fontFamily: "inherit",
                                padding: 0,
                                cursor: "text",
                                minWidth: 0,
                                display: "block",
                                boxSizing: "border-box",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: (goalHeights[i] ?? 18) > 20 ? 8 : "50%",
                                transform:
                                  (goalHeights[i] ?? 18) > 20
                                    ? "none"
                                    : "translateY(-50%)",
                                right: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                transition: "top 150ms",
                                opacity: isHovered || isColorOpen ? 1 : 0,
                                pointerEvents:
                                  isHovered || isColorOpen ? "auto" : "none",
                                isolation: "isolate",
                              }}
                            >
                              <button
                                ref={(el) => {
                                  goalColorBtnRefs.current[i] = el;
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (goalColorPickerIdx === i) {
                                    setGoalColorPickerIdx(null);
                                    return;
                                  }
                                  const btn = goalColorBtnRefs.current[i];
                                  if (btn) {
                                    setGoalColorPickerPos(
                                      clampedPopoverPos(
                                        btn.getBoundingClientRect(),
                                        136,
                                        100,
                                      ),
                                    );
                                  }
                                  setGoalColorPickerIdx(i);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                title={t("chooseColor")}
                                aria-label={t("chooseColor")}
                                style={{
                                  width: 19,
                                  height: 19,
                                  borderRadius: 999,
                                  flexShrink: 0,
                                  background:
                                    normaliseGrey(goalColor) || "transparent",
                                  border: "none",
                                  boxShadow: goalColor
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
                                  marginRight: 1,
                                }}
                              >
                                {!goalColor && (
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteGoalIdx(i);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 999,
                                  border: "none",
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
                        </DraggableCard>
                      );
                    })}
                  </AnimatePresence>
                </Reorder.Group>
              )}
              {goalsDraft.count > 0 && allGoalsDone && (
                <div
                  className="mt-0.5 text-center text-[12px] font-semibold"
                  style={{ color: "#34c759" }}
                >
                  {t("allDone")}
                </div>
              )}
              {!confirmCopyTomorrow && !confirmReset && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoalAdd();
                  }}
                  style={{
                    width: "100%",
                    height: 32,
                    borderRadius: 9,
                    border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"}`,
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    marginTop: goalsDraft.count > 0 ? 8 : 0,
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>{" "}
                  {t("addGoal")}
                </button>
              )}
              {goalColorPickerIdx !== null &&
                goalColorPickerPos &&
                ReactDOM.createPortal(
                  <motion.div
                    key="goal-color-popover"
                    ref={goalColorPopoverRef}
                    initial={{ opacity: 0, scale: 0.94, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "fixed",
                      top: goalColorPickerPos.top,
                      left: goalColorPickerPos.left,
                      zIndex: 300,
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
                      style={{ position: "fixed", inset: 0, zIndex: -1 }}
                      onClick={() => setGoalColorPickerIdx(null)}
                    />
                    <ColorSwatchGrid
                      colors={APPLE_COLORS.map((ac) => ({
                        key: ac.key,
                        hex: dark ? ac.dark : ac.light,
                        label: ac.label,
                      }))}
                      selected={goalsDraft.colors?.[goalColorPickerIdx] ?? null}
                      onSelect={(hex) =>
                        handleGoalColorChange(goalColorPickerIdx, hex)
                      }
                      onClear={() =>
                        handleGoalColorChange(goalColorPickerIdx, undefined)
                      }
                      clearLabel={t("noColor")}
                      dark={dark}
                    />
                  </motion.div>,
                  document.body,
                )}
            </div>
          </div>

          {/* Milestones for this day */}
          {dayMilestones.length > 0 && (
            <div className="px-5 pt-3 pb-0 shrink-0">
              <div
                className="text-[10px] font-semibold tracking-widest uppercase mb-1.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t("events")}
              </div>
              <Reorder.Group
                as="div"
                axis="y"
                values={dayMilestones.map((ms) => ms.id)}
                onReorder={onMilestoneReorder}
                className="flex flex-col gap-1.5"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                <AnimatePresence initial={false}>
                  {dayMilestones.map((ms) => {
                    const isEditing = msEditId === ms.id;
                    const ec2 = getEventColors(
                      isEditing ? msEditColor : ms.color,
                      dark,
                    );
                    const cardBg = ec2.bg;
                    const cardBdr = isEditing ? ec2.borderEditing : ec2.border;
                    const cardTxt = ec2.textTitle;
                    const cardFormTxt = ec2.textTitle;
                    const cardFormSec = ec2.textDesc;
                    const cardFormBdr = ec2.formBorder;
                    const cardFormBg = ec2.formBg;
                    const hovering = hoveredMsId === ms.id && !isEditing;
                    return (
                      <DraggableCard key={ms.id} id={ms.id} dark={dark}>
                        <div
                          style={{
                            position: "relative",
                            borderRadius: 12,
                            overflow: "hidden",
                            background: cardBg,
                            border: `1.5px solid ${ec2.border || "transparent"}`,
                            boxShadow: ec2.boxShadow || undefined,
                            transition:
                              "background 0.25s ease, border-color 0.25s ease",
                          }}
                          onMouseEnter={() => setHoveredMsId(ms.id)}
                          onMouseLeave={() => setHoveredMsId(null)}
                        >
                          {/* View row — collapses when editing */}
                          <div
                            style={{
                              maxHeight: isEditing ? 0 : "none",
                              opacity: isEditing ? 0 : 1,
                              overflow: "hidden",
                              transition:
                                "max-height 0.3s ease-in-out, opacity 0.18s ease-in-out",
                              pointerEvents: isEditing ? "none" : "auto",
                            }}
                          >
                            {/* Card view — pure CSS Flexbox, no JS measurement, no absolute positioning.
                           Card height = content height only (no min-height).
                           align-items:center → buttons auto-centre on short cards.
                           flex-wrap on buttons → × stays right, ✎ wraps below on tall cards. */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span
                                  className="text-[13px] font-semibold leading-snug"
                                  style={{
                                    color: cardTxt,
                                    wordBreak: "break-all",
                                    overflowWrap: "anywhere",
                                    display: "block",
                                  }}
                                >
                                  {ms.label}
                                </span>
                                {ms.description && (
                                  <div
                                    className="text-[11px] leading-snug"
                                    style={{
                                      marginTop: 3,
                                      color: cardFormSec,
                                      wordBreak: "break-all",
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {ms.description}
                                  </div>
                                )}
                                {ms.recurring && (
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 3,
                                      marginTop: 5,
                                      padding: "2px 6px 2px 4px",
                                      borderRadius: 5,
                                      background: dark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.05)",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 10,
                                        lineHeight: 1,
                                        color: cardFormSec,
                                        opacity: 0.7,
                                      }}
                                    >
                                      ↻
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        lineHeight: 1,
                                        color: cardFormSec,
                                        opacity: 0.65,
                                      }}
                                    >
                                      {t("repeatYearly")}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {/* Buttons in document flow — flex-wrap + row-reverse: × first in DOM = always top-right */}
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "row-reverse",
                                  flexWrap: "wrap",
                                  gap: 6,
                                  maxWidth: 70,
                                  flexShrink: 0,
                                  alignSelf: "flex-start",
                                  opacity: hovering ? 1 : 0,
                                  pointerEvents: hovering ? "auto" : "none",
                                  transition: "opacity 0.15s ease-in-out",
                                }}
                              >
                                <button
                                  onClick={() => setConfirmDeleteMsIdDay(ms.id)}
                                  title={t("remove")}
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 999,
                                    border: "none",
                                    background: dark
                                      ? "rgba(255,59,48,0.15)"
                                      : "rgba(255,59,48,0.1)",
                                    color: "#ff3b30",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
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
                                <button
                                  onClick={() => startMsEdit(ms)}
                                  title={t("edit")}
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 999,
                                    border: "none",
                                    background: dark
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0.07)",
                                    color: dark
                                      ? "rgba(255,255,255,0.8)"
                                      : "rgba(0,0,0,0.65)",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "background 0.1s",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = dark
                                      ? "rgba(255,255,255,0.18)"
                                      : "rgba(0,0,0,0.13)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = dark
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0.07)";
                                  }}
                                >
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Edit form — expands when editing */}
                          <div
                            ref={(el) => {
                              if (el) msEditRefs.current.set(ms.id, el);
                              else msEditRefs.current.delete(ms.id);
                            }}
                            style={{
                              maxHeight: isEditing ? "2000px" : 0,
                              opacity: isEditing ? 1 : 0,
                              overflow: "hidden",
                              transition:
                                "max-height 0.35s ease-in-out, opacity 0.22s ease-in-out",
                              pointerEvents: isEditing ? "auto" : "none",
                            }}
                          >
                            <div
                              className="flex flex-col gap-1.5"
                              style={{ padding: "8px 10px" }}
                            >
                              <div
                                className="flex gap-1.5"
                                style={{
                                  isolation: "isolate",
                                  alignItems: "flex-start",
                                }}
                              >
                                <TextareaAutosize
                                  value={msEditLabel}
                                  onChange={(e) =>
                                    setMsEditLabel(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      saveMsEdit();
                                    }
                                    if (e.key === "Escape") setMsEditId(null);
                                  }}
                                  placeholder={t("labelPlaceholder")}
                                  minRows={1}
                                  style={
                                    {
                                      ...inputStyleMs,
                                      flex: 1,
                                      minWidth: 0,
                                      resize: "none",
                                      overflow: "hidden",
                                      lineHeight: 1.5,
                                      color: cardFormTxt,
                                      background: cardFormBg,
                                      border: `1px solid ${cardFormBdr}`,
                                    } as any
                                  }
                                />
                              </div>
                              <div style={{ position: "relative" }}>
                                <TextareaAutosize
                                  value={msEditDesc}
                                  onChange={(e) =>
                                    setMsEditDesc(e.target.value)
                                  }
                                  placeholder={t("editDescPlaceholder")}
                                  minRows={2}
                                  style={
                                    {
                                      ...inputStyleMs,
                                      width: "100%",
                                      resize: "none",
                                      overflow: "hidden",
                                      lineHeight: 1.5,
                                      borderRadius: 8,
                                      padding: "5px 9px",
                                      display: "block",
                                      color: cardFormTxt,
                                      background: cardFormBg,
                                      border: `1px solid ${cardFormBdr}`,
                                    } as any
                                  }
                                />
                              </div>
                              {msEditColorPickerOpen &&
                                msEditColorPickerPos &&
                                ReactDOM.createPortal(
                                  <motion.div
                                    key="ms-edit-color-popover"
                                    ref={msEditColorPopoverRef}
                                    initial={{ opacity: 0, scale: 0.94, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 420,
                                      damping: 28,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: "fixed",
                                      top: msEditColorPickerPos.top,
                                      left: msEditColorPickerPos.left,
                                      zIndex: 300,
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
                                      onClick={() =>
                                        setMsEditColorPickerOpen(false)
                                      }
                                    />
                                    <ColorSwatchGrid
                                      colors={APPLE_COLORS.map((ac) => ({
                                        key: ac.key,
                                        hex: ac.light,
                                        label: ac.label,
                                      }))}
                                      selected={msEditColor || null}
                                      onSelect={(hex) => {
                                        setMsEditColor(
                                          msEditColor === hex ? "" : hex,
                                        );
                                        setMsEditColorPickerOpen(false);
                                      }}
                                      onClear={() => {
                                        setMsEditColor("");
                                        setMsEditColorPickerOpen(false);
                                      }}
                                      clearLabel={t("noColor")}
                                      dark={dark}
                                    />
                                  </motion.div>,
                                  document.body,
                                )}
                              <div className="flex items-center justify-between gap-2">
                                <div
                                  className="flex items-center gap-1.5"
                                  style={{
                                    isolation: "isolate",
                                    marginLeft: 2,
                                  }}
                                >
                                  <button
                                    ref={(el) => {
                                      if (el)
                                        msEditColorBtnRefs.current.set(
                                          ms.id,
                                          el,
                                        );
                                      else
                                        msEditColorBtnRefs.current.delete(
                                          ms.id,
                                        );
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (msEditColorPickerOpen) {
                                        setMsEditColorPickerOpen(false);
                                        return;
                                      }
                                      const btn =
                                        msEditColorBtnRefs.current.get(ms.id);
                                      if (btn) {
                                        setMsEditColorPickerPos(
                                          clampedPopoverPos(
                                            btn.getBoundingClientRect(),
                                            136,
                                            100,
                                          ),
                                        );
                                      }
                                      setMsEditColorPickerOpen(true);
                                    }}
                                    title={t("chooseColor")}
                                    style={{
                                      width: 19,
                                      height: 19,
                                      borderRadius: 999,
                                      flexShrink: 0,
                                      background:
                                        normaliseGrey(msEditColor) ||
                                        "transparent",
                                      border: "none",
                                      boxShadow: msEditColor
                                        ? "0 0 0 1.5px rgba(255,255,255,0.85), 0 1px 3px rgba(0,0,0,0.18)"
                                        : "0 0 0 1.5px var(--border-soft)",
                                      boxSizing: "border-box",
                                      cursor: "pointer",
                                      position: "relative",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    {!msEditColor && (
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
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = !msEditRecurring;
                                      setMsEditRecurring(next);
                                      if (next)
                                        setMsEditRecurSpinKey((k) => k + 1);
                                    }}
                                    title={t("repeatYearly")}
                                    style={{
                                      flexShrink: 0,
                                      width: 26,
                                      height: 26,
                                      borderRadius: 999,
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                      fontSize: 18,
                                      lineHeight: 1,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: msEditRecurring
                                        ? "var(--apple-green)"
                                        : cardFormSec,
                                      opacity: msEditRecurring ? 1 : 0.55,
                                      transition: "color 150ms, opacity 150ms",
                                    }}
                                  >
                                    <span
                                      key={msEditRecurSpinKey}
                                      className={
                                        msEditRecurring
                                          ? "recur-spin-once"
                                          : undefined
                                      }
                                      style={{ display: "inline-block" }}
                                    >
                                      ↻
                                    </span>
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setMsEditId(null)}
                                    style={{
                                      height: 26,
                                      padding: "0 10px",
                                      borderRadius: 7,
                                      border: `1px solid ${cardFormBdr}`,
                                      background: "transparent",
                                      color: cardFormSec,
                                      fontSize: 11,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {t("cancel")}
                                  </button>
                                  <button
                                    onClick={saveMsEdit}
                                    disabled={!msEditLabel.trim()}
                                    style={{
                                      height: 26,
                                      padding: "0 12px",
                                      borderRadius: 7,
                                      border: "none",
                                      background: msEditLabel.trim()
                                        ? "#007aff"
                                        : "rgba(128,128,128,0.15)",
                                      color: msEditLabel.trim()
                                        ? "white"
                                        : "var(--text-tertiary)",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: msEditLabel.trim()
                                        ? "pointer"
                                        : "default",
                                      fontFamily: "inherit",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {t("saveChanges")}
                                  </button>
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
          <div
            className={`px-5 ${dayMilestones.length > 0 ? "pt-1.5" : "pt-3"} pb-0 shrink-0`}
          >
            {/* Button — collapses when form open or limit reached */}
            <div
              style={{
                maxHeight:
                  addEventOpen || dayMilestones.length >= 10 ? 0 : "40px",
                opacity: addEventOpen || dayMilestones.length >= 10 ? 0 : 1,
                overflow: "hidden",
                transition:
                  "max-height 0.3s ease-in-out, opacity 0.18s ease-in-out",
                pointerEvents:
                  addEventOpen || dayMilestones.length >= 10 ? "none" : "auto",
              }}
            >
              <button
                onClick={() => setAddEventOpen(true)}
                style={{
                  width: "100%",
                  height: 32,
                  borderRadius: 9,
                  border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"}`,
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>{" "}
                {t("addEvent")}
              </button>
            </div>
            {/* Form — expands when open */}
            <div
              ref={addEventFormRef}
              style={{
                maxHeight: addEventOpen ? "2000px" : 0,
                opacity: addEventOpen ? 1 : 0,
                overflow: "hidden",
                transition:
                  "max-height 0.35s ease-in-out, opacity 0.22s ease-in-out",
                pointerEvents: addEventOpen ? "auto" : "none",
              }}
            >
              {(() => {
                const ecNew = getEventColors(newColor, dark);
                const cardBg = ecNew.bg;
                const cardBorder =
                  ecNew.border ||
                  (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)");
                const inputBg = ecNew.formBg;
                const inputBorder = `1px solid ${ecNew.formBorder}`;
                const inputText = ecNew.textTitle || "var(--text)";
                const inputStyle: React.CSSProperties = {
                  background: inputBg,
                  border: inputBorder,
                  borderRadius: 8,
                  padding: "6px 9px",
                  fontSize: 12,
                  color: inputText,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                };
                const labelText = ecNew.icon || "var(--text-secondary)";
                const cancelBorder = `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}`;
                const cancelColor = "var(--text-secondary)";
                const submitBg = newLabel.trim()
                  ? "#007aff"
                  : "rgba(128,128,128,0.15)";
                const submitColor = newLabel.trim()
                  ? "#ffffff"
                  : "var(--text-tertiary)";
                return (
                  <div
                    style={{
                      background: cardBg,
                      border: `1.5px solid ${cardBorder}`,
                      boxShadow: ecNew.boxShadow || undefined,
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      transition:
                        "background 0.25s ease, border-color 0.25s ease",
                    }}
                  >
                    <div
                      className="flex items-center gap-1.5"
                      style={{ isolation: "isolate" }}
                    >
                      <TextareaAutosize
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitNewEvent();
                          }
                          if (e.key === "Escape") setAddEventOpen(false);
                        }}
                        placeholder={t("labelPlaceholder")}
                        minRows={1}
                        style={
                          {
                            ...inputStyle,
                            flex: 1,
                            minWidth: 0,
                            resize: "none",
                            overflow: "hidden",
                            lineHeight: 1.5,
                          } as any
                        }
                      />
                    </div>
                    <div style={{ position: "relative" }}>
                      <TextareaAutosize
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder={t("descPlaceholder")}
                        minRows={2}
                        style={
                          {
                            ...inputStyle,
                            width: "100%",
                            resize: "none",
                            overflow: "hidden",
                            lineHeight: 1.5,
                            display: "block",
                          } as any
                        }
                      />
                    </div>
                    {newColorPickerOpen &&
                      newColorPickerPos &&
                      ReactDOM.createPortal(
                        <motion.div
                          key="new-event-color-popover"
                          ref={newColorPopoverRef}
                          initial={{ opacity: 0, scale: 0.94, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 28,
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "fixed",
                            top: newColorPickerPos.top,
                            left: newColorPickerPos.left,
                            zIndex: 300,
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
                            style={{ position: "fixed", inset: 0, zIndex: -1 }}
                            onClick={() => setNewColorPickerOpen(false)}
                          />
                          <ColorSwatchGrid
                            colors={APPLE_COLORS.map((ac) => ({
                              key: ac.key,
                              hex: ac.light,
                              label: ac.label,
                            }))}
                            selected={newColor || null}
                            onSelect={(hex) => {
                              setNewColor(newColor === hex ? "" : hex);
                              setNewColorPickerOpen(false);
                            }}
                            onClear={() => {
                              setNewColor("");
                              setNewColorPickerOpen(false);
                            }}
                            clearLabel={t("noColor")}
                            dark={dark}
                          />
                        </motion.div>,
                        document.body,
                      )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div
                        className="flex items-center gap-1.5"
                        style={{ isolation: "isolate", marginLeft: 2 }}
                      >
                        <button
                          ref={newColorBtnRef}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (newColorPickerOpen) {
                              setNewColorPickerOpen(false);
                              return;
                            }
                            const btn = newColorBtnRef.current;
                            if (btn) {
                              setNewColorPickerPos(
                                clampedPopoverPos(
                                  btn.getBoundingClientRect(),
                                  136,
                                  100,
                                ),
                              );
                            }
                            setNewColorPickerOpen(true);
                          }}
                          title={t("chooseColor")}
                          style={{
                            width: 19,
                            height: 19,
                            borderRadius: 999,
                            flexShrink: 0,
                            background:
                              normaliseGrey(newColor) || "transparent",
                            border: "none",
                            boxShadow: newColor
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
                          {!newColor && (
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
                        <button
                          type="button"
                          onClick={() => {
                            const next = !newRecurring;
                            setNewRecurring(next);
                            if (next) setNewRecurSpinKey((k) => k + 1);
                          }}
                          title={t("repeatYearly")}
                          style={{
                            flexShrink: 0,
                            width: 26,
                            height: 26,
                            borderRadius: 999,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: 18,
                            lineHeight: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: newRecurring
                              ? "var(--apple-green)"
                              : labelText,
                            opacity: newRecurring ? 1 : 0.55,
                            transition: "color 150ms, opacity 150ms",
                          }}
                        >
                          <span
                            key={newRecurSpinKey}
                            className={
                              newRecurring ? "recur-spin-once" : undefined
                            }
                            style={{ display: "inline-block" }}
                          >
                            ↻
                          </span>
                        </button>
                      </div>
                      <div
                        className="flex items-center gap-1.5"
                        style={{ marginLeft: "auto" }}
                      >
                        <button
                          onClick={() => setAddEventOpen(false)}
                          style={{
                            height: 28,
                            padding: "0 12px",
                            borderRadius: 7,
                            border: cancelBorder,
                            background: "transparent",
                            color: cancelColor,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            flexShrink: 0,
                          }}
                        >
                          {t("cancel")}
                        </button>
                        <button
                          onClick={submitNewEvent}
                          disabled={!newLabel.trim()}
                          style={{
                            height: 28,
                            padding: "0 14px",
                            borderRadius: 7,
                            border: "none",
                            background: submitBg,
                            color: submitColor,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: newLabel.trim() ? "pointer" : "default",
                            fontFamily: "inherit",
                            flexShrink: 0,
                          }}
                        >
                          {t("addEventBtn")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Divider between events/add-event and notes */}
          <div
            className="mt-3 h-px shrink-0"
            style={{ background: "var(--border-soft)" }}
          />

          {/* Notes section label — only appears once notes exist */}
          {entries.length > 0 && (
            <div className="px-5 pt-3 shrink-0">
              <div
                className="text-[10px] font-semibold tracking-widest uppercase mb-1.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t("notes")}
              </div>
            </div>
          )}

          {/* Notes list — drag the card itself to reorder (press-and-hold first on touch) */}
          {entries.length > 0 && (
            <div
              className="px-5 pb-2"
              onScroll={() => setColorPickerEntryId(null)}
            >
              <Reorder.Group
                as="div"
                axis="y"
                values={entries.map((e) => e.id)}
                onReorder={handleReorderEntryIds}
                className="flex flex-col gap-1.5"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
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
                      updateEntry={updateEntry}
                      handleNoteHeightChange={handleNoteHeightChange}
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
            <button
              onClick={addEntry}
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
              {t("addNote")}
            </button>
          </div>
        </div>
        {/* end scrollable body */}
      </motion.div>
      {colorPickerEntryId !== null &&
        colorPickerPos &&
        ReactDOM.createPortal(
          <motion.div
            key="color-popover"
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: colorPickerPos.top,
              left: colorPickerPos.left,
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
            <ColorSwatchGrid
              colors={APPLE_COLORS.map((ac) => ({
                key: ac.key,
                hex: dark ? ac.dark : ac.light,
                label: ac.label,
              }))}
              selected={
                entries.find((e) => e.id === colorPickerEntryId)?.color ?? null
              }
              onSelect={(hex) => {
                updateEntryColor(colorPickerEntryId, hex);
                setColorPickerEntryId(null);
              }}
              onClear={() => {
                updateEntryColor(colorPickerEntryId, undefined);
                setColorPickerEntryId(null);
              }}
              clearLabel={t("noColor")}
              dark={dark}
            />
          </motion.div>,
          document.body,
        )}
      <ConfirmDialog
        open={confirmDeleteEntryId !== null}
        onClose={() => setConfirmDeleteEntryId(null)}
        onConfirm={() => {
          if (confirmDeleteEntryId) deleteEntry(confirmDeleteEntryId);
        }}
        message={t("deleteEntryConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
      <ConfirmDialog
        open={confirmDeleteMsIdDay !== null}
        onClose={() => setConfirmDeleteMsIdDay(null)}
        onConfirm={() => {
          if (confirmDeleteMsIdDay) {
            onMilestoneDelete(confirmDeleteMsIdDay);
            setConfirmDeleteMsIdDay(null);
          }
        }}
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
        onConfirm={() => {
          if (confirmDeleteGoalIdx !== null) {
            handleGoalDelete(confirmDeleteGoalIdx);
            setConfirmDeleteGoalIdx(null);
          }
        }}
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
  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              background: "rgba(255,204,0,0.45)",
              color: "inherit",
              borderRadius: 3,
              padding: "0 1px",
            }}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ─── AllGoalsPanel ────────────────────────────────────────────────────────────

function AllGoalsPanel({
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
              {totalGoals > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    background: dark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                    borderRadius: 8,
                    padding: "2px 7px",
                  }}
                >
                  {doneGoals}/{totalGoals}
                </span>
              )}
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
                  {activeYearGoals.length > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        flexShrink: 0,
                      }}
                    >
                      {activeYearGoals.filter((g) => g.done).length}/
                      {activeYearGoals.length}
                    </span>
                  )}
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
                          <span
                            style={{
                              fontSize: 11,
                              color: qHeaderText,
                              opacity: 0.6,
                              flexShrink: 0,
                            }}
                          >
                            {qTotal}/{qAllTotal}
                          </span>
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
                                  background: qr.fill,
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
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: sprintHeaderText,
                                    opacity: 0.6,
                                    flexShrink: 0,
                                  }}
                                >
                                  {goals.filter((g) => g.done).length}/
                                  {goals.length}
                                </span>
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
                                      background: effectiveQ.fill,
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

function NotesPanel({
  notes,
  weeks,
  resolvedQuarters,
  dark,
  modalBg,
  onOpenNote,
  onAddNote,
  onDeleteDayNotes,
  onClose,
}: {
  notes: Record<string, NoteEntry[]>;
  weeks: { weekStart: Date; days: Date[] }[];
  resolvedQuarters: Quarter[];
  dark: boolean;
  modalBg: string;
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
  const [draftColorPickerPos, setDraftColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const draftColorBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [hoveredDk, setHoveredDk] = useState<string | null>(null);
  const [confirmDeleteDk, setConfirmDeleteDk] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    const qGroups: { dateKey: string; entries: NoteEntry[] }[][] = [
      [],
      [],
      [],
      [],
    ];
    const dateToQi: Record<string, number> = {};
    weeks.forEach((w, wi) => {
      const qi = Math.min(3, Math.floor(wi / WEEKS_PER_QUARTER));
      w.days.forEach((d) => {
        dateToQi[dateKey(d)] = qi;
      });
    });
    for (const [dk, allEntries] of Object.entries(notes)) {
      const activeEntries = allEntries.filter(
        (entry) => !entry.isDeleted && entry.text.trim(),
      );
      const entries = q
        ? activeEntries.filter((e) => e.text.toLowerCase().includes(q))
        : activeEntries;
      if (!entries.length) continue;
      const qi = dateToQi[dk] ?? -1;
      if (qi >= 0) qGroups[qi]!.push({ dateKey: dk, entries });
    }
    qGroups.forEach((g) =>
      g.sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    );
    return qGroups;
  }, [notes, weeks, q]);

  const totalCount = grouped.reduce((s, g) => s + g.length, 0);
  const allDaysCount = useMemo(() => {
    let n = 0;
    const dateToQi: Record<string, number> = {};
    weeks.forEach((w, wi) => {
      const qi = Math.min(3, Math.floor(wi / WEEKS_PER_QUARTER));
      w.days.forEach((d) => {
        dateToQi[dateKey(d)] = qi;
      });
    });
    for (const [dk, entries] of Object.entries(notes)) {
      if (
        entries.some((entry) => !entry.isDeleted && entry.text.trim()) &&
        dateToQi[dk] !== undefined
      )
        n++;
    }
    return n;
  }, [notes, weeks]);

  const formatDate = (dk: string) => {
    const [, m, d] = dk.split("-").map(Number);
    return `${d} ${months[m! - 1]}`;
  };

  const toggleDraftColorPicker = () => {
    if (draftColorPickerOpen) {
      setDraftColorPickerOpen(false);
      return;
    }
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
        layout
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
        style={{
          position: "relative",
          background: modalBg,
          backdropFilter: "saturate(180%) blur(28px)",
          WebkitBackdropFilter: "saturate(180%) blur(28px)",
          borderRadius: 22,
          boxShadow: `0 24px 70px rgba(0,0,0,0.24), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflowY: "auto",
          maxHeight: "calc(100dvh - 2rem)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
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
                {t("allNotes")}
              </h2>
              {allDaysCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    background: dark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                    borderRadius: 8,
                    padding: "2px 7px",
                  }}
                >
                  {allDaysCount}
                </span>
              )}
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
          {/* Search */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
                pointerEvents: "none",
                display: "flex",
              }}
            >
              <SearchIcon />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("notesSearchPlaceholder")}
              style={{
                width: "100%",
                paddingLeft: 34,
                paddingRight: query ? 30 : 12,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 10,
                background: inputBg,
                border: `1px solid ${borderColor}`,
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 2,
                }}
              >
                <svg
                  width="10"
                  height="10"
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
            )}
          </div>
        </div>

        {/* Add note — button or inline form */}
        <div
          style={{
            padding: "12px 20px 14px",
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <div
            style={{
              maxHeight: showAddForm ? 0 : 40,
              opacity: showAddForm ? 0 : 1,
              visibility: showAddForm ? "hidden" : "visible",
              overflow: "hidden",
              pointerEvents: showAddForm ? "none" : "auto",
            }}
          >
            <button
              onClick={() => setShowAddForm(true)}
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
              {t("addNote")}
            </button>
          </div>
          <div
            style={{
              maxHeight: showAddForm ? 260 : 0,
              opacity: showAddForm ? 1 : 0,
              visibility: showAddForm ? "visible" : "hidden",
              overflow: "hidden",
              pointerEvents: showAddForm ? "auto" : "none",
            }}
          >
            <div style={{ position: "relative", marginBottom: 8 }}>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={t("notePlaceholder")}
                rows={2}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: `${draftColor ? "1.5px" : "1px"} solid ${draftColor ? getEventColors(resolveNoteHex(draftColor), dark).border : borderColor}`,
                  background: draftColor
                    ? getEventColors(resolveNoteHex(draftColor), dark).bg
                    : inputBg,
                  color: draftColor
                    ? getEventColors(resolveNoteHex(draftColor), dark).textTitle
                    : "var(--text)",
                  fontSize: 13,
                  padding: "8px 32px 8px 10px",
                  fontFamily: "inherit",
                  outline: "none",
                  resize: "none",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                  display: "block",
                  transition: "background 200ms ease",
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (e.metaKey || e.ctrlKey) &&
                    draftText.trim()
                  ) {
                    e.preventDefault();
                    onAddNote(draftDate, {
                      id: makeId(),
                      text: draftText.trim(),
                      ...newTimestamps(),
                      color: draftColor ?? undefined,
                    });
                    setDraftText("");
                    setDraftColor(null);
                    setDraftDate(dateKey(new Date()));
                    setDraftColorPickerOpen(false);
                    setShowAddForm(false);
                  }
                  if (e.key === "Escape") {
                    setShowAddForm(false);
                    setDraftText("");
                    setDraftColor(null);
                    setDraftColorPickerOpen(false);
                  }
                }}
              />
              <button
                ref={draftColorBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDraftColorPicker();
                }}
                title={t("chooseColor")}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 13,
                  height: 13,
                  borderRadius: 999,
                  background:
                    draftColor ??
                    (dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)"),
                  border: "none",
                  boxShadow:
                    "0 0 0 2px rgba(255,255,255,0.92), 0 0 0 3.5px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.18)",
                  cursor: "pointer",
                  display: "block",
                  padding: 0,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                lang={lang}
                style={{
                  flex: 1,
                  borderRadius: 9,
                  border: `1px solid ${borderColor}`,
                  background: inputBg,
                  color: "var(--text)",
                  fontSize: 13,
                  padding: "7px 10px",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box" as const,
                }}
              />
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setDraftText("");
                  setDraftColor(null);
                  setDraftDate(dateKey(new Date()));
                  setDraftColorPickerOpen(false);
                }}
                style={{
                  height: 34,
                  paddingInline: 12,
                  borderRadius: 9,
                  border: `1px solid ${borderColor}`,
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  if (!draftText.trim()) return;
                  onAddNote(draftDate, {
                    id: makeId(),
                    text: draftText.trim(),
                    ...newTimestamps(),
                    color: draftColor ?? undefined,
                  });
                  setDraftText("");
                  setDraftColor(null);
                  setDraftDate(dateKey(new Date()));
                  setDraftColorPickerOpen(false);
                  setShowAddForm(false);
                }}
                disabled={!draftText.trim()}
                style={{
                  height: 34,
                  paddingInline: 16,
                  borderRadius: 9,
                  border: "none",
                  background: draftText.trim()
                    ? "#34c759"
                    : dark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                  color: draftText.trim() ? "white" : "var(--text-tertiary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: draftText.trim() ? "pointer" : "default",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap" as const,
                  transition: "background 150ms, color 150ms",
                }}
              >
                {t("add")}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "12px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {allDaysCount === 0 && !draftText ? (
            <p
              style={{
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 13,
                padding: "24px 0",
                margin: 0,
              }}
            >
              {t("noNotesAtAll")}
            </p>
          ) : totalCount === 0 && q ? (
            <p
              style={{
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 13,
                padding: "24px 0",
                margin: 0,
              }}
            >
              {t("searchNoResults")}
            </p>
          ) : (
            grouped.map((group, qi) => {
              if (group.length === 0) return null;
              const quarter = resolvedQuarters[qi]!;
              return (
                <div key={qi}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: quarter.tint,
                        border: "none",
                        boxShadow: `0 0 0 2px ${quarter.border}`,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {quarter.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontWeight: 500,
                      }}
                    >
                      {group.length}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {group.map(({ dateKey: dk, entries }) => (
                      <div
                        key={dk}
                        style={{ position: "relative" }}
                        onMouseEnter={() => setHoveredDk(dk)}
                        onMouseLeave={() => setHoveredDk(null)}
                      >
                        <button
                          onClick={() => {
                            onOpenNote(dk);
                            onClose();
                          }}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            padding: "10px 36px 10px 12px",
                            borderRadius: 12,
                            background:
                              hoveredDk === dk
                                ? dark
                                  ? "rgba(255,255,255,0.09)"
                                  : "rgba(0,0,0,0.06)"
                                : dark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.03)",
                            border: `1px solid ${borderColor}`,
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "inherit",
                            transition: "background 150ms",
                            width: "100%",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: quarter.text,
                              letterSpacing: "0.01em",
                            }}
                          >
                            {formatDate(dk)}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                            }}
                          >
                            {entries.map((e, i) => {
                              const eec = e.color
                                ? getEventColors(resolveNoteHex(e.color), dark)
                                : null;
                              return (
                                <div
                                  key={i}
                                  style={{
                                    padding: e.color
                                      ? "8px 10px 8px 12px"
                                      : "2px 0",
                                    borderRadius: e.color ? 12 : 0,
                                    border: eec
                                      ? `1.5px solid ${eec.border}`
                                      : "none",
                                    background: eec ? eec.bg : "transparent",
                                    overflow: "hidden",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: eec
                                        ? eec.textTitle
                                        : "var(--text)",
                                      lineHeight: 1.55,
                                      display: "block",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    <HighlightText text={e.text} query={q} />
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </button>
                        {hoveredDk === dk && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteDk(dk);
                            }}
                            title={t("remove")}
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              width: 26,
                              height: 26,
                              borderRadius: 999,
                              background: dark
                                ? "rgba(255,59,48,0.15)"
                                : "rgba(255,59,48,0.1)",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ff3b30",
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
      {draftColorPickerOpen &&
        draftColorPickerPos &&
        ReactDOM.createPortal(
          <motion.div
            key="draft-color-popover"
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: draftColorPickerPos.top,
              left: draftColorPickerPos.left,
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
              style={{ position: "fixed", inset: 0, zIndex: -1 }}
              onClick={() => setDraftColorPickerOpen(false)}
            />
            <ColorSwatchGrid
              colors={APPLE_COLORS.map((ac) => ({
                key: ac.key,
                hex: dark ? ac.dark : ac.light,
                label: ac.label,
              }))}
              selected={draftColor}
              onSelect={(hex) => {
                setDraftColor(draftColor === hex ? null : hex);
                setDraftColorPickerOpen(false);
              }}
              onClear={() => {
                setDraftColor(null);
                setDraftColorPickerOpen(false);
              }}
              clearLabel={t("noColor")}
              dark={dark}
            />
          </motion.div>,
          document.body,
        )}
      <ConfirmDialog
        open={confirmDeleteDk !== null}
        onClose={() => setConfirmDeleteDk(null)}
        onConfirm={() => {
          if (confirmDeleteDk) onDeleteDayNotes(confirmDeleteDk);
        }}
        message={t("deleteDayNotesConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
    </motion.div>
  );
}

// ─── MilestoneModal ───────────────────────────────────────────────────────────

function MilestoneModal({
  milestones,
  resolvedQuarters,
  weeks,
  dark,
  modalBg,
  onClose,
  onChange,
}: {
  milestones: Milestone[];
  resolvedQuarters: Quarter[];
  weeks: { weekStart: Date; days: Date[] }[];
  dark: boolean;
  modalBg: string;
  onClose: () => void;
  onChange: (m: Milestone[]) => void;
}) {
  const { t, lang } = React.useContext(LangContext);
  const [items, setItems] = useState<Milestone[]>(() =>
    [...milestones].sort((a, b) => a.date.localeCompare(b.date)),
  );
  const [confirmDeleteMsId, setConfirmDeleteMsId] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!q) return items;
    return items.filter(
      (ms) =>
        ms.label.toLowerCase().includes(q) ||
        (ms.description ?? "").toLowerCase().includes(q),
    );
  }, [items, q]);

  const dateToQi = useMemo(() => {
    const map: Record<string, number> = {};
    weeks.forEach((w, wi) => {
      const qi = Math.min(3, Math.floor(wi / WEEKS_PER_QUARTER));
      w.days.forEach((d) => {
        map[dateKey(d)] = qi;
      });
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
    filteredItems.forEach((ms) => {
      counts[quarterOf(ms.date)]!++;
    });
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
  const [draftColorPickerPos, setDraftColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const draftColorBtnRef = React.useRef<HTMLButtonElement | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);
  const [editRecurSpinKey, setEditRecurSpinKey] = useState(0);
  const [editColorPickerOpen, setEditColorPickerOpen] = useState(false);
  const [editColorPickerPos, setEditColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
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
    const newItems = items
      .map((ms) =>
        ms.id === editId
          ? {
              ...ms,
              label: editLabel.trim(),
              date: editDate,
              color: editColor,
              description: editDesc.trim() || undefined,
              recurring: editRecurring || undefined,
            }
          : ms,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    setItems(newItems);
    onChange(newItems);
    setEditId(null);
  };

  const resetDraft = () => {
    setDraftLabel("");
    setDraftDesc("");
    setDraftColor("");
    setDraftRecurring(false);
    setDraftColorPickerOpen(false);
    setShowAddForm(false);
  };

  const add = () => {
    if (!draftLabel.trim()) return;
    const newItems = [
      ...items,
      {
        id: makeId(),
        label: draftLabel.trim(),
        date: draftDate,
        color: draftColor,
        description: draftDesc.trim() || undefined,
        recurring: draftRecurring || undefined,
        ...newTimestamps(),
        isDeleted: false,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));
    setItems(newItems);
    onChange(newItems);
    resetDraft();
  };

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const inputStyle: React.CSSProperties = {
    background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.03)",
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
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
        layout
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
        style={{
          position: "relative",
          background: modalBg,
          backdropFilter: "saturate(180%) blur(28px)",
          WebkitBackdropFilter: "saturate(180%) blur(28px)",
          borderRadius: 22,
          boxShadow: `0 24px 70px rgba(0,0,0,0.24), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflowY: "auto",
          maxHeight: "calc(100dvh - 2rem)",
        }}
      >
        <div className="px-6 pt-6 pb-3 flex items-center justify-between">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              {t("milestones")}
            </h2>
            {items.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-tertiary)",
                  background: dark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.06)",
                  borderRadius: 8,
                  padding: "2px 7px",
                }}
              >
                {q ? filteredItems.length : items.length}
              </span>
            )}
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
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
                pointerEvents: "none",
                display: "flex",
              }}
            >
              <SearchIcon />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("eventsSearchPlaceholder")}
              style={{
                ...inputStyle,
                width: "100%",
                paddingLeft: 34,
                paddingRight: query ? 30 : 12,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 2,
                }}
              >
                <svg
                  width="10"
                  height="10"
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
            )}
          </div>
        </div>

        {/* Add event — button or card form */}
        <div
          className="px-6 py-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <div
            style={{
              maxHeight: showAddForm ? 0 : 38,
              opacity: showAddForm ? 0 : 1,
              visibility: showAddForm ? "hidden" : "visible",
              overflow: "hidden",
              pointerEvents: showAddForm ? "none" : "auto",
            }}
          >
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                width: "100%",
                height: 32,
                borderRadius: 9,
                border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)"}`,
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>{" "}
              {t("addEvent")}
            </button>
          </div>
          <div
            style={{
              maxHeight: showAddForm ? 500 : 0,
              opacity: showAddForm ? 1 : 0,
              visibility: showAddForm ? "visible" : "hidden",
              overflow: "hidden",
              pointerEvents: showAddForm ? "auto" : "none",
            }}
          >
            {(() => {
              const ecDraft = getEventColors(draftColor, dark);
              const isWhite = draftColor === "#ffffff";
              const cardBg = isWhite ? "#ffffff" : ecDraft.bg;
              const cardBorder = isWhite
                ? "#d4d4d8"
                : ecDraft.border ||
                  (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)");
              const inputBg = isWhite ? "transparent" : ecDraft.formBg;
              const inputBorder = isWhite
                ? "1px solid #d4d4d8"
                : `1px solid ${ecDraft.formBorder}`;
              const inputText = isWhite ? "#18181b" : "var(--text)";
              const draftInputStyle: React.CSSProperties = {
                background: inputBg,
                border: inputBorder,
                borderRadius: 8,
                padding: "6px 9px",
                fontSize: 12,
                color: inputText,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "background 0.25s ease, border-color 0.25s ease",
              };
              const labelText = isWhite ? "#18181b" : "var(--text-secondary)";
              const cancelBorder = isWhite
                ? "1px solid #a1a1aa"
                : `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}`;
              const cancelColor = isWhite ? "#18181b" : "var(--text-secondary)";
              const submitBg = draftLabel.trim()
                ? "#007aff"
                : isWhite
                  ? "#e4e4e7"
                  : "rgba(128,128,128,0.15)";
              const submitColor = draftLabel.trim()
                ? "#ffffff"
                : isWhite
                  ? "#71717a"
                  : "var(--text-tertiary)";
              return (
                <div
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                    boxShadow: ecDraft.boxShadow || undefined,
                    borderRadius: 12,
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    transition:
                      "background 0.25s ease, border-color 0.25s ease",
                  }}
                >
                  <textarea
                    value={draftLabel}
                    rows={1}
                    onChange={(e) => {
                      setDraftLabel(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") resetDraft();
                    }}
                    placeholder={t("labelPlaceholder")}
                    className={isWhite ? "placeholder-dark" : undefined}
                    style={{
                      ...draftInputStyle,
                      width: "100%",
                      resize: "none",
                      overflow: "hidden",
                      lineHeight: 1.5,
                      display: "block",
                    }}
                  />
                  <textarea
                    value={draftDesc}
                    rows={2}
                    onChange={(e) => {
                      setDraftDesc(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    placeholder={t("descPlaceholder")}
                    className={isWhite ? "placeholder-dark" : undefined}
                    style={{
                      ...draftInputStyle,
                      width: "100%",
                      resize: "none",
                      overflow: "hidden",
                      lineHeight: 1.5,
                      display: "block",
                    }}
                  />
                  <div
                    className="flex items-center"
                    style={{ isolation: "isolate", flexWrap: "wrap", gap: 8 }}
                  >
                    <input
                      type="date"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      lang={lang}
                      style={{
                        ...draftInputStyle,
                        flex: "0 0 104px",
                        minWidth: 0,
                        width: 104,
                        padding: "0 6px",
                      }}
                    />
                    <button
                      ref={draftColorBtnRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (draftColorPickerOpen) {
                          setDraftColorPickerOpen(false);
                          return;
                        }
                        const btn = draftColorBtnRef.current;
                        if (btn) {
                          setDraftColorPickerPos(
                            clampedPopoverPos(
                              btn.getBoundingClientRect(),
                              136,
                              100,
                            ),
                          );
                        }
                        setDraftColorPickerOpen(true);
                      }}
                      title={t("chooseColor")}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: draftColor || "transparent",
                        border: "none",
                        boxShadow: draftColor
                          ? `0 0 0 1.5px rgba(255,255,255,0.85), 0 1px 3px rgba(0,0,0,0.18)`
                          : `0 0 0 1.5px ${isWhite ? "#a1a1aa" : "var(--border-soft)"}`,
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
                      {!draftColor && (
                        <span
                          style={{
                            position: "absolute",
                            width: "55%",
                            height: "1.5px",
                            background: isWhite
                              ? "rgba(0,0,0,0.35)"
                              : dark
                                ? "rgba(255,255,255,0.55)"
                                : "rgba(0,0,0,0.35)",
                            transform: "rotate(-45deg)",
                          }}
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !draftRecurring;
                        setDraftRecurring(next);
                        if (next) setDraftRecurSpinKey((k) => k + 1);
                      }}
                      title={t("repeatYearly")}
                      style={{
                        flexShrink: 0,
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 14,
                        lineHeight: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: draftRecurring
                          ? "var(--apple-green)"
                          : labelText,
                        opacity: draftRecurring ? 1 : 0.55,
                        transition: "color 150ms, opacity 150ms",
                      }}
                    >
                      <span
                        key={draftRecurSpinKey}
                        className={
                          draftRecurring ? "recur-spin-once" : undefined
                        }
                        style={{ display: "inline-block" }}
                      >
                        ↻
                      </span>
                    </button>
                    <div
                      className="flex items-center"
                      style={{ gap: 8, flexShrink: 0, marginLeft: "auto" }}
                    >
                      <button
                        onClick={resetDraft}
                        style={{
                          height: 28,
                          padding: "0 9px",
                          borderRadius: 7,
                          border: cancelBorder,
                          background: "transparent",
                          color: cancelColor,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("cancel")}
                      </button>
                      <button
                        onClick={add}
                        disabled={!draftLabel.trim()}
                        style={{
                          height: 28,
                          padding: "0 10px",
                          borderRadius: 7,
                          border: "none",
                          background: submitBg,
                          color: submitColor,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: draftLabel.trim() ? "pointer" : "default",
                          fontFamily: "inherit",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("addEventBtn")}
                      </button>
                    </div>
                  </div>
                  {draftColorPickerOpen &&
                    draftColorPickerPos &&
                    ReactDOM.createPortal(
                      <motion.div
                        key="ms-draft-color-popover"
                        initial={{ opacity: 0, scale: 0.94, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 28,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "fixed",
                          top: draftColorPickerPos.top,
                          left: draftColorPickerPos.left,
                          zIndex: 300,
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
                          style={{ position: "fixed", inset: 0, zIndex: -1 }}
                          onClick={() => setDraftColorPickerOpen(false)}
                        />
                        <ColorSwatchGrid
                          colors={APPLE_COLORS.map((ac) => ({
                            key: ac.key,
                            hex: ac.light,
                            label: ac.label,
                          }))}
                          selected={draftColor || null}
                          onSelect={(hex) => {
                            setDraftColor(draftColor === hex ? "" : hex);
                            setDraftColorPickerOpen(false);
                          }}
                          onClear={() => {
                            setDraftColor("");
                            setDraftColorPickerOpen(false);
                          }}
                          clearLabel={t("noColor")}
                          dark={dark}
                        />
                      </motion.div>,
                      document.body,
                    )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* List */}
        <div
          className="px-6 pt-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          {items.length === 0 && (
            <div
              className="py-6 text-center text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("noMilestones")}
            </div>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <div
              className="py-6 text-center text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("searchNoResults")}
            </div>
          )}
          <div className="flex flex-col gap-1.5 pb-3">
            {(() => {
              // Group consecutive events by date
              const dateGroups: {
                date: string;
                lbl: string;
                qi: number;
                items: Milestone[];
              }[] = [];
              for (const ms of filteredItems) {
                const last = dateGroups[dateGroups.length - 1];
                if (last && last.date === ms.date) {
                  last.items.push(ms);
                } else {
                  const [y2, m2, d2] = ms.date.split("-").map(Number) as [
                    number,
                    number,
                    number,
                  ];
                  const lbl = new Date(y2, m2 - 1, d2).toLocaleDateString(
                    lang === "ru" ? "ru-RU" : "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  );
                  dateGroups.push({
                    date: ms.date,
                    lbl,
                    qi: quarterOf(ms.date),
                    items: [ms],
                  });
                }
              }

              const renderCard = (ms: Milestone, showDate: boolean) => {
                const isEditing = editId === ms.id;
                const ec3 = getEventColors(
                  isEditing ? editColor : ms.color,
                  dark,
                );
                const rcBg = ec3.bg;
                const rcBdr = isEditing ? ec3.borderEditing : ec3.border;
                const rcTxt = ec3.textTitle;
                const rcSecTxt = ec3.textDesc;
                const rcBdrForm = ec3.formBorder;
                const rcBgForm = ec3.formBg;
                const hovering = hoveredId === ms.id;
                return (
                  <div
                    key={ms.id}
                    className="flex flex-col px-2.5 py-2.5 rounded-xl"
                    style={{
                      position: "relative",
                      minHeight: 36,
                      background: rcBg,
                      border: `1.5px solid ${ec3.border || "transparent"}`,
                      boxShadow: ec3.boxShadow || undefined,
                      transition:
                        "background 0.25s ease, border-color 0.25s ease",
                    }}
                    onMouseEnter={() => setHoveredId(ms.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <>
                      <div
                        className="flex flex-col gap-2"
                        style={{
                          isolation: "isolate",
                          visibility: isEditing ? "visible" : "hidden",
                          opacity: isEditing ? 1 : 0,
                          pointerEvents: isEditing ? "auto" : "none",
                          position: isEditing ? "relative" : "absolute",
                          inset: isEditing ? undefined : 0,
                          width: "100%",
                        }}
                      >
                        <textarea
                          value={editLabel}
                          rows={1}
                          ref={(el) => {
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = el.scrollHeight + "px";
                            }
                          }}
                          onChange={(e) => {
                            setEditLabel(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height =
                              e.target.scrollHeight + "px";
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit();
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          placeholder={t("labelPlaceholder")}
                          style={{
                            ...inputStyle,
                            width: "100%",
                            resize: "none",
                            overflow: "hidden",
                            fontSize: 13,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            display: "block",
                            color: rcTxt,
                            background: "transparent",
                            border: `1px solid ${rcBdrForm}`,
                          }}
                        />
                        <textarea
                          value={editDesc}
                          rows={2}
                          ref={(el) => {
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = el.scrollHeight + "px";
                            }
                          }}
                          onChange={(e) => {
                            setEditDesc(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height =
                              e.target.scrollHeight + "px";
                          }}
                          placeholder={t("editDescPlaceholder")}
                          style={{
                            ...inputStyle,
                            width: "100%",
                            resize: "none",
                            overflow: "hidden",
                            fontSize: 11,
                            fontWeight: 400,
                            lineHeight: 1.375,
                            display: "block",
                            color: rcSecTxt,
                            background: "transparent",
                            border: `1px solid ${rcBdrForm}`,
                          }}
                        />
                        <div
                          className="flex items-center"
                          style={{ gap: 8, flexWrap: "nowrap" }}
                        >
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            lang={lang}
                            style={{
                              ...inputStyle,
                              flex: "0 0 104px",
                              minWidth: 0,
                              width: 104,
                              padding: "0 6px",
                              color: rcTxt,
                              background: rcBgForm,
                              border: `1px solid ${rcBdrForm}`,
                            }}
                          />
                          <button
                            ref={editColorBtnRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editColorPickerOpen) {
                                setEditColorPickerOpen(false);
                                return;
                              }
                              const btn = editColorBtnRef.current;
                              if (btn) {
                                setEditColorPickerPos(
                                  clampedPopoverPos(
                                    btn.getBoundingClientRect(),
                                    136,
                                    100,
                                  ),
                                );
                              }
                              setEditColorPickerOpen(true);
                            }}
                            title={t("chooseColor")}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              flexShrink: 0,
                              background: editColor || "transparent",
                              border: "none",
                              boxShadow: editColor
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
                            {!editColor && (
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
                          <button
                            type="button"
                            onClick={() => {
                              const next = !editRecurring;
                              setEditRecurring(next);
                              if (next) setEditRecurSpinKey((k) => k + 1);
                            }}
                            title={t("repeatYearly")}
                            style={{
                              flexShrink: 0,
                              width: 20,
                              height: 20,
                              borderRadius: 999,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 14,
                              lineHeight: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: editRecurring
                                ? "var(--apple-green)"
                                : rcSecTxt,
                              opacity: editRecurring ? 1 : 0.55,
                              transition: "color 150ms, opacity 150ms",
                            }}
                          >
                            <span
                              key={editRecurSpinKey}
                              className={
                                editRecurring ? "recur-spin-once" : undefined
                              }
                              style={{ display: "inline-block" }}
                            >
                              ↻
                            </span>
                          </button>
                          <div
                            className="flex items-center"
                            style={{
                              gap: 8,
                              flexShrink: 0,
                              marginLeft: "auto",
                            }}
                          >
                            <button
                              onClick={cancelEdit}
                              style={{
                                height: 28,
                                padding: "0 9px",
                                borderRadius: 7,
                                border: `1px solid ${rcBdrForm}`,
                                background: "transparent",
                                color: rcSecTxt,
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                flexShrink: 0,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t("cancel")}
                            </button>
                            <button
                              onClick={saveEdit}
                              disabled={!editLabel.trim()}
                              style={{
                                height: 28,
                                padding: "0 10px",
                                borderRadius: 7,
                                border: "none",
                                background: editLabel.trim()
                                  ? "#007aff"
                                  : "rgba(128,128,128,0.15)",
                                color: editLabel.trim()
                                  ? "#ffffff"
                                  : "var(--text-tertiary)",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: editLabel.trim()
                                  ? "pointer"
                                  : "default",
                                fontFamily: "inherit",
                                flexShrink: 0,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t("saveChanges")}
                            </button>
                          </div>
                        </div>
                        {editColorPickerOpen &&
                          editColorPickerPos &&
                          ReactDOM.createPortal(
                            <motion.div
                              key="ms-edit-color-popover"
                              initial={{ opacity: 0, scale: 0.94, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 420,
                                damping: 28,
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "fixed",
                                top: editColorPickerPos.top,
                                left: editColorPickerPos.left,
                                zIndex: 300,
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
                                onClick={() => setEditColorPickerOpen(false)}
                              />
                              <ColorSwatchGrid
                                colors={APPLE_COLORS.map((ac) => ({
                                  key: ac.key,
                                  hex: ac.light,
                                  label: ac.label,
                                }))}
                                selected={editColor || null}
                                onSelect={(hex) => {
                                  setEditColor(editColor === hex ? "" : hex);
                                  setEditColorPickerOpen(false);
                                }}
                                onClear={() => {
                                  setEditColor("");
                                  setEditColorPickerOpen(false);
                                }}
                                clearLabel={t("noColor")}
                                dark={dark}
                              />
                            </motion.div>,
                            document.body,
                          )}
                      </div>
                      <div
                        style={{
                          visibility: isEditing ? "hidden" : "visible",
                          opacity: isEditing ? 0 : 1,
                          pointerEvents: isEditing ? "none" : "auto",
                        }}
                      >
                        {/* Card view — pure CSS Flexbox, no JS measurement, no absolute positioning */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {showDate && (
                              <div
                                className="text-[11px] tabular-nums"
                                style={{
                                  color: "var(--text-tertiary)",
                                  marginBottom: 2,
                                }}
                              >
                                {
                                  dateGroups.find((g) =>
                                    g.items.some((x) => x.id === ms.id),
                                  )?.lbl
                                }
                              </div>
                            )}
                            <span
                              className="text-[13px] font-semibold"
                              style={{
                                color: rcTxt,
                                wordBreak: "break-all",
                                overflowWrap: "anywhere",
                                display: "block",
                              }}
                            >
                              <HighlightText text={ms.label} query={q} />
                            </span>
                            {ms.description && (
                              <div
                                className="text-[11px] leading-snug"
                                style={{
                                  marginTop: 3,
                                  color: rcSecTxt,
                                  wordBreak: "break-all",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                <HighlightText
                                  text={ms.description}
                                  query={q}
                                />
                              </div>
                            )}
                            {ms.recurring && (
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  marginTop: 5,
                                  padding: "2px 6px 2px 4px",
                                  borderRadius: 5,
                                  background: dark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(0,0,0,0.05)",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    lineHeight: 1,
                                    color: rcSecTxt,
                                    opacity: 0.7,
                                  }}
                                >
                                  ↻
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    lineHeight: 1,
                                    color: rcSecTxt,
                                    opacity: 0.65,
                                  }}
                                >
                                  {t("repeatYearly")}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Buttons in document flow — flex-wrap + row-reverse: × first in DOM = always top-right */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "row-reverse",
                              flexWrap: "wrap",
                              gap: 6,
                              maxWidth: 70,
                              flexShrink: 0,
                              alignSelf: "flex-start",
                              opacity: hovering ? 1 : 0,
                              pointerEvents: hovering ? "auto" : "none",
                              transition: "opacity 0.15s ease-in-out",
                            }}
                          >
                            <button
                              onClick={() => setConfirmDeleteMsId(ms.id)}
                              title={t("delete")}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 999,
                                border: "none",
                                background: dark
                                  ? "rgba(255,59,48,0.15)"
                                  : "rgba(255,59,48,0.1)",
                                color: "#ff3b30",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
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
                            <button
                              onClick={() => startEdit(ms)}
                              title={t("edit")}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 999,
                                border: "none",
                                background: dark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.07)",
                                color: dark
                                  ? "rgba(255,255,255,0.8)"
                                  : "rgba(0,0,0,0.65)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background 0.1s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = dark
                                  ? "rgba(255,255,255,0.18)"
                                  : "rgba(0,0,0,0.13)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = dark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.07)";
                              }}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 12 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
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
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: resolvedQuarters[group.qi]?.tint,
                            border: "none",
                            boxShadow: `0 0 0 2px ${resolvedQuarters[group.qi]?.border}`,
                            flexShrink: 0,
                            display: "inline-block",
                          }}
                        />
                        <span
                          className="text-[10px] font-semibold tracking-widest uppercase"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {resolvedQuarters[group.qi]?.label ??
                            t("q" + String(group.qi + 1))}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          · {quarterCounts[group.qi]}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)"}`,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 10px 5px",
                          background: dark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.03)",
                          borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            letterSpacing: "0.01em",
                          }}
                        >
                          {group.lbl}
                        </span>
                        {isMulti && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-tertiary)",
                            }}
                          >
                            · {group.items.length}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          padding: "6px 6px",
                        }}
                      >
                        {group.items.map((ms) => renderCard(ms, false))}
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
            const newItems = items.filter((x) => x.id !== confirmDeleteMsId);
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

function GoalsModal({
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
  const colorBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [colorPickerGoalId, setColorPickerGoalId] = useState<string | null>(
    null,
  );
  const [colorPickerPos, setColorPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const toggleColorPicker = (id: string) => {
    if (colorPickerGoalId === id) {
      setColorPickerGoalId(null);
      return;
    }
    const btn = colorBtnRefs.current[id];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setColorPickerPos({
        top: rect.bottom + 7,
        left: Math.min(rect.right - 152, window.innerWidth - 164),
      });
    }
    setColorPickerGoalId(id);
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ overflowY: "auto", overscrollBehavior: "contain" }}
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
            inset: 0,
            background: "rgba(0,0,0,0.32)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
          }}
        />
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          onClick={(e) => {
            e.stopPropagation();
            setColorPickerGoalId(null);
          }}
          className="w-full max-w-sm"
          style={{
            position: "relative",
            background: modalBg,
            backdropFilter: "saturate(180%) blur(28px)",
            WebkitBackdropFilter: "saturate(180%) blur(28px)",
            borderRadius: 22,
            boxShadow: accentColor
              ? `0 24px 70px rgba(0,0,0,0.22), 0 0 0 1.5px ${accentColor}`
              : "0 24px 70px rgba(0,0,0,0.22)",
            border: `1.5px solid ${accentColor ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)")}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100dvh - 2rem)",
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
                              ref={(el) => {
                                colorBtnRefs.current[g.id] = el;
                              }}
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
      {colorPickerGoalId !== null &&
        colorPickerPos &&
        ReactDOM.createPortal(
          <AnimatePresence>
            <motion.div
              key="goal-color-popover"
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: colorPickerPos.top,
                left: colorPickerPos.left,
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
              <ColorSwatchGrid
                colors={APPLE_COLORS.map((ac) => ({
                  key: ac.key,
                  hex: dark ? ac.dark : ac.light,
                  label: ac.label,
                }))}
                selected={
                  goals.find((g) => g.id === colorPickerGoalId)?.color ?? null
                }
                onSelect={(hex) => setGoalColor(colorPickerGoalId, hex)}
                onClear={() => setGoalColor(colorPickerGoalId, undefined)}
                clearLabel={t("noColor")}
                dark={dark}
              />
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
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

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  message,
  confirmLabel,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  confirmLabel: string;
  dark: boolean;
}) {
  const { t } = React.useContext(LangContext);
  const modalBg = dark ? "rgba(28,28,30,0.97)" : "rgba(255,255,255,0.97)";
  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-overlay"
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
          style={{ zIndex: 60 }}
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.32)",
              backdropFilter: "blur(10px) saturate(160%)",
              WebkitBackdropFilter: "blur(10px) saturate(160%)",
            }}
          />
          <motion.div
            key="confirm-card"
            onClick={(e) => e.stopPropagation()}
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
              boxShadow: `0 24px 60px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.08), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ color: "#ff3b30", flexShrink: 0, marginTop: 2 }}>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                {message}
              </p>
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "7px 16px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  background: dark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.07)",
                  color: "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#ff3b30",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 2px 10px rgba(255,59,48,0.4)",
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── FactoryResetDialog ───────────────────────────────────────────────────────

function FactoryResetDialog({
  open,
  onClose,
  onConfirm,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  dark: boolean;
}) {
  const { t } = React.useContext(LangContext);
  const [step, setStep] = useState(1);
  const modalBg = dark ? "rgba(28,28,30,0.97)" : "rgba(255,255,255,0.97)";

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="factory-reset-overlay"
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
          style={{ zIndex: 60 }}
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.32)",
              backdropFilter: "blur(10px) saturate(160%)",
              WebkitBackdropFilter: "blur(10px) saturate(160%)",
            }}
          />
          <motion.div
            key="factory-reset-card"
            onClick={(e) => e.stopPropagation()}
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
              boxShadow: `0 24px 60px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.08), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflow: "hidden",
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{ color: "#ff9500", flexShrink: 0, marginTop: 2 }}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ff9500",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("factoryResetWarn1Title")}
                      </span>
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: 1.55,
                          color: "var(--text-secondary)",
                          margin: 0,
                        }}
                      >
                        {t("factoryResetWarn1")}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 500,
                        background: dark
                          ? "rgba(255,255,255,0.10)"
                          : "rgba(0,0,0,0.07)",
                        color: "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#ff9500",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 2px 10px rgba(255,149,0,0.4)",
                      }}
                    >
                      {t("nextStep")}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{ color: "#ff3b30", flexShrink: 0, marginTop: 2 }}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ff3b30",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("factoryResetWarn2Title")}
                      </span>
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: 1.55,
                          color: "var(--text-secondary)",
                          margin: 0,
                        }}
                      >
                        {t("factoryResetWarn2")}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 500,
                        background: dark
                          ? "rgba(255,255,255,0.10)"
                          : "rgba(0,0,0,0.07)",
                        color: "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("back")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onConfirm();
                        onClose();
                      }}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#ff3b30",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 2px 10px rgba(255,59,48,0.4)",
                      }}
                    >
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
    document.body,
  );
}

// ─── SprintSettingsModal ──────────────────────────────────────────────────────

function SprintSettingsModal({
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

// ─── DaysCanvas ───────────────────────────────────────────────────────────────
// Draws the days grid on a <canvas> instead of thousands of <div>s.
// Identical visual output, zero DOM-node overhead.

function _drawRR(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const minR = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + minR, y);
  ctx.arcTo(x + w, y, x + w, y + h, minR);
  ctx.arcTo(x + w, y + h, x, y + h, minR);
  ctx.arcTo(x, y + h, x, y, minR);
  ctx.arcTo(x, y, x + w, y, minR);
  ctx.closePath();
}

const DaysCanvas = React.memo(function DaysCanvas({
  totalUnits,
  currentCell,
  cellPx,
  gapPx,
  numCols,
  dark,
}: {
  totalUnits: number;
  currentCell: number;
  cellPx: number;
  gapPx: number;
  numCols: number;
  dark: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rows = Math.ceil(totalUnits / numCols);
  const pitch = cellPx + gapPx;
  const cw = numCols * pitch - gapPx;
  const ch = rows * pitch - gapPx;
  const radius = Math.max(0, Math.floor(cellPx / 5));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(cw * dpr);
    canvas.height = Math.ceil(ch * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pastFill = "#007aff";
    const currFill = "rgba(0,122,255,0.4)";
    const futureFill = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)";

    // ── future cells (single batched path fill) ────────────────────────────
    ctx.fillStyle = futureFill;
    ctx.beginPath();
    for (let i = currentCell + 1; i < totalUnits; i++) {
      const x = (i % numCols) * pitch;
      const y = Math.floor(i / numCols) * pitch;
      if (radius > 0) _drawRR(ctx, x, y, cellPx, cellPx, radius);
      else ctx.rect(x, y, cellPx, cellPx);
    }
    ctx.fill();

    // ── past cells (single batched path fill) ─────────────────────────────
    ctx.fillStyle = pastFill;
    ctx.beginPath();
    for (let i = 0; i < currentCell && i < totalUnits; i++) {
      const x = (i % numCols) * pitch;
      const y = Math.floor(i / numCols) * pitch;
      if (radius > 0) _drawRR(ctx, x, y, cellPx, cellPx, radius);
      else ctx.rect(x, y, cellPx, cellPx);
    }
    ctx.fill();

    // ── current cell ──────────────────────────────────────────────────────
    if (currentCell >= 0 && currentCell < totalUnits) {
      const cx = (currentCell % numCols) * pitch;
      const cy = Math.floor(currentCell / numCols) * pitch;

      ctx.fillStyle = currFill;
      ctx.beginPath();
      if (radius > 0) _drawRR(ctx, cx, cy, cellPx, cellPx, radius);
      else ctx.rect(cx, cy, cellPx, cellPx);
      ctx.fill();

      if (cellPx >= 3) {
        const bw = Math.max(1, Math.round(cellPx / 6));
        ctx.strokeStyle = "#007aff";
        ctx.lineWidth = bw;
        ctx.beginPath();
        if (radius > 0)
          _drawRR(
            ctx,
            cx + bw / 2,
            cy + bw / 2,
            cellPx - bw,
            cellPx - bw,
            radius,
          );
        else ctx.rect(cx + bw / 2, cy + bw / 2, cellPx - bw, cellPx - bw);
        ctx.stroke();

        if (cellPx >= 5) {
          ctx.strokeStyle = "rgba(0,122,255,0.27)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (radius > 0)
            _drawRR(ctx, cx - 1, cy - 1, cellPx + 2, cellPx + 2, radius + 1);
          else ctx.rect(cx - 1, cy - 1, cellPx + 2, cellPx + 2);
          ctx.stroke();
        }
      }
    }
  }, [
    totalUnits,
    currentCell,
    cellPx,
    gapPx,
    numCols,
    dark,
    cw,
    ch,
    radius,
    pitch,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: cw, height: ch, display: "block" }}
    />
  );
});

// ─── LifeCalendarModal ────────────────────────────────────────────────────────

function LifeCalendarModal({
  dark,
  modalBg,
  settings,
  onSettingsChange,
  onClose,
}: {
  dark: boolean;
  modalBg: string;
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
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewportSize((prev) => {
        // If only height changed — it's the on-screen keyboard appearing/disappearing.
        // Ignore it so the modal doesn't jitter while the user types.
        if (prev.width === w) return prev;
        return { width: w, height: h };
      });
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
  // Age/remaining are derived from exact calendar months so they always sum to exactly `lifespan` years.
  const ageMonthsTotal = useMemo(
    () => (birthDate ? monthsBetween(birthDate, today) : 0),
    [birthDate, today],
  );
  const lifespanMonths = settings.lifespan * 12;
  const ageYears = Math.floor(ageMonthsTotal / 12);
  const ageMonths = ageMonthsTotal % 12;
  const remainingMonthsTotal = Math.max(0, lifespanMonths - ageMonthsTotal);
  const remainingYears = Math.floor(remainingMonthsTotal / 12);
  const remainingMonths = remainingMonthsTotal % 12;
  // Correct remaining breakdown using monthsBetween(today→lifespanEnd) as the base,
  // which already applies the day-of-month correction so the anchor never overshoots.
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

  const {
    cols,
    cellPx,
    gapPx,
    totalUnits,
    currentUnit,
    currentCell,
    labelW,
    headerH,
    displayCurr,
    displayTotal,
  } = useMemo(() => {
    const ls = settings.lifespan;
    let c: number, gap: number, total: number, curr: number, activeCell: number;
    switch (view) {
      case "years":
        // 60 лет жизни → 61 ячейка: от года рождения (i=0) до года 60-летия (i=60).
        // Ячейка i подписана birthYear+i. Текущая ячейка = разница календарных годов.
        c = 10;
        gap = 3;
        total = ls + 1;
        curr = birthDate ? today.getFullYear() - birthDate.getFullYear() : 0;
        activeCell = curr;
        break;
      case "months":
        c = 12;
        gap = 1;
        total = (ls + 1) * 12;
        // Count months from Jan 1 of birth year so row ri always = calendar year birthYear+ri.
        curr = birthDate
          ? (today.getFullYear() - birthDate.getFullYear()) * 12 +
            today.getMonth()
          : 0;
        activeCell = curr;
        break;
      case "weeks":
        c = 52;
        gap = 1;
        total = (ls + 1) * 52;
        // Count weeks from Jan 1 of birth year for the same reason.
        curr = birthDate
          ? Math.floor(
              daysBetween(startOfYear(birthDate.getFullYear()), today) / 7,
            )
          : 0;
        activeCell = curr;
        break;
      default:
        c = 0;
        gap = 1;
        total = lifespanDays;
        curr = ageDays;
        activeCell = curr;
        break;
    }
    curr = Math.max(0, Math.min(curr, total));
    activeCell = Math.max(0, Math.min(activeCell, total - 1));
    const showLbl = view === "months" || view === "weeks";
    const lw = showLbl ? 26 : 0;
    const lh = showLbl ? 12 : 0;
    // Modal width matches its own CSS: min(96vw, 560px). Use 0.96 here to stay in sync.
    const gridW = Math.max(
      100,
      Math.min(viewportSize.width * 0.96, 560) - 48 - lw - 4,
    );
    let cell: number;
    if (view === "days") {
      cell = 3;
    } else if (view === "months") {
      cell = 7;
    } else if (view === "weeks") {
      // Cap at 6 px but shrink to fit available width on narrow screens.
      cell = Math.min(6, Math.max(1, Math.floor((gridW - gap * (c - 1)) / c)));
    } else {
      const gridH = Math.max(
        160,
        Math.round(viewportSize.height * 0.95) - 320 - lh,
      );
      const rows = Math.ceil(total / c);
      const fromH = (gridH - gap * Math.max(0, rows - 1)) / rows;
      const fromW = (gridW - gap * Math.max(0, c - 1)) / c;
      const natural = Math.max(1, Math.floor(Math.min(fromH, fromW)));
      cell = Math.max(1, natural);
    }
    // Display values: actual units lived from birth date (not calendar-grid-based).
    let displayCurr: number, displayTotal: number;
    switch (view) {
      case "years":
        displayCurr = ageYears;
        displayTotal = ls;
        break;
      case "months":
        displayCurr = ageMonthsTotal;
        displayTotal = ls * 12;
        break;
      case "weeks":
        displayCurr = Math.floor(ageDays / 7);
        displayTotal = Math.floor(lifespanDays / 7);
        break;
      default: // days
        displayCurr = ageDays;
        displayTotal = Math.floor(lifespanDays);
        break;
    }
    displayCurr = Math.max(0, Math.min(displayCurr, displayTotal));
    return {
      cols: c,
      cellPx: cell,
      gapPx: gap,
      totalUnits: total,
      currentUnit: curr,
      currentCell: activeCell,
      labelW: lw,
      headerH: lh,
      displayCurr,
      displayTotal,
    };
  }, [
    view,
    settings.lifespan,
    ageDays,
    ageYears,
    ageMonthsTotal,
    birthDate,
    today,
    lifespanDays,
    isFullscreen,
    viewportSize.width,
    viewportSize.height,
  ]);

  const expandedDayLayout = useMemo(() => {
    const totalDays = Math.max(1, Math.ceil(lifespanDays));
    const modalWidth = Math.max(240, viewportSize.width - 32);
    const availableWidth = Math.max(160, modalWidth - 48);
    const availableHeight = Math.max(160, viewportSize.height - 320);

    // Prefer the existing 3px cells, then shrink only when the selected
    // lifespan cannot fit in the available viewport area.
    let expandedCellPx = 1;
    let expandedGapPx = 1;
    for (const candidateCellPx of [3, 2, 1]) {
      const pitch = candidateCellPx + 1;
      const capacity =
        Math.floor(availableWidth / pitch) *
        Math.floor(availableHeight / pitch);
      if (capacity >= totalDays) {
        expandedCellPx = candidateCellPx;
        break;
      }
    }

    const pitch = expandedCellPx + expandedGapPx;
    const maxCols = Math.max(1, Math.floor(availableWidth / pitch));
    const maxRows = Math.max(1, Math.floor(availableHeight / pitch));
    const idealCols = Math.ceil(
      Math.sqrt((totalDays * availableWidth) / availableHeight),
    );
    const minColsForHeight = Math.ceil(totalDays / maxRows);
    const expandedCols = Math.max(
      1,
      Math.min(maxCols, Math.max(idealCols, minColsForHeight)),
    );
    const expandedRows = Math.ceil(totalDays / expandedCols);

    return {
      cellPx: expandedCellPx,
      gapPx: expandedGapPx,
      cols: expandedCols,
      width: expandedCols * pitch - expandedGapPx,
      height: expandedRows * pitch - expandedGapPx,
    };
  }, [lifespanDays, viewportSize.width, viewportSize.height]);
  const renderedDayCellPx =
    view === "days" && isFullscreen ? expandedDayLayout.cellPx : cellPx;
  const renderedDayGapPx =
    view === "days" && isFullscreen ? expandedDayLayout.gapPx : gapPx;

  // Columns for compact (non-fullscreen) days canvas: matches the old auto-fill behaviour.
  const compactDayCols = useMemo(() => {
    const availW = Math.max(100, Math.min(viewportSize.width * 0.96, 560) - 48);
    return Math.max(1, Math.floor(availW / (3 + 1))); // cellPx=3, gapPx=1
  }, [viewportSize.width]);

  const borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)";
  const inputStyle: React.CSSProperties = {
    background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 13,
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
          background: "rgba(0,0,0,0.40)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          pointerEvents: "none",
        }}
      />
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width:
            isFullscreen && view === "days"
              ? `min(calc(100vw - 32px), ${expandedDayLayout.width + 48}px)`
              : "min(96vw,560px)",
          height: undefined,
          maxWidth: "100%",
          maxHeight: view === "months" || view === "weeks" ? undefined : "96vh",
          borderRadius: 24,
          background: modalBg,
          backdropFilter: "saturate(180%) blur(28px)",
          WebkitBackdropFilter: "saturate(180%) blur(28px)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.28), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transition:
            "width 0.3s ease-in-out, height 0.3s ease-in-out, border-radius 0.3s ease-in-out, max-height 0.3s ease-in-out",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2
              className="text-[17px] font-semibold mt-0.5"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              {t("lifeCalendarBtn")}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              background: "rgba(128,128,128,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Settings row */}
        <div className="px-6 pb-4 shrink-0">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div className="flex flex-col gap-1" style={{ minWidth: 0 }}>
              <label
                className="text-[10px] font-medium tracking-wide uppercase"
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
            <div className="flex flex-col gap-1" style={{ minWidth: 0 }}>
              <label
                className="text-[10px] font-medium tracking-wide uppercase"
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
            {/* Stats card */}
            <div className="px-6 pb-4 shrink-0">
              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  background: `${LIFE_ACCENT}12`,
                  border: `1px solid ${LIFE_ACCENT}28`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: LIFE_ACCENT }}
                  >
                    {t("age")}: {ageYears} {t("yr")}
                    {ageMonths > 0 ? ` ${ageMonths} ${t("mo")}` : ""}
                  </span>
                  <span
                    className="text-[13px] font-semibold tabular-nums"
                    style={{ color: LIFE_ACCENT }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
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
                <div
                  className="mt-1.5 text-[11px] tabular-nums leading-snug"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {t("born")}{" "}
                  {new Date(
                    settings.birthDate + "T00:00:00",
                  ).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                {(remYears > 0 ||
                  remMonths > 0 ||
                  remWeeks > 0 ||
                  remDays > 0 ||
                  remHours > 0 ||
                  remMinutes > 0 ||
                  remSeconds > 0) && (
                  <div
                    className="mt-1 text-[11px] tabular-nums leading-snug"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <div style={{ marginBottom: 2 }}>{t("remainingLabel")}</div>
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
                      {remHours > 0 && (
                        <>
                          {pluralCount(
                            remHours,
                            lang,
                            t,
                            "hour1",
                            "hour2",
                            "hour5",
                          )}{" "}
                        </>
                      )}
                      {remMinutes > 0 && (
                        <>
                          {pluralCount(
                            remMinutes,
                            lang,
                            t,
                            "minute1",
                            "minute2",
                            "minute5",
                          )}{" "}
                        </>
                      )}
                      <span className="hidden sm:inline">
                        {pluralCount(
                          remSeconds,
                          lang,
                          t,
                          "second1",
                          "second2",
                          "second5",
                        )}
                      </span>
                      <span className="sm:hidden">
                        {remSeconds} {t("sec")}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* View switcher */}
            <div className="px-6 pb-3 shrink-0">
              <div
                className="flex gap-1 p-1 rounded-xl"
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
                      onClick={() => handleSetView(v)}
                      className="flex-1 py-1.5 rounded-lg text-[12px] transition-all"
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
                          view === v ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                        fontWeight: view === v ? 600 : 400,
                      }}
                    >
                      {viewLabels[v]}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Grid */}
            <div
              className="px-6 pb-5"
              style={{
                flex: "0 0 auto",
                overflow: view === "days" && !isFullscreen ? "auto" : "visible",
                maxHeight: view === "days" && !isFullscreen ? 260 : undefined,
                minHeight: 0,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="text-[10px] tabular-nums"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {displayCurr.toLocaleString()} {t("of")}{" "}
                  {displayTotal.toLocaleString()}{" "}
                  {pluralUnits(displayTotal, view, lang, t)} {t("elapsed")}
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const rem = Math.max(0, displayTotal - displayCurr);
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
                  {view === "days" && (
                    <button
                      type="button"
                      onClick={() => setIsFullscreen((f) => !f)}
                      title={
                        isFullscreen
                          ? t("collapseFullscreen")
                          : t("expandFullscreen")
                      }
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "color 150ms",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--text)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--text-tertiary)")
                      }
                    >
                      {isFullscreen ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 1H1v4M9 1h4v4M5 13H1V9M9 13h4V9" />
                          <path d="M4 4l2 2M10 4l-2 2M4 10l2-2M10 10l-2-2" />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
              {view === "months" || view === "weeks" ? (
                (() => {
                  const rows = Math.ceil(totalUnits / cols);
                  const lblFontSize = Math.min(8, Math.max(6, cellPx));
                  const yearInterval = Math.max(
                    1,
                    Math.ceil(9 / (cellPx + gapPx)),
                  );
                  const showColAt = (ci: number) =>
                    view === "months"
                      ? true
                      : ci === 0 ||
                        ci === 12 ||
                        ci === 25 ||
                        ci === 38 ||
                        ci === 51;
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: gapPx,
                        width: "100%",
                      }}
                    >
                      {/* Column header row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-end",
                          gap: gapPx,
                          height: headerH,
                          paddingLeft: labelW + gapPx,
                        }}
                      >
                        {Array.from({ length: cols }, (_, ci) => (
                          <div
                            key={ci}
                            style={{
                              width: cellPx,
                              flexShrink: 0,
                              textAlign: "center",
                              fontSize: Math.min(7, cellPx),
                              color: "var(--text-tertiary)",
                              lineHeight: 1,
                              overflow: "visible",
                              whiteSpace: "nowrap",
                              opacity: showColAt(ci) ? 1 : 0,
                            }}
                          >
                            {ci + 1}
                          </div>
                        ))}
                      </div>
                      {/* Rows with year labels */}
                      {Array.from({ length: rows }, (_, ri) => {
                        // Row ri = calendar year birthYear+ri (same logic as years-view cells).
                        // total = (ls+1)*12 so rows span birthYear … birthYear+ls inclusive.
                        const yearNum = birthDate
                          ? birthDate.getFullYear() + ri
                          : ri;
                        const showYear = ri % 2 === 0;
                        return (
                          <div
                            key={ri}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: gapPx,
                              height: cellPx,
                            }}
                          >
                            {/* Year label */}
                            <div
                              style={{
                                width: labelW,
                                height: cellPx,
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                paddingRight: 3,
                                fontSize: lblFontSize,
                                lineHeight: 1,
                                fontVariantNumeric: "tabular-nums",
                                fontFamily:
                                  "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                                letterSpacing: 0,
                                color: "var(--text-tertiary)",
                                overflow: "visible",
                                whiteSpace: "nowrap",
                                opacity: showYear ? 1 : 0,
                              }}
                            >
                              {yearNum}
                            </div>
                            {/* Cells */}
                            {Array.from(
                              {
                                length: Math.min(cols, totalUnits - ri * cols),
                              },
                              (_, ci) => {
                                const i = ri * cols + ci;
                                const isPast = i < currentCell;
                                const isCurrent = i === currentCell;
                                const radius = Math.max(
                                  0,
                                  Math.floor(cellPx / 5),
                                );
                                return (
                                  <div
                                    key={ci}
                                    style={{
                                      width: cellPx,
                                      height: cellPx,
                                      borderRadius: radius,
                                      flexShrink: 0,
                                      background: isPast
                                        ? LIFE_ACCENT
                                        : isCurrent
                                          ? `${LIFE_ACCENT}66`
                                          : dark
                                            ? "rgba(255,255,255,0.1)"
                                            : "rgba(0,0,0,0.07)",
                                      border:
                                        cellPx >= 3 && isCurrent
                                          ? `${Math.max(1, Math.round(cellPx / 6))}px solid ${LIFE_ACCENT}`
                                          : "none",
                                      boxShadow:
                                        cellPx >= 5 && isCurrent
                                          ? `0 0 0 2px ${LIFE_ACCENT}44`
                                          : "none",
                                    }}
                                  />
                                );
                              },
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : view === "days" ? (
                <DaysCanvas
                  totalUnits={totalUnits}
                  currentCell={currentCell}
                  cellPx={renderedDayCellPx}
                  gapPx={renderedDayGapPx}
                  numCols={
                    isFullscreen ? expandedDayLayout.cols : compactDayCols
                  }
                  dark={dark}
                />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
                    gap: `${gapPx}px`,
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  {Array.from({ length: totalUnits }, (_, i) => {
                    const isPast = i < currentCell;
                    const isCurrent = i === currentCell;
                    const radius = Math.max(0, Math.floor(cellPx / 5));
                    const showBorder = cellPx >= 3;
                    const showYearLabel =
                      view === "years" && cellPx >= 18 && birthDate !== null;
                    const yearLabel = showYearLabel
                      ? birthDate!.getFullYear() + i
                      : null;
                    const yearFontSize = Math.max(
                      7,
                      Math.min(11, Math.floor(cellPx * 0.22)),
                    );
                    return (
                      <div
                        key={i}
                        style={{
                          width: cellPx,
                          height: cellPx,
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
                              ? `${Math.max(1, Math.round(cellPx / 6))}px solid ${LIFE_ACCENT}`
                              : "none"
                            : "none",
                          boxShadow:
                            cellPx >= 5 && isCurrent
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
                                ? "rgba(255,255,255,0.75)"
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
      </motion.div>
    </motion.div>
  );
}

// ─── DayTemplatesModal ────────────────────────────────────────────────────────

function DayTemplatesModal({
  dark,
  modalBg,
  templates,
  onSave,
  onApply,
  onClose,
  onCloseAll,
  prefillItems,
}: {
  dark: boolean;
  modalBg: string;
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
  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    color: "var(--text)",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    width: "100%",
  };

  // local draft of templates
  const [draft, setDraft] = useState<DayTemplate[]>(() =>
    templates.map((t) => ({ ...t, items: [...t.items] })),
  );
  const draftRef = useRef(draft);
  const commitDraft = (next: DayTemplate[]) => {
    draftRef.current = next;
    setDraft(next);
    onSave(next);
  };
  const [editingId, setEditingId] = useState<string | null>(() =>
    prefillItems ? "__new__" : null,
  );
  // form state for create / edit
  const [formName, setFormName] = useState("");
  const formNameRef = useRef(formName);
  const [formItems, setFormItems] = useState<string[]>(() => {
    if (prefillItems && prefillItems.length > 0) {
      return [...prefillItems];
    }
    return [""];
  });
  const formItemsRef = useRef(formItems);
  const commitFormName = (next: string) => {
    formNameRef.current = next;
    setFormName(next);
  };
  const commitFormItems = (next: string[]) => {
    formItemsRef.current = next;
    setFormItems(next);
  };
  const startNew = () => {
    setEditingId("__new__");
    commitFormName("");
    commitFormItems([""]);
  };
  const startEdit = (tpl: DayTemplate) => {
    setEditingId(tpl.id);
    commitFormName(tpl.name);
    commitFormItems(tpl.items.length > 0 ? [...tpl.items] : [""]);
  };
  const cancelEdit = () => setEditingId(null);

  const saveForm = () => {
    const name = formNameRef.current.trim();
    if (!name) return;
    const items = formItemsRef.current
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (items.length === 0) return;
    if (editingId === "__new__") {
      const newTpl: DayTemplate = {
        id: makeId(),
        name,
        items,
        ...newTimestamps(),
        isDeleted: false,
      };
      commitDraft([...draftRef.current, newTpl]);
    } else {
      const updated = draftRef.current.map((tpl) =>
        tpl.id === editingId ? { ...tpl, name, items } : tpl,
      );
      commitDraft(updated);
    }
    setEditingId(null);
  };
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTpl = (id: string) => {
    commitDraft(draftRef.current.filter((tpl) => tpl.id !== id));
    setConfirmDeleteId(null);
  };
  const addItem = () => {
    if (formItemsRef.current.length < 10)
      commitFormItems([...formItemsRef.current, ""]);
  };
  const removeItem = (i: number) =>
    commitFormItems(formItemsRef.current.filter((_, j) => j !== i));
  const updateItem = (i: number, v: string) =>
    commitFormItems(formItemsRef.current.map((s, j) => (j === i ? v : s)));

  const editing = editingId !== null;

  return (
    <motion.div
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ overflowY: "auto", overscrollBehavior: "contain" }}
      onClick={onCloseAll ?? onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.32)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(92vw,400px)",
          background: modalBg,
          backdropFilter: "saturate(180%) blur(24px)",
          WebkitBackdropFilter: "saturate(180%) blur(24px)",
          borderRadius: 22,
          boxShadow: `0 8px 48px rgba(0,0,0,0.26), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100dvh - 2rem)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onApply && (
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
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                {t("settings")}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginTop: 2,
                }}
              >
                {t("templatesTitle")}
              </div>
            </div>
          </div>
          <button
            onClick={onCloseAll ?? onClose}
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
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: "auto",
            overscrollBehavior: "contain",
            flex: 1,
            padding: "12px 20px 16px",
          }}
        >
          <div
            style={{
              visibility: editing ? "visible" : "hidden",
              opacity: editing ? 1 : 0,
              pointerEvents: editing ? "auto" : "none",
              position: editing ? "relative" : "absolute",
              inset: editing ? undefined : 0,
              width: "100%",
            }}
          >
            {/* ── Edit / Create form ── */}
            <div>
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                    marginBottom: 4,
                  }}
                >
                  {t("newTemplate")}
                </div>
                <input
                  value={formName}
                  onChange={(e) => commitFormName(e.target.value)}
                  placeholder={t("templateNamePlaceholder")}
                  style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveForm();
                    }
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {formItems.map((item, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `1.5px solid ${borderColor}`,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          fontWeight: 600,
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <input
                      value={item}
                      onChange={(e) => updateItem(i, e.target.value)}
                      placeholder={`${t("goal")} ${i + 1}`}
                      style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (
                            i === formItems.length - 1 &&
                            formItems.length < 10
                          )
                            addItem();
                        }
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    {formItems.length > 1 && (
                      <button
                        onClick={() => removeItem(i)}
                        style={{
                          width: 18,
                          height: 18,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#ff3b30",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {formItems.length < 10 && (
                <button
                  onClick={addItem}
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "#007aff",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
                    fontWeight: 600,
                  }}
                >
                  + {t("addTemplateItem")}
                </button>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={cancelEdit}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 9,
                    border: `1px solid ${borderColor}`,
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={saveForm}
                  disabled={
                    !formName.trim() || formItems.every((s) => !s.trim())
                  }
                  style={{
                    flex: 2,
                    padding: "7px 0",
                    borderRadius: 9,
                    border: "none",
                    background: "#007aff",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    opacity:
                      !formName.trim() || formItems.every((s) => !s.trim())
                        ? 0.4
                        : 1,
                  }}
                >
                  {t("saveTemplate")}
                </button>
              </div>
            </div>
          </div>
          <div
            style={{
              visibility: editing ? "hidden" : "visible",
              opacity: editing ? 0 : 1,
              pointerEvents: editing ? "none" : "auto",
            }}
          >
            {/* ── Templates list ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {draft.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: "var(--text-tertiary)",
                    fontSize: 13,
                  }}
                >
                  {t("noTemplates")}
                </div>
              ) : (
                draft.map((tpl) => (
                  <div
                    key={tpl.id}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      padding: "10px 12px",
                      background: dark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        {tpl.name}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {onApply && (
                          <button
                            onClick={() => onApply(tpl)}
                            style={{
                              height: 24,
                              padding: "0 9px",
                              borderRadius: 5,
                              border: "none",
                              background: "#007aff",
                              cursor: "pointer",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: "inherit",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {t("applyTemplate")}
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(tpl)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 5,
                            border: `1px solid ${borderColor}`,
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(tpl.id)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 5,
                            border: `1px solid rgba(255,59,48,0.3)`,
                            background: "transparent",
                            cursor: "pointer",
                            color: "#ff3b30",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      {tpl.items
                        .filter((s) => s.trim())
                        .map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 99,
                                background: "var(--text-tertiary)",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {item}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
              {draft.length < 20 && (
                <button
                  onClick={startNew}
                  style={{
                    width: "100%",
                    padding: "9px 0",
                    borderRadius: 10,
                    border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)"}`,
                    background: "transparent",
                    color: "#007aff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    marginTop: 2,
                  }}
                >
                  + {t("newTemplate")}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) deleteTpl(confirmDeleteId);
        }}
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
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="currentColor"
      style={{ display: "block" }}
    >
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="2" cy="10" r="1.2" />
      <circle cx="6" cy="10" r="1.2" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function GoalsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function CheckIcon({ color = "white" }: { color?: string }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function NotesIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default App;
