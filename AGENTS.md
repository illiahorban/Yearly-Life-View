# Persistent Engineering & Problem-Solving Guidelines

This document sets mandatory operating rules and quality principles for all future development, bug fixing, and feature implementations in this project.

---

## 1. Root Cause Engineering (No Superficial Patches)
- **Zero Cosmetic Hack Policy**: Never mask visual or behavioral bugs with ad-hoc offsets (`margin`, `translate-y`, `top`, negative paddings, arbitrary `z-index`, or hardcoded pixel shifts) unless explicitly requested.
- **Root Cause Identification**: Always investigate the entire hierarchy (parent container, flex/grid layout, box-sizing, border vs inset box-shadow, line-height, text metrics, and DOM nesting) to identify why the discrepancy exists at its source.
- **Structural Uniformity**: When two or more states/elements (e.g. past days, today, future days, modal views) are expected to align or behave uniformly, their underlying DOM structure, container styling, and box models MUST be identical 1-to-1.

---

## 2. Comparative Diff Auditing
When an element does not match an expected/reference element:
1. Locate the reference (working) component or state.
2. Perform a line-by-line comparison of:
   - Outer container classes, inline styles, borders, shadows, and margins.
   - Flex/grid alignment directives (`justify-content`, `align-items`, `gap`).
   - Inner content wrappers and spacers.
   - Text sizing, line-height, and typography metrics.
3. Bring the flawed element into strict architectural symmetry with the reference implementation.

---

## 3. Strict Verification & Self-Correction
- **No False Assurances**: Never declare a problem solved based on assumptions. Verify the mathematical, structural, and visual consistency of the code changes before concluding.
- **Multi-Hypothesis Approach**: If an initial fix fails or produces unintended side effects, do not repeat micro-adjustments. Step back, generate at least 2–3 distinct architectural hypotheses, verify the actual codebase state, and apply a clean, fundamental fix.
- **Responsive Symmetry**: Always ensure changes maintain pixel-perfect integrity across both mobile viewports and desktop layouts (`sm:`, `md:`, `lg:`).

---

## 4. Code Cleanliness & Production Integrity
- Keep files cleanly formatted and type-safe.
- Maintain build stability (`npm run build` / `vite build`).
- Do not introduce redundant CSS classes or conflicting utility styles.
- **Automatic Compilation**: Always execute `compile_applet` before completing any turn so that the production output in `dist/` is immediately rebuilt and never stale in preview.

---

## 5. Global Green Color Standard (STRICT)
- **Single Authorized Green Accent**: `#34c759` (Apple Green — the exact color of the main year/sprint progress bar).
- **Mandatory Usage**: Always and everywhere use `#34c759` as the green color for progress bars, goal counters, checkmarks, completion badges, and all active green UI elements.
- **Strict Prohibition**: NEVER use `#34d399`, `#16a34a`, `#10b981`, or any other green variations.

---

## 6. Git & GitHub Push Policy (STRICT)
- **STRICT PROHIBITION**: NEVER push changes to GitHub (`git push`) automatically, autonomously, or on your own initiative.
- **Explicit Instruction Only**: Pushing to GitHub is ONLY allowed when the user explicitly gives a direct command to push.

---

## 7. Integer Pixel & Sharp Rendering Policy (STRICT)
- **Zero Fractional Pixels**: NEVER use fractional CSS pixel values (`0.5px`, `1.5px`, `2.67px`, `3.5px`, etc.) for `border`, `box-shadow` spread/blur, `outline`, `gap`, `padding`, `margin`, `font-size`, or container dimensions.
- **Anti-Aliasing Integrity**: Fractional pixels on high-density mobile screens (DPR 2, 2.625, 2.75, 3) cause subpixel blur, asymmetrical stroke widths, and shimmering/floating artifacts during scrolling.
- **Standard Widths & Spacing**:
  - Always use integer pixels (`1px`, `2px`, `3px`, etc.).
  - For subtle borders or dividers, use `1px` with reduced opacity/alpha instead of fractional widths like `0.5px`.
  - For rings/strokes that need to be prominent, use `2px` instead of `1.5px`.
  - **Authorized Dual-Sided Contrast Exception**: The two-sided ultra-subtle 0.5px contrast outline (`contrastBorderShadow`, `progressBarOutline`, and modal window contrast) for black in dark mode and white in light mode (`0 0 0 0.5px ..., inset 0 0 0 0.5px ...`) is an authorized system exception to preserve sharp, high-contrast double-sided contours without washing out borders.

---

## 8. iPhone & Chrome iOS Runtime Architecture (STRICT)
The mobile version is specifically engineered for and evaluated on **Google Chrome on iPhone** (iOS WebKit / WKWebView environment):
- **Viewport & Dynamic Toolbars**:
  - Chrome on iOS dynamically expands and collapses its top omnibox and bottom navigation bar during scroll.
  - Always account for dynamic viewport units (`dvh`, `svh`) instead of static `vh`, and honor iOS safe-area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
  - Prevent unwanted background page scroll and bounce when modals are open (`overscroll-behavior: contain`, locked body scroll).
- **Overscroll & Swipe Gestures**:
  - Chrome on iOS features native edge-swipe navigation (back/forward) and pull-to-refresh.
  - Modals, popovers, and scrollable panels must use `overscroll-behavior-y: contain` to prevent accidental page reloads or triggering browser history transitions while scrolling inside dialogs.
- **Form Inputs & Auto-Zoom Prevention**:
  - iOS WebKit forces auto-zoom on any input or textarea with `font-size < 16px`. Mobile form inputs and note textareas must maintain at least `16px` base font size (or `text-base`) to prevent jarring viewport scale jumps.
- **Touch Responsiveness & Anti-Aliasing**:
  - Suppress grey tap flashes with `-webkit-tap-highlight-color: transparent`.
  - Maintain crisp integer pixel strokes and contours for iPhone Super Retina OLED displays (DPR 2x and 3x).

---

## 9. Geometric Centering & Icon Alignment Architecture (Zero Glyph Drift)
### Root Causes of Element Shifting:
1. **Glyph Metrics vs. Vector Math**: Raw Unicode characters (e.g. `✕`, `×`, `X`, `+`, `-`, `←`, `→`, `✓`) render using font tables (ascender, descender, cap-height, baseline offset). In system fonts (SF Pro on iOS, Roboto/Inter on desktop), characters do not align to the mathematical geometric center of their glyph box, causing vertical and horizontal drift across platforms and DPR ratios.
2. **Line-Height & Inline Leading Inheritance**: Buttons and icon containers that lack explicit `line-height: 0` inherit arbitrary line-heights (1.2 to 1.5) from parent elements, injecting invisible vertical padding that pushes elements off-center.
3. **User-Agent Default Spacing**: `<button>` tags without explicit `padding: 0; margin: 0; border: none;` receive browser-default padding and border models that vary by engine (WebKit vs Blink).
4. **Container Padding Inconsistencies**: Different modal dialogs using mismatched header insets (`pt-4` vs `pt-5` vs `pt-6`, `items-start` vs `items-center`) cause controls to jump when switching views.

### Mandatory Operational Rules:
- **Vector Icons ONLY for Action Controls**: NEVER use raw Unicode/text characters for close buttons, counters, steppers, or navigational icons. Always use pure vector `<svg>` elements with explicit `viewBox`, centered coordinates, and `display: block`.
- **The 7-Property Centering Container Standard**:
  Every circular or square icon button must enforce:
  ```css
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  line-height: 0;
  box-sizing: border-box;
  border: none;
  flex-shrink: 0;
  ```
  And its direct `<svg>` child must have `display: block; flex-shrink: 0;`.
- **Standardized Modal Close Button (`ModalCloseButton`)**:
  All modal windows must use the shared `<ModalCloseButton onClick={...} />` component.
  All modal headers must enforce identical top and right insets (standard `20px` top and `20px` right, `px-5 pt-5 pb-3` / `20px 20px 14px`) and vertically center header items so close buttons never jump or shift between different modals on both mobile and desktop viewports.

