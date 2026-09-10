import React from "react";
import type { I18nKey } from "../../constants/i18n";

interface YearProgressBarProps {
  yearProgress: number;
  daysCompleted: number;
  totalDays: number;
  t: (k: I18nKey) => string;
}

export const YearProgressBar = React.memo(function YearProgressBar({
  yearProgress,
  daysCompleted,
  totalDays,
  t,
}: YearProgressBarProps) {
  return (
    <>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden"
        style={{ background: "var(--border-soft)", borderRadius: 999 }}
      >
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${yearProgress}%`,
            background: "#34c759",
            borderRadius: 999,
          }}
        />
      </div>

      <div
        className="mt-2 flex items-center justify-between text-xs tabular-nums"
        style={{ color: "var(--text-tertiary)" }}
      >
        <span>
          {daysCompleted} {t("of")} {totalDays} {t("daysOf")}
        </span>
        <span>
          {yearProgress.toFixed(1)}% {t("complete")}
        </span>
        <span>
          {(totalDays - daysCompleted).toFixed(0)} {t("daysRemaining")}
        </span>
      </div>
    </>
  );
});
