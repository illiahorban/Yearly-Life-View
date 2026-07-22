// Вариант Б · Название слева + кнопки справа колонкой
import { RotateCcw, Trash2 } from "lucide-react";

const COLOR = "#f59e0b";
const BORDER = "rgba(245,158,11,0.35)";

export function VariantB() {
  const blocks = [
    { id: 1, label: "Планирование", weeks: 3 },
    { id: 2, label: "Разработка ключевых функций продукта", weeks: 6 },
    { id: 3, label: "Q3 / Финальная полировка и релиз", weeks: 4 },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6">
      <p className="text-xs font-semibold tracking-widest uppercase text-[#8e8e93] mb-4">
        Вариант Б · Название + правая панель
      </p>
      <div className="w-full max-w-sm space-y-2">
        {blocks.map((b) => (
          <div
            key={b.id}
            className="flex items-stretch gap-0 rounded-xl border overflow-hidden"
            style={{ background: `${COLOR}10`, borderColor: BORDER }}
          >
            {/* Левая часть: номер + цвет + название */}
            <div className="flex items-start gap-2 px-3 py-2.5 flex-1 min-w-0">
              <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                {/* Номер */}
                <div
                  className="text-[10px] font-bold tabular-nums flex items-center justify-center"
                  style={{
                    width: 18, height: 18, borderRadius: 999,
                    background: `${COLOR}22`, color: COLOR,
                  }}
                >
                  {b.id}
                </div>
                {/* Цветовой кружок */}
                <button
                  style={{
                    width: 10, height: 10, borderRadius: 999,
                    background: COLOR,
                    boxShadow: "0 0 0 1.5px rgba(255,255,255,0.9), 0 0 0 2.5px rgba(0,0,0,0.22)",
                    border: "none", cursor: "pointer", flexShrink: 0,
                  }}
                />
              </div>

              {/* Название */}
              <span
                className="text-[13px] font-medium leading-snug break-words min-w-0"
                style={{ color: COLOR }}
              >
                {b.label}
              </span>
            </div>

            {/* Правая панель: разделитель + контролы */}
            <div
              className="flex flex-col items-center justify-between shrink-0 py-2 px-2 gap-1"
              style={{ borderLeft: `1px solid ${BORDER}` }}
            >
              {/* Stepper */}
              <div
                className="flex items-center gap-0.5"
                style={{
                  background: "rgba(120,120,128,0.15)",
                  border: "1px solid rgba(120,120,128,0.3)",
                  borderRadius: 7, padding: "1px 3px",
                }}
              >
                <button className="w-5 h-5 text-[13px] text-[#8e8e93] rounded">−</button>
                <span className="text-[11px] font-semibold tabular-nums w-5 text-center" style={{ color: COLOR }}>
                  {b.weeks}
                </span>
                <button className="w-5 h-5 text-[13px] text-[#8e8e93] rounded">+</button>
              </div>

              {/* Действия */}
              <div className="flex gap-0.5">
                <button className="w-6 h-6 flex items-center justify-center rounded text-[#ff3b30]">
                  <RotateCcw size={11} />
                </button>
                <button className="w-6 h-6 flex items-center justify-center rounded text-[#ff3b30]">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#8e8e93] mt-5 text-center">
        ✓ Название не обрезается · Кнопки всегда на виду<br/>
        ✓ Хорошо для длинных названий
      </p>
    </div>
  );
}
