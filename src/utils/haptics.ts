/**
 * Apple-grade Taptic Engine & Haptic Feedback simulation
 * utilizing the Web Vibration API with iOS/macOS vibration patterns.
 */

const STORAGE_KEY = "yearly_life_view_haptics_enabled";

export const getHapticsEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
};

export const setHapticsEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage errors
  }
};

export const isHapticsSupported = (): boolean =>
  typeof window !== "undefined" &&
  ((typeof navigator !== "undefined" && typeof navigator.vibrate === "function") ||
    ("HTMLInputElement" in window && "switch" in HTMLInputElement.prototype));

let iosSwitchLabel: HTMLLabelElement | null = null;
let iosSwitchInput: HTMLInputElement | null = null;

const triggerIosHaptic = (): void => {
  if (typeof document === "undefined") return;
  try {
    if (!iosSwitchLabel) {
      iosSwitchLabel = document.createElement("label");
      iosSwitchLabel.setAttribute("aria-hidden", "true");
      iosSwitchLabel.style.cssText =
        "position:fixed;opacity:0;pointer-events:none;width:0;height:0;top:-100px;left:-100px;z-index:-9999;";
      iosSwitchInput = document.createElement("input");
      iosSwitchInput.type = "checkbox";
      iosSwitchInput.setAttribute("switch", "");
      iosSwitchInput.style.cssText =
        "position:fixed;opacity:0;pointer-events:none;width:0;height:0;top:-100px;left:-100px;";
      iosSwitchLabel.appendChild(iosSwitchInput);
      document.body.appendChild(iosSwitchLabel);
    }
    if (iosSwitchLabel && iosSwitchInput) {
      iosSwitchInput.checked = !iosSwitchInput.checked;
      iosSwitchLabel.click();
    }
  } catch {
    // Silently ignore
  }
};

const triggerVibrate = (pattern: number | number[]): void => {
  if (!getHapticsEnabled()) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    } else {
      // iOS WebKit fallback (Safari 17.4+)
      triggerIosHaptic();
    }
  } catch {
    // Silently ignore if vibrations are blocked by browser policy
  }
};

export const haptics = {
  /**
   * UISelectionFeedbackGenerator
   * Ultra-crisp subtle tick for selecting items, swatches, tabs, or sliders.
   */
  selection: () => {
    triggerVibrate(6);
  },

  /**
   * UIImpactFeedbackGenerator - Light
   * Crisp feedback for button taps, day tile taps, opening menus.
   */
  impactLight: () => {
    triggerVibrate(10);
  },

  /**
   * UIImpactFeedbackGenerator - Medium
   * Defined feedback for toggling checkboxes, switches, reorder drop.
   */
  impactMedium: () => {
    triggerVibrate(16);
  },

  /**
   * UIImpactFeedbackGenerator - Heavy
   * Solid feedback for drag start, long press, key actions.
   */
  impactHeavy: () => {
    triggerVibrate(26);
  },

  /**
   * UINotificationFeedbackGenerator - Success
   * Double-pulse pattern for goal completion, saved changes, sync.
   */
  notificationSuccess: () => {
    triggerVibrate([10, 35, 15]);
  },

  /**
   * UINotificationFeedbackGenerator - Warning
   * Warning alert pattern.
   */
  notificationWarning: () => {
    triggerVibrate([15, 45, 15]);
  },

  /**
   * UINotificationFeedbackGenerator - Error
   * Distinct multi-pulse pattern for deletion, destructive reset.
   */
  notificationError: () => {
    triggerVibrate([20, 40, 20]);
  },
};
