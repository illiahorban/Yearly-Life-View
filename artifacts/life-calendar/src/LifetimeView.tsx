const LIFETIME_YEARS = 90;

export function LifetimeView({
  currentYear, selectedYear, onSelectYear,
}: {
  currentYear: number;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}) {
  const birthYear = currentYear - 30;
  const years = Array.from({ length: LIFETIME_YEARS }, (_, i) => birthYear + i);

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-6">
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
          90-year life map · tap any year to view it
        </div>
        <div className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Each square is one year of your life. Green = past, bright = now, empty = future.
        </div>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
        {years.map((y) => {
          const isPast = y < currentYear;
          const isCurrent = y === currentYear;
          const isSelected = y === selectedYear && !isCurrent;
          return (
            <button
              key={y}
              onClick={() => onSelectYear(y)}
              title={String(y)}
              style={{
                aspectRatio: "1/1",
                borderRadius: 7,
                background: isCurrent
                  ? "linear-gradient(135deg, #5ed47b, #28a745)"
                  : isPast
                  ? "rgba(52,199,89,0.28)"
                  : "var(--surface)",
                border: isSelected
                  ? "2px solid var(--apple-green)"
                  : isCurrent
                  ? "none"
                  : isPast
                  ? "1px solid rgba(52,199,89,0.22)"
                  : "1px solid var(--border-soft)",
                boxShadow: isCurrent
                  ? "0 0 0 3px rgba(52,199,89,0.25), 0 2px 8px rgba(52,199,89,0.35)"
                  : "none",
                cursor: "pointer",
                transition: "transform 120ms ease, box-shadow 120ms ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? "white" : isPast ? "#2ab84f" : "var(--text-tertiary)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.zIndex = "10"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.zIndex = "auto"; }}
            >
              {(y % 10 === 0 || isCurrent) ? y : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(52,199,89,0.28)", border: "1px solid rgba(52,199,89,0.22)" }} />
          Past
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 4, background: "linear-gradient(135deg, #5ed47b, #28a745)" }} />
          Now
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 4, background: "var(--surface)", border: "1px solid var(--border-soft)" }} />
          Future
        </div>
      </div>
    </div>
  );
}
