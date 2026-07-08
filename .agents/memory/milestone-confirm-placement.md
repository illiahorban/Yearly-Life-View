---
name: MilestoneModal ConfirmDialog placement
description: Where to place ConfirmDialog in MilestoneModal, and why delete must call onChange.
---

## Rule
ConfirmDialog for MilestoneModal delete must be placed INSIDE MilestoneModal's return JSX (as a child of the outer motion.div), NOT inside GoalsModal which comes right after.

## Why
GoalsModal is defined immediately after MilestoneModal in App.tsx. A previous session accidentally placed the ConfirmDialog inside GoalsModal's `<>` fragment instead of MilestoneModal. The state references (`confirmDeleteMsId`, `setConfirmDeleteMsId`, `items`) are not in GoalsModal scope, causing silent failures — the dialog never appears and no deletion occurs.

## How to apply
- Place `<ConfirmDialog ... />` between the inner card's closing `</motion.div>` and the outer overlay's closing `</motion.div>` in MilestoneModal's return.
- GoalsModal's return must use `<>...</>` fragment to wrap its outer motion.div plus its color-picker portal conditional (both are siblings).
- The `onConfirm` for delete must compute `newItems` from current `items`, then call BOTH `setItems(newItems)` AND `onChange(newItems)` — otherwise deletion only affects local state and is lost when the modal closes without Save.
