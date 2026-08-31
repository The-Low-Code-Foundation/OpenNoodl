# Phase 80 — next session

## State: **33 rows. 28 ✅ · 5 open.**

s27 closed **DEF-005**, both halves, the row the last handoff put first. Richard's ruling built as
ruled. Commit `ab677258`. AC5 is outstanding and was **never the acceptance** — see below.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Fifth time this is worth
saying: s22's handoff said "no workable open row left" while the table held one, s24 found DEF-033
that no handoff mentioned, and both s25 and s27 watched a peer commit mid-session.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) is now the authority for
DEF-007 §3.2 only.** DEF-005, DEF-009 AC4 and DEF-025 are built and their ruling sections read as
history. The remaining one went **against** the recommendation put to Richard; read the reason, not
just the verdict.

---

## The lesson s27 paid for, and it is about what a test proves

🔴 **A mutation can pass for the RIGHT reason, and that is a finding, not a null result.**

DEF-005 AC3's whole point is that a client rewriting its own `roles` is still refused. Deleting the
server's `delete body.roles` reddened the row that grades the *strip* and **left the row that grades
the refusal green**. The instinct is to call the refusal row weak. It is the opposite: the
escalation is impossible *architecturally* — enforcement resolves membership from the junction and
has never read a `_User` column — so the strip is **hygiene, not the defence**.

✅ **When a mutant fails to redden a row, ask whether the row was measuring something the mutant
cannot reach, before assuming the row is vacuous.** Both readings were available and only one was
true; the test file now says which.

⚠️ And the sibling trap: **`/users/me` could not grade the strip at all.** The resolved value is
spread last, so a stored `roles` column is invisible in the response either way — *stripped* and
*stored but shadowed* read identically there. `GET /admin/schema/_User` distinguishes them, and that
row carries its own known-firing control (the same PUT also sent `nickname`, which **did** land).

---

## The work, in the order it should be done

### 1. DEF-029 and DEF-031 — the two missing capabilities

Both are *a missing capability, not a missing wire*, both already measured with known-firing
controls. Cheapest real rows on the board.

- **DEF-029** (P77 D15) — no file-drop anything: `onDrop`/`dataTransfer`/`dragover`/`dragenter` =
  **0** against a **39**-hit `onClick` control. SBR-007 AC3 is not authorable as written.
- **DEF-031** (P77 D22) — no `text-overflow` port: **0** hits, against `wordBreak` = 2 and 11 files
  carrying `inputCss` — the mechanism a new port would use.

⚠️ **Re-measure both with `grep -a`.** This repo's `grep` is ugrep with `-I` and it skips source
files as binary **silently**; a `0` measured without `-a` is not a zero.

### 2. DEF-028 — build determinism

P77 D13. The export health filter races the viewer's dynamic-port announcement, so **what a build
contains depends on when it was taken.** ⚠️ **SBR-008's fix removed the `prop-` family from the
filter's reach and left the filter unchanged** — every other dynamic-port family is still exposed.
🔴 **Do not read SBR-008's green specs as evidence**: they call `setup()` and read what it
announces; the debounced pass is not in them.

### 3. DEF-007 §3.2 — the template writes explicit values

Drive the **56 disagreements across 13 components** to zero by making template generation write the
values — phase 78 D14's choice, cheaper and narrower than teaching four packages to apply migrations.

⚠️ **`site-builder.content.json` is phase 77's live lane and that lane is ACTIVE.** ✅ `git log -5 --`
on that file and check its mtime **before starting**; coordinate rather than race.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together; either alone is the state the task exists to distinguish. **The byte gate
cannot help**: it compares the artefact to a fresh run of the same generator, so a field neither
side writes is a field both sides "agree" about. It passed over D9 exactly this way.

### 4. DEF-033 — a peer's row, not phase 80's to build blind

`Substring`'s panel says `End = 0` and the node behaves as `End = -1`. Registered by the **P18**
lane at `6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with
that lane before building it.

### 5. The unowned rows that need measuring

See [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — **six**: `publishPage`'s ordering,
the shared backend that dies on a second deploy, the backend card that never looks again,
`Record.Fetched` firing on a bind, the `domelement` port that cannot reach its own description, and
the drag door that skips STYLE-002's defaults entirely (measured from source, **not driven** — that
drive is what the row owes).

**Measure one fully before starting the next.** A row that measures true gets a `DEF-0xx` id
(`DEF-034`+ are free) and a person's sentence, or it is not a row. ✅ **Keep the disproved ones,
marked.**

---

## Owed elsewhere

- 🔴 **DEF-005 AC5 — TPL-001's member list.** Explicitly *"evidence, not the acceptance"*, so the row
  is closed without it, and the **capability it would demonstrate is graded directly** by
  `def005-membership.test.ts`. What is missing is the demonstration. Whoever picks it up owes
  `nodegx-backend/tests/helpers/members-drive.ts` a roster page built on `List Users In Role` and
  nothing else. ⚠️ It edits `templates/members-area/`, another lane's artefact — check mtimes first.
- ⚠️ **DEF-005's `Roles` output is undriven in a real editor.** Graded end to end over real HTTP and
  at the port, but nobody has watched it appear in a running editor's property panel. 🔴 A drive
  serves a **built bundle** — rebuild first.
- ⚠️ **DEF-009's default is undriven in a real editor.** Nobody has watched the boot line appear in a
  running backend's log, and that is the surface an operator meets. Cheap: start a backend over a
  bundle with a public writing function and read `ratelimit.public-write-default`.
- ⚠️ **DEF-025's editor half is undriven.** Owed: place a Checkbox from the node picker and drag one
  from the library, and observe both arrive with the Label port visible in the property panel.
- 🔴 **P77 D33 — the six unconfirmed same-collection writes on `/Pages/ThemeEditor`.** Registered by
  DEF-032, **owed a drive**: watch for `[runtime/cyclic-loop]` and count `SetDbModelProperties`
  writes on an idle theme editor.
- 🔴 **P77 owns `/Pages/ThemeEditor`'s appearance debt**, put on §4's floor by name by DEF-030.
- ⚠️ **`create_component` still cannot author a cycle in one pass.** DEF-013's fix is the plan door
  only — the ruling's named and accepted weakness.
- ⚠️ **Four MCP/editor spec comments say "175 built-ins"; the catalog is now 176.** Prose in other
  lanes' files, asserting nothing. Left alone rather than churned — noted so the next reader does
  not re-measure it as a defect.

---

## Traps carried

- 🔴 **A new node type owes THREE artefacts, and a gate names each.** `npm run catalog:generate`
  (then `--check`), **and** `npm run catalog:merge` — whose `--require-coverage` gate is what caught
  the missing `docs/node-catalog/enrichment/<typeName>.json`. Also
  `noodl-runtime/src/nodelibraryexport.ts`'s picker group, which no gate checks at all.
  ✅ **Generate to `--out-dir` and diff FIRST**: the generator folds in every uncommitted node-source
  edit in the tree, so an in-place run on a shared checkout can publish a peer's work as yours.
- 🔴 **`RECORD_WRITE_NODE_TYPES` exists TWICE** — `noodl-editor/…/validation/publicWriteDoor.ts` and
  `nodegx-backend/…/workflow/functionDeclarations.ts` — in packages that cannot import each other.
  Held equal by `def009-public-write-default.test.ts`. **If you edit one, that spec tells you the
  other did not follow.**
- 🔴 **A declared default never runs its setter (DEF-033).** `List Users In Role`'s `Limit` default
  lives in `SystemRoles.members`, not on the port, for exactly this reason — and a Request parameter
  arrives as a **string**, so the backend parses both.
- 🔴 **`grep` here is ugrep with `-I` and skips source files as binary, SILENTLY.** ✅ **Use
  `grep -a` for everything**; treat any absence measured without it as unmeasured. ⚠️ And in zsh,
  `--include=*.ts` needs quoting, and **`${PIPESTATUS[0]}` is wrong** — zsh arrays are 1-based, so it
  prints empty and an exit code reads as absent rather than zero. Prefer `cmd > log 2>&1; echo $?`.
- 🔴 **A python heredoc anchor that "obviously matches" may not.** ✅ **Anchor on the fewest lines
  that are unique, and assert `count(anchor) == 1` rather than `in`.** Every edit this session went
  through that shape and none of them landed wrong.
- 🔴 **The Bash tool's cwd resets after some failures.** It happened again in s27. ✅ **Absolute
  paths, or re-`cd` in the same command.**
- 🔴 **`noodl-editor` has no `jest.config.unit.js`** — it is `jest.config.js`, and naming the wrong
  one fails with *"Can't find a root directory"*, which reads like a missing package.
- 🔴 **ts-jest typechecks these test dirs, so a type error is `Tests: 0 total`, not a red row.**
  `OutputPropertyLike` has `.value` and **no `.getter`**; reading an output port's value in a
  `noodl-runtime` corpus spec is `.value`.
- ⚠️ **`nodegx-backend`'s jest maps `@cloud-runtime` to `noodl-viewer-cloud/src`**, so a new cloud
  node is testable with **no build**. The deployed service bundles from `src` too. No stale-`dist`
  hazard in this lane.
- 🔴 **`npx tsc --noEmit -p tsconfig.tests.json` in `nodegx-backend` does not finish inside a
  5-minute tool timeout.** `tsconfig.json` (src only) is ~20s. **The jest run is the typecheck** for
  tests here, same as the editor's.
- 🔴 **A pathspec commit sweeps a sibling's unstaged edit.** Commit by explicit pathspec, never
  `git add -A`; `git add` untracked files individually first.
- 🔴 **D-numbers COLLIDE across registers.** P77 and P78 both have a `D22`, a `D25`, a `D32`.
  Qualify with the register.
- 🔴 **Two phases have a `TASKS.md` AND an `UNOWNED-ROWS-TO-MEASURE.md`.** A bare filename in a log
  is ambiguous — qualify it with the phase.
- 🔴 **Make the peer-check its own tool call and READ it before starting a suite** — and it goes
  stale. s27's checkout was quiet at the start and a phase-81 peer landed two commits mid-session.
- 🔴 **A drive serves a BUILT bundle.** `render-report.js` serves the **gitignored**
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js`; a `noodl-viewer-react/src` change is
  invisible until `cd packages/noodl-viewer-react && npx webpack --config
  webpack-configs/webpack.viewer.prod.js` (~40s).
