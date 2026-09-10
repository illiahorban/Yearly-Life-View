import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { DownloadIcon, XCloseIcon } from "../icons/Icons";

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  dark: boolean;
  lang?: "en" | "ru";
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  dark,
  lang = "ru",
}) => {
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  const isRu = lang === "ru";

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
      onClose();
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.62)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-sm rounded-2xl p-5 shadow-2xl relative"
            style={{
              backgroundColor: dark ? "#1c1c1e" : "#ffffff",
              border: dark
                ? "1px solid rgba(255, 255, 255, 0.12)"
                : "1px solid rgba(0, 0, 0, 0.08)",
              color: dark ? "#f4f4f5" : "#18181b",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: "#34c759" }}
                >
                  <DownloadIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold">
                  {isRu ? "Установка приложения" : "Install Application"}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                title={isRu ? "Закрыть" : "Close"}
              >
                <XCloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Content based on context */}
            <div className="mt-4 space-y-3 text-xs leading-relaxed opacity-95">
              {isInIframe ? (
                <>
                  <p>
                    {isRu
                      ? "Приложение открыто во встроенном фрейме предпросмотра. Браузеры блокируют установку PWA внутри фреймов. Чтобы установить приложение на рабочий стол или экран телефона, откройте его в отдельной вкладке:"
                      : "The app is running inside a preview frame. Browsers block PWA installation inside iframes. To install it on your home screen or desktop, open it in a new tab:"}
                  </p>
                  <button
                    type="button"
                    onClick={openInNewTab}
                    className="w-full py-2.5 px-3 text-xs font-semibold rounded-xl text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-sm"
                    style={{ backgroundColor: "#34c759" }}
                  >
                    <span>{isRu ? "Открыть в новой вкладке" : "Open in New Tab"}</span>
                    <span className="text-sm">↗</span>
                  </button>
                </>
              ) : isInstallable ? (
                <>
                  <p>
                    {isRu
                      ? "Браузер готов установить Yearly Life View на ваше устройство как отдельное приложение (без адресной строки браузера):"
                      : "The browser is ready to install Yearly Life View on your device as a standalone application:"}
                  </p>
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="w-full py-2.5 px-3 text-xs font-semibold rounded-xl text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-sm"
                    style={{ backgroundColor: "#34c759" }}
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>{isRu ? "Установить на устройство" : "Install to Device"}</span>
                  </button>
                </>
              ) : isIOS ? (
                <>
                  <p className="font-medium text-zinc-500 dark:text-zinc-400">
                    {isRu
                      ? "Инструкция для iPhone и iPad в Safari:"
                      : "Instructions for iPhone and iPad in Safari:"}
                  </p>
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: "#34c759" }}
                      >
                        1
                      </span>
                      <span>
                        {isRu ? (
                          <>Нажмите кнопку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх) в нижней панели Safari.</>
                        ) : (
                          <>Tap the <strong>Share</strong> button in Safari's bottom toolbar.</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: "#34c759" }}
                      >
                        2
                      </span>
                      <span>
                        {isRu ? (
                          <>Прокрутите список действий вниз и выберите <strong>«На экран "Домой"»</strong>.</>
                        ) : (
                          <>Scroll down and tap <strong>«Add to Home Screen»</strong>.</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: "#34c759" }}
                      >
                        3
                      </span>
                      <span>
                        {isRu ? (
                          <>Нажмите <strong>«Добавить»</strong> в правом верхнем углу.</>
                        ) : (
                          <>Tap <strong>«Add»</strong> in the top right corner.</>
                        )}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    {isRu
                      ? "Вы можете установить Yearly Life View как отдельное настольное приложение:"
                      : "You can install Yearly Life View as a standalone desktop app:"}
                  </p>
                  <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 space-y-2 text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-emerald-500">•</span>
                      <span>
                        {isRu ? (
                          <>В <strong>Chrome / Edge</strong>: нажмите на значок установки (компьютер со стрелочкой) в правой части адресной строки.</>
                        ) : (
                          <>In <strong>Chrome / Edge</strong>: click the install icon on the right side of the address bar.</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-emerald-500">•</span>
                      <span>
                        {isRu ? (
                          <>Либо в меню браузера (три точки <strong>⋮</strong>) выберите <strong>«Установить Yearly Life View»</strong>.</>
                        ) : (
                          <>Or open browser menu (three dots <strong>⋮</strong>) and click <strong>«Install Yearly Life View»</strong>.</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-emerald-500">•</span>
                      <span>
                        {isRu ? (
                          <>В <strong>Safari на macOS</strong>: выберите в верхнем меню «Файл» → «Добавить в Dock...».</>
                        ) : (
                          <>In <strong>Safari macOS</strong>: choose «File» → «Add to Dock...».</>
                        )}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full py-2 text-xs font-semibold rounded-xl text-white transition-opacity hover:opacity-90 active:scale-[0.98] cursor-pointer"
              style={{ backgroundColor: "#34c759" }}
            >
              {isRu ? "Понятно" : "Got it"}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
