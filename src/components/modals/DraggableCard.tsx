import React, { useRef, useState, useEffect } from "react";
import { useDragControls, Reorder } from "framer-motion";
import { LangContext } from "../../constants/i18n";

const NOTE_LONG_PRESS_MS = 350;
const NOTE_LONG_PRESS_MOVE_TOLERANCE = 8;

export function DraggableCard({
  id,
  dark,
  children,
}: {
  key?: React.Key;
  id: string;
  dark: boolean;
  children: React.ReactNode;
}) {
  const { t } = React.useContext(LangContext);
  const dragControls = useDragControls();
  const holdTimer = useRef<number | null>(null);
  const holdStartPos = useRef<{ x: number; y: number } | null>(null);
  const [handleHover, setHandleHover] = useState(false);
  // Cleanup long-press timer on unmount
  useEffect(
    () => () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current);
        holdTimer.current = null;
        document.body.style.userSelect = "";
        (document.body.style as any).webkitUserSelect = "";
      }
    },
    [],
  );
  const clearHoldTimer = () => {
    const wasHolding = holdTimer.current !== null;
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdStartPos.current = null;
    // If the hold was cancelled before drag started, restore selection.
    // If drag already started (timer fired, holdTimer = null), onDragEnd handles cleanup.
    if (wasHolding) {
      document.body.style.userSelect = "";
      (document.body.style as any).webkitUserSelect = "";
    }
  };
  const startDragFromHandle = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      holdStartPos.current = { x: e.clientX, y: e.clientY };
      // Suppress text selection immediately so moving the finger during the
      // hold period doesn't select text on sibling nodes.
      document.body.style.userSelect = "none";
      (document.body.style as any).webkitUserSelect = "none";
      holdTimer.current = window.setTimeout(() => {
        dragControls.start(e);
      }, NOTE_LONG_PRESS_MS);
    } else {
      dragControls.start(e);
    }
  };
  const cancelHoldOnMove = (e: React.PointerEvent) => {
    if (holdTimer.current === null || !holdStartPos.current) return;
    const dx = Math.abs(e.clientX - holdStartPos.current.x);
    const dy = Math.abs(e.clientY - holdStartPos.current.y);
    if (
      dx > NOTE_LONG_PRESS_MOVE_TOLERANCE ||
      dy > NOTE_LONG_PRESS_MOVE_TOLERANCE
    )
      clearHoldTimer();
  };
  return (
    <Reorder.Item
      value={id}
      as="div"
      data-draggable-card="true"
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, height: 0, scale: 0.98 }}
      animate={{
        opacity: 1,
        height: "auto",
        scale: 1,
        transitionEnd: { overflow: "visible" },
      }}
      exit={{
        opacity: 0,
        height: 0,
        scale: 0.98,
        overflow: "hidden",
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
        zIndex: 50,
      }}
      style={{ overflow: "hidden", listStyle: "none" }}
      // Dragging the handle moves the pointer across sibling textareas/inputs
      // while the mouse button is held — the browser's default is to treat
      // that as a text selection. Suspend selection app-wide for the drag.
      onDragStart={() => {
        document.body.style.userSelect = "none";
        document.body.style.webkitUserSelect = "none" as any;
      }}
      onDragEnd={() => {
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "" as any;
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          gap: 2,
        }}
      >
        <div
          onPointerDown={startDragFromHandle}
          onPointerMove={cancelHoldOnMove}
          onPointerUp={clearHoldTimer}
          onPointerCancel={clearHoldTimer}
          onPointerLeave={clearHoldTimer}
          onMouseEnter={() => setHandleHover(true)}
          onMouseLeave={() => setHandleHover(false)}
          title={t("dragNote")}
          aria-label={t("dragNote")}
          style={{
            width: 16,
            flexShrink: 0,
            borderRadius: 8,
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
            background: handleHover
              ? dark
                ? "rgba(255,255,255,0.07)"
                : "rgba(0,0,0,0.045)"
              : "transparent",
            transition: "background 150ms",
          }}
        >
          <svg
            width="8"
            height="16"
            viewBox="0 0 8 16"
            fill={dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.32)"}
          >
            <circle cx="2" cy="2" r="1.3" />
            <circle cx="6" cy="2" r="1.3" />
            <circle cx="2" cy="8" r="1.3" />
            <circle cx="6" cy="8" r="1.3" />
            <circle cx="2" cy="14" r="1.3" />
            <circle cx="6" cy="14" r="1.3" />
          </svg>
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </div>
    </Reorder.Item>
  );
}
