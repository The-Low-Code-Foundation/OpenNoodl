# Phase 33 — Progress

**Track R — Alpha Launch**
**All 5 tasks specced as of 2026-07-30. None started.**
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| Task | Tier | Status | Notes |
|---|---|---|---|
| [ALPHA-001](./ALPHA-001-FIRST-HOUR.md) The cold-install first hour | 1 | 📋 Specced | Discharges seven tasks' owed live-QA in one pass. Part A can start as soon as the tree is clean; Part B needs ALPHA-002 |
| [ALPHA-002](./ALPHA-002-RELEASE-CUT.md) A release that reaches a Mac | 1 | 📋 Specced | **The v0.1.0 draft has no macOS artifacts at all.** The credential half is human-only and is the long pole |
| [ALPHA-003](./ALPHA-003-CRASH-AND-FEEDBACK.md) Find out when it breaks | 2 | 📋 Specced | Depends on ALPHA-005 — nothing transmits before a policy names it |
| [ALPHA-004](./ALPHA-004-USER-DOCS.md) Documentation for someone who is not us | 2 | 📋 Specced | Blocked on phase 30 Tier 1 + NDA-005. Node reference is **generated**, never authored |
| [ALPHA-005](./ALPHA-005-LEGAL-SURFACE.md) The paperwork that ships with a binary | 2 | 📋 Specced | Half a day, and it unblocks ALPHA-003 |

## Recommended order

1. **ALPHA-002's credential steps** — human-gated and the longest lead time. Start it
   before anything else, because nothing else can be tested end to end until a
   signed build exists.
2. **ALPHA-005** — half a day, unblocks ALPHA-003.
3. **ALPHA-001 Part A** — as soon as the working tree is clean.
4. **ALPHA-003**.
5. **ALPHA-001 Part B** — needs the build from step 1.
6. **ALPHA-004** — after phase 30 Tier 1 lands, so the node reference has something
   true to generate from.

## Findings register

Findings from this phase's tasks are recorded here with file and line. ALPHA-001 is
expected to be the main contributor. F-numbers continue the shared sequence used by
phases 25 and 27 — check the highest existing number before allocating.

| # | Finding | Where | Owner |
|---|---|---|---|
| — | *(none yet — no task started)* | | |

## Pre-existing findings this phase adopts

Recorded during the 2026-07-30 readiness review, before any task started. These are
evidence, not speculation — each was measured.

| # | Finding | Evidence | Owner |
|---|---|---|---|
| A1 | **The v0.1.0 draft release carries no macOS artifact of any kind** — no `.dmg`, no `.zip`, no `latest-mac.yml`. macOS is the primary development platform | `gh release view v0.1.0`, 2026-07-30 | ALPHA-002 |
| A2 | **No `latest-linux.yml`.** The AppImage ships with no update feed, so Linux has an installer and no update path | same | ALPHA-002 |
| A3 | The darwin-x64 leg's failure has a recorded cause (the retired `macos-13` image, since fixed). **The darwin-arm64 leg's failure does not**, and it ran on a supported image | `release.yml` comments vs. the asset list | ALPHA-002 |
| A4 | **Packaged builds write no log file.** `app.getPath('logs')` is never used; a user hitting a bug has nothing to attach | grep, 2026-07-30 | ALPHA-003 |
| A5 | **No crash reporting of any kind.** The only `crashReporter`/`sentry` matches in the tree are inside gitignored webpack bundles | grep, 2026-07-30 | ALPHA-003 |
| A6 | `mixpanel-browser` was a declared dependency with **zero call sites**, and pulled `@mixpanel/rrweb` (DOM session recording) into every packaged build | grep + lockfile | ✅ **Fixed 2026-07-30** `359bd8f5` — removed with 9 transitive packages |
| A7 | The repo had **no issue templates**, while the product has no crash reporting — so the feedback channel was a blank text box | — | ✅ **Fixed 2026-07-30** `47219e05` — three issue forms |
| A8 | The publish target is `The-Low-Code-Foundation/OpenNoodl` for a product called NodeGX, so every download URL and the update feed say the old name | `packages/noodl-editor/package.json` | ALPHA-002 — a decision, not a defect |
| A9 | The root `package.json` declares **no `license` field**, though `LICENSE` exists | — | ALPHA-005 |

## Log

- **2026-07-30 — Phase created** from a readiness review against the full phase
  register, scoped explicitly to exclude phases 18, 20, 26, 31 and 32 (post-alpha by
  decision) and phase 17 (a G3 question). Five tasks specced. A6 and A7 were fixed
  in the same session rather than filed, being small and self-contained.

- **2026-07-30 — the working tree was landed before any of this.** The primary
  checkout carried **121 uncommitted files** across four unrelated bodies of work,
  which is what made ALPHA-001 unrunnable: a live QA pass measures whatever is on
  disk. Five commits (`61d45f31` brand/icons, `a2db2231` Blockly logic-builder,
  `22618d2d` devtools process-lifetime fixes, `62e400d4` docs, plus the screenshot
  corpus) took it to 33 — and the 33 that remain are exactly phase 30's live,
  actively-being-written set, which was deliberately not touched. Verified before
  landing: `typecheck:editor` 0, `typecheck:runtime` 0, `typecheck:core-ui` 43
  errors all pre-existing path-alias failures in files none of the groups touched
  (baseline 45), and 18 logic-builder tests passing.
