import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Milestone } from "../../types/calendar";
import { daysBetween } from "../../utils/date-utils";
import { getEventColors } from "../../constants/colors";
import type { I18nKey } from "../../constants/i18n";

interface MilestoneCountdownStripProps {
  nextMilestones: Milestone[];
  today: Date;
  dark: boolean;
  t: (k: I18nKey) => string;
  onOpenMilestones: () => void;
}

export const MilestoneCountdownStrip = React.memo(function MilestoneCountdownStrip({
  nextMilestones,
  today,
  dark,
  t,
  onOpenMilestones,
}: MilestoneCountdownStripProps) {
  return (
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
            const msColTxt =
              dark && ec.border === "#ffffff"
                ? "#ffffff"
                : !dark && ec.border === "#000000"
                  ? "#000000"
                  : ec.textTitle;
            return (
              <button
                key={ms.id}
                type="button"
                onClick={onOpenMilestones}
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
  );
});
