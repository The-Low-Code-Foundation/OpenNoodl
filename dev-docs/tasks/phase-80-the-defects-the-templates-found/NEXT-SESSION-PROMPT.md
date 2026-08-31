# Phase 80 — next session

## State: **35 rows. 32 ✅ · DEF-007 🟡 partial · 2 open.**

s32 closed **DEF-034** — the row the last handoff put first. Commit `8ade2c6e`.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Tenth time.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

---

## 🧭 THE ONE THING TO PUT IN FRONT OF RICHARD

**313 wires were being deleted from every build, and both shipped templates said zero.**

`getWarnings` did not filter by level, so any warning key on a connection made the export drop the
wire. Two of the seven keys are `level: 'warning'` on purpose — FB-021's gated port (*"valid and its
value is ignored"*) and FIX-025's unconverted cast, **his own `string → number` report**.

- ✅ **Fixed and specced.** `getWarnings(ref, {levels})` — the option this model already speaks in
  three other methods. Only `exportComponent` opts in, with `['error']`. The canvas is untouched, so
  FB-021's dash is exactly as he ruled it.
- 🔴 **The 27 that make it his call to hear about.** The editor evaluates a gate against a **saved
  parameter**. Where the gate is driven by a **wire** — a `States` node feeding `flexDirection`, a
  Component Input feeding `useIcon` — the editor read the default, called the port switched off, and
  the wire left the build. Those are **reusable components**: `Pretty button`, `Secondary Button`,
  `Text Input`, `Toggle Switch`. A parameter arriving from outside is the entire point of them.
- ⚠️ **AC5 is owed: nobody has driven it.** `LearnBook › Pretty button` is the named fixture.

---

## The lesson s32 paid for: a row names an EXAMPLE, not its POPULATION

🔴 The register said `con-target-port-gated`. The **predicate** is `level: 'warning'`, and a second
key was already sitting inside it. Half the defect was invisible because the row named one instance
of it. ✅ **Re-derive the population from the predicate, never from the example the row happens to
name.**

### And a defect measured only against what SHIPS can read zero

Site Builder **0 of 412** connections. TPL-001 **0 of 273**. The register had therefore been saying
*"it may cost nothing"* — truthfully, about the only population anyone had looked at. The corpus of
179 real projects showed **313 wires across 35 projects**.

This is the **complement** of "rank by the product surface, not by a corpus", not a contradiction:
**rank with the surface; measure a blast radius with the corpus, because it may be the only
witness.** ✅ Before quoting a zero, ask which population could even exhibit the defect.

### The instrument, if you need it again

esbuild-bundle the **import-free** modules straight from `src` (`dynamicPortRules.ts`,
`portGateReason.ts`, `connectionCoercion.ts`) into CJS and `require` them from plain Node; read
`packages/noodl-types/src/node-catalog.json` for ports, defaults and types. `isConditionalPortValid`
**cannot** be bundled — `NodeLibrary` drags in the renderer — so it is transcribed, and the task file
says so. Corpus: `~/vscode_projects/Noodl projects` (legacy `project.json`) and `NodeGX test projects`
(v2 `components/**/nodes.json` + `connections.json`, nodes **flat**, children are id refs).

✅ **A control pair was built after the zero and before believing it**: `Group` + `sizeMode:
contentSize` + a wire into `width` ⇒ 1; the same graph at `sizeMode: explicit` ⇒ 0.

---

## The work, in the order it should be done

### 1. DEF-035 — the schema fetch still decides which ports exist

Now the cheapest open row this phase owns. `SchemaHandler` (`utils/schemahandler.ts:72`) fetches the
backend schema on **`window-focused`**; `recordFieldPorts` mints one port per column. **A build taken
with the schema cold still differs from one taken warm.** P77 s17 watched the census move **19
unhealthy → 4** on its own with no edit.

🔴 **Do not read DEF-028's green specs as covering this** — they pin a static graph and the schema
never enters them. 🔴 **Nor DEF-034's**: that settles which *verdicts* delete a wire; DEF-035 is about
which ports **exist** in the first place.

### 2. DEF-033 — a peer's row

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. Registered by **P18** at
`6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with that lane.

### 3. The unowned rows

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — six. §1 disproved; §6 measured.
**Measure one fully before starting the next.** `DEF-036`+ are free.

---

## What DEF-007 still owes

- ⚠️ **AC2 and AC4 are open.** AC2 (a curated template installed **through the picker** opens on its
  home) cannot be driven until a template is published. AC4 is §6's table, which exists — someone
  should decide whether that discharges it or whether it owes a real document.
- 🔴 **The pin is on the site-builder generator ONLY.** `tpl001Template.ts` is the other generator and
  is **unmeasured**. It writes a **v2 directory**, so its graph needs assembling into the legacy shape
  first. **Measure whether TPL-001 disagrees at all before porting anything.**
- 🔴 **§3.3's replacement is still undecided** — where a *missing* home is caught: refuse at publish,
  or resolve-and-warn at install as `noodl-preview` already does. **6 of 97** projects carry no home.
  🧭 A decision, not a fix to be guessed at.

## Owed elsewhere

- 🔴 **DEF-034 AC5 is undriven** — see above. `LearnBook › Pretty button`.
- 🔴 **DEF-028 is undriven.** Nobody has taken two exports of one real project in a real editor and
  diffed them.
- 🔴 **DEF-029 is undriven in a real editor.** 🔴 A drive serves a **built bundle** — rebuild
  `noodl-viewer-react` first (~40s). ⚠️ The ports fold into **`Advanced CSS`**.
- ⚠️ **DEF-031, DEF-005's `Roles` output, DEF-009's default and DEF-025's editor half are all
  undriven.**
- 🔴 **DEF-005 AC5 — TPL-001's member list**, a roster page on `List Users In Role`.
- 🔴 **P77 D33 — the six `/Pages/ThemeEditor` rows** DEF-007 §3.2 armed. Still the cheapest it has
  ever been to settle.

---

## The gate baselines, measured this session

🔴 **`test:ci` floor is 4** — all four AIX-006, **BY NAME**. **2916** tests (2909 + this session's 7).

| run | seed | failures | |
| --- | --- | --- | --- |
| fix in place | 99853 | **4** | the floor |
| **mutant** (fix disarmed) | 27341 | **6** | 4 floor + **exactly** the 2 export specs |
| fix restored | 02214 | **4** | the floor |

✅ **The mutant is the reading that matters.** It reddens exactly the two specs it should and leaves
the three model-level ones and the dash spec green — so the gate is a partition, not one broad
assertion that would pass on anything.

- `noodl-preview`: **14/14** (it reaches `exportComponent` through `exportComponentBundle`).
- `typecheck:editor` clean. ⚠️ `tsc -p noodl-editor` does **not** include `tests/` — the **webpack
  test build** is that check, and it fails *before* any test runs.
- **Not re-run**: `test:main`, `noodl-mcp`, `noodl-viewer-react`, `catalog:check`.

---

## Traps carried

- 🔴 **A register row names an EXAMPLE, not its POPULATION.** Re-derive from the predicate.
- 🔴 **A defect measured only against what SHIPS can read zero.** Ask which population could exhibit it.
- 🔴 **A backgrounded command's exit code lies.** The harness reported **`exit code 0`** for a run
  whose log ends `npm error code 1` with five TS errors and **no test executed** — then again on a
  floor run. ✅ Read `tests/test-results.json` (delete first, require a **fresh mtime**) and the log
  tail. ✅ **`totalCount` is also the proof your spec ran**: 2909 → 2916 is exactly 7 added.
- 🔴 **`setWarning` normalises an absent level to `'warning'`, not `'error'`.** The model already
  ruled on this phase's "absent key, two readers" question — assert it, don't re-decide it.
- ⚠️ **This electron runner has no `toHaveLength`** — `expect(x.length).toBe(n)`.
- 🔴 **A spec absent from `tests/nodegraph/index.ts` never runs.**
- 🔴 **`grep -a` always** — ugrep's `-I` skips source files as binary, silently.
- 🔴 **Assert `count(anchor) == 1`** before every python heredoc replace — and **write the file**.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never stage tracked files.
