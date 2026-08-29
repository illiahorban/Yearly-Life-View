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

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const vv = window.visualViewport;
      if (vv) {
        const height = vv.height;
        const width = vv.width;
        const offsetTop = vv.offsetTop;
        const isKeyboardOpen = window.innerHeight - height > 140;
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
      } else {
        const height = window.innerHeight;
        const width = window.innerWidth;
        setViewport((prev) => {
          if (
            prev.height === height &&
            prev.width === width &&
            prev.offsetTop === 0 &&
            !prev.isKeyboardOpen
          ) {
            return prev;
          }
          return { height, width, offsetTop: 0, isKeyboardOpen: false };
        });
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    update();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return viewport;
}
