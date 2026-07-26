# Phase 23 Progress — Visual Refresh (Track I)

**Created:** 2026-07-26 · **Status:** Not started

| ID | Title | Status | Notes |
|---|---|---|---|
| UIX-001 | Design tokens & typography foundation | ✅ Complete (2026-07-26) | Canonical tokens in core-ui; azure primary, danger-only red; see UIX-001-NOTES.md |
| UIX-002 | Legacy hex mop-up + ratchet | ⬜ Not started | |
| UIX-003 | Control kit | ⬜ Not started | |
| UIX-004 | Editor chrome & panels | ⬜ Not started | |
| UIX-005 | Canvas re-palette & node cards | ⬜ Not started | Must ship theme-aware hook for UIX-008 |
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
- 2026-07-26 — UIX-001 complete: duplicate token files collapsed into core-ui (editor + viewer-frame import via `@noodl-core-ui`), new palette (elevation neutrals, azure primary, danger/warning/success split, node-category + wire tokens, inert light block), typography settled (system UI stack, bundled Bricolage Grotesque 600 display face extracted from the mock, 35 legacy per-weight font-var call sites converted), full primary/notice audit (zero danger-on-primary found; 1 mis-wire fixed, 5 notice-as-accent chrome sites → primary), 32 referenced-but-undefined theme tokens defined as compat aliases, AA contrast matrix in dev-docs/guidelines/DESIGN-TOKENS.md, live-verified (launcher + editor), screenshots in screenshots/after-tier1/. Status: ⚠️ UIX-009's "before" corpus was NOT captured before this landed — only these after-shots exist.
