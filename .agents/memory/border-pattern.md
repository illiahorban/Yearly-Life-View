---
name: Border pattern — inset box-shadow
description: Rule for borders on all UI elements in Life Calendar to prevent border merging artifacts.
---

# Border pattern: always use inset box-shadow

## The rule
Never use `border: Xpx solid <color>` on UI elements (buttons, modals, popovers, cards).
Use `box-shadow: inset 0 0 0 1px <color>` instead — either standalone or added to an existing `boxShadow` value with a comma.

## Why
`border` is painted on the element's *edge* (box model). When the element sits adjacent to a container that also has a border of the same semi-transparent color (e.g. `var(--border-soft)` = `rgba(255,255,255,0.12)` in dark mode), the two borders visually merge and the element appears to have an incomplete or missing border on that side.

`inset box-shadow` paints entirely *inside* the element's bounds and is completely independent of its neighbours.

## How to apply
- New button/chip with border: `boxShadow: "inset 0 0 0 1px var(--border)"`
- New modal/panel that already has a drop-shadow: append to the existing value:
  `boxShadow: \`0 24px 70px rgba(0,0,0,0.24), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}\``
- Theme-aware border colors already in use: `var(--border)` (0.18 opacity) is slightly stronger than `var(--border-soft)` (0.12); prefer `--border` for interactive elements.
- Exceptions: intentional *colored* sprint/quarter accent borders (`accentColor`, `quarter.border`) may stay as `border` since they are decorative, not structural, and typically surrounded by matching background.
