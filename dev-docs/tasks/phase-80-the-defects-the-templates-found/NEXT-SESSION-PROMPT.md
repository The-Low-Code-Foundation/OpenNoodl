# Phase 80 — next session

## State: **35 rows. 33 ✅ · DEF-007 🟡 partial · 1 open (DEF-033, a peer's).**

s33 closed **DEF-035** — the row the last handoff put first. Commit `e5b68d30`.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Eleventh time.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

---

## 🧭 THE ONE THING TO PUT IN FRONT OF RICHARD

**Clicking the editor window while your backend was asleep deleted your record ports —
to disk — and the next build shipped without those wires.**

`dbCollections` is project **metadata**, so it is saved to `project.json`, and it is the
only home of a built-in backend's schema. `recordFieldPorts` mints one `prop-<column>`
port per column of it. `SchemaHandler._store()` wrote `dbCollections = undefined` on
**every** outcome that was not a successful read: a stopped backend, one mid-restart, one
that had not registered yet, a window focused three seconds before the backend finished
starting.

- 🔴 **What that costs.** A wire into a port that no longer exists is
  `con-no-target-port` at **`level: 'error'`** — and DEF-034 established that an error is
  exactly what still deletes a wire from an export. Measured across the 118-project
  corpus: **3,783 schema-derived wires in 28 projects.** `emdashdev` alone holds 1,837;
  `Resourceful` 358; `LearnBook` 174.
- ✅ **Fixed and specced.** `schemaCachePolicy.ts` splits the fetch into three outcomes —
  `schema`, `not-applicable`, `unavailable` — and only the first two write. A backend we
  could not reach leaves the cache exactly as it was. `backend:statusChanged` is now a
  trigger (it existed since WFA-005; nothing was listening), and the handler fetches on
  construction, so the cache fills when the backend starts rather than when the window is
  clicked.
- ⚠️ **AC5 is owed: nobody has driven it.** Two exports of one real project, one with the
  backend stopped and one running, diffed. `LearnBook` or `Resourceful` is the fixture.
  Drive a **copy** — opening a project dirties every component.

---

## The lesson s33 paid for: the PREFIX is not the POPULATION

🔴 The first count said **9,051 `prop-*` wires across 56 projects**. That metric measured
a *naming convention*. `Model2`, `NewModel` and `SetModelProperties` also spell their
ports `prop-<name>`, but those come from a **`properties` string list saved in the node's
own parameters** (`modelnode2.ts:505`) — no backend schema is involved and they are
immune. Only the six types that go through `resolveSchemaPortContext` can exhibit this.
The honest number is **3,783 across 28**; the prefix overstated it **2.4×**.

✅ **Ask what your metric would count if the defect were absent.** A `prop-` prefix would
count exactly the same either way.

This is the twin of s32's lesson, from the other side: s32 found a row that named an
*example* and missed half its population; s33 found a metric that named a *superset* and
would have inflated one. **Both are the same question — derive the population from the
predicate, then check the predicate is the defect's and not a spelling's.**

### The contract that was written and never honoured

`fetchBuiltInSchema`'s own docblock already said the caller *"distinguishes 'there is
nothing to cache' from 'the cache is empty', because the second wipes the ports of a
project whose backend is merely asleep."* It returned `undefined` for both. Worse:
**two other modules had each documented the wipe and worked around it downstream**
(`projectCollections.ts`, `backendSummary.ts`, AAQ-011 F8's "unknown, not absent"
branch) rather than fixing it. The port generator had no such workaround.

🔴 **A docblock describing a contract is not the contract.** When a comment says "the
caller distinguishes X from Y", go and read whether the caller *can*.

### The instrument, if you need it again

esbuild-bundle `record-ports.ts` **from `src`** into CJS and `require` it from plain
Node — it is import-free at runtime. Fixture in the backend's own `{name, columns}`
shape, **not** the normalised one, because that is what `SchemaHandler` caches. Corpus:
`~/vscode_projects/Noodl projects` (78 legacy `project.json`) and `NodeGX test projects`
(40 v2 dirs, `components/**/{nodes,connections}.json`).

✅ **The control pair**: `dbCollections: [Puppy]` ⇒ `prop-name/age/bio`;
`dbCollections: undefined` ⇒ nothing. Run it *before* believing any count.

---

## The work, in the order it should be done

### 1. This phase now owns nothing cheap and open — so DRIVE what is built

🔴 **Five rows are built and undriven, and that is now the phase's largest debt.**
Ordered by what a drive would actually settle:

- **DEF-035 AC5** (new) — two exports of one project, backend stopped vs running.
- **DEF-034 AC5** — `LearnBook › Pretty button`, the gate driven by a wire.
- **DEF-028** — two exports of one real project in a real editor, diffed. ⚠️ **DEF-035
  narrows but does not close this**: DEF-028 is about a *settled verdict* differing
  between two takes; DEF-035 was about the *port set* being a function of focus. One
  drive can now measure both.
- **DEF-029** — 🔴 a drive serves a **built bundle**; rebuild `noodl-viewer-react` first
  (~40s). ⚠️ The ports fold into **`Advanced CSS`**.
- **DEF-031**, **DEF-005's `Roles` output**, **DEF-009's default**, **DEF-025's editor
  half** — all undriven.

### 2. DEF-033 — do NOT take it without checking P18

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. **Registered by
P18** at `6f91ae2a`, and its own text says the fix is **a decision, not a one-liner**.
🔴 A peer may be doing your exact task — check `phase-18-code-export-v2/` files and
mtimes before starting.

### 3. The unowned rows

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — six. §1 disproved; §6
measured. **Measure one fully before starting the next.** `DEF-036`+ are free.

---

## What DEF-007 still owes

- ⚠️ **AC2 and AC4 are open.** AC2 (a curated template installed **through the picker**
  opens on its home) cannot be driven until a template is published. AC4 is §6's table,
  which exists — someone should decide whether that discharges it or whether it owes a
  real document.
- 🔴 **The pin is on the site-builder generator ONLY.** `tpl001Template.ts` is the other
  generator and is **unmeasured**. It writes a **v2 directory**, so its graph needs
  assembling into the legacy shape first. **Measure whether TPL-001 disagrees at all
  before porting anything.**
- 🔴 **§3.3's replacement is still undecided** — where a *missing* home is caught: refuse
  at publish, or resolve-and-warn at install as `noodl-preview` already does. **6 of 97**
  projects carry no home. 🧭 A decision, not a fix to be guessed at.

## Owed elsewhere

- 🔴 **DEF-005 AC5 — TPL-001's member list**, a roster page on `List Users In Role`.
- 🔴 **P77 D33 — the six `/Pages/ThemeEditor` rows** DEF-007 §3.2 armed. Still the
  cheapest it has ever been to settle.

---

## The gate baselines, measured this session

🔴 **`test:ci` floor is 4** — all four AIX-006, **BY NAME**. **2916** tests, unchanged:
this session's 13 specs are jest (`tests-unit/`), not electron.

| run | seed | specs | failures | |
| --- | --- | --- | --- | --- |
| `test:ci` | 82057 | **2916** | **4** | the floor |

- `tests-unit/def-035`: **13/13**.
- **mutant** (`unavailable` restored to wiping): **7 failed, 6 passed** — exactly the
  wipe specs; the `schema` and `not-applicable` specs stay green. ✅ A partition, not one
  broad assertion.
- `test:main`: **6491 passed, 5 failed** — 🔴 **all 5 pre-existing.** Reproduced at HEAD
  with this session's three source files reverted: `sb-007/site-template`,
  `sb-018/the-list-refreshes-when-a-row-changes`, `aib-007/backendRequirement`. ⚠️ **They
  are somebody's open work — do not read them as this phase's floor and do not "fix"
  them without finding the owner.**
- `typecheck:editor` clean, exit 0. `lint:ci` exit 0 (874 vs 3916 baseline).
- **Not re-run**: `noodl-mcp`, `noodl-viewer-react`, `catalog:check`, `test:packages`.

---

## Traps carried

- 🔴 **The PREFIX is not the POPULATION.** `prop-*` counted 9,051; the defect's predicate
  counted 3,783. Ask what your metric would count if the defect were absent.
- 🔴 **A docblock describing a contract is not the contract.** Two modules documented this
  wipe and worked around it; nobody checked whether the caller could do what its comment
  claimed.
- 🔴 **A failing `cd` breaks the `&&` chain and the command grades the WRONG TREE.** A
  mutant "passed" this session because `cd packages/noodl-editor` ran from inside
  `packages/noodl-editor`; later a handoff `cat >` silently never ran for the same
  reason, and the `wc -l` after it reported the OLD file. ✅ **Use absolute paths**, and
  verify the artefact on disk (`grep -c MUTANT`, `head -3`) before believing a result.
- 🔴 **`npx prettier --write` reformats code you did not touch.** It pulled an unrelated
  `.map()` into the diff. ✅ Check `git diff --stat` before and after, and revert what is
  not yours.
- 🔴 **Get a real baseline before blaming your change.** Three suites failed; reverting
  the three source files and re-running reproduced all five failures at HEAD. ✅ Snapshot
  with `cp`, restore with `git show HEAD:<path> > <path>`, never `git stash`.
- 🔴 **A backgrounded command's exit code lies.** ✅ Read `tests/test-results.json`
  (delete first, require a **fresh mtime**) and the log tail. `totalCount` is also the
  proof your spec ran.
- ⚠️ **This electron runner has no `toHaveLength`** — but **jest `tests-unit/` does**.
- 🔴 **A spec absent from `tests/nodegraph/index.ts` never runs** (electron suite only;
  jest discovers by `testMatch`).
- 🔴 **`grep -a` always** — ugrep's `-I` skips source files as binary, silently.
- 🔴 **Assert `count(anchor) == 1`** before every python heredoc replace.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never
  stage tracked files — a sibling's commit sweeps them.
