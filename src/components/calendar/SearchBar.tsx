import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SearchIcon } from "../icons/Icons";
import { dateKey } from "../../utils/date-utils";
import { MONTHS_I18N, type I18nKey } from "../../constants/i18n";

interface SearchBarProps {
  searchBarRef: React.RefObject<HTMLDivElement>;
  isMobile: boolean;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  parsedJumpDate: Date | null;
  matchedDatesArray: string[];
  searchIndex: number;
  navigateMatch: (dir: 1 | -1) => void;
  scrollToDateKey: (key: string) => void;
  dark: boolean;
  lang: "en" | "ru";
  t: (k: I18nKey) => string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchBarRef,
  isMobile,
  searchOpen,
  setSearchOpen,
  searchQuery,
  setSearchQuery,
  parsedJumpDate,
  matchedDatesArray,
  searchIndex,
  navigateMatch,
  scrollToDateKey,
  dark,
  lang,
  t,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (searchOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 160);
      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  return (
    <div
      ref={searchBarRef}
      className="w-full min-w-0"
      style={{ position: "relative" }}
    >
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            key="search-bar"
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: isMobile ? 8 : 10 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{
              height: { type: "spring", stiffness: 420, damping: 36 },
              marginTop: { type: "spring", stiffness: 420, damping: 36 },
              opacity: { duration: 0.18, ease: "easeInOut" },
            }}
            className="w-full transform-gpu will-change-transform"
            style={{
              overflow: "hidden",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div className="relative flex items-center">
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  color: "var(--text-tertiary)",
                  pointerEvents: "none",
                  display: "flex",
                }}
              >
                <SearchIcon />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }
                  if (e.key === "Enter") {
                    if (parsedJumpDate) {
                      scrollToDateKey(dateKey(parsedJumpDate));
                    } else {
                      e.shiftKey ? navigateMatch(-1) : navigateMatch(1);
                    }
                  }
                }}
                placeholder={t("searchPlaceholder")}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  paddingLeft: 34,
                  paddingRight:
                    matchedDatesArray.length > 0
                      ? 112
                      : parsedJumpDate
                        ? 180
                        : 34,
                  paddingTop: 8,
                  paddingBottom: 8,
                  ...(isMobile
                    ? {
                        height: 42,
                        paddingTop: 9,
                        paddingBottom: 9,
                        lineHeight: "22px",
                      }
                    : {}),
                  borderRadius: 10,
                  background: dark
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(0,0,0,0.05)",
                  border: "1px solid var(--border-soft)",
                  color: "var(--text)",
                  fontSize: isMobile ? 16 : 13,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              {searchQuery.trim() && (
                <div
                  style={{
                    position: "absolute",
                    right: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {matchedDatesArray.length > 0 ? (
                    <>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {searchIndex + 1} {t("of")}{" "}
                        {matchedDatesArray.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateMatch(-1)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          padding: 0,
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateMatch(1)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          padding: 0,
                        }}
                      >
                        ↓
                      </button>
                    </>
                  ) : parsedJumpDate ? (
                    <button
                      type="button"
                      onClick={() =>
                        scrollToDateKey(dateKey(parsedJumpDate))
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingTop: 3,
                        paddingBottom: 3,
                        borderRadius: 7,
                        background: dark
                          ? "rgba(52,199,89,0.15)"
                          : "rgba(52,199,89,0.12)",
                        border: "1px solid rgba(52,199,89,0.35)",
                        cursor: "pointer",
                        color: "#34c759",
                        fontSize: 11,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 12 }}>↵</span>
                      {t("jumpTo")} {parsedJumpDate.getDate()}{" "}
                      {MONTHS_I18N[lang][parsedJumpDate.getMonth()]}{" "}
                      {parsedJumpDate.getFullYear()}
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t("searchNoResults")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
