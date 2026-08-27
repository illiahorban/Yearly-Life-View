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

---

## 5. Git & GitHub Push Policy (STRICT)
- **STRICT PROHIBITION**: NEVER push changes to GitHub (`git push`) automatically, autonomously, or on your own initiative.
- **Explicit Instruction Only**: Pushing to GitHub is ONLY allowed when the user explicitly gives a direct command to push.
