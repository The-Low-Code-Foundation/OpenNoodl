# Phase 80 — next session

## State: **35 rows. 32 ✅ · 3 open.**

s31 closed **DEF-007 §3.2** — the row the last handoff put first. AC3 is **green**: the shipped
template disagreed with itself in **65** places and now disagrees in **0**. Commit `e4b86fe9`.

⚠️ **s31 also landed phase 77's SBR-012** (`d3b4d0c8`), which had sat complete and green in the
tree since 23:27 the night before. Not authored here — see that commit's message for why it could
not be left out.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** Ninth time.

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

🔴 **[RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md) is the authority for DEF-007
§3.2 only.** That section is now built; the file is spent unless §3.2 is reopened.

---

## 🧭 THE ONE THING TO PUT IN FRONT OF RICHARD

**DEF-007 §3.2 armed six things, deliberately, and whether that was right is his call.**

The fix writes `runOnChange-*: true` — the value the artefact already means unloaded — on 65
inputs. Six of those are P77 **D33**'s unconfirmed same-collection rows on `/Pages/ThemeEditor`.

- ✅ **The deployed site does not change.** Export, deploy and headless render already read an
  absent key as ticked. If those six cycle, **the cycle is already live in the product** and
  always was.
- 🔴 **The editor now matches.** It used to write `false` over them on every load. So the editor
  stops masking a hazard the shipped product has — and the editor is where the runtime's
  `[runtime/cyclic-loop]` detector lives, which is the only reason D31 was ever caught.

Pinning those six `false` instead was **rejected, not overlooked**: two are `in-rows` on functions
that read a collection, and `false` there is P77 D5/D11's failure mode exactly — the screen never
populates.

✅ **D33's owed drive is now much cheaper**, because the editor will exhibit the behaviour instead
of hiding it. That drive is the cheapest way to settle this, and it is still owed.

---

## The lesson s31 paid for: a count decays, and this one decided the *design*

🔴 §6.1 recorded **56**, anchored to an md5. Re-derived at the point of use: **56** at that commit,
**65** at HEAD, **65** in the tree — and the *shape* had moved too.

**Fourth session running.** s28 a number, s29 a scope estimate, s30 a count of call sites, s31 a
count of disagreements. ✅ **Re-derive any quantity where you rely on it.**

Here it changed the answer rather than the arithmetic: **settling 65 parameters by hand into a file
a peer authors into daily would have been stale before it committed.** The fix had to be in the
generator — which is what §3.2 always said, but the *reason* was only visible after re-measuring.

### And the register never said the artefact was generated

🔴 `site-builder.content.json` **is generated** — `npm run template:site-builder` — and a
byte-equality gate reddens on hand edits. Its own header says so in capitals. §6.1's *"do not edit
the artefact or its generator, it is phase 77's file"* was half right: the artefact is theirs, and
the fix was never an edit to it.

### The strongest evidence was in the code, not the register

The component sources already carried **21 explicit `true`s and 27 `false`s**, hand-pinned node by
node, and `sb006Components.ts:517` writes out the whole argument for `true`. **The fix automated a
practice that was already running by hand.** ✅ Before designing a policy, check whether the
codebase has already been applying one.

---

## The work, in the order it should be done

### 1. DEF-034 — a `level: 'warning'` wire is deleted like an error one

Now the cheapest open row. `getWarnings` does not filter by level, so **any** warning key makes
`getConnectionHealth` return `healthy: false` and the export filter drops the wire — including
FB-021's `con-target-port-gated`, whose own comment says the wire *"is valid and its value is
ignored"*.

⚠️ **Blast radius UNMEASURED, and that is the first job.** FB-021 measured **328** `basic`-gated
input ports against 21 `extended`, so the population is large; **whether any shipped template
actually wires into one** is unknown. It may cost nothing — and "may cost nothing" is a
measurement nobody has taken.

### 2. DEF-035 — the schema fetch still decides which ports exist

`SchemaHandler` fetches the backend schema on **`window-focused`**; `recordFieldPorts` mints one
port per column. **A build taken with the schema cold still differs from one taken warm.** P77 s17
watched the census move **19 unhealthy → 4** on its own with no edit.

🔴 **Do not read DEF-028's green specs as covering this.** They pin a static graph; the schema
never enters them. 🔴 **Nor DEF-007's.** §3.2 settles `runOnChange-*`, which is a *parameter*
question; DEF-035 is about which ports **exist**.

### 3. DEF-033 — a peer's row

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. Registered by **P18** at
`6f91ae2a`. ⚠️ Its own text says the fix is **a decision, not a one-liner** — check with that lane.

### 4. The unowned rows

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — six. §1 disproved; §6 measured.
**Measure one fully before starting the next.** `DEF-036`+ are free.

---

## What DEF-007 still owes

- ⚠️ **AC2 and AC4 are open.** AC2 (a curated template installed **through the picker** opens on
  its home) cannot be driven until a template is published. AC4 (the seam's doc names each path and
  which side it is on) is §6's table, which exists — someone should decide whether that discharges
  it or whether it owes a real document.
- 🔴 **The pin is on the site-builder generator ONLY.** `tpl001Template.ts` is the other generator
  and is **unmeasured**. It is **not** a one-line port — it writes a **v2 directory**, so its graph
  needs assembling into the legacy shape first (`readAsLegacyProject` does this for site-builder).
  **Measure whether TPL-001 disagrees at all before porting anything.**
- 🔴 **§3.3's replacement is still undecided** — where a *missing* home is caught: refuse at
  publish, or resolve-and-warn at install as `noodl-preview` already does. **6 of 97** projects
  carry no home. 🧭 A decision, not a fix to be guessed at.

## Owed elsewhere

- 🔴 **DEF-028 is undriven.** Nobody has taken two exports of one real project in a real editor and
  diffed them.
- 🔴 **DEF-029 is undriven in a real editor.** 🔴 A drive serves a **built bundle** — rebuild
  `noodl-viewer-react` first (~40s). ⚠️ The ports fold into **`Advanced CSS`**.
- ⚠️ **DEF-031, DEF-005's `Roles` output, DEF-009's default and DEF-025's editor half are all
  undriven.**
- 🔴 **DEF-005 AC5 — TPL-001's member list**, a roster page on `List Users In Role`.
- 🔴 **P77 D33 — the six rows above.** Now the cheapest it has ever been to settle.

---

## The gate baselines, measured this session

🔴 **`test:ci` floor is 4** — all four AIX-006, **BY NAME**. 2909 specs.

| run | seed | failures |
| --- | --- | --- |
| first | 70598 | **5** = 4 floor + 1 flake |
| re-run | 76055 | **4** = the floor exactly |

🔴 **The 5th was a flake, and the attribution was made from the spec's CONTENT before the re-run,
not from the re-run.** `pending project saves survive the way out — re-arms a held save when saving
is switched back on` polls the disk after `SAVE_DEBOUNCE_MS + 500` and has **zero** references to
anything this change touches. ✅ **Re-rolling a seed until a red goes away is how a real regression
gets attributed to luck** — read the spec first, then re-run to confirm.

- `noodl-mcp`: **79 suites, 1043 tests, all green.**
- `typecheck:editor`, `typecheck:mcp`: clean.
- **Not re-run**: `test:main`, `noodl-viewer-react`, `catalog:check`.

---

## Traps carried

- 🔴 **A GENERATED artefact is not editable, and the register may not know it is generated.**
  ✅ Read the consumer's own header before planning an edit to a data file.
- 🔴 **A register's COUNTS decay like its numbers.** Fourth session running.
- 🔴 **An absent key can mean OPPOSITE things to two readers.** `runOnChange-*` absent is *ticked*
  to the runtime and *false* to the migration. Any gate over such a field must say which reader it
  is speaking for.
- 🔴 **A gate whose population is "what a pass would write" goes VACUOUS when you fix the pass.**
  Six specs did. ✅ When a fix empties a gate's population, re-aim the gate at what the artefact
  now *states* — and check whether the new population is LARGER, because it may contain rows the
  old one could never see. Here it contained 7, and one of them reached a record write.
- 🔴 **`applyPatches` is TWO passes**, not just the NDA-017 migration. Measure the pair through the
  whole call or the reading is partial.
- 🔴 **A peer's uncommitted work can be entangled with yours through a GENERATED file.** ✅ Check
  mtimes to see whether the peer is live or the work is idle, and ask before landing it.
- 🔴 **`test:ci` writes `packages/noodl-editor/tests/test-results.json`.** Delete it first and
  require a **fresh mtime**; the exit code alone can lie.
- 🔴 **A spec absent from `tests/nodegraph/index.ts` never runs.**
- 🔴 **`grep -a` always** — ugrep's `-I` skips source files as binary, silently.
- 🔴 **Assert `count(anchor) == 1`** before every python heredoc replace — and **write the file**;
  s31 lost one edit to a script that asserted, printed, and never called `.write()`.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never stage tracked
  files.
