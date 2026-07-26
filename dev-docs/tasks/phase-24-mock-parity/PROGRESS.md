# Phase 24 Progress — Mock Parity

**Created:** 2026-07-26 · **Status:** 🚧 In progress

| ID | Title | Status | Notes |
|---|---|---|---|
| PAR-001 | Launcher parity | ✅ Done 2026-07-26 | 52px titlebar w/ inset lights + 120px region, 224px mock sidebar, Bricolage head row, ⌘K search, 3-up cards, plain footer, toast anchor/radius/shadow; typecheck + ratchet green; see [PAR-001-NOTES.md](./PAR-001-NOTES.md) — live smoke (lights/⌘K/drag/light-theme) pending from primary checkout |
| PAR-002 | Properties panel rebuild | 🚧 Agent running (worktree) | |
| PAR-003 | Editor chrome parity | 🚧 Agent running (worktree) | |

## Coordination

- Territories disjoint: launcher subtree / propertyeditor family / chrome views. Preflight `comm -12` before merge.
- Worktree agents: verify base = cline-dev tip (stale-base trap), commit with pathspecs.
- Live verification + screenshots from primary checkout by orchestrator after merge; Richard offered to supply screenshots on request.

## Log

- 2026-07-26 — **Material-icons-as-text bug diagnosed (not a phase-23 regression):** the Icon node renders `iconIconSource.class` as a CSS class + ligature text; the class only works when the project has the matching iconset module (`noodl_modules/material-icons/manifest.json` → injects the Google Fonts stylesheet). The AI-generated "Shine Phase 2" project referenced the class without the module → raw "dehaze"/"account_circle" text. Fixed for that project by installing the module manifest. **Product follow-up worth filing:** semantic validator / AI authoring loop should flag icon classes with no installed iconset module (silent-failure class). Also: Shine Phase 2 lives in an ephemeral session scratchpad under /private/tmp — should be moved to a durable location.
- 2026-07-26 — PAR-001 merged to cline-dev (`58cc4d2`).

- 2026-07-26 — Phase created from Richard's parity directive; three task specs written from the mock CSS (normative values extracted); three parallel worktree agents launched.
