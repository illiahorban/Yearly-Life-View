import React, { useState, useMemo, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Milestone, DayGoals, Quarter } from "../../types/calendar";
import { dateKey } from "../../utils/date-utils";
import { makeId, newTimestamps } from "../../utils/storage";
import { MILESTONE_COLORS, APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, getEventColors, clampedPopoverPos } from "../../constants/colors";
import { LangContext, WEEKS_PER_QUARTER } from "../../constants/i18n";
import { useIsMobile } from "../../hooks/use-mobile";
import { useVisualViewport } from "../../hooks/use-visual-viewport";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { HighlightText } from "../common/HighlightText";
import { FlagIcon, TrashIcon, CheckIcon, SearchIcon } from "../icons/Icons";

export function MilestoneModal({
  milestones,
  resolvedQuarters,
  weeks,
  dark,
  modalBg,
  onClose,
  onChange,
}: {
  key?: React.Key;
  milestones: Milestone[];
  resolvedQuarters: Quarter[];
  weeks: { weekStart: Date; days: Date[] }[];
  dark: boolean;
  modalBg: string;
  onClose: () => void;
  onChange: (m: Milestone[]) => void;
}) {
  const { t, lang } = React.useContext(LangContext);
  const isMobile = useIsMobile();
  const { height: vvHeight, offsetTop: vvOffsetTop, isKeyboardOpen } = useVisualViewport();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

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

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);
  const [editRecurSpinKey, setEditRecurSpinKey] = useState(0);
  const [editColorPickerOpen, setEditColorPickerOpen] = useState(false);

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
      className="fixed z-50 flex items-center justify-center pointer-events-auto"
      style={{
        top: isMobile ? vvOffsetTop : 0,
        left: 0,
        right: 0,
        height: isMobile ? vvHeight : "100svh",
        overflow: "hidden",
        overscrollBehavior: "contain",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "fixed",
          top: -200,
          bottom: -200,
          left: -200,
          right: -200,
          background: "rgba(0,0,0,0.36)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(92vw,440px)",
          background: modalBg,
          backdropFilter: "saturate(180%) blur(28px)",
          WebkitBackdropFilter: "saturate(180%) blur(28px)",
          borderRadius: 22,
          boxShadow: `0 20px 60px rgba(0,0,0,0.28), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflowY: "auto",
          maxHeight: isMobile
            ? `${Math.max(220, vvHeight - 32)}px`
            : "calc(100svh - 2rem)",
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
                    <div style={{ position: "relative", display: "inline-flex" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftColorPickerOpen((v) => !v);
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
                      {draftColorPickerOpen && (
                        <motion.div
                          key="ms-draft-color-popover"
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
                            top: "calc(100% + 6px)",
                            right: 0,
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
                        </motion.div>
                      )}
                    </div>
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
                          <div style={{ position: "relative", display: "inline-flex" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditColorPickerOpen((v) => !v);
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
                            {editColorPickerOpen && (
                              <motion.div
                                key="ms-edit-color-popover"
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
                                  top: "calc(100% + 6px)",
                                  right: 0,
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
                              </motion.div>
                            )}
                          </div>
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