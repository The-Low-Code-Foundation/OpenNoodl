# DSG-004 — what shipped, what it was calibrated against, and what is still unmeasured

**Worked 2026-08-11**, in a worktree off `cline-dev` tip `80868946`. Every number here comes from
`measurements/`, which runs the **shipped** checks over both corpora — 107 projects, 72 in this
repository and 35 in `../NodeGX test projects` — rather than a JS re-implementation of them.

## The short version

| §  | Rule | Severity | Corpus hits | State |
|----|------|----------|-------------|-------|
| 2.1 | `uncollapsible-multi-column` | warning | **20** in 11 of 107 projects | ✅ built, calibrated, **not** authored-blocking |
| 2.2 | `inert-dimension` | warning, **blocks authored output** | **58** in 10 projects | ✅ built — but the *detection* already existed; see the deviation below |
| 2.3 | `monotone-typography` | info, never blocks | **6** in 2 projects | ✅ built |
| 2.4 | an interactive node with no hover state | — | — | 🔴 **not built, premise refuted** — it is a vocabulary gap, not a gate |
| 3   | the two render-time checks | — | — | ✅ already implemented in `@nodegx/render-measure`; nothing to add |

`test:main` after: **117 suites, 1,627 tests, all passing** (baseline before the work: 114 suites,
1,600 tests, of which 2 failed — both were assertions about the code §2.2 changed, and both were
updated rather than suppressed). `npx tsc -p packages/noodl-editor --noEmit` clean.
`npm run catalog:examples`: 57/57 clean.

## §2.1 — `uncollapsible-multi-column`, the gate behind doctrine §7

Doctrine `§7` is the only mechanical claim in the design doctrine about the runtime's one responsive
mechanism, and it had nothing behind it. Two arms:

- **a band of tracks** — a row `Group` with ≥3 visual children of ≥3 nodes each, not sized to its own
  contents, with no `Columns` ancestor;
- **a wrapped grid** — a wrapping row `Group` with its own `columnGap` parenting a `For Each`.

### Calibration (`measurements/explore-rows.ts`, `explore-bands.ts`, `explore-wrapgrids.ts`)

1,855 `Group` nodes, **516 of them `flexDirection: "row"`**. Sweeping both thresholds:

| Predicate | Hits | Projects |
|---|---|---|
| ≥2 visual children | 402 | 21 |
| ≥3 visual children | 110 | 18 |
| ≥3 children, each ≥2 nodes | 27 | 11 |
| ≥3 children, each ≥3 nodes | 19 | 11 |
| …and not content-width-sized (**shipped**) | **15** | **9** |
| ≥3 children, each ≥4 nodes | 6 | 5 |

Two thresholds rather than one, exactly as `repeated-sibling-subtree` uses two. The **per-track**
floor is what separates a band of cards from a cluster of controls, and it has to apply to *every*
track: a stepper (`−  1  +`) and a five-star rating row are 3–5 children of 2–3 nodes each, which is
indistinguishable from a small band by total subtree size.

The **content-width exclusion** is the discriminator that took the authored false-positive rate to
zero, and it was found by printing the candidates' own parameters rather than guessing:

```
test ecommerce-example /Pages/Home "Trust shell"   sizeMode=undefined width={100,'%'}   ← fires
test phase55-replay-sonnet /Sections/Footer        sizeMode=undefined width={100,'%'}   ← fires
repo big-merge-test-mine "filter ratings"          sizeMode="contentSize"               ← silent
repo project /#Supabase Prefab/UI/Supabase Header  sizeMode="contentHeight"             ← silent
```

A band owns the page's width; a cluster is as wide as its contents.

Arm B is sharper still. Of the **45** row Groups that parent a `For Each`, **36** are legacy chip,
pill and carousel lists whose spacing comes from the items, and **3** carry a `columnGap` of their
own: `Puppy test 3`'s puppy grid, the reference build's featured grid, and sonnet's product grid. All
three are the defect. `columnGap` is not a proxy invented here — `§7`'s last bullet names it: *"a
percentage gap on a wrapped Group is a desktop-only trick and stops being one the moment the layout
must collapse."*

### The 20 hits, inspected

| Where | What | Verdict |
|---|---|---|
| `ecommerce-example` ×5 | header shell, footer top, trust shell, featured grid, category row | the defect — **the acceptance criterion** |
| `ecom-responsive-probe` ×2 | the reference build's copy | the defect |
| `phase55-replay-sonnet` ×3 | InfoStrip, Footer, FeaturedProducts grid | the defect |
| `phase55-replay-haiku` ×2 | InfoStrip, Footer | the defect |
| deepseek ×3 (one project, three copies) | NavBar | the defect |
| `Puppy test 3` ×1 | puppy card grid | the defect |
| legacy hand-built ×4 | a filter popup row, a slot-picker row, a Supabase header, a symptom-chip group | borderline; none is authored output, and no authoring gate ever sees them |

**0 hits in the recipe library** (`docs/node-catalog/examples`, 57 files) — the F23 check, run
explicitly, because the corpus that exists to teach the right shape has shipped the wrong one before.

### Why it is a warning and not blocking, yet

The case for blocking is real: LAS-004 measured warnings ignored by three models out of three, and
rejections carrying a suggestion self-corrected at a 100% rate. But `repeated-sibling-subtree` was
promoted on evidence that it had *already* fired correctly on every measured build, and this rule has
never run against one. Two measurements would settle it, and neither was available here:

1. a DSG-006 replay, which is the only honest test of whether a warning is ignored — **it costs
   $5–8**, so it was not started;
2. one run of the editor's jasmine suite, which builds authoring candidates inline and is the one
   population `measurements/` cannot see. `test:ci` was off-limits in this worktree.

Static evidence in favour of promotion, for whoever makes it: the AI specs' inline fixtures are
one- and two-node Groups (`{ flexDirection: 'column' }`), and a grep of `packages/noodl-editor/tests`
and `packages/noodl-mcp/tests` for a row Group with three children of three nodes each finds nothing.

## §2.2 — ⚠️ the spec is wrong about the current code

> §2.2: *"This is a pure parameter check, needs no graph traversal"* … filed as 🔴 open.

It is not open. `checkParameterValues` has reported it since phase 54 as
`inactive-conditional-parameter`, and it fires on exactly the described shape — verified before
anything was written, against a synthetic `Image { width, height, objectFit }` with no `sizeMode`:
three warnings, one per port. The catalog carries the conditions in
`dynamicPorts.declaredPortGroups` (`"sizeMode = explicit OR sizeMode = contentHeight"` for `width`),
generated from `addDimensions` in `node-shared-port-definitions.ts`, and `conditionIsUnsatisfied`
already evaluates an unset `sizeMode` correctly.

What was actually missing is what the acceptance criteria ask for:

- **it could not be promoted.** Severity policy is per *code*, and the general code carries **366**
  corpus hits across a dozen unrelated conditions (`borderWidth` 67, `borderColor` 46,
  `showScrollbar` 30 …). Promoting all of them is a different decision with different evidence.
- **the message named the defect and stopped.** *"…so this parameter is never read"* is the half of a
  rejection a model argues with.

So the `sizeMode` family now reports as `inert-dimension`, keyed on the *condition* rather than a list
of type names — the trap is declared once by `addDimensions` and inherited by whichever visual type is
added next — with the exit in the same sentence, and both modes that reach it (`contentHeight` is as
often the right repair as `explicit`).

**58 hits in 10 projects**: `Group.height` 19, `textinput.width` 8, `textinput.height` 7,
`Group.width` 7, `button.height` 6, `Text.height` 5, `options.width` 3, `Text.width` 2,
`button.width` 1. The canonical one is `Puppy test 3`'s admin form — six Text Inputs at
`width: 100%`, rendering at 170px, which is doctrine `§8`'s own sentence measured on disk.
**0 of the 204 `Image` nodes in either corpus**, so this promotion cannot fire on the population `§5`
already taught correctly.

Blocking for authored output, on the `UnitlessDimension` argument exactly.

### A second finding while measuring it

**121 of 204 `Image` nodes carry no explicit box at all** (no `sizeMode: "explicit"`, no `width`, no
`height`) — the shape doctrine `§5` warns about, and the one that produced 800px-tall photographs.
That is 59% of every Image in both corpora, so it is **not** a gate: a rule with that hit rate teaches
an agent to distrust the set. Recorded as a doctrine line that is already written and a render-report
question (`elements-overflowing` sees the consequence).

## §2.3 — `monotone-typography`

Info, page components only, floor of 8 text-bearing nodes, and it fires only on the *total absence* of
`fontWeight` (all 22 corpus components that are monotone are the absence, and a page that has started
a hierarchy is not this check's business).

The census is the interesting half: across 429 components carrying text, **every `fontWeight` ever
authored is a token** — `var(--font-semibold)` 88, `var(--font-bold)` 43, `var(--font-medium)` 21,
`var(--font-normal)` 13 — and **no measured model replay is monotone**. The doctrine line is winning
on its own. So this is the `oversized-page` shape of rule: a backstop against a regression, at the
severity that costs nothing when it is wrong. Its 6 hits are two prefab auth pages and four
`agent-chat` developer pages.

Its render-time twin, `flat-type-scale`, sees what this cannot — a token that *resolves* to 400 — and
this one sees what that cannot: a page that has not been rendered, which is every page at the moment
it is authored.

## §2.4 — 🔴 the premise does not hold, and the spec asked for that to be checked

- A hover state **is** expressible: 9 node types declare a `hover` visual state, and the override
  lives on the stored node as `stateParameters.hover` —
  `{ "hover": { "backgroundColor": "Grey - 300" } }` in the shipped `navigation-menu` prefab. **41**
  nodes across both corpora carry one.
- Every one of those 41 is in this repository's prefab library or a legacy fixture. **Zero** are in a
  model-authored project, against **235** interactive nodes corpus-wide.
- And the reason is not laziness: `stateParameters` is **not in `AUTHORED_NODE_FIELDS`**. It reaches
  disk through MCP only because that schema is `.passthrough()`, and it **cannot be expressed in the
  editor's authoring loop at all** — `candidate.ts` carries it over from the base instead.
  `SURFACE_DIVERGENCES` already records this as AAQ-011 F14.

A gate here would reject an in-editor candidate for the absence of something that loop cannot
produce, on 100% of the population it judges. That is the recorded trap about an offer that promises
a wire it will not draw. **§2.4 is a vocabulary change** — teach `stateParameters` to both doors,
with the gate as its consequence — and it belongs beside DSG-005, not here.

## §3 / F19 — already closed in code, not merely recorded

The task file records the division as a decision. It is already implemented: `@nodegx/render-measure`
carries `horizontal-overflow` and `elements-overflowing` (§11's check 1), `single-column-grid` (check
3) and `flat-type-scale` (check 2, at a floor of 10 text elements). `scripts/devtools/render-report.js`
needed no change and got none.

## Could not verify

- **The editor's jasmine suite** (`test:ci`) and any live editor drive — both off-limits in this
  worktree, since they reap processes belonging to the session working in the primary checkout. The
  new checks are pure functions with no renderer dependency and are covered by `test:main`, but the
  inline authoring fixtures in `packages/noodl-editor/tests/ai/**` were only *grepped*, not run.
- **Whether a model obeys the new warning.** That is DSG-006's replay and it costs money; not started.
- **The full `noodl-mcp` jest suite.** The three gate suites (`interfaceGate`, `gateParity`,
  `stagingDiagnostics`) pass; the rest was left alone because parts of it provision backends on ports.
- `npx tsc -p packages/noodl-mcp/tsconfig.json` reports **6 pre-existing errors** in
  `tests/interfaceGate.test.ts` and `tests/stagingDiagnostics.test.ts` (`Property 'text' does not
  exist on ToolCallResult<…>`). Confirmed identical on the base commit `80868946` — not this task's,
  and not fixed here.

## Register — proposed

| # | Finding | State |
|---|---|---|
| F17 | Doctrine `§7` has no gate at all | ✅ **closed** by `uncollapsible-multi-column` — 20 corpus hits, 5 of them on the reference build. Promotion to authored-blocking is open and needs a replay |
| F18 | `sizeMode`-gated inert dimensions have no gate | ⚠️ **the premise was wrong** — the gate existed as `inactive-conditional-parameter`. Closed differently: split into `inert-dimension`, given the exit, and promoted to blocking |
| F19 | Two of `§11`'s checks are not statically decidable | ✅ closed, and **already implemented** in `@nodegx/render-measure` rather than only recorded |
| F20 | *(new)* A hover state cannot be authored by the editor's loop at all, and is undeclared in MCP's vocabulary — so §2.4 cannot be a gate until AAQ-011 F14 is closed | 🔴 open, DSG-005-adjacent |
| F21 | *(new)* **121 of 204 `Image` nodes carry no explicit box**, the shape `§5` warns about. Too large a population to gate; the doctrine line already says it | 🔴 open, doctrine-only |

## Commits

```
6b8bdc44  the calibration corpus, loaded once with parameters attached
b7aec1c3  §2.1: uncollapsible-multi-column — the gate behind doctrine §7
455b1b62  §2.3: monotone-typography — doctrine §3, as an info that never blocks
0ed69905  §2.2: inert-dimension — the sizeMode family, split out and promoted
ebbe1502  the three codes, wired into the one gate both clients already read
2191cf7a  §2.4: the hover premise, checked — a vocabulary gap, not a gate
```

Reproduce every number with:

```
npx ts-node -P scripts/tsconfig.json dev-docs/tasks/phase-54-design-groundwork/measurements/calibrate-dsg004.ts
```
