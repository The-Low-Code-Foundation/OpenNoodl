# Phase 24 Progress — Mock Parity

**Created:** 2026-07-26 · **Status:** 🚧 In progress

| ID | Title | Status | Notes |
|---|---|---|---|
| PAR-001 | Launcher parity | ✅ Done 2026-07-26 | 52px titlebar w/ inset lights + 120px region, 224px mock sidebar, Bricolage head row, ⌘K search, 3-up cards, plain footer, toast anchor/radius/shadow; typecheck + ratchet green; see [PAR-001-NOTES.md](./PAR-001-NOTES.md) — live smoke (lights/⌘K/drag/light-theme) pending from primary checkout |
| PAR-002 | Properties panel rebuild | ✅ Done 2026-07-26 (needs live QA) | Header type-chip (UIX-004b closed), 62px grid, input kit, 32×19 toggles, seg-icons, box-model, binding chip w/ real source + click-to-select. [Notes](./PAR-002-NOTES.md) |
| PAR-003 | Editor chrome parity | ✅ Done 2026-07-26 (needs live QA) | Toolbar/rail/HUD/bottom-bar per mock; AI pill→Build panel (⌘J), zoom cluster→ViewportActions, Preview-live→ViewerConnection presence; ratchet =, 0 new TS errors. See [PAR-003-NOTES.md](./PAR-003-NOTES.md) |
| PAR-004 | Polish pass — the recorded residual deltas | 📋 Specced 2026-07-30 | [PAR-004-POLISH-PASS.md](./PAR-004-POLISH-PASS.md). The 2026-07-26 live pass listed five deltas "for a PAR-004 polish pass" and PAR-004 was never filed, which is why this phase has sat at 🚧 with all three tasks done. Now filed with owners. One of the five (the launcher sort select) is a **feature-level** decision, not polish; another (traffic lights / light theme / real keystrokes) is explicitly un-runnable under CDP and folds into [ALPHA-001](../phase-33-alpha-launch/ALPHA-001-FIRST-HOUR.md) |

## Coordination

- Territories disjoint: launcher subtree / propertyeditor family / chrome views. Preflight `comm -12` before merge.
- Worktree agents: verify base = cline-dev tip (stale-base trap), commit with pathspecs.
- Live verification + screenshots from primary checkout by orchestrator after merge; Richard offered to supply screenshots on request.

## Log

- 2026-07-26 — **All three PAR merges live-verified from primary checkout** (screenshots in [screenshots/](./screenshots/), fixture Shine Phase 2, dark theme): launcher = mock (wordmark+dot, tab underline, ⌘K search chip, sort/filter select, 3-up cards w/ chips + ghost initials, plain footer, mono version); editor chrome = mock (route pill, amber 92 chip, segmented Design/Preview, rocket Deploy, AI pill "Ask NodeGX AI… ⌘+J", zoom cluster, bottom pill tabs + live "Preview live" success dot — the ViewerConnection binding demonstrably works); properties panel = mock (TEXT · VISUAL category chip live on a real Text node, box-model w/ MARGIN/PADDING tags + muted zeros, section rhythm, restyled token-hint card). Gates on merged tree: editor tsc 0, core-ui = 45-known baseline only, ratchet holding. **Residual polish deltas (small, for a PAR-004 polish pass):** DIMENSIONS row still renders the legacy width/height-mode glyph boxes (dispositioned ResizingType fallback — revisit as mock Width/Height rows), alignment icon rows read close to but not exactly the seg-icons container, node-name header renders as a bordered input vs the mock's plain text, launcher sort select shows filter state not "Last opened" (no sort state exists — feature-level), traffic-light inset + light theme + ⌘K/⌘J keystrokes need eyes-on/native verification (CDP can't capture OS chrome or send real app-level keystrokes).
- 2026-07-26 — PAR-002 merged (`2809a68`), PAR-003 merged (`a9fce93`).

- 2026-07-26 — **Material-icons-as-text bug diagnosed (not a phase-23 regression):** the Icon node renders `iconIconSource.class` as a CSS class + ligature text; the class only works when the project has the matching iconset module (`noodl_modules/material-icons/manifest.json` → injects the Google Fonts stylesheet). The AI-generated "Shine Phase 2" project referenced the class without the module → raw "dehaze"/"account_circle" text. Fixed for that project by installing the module manifest. **Product follow-up worth filing:** semantic validator / AI authoring loop should flag icon classes with no installed iconset module (silent-failure class). Also: Shine Phase 2 lives in an ephemeral session scratchpad under /private/tmp — should be moved to a durable location.
- 2026-07-26 — PAR-001 merged to cline-dev (`58cc4d2`).

- 2026-07-26 — Phase created from Richard's parity directive; three task specs written from the mock CSS (normative values extracted); three parallel worktree agents launched.
