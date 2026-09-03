# Next session — §48 built `CSS Definition` + the CSS Class fold + the `Date` column + four missing control-mint families; gated, 15/15 arms, driven 44/44 + a sabotage control (23 diffs, all predicted cells); picker 89 → 90/127

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 76 ran every gate alone (the full suite in
the background while only files were written; arms sequential; the drive after the arms) and tore
Chrome, the preview and the backend down in a `trap` (0 listeners, twice). A peer's webpack watch
was running throughout — left alone. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0`; a peer's EXP-001 rows still uncommitted (theirs) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 97 translated |
| EXP-009 backend connection | 🟢 AC4 driven (§42); §48 changed the client (the Date unwrap) — golden + target doc updated |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **90/127 committed** — §48 `CSS Definition`; the ledger cannot see the three other things §48 changed on every page (class names, Date columns, four handler-argument readers) |
| EXP-012 | 🟢 |

## What session 76 did (EXP-011 §48)

1. **Ranked honestly.** The handoff's Data-bucket names (`Action Dispatcher`/`Handler`, `Repeater
   Item`) are "not a target" by §3/§7.3 — the ledger's exemption wins over a handoff line. `Sign
   In With` needs a provider and a product decision. So: the smallest *scheduled* node, and the
   two registered debts.
2. **`CSS Definition`** = a module constant (verbatim, three escapes) + a mount effect that
   appends a `<style>` and removes it — css-definition.ts's own two methods. Wired Style refused
   by name; empty Style static. **The authored CSS Class** on every visual node (dropped with a
   note since EXP-002) now joins `className` after the module class; the collapsed Group's lands
   on the page div.
3. **The `Date` column**: `tsColumnType('Date') → Date`; the client's `fromWire` unwraps
   `{ __type: 'Date', iso }` on every field (shape-based); Text prints `String(date)` (the
   runtime's own cast); date nodes read it bare; a `Now` writes it.
4. **The two Global Store debts** — and a four-case probe (`probe48.ts`) found **`Set Variable`,
   `Cloud Function` and `Event Sender`** dropping a text input read from a button with the same
   sentence. All four on the clause; the write-through exception (an input's OWN change firing
   the sink) spelled out after the first emit broke the NAMED-STORES golden.
5. Fixture `tests/fixtures/due-desk`; specs `css-definition.test.ts` (15), `date-column.test.ts`
   (12), six rows in `global-store.test.ts`; A5/B10/D6 and the EXP-009 client golden re-sentenced.
6. Gates alone: tsc 0; suite 60 files 1684 (1681 first, the two consequences fixed, re-run 52/52);
   ledger OK; picker 90, floor 90. **15/15 arms** (O took three arms — twice only tsc killed it).
   **Drive 44/44**, VERIFY OK; **control 21/44, 23 diffs, exactly the style and Date cells**.
7. Committed by pathspec.

## 🔴 Do this next — BUILD

By the product surface (`node scripts/export-ledger/picker-coverage.js`), the scheduled rows left:
- **`States` + `Animate To Value`** (Tier 3.8) — the one Richard-era ruling says "worth doing
  properly rather than early"; a full session: a `useStates`-shaped hook or a `src/lib/animate.ts`
  transcription of the runtime's tween, read the runtime files first.
- **`Sign In With`** if provider sign-in is wanted — the client's return leg (`_consumeAuthReturn`).
- **The component stack pair** (`Push Component To Stack` / `Pop Component Stack` / `Component
  Stack`) — §16.2 already says what it is not (not a route).
- **`Script`** — arbitrary code; today its source is preserved as a comment (§28).
- Small: HTTP Request's body on the control-mint clause (§48.6, unmeasured); the Date/String
  argument wrap (§48.3).

Same shape as §41–§48: runtime file first, `EXPECTEDnn.md` before any run, refusals by name, a
fixture on disk, the arms, the drive with a `trap` teardown, commit by pathspec.

## Open residuals (registered, none blocks an AC)

- §48.6: HTTP body unmeasured on the clause; Date↔String column writes loud not wrapped; wired
  `style`/`cssClassName` refused by name; `exprTsType` answers `Date` only for a record column.
- §47.3 / §46.6 / §45.3 / §44.3 / §43.3 / §41.3 unchanged, minus the two §47.3 Global Store rows
  (closed by §48).

## The numbers (last honest readings, s76)

```
packages/nodegx-export: tsc 0 · jest 60 files, 1684 rows (1681 first run; the 2 consequence files 52/52 after) · 15/15 arms
export-ledger:check OK — 176 types, 97 translated · picker 90/127 (70.9%), floor 90, --check exit 0
drive run1: 44/44 cells (EXPECTED48.md), consoleErrors [], VERIFY OK, 0 listeners · control: 21/44, 23 diffs = every style + Date cell
```

## Instruments (s76 scratchpad `fa23653b-c340-4c81-9ed1-f837bc93c26e/scratchpad`)

`EXPECTED48.md`, `mkfixture48.js`, `probe48.ts` (the four-sink control-mint probe — reuse it for
HTTP), `emit48-before/` (the reverted arm), `mut48.py` / `runmut48.sh` / `mut48-summary*.txt`,
`arm48-*-{tsc,jest}.log`, `drive48.mjs` / `control48.mjs` / `drive48-run.sh` / `arm48-ctl.sh`,
`drive48-run1.log` + `drive48-ctl.log` (+ `.drive.log`), `harness48/` (node_modules → s70's
`harness43`), `jest-full-s76-1.log`, `*.before` source snapshots.

## 🔴 What session 76 would tell you if it could only say three things

1. **A true sentence can hide the plainest idiom for the life of a clause.** "The action reads
   values that only exist in another handler" was correct for a text input → `Set Variable` ←
   button since s19, and every fixture happened to write from the input's own change. The probe
   over one fixture and every sink is the instrument; run it again for HTTP.
2. **A handoff can outrank a ruling only if you let it.** The Data-bucket names were "not a
   target" in the ledger; the ledger's exemption sentence is the decision, the handoff is a note.
3. **A mutant tsc kills is not killed, and it can take three arms to find one jest can see.**
   Narrowing turned two arms into TS2367; the third flipped a value, not a type.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked
before a pathspec commit or they are skipped silently); delete probe specs before committing;
reconcile the suite count against disk (60); `grep -a`; absolute paths; **`vm_stat` + `ps` before
any suite, never more than one of mine, tear servers down in a `trap`.**
