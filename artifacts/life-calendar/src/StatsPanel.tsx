import { useMemo } from "react";
import type { Notes } from "./types";
import { sameDay, startOfYear, startOfNextYear, dateKey } from "./storage";

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--border-soft)", minWidth: 80 }}>
      <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: color ?? "var(--text)", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>{sub}</div>}
    </div>
  );
}

export function StatsPanel({ year, now, weeks, notes }: {
  year: number;
  now: Date;
  weeks: Array<{ weekStart: Date; days: Date[] }>;
  notes: Notes;
}) {
  const stats = useMemo(() => {
    const today = new Date(now); today.setHours(0,0,0,0);
    let weekdaysDone = 0, weekendsDone = 0;
    const quarterDays = [0, 0, 0, 0];

    for (let wi = 0; wi < weeks.length; wi++) {
      const qi = Math.floor(wi / 13);
      for (const d of weeks[wi]!.days) {
        if (d.getFullYear() !== year) continue;
        if (d < today || sameDay(d, today)) {
          const dow = d.getDay();
          if (dow === 0 || dow === 6) weekendsDone++;
          else weekdaysDone++;
          if (qi < 4) quarterDays[qi]!++;
        }
      }
    }

    // Note streak: consecutive days with notes counting back from today
    let streak = 0;
    const check = new Date(today);
    for (let i = 0; i < 366; i++) {
      if (notes[dateKey(check)]) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }

    const totalDays = Math.round((startOfNextYear(year).getTime() - startOfYear(year).getTime()) / 86_400_000);
    const elapsed = weekdaysDone + weekendsDone;
    const pct = (elapsed / totalDays * 100).toFixed(1);
    const notedDays = Object.keys(notes).filter((k) => k.startsWith(`${year}-`)).length;

    return { weekdaysDone, weekendsDone, streak, pct, elapsed, totalDays, quarterDays, notedDays };
  }, [year, now, weeks, notes]);

  const QUARTER_COLORS = ["#0a84ff", "#34c759", "#b58900", "#c2410c"];

  return (
    <div className="mt-3 mb-1">
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <div style={{ background: "linear-gradient(135deg, #5ed47b, #28a745)", borderRadius: 14, padding: "12px 16px", minWidth: 96, flexShrink: 0 }}>
          <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.75)" }}>Year</div>
          <div className="mt-1 text-2xl font-bold text-white tabular-nums" style={{ letterSpacing: "-0.03em" }}>{stats.pct}%</div>
          <div className="mt-0.5 text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>{stats.elapsed} / {stats.totalDays}d</div>
        </div>
        <StatCard label="Weekdays" value={String(stats.weekdaysDone)} sub="done" />
        <StatCard label="Weekends" value={String(stats.weekendsDone)} sub="done" />
        <StatCard label="Streak" value={`${stats.streak}d`} sub={`${stats.notedDays} noted`} color={stats.streak > 0 ? "var(--apple-green)" : undefined} />
      </div>

      <div className="flex gap-2 mt-2">
        {[0,1,2,3].map((qi) => {
          const qPct = Math.min(100, stats.quarterDays[qi]! / (13 * 7) * 100);
          return (
            <div key={qi} style={{ flex: 1, background: "var(--surface)", borderRadius: 12, padding: "8px 10px", border: "1px solid var(--border-soft)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: QUARTER_COLORS[qi] }}>Q{qi+1}</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>{qPct.toFixed(0)}%</div>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
                <div style={{ width: `${qPct}%`, height: "100%", background: QUARTER_COLORS[qi], borderRadius: 999, transition: "width 600ms ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
