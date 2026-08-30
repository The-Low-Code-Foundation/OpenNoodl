# Phase 80 — next session

## State: **33 rows. 25 ✅ · 8 open, and both gates are now trustworthy.**

s24 closed **DEF-013**, **DEF-032** and **DEF-030** — the re-drive and the two instruments, in the
order the last handoff set. A P18 peer registered **DEF-033** mid-session, so the table grew by one
while the open count fell by three.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** This has bitten twice now:
s22's handoff said *"no workable open row left"* while the table held an open row appended 32
minutes earlier, and s24 found **DEF-033** in the table that no handoff mentioned. Summaries drift;
the table is the phase.

```
grep -E '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -v '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) is still the authority for
DEF-005, DEF-009 AC4, DEF-025 and DEF-007 §3.2 — captured, and still NOT built.** Two of those
rulings went **against** the recommendation put to Richard; a session that reads the verdict and not
the reason will rebuild the argument and get it wrong.

---

## The work, in the order it should be done

### 1. DEF-025 — flip at creation, in **both** doors *(next, and self-contained)*

Editor palette **and** MCP door author `useLabel: true` onto newly placed `Checkbox` /
`Radio Button`, `STARTER`-params shape. No existing rendering moves; nobody's checkbox suddenly
says **"Label"** — that consequence is what rules the blunt flip out, permanently.

⚠️ **Check s17's catalog-flip spec arm still holds** — the rule reads the effective default from the
catalog, so it should fall silent on unset ports with **no second edit**. That arm is also the only
thing that makes the authored-bag-only mutant killable.

### 2. DEF-009 AC4 — `rateLimit` defaults to `{ ratePerMinute: 60, burst: 30 }`

Matching `auth` on the ladder the product already has (oauth-start 20/20 · **auth 60/30** ·
admin 300/100 · data 1200/400). Per key.

🔴 **Changes behaviour for every existing public writing function, so it owes a corpus check before
it lands.** The sweep counted **27 unlimited public write doors across 23 projects, all
`submitContactForm`** — re-run it and confirm none legitimately bursts past 30. ⚠️ **Do not measure
the limiter by "the row did not appear"**: a refused write and a filtered read are the same shape.
⚠️ `burst: 0` / `ratePerMinute: 0` is the existing *unlimited* convention; the default must not
collide with it.

### 3. DEF-005 — both halves, and AC3 is what makes (a) safe

**(a)** read-only `roles` output on the `User` node via `SecurityState.rolesForUser`;
**(b)** a cloud `List Users In Role` node.

🔴 **The cloud-only rule on the role WRITES survives intact** — the load-bearing half of the ruling.
🔴 **AC3 is not optional**: a **negative control** asserting a user who edits the output client-side
is **still refused by the server**. Assert the refusal, not just the read, and **beside a
known-firing signal** — *"refused"* and *"never requested"* are identical readings with opposite
fixes. ⚠️ Both are a port and a node — **neither owes the UNI-001 four sweeps.**

### 4. DEF-029 and DEF-031 — the two missing capabilities

Both are *a missing capability, not a missing wire*, and both were measured with known-firing
controls that earned their place.

- **DEF-029** (P77 D15) — no file-drop anything: `onDrop`/`dataTransfer`/`dragover`/`dragenter` =
  **0** against a **39**-hit `onClick` control. SBR-007 AC3 is not authorable as written.
- **DEF-031** (P77 D22) — no `text-overflow` port: **0** hits, against `wordBreak` = 2 (a `Text`
  `inputCss` port that DOES exist) and 11 files carrying `inputCss` — the mechanism a new port
  would use.

### 5. DEF-028 — build determinism

P77 D13. The export health filter races the viewer's dynamic-port announcement, so **what a build
contains depends on when it was taken.** ⚠️ **SBR-008's fix removed the `prop-` family from the
filter's reach and left the filter unchanged** — every other dynamic-port family is still exposed.
🔴 **Do not read SBR-008's green specs as evidence**: they call `setup()` and read what it
announces; the debounced pass is not in them.

### 6. DEF-007 §3.2 — the template writes explicit values *(still last, and the reason got stronger)*

Drive the **56 disagreements across 13 components** to zero by making template generation write the
values — phase 78 D14's choice, cheaper and narrower than teaching four packages to apply migrations.

⚠️ **`site-builder.content.json` is phase 77's live lane, and s24 watched them hold `TASKS.md` and
`SBR-006` uncommitted for the whole session.** ✅ `git log -5 --` on that file and check its mtime
**before starting**; coordinate rather than race.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together; either alone is the state the task exists to distinguish. **The byte gate
cannot help**: it compares the artefact to a fresh run of the same generator, so a field neither
side writes is a field both sides "agree" about. It passed over D9 exactly this way.

### 7. DEF-033 — a peer's row, not phase 80's to build blind

`Substring`'s panel says `End = 0` and the node behaves as `End = -1`. Registered by the **P18**
lane at `6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with
that lane before building it.

### 8. The five unowned rows that need measuring

See [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — `publishPage`'s ordering, the shared
backend that dies on a second deploy, the backend card that never looks again, `Record.Fetched`
firing on a bind, and the `domelement` port that cannot reach its own description.

**Measure one fully before starting the next.** A row that measures true gets a `DEF-0xx` id
(`DEF-034`+ are free now) and a person's sentence, or it is not a row. ✅ **Keep the disproved ones,
marked.**

---

## Owed elsewhere, by this session's work

- 🔴 **P77 D33 — the six unconfirmed same-collection writes on `/Pages/ThemeEditor`.** Registered
  by DEF-032, **owed a drive**: watch for `[runtime/cyclic-loop]` and count `SetDbModelProperties`
  writes on an idle theme editor. The census is asserted exactly, so a **seventh** cannot appear
  quietly — but the six themselves are still unmeasured.
- 🔴 **P77 owns `/Pages/ThemeEditor`'s appearance debt**, put on §4's floor by name by DEF-030.
- ⚠️ **`create_component` still cannot author a cycle in one pass.** DEF-013's fix is the plan door
  only — the ruling's named and accepted weakness. The two-pass workaround stands and is graded.

## Traps carried

- 🔴 **An arm that cannot fail is not a gate, and only a mutant says so.** DEF-013's SCOPE arm was
  written as an exploratory probe asserting `expect(typeof x.isError).toBe('boolean')`, survived its
  own mutant, and read green while the door refused. ✅ **Run the mutant before believing the arm.**
- 🔴 **A control can be "refused" for the wrong reason.** DEF-013's first run had *every* arm
  refused — by argument-schema validation, because the tool takes `plan_id`/`operation_id` and
  `fromId`/`toId`, not the camelCase guessed. Both controls were green while the rule under test had
  never been reached. ✅ **Assert the diagnostic CODE, and assert the absence of a schema error.**
- 🔴 **A `continue` at the top of a pass is a coverage question, not a style one.** DEF-032's whole
  finding was the `1`. ✅ **When you write a new pass, count what IT reaches too** — the first
  version of DEF-032's own repair reached 1 of 65 and had to be widened to 29.
- 🔴 **A shared fixture that mutant arms `delete` from will leak.** `migrationProject()`
  shallow-spread its nodes, so `parameters` was the same object as the module-level artefact's; a
  mutant's damage outlived its test and a later fresh call came back already broken. ✅ **Copy in the
  fixture factory, not in the arm.**
- 🔴 **A stale floor goes GENEROUS, and a floor entry can name nothing at all.** hello-world's
  allowance was `/Home` for a page called `/#__page__/Home`. ✅ **Assert equality, and assert that
  every floor entry names a real row.**
- 🔴 **`git status` shows a peer's lane, not yours.** A P18 commit landed mid-session adding a row
  to *this phase's* table. ✅ **Re-derive the board from the table at the END, not from your memory
  of it at the start.**
- 🔴 **Make the peer-check its own tool call and READ it before starting a suite** — s23 paid a
  BLD-004 flake for bundling them; s24 did not.
- 🔴 **A drive serves a BUILT bundle.** `render-report.js` serves the **gitignored**
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js`; a `noodl-viewer-react/src` change is
  invisible until `cd packages/noodl-viewer-react && npx webpack --config
  webpack-configs/webpack.viewer.prod.js` (~40s). Shared and mutable on this checkout — check for a
  running drive before rebuilding.
- 🔴 **D-numbers COLLIDE across registers.** P77 and P78 both have a `D22`, a `D25`, a `D32`.
  Qualify with the register, or grep the anchor form `DEFECTS-THE-SITE-BUILDER-FOUND.md#d32`.
- 🔴 **A pathspec commit sweeps a sibling's unstaged edit.** Commit by explicit pathspec, never
  `git add -A`; `git add` untracked files individually first.
