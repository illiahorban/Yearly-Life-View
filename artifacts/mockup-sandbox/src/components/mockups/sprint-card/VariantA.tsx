// Вариант А · Всё в одну строку
// Номер + цвет + название + stepper + действия — одна горизонтальная строка
import { RotateCcw, Trash2 } from "lucide-react";

const COLOR = "#f59e0b";
const BORDER = "rgba(245,158,11,0.35)";

export function VariantA() {
  const blocks = [
    { id: 1, label: "Планирование", weeks: 3 },
    { id: 2, label: "Разработка ключевых функций продукта", weeks: 6 },
    { id: 3, label: "Q3 / Финальная полировка и релиз", weeks: 4 },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6">
      <p className="text-xs font-semibold tracking-widest uppercase text-[#8e8e93] mb-4">
        Вариант А · Всё в одну строку
      </p>
      <div className="w-full max-w-sm space-y-2">
        {blocks.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border"
            style={{ background: `${COLOR}10`, borderColor: BORDER }}
          >
            {/* Номер */}
            <div
              className="text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0"
              style={{
                width: 20, height: 20, borderRadius: 999,
                background: `${COLOR}22`, color: COLOR,
              }}
            >
              {b.id}
            </div>

            {/* Цветовой кружок */}
            <button
              className="shrink-0"
              style={{
                width: 12, height: 12, borderRadius: 999,
                background: COLOR,
                boxShadow: "0 0 0 2px rgba(255,255,255,0.9), 0 0 0 3px rgba(0,0,0,0.25)",
                border: "none", cursor: "pointer",
              }}
            />

            {/* Название — растягивается */}
            <span
              className="flex-1 text-[13px] font-medium truncate"
              style={{ color: COLOR }}
            >
              {b.label}
            </span>

            {/* Stepper недель */}
            <div
              className="flex items-center gap-0.5 shrink-0"
              style={{
                background: "rgba(120,120,128,0.15)",
                border: "1px solid rgba(120,120,128,0.3)",
                borderRadius: 7, padding: "1px 3px",
              }}
            >
              <button className="w-5 h-5 text-[13px] text-[#8e8e93] rounded">−</button>
              <span className="text-[11px] font-semibold tabular-nums w-5 text-center" style={{ color: COLOR }}>
                {b.weeks}w
              </span>
              <button className="w-5 h-5 text-[13px] text-[#8e8e93] rounded">+</button>
            </div>

            {/* Сброс */}
            <button className="w-6 h-6 flex items-center justify-center rounded-md text-[#ff3b30] shrink-0">
              <RotateCcw size={11} />
            </button>

            {/* Удалить */}
            <button className="w-6 h-6 flex items-center justify-center rounded-md text-[#ff3b30] shrink-0">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Подпись */}
      <p className="text-[11px] text-[#8e8e93] mt-5 text-center">
        ✓ Компактно · Всё видно сразу<br/>
        ✗ Длинное название обрезается
      </p>
    </div>
  );
}
