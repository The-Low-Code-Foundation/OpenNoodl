# Next session — 84/127 committed: §44 `Set User Properties` + `Request Magic Link` built, gated, mutated (12 arms), driven 63/63 and committed; next is the files trio or the two refusals

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 72 ran every gate alone (`vm_stat` before
each), the drive runner tore its three servers down in a `trap`, the arms ran in the background
with nothing beside them. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0`; a peer's EXP-001 + README rows still uncommitted (theirs) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 91 translated |
| EXP-009 backend connection | 🟢 AC4 driven (§42); `request()` wraps network failure (s71) |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **84/127 committed** — §44 complete |
| EXP-012 | 🟢 |

## What session 72 did (EXP-011 §44)

1. **Built** the two session verbs on the user family's `api-call`: `USER_VERBS` +2 rows (a named
   `UserVerb` union replaces three spelled-out unions), `TRIGGER_PORTS`, the control-mint
   predicate (columns mint state), `compileUserOp` (family-wide `Backend` gate, `prop-*` columns
   the record verbs' way, per-verb args with the redirect omitted when unfed, `clearErrorOnDone`),
   `SessionCallPlan.writes`; emitter: the clear line; `emitApp`: `UserProperties` **type**,
   `setUserProperties`/`requestMagicLink`, client `updateUserRequest` (refuses `Nobody is signed
   in.` before any request, blank keeps for username/email, PUT, session rewritten) and
   `requestMagicLinkRequest` (+ `currentUrlWithoutAuthParams`). Golden diff = exactly those.
2. **Two defects the build found:** the mint predicate enumerated the family by `spec.inputs`
   (the column input rendered stateless, Save dropped); an `interface` is not assignable to
   `Record<string, unknown>` — only the fixture's whole-app typecheck said so.
3. **Fixture** `tests/fixtures/account-desk` (Log In, User, both verbs on one page — nothing
   refused). **Spec** `tests/set-user-properties-magic-link.test.ts`, 24 rows.
4. **Gates one at a time:** tsc 0; 24/24; suite 55 files 1486/1486; editor tsc 0; ledger OK;
   picker 84 (floor raised). **Twelve arms, all kill** (A7 B10 C1 D1 E1 F3 G3 H2 I4 J3 K5 L3).
5. **Drive** (`EXPECTED44.md` first): run 1 63 cells / 4 diffs — all four my seed's probe (+1
   on every count) and a verify logging in under the pre-rename name; run 2 **63/63, 0 diffs**,
   verify reads `alicia` + `nickname: Zed` + email untouched. Two memories written.
6. Committed by pathspec (README left to its peer).

## 🔴 Do this next — BUILD (the defect farm is empty; §44 was one session, build-to-commit)

Five Cloud Services left. Rank by the product surface, not the corpus (0 for all five):
- **Files trio** — `Upload File` (needs `Open File Picker`, untranslated: a `<input type=file>`
  and a click), `Cloud File` and `Sign File URL` (a `CloudFile` value type: `{ name, url }` on
  the wire). Probably one session together; check the backend's `/files` routes first
  (`HttpServer.ts`, `security.json` `files.upload: authenticated`).
- **Two refusals by name** — `Sign In With` (full-page redirect; the return leg is the client's
  constructor, `_consumeAuthReturn`) and `Subscribe To Changes` (SSE; §43.1's pub/sub). A
  refusal row each with the sentence naming the mechanism, and the ledger exemption saying
  which kind of "not yet" it is (`check.js` enforces the shape).

Same shape as §41–§44: the runtime file first, the expected answers written before any run, the
toll table, refusals by name, a fixture on disk, the arms, the drive with a `trap` teardown,
then commit by pathspec.

## Open residuals (registered, none blocks an AC)

- §44.3: `ParseAuthAdapter.setUserProperties` copies `undefined` email/username into the stored
  session (`Object.assign`) — owner NONE, read not measured.
- §44.6: Sign Up's §5.5 gate could lift on `UserProperties`.
- §43.3: the wired Record's row is kept on an Id change. §41.3: `x-noodl-cloud-version`.
- `EXP-009-CLIENT-TARGET-OUTPUT.md` describes the client without the wrap or the two new
  functions; the golden is truth.

## The numbers (last honest readings, s72)

```
packages/nodegx-export: tsc 0 · jest 55 files, 1486/1486, exit 0 (72 s) · 12/12 arms kill
noodl-editor tsc: 0
export-ledger:check OK — 176 types, 91 translated · picker 84/127 (66.1%), floor 84
drive: 63/63 cells (EXPECTED44.md), 0 listeners left after teardown
```

## Instruments (s72 scratchpad `423323ce-cd60-41e8-add7-91a9a36731fe/scratchpad`)

`EXPECTED44.md`, `control44.mjs` (seed / verify / probe), `drive44.mjs` (prints the snapshot
before every `until`; restarts the backend itself at D9), `drive44-run.sh` (emit → build →
backend → seed → Chrome → preview → drive → verify → trap teardown), `drive44.log` + `*-run1.log`
(the control), `backend44.log` (per-request, with principals), `mut44.py`/`runmut44.sh`/
`mut44-summary.txt`, `arm44-*-{tsc,jest}.log`, `jest-full-s72.log`, `editor-tsc-s72.log`,
`harness44/` (node_modules symlinked to s70's `harness43`), `backend-data44/`, `probe44.ts`.

## 🔴 What session 72 would tell you if it could only say three things

1. **Count the instrument.** Every diff in run 1 was my own probe; the backend's per-request log
   named it by principal. Preserve run 1, then re-run — run 2 is a control, not a retry.
2. **A post-drive control must read the state the drive LEAVES.** The 404 was the rename working.
3. **The whole-app typecheck row grades what no substring can** — it found the `interface`, and
   arm K shows it is the only row that would.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked
before a pathspec commit or they are skipped silently); delete probe specs before committing;
reconcile the suite count against disk (55); `grep -a`; absolute paths; **`vm_stat` + `ps`
before any suite, never more than one of mine, tear servers down in a `trap`.**
