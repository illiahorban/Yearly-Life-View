import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import type { DayState, Milestone, NoteEntry, DayGoals, AppleColorKey } from "../../types/calendar";
import { dateKey, sameDay, parseDateQuery } from "../../utils/date-utils";
import { FIRE_ANIM_DURATION_MS, adaptColor, achromaticStyle, resolveNoteHex, normaliseGrey } from "../../constants/colors";
import { GripIcon } from "../icons/Icons";

const FIRE_ANIM_DURATION_MS = 4000; // 4.0s keyframe cycle in index.css

// ─── DayTile ──────────────────────────────────────────────────────────────────

export function DayTile({
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
  const indicatorColor =
    labelTone === "onGreen"
      ? "white"
      : labelTone === "darkOnLight"
        ? "#18181b"
        : labelTone === "invertPale"
          ? "#ffffff"
          : "var(--text)";
  const microMarkers =
    dayGoals && dayGoals.count > 0
      ? (() => {
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
                  fill="#34c759"
                />
                <path
                  d="M1.4 3l1.1 1.1 2.1-2.2"
                  stroke="#ffffff"
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
                style={{ flexShrink: 0, overflow: "hidden" }}
              >
                <rect
                  x="0.75"
                  y="0.75"
                  width="4.5"
                  height="4.5"
                  rx="1"
                  stroke={indicatorColor}
                  strokeWidth="1.2"
                />
              </svg>
            );
          });
          const plusColor = allDone ? "#34c759" : indicatorColor;
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
              }}
            >
              <path
                d="M3 1v4M1 3h4"
                stroke={plusColor}
                strokeWidth="1.4"
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
    fireDelayRef.current = `${-((Date.now() % FIRE_ANIM_DURATION_MS) / 1000).toFixed(3)}s`;
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
            className="flex flex-col items-center"
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
              className="flex items-center justify-center -translate-y-0.5 sm:translate-y-0"
              style={{
                flex: 1,
                width: "100%",
                overflow: "visible",
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
            <div className="absolute inset-0 flex flex-col items-center">
              <div style={{ flex: 1 }} />
              <Label number={dayNumber} month={monthAbbr} tone={labelTone} />
              <div
                className="flex items-center justify-center -translate-y-0.5 sm:translate-y-0"
                style={{
                  flex: 1,
                  width: "100%",
                  overflow: "visible",
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
          className="flex flex-col items-center justify-center"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            overflow: "hidden",
            contain: "paint",
            background: "var(--surface)",
            color: "var(--text-secondary)",
            boxShadow: hovered
              ? "0 2px 10px rgba(0,0,0,0.08), inset 0 0 0 1px var(--border-soft)"
              : "0 1px 1px rgba(0,0,0,0.02), inset 0 0 0 1px var(--border-soft)",
          }}
        >
          {msBar}
          <div style={{ flex: 1 }} />
          <Label number={dayNumber} month={monthAbbr} tone={labelTone} />
          <div
            className="flex items-center justify-center -translate-y-0.5 sm:translate-y-0"
            style={{
              flex: 1,
              width: "100%",
              overflow: "visible",
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
  const monColor = numColor;
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
    ...(isInvertPale ? { mixBlendMode: "difference" } : null),
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