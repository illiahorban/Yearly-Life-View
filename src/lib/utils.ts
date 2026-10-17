import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let ghostBlockEndTime = 0;

export function blockGhostEvents(durationMs = 400) {
  if (typeof window === "undefined") return;
  ghostBlockEndTime = Math.max(ghostBlockEndTime, Date.now() + durationMs);

  const stopEvent = (e: Event) => {
    if (Date.now() < ghostBlockEndTime) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  const options = { capture: true, passive: false };
  window.addEventListener("click", stopEvent, options);
  window.addEventListener("mousedown", stopEvent, options);
  window.addEventListener("mouseup", stopEvent, options);
  window.addEventListener("pointerdown", stopEvent, options);
  window.addEventListener("pointerup", stopEvent, options);
  window.addEventListener("touchend", stopEvent, options);

  setTimeout(() => {
    window.removeEventListener("click", stopEvent, options);
    window.removeEventListener("mousedown", stopEvent, options);
    window.removeEventListener("mouseup", stopEvent, options);
    window.removeEventListener("pointerdown", stopEvent, options);
    window.removeEventListener("pointerup", stopEvent, options);
    window.removeEventListener("touchend", stopEvent, options);
  }, durationMs + 50);
}

export function isGhostBlocked(): boolean {
  return Date.now() < ghostBlockEndTime;
}
