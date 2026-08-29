import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, LayoutGroup, Reorder } from "framer-motion";
import TextareaAutosize from "react-textarea-autosize";
import type { DayState, Milestone, NoteEntry, DayGoals, DayTemplate, AppleColorKey } from "../../types/calendar";
import { dateKey, addDays, sameDay, startOfDay } from "../../utils/date-utils";
import { makeId, newTimestamps } from "../../utils/storage";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, normaliseGrey, getEventColors, clampedPopoverPos, fireConfettiCannons, goalCheckboxAchromaticStyle, swatchCheckColor, getPopoverPlacement } from "../../constants/colors";
import { LangContext } from "../../constants/i18n";
import { useIsMobile } from "../../hooks/use-mobile";
import { useVisualViewport } from "../../hooks/use-visual-viewport";
import { NoteEntryItem } from "./NoteEntryItem";
import { DraggableCard } from "./DraggableCard";
import { DayTemplatesModal } from "./DayTemplatesModal";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { TrashIcon, ChevronLeftIcon, ChevronRightIcon, GripIcon } from "../icons/Icons";

export function NoteModal({
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
  key?: React.Key;
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
  const isMobile = useIsMobile();
  const { height: vvHeight, offsetTop: vvOffsetTop, isKeyboardOpen } = useVisualViewport();
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

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
  const [goalColorPlacement, setGoalColorPlacement] = useState<"top" | "bottom">("bottom");
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
  const toggleColorPicker = (id: string) => {
    setColorPickerEntryId((prev) => (prev === id ? null : id));
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
  const [msEditColorPickerOpen, setMsEditColorPickerOpen] = useState(false);
  const [msEditColorPlacement, setMsEditColorPlacement] = useState<"top" | "bottom">("bottom");

  // New event form state
  const addEventFormRef = React.useRef<HTMLDivElement | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState(dk);
  const [newColor, setNewColor] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRecurSpinKey, setNewRecurSpinKey] = useState(0);
  const [newColorPickerOpen, setNewColorPickerOpen] = useState(false);
  const [newColorPlacement, setNewColorPlacement] = useState<"top" | "bottom">("bottom");

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
    setTimeout(() => {
      if (scrollBodyRef.current) {
        scrollBodyRef.current.scrollTo({
          top: scrollBodyRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 60);
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
      className="fixed z-50 flex items-center justify-center pointer-events-auto"
      style={{
        top: vvOffsetTop || 0,
        left: 0,
        right: 0,
        height: vvHeight || "100svh",
        overflow: "hidden",
        overscrollBehavior: "contain",
        padding: isMobile ? (isKeyboardOpen ? "8px 12px" : "12px 16px") : "16px",
      }}
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
          top: -100,
          bottom: -100,
          left: -100,
          right: -100,
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
          maxHeight: isMobile
            ? `${Math.max(220, vvHeight - (isKeyboardOpen ? 16 : 24))}px`
            : "calc(100svh - 2rem)",
          transition: "max-height 150ms ease",
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
          ref={scrollBodyRef}
          data-modal-scroll="true"
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
                              <div
                                style={{
                                  position: "relative",
                                  display: "inline-flex",
                                }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGoalColorPlacement(
                                      getPopoverPlacement(e.currentTarget),
                                    );
                                    setGoalColorPickerIdx((prev) =>
                                      prev === i ? null : i,
                                    );
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
                                {goalColorPickerIdx === i && (
                                  <motion.div
                                    key="goal-color-popover"
                                    initial={{
                                      opacity: 0,
                                      scale: 0.94,
                                      y: goalColorPlacement === "top" ? 4 : -4,
                                    }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{
                                      opacity: 0,
                                      scale: 0.94,
                                      y: goalColorPlacement === "top" ? 4 : -4,
                                    }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 420,
                                      damping: 28,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: "absolute",
                                      ...(goalColorPlacement === "top"
                                        ? { bottom: "calc(100% + 6px)" }
                                        : { top: "calc(100% + 6px)" }),
                                      right: 0,
                                      zIndex: 100,
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
                                        setGoalColorPickerIdx(null)
                                      }
                                    />
                                    <ColorSwatchGrid
                                      colors={APPLE_COLORS.map((ac) => ({
                                        key: ac.key,
                                        hex: dark ? ac.dark : ac.light,
                                        label: ac.label,
                                      }))}
                                      selected={goalsDraft.colors?.[i] ?? null}
                                      onSelect={(hex) => {
                                        handleGoalColorChange(i, hex);
                                        setGoalColorPickerIdx(null);
                                      }}
                                      onClear={() => {
                                        handleGoalColorChange(i, undefined);
                                        setGoalColorPickerIdx(null);
                                      }}
                                      clearLabel={t("noColor")}
                                      dark={dark}
                                    />
                                  </motion.div>
                                )}
                              </div>
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
                                <div className="flex items-center justify-between gap-2">
                                  <div
                                    className="flex items-center gap-1.5"
                                    style={{
                                      position: "relative",
                                      isolation: "isolate",
                                      marginLeft: 2,
                                    }}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMsEditColorPlacement(
                                          getPopoverPlacement(e.currentTarget),
                                        );
                                        setMsEditColorPickerOpen(
                                          (prev) => !prev,
                                        );
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
                                    {msEditColorPickerOpen && (
                                      <motion.div
                                        key="ms-edit-color-popover"
                                        initial={{
                                          opacity: 0,
                                          scale: 0.94,
                                          y:
                                            msEditColorPlacement === "top"
                                              ? 4
                                              : -4,
                                        }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{
                                          opacity: 0,
                                          scale: 0.94,
                                          y:
                                            msEditColorPlacement === "top"
                                              ? 4
                                              : -4,
                                        }}
                                        transition={{
                                          type: "spring",
                                          stiffness: 420,
                                          damping: 28,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          position: "absolute",
                                          ...(msEditColorPlacement === "top"
                                            ? { bottom: "calc(100% + 6px)" }
                                            : { top: "calc(100% + 6px)" }),
                                          left: 0,
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
                                      </motion.div>
                                    )}
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div
                        className="flex items-center gap-1.5"
                        style={{
                          position: "relative",
                          isolation: "isolate",
                          marginLeft: 2,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewColorPlacement(
                              getPopoverPlacement(e.currentTarget),
                            );
                            setNewColorPickerOpen((prev) => !prev);
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
                        {newColorPickerOpen && (
                          <motion.div
                            key="new-event-color-popover"
                            initial={{
                              opacity: 0,
                              scale: 0.94,
                              y: newColorPlacement === "top" ? 4 : -4,
                            }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{
                              opacity: 0,
                              scale: 0.94,
                              y: newColorPlacement === "top" ? 4 : -4,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 420,
                              damping: 28,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              ...(newColorPlacement === "top"
                                ? { bottom: "calc(100% + 6px)" }
                                : { top: "calc(100% + 6px)" }),
                              left: 0,
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
                          </motion.div>
                        )}
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
                      modalBg={modalBg}
                      inputBg={inputBg}
                      borderColor={borderColor}
                      hoveredEntryId={hoveredEntryId}
                      setHoveredEntryId={setHoveredEntryId}
                      updateEntry={updateEntry}
                      updateEntryColor={updateEntryColor}
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