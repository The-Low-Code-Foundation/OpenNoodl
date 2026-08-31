# Phase 80 — next session

## State: **33 rows. 29 ✅ · 4 open.**

s28 closed **DEF-031**, the row the last handoff put first, and corrected **DEF-029**'s recorded
measurement without closing it. Commit `09481a3e`.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Sixth time this is worth
saying, and s28 is the sixth case: the handoff called DEF-029 and DEF-031 "the cheapest real rows
on the board" on the strength of numbers that were **wrong in one case and half the story in the
other**.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) remains the authority for
DEF-007 §3.2 only.** Unchanged this session.

---

## The lesson s28 paid for, twice, and both times it was about a recorded number

🔴 **A register's measurement decays exactly like a relayed conclusion, and nobody re-runs it
because it looks like evidence.**

**DEF-029.** The register said `onDrop` = **0**. Re-measured, a substring `onDrop` reads **8** —
all of them `onDropped`, ERG-001's queue-discard callback, nothing to do with files. The
*conclusion* was right and the *number* was false, which is the worst combination: it would have
survived any review that checked whether the row was true.

**DEF-031.** The register said the runtime ships no `text-overflow` port. True — and it was the
outer half of two. Rendering the real component first showed `text-overflow: ellipsis` reaching
the DOM **intact and inert**, because `Text.tsx` appended `white-space: pre-wrap` and
`overflow-wrap: anywhere` after the author's style. A build that only added the port would have
shipped a port that does nothing, and a spec asserting only the property would have passed on it.

✅ **Before building from a register row, render or run the thing the row is about.** Both defects
were visible in one probe that took two minutes. ✅ **And when you correct a number, keep the row's
conclusion separate from it** — DEF-029 stays open and stays true.

⚠️ The sibling: **`grep -c` counts LINES.** The catalog is one 56,675-line JSON and an early check
read `1` for both `wordBreak` and `textOverflow`, which is a line count, not an occurrence count.
`git diff --stat` is what actually settled what was in it.

---

## The work, in the order it should be done

### 1. DEF-029 — the file-drop capability

P77 D15, now measured properly: word-boundary `onDrop`/`onDragOver`/`onDragEnter`/`onDragLeave`/
`dataTransfer` = **0**, against known-firing controls `onClick` = 31, `onMouseDown` = 8,
`onTouchStart` = 6. `draggable` = 7 is all `react-draggable` — the `Drag` node's pointer drag,
which is **not** file drop and is not a partial implementation of it.

⚠️ **This is a bigger build than DEF-031 was**, and the last handoff's "cheapest rows" framing
covered both. A drop target needs the DOM handlers, a `File`/`FileList` output the graph can carry,
and a decision about what a dropped file *is* in this runtime. **Scope it before starting.**

### 2. DEF-028 — build determinism

P77 D13. Unchanged and still the highest-value open row. The export health filter races the
viewer's dynamic-port announcement, so **what a build contains depends on when it was taken.**
⚠️ **SBR-008's fix removed the `prop-` family from the filter's reach and left the filter
unchanged** — every other dynamic-port family is still exposed. 🔴 **Do not read SBR-008's green
specs as evidence**: they call `setup()` and read what it announces; the debounced pass is not in
them.

### 3. DEF-007 §3.2 — the template writes explicit values

Drive the **56 disagreements across 13 components** to zero by making template generation write
the values — phase 78 D14's choice.

⚠️ **`site-builder.content.json` is phase 77's lane.** It was last written **2026-08-30 23:19** and
is still uncommitted; ✅ `git log -5 --` and `stat` it before starting.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together. **The byte gate cannot help**: it compares the artefact to a fresh run
of the same generator, so a field neither side writes is a field both sides "agree" about. It
passed over D9 exactly this way.

### 4. DEF-033 — a peer's row

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. Registered by the **P18** lane
at `6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with that
lane first.

🔴 **DEF-031 was built specifically not to become a second one of these.** Its `textOverflow`
default is `wrap` — not the CSS initial `clip` — because `applyDefault: false` means a `clip`
default would have shown "Clip" in a panel on a node that wraps. If you touch that port, that is
the constraint.

### 5. The unowned rows that need measuring

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — **six**, unchanged this session.
**Measure one fully before starting the next.** A row that measures true gets a `DEF-0xx` id
(`DEF-034`+ are free) and a person's sentence. ✅ **Keep the disproved ones, marked.**

---

## Owed elsewhere

- ⚠️ **DEF-031 is undriven in a real editor.** Graded at the compiled node and the rendered DOM;
  nobody has watched `Text Overflow` appear in a property panel and ellipsize a label on canvas.
  🔴 A drive serves a **built bundle** — rebuild `noodl-viewer-react` first (~40s) or it is invisible.
- 🔴 **`packages/noodl-types/src/node-catalog.json` is uncommitted and holds TWO lanes' ports.**
  Phase 81's VIB-002 added five `Group` background ports in the same window; a regeneration at
  10:23 folded both sets in. s28 committed **source only** so the catalog is safe for whoever
  commits it. ✅ **Regenerate before committing it**, and check `catalog:check` passes on what you
  land — a catalog entry with no committed source behind it fails on a clean checkout.
- 🔴 **DEF-005 AC5 — TPL-001's member list.** Still owed: a roster page on `List Users In Role` in
  `nodegx-backend/tests/helpers/members-drive.ts`. Explicitly *evidence, not the acceptance*.
  ⚠️ Edits `templates/members-area/`, another lane's artefact — check mtimes.
- ⚠️ **DEF-005's `Roles` output, DEF-009's default, and DEF-025's editor half are all undriven in a
  real editor.** Each cheap, each the surface a person actually meets.
- 🔴 **P77 D33 — six unconfirmed same-collection writes on `/Pages/ThemeEditor`**, registered by
  DEF-032, owed a drive: watch for `[runtime/cyclic-loop]` and count `SetDbModelProperties` on an
  idle theme editor.
- ⚠️ **`create_component` still cannot author a cycle in one pass** — DEF-013's named weakness.

---

## Traps carried

- 🔴 **`grep -c` counts LINES, not occurrences.** On a one-line-per-key JSON it reads plausibly and
  means nothing. ✅ Count in python, or settle it with `git diff --stat`.
- 🔴 **`grep` here is ugrep with `-I` and skips source files as binary, SILENTLY.** ✅ **`grep -a`
  for everything.** ⚠️ And a substring match is not a word match — `onDrop` matched `onDropped` 8
  times. ✅ Use `\b` anchors when the name is a prefix of another name.
- 🔴 **A generated artefact folds in every uncommitted edit in the tree.** `catalog:generate`
  rewrites `node-catalog.json` from whatever is on disk, so on a shared checkout it can publish a
  peer's unfinished work as yours. ✅ **Commit node source WITHOUT the catalog** when another lane
  has ports in flight; let one lane commit the catalog once every port in it is backed.
- 🔴 **A port whose declared default is not what the node does is DEF-033**, not a shortcut.
  ✅ Assert the default and the behaviour in the same file.
- 🔴 **Mutation-test the spec, not just the fix.** DEF-031's three mutants each reddened a
  *different* row; no single row carried the file.
- 🔴 **A module reading `Noodl.deployed` at import time fails the whole suite to run** if the global
  is set in `beforeAll` — `Tests: 0 total`, which reads like a missing file. ✅ Assign
  `(globalThis as Record<string, any>).Noodl` at module scope above the imports, as CN-006 does.
- 🔴 **`createNodeFromReactComponent` folds `inputCss` into `node.inputs`.** The compiled node is
  `TextNode.node`, and asserting on the source `inputCss` object grades a shape no user meets.
- 🔴 **A python heredoc anchor that "obviously matches" may not.** ✅ **Assert `count(anchor) == 1`.**
  Every edit this session went through that shape and none landed wrong.
- 🔴 **The Bash tool's cwd resets after some failures**, and it persists across calls otherwise —
  both bit s28. ✅ **Absolute paths, or re-`cd` in the same command.**
- 🔴 **Snapshot before mutating, restore with `cp`.** Never `git checkout --` — it discards
  uncommitted work, and on this checkout that may be a peer's.
- 🔴 **A pathspec commit sweeps a sibling's unstaged edit**, and **skips untracked files silently**.
  ✅ `git add` untracked individually, then `git commit <pathspecs>`; never `git add -A`.
- 🔴 **D-numbers COLLIDE across registers** (P77 and P78 both have D22, D25, D32) and **two phases
  have both a `TASKS.md` and an `UNOWNED-ROWS-TO-MEASURE.md`**. Qualify with the phase.
- 🔴 **Make the peer-check its own tool call and re-do it before a suite** — s28 started with two
  peer sessions live and one of them regenerated a shared artefact mid-session.
