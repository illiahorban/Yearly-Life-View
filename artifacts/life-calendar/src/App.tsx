import { useEffect, useMemo, useRef, useState } from "react";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfYear(year: number) {
  return new Date(year, 0, 1);
}

function startOfNextYear(year: number) {
  return new Date(year + 1, 0, 1);
}

// Monday-start week containing the given date
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = Sun
  const diff = (dow + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type DayState = "past" | "today" | "future" | "out";

function App() {
  const [now, setNow] = useState<Date>(() => new Date());

  // Tick every minute so today's tile and the year bar update in real time
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const year = now.getFullYear();

  const weeks = useMemo(() => {
    const firstDay = startOfYear(year);
    const firstMonday = startOfWeekMonday(firstDay);
    return Array.from({ length: 52 }, (_, i) => {
      const weekStart = addDays(firstMonday, i * 7);
      const days = Array.from({ length: 7 }, (_, j) => addDays(weekStart, j));
      return { weekStart, days };
    });
  }, [year]);

  const yearProgress = useMemo(() => {
    const start = startOfYear(year).getTime();
    const end = startOfNextYear(year).getTime();
    const pct = ((now.getTime() - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [now, year]);

  const todayProgress = useMemo(() => {
    const start = startOfDay(now).getTime();
    const ms = now.getTime() - start;
    return Math.max(0, Math.min(100, (ms / 86_400_000) * 100));
  }, [now]);

  const currentWeekIndex = useMemo(() => {
    const today = startOfDay(now);
    return weeks.findIndex(({ days }) => days.some((d) => sameDay(d, today)));
  }, [weeks, now]);

  const weekRefs = useRef<Array<HTMLDivElement | null>>([]);
  const didScrollRef = useRef(false);

  useEffect(() => {
    if (didScrollRef.current) return;
    if (currentWeekIndex < 0) return;
    const el = weekRefs.current[currentWeekIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      didScrollRef.current = true;
    }
  }, [currentWeekIndex]);

  const today = startOfDay(now);

  const dayState = (d: Date): DayState => {
    if (d.getFullYear() !== year) return "out";
    if (sameDay(d, today)) return "today";
    if (d < today) return "past";
    return "future";
  };

  const daysCompleted = useMemo(() => {
    let n = 0;
    for (const { days } of weeks) {
      for (const d of days) {
        if (d.getFullYear() === year && d < today) n++;
      }
    }
    return n;
  }, [weeks, today, year]);

  const totalDays =
    (startOfNextYear(year).getTime() - startOfYear(year).getTime()) / 86_400_000;

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--bg)" }}>
      {/* Header / Year progress */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "rgba(245,245,247,0.85)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-7 pb-5">
          <div className="flex items-baseline justify-between">
            <h1
              className="text-2xl sm:text-3xl font-semibold tracking-tight"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              {year}
            </h1>
            <div
              className="text-sm tabular-nums"
              style={{ color: "var(--text-secondary)" }}
            >
              {yearProgress.toFixed(1)}% complete
            </div>
          </div>

          <div
            className="mt-4 h-2.5 w-full overflow-hidden"
            style={{
              background: "var(--border-soft)",
              borderRadius: 999,
            }}
          >
            <div
              className="h-full transition-[width] duration-700 ease-out"
              style={{
                width: `${yearProgress}%`,
                background:
                  "linear-gradient(90deg, #5ed47b 0%, #34c759 55%, #28a745 100%)",
                borderRadius: 999,
                boxShadow: "0 0 0 0.5px rgba(40,167,69,0.25) inset",
              }}
            />
          </div>

          <div
            className="mt-3 flex items-center justify-between text-xs tabular-nums"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>
              {daysCompleted} of {totalDays} days
            </span>
            <span>{(totalDays - daysCompleted).toFixed(0)} days remaining</span>
          </div>
        </div>
      </header>

      {/* Main view */}
      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8">
        <div
          className="mb-3 grid grid-cols-7 gap-2 sm:gap-3 px-1"
          style={{ color: "var(--text-tertiary)" }}
        >
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              className="text-center text-[10px] font-medium tracking-widest uppercase"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:gap-3">
          {weeks.map(({ days }, wi) => {
            const isCurrent = wi === currentWeekIndex;
            return (
              <div
                key={wi}
                ref={(el) => {
                  weekRefs.current[wi] = el;
                }}
                className="grid grid-cols-7 gap-2 sm:gap-3"
              >
                {days.map((d, di) => (
                  <DayTile
                    key={di}
                    date={d}
                    state={dayState(d)}
                    todayProgress={todayProgress}
                    highlightWeek={isCurrent}
                  />
                ))}
              </div>
            );
          })}
        </div>

        <footer
          className="mt-12 pb-8 text-center text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          Life Calendar · {year}
        </footer>
      </main>
    </div>
  );
}

function DayTile({
  date,
  state,
  todayProgress,
  highlightWeek,
}: {
  date: Date;
  state: DayState;
  todayProgress: number;
  highlightWeek: boolean;
}) {
  const isOut = state === "out";
  const isPast = state === "past";
  const isToday = state === "today";

  const baseStyle: React.CSSProperties = {
    borderRadius: 14,
    aspectRatio: "1 / 1",
    transition: "transform 200ms ease, box-shadow 200ms ease",
  };

  const dayNumber = date.getDate();
  const monthAbbr = MONTHS[date.getMonth()];

  if (isOut) {
    return (
      <div
        style={{
          ...baseStyle,
          background: "transparent",
          border: "1px dashed var(--border-soft)",
          opacity: 0.5,
        }}
      />
    );
  }

  // Past — fully filled apple green
  if (isPast) {
    return (
      <div
        className="relative flex flex-col items-center justify-center"
        style={{
          ...baseStyle,
          background:
            "linear-gradient(160deg, #5ed47b 0%, #34c759 60%, #2ab84f 100%)",
          color: "white",
          boxShadow:
            "0 1px 2px rgba(40,167,69,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.18)",
        }}
      >
        <Label number={dayNumber} month={monthAbbr} tone="onGreen" />
      </div>
    );
  }

  // Today — partial green fill from bottom
  if (isToday) {
    return (
      <div
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{
          ...baseStyle,
          background: "var(--surface)",
          border: "1.5px solid var(--apple-green)",
          boxShadow:
            "0 0 0 4px rgba(52,199,89,0.12), 0 4px 14px rgba(52,199,89,0.18)",
          color: "var(--text)",
        }}
        aria-label={`Today, ${todayProgress.toFixed(0)}% elapsed`}
      >
        {/* fill */}
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
          style={{
            height: `${todayProgress}%`,
            background:
              "linear-gradient(180deg, rgba(94,212,123,0.85) 0%, #34c759 100%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center justify-center">
          <Label number={dayNumber} month={monthAbbr} tone="auto" />
        </div>
      </div>
    );
  }

  // Future
  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{
        ...baseStyle,
        background: "var(--surface)",
        border: `1px solid ${highlightWeek ? "#c7c7cc" : "var(--border-soft)"}`,
        color: "var(--text-secondary)",
        boxShadow: highlightWeek
          ? "0 1px 2px rgba(0,0,0,0.03)"
          : "0 1px 1px rgba(0,0,0,0.02)",
      }}
    >
      <Label number={dayNumber} month={monthAbbr} tone="muted" />
    </div>
  );
}

function Label({
  number,
  month,
  tone,
}: {
  number: number;
  month: string;
  tone: "onGreen" | "muted" | "auto";
}) {
  const numberColor =
    tone === "onGreen" ? "white" : tone === "muted" ? "var(--text)" : "var(--text)";
  const monthColor =
    tone === "onGreen"
      ? "rgba(255,255,255,0.85)"
      : tone === "muted"
        ? "var(--text-tertiary)"
        : "var(--text-secondary)";

  return (
    <div className="flex flex-col items-center justify-center leading-none select-none">
      <div
        className="text-base sm:text-lg font-semibold tabular-nums"
        style={{ color: numberColor, letterSpacing: "-0.02em" }}
      >
        {number}
      </div>
      <div
        className="mt-1 text-[9px] sm:text-[10px] font-medium tracking-widest"
        style={{ color: monthColor }}
      >
        {month}
      </div>
    </div>
  );
}

export default App;
