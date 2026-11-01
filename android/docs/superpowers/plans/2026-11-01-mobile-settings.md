# Mobile settings implementation plan

> **For agentic workers:** Use executing-plans to implement and verify each task.

**Goal:** Adapt the desktop settings structure into readable, accessible native phone settings without changing profile formats or provider behavior.

**Architecture:** Replace the four cramped tabs with a scrollable settings index and dedicated pages. Reuse existing preference keys, source authentication and transfer actions. Shared native view helpers provide cards, full-row switches, radio choices and fields; settings routes and scroll positions survive recreation.

**Tech Stack:** Existing native Java Android views, local SharedPreferences, existing EN/RU/DE dictionary and Android build/signing tools. No new dependencies.

**Spec:** The user requested the PC settings organization adapted for phones. Use Content, Curation, Creators, Sources, Tabs, Appearance, Privacy, Profile transfer, Language and About/version. Recommendation interests remain accessible from Curation. Android About links to the existing APK releases; it does not gain a Windows updater.

## Global constraints

- Android settings only; do not change desktop code, provider algorithms, profile data/schema, credentials or recommendation behavior.
- Preserve all current preference keys, transfer consent and signing identity. No archives or installed-PC changes.
- Hidden owned ArtCatalogQA emulator only; no physical phone, ArtCatalogPhone AVD or personal desktop input.
- Native phone layout must wrap at 360dp, support increased font size and EN/RU/DE, and keep actions reachable above the keyboard.

## Review focus

- Back and recreation retain settings route and scroll, including after theme/language changes.
- Switch labels and descriptions wrap; disabled dependent controls cannot be toggled via their row.
- Existing source keys remain stored when a blank key is submitted; password fields never enter saved navigation state.
- Cancelled profile transfer performs no merge; explicit existing consent remains required.
- The dedicated index exposes all settings without duplicate import/export actions in unrelated sections.

## Tasks

- [x] Capture existing native settings and map all existing options to desktop sections.
- [x] Build shared native settings view helpers and matching outline icons.
- [x] Integrate index, pages, source subpages and route restoration with existing actions.
- [x] Update EN/RU/DE messages; verify real persisted switches, source validation, transfer and Back on the hidden emulator.
- [x] Run Android tests/lint, review the scoped diff, build/sign 0.1.13 and verify update preservation.
- [ ] Publish the verified Android-only APK and confirm the Windows latest release is unchanged.
