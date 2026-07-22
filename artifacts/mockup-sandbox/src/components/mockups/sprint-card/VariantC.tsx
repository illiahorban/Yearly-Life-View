// Вариант В · Номер + название сверху, инфо-строка снизу
import { RotateCcw, Trash2 } from "lucide-react";

const COLOR = "#f59e0b";
const BORDER = "rgba(245,158,11,0.35)";

export function VariantC() {
  const blocks = [
    { id: 1, label: "Планирование", weeks: 3 },
    { id: 2, label: "Разработка ключевых функций продукта", weeks: 6 },
    { id: 3, label: "Q3 / Финальная полировка и релиз", weeks: 4 },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6">
      <p className="text-xs font-semibold tracking-widest uppercase text-[#8e8e93] mb-4">
        Вариант В · Название + компактная строка снизу
      </p>
      <div className="w-full max-w-sm space-y-2">
        {blocks.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border px-3 pt-2 pb-1.5"
            style={{ background: `${COLOR}10`, borderColor: BORDER }}
          >
            {/* Строка 1: номер + название */}
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="text-[10px] font-bold tabular-nums shrink-0"
                style={{ color: `${COLOR}99` }}
              >
                #{b.id}
              </span>
              <span
                className="text-[13px] font-medium leading-snug break-words"
                style={{ color: COLOR }}
              >
                {b.label}
              </span>
            </div>

            {/* Строка 2: цвет · недели · сброс · удалить */}
            <div className="flex items-center gap-2">
              {/* Цветовой кружок */}
              <button
                style={{
                  width: 10, height: 10, borderRadius: 999,
                  background: COLOR,
                  boxShadow: "0 0 0 1.5px rgba(255,255,255,0.9), 0 0 0 2.5px rgba(0,0,0,0.22)",
                  border: "none", cursor: "pointer", flexShrink: 0,
                }}
              />

              {/* Stepper недель */}
              <div
                className="flex items-center gap-0.5"
                style={{
                  background: "rgba(120,120,128,0.15)",
                  border: "1px solid rgba(120,120,128,0.3)",
                  borderRadius: 6, padding: "1px 3px",
                }}
              >
                <button className="w-4 h-4 text-[12px] text-[#8e8e93] rounded leading-none">−</button>
                <span className="text-[11px] font-semibold tabular-nums w-6 text-center" style={{ color: COLOR }}>
                  {b.weeks}w
                </span>
                <button className="w-4 h-4 text-[12px] text-[#8e8e93] rounded leading-none">+</button>
              </div>

              {/* Действия справа */}
              <div className="flex gap-0.5 ml-auto">
                <button className="w-5 h-5 flex items-center justify-center rounded text-[#ff3b30] opacity-70 hover:opacity-100">
                  <RotateCcw size={10} />
                </button>
                <button className="w-5 h-5 flex items-center justify-center rounded text-[#ff3b30] opacity-70 hover:opacity-100">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#8e8e93] mt-5 text-center">
        ✓ Похоже на текущий, но чище<br/>
        ✓ Название на всю ширину · Всё компактно
      </p>
    </div>
  );
}
