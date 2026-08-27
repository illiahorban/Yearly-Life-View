import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function FactoryResetDialog({
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