# Phase 80 — next session

## State: **33 rows. 30 ✅ · 3 open.**

s29 closed **DEF-029**, the row the last handoff put first, and it was **smaller than the handoff
believed** — for a reason worth carrying. Commit `f725d184`.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Seventh time this is
worth saying, and s29 is the seventh case — see the lesson below.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) remains the authority for
DEF-007 §3.2 only.** Unchanged this session.

---

## The lesson s29 paid for: a scope estimate decays exactly like a measurement

🔴 **The handoff said DEF-029 needed "a decision about what a dropped file *is* in this runtime",
and called it "a bigger build than DEF-031 was". It needed no decision at all.**

`Open File Picker` has always emitted a browser `File` on a `type: '*'` port. `Upload File`'s
`File` input has always documented itself as taking *"the file to upload, as an Open File Picker
node produces it"*. The contract was written down, in both directions, before the row was
registered. The build emits that same shape under those same names and wires into the upload path
that already existed.

✅ **Before believing a scope estimate, ask the door whether the kit already answers the open
question.** One `grep -ral 'File' .../nodes` and two file reads — about four minutes — turned an
open-ended design question into a naming exercise. The register row was *true*: the capability
was genuinely absent, 0 against controls of 37. What had decayed was the **estimate attached to
it**, and nobody re-derives an estimate because it does not look like a claim.

⚠️ This is the same shape as s28's lesson one level up: s28 found a recorded *number* stale
beneath a true row; s29 found a recorded *scope* stale beneath a true row.

### And the mutant that "survived" because it never ran

🔴 **A mutation harness that greps only for failure lines cannot tell "no failures" from "the
suite never compiled".** M5 renamed a dynamic `outputs:` key to `mutantOutputs:` — a **type
error**, so ts-jest compiled nothing, zero tests ran, and a `grep '✕'` found nothing and printed
it under the heading that meant *survived*. Re-run type-validly (`outputs: []`) it reddens
immediately.

✅ **Print `Tests:` cardinality beside every mutant.** A mutant must be *type-valid* to be a
mutant at all.

---

## The work, in the order it should be done

### 1. DEF-028 — build determinism

P77 D13. Unchanged, and now the highest-value open row on the board by a distance. The export
health filter races the viewer's dynamic-port announcement, so **what a build contains depends on
when it was taken.**

⚠️ **SBR-008's fix removed the `prop-` family from the filter's reach and left the filter
unchanged** — every other dynamic-port family is still exposed. 🔴 **Do not read SBR-008's green
specs as evidence**: they call `setup()` and read what it announces; the debounced pass is not in
them.

🆕 **s29 added a new dynamic-port family to five visual nodes** (DEF-029's `File Drop` group,
gated on `acceptFileDrops = true`). If DEF-028's exposure is per-family, that is one more family
in its blast radius — worth measuring first, since it is fresh and its shape is known.

### 2. DEF-007 §3.2 — the template writes explicit values

Drive the **56 disagreements across 13 components** to zero by making template generation write
the values — phase 78 D14's choice.

⚠️ **`site-builder.content.json` is phase 77's lane and is STILL uncommitted** — last written
2026-08-30 23:19, unchanged through s29. ✅ `git log -5 --` and `stat` it before starting.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together. **The byte gate cannot help**: it compares the artefact to a fresh run
of the same generator, so a field neither side writes is a field both sides "agree" about. It
passed over D9 exactly this way.

### 3. DEF-033 — a peer's row

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. Registered by the **P18** lane
at `6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with that
lane first.

### 4. The unowned rows that need measuring

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — now **six**. §1 is disproved; **§6 is
new and already measured**, because s29 was blocked by it rather than sweeping for it.

🆕 **§6 — `group.ts` cannot be imported from a test at all.** `Group.tsx` pulls in an ESM `.js`
scroll plugin and this package's jest preset is bare `ts-jest`. The runtime's most-used visual
node is ungraded, and the failure reads **`Tests: 0 total`** — like a missing file, not a broken
import. What it owes before a fix: whether adding a `.js` transform changes any of the 86 passing
suites. ⚠️ Shared config — not a change to make casually from a lane that is not about it.

**Measure one fully before starting the next.** A row that measures true gets a `DEF-0xx` id
(`DEF-034`+ are free) and a person's sentence. ✅ **Keep the disproved ones, marked.**

---

## Owed elsewhere

- 🔴 **DEF-029 is undriven in a real editor.** Nobody has ticked `Accept File Drops` in a property
  panel and dropped a file on a canvas. 🔴 A drive serves a **built bundle** — rebuild
  `noodl-viewer-react` first (~40s) or the ports are invisible. ⚠️ The ports fold into
  **`Advanced CSS`** in the panel (classified `plumbing` beside `Pointer Events`) — expand it, or
  the drive will report them missing.
- ⚠️ **DEF-029's tier placement is Richard's call.** `File Drop` is folded into `Advanced CSS`;
  deleting one line in `propertyPanelTiers.ts` puts `Accept File Drops` on the first screen of
  Group, Text, Image, Circle and Video. Filed advanced because that is five nodes' basic tier
  taxed for a port most screens never set.
- ⚠️ **DEF-029 does not cover directory drops or paste.** `dataTransfer.items` /
  `webkitGetAsEntry` are untouched; `onPaste` with a file clipboard is the same capability through
  a different gesture and is not built.
- ⚠️ **DEF-031, DEF-005's `Roles` output, DEF-009's default and DEF-025's editor half are all
  undriven in a real editor.** Each cheap, each the surface a person actually meets.
- 🔴 **DEF-005 AC5 — TPL-001's member list.** Still owed: a roster page on `List Users In Role` in
  `nodegx-backend/tests/helpers/members-drive.ts`. Explicitly *evidence, not the acceptance*.
- 🔴 **P77 D33 — six unconfirmed same-collection writes on `/Pages/ThemeEditor`**, registered by
  DEF-032, owed a drive: watch for `[runtime/cyclic-loop]` and count `SetDbModelProperties` on an
  idle theme editor.
- ⚠️ **`create_component` still cannot author a cycle in one pass** — DEF-013's named weakness.

---

## The gate baselines, measured this session

🔴 **`test:main` has 5 pre-existing failures in this working tree, and they are NOT yours.**
Confirmed by a catalog-reverted control — each fails identically with the catalog at HEAD:

| suite | tests | attribution |
| --- | --- | --- |
| `sb-007/site-template` | 2 | pre-existing |
| `sb-018/the-list-refreshes-when-a-row-changes` | 2 | pre-existing |
| `aib-007/backendRequirement` | 1 | pre-existing |

✅ **The control that settles ownership costs one minute**: `git show HEAD:<catalog> > <catalog>`,
re-run, restore from a scratchpad copy. Never `git checkout --`. s29's two owned failures (FB-017,
FB-021) flipped green under it and the other three did not — that pair of readings is the evidence,
not either one alone.

- **`noodl-viewer-react`**: 86 suites / 1133 tests green.
- **`noodl-mcp`**: 1 pre-existing failure — `styleTools` AIX-006 wire budget, `prompt` 3161/3000
  and `full` 11720/11000. Identical with the catalog reverted, so it is not port-count driven.
- **`catalog:check`, `catalog:groups:check`**: green. Typechecks: editor, editor-tests, viewer clean.

---

## Traps carried

- 🔴 **A mutant must be TYPE-VALID or it is not a mutant.** A type error means zero tests ran, and
  a failure-line grep reads that as survival. ✅ Print `Tests:` cardinality per mutant.
- 🔴 **`Tests: 0 total` reads like a missing file.** Three separate causes now: a module reading
  `Noodl.deployed` at import time, a ts-jest type error, and an untransformed ESM `.js` in the
  import graph. ✅ Read the SyntaxError, do not assume the path is wrong.
- 🔴 **A new shared port group owes two census gates**: `fb-017/propertyPanelTiers` (classify it in
  `ADVANCED_CSS_GROUPS`, `BASIC_CSS_ORDER` or `SUBJECT_GROUPS` — the sweep fails on any shared
  visual group left unclassified) and `fb-021/portGateReason` (the gated-input census moves).
  ✅ Both moved by exactly 5 here and every new gated port was explained — that equality is the
  reading, not the raw number.
- 🔴 **`SUBJECT_GROUPS` means "ports that name the thing the node IS".** Filing a capability group
  there because it feels important says something untrue. A Group is not a drop zone by nature.
- 🔴 **`grep -c` counts LINES, not occurrences**, and **a substring is not a word** — `onDrop`
  matched `onDropped` 8 times. ✅ `grep -aoE '\bname\b' | wc -l`.
- 🔴 **`grep` here is ugrep with `-I`** and skips source files as binary, SILENTLY. ✅ `grep -a`.
- 🔴 **A python heredoc anchor that "obviously matches" may not** — one anchor this session was
  off by two spaces of indentation and asserted `0`. ✅ **Assert `count(anchor) == 1`, always.**
- 🔴 **An index built on a key that is `None` collapses every row into one** and reports "no
  differences" with total confidence. s29's first catalog diff read **0 changed nodes** across 176
  because the entries are keyed `typeName`, not `name`. ✅ **Assert cardinality on both sides of a
  diff** (`len(index) == 176`) before believing an absence.
- 🔴 **A generated artefact folds in every uncommitted edit in the tree.** ✅ `--out-dir` to a
  scratchpad and diff *the port surface* before regenerating in place. It was clean this time —
  exactly 5 nodes, exactly the new ports — and that is a measurement, not an assumption.
- 🔴 **The Bash tool's cwd persists across calls and resets after some failures.** ✅ Absolute
  paths, or re-`cd` in the same command.
- 🔴 **Snapshot before mutating, restore with `cp`.** Never `git checkout --`. ✅ `md5 -q` the
  restored file against the snapshot before believing the tree is clean.
- 🔴 **A pathspec commit sweeps a sibling's unstaged edit** and **skips untracked files silently**.
  ✅ `git add` your own untracked files individually, then `git commit <pathspecs>`. Two peer files
  were untracked in `tests-unit/border-sweep/` and `noodl-mcp/tests/` this session and stayed out.
- 🔴 **D-numbers COLLIDE across registers** (P77 and P78 both have D22, D25, D32) and **two phases
  have both a `TASKS.md` and an `UNOWNED-ROWS-TO-MEASURE.md`**. Qualify with the phase.
