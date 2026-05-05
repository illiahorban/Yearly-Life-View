import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DayNote } from "./types";
import { MONTHS } from "./types";

const QUICK_EMOJIS = ["✨","🔥","💡","🎯","😊","😔","💪","🌟","📚","🏃","🎉","❤️","🙏","☕","🌙","⚡"];

export function NoteModal({
  date, existing, onSave, onDelete, onClose,
}: {
  date: Date;
  existing: DayNote | undefined;
  onSave: (note: DayNote) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(existing?.text ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSave = () => {
    if (text.trim() || emoji) onSave({ text: text.trim(), emoji });
    else onClose();
  };

  const dayLabel = `${date.getDate()} ${MONTHS[date.getMonth()]}`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: "var(--surface)",
          borderRadius: 22,
          boxShadow: "0 28px 80px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.4) inset",
          border: "1px solid var(--border-soft)",
        }}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>Day note</div>
            <div className="text-lg font-semibold mt-0.5" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>{dayLabel}</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full mt-0.5"
            style={{ background: "var(--border-soft)", color: "var(--text-secondary)" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(emoji === em ? "" : em)}
                style={{
                  width: 34, height: 34, borderRadius: 9, fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: emoji === em ? "rgba(52,199,89,0.12)" : "var(--border-soft)",
                  border: `1.5px solid ${emoji === em ? "var(--apple-green)" : "transparent"}`,
                  transition: "background 150ms, border-color 150ms",
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a note for this day…"
            rows={3}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
              if (e.key === "Escape") onClose();
            }}
            className="w-full resize-none outline-none text-[14px] leading-relaxed"
            style={{
              background: "var(--border-soft)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
              padding: "10px 12px",
              color: "var(--text)",
            }}
          />
        </div>

        <div className="px-5 py-4 flex items-center justify-between">
          {existing ? (
            <button
              type="button"
              onClick={() => { onDelete(); onClose(); }}
              className="text-[13px] font-medium"
              style={{ color: "#ff3b30" }}
            >
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              type="button" onClick={onClose}
              className="text-[13px] font-medium px-3 py-1.5 rounded-xl"
              style={{ color: "var(--text-secondary)", background: "var(--border-soft)" }}
            >
              Cancel
            </button>
            <button
              type="button" onClick={handleSave}
              className="text-[13px] font-semibold px-3 py-1.5 rounded-xl"
              style={{ color: "white", background: "linear-gradient(180deg, #5ed47b 0%, #34c759 100%)", boxShadow: "0 1px 3px rgba(40,167,69,0.3)" }}
            >
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
