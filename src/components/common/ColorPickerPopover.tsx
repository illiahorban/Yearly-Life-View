import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ColorSwatchGrid } from "./ColorSwatchGrid";
import { APPLE_COLORS } from "../../constants/colors";

export interface ColorPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  dark: boolean;
  modalBg?: string;
  selected?: string | null;
  onSelect: (hex: string, key: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  colors?: readonly { key: string; hex: string; label: string }[];
  width?: number;
}

export function ColorPickerPopover({
  isOpen,
  onClose,
  anchorEl,
  dark,
  modalBg,
  selected,
  onSelect,
  onClear,
  clearLabel,
  colors,
  width = 136,
}: ColorPickerPopoverProps) {
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUpwards: boolean;
  } | null>(null);

  const anchorRef = useRef<HTMLElement | null>(anchorEl);
  anchorRef.current = anchorEl;

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // Anchor unmounted or invisible
    if (rect.width === 0 && rect.height === 0) {
      onClose();
      return;
    }

    const vv = window.visualViewport;
    const vvHeight = vv ? vv.height : window.innerHeight;
    const vvOffsetTop = vv ? vv.offsetTop : 0;
    const vvWidth = vv ? vv.width : window.innerWidth;
    const vvOffsetLeft = vv ? vv.offsetLeft : 0;

    // Anchor scrolled completely off-screen
    const viewBottom = vvOffsetTop + vvHeight;
    if (rect.bottom < vvOffsetTop || rect.top > viewBottom) {
      onClose();
      return;
    }

    const popoverWidth = width;
    const popoverHeight = 138;
    const gap = 6;
    const margin = 8;

    // Horizontal positioning: align right if in right half of visual viewport, else left
    let left = rect.right - popoverWidth;
    if (rect.left + rect.width / 2 < vvOffsetLeft + vvWidth / 2) {
      left = rect.left;
    }
    // Clamp to visual viewport edges
    left = Math.min(
      Math.max(vvOffsetLeft + margin, left),
      vvOffsetLeft + vvWidth - popoverWidth - margin,
    );

    // Vertical positioning: decide whether to open below or above
    const spaceBelow = viewBottom - (rect.bottom + gap);
    const spaceAbove = rect.top - gap - vvOffsetTop;
    let top: number;
    let openUpwards = false;

    if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom + gap;
      top = Math.min(top, viewBottom - popoverHeight - margin);
      top = Math.max(vvOffsetTop + margin, top);
    } else {
      openUpwards = true;
      top = rect.top - popoverHeight - gap;
      top = Math.max(vvOffsetTop + margin, top);
    }

    setCoords({ top, left, openUpwards });
  }, [width, onClose]);

  useEffect(() => {
    if (!isOpen || !anchorEl) {
      setCoords(null);
      return;
    }

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    // Capture true catches scroll inside any modal dialog or scrollable element
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.visualViewport?.addEventListener("resize", handleScrollOrResize);
    window.visualViewport?.addEventListener("scroll", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.visualViewport?.removeEventListener("resize", handleScrollOrResize);
      window.visualViewport?.removeEventListener("scroll", handleScrollOrResize);
    };
  }, [isOpen, anchorEl, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  const defaultColors =
    colors ??
    APPLE_COLORS.map((ac) => ({
      key: ac.key,
      hex: dark ? ac.dark : ac.light,
      label: ac.label,
    }));

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && coords && (
        <div key="color-picker-portal-root" data-color-picker-portal="true">
          {/* Fullscreen transparent backdrop for dismiss on outside click */}
          <div
            data-color-picker-backdrop="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99998,
              cursor: "default",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />

          {/* Floating popover menu */}
          <motion.div
            data-color-picker-popover="true"
            initial={{
              opacity: 0,
              scale: 0.94,
              y: coords.openUpwards ? 4 : -4,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: coords.openUpwards ? 4 : -4,
            }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              zIndex: 99999,
              background:
                modalBg ||
                (dark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)"),
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 12,
              padding: 8,
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.28), inset 0 0 0 1px var(--border-soft)",
              border: "1px solid var(--border-soft)",
              width,
              isolation: "isolate",
            }}
          >
            <ColorSwatchGrid
              colors={defaultColors}
              selected={selected}
              onSelect={(hex, key) => {
                onSelect(hex, key);
                onClose();
              }}
              onClear={
                onClear
                  ? () => {
                      onClear();
                      onClose();
                    }
                  : undefined
              }
              clearLabel={clearLabel}
              dark={dark}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
