import React, { useState, useMemo, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { NoteEntry, Milestone, DayGoals, AppleColorKey, Quarter } from "../../types/calendar";
import { parseDateQuery, dateKey } from "../../utils/date-utils";
import { makeId, newTimestamps } from "../../utils/storage";
import { APPLE_COLORS, adaptColor, achromaticStyle, resolveNoteHex, getEventColors } from "../../constants/colors";
import { LangContext, WEEKS_PER_QUARTER } from "../../constants/i18n";
import { HighlightText } from "../common/HighlightText";
import { ColorSwatchGrid } from "../common/ColorSwatchGrid";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SearchIcon, TrashIcon } from "../icons/Icons";

export function NotesPanel({
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
  key?: React.Key;
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
    setDraftColorPickerOpen((prev) => !prev);
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
              {draftColorPickerOpen && (
                <motion.div
                  key="draft-color-popover"
                  initial={{ opacity: 0, scale: 0.94, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -4 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
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
                </motion.div>
              )}
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