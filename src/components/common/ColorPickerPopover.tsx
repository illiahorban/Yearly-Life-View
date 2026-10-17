import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { motion } from "framer-motion";
import { ColorSwatchGrid } from "./ColorSwatchGrid";
import { APPLE_COLORS } from "../../constants/colors";
import { useIsMobile } from "../../hooks/use-mobile";
import { haptics } from "../../utils/haptics";
import { blockGhostEvents } from "../../lib/utils";

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
  const isMobile = useIsMobile();
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUpwards: boolean;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement | null>(null);

  const calculateCoords = useCallback(() => {
    const el = anchorEl;
    if (!el) return null;

    if (!document.body.contains(el)) {
      return null;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }

    // If anchor is scrolled completely outside its scrollable parent, hide popover
    const scrollParent = el.closest("[data-modal-scroll='true']");
    if (scrollParent) {
      const spRect = scrollParent.getBoundingClientRect();
      if (rect.bottom < spRect.top || rect.top > spRect.bottom) {
        return null;
      }
    }

    const vv = window.visualViewport;
    const vvHeight = vv ? vv.height : window.innerHeight;
    const vvWidth = vv ? vv.width : window.innerWidth;

    const popoverWidth = width;
    const popoverHeight =
      popoverRef.current?.offsetHeight && popoverRef.current.offsetHeight > 0
        ? popoverRef.current.offsetHeight
        : (onClear ? 88 : 64);
    const gap = 6;
    const margin = 8;

    // Horizontal positioning: align right edge with anchor right edge if in right half of screen,
    // otherwise align left edge with anchor left edge
    let left = rect.right - popoverWidth;
    if (rect.left + rect.width / 2 < vvWidth / 2) {
      left = rect.left;
    }
    // Clamp within visible viewport margins
    left = Math.min(
      Math.max(margin, left),
      vvWidth - popoverWidth - margin,
    );

    // Vertical positioning: choose side with sufficient space, defaulting below
    const spaceBelow = vvHeight - (rect.bottom + gap + margin);
    const spaceAbove = rect.top - gap - margin;
    let top: number;
    let openUpwards = false;

    if (spaceBelow >= popoverHeight) {
      openUpwards = false;
      top = rect.bottom + gap;
    } else if (spaceAbove >= popoverHeight) {
      openUpwards = true;
      top = rect.top - popoverHeight - gap;
    } else if (spaceAbove > spaceBelow) {
      openUpwards = true;
      top = Math.max(margin, rect.top - popoverHeight - gap);
    } else {
      openUpwards = false;
      top = Math.min(vvHeight - popoverHeight - margin, rect.bottom + gap);
    }

    return {
      top: Math.round(top),
      left: Math.round(left),
      openUpwards,
    };
  }, [anchorEl, width, onClear]);

  const updatePosition = useCallback(() => {
    const next = calculateCoords();
    if (!next) {
      setCoords(null);
      return;
    }
    setCoords((prev) => {
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.openUpwards === next.openUpwards
      ) {
        return prev;
      }
      return next;
    });
  }, [calculateCoords]);

  // Synchronously compute initial coordinates when opening
  useLayoutEffect(() => {
    if (!isOpen || !anchorEl) {
      setCoords(null);
      return;
    }
    const initial = calculateCoords();
    if (initial) {
      setCoords(initial);
    }
    // Re-verify on next animation frame in case container shifts during mount
    const rafId = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, anchorEl, calculateCoords, updatePosition]);

  useEffect(() => {
    if (!isOpen || !anchorEl) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

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

  // Outside click listener: cleanly dismisses popover on outside pointerdown without ghost clicks
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent | MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      // Inside popover: do not dismiss
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }

      // On anchor element itself: let anchor button toggle it
      if (anchorEl && (anchorEl === target || anchorEl.contains(target))) {
        return;
      }

      // Clicked anywhere else: dismiss popover immediately
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isOpen, anchorEl, onClose]);

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

  if (typeof document === "undefined" || !isOpen || !coords) return null;

  const defaultColors =
    colors ??
    APPLE_COLORS.map((ac) => ({
      key: ac.key,
      hex: dark ? ac.dark : ac.light,
      label: ac.label,
    }));

  return ReactDOM.createPortal(
    <motion.div
      ref={popoverRef}
      data-color-picker-popover="true"
      initial={{
        opacity: 0,
        scale: 0.94,
        y: coords.openUpwards ? 4 : -4,
      }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        zIndex: 99999,
        pointerEvents: "auto",
        background:
          modalBg ||
          (dark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)"),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 12,
        padding: 8,
        boxShadow: "none",
        border: "1px solid var(--border-soft)",
        width,
        isolation: "isolate",
      }}
    >
      <ColorSwatchGrid
        colors={defaultColors}
        selected={selected}
        onSelect={(hex, key) => {
          haptics.selection();
          blockGhostEvents(400);
          onSelect(hex, key);
        }}
        onClear={
          onClear
            ? () => {
                haptics.selection();
                blockGhostEvents(400);
                onClear();
              }
            : undefined
        }
        clearLabel={clearLabel}
        dark={dark}
      />
    </motion.div>,
    document.body,
  );
}
