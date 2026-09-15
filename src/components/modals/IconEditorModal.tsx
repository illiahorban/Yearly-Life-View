import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVisualViewport } from "../../hooks/use-visual-viewport";
import { Sliders, Copy, Check, Download, RefreshCw, X, Smartphone, Monitor, Globe } from "lucide-react";

export interface IconConfig {
  squareSize: number; // base on 180px canvas (e.g. 30 - 50)
  gap: number;        // base on 180px canvas (e.g. 4 - 18)
  radius: number;     // corner radius of squares (e.g. 0 - 20)
  iconRadius: number; // outer squircle radius (e.g. 20 - 55)
}

const DEFAULT_IPHONE: IconConfig = {
  squareSize: 40,
  gap: 10,
  radius: 10,
  iconRadius: 40,
};

const DEFAULT_DESKTOP: IconConfig = {
  squareSize: 36,
  gap: 10.5,
  radius: 9,
  iconRadius: 40,
};

interface IconEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dark: boolean;
  lang?: "en" | "ru";
}

export const IconEditorModal: React.FC<IconEditorModalProps> = ({
  isOpen,
  onClose,
  dark,
  lang = "ru",
}) => {
  const { height: vvHeight, offsetTop: vvOffsetTop } = useVisualViewport();
  const [splitMode, setSplitMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"iphone" | "desktop">("iphone");

  // Configs
  const [iphoneConfig, setIphoneConfig] = useState<IconConfig>(() => {
    try {
      const saved = localStorage.getItem("yearly_icon_iphone");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_IPHONE;
  });

  const [desktopConfig, setDesktopConfig] = useState<IconConfig>(() => {
    try {
      const saved = localStorage.getItem("yearly_icon_desktop");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_DESKTOP;
  });

  const [copied, setCopied] = useState<boolean>(false);
  const [appliedLive, setAppliedLive] = useState<boolean>(false);

  // Sync when not split
  const currentConfig = splitMode
    ? activeTab === "iphone"
      ? iphoneConfig
      : desktopConfig
    : iphoneConfig;

  const updateCurrentConfig = (field: keyof IconConfig, value: number) => {
    if (!splitMode) {
      setIphoneConfig((prev) => ({ ...prev, [field]: value }));
      setDesktopConfig((prev) => ({ ...prev, [field]: value }));
    } else {
      if (activeTab === "iphone") {
        setIphoneConfig((prev) => ({ ...prev, [field]: value }));
      } else {
        setDesktopConfig((prev) => ({ ...prev, [field]: value }));
      }
    }
  };

  // Helper to generate SVG string for a given config and canvas size
  const getSvgString = (cfg: IconConfig, canvasSize: number) => {
    const scale = canvasSize / 180;
    const sqSize = cfg.squareSize * scale;
    const gap = cfg.gap * scale;
    const radius = cfg.radius * scale;
    const iconR = cfg.iconRadius * scale;
    const totalGrid = 3 * sqSize + 2 * gap;
    const margin = (canvasSize - totalGrid) / 2;

    const coords = [
      margin,
      margin + sqSize + gap,
      margin + (sqSize + gap) * 2,
    ];

    let rects = "";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        rects += `<rect x="${coords[c].toFixed(2)}" y="${coords[r].toFixed(2)}" width="${sqSize.toFixed(2)}" height="${sqSize.toFixed(2)}" rx="${radius.toFixed(2)}" fill="#34C759"/>`;
      }
    }

    return `<svg width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${canvasSize}" height="${canvasSize}" rx="${iconR.toFixed(2)}" fill="#09090b"/>
  ${rects}
</svg>`;
  };

  // Live apply to current tab
  const handleApplyLive = () => {
    const svg = getSvgString(iphoneConfig, 180);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    // update favicons
    const linkIcon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (linkIcon) linkIcon.href = url;
    const linkApple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (linkApple) linkApple.href = url;

    try {
      localStorage.setItem("yearly_icon_iphone", JSON.stringify(iphoneConfig));
      localStorage.setItem("yearly_icon_desktop", JSON.stringify(desktopConfig));
    } catch {}

    setAppliedLive(true);
    setTimeout(() => setAppliedLive(false), 2500);
  };

  // Copy parameters for the agent
  const handleCopyParams = () => {
    const data = {
      mode: splitMode ? "split" : "unified",
      iphone: {
        squareSize: Number(iphoneConfig.squareSize.toFixed(1)),
        gap: Number(iphoneConfig.gap.toFixed(1)),
        radius: Number(iphoneConfig.radius.toFixed(1)),
        iconRadius: Number(iphoneConfig.iconRadius.toFixed(1)),
        gridOccupancy: `${(((3 * iphoneConfig.squareSize + 2 * iphoneConfig.gap) / 180) * 100).toFixed(1)}%`,
      },
      desktop: {
        squareSize: Number(desktopConfig.squareSize.toFixed(1)),
        gap: Number(desktopConfig.gap.toFixed(1)),
        radius: Number(desktopConfig.radius.toFixed(1)),
        iconRadius: Number(desktopConfig.iconRadius.toFixed(1)),
        gridOccupancy: `${(((3 * desktopConfig.squareSize + 2 * desktopConfig.gap) / 180) * 100).toFixed(1)}%`,
      },
    };

    const textToCopy = `ПАРАМЕТРЫ ИКОНКИ ДЛЯ ПРИМЕНЕНИЯ:
iPhone: размер квадратика = ${data.iphone.squareSize}px, зазор = ${data.iphone.gap}px, скругление = ${data.iphone.radius}px (заполнение сетки ${data.iphone.gridOccupancy})
Desktop: размер квадратика = ${data.desktop.squareSize}px, зазор = ${data.desktop.gap}px, скругление = ${data.desktop.radius}px (заполнение сетки ${data.desktop.gridOccupancy})

JSON:
${JSON.stringify(data, null, 2)}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Render SVG element inside preview
  const renderIconSvg = (cfg: IconConfig, size: number) => {
    const scale = size / 180;
    const sqSize = cfg.squareSize * scale;
    const gap = cfg.gap * scale;
    const radius = cfg.radius * scale;
    const totalGrid = 3 * sqSize + 2 * gap;
    const margin = (size - totalGrid) / 2;

    const coords = [
      margin,
      margin + sqSize + gap,
      margin + (sqSize + gap) * 2,
    ];

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block", borderRadius: cfg.iconRadius * scale }}
      >
        <rect width={size} height={size} rx={cfg.iconRadius * scale} fill="#09090b" />
        {coords.map((y, row) =>
          coords.map((x, col) => (
            <rect
              key={`${row}-${col}`}
              x={x}
              y={y}
              width={sqSize}
              height={sqSize}
              rx={radius}
              fill="#34C759"
            />
          ))
        )}
      </svg>
    );
  };

  // Presets
  const applyPreset = (preset: "large" | "balanced" | "max" | "compact") => {
    let cfg: IconConfig;
    switch (preset) {
      case "large":
        cfg = { squareSize: 41, gap: 10, radius: 10, iconRadius: 40 };
        break;
      case "balanced":
        cfg = { squareSize: 37, gap: 10.5, radius: 9, iconRadius: 40 };
        break;
      case "max":
        cfg = { squareSize: 45, gap: 8, radius: 11, iconRadius: 40 };
        break;
      case "compact":
        cfg = { squareSize: 33, gap: 9, radius: 8, iconRadius: 40 };
        break;
    }
    if (!splitMode) {
      setIphoneConfig(cfg);
      setDesktopConfig(cfg);
    } else if (activeTab === "iphone") {
      setIphoneConfig(cfg);
    } else {
      setDesktopConfig(cfg);
    }
  };

  if (!isOpen) return null;

  const isRu = lang === "ru";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5"
        style={{
          top: `${vvOffsetTop}px`,
          height: `${vvHeight}px`,
          backgroundColor: "rgba(0, 0, 0, 0.72)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          overflowY: "auto",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="w-full max-w-2xl rounded-2xl p-5 shadow-2xl border"
          style={{
            background: dark ? "#18181b" : "#ffffff",
            borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
            color: dark ? "#f4f4f5" : "#18181b",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#34c759]/15 flex items-center justify-center text-[#34c759]">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight">
                  {isRu ? "Настройка размера иконки" : "Icon Size Customizer"}
                </h3>
                <p className="text-xs text-neutral-400">
                  {isRu
                    ? "Настройте размер квадратиков ползунками и скопируйте параметры"
                    : "Adjust square sizes with sliders and copy parameters"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode switch */}
          <div className="flex items-center justify-between mt-4 p-2 rounded-xl bg-neutral-900/60 border border-white/5">
            <div className="flex gap-1.5 text-xs font-medium">
              <button
                onClick={() => setSplitMode(false)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  !splitMode
                    ? "bg-[#34c759] text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {isRu ? "Единый размер везде" : "Unified for all"}
              </button>
              <button
                onClick={() => setSplitMode(true)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  splitMode
                    ? "bg-[#34c759] text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {isRu ? "Раздельно iPhone / Mac" : "Separate iPhone / Mac"}
              </button>
            </div>

            {splitMode && (
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => setActiveTab("iphone")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                    activeTab === "iphone"
                      ? "bg-neutral-800 text-white font-medium border border-white/10"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> iPhone
                </button>
                <button
                  onClick={() => setActiveTab("desktop")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                    activeTab === "desktop"
                      ? "bg-neutral-800 text-white font-medium border border-white/10"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Mac Dock
                </button>
              </div>
            )}
          </div>

          {/* Main preview & controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            {/* Live Previews Column */}
            <div className="flex flex-col gap-3.5">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                {isRu ? "Предпросмотр в реальном времени" : "Real-time Preview"}
              </div>

              {/* iPhone Home Screen Mockup */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-neutral-900 to-black border border-white/10 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden">
                <span className="absolute top-2 left-2.5 text-[10px] uppercase font-bold text-neutral-500 tracking-wider flex items-center gap-1">
                  <Smartphone className="w-3 h-3" /> iPhone Home Screen
                </span>
                <div className="flex flex-col items-center mt-3">
                  <div className="p-1 rounded-[22px] shadow-[0_8px_24px_rgba(0,0,0,0.8)] border border-white/10 bg-black">
                    {renderIconSvg(iphoneConfig, 80)}
                  </div>
                  <span className="text-[11px] font-medium text-white/90 mt-1.5 tracking-tight font-sans">
                    Yearly
                  </span>
                </div>
              </div>

              {/* MacBook Dock Mockup */}
              <div className="p-3.5 rounded-xl bg-gradient-to-b from-neutral-900 to-black border border-white/10 flex flex-col items-center justify-center min-h-[130px] relative overflow-hidden">
                <span className="absolute top-2 left-2.5 text-[10px] uppercase font-bold text-neutral-500 tracking-wider flex items-center gap-1">
                  <Monitor className="w-3 h-3" /> MacBook Dock
                </span>
                {/* Dock shelf simulation */}
                <div className="mt-3 px-6 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex flex-col items-center">
                  <div className="rounded-[18px] shadow-lg border border-white/15 overflow-hidden">
                    {renderIconSvg(desktopConfig, 64)}
                  </div>
                  {/* Dock running app dot indicator */}
                  <div className="w-1 h-1 rounded-full bg-white/80 mt-1" />
                </div>
              </div>

              {/* Browser Tab Preview */}
              <div className="p-3 rounded-xl bg-neutral-900/70 border border-white/10 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Browser Tab
                </span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 border border-white/10 text-xs text-white/90">
                  <div className="rounded-[4px] overflow-hidden">
                    {renderIconSvg(currentConfig, 18)}
                  </div>
                  <span className="truncate max-w-[120px] text-xs">Yearly Life View</span>
                  <X className="w-3 h-3 text-neutral-400" />
                </div>
              </div>
            </div>

            {/* Sliders & Controls Column */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  {isRu
                    ? `Ползунки: ${splitMode ? (activeTab === "iphone" ? "iPhone" : "Mac Dock") : "Все иконки"}`
                    : "Sliders"}
                </span>
                {/* Presets */}
                <div className="flex gap-1">
                  <button
                    onClick={() => applyPreset("balanced")}
                    className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:text-white"
                  >
                    {isRu ? "Стандарт" : "Norm"}
                  </button>
                  <button
                    onClick={() => applyPreset("large")}
                    className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:text-white font-semibold"
                  >
                    {isRu ? "Крупные" : "Large"}
                  </button>
                  <button
                    onClick={() => applyPreset("max")}
                    className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:text-white"
                  >
                    {isRu ? "Макс" : "Max"}
                  </button>
                </div>
              </div>

              {/* Slider 1: Square Size */}
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-white/5 flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-neutral-300">
                    {isRu ? "Размер квадратика" : "Square Size"}
                  </span>
                  <span className="font-mono text-[#34c759] font-semibold">
                    {currentConfig.squareSize} px
                  </span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="48"
                  step="0.5"
                  value={currentConfig.squareSize}
                  onChange={(e) => updateCurrentConfig("squareSize", parseFloat(e.target.value))}
                  className="w-full accent-[#34c759] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>24px (Мелкие)</span>
                  <span>36px (Норма)</span>
                  <span>48px (Крупные)</span>
                </div>
              </div>

              {/* Slider 2: Gap */}
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-white/5 flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-neutral-300">
                    {isRu ? "Зазор между квадратиками" : "Gap between squares"}
                  </span>
                  <span className="font-mono text-[#34c759] font-semibold">
                    {currentConfig.gap} px
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="18"
                  step="0.5"
                  value={currentConfig.gap}
                  onChange={(e) => updateCurrentConfig("gap", parseFloat(e.target.value))}
                  className="w-full accent-[#34c759] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>4px (Вплотную)</span>
                  <span>10px (Баланс)</span>
                  <span>18px (Широкий)</span>
                </div>
              </div>

              {/* Slider 3: Corner Radius */}
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-white/5 flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-neutral-300">
                    {isRu ? "Скругление квадратика" : "Corner Radius"}
                  </span>
                  <span className="font-mono text-[#34c759] font-semibold">
                    {currentConfig.radius} px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="0.5"
                  value={currentConfig.radius}
                  onChange={(e) => updateCurrentConfig("radius", parseFloat(e.target.value))}
                  className="w-full accent-[#34c759] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>0px (Острые)</span>
                  <span>10px (Apple Squircle)</span>
                  <span>16px (Круглые)</span>
                </div>
              </div>

              {/* Slider 4: Outer Squircle Radius */}
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-white/5 flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-neutral-300">
                    {isRu ? "Скругление всей иконки" : "Icon Outer Radius"}
                  </span>
                  <span className="font-mono text-[#34c759] font-semibold">
                    {currentConfig.iconRadius} px
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="55"
                  step="1"
                  value={currentConfig.iconRadius}
                  onChange={(e) => updateCurrentConfig("iconRadius", parseFloat(e.target.value))}
                  className="w-full accent-[#34c759] cursor-pointer"
                />
              </div>

              {/* Mathematical Summary Card */}
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-white/5 text-[11px] text-neutral-400 flex items-center justify-between">
                <span>{isRu ? "Заполнение холста сеткой:" : "Grid occupancy:"}</span>
                <span className="font-mono font-semibold text-white">
                  {(
                    ((3 * currentConfig.squareSize + 2 * currentConfig.gap) / 180) *
                    100
                  ).toFixed(1)}
                  % (отступ:{" "}
                  {(
                    (180 - (3 * currentConfig.squareSize + 2 * currentConfig.gap)) /
                    2
                  ).toFixed(1)}
                  px)
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyLive}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-white/10 transition-colors"
                title={isRu ? "Обновить favicon на этой вкладке прямо сейчас" : "Apply live"}
              >
                {appliedLive ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#34c759]" />
                    <span className="text-[#34c759]">
                      {isRu ? "Применено на вкладке!" : "Applied to tab!"}
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isRu ? "Применить на вкладке" : "Apply to Tab"}</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyParams}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#34c759] hover:bg-[#2fb14f] text-black text-xs font-bold shadow-lg transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isRu ? "Параметры скопированы!" : "Copied!"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{isRu ? "Скопировать параметры для чата" : "Copy Parameters for Chat"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
