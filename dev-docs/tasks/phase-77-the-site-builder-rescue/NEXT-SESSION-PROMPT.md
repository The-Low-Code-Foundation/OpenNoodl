# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## 🟢 THE BOARD — re-derived from the task FILES, 2026-09-02 (s43)

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

| task | state, read off its own file |
|---|---|
| SBR-001 | ✅ closed s2 |
| SBR-002 | ✅ closed s4 |
| SBR-003 | 🟡 built s4 — **owes the `var(--token)` dimension-port probe**, and owns [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) |
| SBR-004 | ✅ built s5, driven s8b |
| SBR-005 | 🟡 built s36 — AC1's second half is **Richard's to look at**, not a session's |
| SBR-006 | ✅ closed s33 |
| SBR-007 | 🟡 **AC3 CANNOT BE MET** — D15, no runtime drop-target capability, re-measured at HEAD with a boundary control at s29. The phase must not close pretending otherwise |
| SBR-008 | ✅ built |
| SBR-009 | 🟡 built s37 — **AC1's live half and AC3 are owed to SBR-014**, not blocked |
| SBR-010 | ✅ built and driven s38 |
| SBR-011 | 🟡 built and driven s39 — **AC3 open; its blocker D46 was FIXED at s42, drive owed** |
| SBR-012 | ✅ built s35 |
| SBR-013 | ✅ closed s41 — all three ACs |
| **SBR-014** | ⬜ **never built — and it is now UNBLOCKED** |
| SBR-015 | ✅ built s13 |
| SBR-016 | ✅ fixed and driven s15 |
| SBR-017 | ✅ built and driven s14 |

---

## 🟢 FIRST JOB: **SBR-014** — the phase's acceptance run. Both of its blockers are gone

Two sessions ran in parallel on 09-02 and between them cleared everything that stood in front of the
last task:

- **s42 (peer) fixed [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46)** — one shared SSE connection per
  backend, `SseConnectionPool.ts` plus edits to `RealtimeSubscription.ts`, `SseTransport.ts` and
  `index.ts` in `noodl-runtime`, with 11 new arms in `realtime-transports.test.ts`. ⚠️ **That work is
  UNCOMMITTED in the working tree and its drive is still owed** — `sbr011-live-preview-drive` must be
  re-run and SBR-011 AC3 settled. It is the peer's lane; do not redo it, but do not assume it landed
  either. **Check `git status` for `SseConnectionPool.ts` before trusting anything about D46.**
- **s43 (this session) closed [D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47)** — the two red drives are
  green and the REL-002a lead is exonerated. Details below.

**So SBR-014 is the job.** It is the phase's end condition, it re-verifies every person sentence, and
it also collects **SBR-009's AC1 live half and AC3**, which were never blocked —
`helpers/site-drive.ts` has existed for fourteen sessions.

⚠️ **SBR-014 AC2 is the one to hold yourself to:** a step that cannot be driven is recorded **⬜
against that task by name**, never rounded off. Two such steps are known in advance:
- **SBR-007 AC3** (D15) — no runtime drop-target capability. Re-measured at HEAD with a boundary
  control at s29. It cannot be driven and the phase must not close pretending it can.
- **Step 5's live repaint** depends on the peer's D46 fix actually being in the tree *and in the
  built viewer bundle* — see the bundle trap below, which is exactly how it will fool you.

---

## 🔴 What s43 measured, and the trap inside it that SBR-014 will meet

**[D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47) does not reproduce. Both drives pass:**

| suite | s40 | **s43** |
|---|---|---|
| `sbr010-messages-drive` | 🔴 17/17 fail | ✅ **17/17 pass**, exit 0, 118s |
| `sb008-public-site-drive` | 🔴 7 fail | ✅ **20/20 pass**, exit 0, 27s |

✅ **The REL-002a lead is exonerated by a control, not by argument.** Both suspect edits are *still
in the tree, unchanged since before s40*, and the drives pass **with them installed** —
`text-input.ts` (`Placeholder` default still `''`; `grep 'Type here'` in the served bundle → 0) and
`render-from-disk.js` (mtime 16:47, its s40 state). A green arm with the suspect present is the
control the row was owed.

### 🔴 The lesson, and it is the one most likely to bite SBR-014

Nothing on the drive side changed between the red and the green — both test files and
`helpers/members-drive.ts` are clean in git and older than s40. **The only artefact that varied is
the built viewer bundle**, `packages/noodl-editor/src/external/viewer/noodl.viewer.js`, which
`HARNESS_PATHS.VIEWER_DIR` resolves to in a checkout:

- `noodl.viewer.js` — rebuilt **09-02 21:28**
- `noodl.viewer.js.LICENSE.txt` — still **09-02 14:39** (webpack leaves it when unchanged)

s40 drove the 14:39 build; s43 drove the 21:28 one.

🔴 **s40's two controls could not possibly have found this.** Both were *source-side reverts* — D45's
fix, then `render-from-disk.js` to committed HEAD — and neither rebuilt the bundle, so all three arms
re-measured the **same 14:39 artefact** and agreed with each other for a reason unrelated to what was
being varied. ✅ **A source revert is not a control over a system that serves a gitignored build:
rebuild between arms, or grep the built artefact for the changed string.** This is the second time in
two sessions — s41 hit it with a two-day-stale `noodl-mcp.cjs`.

⚠️ **Concretely, for SBR-014 step 5:** the peer's `SseConnectionPool` is in the *source* tree but the
21:28 bundle **does not carry it** (`SharedSseConnection` → 0, `openConnectionCount` → 0). If you
drive the live repaint without rebuilding `packages/noodl-viewer-react`, you will measure D46's
*un-fixed* behaviour and file it as a product defect. **Rebuild first, then grep the bundle to prove
the fix is in it.**

⚠️ **What s43 did NOT establish.** The 14:39 bundle is overwritten and the path is gitignored
(`.gitignore:200`), so it has no history and cannot be rebuilt to prove it was broken. *"The old
bundle was bad"* is the surviving explanation, not a measured one — every source input was unchanged
and the result flipped, which leaves the build artefact as the only remaining variable. One green run
also does not disprove an intermittent fault. **If either drive reddens again, check the bundle mtime
before anything else.**

---

## ⚠️ Uncommitted work in the tree — read before you commit anything

The register `DEFECTS-THE-SITE-BUILDER-FOUND.md` currently carries **two sessions' rows**: the peer's
D46 fix row (s42) and this session's D47 closure (s43). **s43 deliberately did not commit it** —
a pathspec commit would have swept the peer's in-flight D46 prose into an unrelated message. Whoever
commits next is committing both; say so in the message.

Also uncommitted and load-bearing: `SseConnectionPool.ts` (untracked — `git add` it explicitly, a
pathspec commit skips untracked files silently), the three `noodl-runtime` realtime edits,
`sbr011-live-preview-drive.test.ts`, and phase 82's REL-002a edits to `text-input.ts` and
`render-from-disk.js`.

---

## 🔴 The register, re-derived

### [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46) — 🟡 FIXED s42, drive owed. Peer's lane
Shared SSE connection per backend. Unblocks SBR-011 AC3 and SBR-014 step 5. **Not in the built bundle
as of 21:28.**

### [D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47) — ✅ CLOSED s43
Both drives green; cause localised to the gitignored viewer bundle.

### [D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48) — 🔴 owner `NONE`. Seven tokens of MCP surface headroom
~28 characters. **The next clause added to any tool description breaks the gate**, and the gate's own
header says there must not be a third renegotiation. Already blocks a real thing: `create_plan`'s
description still says nothing about what must precede a plan. The row carries one measured,
**undriven** way to buy ~39 tokens back. ⚠️ Anything that widens a tool description is now a design
question, not an edit.

### [D45](DEFECTS-THE-SITE-BUILDER-FOUND.md#d45) — 🟡 half closed. The leak is fixed
`render-from-disk.js`'s proxy destroys its upstream when the downstream closes. Mutant-graded.

### [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) — nothing on a published page scrolls. Owner SBR-002
**Still the cheapest open control in the phase:** render `templates/members-area/` through the
**same** `withRenderedPage` and read the same four numbers. If it scrolls, D40 is the site-builder's
ground and SBR-002 owns a real defect. If it does not, D40 is `render-from-disk.js` and the row is
about the harness. ⚠️ It contradicts phase 81's VIB-001 (`unreachablePx: 0` on all 44 shots); two
instruments disagree and neither reading is safe to relay until one is re-derived. ⚠️ Phase 82's
REL-002a is editing exactly this.

### [D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43) — a refused list says "No pages yet". Owner `NONE`
`/Pages/Admin`'s `count` is still wired `true`; `sbr010Messages.test.ts` holds it as a measurement,
so a fix reddens the arm.

### [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) — the hero's scrim vs `colorOnPrimary`. Owner SBR-003
⚠️ A hypothesis with a named test. Nobody has rendered it.

---

## 🔴 The phase's end condition, unchanged

**SBR-014 is the gate on closing phase 77.** The distance to done is now **SBR-014 itself**, plus the
peer's owed D46 drive. 🔴 **That is the distance, not the length of the register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — D15. Phase 77 must not close pretending otherwise.

⚠️ **Richard still owes two looks**, and no session can substitute for them: whether the five section
kinds (SBR-005 AC1's second half) and the rebuilt theme editor (SBR-009 AC1) are worth *looking* at.
The SBR-005 pictures are in
`dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/sbr-005/2026-09-01/site-builder-living/`;
**no pictures exist of the theme editor, the Messages screen, or the live site updating** — SBR-014's
AC3 shot list is the cheap place to fix that.
