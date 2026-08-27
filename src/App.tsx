import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
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
import { useMediaQuery } from "./hooks/use-media-query";

import type {
  Lang,
  Quarter,
  Block,
  QuarterConfig,
  CalendarConfig,
  DayState,
  Milestone,
  Goal,
  BlockGoals,
  DayGoals,
  DayTemplate,
  NoteEntry,
  LifeSettings,
  AppleColorKey,
  QuarterMeta,
  QuarterMetaForSync,
} from "./types/calendar";

import {
  dateKey,
  startOfDay,
  startOfYear,
  startOfWeekMonday,
  addDays,
  sameDay,
  daysBetween,
  gridWeeksForYear,
} from "./utils/date-utils";

import {
  ls,
  lsSet,
  makeId,
  withTimestamps,
  newTimestamps,
  normalizeBlockGoals,
  normalizeMilestone,
  normalizeNoteEntry,
  normalizeDayTemplate,
  normalizeDayGoals,
  normalizeLifeSettings,
  updateBlockGoals,
  reorderByIds,
  defaultBlock,
  createSprintFromSelection,
  defaultConfig,
  loadConfig,
  saveConfig,
} from "./utils/storage";

import {
  MONTHS,
  WEEKDAYS,
  MONTHS_I18N,
  WEEKDAYS_I18N,
  I18N,
  LangContext,
  WEEKS_PER_QUARTER,
  TOTAL_WEEKS,
} from "./constants/i18n";

import {
  APPLE_COLORS,
  DEFAULT_QUARTER_META,
  MILESTONE_COLORS,
  LIFE_ACCENT,
  swatchCheckColor,
  clampedPopoverPos,
  getQuarterColors,
  adaptColor,
  achromaticStyle,
  resolveNoteHex,
  normaliseGrey,
  fireConfettiCannons,
} from "./constants/colors";

import {
  pluralWeeks,
  pluralUnits,
  pluralDayStreak,
  pluralCount,
} from "./utils/plural";

import {
  GripIcon,
  GearIcon,
  TrashIcon,
  MoonIcon,
  SunIcon,
  GoalsIcon,
  FlagIcon,
  PencilIcon,
  CheckIcon,
  SearchIcon,
  NotesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LifeIcon,
} from "./components/icons/Icons";

import { IconButton } from "./components/common/IconButton";
import { ColorSwatchGrid } from "./components/common/ColorSwatchGrid";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { FactoryResetDialog } from "./components/common/FactoryResetDialog";

import { BlocksRenderer } from "./components/calendar/BlocksRenderer";
import { NoteModal } from "./components/modals/NoteModal";
import { AllGoalsPanel } from "./components/modals/AllGoalsPanel";
import { NotesPanel } from "./components/modals/NotesPanel";
import { MilestoneModal } from "./components/modals/MilestoneModal";
import { GoalsModal } from "./components/modals/GoalsModal";
import { SprintSettingsModal } from "./components/modals/SprintSettingsModal";
import { LifeCalendarModal } from "./components/modals/LifeCalendarModal";
import { DayTemplatesModal } from "./components/modals/DayTemplatesModal";

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
                className="grid grid-cols-7 gap-1 sm:gap-1.5"
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



export default App;
