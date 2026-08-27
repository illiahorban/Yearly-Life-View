import React from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LangContext } from "../../constants/i18n";

export function ConfirmDialog({
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