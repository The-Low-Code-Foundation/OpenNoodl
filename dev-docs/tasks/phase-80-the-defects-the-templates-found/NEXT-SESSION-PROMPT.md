# Phase 80 — next session

## State: **35 rows. 31 ✅ · 4 open.**

s30 closed **DEF-028**, the row the last handoff put first and called "the highest-value open row
on the board by a distance". It was. Commit `1ddd158e`. Two rows were **registered out of it**
rather than absorbed into it — the board grew by two on purpose.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Eighth time.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) remains the authority for
DEF-007 §3.2 only.** Unchanged this session.

---

## The lesson s30 paid for: a register's *counts* decay like its numbers and its scopes

🔴 **D13 said "one filter, three callers". There are eight, across seven entry points** — and two
of them (`sandboxExport.ts`, `componentBench.ts`) are AI-authoring paths the register never named.
The row's substance was entirely correct. Its arithmetic was three sessions old.

This is now the **third session running** to find the same shape:

| session | what was stale beneath a true row |
| --- | --- |
| s28 | a recorded **number** |
| s29 | a recorded **scope estimate** |
| s30 | a recorded **count of call sites** |

✅ **Re-derive any quantity at the point where you rely on it.** Here the count decided the
*design*: three callers is a case for patching callers, eight is a case for fixing the filter. A
stale count would have produced a defensible fix with a hole in it.

### And a spec that passed for the wrong reason

🔴 **AC3 asserted an absence and passed vacuously on the first run.** `exportConnection` renames a
wire's fields — `from/toProperty` on the graph become `source/targetPort` in the artefact — so the
helper mapped every wire to `'undefined->undefined'`, and `not.toContain('screenX->…')` was
satisfied by a list of the wrong *shape* rather than by a wire that had been dropped.

✅ **Put a known-firing positive beside every absence** — and pick one that reads the same **before
and after** the fix, so it cannot itself be hiding the defect. Here: `toContain('image->image')`,
the wire that survives in both directions. AC3 was then re-measured **red** before being made green.
That cost one extra `test:ci` cycle and was worth it.

---

## The work, in the order it should be done

### 1. DEF-007 §3.2 — the template writes explicit values

Now the highest-value open row. Drive the **56 disagreements across 13 components** to zero by
making template generation write the values — phase 78 D14's choice.

⚠️ **`site-builder.content.json` is phase 77's lane and is STILL uncommitted** — unchanged through
s30. ✅ `git log -5 --` and `stat` it before starting.

🔴 **AC3 is a PAIR** — the artefact rendered from disk **and** the same project loaded in the
editor, asserted together. **The byte gate cannot help**: it compares the artefact to a fresh run
of the same generator, so a field neither side writes is a field both sides "agree" about. It
passed over D9 exactly this way.

### 2. DEF-034 — a `level: 'warning'` wire is deleted like an error one

**New, registered by DEF-028 §6, and the cheaper of the two new rows.** `getWarnings` does not
filter by level, so **any** warning key on a connection makes `getConnectionHealth` return
`healthy: false` and the export filter drops the wire — including FB-021's `con-target-port-gated`,
whose own comment says the wire *"is valid and its value is ignored"*.

DEF-028 did not create this; it **made it deterministic**, so a wire into a `basic`-gated port now
always leaves the build.

⚠️ **Derived from source; blast radius UNMEASURED, and that is the first job.** `grep -a` puts
`con-target-port-gated` in exactly one file — its writer — so nothing grades it. FB-021 measured
**328** `basic`-gated input ports against 21 `extended`, so the population is large; **whether any
shipped template actually wires into one** is unknown. Measure that before deciding it matters. It
may cost nothing — the value was already ignored at runtime — and "may cost nothing" is a
measurement nobody has taken.

### 3. DEF-035 — the schema fetch still decides which ports exist

**New, D13's other half, and explicitly NOT closed by DEF-028.** `SchemaHandler` fetches the
backend schema on **`window-focused`**; `recordFieldPorts` mints one port per column. DEF-028 makes
the export read a *settled verdict about the ports that exist at that moment* — it does not make
the port set a function of the project. **A build taken with the schema cold still differs from one
taken warm.** P77 s17 watched the census move **19 unhealthy → 4** on its own with no edit.

🔴 **Do not read DEF-028's green specs as covering this.** They pin a static graph; the schema
never enters them.

### 4. DEF-033 — a peer's row

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. Registered by **P18** at
`6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with that lane.

### 5. The unowned rows

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — six. §1 disproved; §6 measured.
**Measure one fully before starting the next.** `DEF-036`+ are free.

---

## Owed elsewhere

- 🔴 **DEF-028 is undriven.** Nobody has taken two exports of one real project in a real editor and
  diffed them. The specs are the real model but a synthetic graph. A drive would also be the only
  way to see DEF-035's half move.
- 🔴 **DEF-029 is undriven in a real editor.** Nobody has ticked `Accept File Drops` and dropped a
  file. 🔴 A drive serves a **built bundle** — rebuild `noodl-viewer-react` first (~40s). ⚠️ The
  ports fold into **`Advanced CSS`** — expand it or the drive reports them missing.
- ⚠️ **DEF-029's tier placement is Richard's call**; and it does **not** cover directory drops or
  paste.
- ⚠️ **DEF-031, DEF-005's `Roles` output, DEF-009's default and DEF-025's editor half are all
  undriven.** Each cheap, each the surface a person actually meets.
- 🔴 **DEF-005 AC5 — TPL-001's member list**, a roster page on `List Users In Role`.
- 🔴 **P77 D33 — six unconfirmed same-collection writes on `/Pages/ThemeEditor`**, owed a drive.
- ⚠️ **`create_component` still cannot author a cycle in one pass** — DEF-013's named weakness.

---

## The gate baselines, measured this session

🔴 **`test:ci` floor is 4, and s30 confirmed it twice — all four AIX-006, BY NAME.**

| run | seed | failures |
| --- | --- | --- |
| unfixed | 25387 | **7** = 4 floor + 3 DEF-028 |
| fixed | 19613 | **4** = the floor exactly |

Different seeds, so the green is not a pinned order. **2909 specs** both times.

⚠️ **A P81 peer was editing `src/editor/src/validation/parameterValues.ts` at 11:34:12, inside the
fixed run's webpack window.** It cannot have masked anything — a broken peer edit could only have
*added* failures, and the count came back at exactly the floor — and their graders live in
`tests-unit/` (`test:main`), not this suite. Recorded because the reading was taken beside someone
else's work and a future session should not have to wonder.

- Editor typecheck: clean.
- **Not re-run this session**: `test:main` (5 pre-existing failures, attribution settled at s29),
  `noodl-viewer-react`, `noodl-mcp`, `catalog:check`. Nothing this session touched them — the
  change is two editor files and a spec.

---

## Traps carried

- 🔴 **An absence assertion can pass on a list of the WRONG SHAPE.** Not just on a wire that was
  correctly dropped. ✅ A known-firing positive control beside it, chosen to read the same before
  and after the fix.
- 🔴 **A register's COUNTS decay like its numbers.** Third session running. ✅ Re-derive any
  quantity where you rely on it — especially one that decides a design.
- 🔴 **`getWarnings` does not filter by level**, so `level: 'warning'` and `level: 'error'` are the
  same verdict to every consumer that asks "is this healthy". See DEF-034.
- 🔴 **`test:ci` writes `tests/test-results.json`, NOT `test-results.json`.** s30 deleted the wrong
  path, then read `EXIT=1` with no results file and briefly took it for the timeout trap. ✅ Delete
  the path the runner prints, and require a fresh **mtime**.
- 🔴 **`exportComponent` is duck-typed on `comp.graph`** — it imports fine in the plain-Node
  `tests-unit` runner while `NodeGraphModel` does not (it reaches `bugtracker` → Electron). A
  filter spec there would grade a stub. The real model lives in the **Electron jasmine suite**.
- 🔴 **A spec absent from `tests/nodegraph/index.ts` never runs** — the barrel says so in its own
  comment.
- 🔴 **D-numbers COLLIDE across registers.** `tests-unit/d-13/` is **phase 69's** D13, not P77's.
  Qualify with the phase before assuming a directory is prior art on your row.
- 🔴 **`grep -a` always** — ugrep's `-I` skips source files as binary, silently.
- 🔴 **Assert `count(anchor) == 1`** before every python heredoc replace.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never stage — a
  sibling's commit sweeps staged files, and a pathspec commit skips untracked ones silently.
