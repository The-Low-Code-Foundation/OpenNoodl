# Phase 80 — next session

## State: **no workable open row left.** DEF-001–004, 006, 008, 010, 011, 014–024, 026 closed. DEF-007/009/012/025 🟡 partial; DEF-005/013 🧭 await rulings.

**s21 (2026-08-30) closed DEF-024** — and the design ruling the queue expected was never needed.
Re-driving the reading first found the register's mechanism claim false when written: **`Switch`
has been the two-way gate shape all along** (`On`/`Off` in, `Current State` pushed on every
change), and `Condition.result` itself pushes `false` on a false test. The one-way thing is the
AUTHORED latch (constant `condition: true`, Evaluate-pulsed). So the fix was guidance, not a
primitive:

- **`gate-only-turns-on`** (`oneWayGate.ts`, advisory, both doors): every writer into a
  `mounted`/`visible` is a constant-condition Condition and the pushable set is exactly `{true}`.
  Paired-clear workaround, Switch shape, mixed writers, wired conditions: all silent/abstained.
  One-way dismiss (`{false}`) not fired on, by decision — corpus holds 1.
- **Driven at HEAD first** (`def024-gate-drive.test.ts`, real door + real Chrome):
  tick-then-untick leaves BOTH notices in the latch arm, exactly one in the Switch arm.
- **Corpus** (`npm run calibrate:gates`, 178 projects): 3,287 written gate ports, 3,211 abstain,
  **75 firings, all true, zero false positives read**. 12 specs; 7 mutants, each killed by its
  own arm.
- **Descriptions**: `Condition.result` and `Switch.state` now name the two-way shape; catalog
  regenerated and merged.

## What s21's calibration found for OTHER phases (filed, not fixed)

- **P77 D29 (their register, appended)**: the embedded site-builder template ships the latch —
  `/Site/ContactForm`'s confirmation AND refusal (a failed-then-successful send shows both) plus
  2 `/Pages/Setup` refusals. Verified in `site-builder.content.json` at HEAD, read-only. Their
  active lane; do not fix from here.
- **P78 D36 section (updated in place)**: the shipped `templates/members-area/` still carries
  **12 one-way latches** — s15's workaround covered `Pages/Account` only (Join's
  received/refusal pair, Post's two confirmations, SignIn, Setup, Announcement/Meeting,
  Unsubscribe). Template work, T6 family, behind Richard's T5 like the rest of P78.

## What to do next

- **DEF-012 §2 leftover** — the honest candidate is written in s15's section: a DEF-002-family
  door precondition on cloud queries with connected filter params and run-on-change boxes on
  (265/270 at the default, 78 cloud). Buildable without a ruling; SB-011 §5 has the numbers.
- **DEF-007 §3.2** — still 56 decisions on `site-builder.content.json`, still sequenced behind
  phase 77's active file. Do not start while P77 is mid-flight there.
- **🧭 Richard queue** (unchanged): DEF-025 flip (3 options in TASKS.md s17) · DEF-009 AC4
  (rateLimit default) · DEF-005, DEF-013 rulings (re-drive SB-012 §1 at HEAD before spending
  DEF-013's — the door's `components` now overlays unapplied plan ops).
- If none of those is workable, the phase may be at its natural end: consider a closing sweep
  (README's grading criteria vs the table) rather than inventing rows.

## Traps carried

- ⚠️ **dist staleness (standing)**: a *running* MCP server answers without `gate-only-turns-on`
  (and 018–023/026's codes) until rebuilt; the editor's `cloudruntime/sandbox.viewer.bundle.js`
  half stands. The external viewer bundle was fresh as of s20 and s21 did not touch runtime
  behaviour (descriptions only).
- ⚠️ **Editor floor: 6442/6447, 5 reds, none phase 80's**: sb-007 ×2 (template-count lane) +
  sb-018 ×2 (P77 drag lane, DropAt/DropIndex, same as s20) + **bld-004 `reasoningChannel` ×1 —
  a parallel-load FLAKE of the stall-guard timer: red in two full runs, 8/8 alone.** A lone red
  is a flake until re-run alone.
- 🔴 **A full-suite run piped to `tail` loses the failure names** — redirect the whole run to a
  file, then grep `^FAIL` / `●`.
- 🔴 **`git checkout -- <file>` is not a mutant undo** — python string-swap restores only.
- ⚠️ **`grep` refused `HttpServer.ts` as binary (s18)** — `-a` on any grep over
  `nodegx-backend/src/server/`.

## Gates (s21, commit pending — see TASKS.md s21 for detail)

editor jest **6442/6447** (5 reds named above, none mine; +12 = oneWayGate specs) · noodl-mcp,
noodl-runtime, typechecks, catalog gates, `test:ci`: recorded in TASKS.md s21 once the session's
final runs land — trust the readouts there over this file if they disagree.
