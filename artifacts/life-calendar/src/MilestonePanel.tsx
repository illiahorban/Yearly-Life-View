import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Milestone } from "./types";
import { makeId } from "./types";

const COLORS = ["#0a84ff","#34c759","#ff9500","#ff3b30","#af52de","#ff2d55","#5ac8fa","#ffcc00"];

export function MilestoneCountdown({
  milestones, today, onOpen,
}: {
  milestones: Milestone[];
  today: Date;
  onOpen: () => void;
}) {
  const todayMs = today.getTime();
  const upcoming = milestones
    .map((m) => ({ ...m, ms: new Date(m.date + "T00:00:00").getTime() }))
    .filter((m) => m.ms >= todayMs)
    .sort((a, b) => a.ms - b.ms);
  const next = upcoming[0];
  if (!next) return null;
  const daysUntil = Math.round((next.ms - todayMs) / 86_400_000);
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2.5 w-full text-left mt-3"
      style={{
        padding: "9px 13px", borderRadius: 12,
        background: `${next.color}15`,
        border: `1px solid ${next.color}35`,
        transition: "opacity 150ms",
      }}
    >
      <span style={{ fontSize: 18 }}>{next.emoji || "📍"}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold truncate" style={{ color: "var(--text)" }}>{next.label}</div>
        <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{next.date}</div>
      </div>
      <div className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: next.color }}>
        {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
      </div>
      {upcoming.length > 1 && (
        <div className="text-[10px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>+{upcoming.length - 1}</div>
      )}
    </button>
  );
}

export function MilestoneModal({
  milestones, onSave, onClose,
}: {
  milestones: Milestone[];
  onSave: (ms: Milestone[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Milestone[]>(milestones.map((m) => ({ ...m })));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: "", label: "", emoji: "", color: COLORS[0]! });

  const commitAdd = () => {
    if (!draft.date || !draft.label.trim()) return;
    setList((p) => [...p, { id: makeId(), date: draft.date, label: draft.label.trim(), emoji: draft.emoji, color: draft.color }]);
    setDraft({ date: "", label: "", emoji: "", color: COLORS[0]! });
    setAdding(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.38)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="w-full max-w-md flex flex-col"
        style={{
          background: "var(--surface)", borderRadius: 22,
          boxShadow: "0 28px 80px rgba(0,0,0,0.2)",
          border: "1px solid var(--border-soft)",
          maxHeight: "82vh", overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-base font-semibold" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>Milestones</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ background: "var(--border-soft)", color: "var(--text-secondary)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5">
          <div className="flex flex-col gap-2 pb-2">
            {list.length === 0 && !adding && (
              <div className="text-center py-8 text-[13px]" style={{ color: "var(--text-tertiary)" }}>No milestones yet — add one below</div>
            )}
            <AnimatePresence initial={false}>
              {list.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{ background: "var(--border-soft)", borderRadius: 12, border: `1px solid ${m.color}20` }}
                >
                  <span style={{ fontSize: 18 }}>{m.emoji || "📍"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{m.label}</div>
                    <div className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>{m.date}</div>
                  </div>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color }} />
                  <button onClick={() => setList((p) => p.filter((x) => x.id !== m.id))} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "#ff3b30" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {adding && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 flex flex-col gap-2"
                style={{ background: "var(--border-soft)", borderRadius: 12, border: "1px solid var(--border)" }}
              >
                <div className="flex gap-2">
                  <input type="text" value={draft.emoji} onChange={(e) => setDraft((p) => ({ ...p, emoji: e.target.value }))}
                    placeholder="🎯" maxLength={2} className="outline-none text-center text-lg"
                    style={{ width: 42, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
                  <input type="text" value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
                    placeholder="Milestone label" autoFocus className="flex-1 outline-none text-[13px]"
                    style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", padding: "8px 11px", color: "var(--text)" }} />
                </div>
                <input type="date" value={draft.date} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
                  className="outline-none text-[13px] w-full"
                  style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", padding: "8px 11px", color: "var(--text)" }} />
                <div className="flex items-center gap-2">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setDraft((p) => ({ ...p, color: c }))}
                      className="w-5 h-5 rounded-full shrink-0"
                      style={{ background: c, boxShadow: draft.color === c ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${c}` : "none" }} />
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAdding(false)} className="text-[12px] px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)", background: "var(--border)" }}>Cancel</button>
                  <button onClick={commitAdd} disabled={!draft.date || !draft.label.trim()} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ color: "white", background: "#34c759", opacity: (!draft.date || !draft.label.trim()) ? 0.5 : 1 }}>Add</button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <button onClick={() => !adding && setAdding(true)} className="text-[13px] font-medium" style={{ color: adding ? "var(--text-tertiary)" : "var(--apple-green)" }}>+ Add milestone</button>
          <button onClick={() => { onSave(list); onClose(); }} className="text-[13px] font-semibold px-4 py-1.5 rounded-xl"
            style={{ color: "white", background: "linear-gradient(180deg, #5ed47b, #34c759)", boxShadow: "0 1px 3px rgba(40,167,69,0.3)" }}>
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
