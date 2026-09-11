import * as React from "react";

export interface VisualViewportState {
  height: number;
  width: number;
  offsetTop: number;
  isKeyboardOpen: boolean;
}

export function useVisualViewport(): VisualViewportState {
  const [viewport, setViewport] = React.useState<VisualViewportState>(() => {
    if (typeof window === "undefined") {
      return { height: 800, width: 400, offsetTop: 0, isKeyboardOpen: false };
    }
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const width = vv ? vv.width : window.innerWidth;
    const offsetTop = vv ? vv.offsetTop : 0;
    const isKeyboardOpen =
      typeof window !== "undefined" && window.innerHeight - height > 140;
    return { height, width, offsetTop, isKeyboardOpen };
  });

  const maxHeightRef = React.useRef<number>(
    typeof window !== "undefined"
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 800,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const isEditableFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (el as HTMLElement).isContentEditable
      );
    };

    const update = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const width = vv ? vv.width : window.innerWidth;
      const offsetTop = vv ? vv.offsetTop : 0;

      // Update baseline height when no input is focused
      if (!isEditableFocused()) {
        maxHeightRef.current = Math.max(maxHeightRef.current, height);
      }

      // Detect keyboard on both iOS (layout vs visual viewport difference)
      // and Android (shrinking visual viewport while an editable element is focused)
      const iosKeyboard = window.innerHeight - height > 140;
      const androidKeyboard =
        isEditableFocused() && maxHeightRef.current - height > 140;
      const isKeyboardOpen = iosKeyboard || androidKeyboard;

      setViewport((prev) => {
        if (
          Math.abs(prev.height - height) < 1 &&
          Math.abs(prev.width - width) < 1 &&
          Math.abs(prev.offsetTop - offsetTop) < 1 &&
          prev.isKeyboardOpen === isKeyboardOpen
        ) {
          return prev;
        }
        return { height, width, offsetTop, isKeyboardOpen };
      });
    };

    const handleOrientationChange = () => {
      setTimeout(() => {
        const vv = window.visualViewport;
        maxHeightRef.current = vv ? vv.height : window.innerHeight;
        update();
      }, 100);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("focusin", update);
    const handleFocusOut = () => {
      setTimeout(update, 100);
    };
    window.addEventListener("focusout", handleFocusOut);

    update();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("focusin", update);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return viewport;
}
