import confetti from "canvas-confetti";
import type { AppleColorKey, QuarterMeta, AchromaticStyle, GoalCheckboxStyle, Quarter } from "../types/calendar";

export function fireConfettiCannons() {
  const colors = [
    "#ffd700",
    "#ff6b6b",
    "#51cf66",
    "#74c0fc",
    "#f783ac",
    "#ff922b",
    "#cc5de8",
  ];
  const base = { zIndex: 9999, colors, disableForReducedMotion: true };

  // Two side cannons, angled steeply across the screen so particles travel the full width.
  confetti({
    ...base,
    startVelocity: 65,
    spread: 80,
    ticks: 300,
    gravity: 0.75,
    particleCount: 150,
    origin: { x: -0.05, y: 0.8 },
    angle: 55,
  });
  confetti({
    ...base,
    startVelocity: 65,
    spread: 80,
    ticks: 300,
    gravity: 0.75,
    particleCount: 150,
    origin: { x: 1.05, y: 0.8 },
    angle: 125,
  });
}

export const APPLE_COLORS = [
  { key: "blue", label: "Blue", light: "#007aff", dark: "#0a84ff" },
  { key: "green", label: "Green", light: "#34c759", dark: "#30d158" },
  { key: "indigo", label: "Indigo", light: "#5856d6", dark: "#5e5ce6" },
  { key: "orange", label: "Orange", light: "#ff9500", dark: "#ff9f0a" },
  { key: "pink", label: "Pink", light: "#ff2d55", dark: "#ff375f" },
  { key: "purple", label: "Purple", light: "#af52de", dark: "#bf5af2" },
  { key: "red", label: "Red", light: "#ff3b30", dark: "#ff453a" },
  { key: "teal", label: "Teal", light: "#5ac8fa", dark: "#64d2ff" },
  { key: "yellow", label: "Yellow", light: "#ffcc00", dark: "#ffd60a" },
  { key: "mint", label: "Mint", light: "#00c7be", dark: "#63e6e2" },
  { key: "brown", label: "Brown", light: "#a2845e", dark: "#ac8e68" },
  { key: "black", label: "Black", light: "#121212", dark: "#121212" },
  { key: "grey", label: "Grey", light: "#8e8e93", dark: "#636366" },
  { key: "white", label: "White", light: "#ffffff", dark: "#ffffff" },
] as const;

/** Colour to draw the selection checkmark in so it reads on any swatch —
 *  dark ink on light/bright swatches, white ink on dark/saturated ones. */
export function swatchCheckColor(hex: string): string {
  return luminanceOf(hex) > 0.6 ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.95)";
}

/** Unified 3 × 5 colour swatch grid used by every colour-picker popover.
 *  Pass pre-computed hex values so the component stays display-only. */
export function clampedPopoverPos(
  rect: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  gap = 7,
) {
  const below = rect.bottom + gap;
  const top =
    below + popoverHeight <= window.innerHeight
      ? Math.max(8, below)
      : Math.max(
          8,
          Math.min(
            rect.top - popoverHeight - gap,
            window.innerHeight - popoverHeight - 8,
          ),
        );
  const left = Math.min(
    Math.max(8, rect.left),
    window.innerWidth - popoverWidth - 8,
  );
  return { top, left };
}

export const DEFAULT_QUARTER_META: QuarterMeta[] = [
  { name: "Q1", colorKey: "white" },
  { name: "Q2", colorKey: "white" },
  { name: "Q3", colorKey: "white" },
  { name: "Q4", colorKey: "white" },
];

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ─── Color helpers: RGB <-> HSL and saturation adjust ──────────────────────
export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}
export function hslToRgb(h: number, s: number, l: number) {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
export function saturateRgbaString(rgba: string, factor: number) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!m) return rgba;
  const r = Number(m[1]),
    g = Number(m[2]),
    b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  const { h, s, l } = rgbToHsl(r, g, b);
  const ns = Math.min(1, s * factor);
  const [nr, ng, nb] = hslToRgb(h, ns, l);
  return `rgba(${nr},${ng},${nb},${a})`;
}

export const LIGHT_SAT_FACTOR = 1.2;
export function hexSaturate(hex: string, factor: number) {
  const [r, g, b] = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const ns = Math.min(1, s * factor);
  const [nr, ng, nb] = hslToRgb(h, ns, l);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export function resolveQuarter(meta: QuarterMeta, dark: boolean): Quarter {
  const ac =
    APPLE_COLORS.find((c) => c.key === meta.colorKey) ?? APPLE_COLORS[0]!;
  const rawHex = dark ? ac.dark : ac.light;
  const hex = rawHex;
  const [r, g, b] = hexToRgb(hex);
  const isAchromaticDark =
    meta.colorKey === "black" || meta.colorKey === "grey";
  // Adjust text color for low-contrast hues in light mode. Yellow is exempt: text/icons use
  // the exact same hex as the quarter's border/fill/day-tiles so every yellow element in the
  // UI matches one single shade (no separate darkened variant for legibility).
  const textHex =
    !dark && meta.colorKey === "mint"
      ? "#008a82"
      : !dark && meta.colorKey === "teal"
        ? "#007ea5"
        : meta.colorKey === "white"
          ? dark
            ? "#ebebf5"
            : "#3a3a3c"
          : isAchromaticDark
            ? dark
              ? "#ffffff"
              : "#1c1c1e"
            : hex;
  // Black/Grey in dark mode: fill/text turn white so percent numbers, headers and icons
  // stay legible — the card/day-tile surface itself keeps each colour's true hue (grey
  // stays grey, black stays black), only the content drawn on top gets the contrast boost.
  const fill = isAchromaticDark && dark ? "#ffffff" : hex;
  // tileFill is the colour used as the day-cell background. `fill` is wrong here:
  // black/grey in dark mode get fill="#ffffff" (for text contrast) but a white cell
  // in dark mode shows the wrong colour entirely. White in light mode gets fill="#ffffff"
  // which merges with the page and makes cells invisible. Use the actual hue instead,
  // except white-in-light-mode which needs a visible off-white (#e0e0e5) so cells don't
  // vanish against the white page background.
  const tileFill =
    isAchromaticDark && dark
      ? hex // grey/black in dark: actual dark hue
      : meta.colorKey === "white"
        ? "#e0e0e5" // white in both modes: off-white, visible against any bg without inverting content
        : hex;
  // The sprint/quarter *name* and its "add goal" icon aren't drawn on top of a filled
  // colour surface the way percentages/progress bars are, so they don't need the
  // white/black contrast boost applied to `text` for legibility. For grey specifically,
  // keep them showing the actual grey swatch (a legible mid-tone in both themes) instead
  // of being swapped to white/black like the rest of the achromatic UI.
  const nameColor =
    meta.colorKey === "grey"
      ? dark
        ? "#aeaeb2"
        : "#8e8e93"
      : meta.colorKey === "white"
        ? dark
          ? "#ffffff"
          : "#18181b"
        : meta.colorKey === "black"
          ? dark
            ? "#e5e5e7"
            : "#121212"
          : textHex;
  return {
    key: meta.colorKey,
    label: meta.name,
    tint: `rgba(${r},${g},${b},0.07)`,
    darkTint: `rgba(${r},${g},${b},0.14)`,
    border: hex,
    fill,
    tileFill,
    text: textHex,
    nameColor,
    soft: `rgba(${r},${g},${b},0.22)`,
    darkSoft: `rgba(${r},${g},${b},0.36)`,
  };
}

/** Black/Grey in light mode wash the quarter card and the sprint/block card inside it
 *  with the *same* grey hue as the app's own "muted" text colours (week numbers, day
 *  counts, etc.) — those text spots don't know what colour the quarter is, so on every
 *  other colour they read fine (different hue = contrast), but on black/grey they sit
 *  right on top of a near-identical grey and disappear. Rather than fight the card's own
 *  wash colour, boost just this text: swap the theme's generic grey for solid dark ink
 *  (anchored to the same "#1c1c1e" already used for quarter.text) whenever the active
 *  quarter/block colour is achromatic and the theme is light.
 */
export function mutedTextColors(colorKey: AppleColorKey, dark: boolean) {
  const isAchroLight = (colorKey === "black" || colorKey === "grey") && !dark;
  return {
    tertiary: isAchroLight ? "rgba(28,28,30,0.62)" : "var(--text-tertiary)",
    secondary: isAchroLight ? "rgba(28,28,30,0.88)" : "var(--text-secondary)",
  };
}

export const MILESTONE_COLORS = [
  "#007aff",
  "#34c759",
  "#5856d6",
  "#ff9500",
  "#ff2d55",
  "#af52de",
  "#ff3b30",
  "#5ac8fa",
  "#ffcc00",
  "#00c7be",
  "#a2845e",
  "#121212",
  "#8e8e93",
  "#ffffff",
];

/** Perceived luminance (0–1) of a hex colour, used to decide whether light or dark
 *  content reads best against it. */
export function luminanceOf(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Returns a colour safe to use as goal-title text directly on the app's page
 *  background: the goal's own colour normally, but swapped for the theme's
 *  standard text colour when that colour would be unreadable against the
 *  current background (e.g. near-black text in dark mode, near-white text in
 *  light mode). `fallback` is used when the goal has no colour at all. */
export function readableGoalTextColor(
  colorHex: string | undefined,
  dark: boolean,
  fallback: string,
): string {
  if (!colorHex) return fallback;
  // Mirror the inversion logic from getEventColors so summary labels stay legible.
  const _ach = achromaticStyle(colorHex, dark);
  if (_ach) {
    if (_ach.tier === "grey") return "#71717a";
    if (_ach.tier === "black") return dark ? "#e5e5e7" : "#000000";
    /* white */ return dark ? "#ffffff" : "#18181b";
  }
  const lum = luminanceOf(colorHex);
  if (dark && lum < 0.25) return "var(--text)";
  if (!dark && lum > 0.75) return "var(--text)";
  return colorHex;
}

/** In dark mode, lift colours whose perceived luminance is below 0.45 so they stay legible on dark surfaces.
 *  Bright colours are returned unchanged; very dark ones become a visible mid-tone while keeping their hue. */
export function adaptColor(hex: string, dark: boolean): string {
  if (!dark) return hex;
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum >= 0.45) return hex;
  const factor = Math.min(0.82, (0.55 - lum) / (1 - lum));
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Returns adaptive styles for achromatic colours (white/grey/black) that stay legible in both themes.
 *  Returns null for any chromatic (saturated) colour so callers fall back to adaptColor. */
export function achromaticStyle(hex: string, dark: boolean): AchromaticStyle | null {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const maxC = Math.max(r, g, b);
  const sat = maxC === 0 ? 0 : (maxC - Math.min(r, g, b)) / maxC;
  if (sat > 0.18) return null;
  if (lum > 0.7) {
    // white — pure white border in both themes, as requested
    return dark
      ? {
          bg: "#ffffff",
          border: "#ffffff",
          text: "#18181b",
          marker: "#ffffff",
          tier: "white",
        }
      : {
          bg: "#ffffff",
          border: "#ffffff",
          text: "#18181b",
          marker: "#ffffff",
          tier: "white",
        };
  }
  if (lum < 0.12) {
    // black — pure black border in both themes, to match the white tier above
    return dark
      ? {
          bg: "#09090b",
          border: "#000000",
          text: "#ffffff",
          marker: "#27272a",
          tier: "black",
        }
      : {
          bg: "#000000",
          border: "#000000",
          text: "#ffffff",
          marker: "#000000",
          tier: "black",
        };
  }
  return dark
    ? {
        bg: "rgba(255,255,255,0.20)",
        border: "rgba(255,255,255,0.20)",
        text: "#ffffff",
        marker: "#a1a1aa",
        tier: "grey",
      }
    : {
        bg: "#e4e4e7",
        border: "#e4e4e7",
        text: "#27272a",
        marker: "#a1a1aa",
        tier: "grey",
      };
}

/** Maps any APPLE_COLORS hex variant (light or dark) to the canonical light-mode
 *  hex so achromaticStyle always classifies it correctly regardless of theme.
 *  Custom hex values not in APPLE_COLORS are returned unchanged. */
export function resolveNoteHex(hex: string): string {
  const ac = APPLE_COLORS.find((c) => c.light === hex || c.dark === hex);
  return ac ? ac.light : hex;
}

/** For the grey achromatic tier specifically, normalises any stored grey variant
 *  (light #8e8e93 or dark #636366) to the display grey #71717a (zinc-500) — a
 *  shade that renders equally vivid for both border lines and anti-aliased text
 *  on any background.  Returns the original hex unchanged for all other colours
 *  (including black and white). */
export function normaliseGrey(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const tier = achromaticStyle(resolveNoteHex(hex), false)?.tier;
  return tier === "grey" ? "#71717a" : hex;
}

/** Mirror of achromaticStyle, tuned for the tiny sprint/quarter goal checkboxes:
 *  black gets a fully-opaque zinc-950/zinc-800 pairing (no translucency, so it never
 *  blends into a colored card), grey is a flat opaque zinc-500 chip (like the day-cell
 *  color indicators) instead of a translucent overlay, and white keeps a matching
 *  zinc-700/zinc-200 outline so its footprint lines up exactly with black's.
 *  Returns null for chromatic colours so callers fall back to the raw hex. */
export function goalCheckboxAchromaticStyle(
  hex: string,
  dark: boolean,
): GoalCheckboxStyle | null {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const maxC = Math.max(r, g, b);
  const sat = maxC === 0 ? 0 : (maxC - Math.min(r, g, b)) / maxC;
  if (sat > 0.18) return null;
  if (lum > 0.7) {
    return { bg: "#ffffff", border: "#ffffff", icon: "#18181b" };
  }
  if (lum < 0.12) {
    return dark
      ? { bg: "#09090b", border: "#000000", icon: "#ffffff" }
      : { bg: "#000000", border: "#000000", icon: "#ffffff" };
  }
  return { bg: "#71717a", border: "#71717a", icon: "#ffffff" };
}

/** Resolves the background/border/checkmark colours for a single sprint or quarter
 *  goal checkbox, applying the opaque achromatic mirror above for black/grey/white
 *  and falling back to the plain chromatic colour (or the block/quarter accent)
 *  otherwise. `emptyBorder` is always defined so the outline is visible whether or
 *  not the goal is done, matching the box's fixed h/w regardless of colour. */
/** fallbackColorKey: the sprint/quarter AppleColorKey, used to derive achromatic checkbox
 *  colours from the raw APPLE_COLORS hex rather than from `fill`, which is overridden to
 *  "#ffffff" for black/grey in dark mode (for content contrast) and would produce a white
 *  checkbox on a dark card. */
export function goalCheckboxColors(
  colorHex: string | undefined,
  dark: boolean,
  fallbackHex: string,
  fallbackColorKey?: string,
) {
  const ach = colorHex
    ? goalCheckboxAchromaticStyle(resolveNoteHex(colorHex), dark)
    : null;
  if (ach) {
    return {
      doneBg: ach.bg,
      doneBorder: ach.border,
      emptyBg: "transparent",
      emptyBorder: ach.border,
      icon: ach.icon,
    };
  }

  if (colorHex) {
    return {
      doneBg: colorHex,
      doneBorder: colorHex,
      emptyBg: "transparent",
      emptyBorder: colorHex,
      icon: "#ffffff",
    };
  }

  // No colour chosen for this specific goal: keep the checkbox neutral instead of
  // inheriting the sprint/quarter accent colour, matching the day-goal checkbox default.
  return {
    doneBg: "#34c759",
    doneBorder: "#34c759",
    emptyBg: "transparent",
    emptyBorder: "var(--border-soft)",
    icon: "#ffffff",
  };
}

// ─── Centralized event/milestone color helper ─────────────────────────────────
// Returns all semantic color values needed to render an event card (background,
// title, description, icon, borders, marker bar, and inline-form surfaces) with
// guaranteed readable contrast in both light and dark themes.
type EventColors = {
  bg: string; // card background
  textTitle: string; // primary / title text
  textDesc: string; // secondary / description text
  icon: string; // action icon color
  border: string; // normal card border colour (empty = use boxShadow ring instead)
  borderEditing: string; // border while inline edit form is open
  boxShadow: string; // inset ring substitute (used when border is empty)
  marker: string; // day-cell color bar segment
  formBg: string; // input background inside card
  formBorder: string; // input border inside card
};

export function getEventColors(hex: string, dark: boolean): EventColors {
  // ── No-color path (empty string) ────────────────────────────────────────────
  if (!hex) {
    return {
      bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      textTitle: "var(--text)",
      textDesc: "var(--text-secondary)",
      icon: "var(--text-secondary)",
      border: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
      borderEditing: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
      boxShadow: "",
      marker: dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.20)",
      formBg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      formBorder: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    };
  }
  // ── Achromatic path (white / grey / black) ──────────────────────────────────
  const ach = achromaticStyle(hex, dark);
  if (ach) {
    // Grey  → unified #71717a (zinc-500) in both themes.
    // Black → text inverts in dark mode (#e5e5e7) so it stays legible; border
    //         keeps the literal black the user chose.
    // White → text inverts in light mode (#18181b); border keeps literal white.
    let textHex: string;
    if (ach.tier === "grey") {
      textHex = "#71717a";
    } else if (ach.tier === "black") {
      textHex = dark ? "#e5e5e7" : "#000000";
    } else {
      // white
      textHex = dark ? "#ffffff" : "#18181b";
    }
    // Border and editing border keep the literal selected colour unchanged.
    const borderHex = ach.tier === "grey" ? "#71717a" : resolveNoteHex(hex);
    return {
      bg: "transparent",
      textTitle: textHex,
      textDesc: textHex,
      icon: textHex,
      border: borderHex,
      borderEditing: borderHex,
      boxShadow: ach.ring ?? "",
      marker: ach.marker,
      formBg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      formBorder: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    };
  }

  // ── Chromatic path ───────────────────────────────────────────────────────────
  // adaptColor lifts very-dark hues in dark mode so they stay visible.
  const adapted = adaptColor(hex, dark);

  // Perceived luminance of the *original* hex determines text contrast on the
  // card surface.  In light mode the card bg is near-white with a subtle tint,
  // so very bright colours (yellow, mint, light-teal, orange) need a strongly
  // darkened variant to remain legible.  In dark mode adaptColor handles it.
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return {
    bg: "transparent",
    textTitle: hex,
    textDesc: hex,
    icon: hex,
    border: `${hex}99`,
    borderEditing: `${hex}cc`,
    boxShadow: "",
    marker: adapted,
    formBg: dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.70)",
    formBorder: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
  };
}

export const LIFE_ACCENT = "#007aff";
export const getQuarterColors = resolveQuarter;
export type { EventColors };
