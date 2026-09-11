# FLD-003 — what was built

**Session 17, 2026-09-11. 🟢 BUILT, 5 of 5 ACs.** `library/prefabs/advanced-columns` — a Columns
node with four bands instead of two, driven by a States node — plus the pointer to it on the port a
person is standing on when they want it.

🔴 **Two of this task's own claims were wrong, and one of them is the blocker the task was held on
for two days.** Both are recorded below with the measurement that replaced them. **This is the
fourth task running in this phase whose own file was wrong in more than one place** (FLD-004,
FLD-005, FLD-015, now FLD-003) — the standing instruction to *measure before believing a task file
in this phase* has now paid four times out of four.

## 1. 🔴 The wrong claims

### (i) "Hard-depends on FLD-004. Wiring a number into Horizontal Gap does nothing, and for the gaps it zeroes them." *(§2, §5)*

**It never did, and FLD-004 changed nothing about it.** The typo FLD-004 fixed
(`type:` for `unit:`) is in `Node.prototype.registerInput`, which is reached **only by dynamic
registration** — `nodedefinition.ts` gives a library node `_inputs = Object.create(inputs)` and
seeds `_inputValues` through `initializeDefaultValues`, which has always written `unit`.
`marginX` / `marginY` / `minWidth` / `mediumBreakpoint` are static library ports on
`net.noodl.visual.columns`. FLD-004's own commit says so in as many words — its reverted arm kept
*"the LIBRARY control green"* — and this task's file was written before that measurement existed.

Measured here, twice, independently of that:

```
$ git diff v0.2.2 HEAD -- packages/noodl-runtime/src/node.ts
```

**One hunk, and it is that typo.** So the path a wire into `Horizontal Gap` takes is
**byte-identical between the released 0.2.2 editor and this tree**, and the drive measures the gap
arriving as **24 / 20 / 16 px** over exactly those wires at four widths. There was no dependency:
FLD-003 was buildable before FLD-004 was, and the ruling it waited on (R3) was the only real gate.

⚠️ **What this costs to be wrong about is not nothing**: a dependency claim is why a task sits.

### (ii) AC1's *"change one breakpoint width in the States node"* — a States node cannot hold them

A States node publishes the values of **the state it is in** and nothing else. A list of thresholds
has to be readable *all at once* to decide which band you are in, so it cannot live in the node
whose whole contract is "one band at a time". Everything that varies **per band** is in the States
node (`Layout`, `Horizontal Gap`, `Vertical Gap`); the three widths the bands change **at** sit in
the Expression beside it — and, since they are the common edit, they are **also ports on the
instance**, so moving one needs no opening of the component at all.

That last part was built on a measurement rather than a guess, because the obvious objection is
that a component input carries **no default**, so wiring one in would replace a working default
with `undefined` on every instance nobody touches. **Driven both ways:**

| arm | reading |
|---|---|
| three ports wired, **nothing set** on the instance | all four bands still correct — 4 / 3 / 2 / 1 columns at 1280 / 1000 / 800 / 500px |
| `Medium Below` set to `1100` on the instance | 1050px reports **Medium**, where the default reports **Large** |
| the same, set as the **string** `'1100'` | identical — the editor types a component-instance port as `*` (FLD-004 §8), and the comparison coerces |

An input nobody sets does not arrive, so the Expression's own parameter stands. Both arms are in
the drive, as a pair: either one alone proves nothing.

### (iii) The discoverability hook cost what §2 said the *cheapest* one would, and needed no schema change

§2 priced the hook as `relatedNodes` *"plus a small schema extension"* to accept a prefab slug.
Built instead as **the port's own text**, which needs no schema change and reaches three surfaces
from one edit: the property-panel tooltip, `node-catalog.json` (what the MCP authoring loop reads)
and the enrichment (what the picker preview renders). One hook, as §3 asked; three renderings of it,
all generated from the node definition, all asserted.

### (iv) A deliberate departure: it keys off the node's measured width, not off `Breakpoint`

§2 says *"Advanced Columns must key off the Columns node's own new `Breakpoint` output (FLD-002)"*.
It does not, and the reason is the issue itself. `Breakpoint` reports one of **three** bands
(`pickBreakpointLayout`), and only when the node's **own** `mediumLayout` / `smallLayout` are set —
which is the two-slot limit #22 is about. Keying on it would have made a prefab whose answer to
*"I need more than two breakpoints"* is two breakpoints.

It keys on the Columns node's own `boundingWidth` instead. **The thing that mattered in that
sentence is kept**: the reading is the node's own box, so it is container-keyed, and a sidebar
instance and a full-width instance behave differently, exactly as `@container` does and
`window.matchMedia` cannot. AC5 is asserted against `matchMedia` and against the Media Query
prefab's components by name, beside a control that finds `matchMedia` in that prefab — an absence
is worth nothing without a signal known to fire.

## 2. What was built

**`library/prefabs/advanced-columns/`** — `library.json`, `icon.png`, `README.md`, `project/`.

| node | what it does |
|---|---|
| `Columns` | the node itself, with a `Component Children` inside it, so an instance takes your content the way a Group does |
| `Which band` (Expression) | `width < small ? 'Small' : width < medium ? 'Medium' : width < large ? 'Large' : 'Default'`, with 600 / 900 / 1200 beside it |
| `Breakpoint settings` (States) | four states, each carrying `Layout`, `Horizontal Gap`, `Vertical Gap` |
| `Component Inputs` | `Large Below`, `Medium Below`, `Small Below` — overrides, not requirements |
| `Component Outputs` | `Breakpoint`, the band the instance is in |

Shipped bands: `1 1 1 1` / 24px at 1200 and up, `1 1 1` / 20px, `1 1` / 16px, `1` / 12px below 600.

**The pointer** — `smallLayout`'s description and an extended tooltip on
`net.noodl.visual.columns`, regenerated into `node-catalog.json`, mirrored in the enrichment and in
the generated docs page (which had also been stale since FLD-002 — its Breakpoint ports were never
regenerated, and that regeneration is in this commit).

**Two harness fixes, both found by the instrument failing honestly:**

- `scripts/library/drives/harness.js` — a probe carrying `parent` is now written into the tree
  **both ways**, `children` on the parent and `parent` on the child. The first run of this drive put
  six tiles inside the prefab and measured an **empty page**: the loader builds from `children`.
- `scripts/library/render-check.js` — when a label-named component is a **slot** (`Component
  Children` and no text of its own) and the entry ships a demo, the demo is the showcase. Rendering
  a slot on its own measures the harness: this entry reported `DREW NOTHING` against a prefab that
  lays six tiles out in four bands. `page-header` and `table` also carry slots, ship no demo, and
  are unaffected — both re-rendered to confirm it.

## 3. The acceptance criteria

| AC | how it was measured |
|---|---|
| **1 (person)** | `node scripts/library/drives/advanced-columns.js` — a real Chrome, the real runtime, the prefab placed on a page with six tiles inside it and **nothing edited**: **4 / 3 / 2 / 1 columns** at 1280 / 1000 / 800 / 500px, equal widths at every band, and **back to four** on the way up (a latched band looks identical until you widen). Then the second half of the sentence, on a second instance: one width moved **on the instance** and the layout follows. |
| **2** | `library:check` — `OK prefabs/advanced-columns`, **zero warnings**, where the shelf carries 525. `library:build` + `library:verify-dist`: the entry is installable-shaped and `isModuleCompatible` passes (see §5 on `minEditorVersion`). |
| **3** | the gap is measured **as the distance between two rendered tiles**, not read off a style: **24 / 20 / 16 px** at the first three bands, and the mutant *unhook the `States → marginX` wire* leaves it at the authored 24 everywhere and reddens two arms. That is also the arm that settles §1(i). |
| **4** | `fld-003-advanced-columns-pointer.test.ts`, 9 specs. Every string it looks for is **derived from `library.json`'s own label**, so renaming the prefab fails the spec. The catalog copy is asserted **equal** to the source, not merely containing the prefab's name — a catalog that mentions it while the source has moved on is the staleness this exists to catch. |
| **5** | asserted as an absence **beside a control**: `matchMedia` is not in this prefab and **is** in `media-query`'s project, read by the same search. Plus the positive half — the band comes from the Columns node's own `boundingWidth`, which the spec follows wire by wire to `currentState`. |

## 4. Armed, not merely green

**Six mutants on the spec, six reds, control green**, every file restored byte-identical after each:

| mutant | reading |
|---|---|
| drop the pointer from the port description | 2 failed |
| rename the prefab | 3 failed |
| let the catalog go stale (one word) | 1 failed |
| put `matchMedia` in the prefab | 1 failed |
| unhook the width reading | 1 failed |
| take a band away (four states → three) | 1 failed |

**Two on the drive**: *unhook the gap wire* → 2 failed, *unhook the width reading* → 8 failed;
control 0 failed.

## 5. Gates

| gate | reading |
|---|---|
| `library:check` | 77/77 entries clean; this entry **0 warnings** |
| `library:build` → `library:verify-dist` | 46 prefabs, **3 with problems — all three pre-existing** (Format Date, Format Full Name, Sanitise Email, missing icons: **P38**, phase 85's) |
| `library:verify-origin` | was **already red** with four unpublished entries; baselined at five with the reason in the file (§6) |
| `library:drive` (all six) | **6 drives, 0 failing checks** — the five that existed plus this one, after the harness change |
| `library:render` | this entry draws; `page-header` and `table` re-rendered unchanged; `library:render:self-test` passes **including its known-bad floor** |
| `catalog:check`, `catalog:merge:check` | up to date |
| `noodl-viewer-react`, every columns-related suite | **11 suites / 100 tests**, 0 failures |
| `docs:nodes:check` | **71 problems, pre-existing and not mine** — see §6 |

⚠️ **The `noodl-viewer-react` suite was NOT run as a whole**, deliberately: a peer holds
`src/node-shared-port-definitions.ts` uncommitted, and running it would have graded their in-flight
code. Every suite that imports the node this touches was run instead.

🔴 **`minEditorVersion` is `0.2.2`, not `0.2.3`.** `verify-dist` fails an entry whose floor is above
the editor's own version — *"the card would render disabled"* — and `packages/noodl-editor` is
0.2.2 today. It is also the honest number: every node and port this prefab uses exists in
`v0.2.2` (checked against the tag), and §1(i) shows the value path is byte-identical.

## 6. What is registered, and what is left

- **P41 — `docs:nodes:check` has been red for a while and is in nobody's CI.** 71 problems: one
  missing page (`noodl-cloud-listusersinrole`, P80/DEF-005) and 70 stale ones, including the nodes
  P86 documented this morning. **Only the Columns page is regenerated here** and the other 70 were
  restored from `HEAD` rather than swept into this commit. Unowned.
- **Five library entries are authored and unpublished** and the origin baseline now records all
  five with that reason written into it. Publishing is a manual copy into the docs repo
  (`library/README.md` §Publish) and nothing in CI can do it. **The rows are the backlog, not an
  exemption**: publish them and the gate goes red the other way, printing the exact edit.
- **The prefab is not in the picker until somebody installs it**, and the pointer that tells them to
  is in 0.2.3 — so on 0.2.2 the prefab exists and nothing names it. That is what #22's reply says.
