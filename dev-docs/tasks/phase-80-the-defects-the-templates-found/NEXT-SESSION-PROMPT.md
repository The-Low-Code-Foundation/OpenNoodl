# Phase 80 — next session

## State: **33 rows. 26 ✅ · 7 open.**

s25 closed **DEF-025**, the row the last handoff put first. Richard's ruling built in both doors,
plus the repair the ruling did not anticipate (see below). Nothing else moved.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Third time this is worth
saying: s22's handoff said "no workable open row left" while the table held one, s24 found DEF-033
that no handoff mentioned, and s25 watched a phase 77 peer commit mid-session. Summaries drift; the
table is the phase.

```
grep -E '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -v '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) is still the authority for
DEF-005, DEF-009 AC4 and DEF-007 §3.2** — captured, still NOT built. DEF-025 is now built and its
ruling section can be read as history. Two of the remaining rulings went **against** the
recommendation put to Richard; read the reason, not just the verdict.

---

## The lesson s25 paid for, which the next ruled row may repeat

🔴 **A ruling can be right and still not know what it costs.** DEF-025's ruling reasoned that
flipping at creation is inert — it moves no existing rendering, so nothing else changes. It was not
inert: `label-not-a-click-target` skipped any control whose **effective** `useLabel` was true, which
after the flip describes every newly created toggle. The advisory rule s17 shipped would have gone
silent on exactly the population the fix creates.

**Measured, not argued** — the flip applied to two real findings in `fb020-drive`:
`2 findings → 0 (rule as shipped) → 2 (rule repaired)`.

✅ **Before building a ruled row, ask what ELSE reads the field you are about to write**, and run
the reader both ways. A grep for the parameter name would have found it in a minute; reasoning
about the ruling would not have.

⚠️ And the discriminator that let the repair land **without** breaking s17's catalog-flip arm is
`authored === true`, not `effective === true`. Mutant M4 proves it: widening it kills that arm and
nothing else.

---

## The work, in the order it should be done

### 1. DEF-009 AC4 — `rateLimit` defaults to `{ ratePerMinute: 60, burst: 30 }`

Matching `auth` on the ladder the product already has (oauth-start 20/20 · **auth 60/30** ·
admin 300/100 · data 1200/400). Per key.

🔴 **Changes behaviour for every existing public writing function, so it owes a corpus check before
it lands.** The sweep counted **27 unlimited public write doors across 23 projects, all
`submitContactForm`** — re-run it and confirm none legitimately bursts past 30. ⚠️ **Do not measure
the limiter by "the row did not appear"**: a refused write and a filtered read are the same shape.
⚠️ `burst: 0` / `ratePerMinute: 0` is the existing *unlimited* convention; the default must not
collide with it.

⚠️ **Record the corpus command in the task file.** s25 could not reproduce s17's `calibrate:labels`
population — 178 projects / 186 toggles, invocation never written down — and had to measure a
different one (233 roots / 77 toggles) and say so. A number without its command is not comparable.

### 2. DEF-005 — both halves, and AC3 is what makes (a) safe

**(a)** read-only `roles` output on the `User` node via `SecurityState.rolesForUser`;
**(b)** a cloud `List Users In Role` node.

🔴 **The cloud-only rule on the role WRITES survives intact** — the load-bearing half of the ruling.
🔴 **AC3 is not optional**: a **negative control** asserting a user who edits the output client-side
is **still refused by the server**. Assert the refusal, not just the read, and **beside a
known-firing signal** — *"refused"* and *"never requested"* are identical readings with opposite
fixes. ⚠️ Both are a port and a node — **neither owes the UNI-001 four sweeps.**

### 3. DEF-029 and DEF-031 — the two missing capabilities

Both are *a missing capability, not a missing wire*, both measured with known-firing controls.

- **DEF-029** (P77 D15) — no file-drop anything: `onDrop`/`dataTransfer`/`dragover`/`dragenter` =
  **0** against a **39**-hit `onClick` control. SBR-007 AC3 is not authorable as written.
- **DEF-031** (P77 D22) — no `text-overflow` port: **0** hits, against `wordBreak` = 2 and 11 files
  carrying `inputCss` — the mechanism a new port would use.

⚠️ **Re-measure both with `grep -a`.** This repo's `grep` is ugrep with `-I` and it skips source
files as binary **silently** — s25's first sweep for `applyDefaults` returned a call-site list that
looked complete and was missing files. A `0` measured without `-a` is not a zero.

### 4. DEF-028 — build determinism

P77 D13. The export health filter races the viewer's dynamic-port announcement, so **what a build
contains depends on when it was taken.** ⚠️ **SBR-008's fix removed the `prop-` family from the
filter's reach and left the filter unchanged** — every other dynamic-port family is still exposed.
🔴 **Do not read SBR-008's green specs as evidence**: they call `setup()` and read what it
announces; the debounced pass is not in them.

### 5. DEF-007 §3.2 — the template writes explicit values

Drive the **56 disagreements across 13 components** to zero by making template generation write the
values — phase 78 D14's choice, cheaper and narrower than teaching four packages to apply migrations.

⚠️ **`site-builder.content.json` is phase 77's live lane and that lane is ACTIVE** — they landed
`420994d3` (SBR-015 AC4) *during s25's test:ci run*. ✅ `git log -5 --` on that file and check its
mtime **before starting**; coordinate rather than race.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together; either alone is the state the task exists to distinguish. **The byte gate
cannot help**: it compares the artefact to a fresh run of the same generator, so a field neither
side writes is a field both sides "agree" about. It passed over D9 exactly this way.

### 6. DEF-033 — a peer's row, not phase 80's to build blind

`Substring`'s panel says `End = 0` and the node behaves as `End = -1`. Registered by the **P18**
lane at `6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with
that lane before building it.

### 7. The unowned rows that need measuring

See [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — now **six**: `publishPage`'s
ordering, the shared backend that dies on a second deploy, the backend card that never looks again,
`Record.Fetched` firing on a bind, the `domelement` port that cannot reach its own description, and
**s25's addition: the drag door skips STYLE-002's defaults entirely.**

That last one is measured from source and **not driven** — `ElementConfigRegistry.applyDefaults` has
exactly one call site, so a Checkbox *dragged* from the library arrives without its token sizing,
its radius, its variant, or **DEF-001's accessibility border colour**, while one placed from the
picker arrives with all of them. What a dragged node actually renders has not been observed in a
running editor, and that drive is what the row owes.

**Measure one fully before starting the next.** A row that measures true gets a `DEF-0xx` id
(`DEF-034`+ are free) and a person's sentence, or it is not a row. ✅ **Keep the disproved ones,
marked.**

---

## Owed elsewhere

- ⚠️ **DEF-025's editor half is undriven.** The decision is graded directly and the MCP doors are
  graded through the real server, but the editor *wiring* rests where FUN-002 left it — on the two
  call sites. **Owed: place a Checkbox from the node picker and drag one from the library, and
  observe both arrive with the Label port visible in the property panel.** 🔴 A drive serves a
  **built bundle** — rebuild first.
- 🔴 **P77 D33 — the six unconfirmed same-collection writes on `/Pages/ThemeEditor`.** Registered by
  DEF-032, **owed a drive**: watch for `[runtime/cyclic-loop]` and count `SetDbModelProperties`
  writes on an idle theme editor. The census is asserted exactly, so a **seventh** cannot appear
  quietly — but the six themselves are still unmeasured.
- 🔴 **P77 owns `/Pages/ThemeEditor`'s appearance debt**, put on §4's floor by name by DEF-030.
- ⚠️ **`create_component` still cannot author a cycle in one pass.** DEF-013's fix is the plan door
  only — the ruling's named and accepted weakness. The two-pass workaround stands and is graded.

## Traps carried

- 🔴 **`grep` here is ugrep with `-I` and skips source files as binary, SILENTLY.** It returned
  nothing for a symbol that was on line 26 of the file. ✅ **Use `grep -a` for everything**, and
  treat any absence measured without it as unmeasured.
- 🔴 **zsh does not word-split an unquoted variable.** `for f in $FILES` with three paths in `$FILES`
  ran **once**, on the concatenation, and the `cp` and `git show` both failed — a back-out that
  never backed anything out, which would have "proved" reds were not mine while my code was still
  in the tree. ✅ **Read the error, and assert the variation actually landed.**
- 🔴 **A control that reports what it did, or it is not a control.** The first corpus control walked
  for `components/*/nodes.json` in a **legacy single-file** project, changed nothing, and printed
  "flipped" anyway. The finding and the control both read the same — and the same as success. ✅ The
  second one asserts the ids it changed and fails if the count is wrong.
- 🔴 **`test:ci` exits 1 at the clean floor**, exactly as a timed-out run does. ✅ Check the
  readout's **mtime** and read the failures **by name**; the count alone cannot tell a floor from a
  regression.
- 🔴 **The readout's `gitHead` is the READ time.** s25's said `420994d3`, a commit this session never
  worked from — a phase 77 peer landed it mid-run.
- 🔴 **Two phases now have a `TASKS.md` AND an `UNOWNED-ROWS-TO-MEASURE.md`.** The peer's commit
  touched phase 77's copies of both. A bare filename in a log or a handoff is ambiguous — qualify it
  with the phase.
- 🔴 **Make the peer-check its own tool call and READ it before starting a suite.** Also: it goes
  stale. s25's check was clean and a peer committed 40 minutes later anyway.
- 🔴 **A drive serves a BUILT bundle.** `render-report.js` serves the **gitignored**
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js`; a `noodl-viewer-react/src` change is
  invisible until `cd packages/noodl-viewer-react && npx webpack --config
  webpack-configs/webpack.viewer.prod.js` (~40s). Shared and mutable — check for a running drive.
- 🔴 **D-numbers COLLIDE across registers.** P77 and P78 both have a `D22`, a `D25`, a `D32`.
  Qualify with the register, or grep the anchor form `DEFECTS-THE-SITE-BUILDER-FOUND.md#d32`.
- 🔴 **A pathspec commit sweeps a sibling's unstaged edit.** Commit by explicit pathspec, never
  `git add -A`; `git add` untracked files individually first.
