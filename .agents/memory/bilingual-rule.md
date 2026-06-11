---
name: Bilingualism rule for Life Calendar
description: All new UI text must be provided in both Russian and English following the existing i18n system.
---

## Rule
Any new functionality added to the Life Calendar app must support both Russian and English languages. All user-facing strings (buttons, labels, messages, placeholders, tooltips, modal titles, etc.) must be added to the existing localization/translation system in both languages.

**Why:** The user explicitly requires bilingual support (RU + EN) for all new features.

**How to apply:**
- Before adding any text, check the existing i18n/translation structure in the app (look for translation files or locale objects).
- Add every new string in both `ru` and `en` keys.
- Never hardcode text in only one language.
- If the translation mechanism is unclear, ask the user before proceeding.
