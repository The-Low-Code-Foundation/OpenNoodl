# Phase 23 Progress — Visual Refresh (Track I)

**Created:** 2026-07-26 · **Status:** Not started

| ID | Title | Status | Notes |
|---|---|---|---|
| UIX-001 | Design tokens & typography foundation | ✅ Complete (2026-07-26) | Canonical tokens in core-ui; azure primary, danger-only red; see UIX-001-NOTES.md |
| UIX-002 | Legacy hex mop-up + ratchet | ✅ Complete (2026-07-26) | Editor styles 300→16 (16=1 documented exemption); per-package ratchet gate live in CI. ⚠️ core-ui slice (100 occ/16 files) **deferred** — run after UIX-003 (now merged); see UIX-002-NOTES.md |
| UIX-003 | Control kit | ✅ Complete (2026-07-26) | Forms/toast/chips/binding chip/box-model editor; see UIX-003-NOTES.md. Live residuals: box-model set/undo/reload round-trip, binding-chip source label, ToastCard live check |
| UIX-004 | Editor chrome & panels | ⬜ Not started | Now unblocked (UIX-003 merged) |
| UIX-005 | Canvas re-palette & node cards | ✅ Complete (2026-07-26) | Token-driven CanvasTheme + theme-change repaint hook (UIX-008 dependency shipped); anchor math preserved; see UIX-005-NOTES.md. Live residuals: screenshot-vs-mock, diff canvas, zoom 25–200%, perf, theme-toggle repaint |
| UIX-006 | Launcher & first-run | ⬜ Not started | Thumbnail pipeline investigation timeboxed 2d |
| UIX-007 | Iconography | ⬜ Not started | |
| UIX-008 | Light theme | ⬜ Not started | Strictly after 001/002/005 |
| UIX-009 | Long-tail sweep & visual QA | ⬜ Not started | ⚠️ Its harness + "before" corpus runs at PHASE START |

## Coordination notes

- File-territory rule (UIX-002 vs UIX-003/004): UIX-002 never edits a file a Tier-2 spec claims; log claims here when tasks run concurrently.
- Parallel worktrees: verify base = cline-dev tip; editor live-verification from the primary checkout (lerna trap); commit with pathspecs.
- Mocks: [mocks/](./mocks/) — spec wins over mock; mock wins over silence.

## Log

- 2026-07-26 — Phase created: critique + mockups session; styling-architecture audit; 9 task specs written.
- 2026-07-26 — **UIX-002, UIX-003, UIX-005 run in parallel** (3 worktrees, one model each: Sonnet/Opus/Fable) and merged to cline-dev in order 005→002→003. All three self-corrected the 376-commit stale worktree base. Territories were disjoint by design (editor stylesheets / core-ui components / canvas paint code); UIX-002's core-ui slice was deferred to keep it clear of UIX-003. One merge conflict, in `assets/css/style.css` marginpadding block — both branches tokenized it; resolved toward UIX-003's box-model redesign. Post-merge gates green: hex ratchet holds (editor 16, core-ui 100), core-ui + editor typecheck clean on all touched files. UIX-005 deleted `constants/NodeGraphColors.ts` (rewired into new `CanvasTheme.ts`). Live-editor verification (from primary checkout) is the outstanding residual per each task's NOTES.md.
- 2026-07-26 — UIX-001 complete: duplicate token files collapsed into core-ui (editor + viewer-frame import via `@noodl-core-ui`), new palette (elevation neutrals, azure primary, danger/warning/success split, node-category + wire tokens, inert light block), typography settled (system UI stack, bundled Bricolage Grotesque 600 display face extracted from the mock, 35 legacy per-weight font-var call sites converted), full primary/notice audit (zero danger-on-primary found; 1 mis-wire fixed, 5 notice-as-accent chrome sites → primary), 32 referenced-but-undefined theme tokens defined as compat aliases, AA contrast matrix in dev-docs/guidelines/DESIGN-TOKENS.md, live-verified (launcher + editor), screenshots in screenshots/after-tier1/. Status: ⚠️ UIX-009's "before" corpus was NOT captured before this landed — only these after-shots exist.
