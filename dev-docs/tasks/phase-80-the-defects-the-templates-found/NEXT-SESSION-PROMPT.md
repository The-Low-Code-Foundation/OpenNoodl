# Phase 80 — next session

## State: **33 rows. 27 ✅ · 6 open.**

s26 closed **DEF-009 AC4**, the row the last handoff put first. Richard's ruling built — and the
corpus check the ruling itself demanded came back **disagreeing with the evidence the ruling was
made on** (below). Nothing else moved. Commit `42dae2ba`.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Fourth time this is worth
saying: s22's handoff said "no workable open row left" while the table held one, s24 found DEF-033
that no handoff mentioned, and s25 watched a phase 77 peer commit mid-session.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) is still the authority for
DEF-005 and DEF-007 §3.2** — captured, still NOT built. DEF-009 AC4 and DEF-025 are now built and
their ruling sections read as history. Both remaining rulings went **against** the recommendation
put to Richard; read the reason, not just the verdict.

---

## 🔴 The thing Richard should see, and it is not a defect

**The ruling's own corpus check disconfirmed the population it was ruled on.**

DEF-009 AC4 was decided on *"27 unlimited public write doors across 23 projects, **all
`submitContactForm`**"* — a homogeneous population of trivial contact forms, for which 60/min
burst 30 is obviously generous. Re-run at HEAD the **count holds exactly** (27 / 23 over 179
projects) and the composition does not: **17** are `submitContactForm` and **ten are not** —
`ses_sns_response` ×3, `stripe-webhook` ×2, `Stripe/Process payment`, plus four bulk-write and
status doors.

Three of those are **provider webhooks**, the one shape that legitimately bursts past 30. All four
projects date from 2024–2025 and were inside the 178 the original sweep walked, so the sentence was
an **overstatement when it was written**, not drift since. The number was right; the clause after
it was not.

**Built as ruled** — it is Richard's decision and the ruling asked for the check, not for a veto.
The hazard is bounded by two things that are built and graded rather than described: the explicit
`{ ratePerMinute: 0, burst: 0 }` opt-out, and a boot line naming every affected endpoint. But
**Richard has not seen the corrected population**, and 60/30 on an SES bounce fan-out is a
decision he may want to revisit knowing what is actually in the set. See DEF-009 §6.3 for the table
and the exact command.

✅ **The command is now written down**, which s25 could not do for `calibrate:labels`:

```
npm run calibrate:door -- "$HOME/vscode_projects/Noodl projects" \
                         "$HOME/vscode_projects/NodeGX test projects" --json
```

---

## The lesson s26 paid for, which the next ruled row may repeat

🔴 **A recorded finding's COUNT and its CHARACTERISATION age differently.** "27 doors" survived
verbatim; "all `submitContactForm`" was never true. A count is cheap to re-derive and a
characterisation is not, so the characterisation is the one that gets carried forward unchecked —
and it is the half a ruling is actually made on.

✅ **Re-derive the composition, not just the total.** Two sweeps agreeing on a number is not two
sweeps agreeing.

⚠️ And s25's lesson held again, unprompted: **the door's own warning said the class bucket was
"the only bound until one of those is set"**, which the default made false. A grep for the field's
other readers found it before it shipped. It now says which of *two* things is true — an
undeclared door is told the default and its numbers, a deliberately zeroed one is told it has
opted out — and the superseded sentence is asserted **absent**, so a door that says it again is a
regression rather than a rewording.

---

## The work, in the order it should be done

### 1. DEF-005 — both halves, and AC3 is what makes (a) safe

**(a)** read-only `roles` output on the `User` node via `SecurityState.rolesForUser`;
**(b)** a cloud `List Users In Role` node.

🔴 **The cloud-only rule on the role WRITES survives intact** — the load-bearing half of the ruling.
🔴 **AC3 is not optional**: a **negative control** asserting a user who edits the output client-side
is **still refused by the server**. Assert the refusal, not just the read, and **beside a
known-firing signal** — *"refused"* and *"never requested"* are identical readings with opposite
fixes. ⚠️ Both are a port and a node — **neither owes the UNI-001 four sweeps.**

✅ **s26's spec is the pattern for AC3's known-firing signal**:
`nodegx-backend/tests/def009-public-write-default.test.ts` puts `declared-tight` (1/min, burst 1) in
the same fixture, over the same transport, in the same run, so every "not limited" arm is an absence
of a *limit* rather than an absence of a *request*. Copy the shape.

### 2. DEF-029 and DEF-031 — the two missing capabilities

Both are *a missing capability, not a missing wire*, both measured with known-firing controls.

- **DEF-029** (P77 D15) — no file-drop anything: `onDrop`/`dataTransfer`/`dragover`/`dragenter` =
  **0** against a **39**-hit `onClick` control. SBR-007 AC3 is not authorable as written.
- **DEF-031** (P77 D22) — no `text-overflow` port: **0** hits, against `wordBreak` = 2 and 11 files
  carrying `inputCss` — the mechanism a new port would use.

⚠️ **Re-measure both with `grep -a`.** This repo's `grep` is ugrep with `-I` and it skips source
files as binary **silently**; a `0` measured without `-a` is not a zero.

### 3. DEF-028 — build determinism

P77 D13. The export health filter races the viewer's dynamic-port announcement, so **what a build
contains depends on when it was taken.** ⚠️ **SBR-008's fix removed the `prop-` family from the
filter's reach and left the filter unchanged** — every other dynamic-port family is still exposed.
🔴 **Do not read SBR-008's green specs as evidence**: they call `setup()` and read what it
announces; the debounced pass is not in them.

### 4. DEF-007 §3.2 — the template writes explicit values

Drive the **56 disagreements across 13 components** to zero by making template generation write the
values — phase 78 D14's choice, cheaper and narrower than teaching four packages to apply migrations.

⚠️ **`site-builder.content.json` is phase 77's live lane and that lane is ACTIVE** — they landed
`420994d3` (SBR-015 AC4) *during s25's test:ci run*. ✅ `git log -5 --` on that file and check its
mtime **before starting**; coordinate rather than race.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together; either alone is the state the task exists to distinguish. **The byte gate
cannot help**: it compares the artefact to a fresh run of the same generator, so a field neither
side writes is a field both sides "agree" about. It passed over D9 exactly this way.

### 5. DEF-033 — a peer's row, not phase 80's to build blind

`Substring`'s panel says `End = 0` and the node behaves as `End = -1`. Registered by the **P18**
lane at `6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with
that lane before building it.

### 6. The unowned rows that need measuring

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

- ⚠️ **DEF-009's default is undriven in a real editor.** It is graded end-to-end over real HTTP
  against a real backend, which is where it lives — but nobody has watched the boot line appear in
  a running backend's log, and that is the surface an operator actually meets. Cheap: start a
  backend over a bundle with a public writing function and read `ratelimit.public-write-default`.
- ⚠️ **DEF-025's editor half is undriven.** Owed: place a Checkbox from the node picker and drag one
  from the library, and observe both arrive with the Label port visible in the property panel.
  🔴 A drive serves a **built bundle** — rebuild first.
- 🔴 **P77 D33 — the six unconfirmed same-collection writes on `/Pages/ThemeEditor`.** Registered by
  DEF-032, **owed a drive**: watch for `[runtime/cyclic-loop]` and count `SetDbModelProperties`
  writes on an idle theme editor.
- 🔴 **P77 owns `/Pages/ThemeEditor`'s appearance debt**, put on §4's floor by name by DEF-030.
- ⚠️ **`create_component` still cannot author a cycle in one pass.** DEF-013's fix is the plan door
  only — the ruling's named and accepted weakness.

## Traps carried

- 🔴 **`RECORD_WRITE_NODE_TYPES` now exists TWICE** — `noodl-editor/…/validation/publicWriteDoor.ts`
  and `nodegx-backend/…/workflow/functionDeclarations.ts` — in packages that cannot import each
  other. The door **warns** about exactly the population the default **limits**. They are held equal
  by `def009-public-write-default.test.ts` reading the other file. **If you edit one, that spec is
  what tells you the other did not follow.**
- 🔴 **`grep` here is ugrep with `-I` and skips source files as binary, SILENTLY.** ✅ **Use
  `grep -a` for everything**; treat any absence measured without it as unmeasured. ⚠️ And in zsh,
  `--include=*.ts` needs quoting or the shell eats it with "no matches found".
- 🔴 **A python heredoc anchor that "obviously matches" may not.** s26 lost a cycle to a long
  multi-line anchor failing while a shorter substring of it matched. ✅ **Anchor on the fewest lines
  that are unique, and assert `count(anchor) == 1` rather than `in`.**
- 🔴 **The Bash tool's cwd resets after some failures.** Two commands ran from the wrong directory
  and reported "no such file". ✅ **Absolute paths, or re-`cd` in the same command.**
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
  stale. s26's checkout was quiet throughout; s25's was not.
- 🔴 **A drive serves a BUILT bundle.** `render-report.js` serves the **gitignored**
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js`; a `noodl-viewer-react/src` change is
  invisible until `cd packages/noodl-viewer-react && npx webpack --config
  webpack-configs/webpack.viewer.prod.js` (~40s).
