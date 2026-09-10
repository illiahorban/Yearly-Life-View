import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { I18nKey } from "../../constants/i18n";

interface TodayFloatingButtonProps {
  showTodayBtn: boolean;
  scrollToToday: () => void;
  dark: boolean;
  t: (k: I18nKey) => string;
}

export const TodayFloatingButton: React.FC<TodayFloatingButtonProps> = ({
  showTodayBtn,
  scrollToToday,
  dark,
  t,
}) => {
  return (
    <AnimatePresence>
      {showTodayBtn && (
        <motion.button
          type="button"
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
  );
};
