# DEF-006 — The design system punishes the agent that uses it

**Rank 6.** Sources: phase 78 **D12**, **D15** and **D20**. All **NONE**-owned.

Cheap, and it removes a standing reason the next template arrives unstyled.

---

## ✅ STATUS 2026-08-29 (s8) — DONE. §3's scope closed at s7, §0's (c) at s8.

**Both scope items landed, all five acceptance criteria are met, and one thing this
file did not ask for turned out to be the larger half of the defect.** Read §6 before
believing any present-tense sentence below it: §0's *"18 compositions ship"* is now
**26**, and §2's *"confirmed at HEAD"* has been acted on.

| what | where |
|---|---|
| (a) `primaryButton` no longer sets a port its own `borderStyle` switches off | `StyleCompositions.ts`, and `ui-split-hero` it was copied from |
| **the rule itself was wrong in two of eleven cases** | `parameterValues.ts` + `portConditions.ts` — see §6.1 |
| the 4 recipes with the same shape, and 5 more with a `label` nobody sees | `docs/node-catalog/examples/` — **11 → 0** |
| `catalog:examples` now grades this family, so it cannot come back | `scripts/validate-examples.ts` |
| (b) `find_tools` finds a group by what it is *for* | `disclosure.ts` + a `keywords` field that costs **zero** resident tokens |
| AC5 — the template's workaround has lapsed, asserted | `tpl001Template.test.ts` §4b |
| **(c) six compositions: field, fieldLabel, textField, fieldError, fieldHint, emptyState** | `StyleCompositions.ts` — see **§7** |
| the contrast gate graded one ground where a form sits on another | `design-token-contrast.test.ts`, arm (e) — **§7.3** |

✅ **§0 (c) — the missing compositions — CLOSED at s8. Read §7, not §6.4.** The six
compositions landed and the vocabulary is now 26. 🔴 **§6.4's one judgement was wrong
and §7.1 has the measurement**: it proposed sourcing `fieldError` from `--destructive`,
which fails AA as text in two of the five presets. `--red-700` was kept. §6.4 is left
in place as the survey it was, but every sentence in it about *which token* is
superseded.

⚠️ **D20 was agreed into this task by both sessions on 2026-08-29 and then sat in a chat message
for a day without reaching the file.** It is recorded here because that is the exact failure the
whole phase-80 process exists to stop: an agreement is not an owner.

## 0. (c) The vocabulary has no composition for a field, a notice or an empty state — P78 D20

Measured 2026-08-29 over `StyleCompositions.ts`: **18 compositions ship**, and searching their ids
for `field`, `input`, `label`, `notice`, `alert` and `empty` returns **nothing** for all six.

```
band · bandSurface · shell · sectionHead · card · cardBody · primaryButton · outlineButton
cardImage · gridAutoFit · columnsTwoUp · displayHeadline · sectionHeading · cardTitle
eyebrow · lead · body · meta
```

Everything the system names is **page furniture**. Every app also has forms, validation messages
and empty lists, and for those an author has no recipe to follow — so they invent parameters, which
is the divergence (a) and (b) punish them for on the parts that *are* covered.

🔴 **This is the mechanism behind P78 D10** (the generators bypass the design system): a generator
cannot apply a composition that does not exist. D10 is the symptom seen from the generator; this is
the cause seen from the vocabulary. ⚠️ **Fixing this may make D10 fixable without fixing D10** —
re-measure D10 after, do not close it on this.

**Where it bites:** every agent authoring any app with a form, which is nearly all of them.

## 1. (a) `primaryButton` ships a parameter the runtime never reads

Applying `composition('primaryButton')` verbatim produced **12 `warning
inactive-conditional-parameter` diagnostics** on one generation run:

> *`net.noodl.controls.button`'s "borderWidth" only applies when borderStyle is solid or dashed or
> dotted, so this parameter is never read.*

The composition sets `borderStyle: 'none'` **and** `borderWidth: 0`. Both are its own.

🔴 **`get_style_vocabulary` presents compositions as *"ready-made parameter sets… each naming the
recipe that shows it assembled"*.** An agent that follows the design system exactly as instructed is
rewarded with a warning per button, and its only options are to **ignore a real diagnostic** or to
**diverge from the system**. Both are bad lessons, and the first one is how a real diagnostic stops
being read.

✅ Repaired *at the point of use* in `tpl001Components.ts` (`withoutInertBorderWidth`) — **one
template, no users.**

## 2. (b) `find_tools` searches tool NAMES only

**Confirmed at HEAD**, `packages/noodl-mcp/src/tools/disclosure.ts:395-398`:

```ts
const needle = args.query.toLowerCase().trim();
const matches = TOOL_GROUPS.flatMap((g) => g.tools).filter(
  (name) => needle.length > 0 && name.toLowerCase().includes(needle)
);
```

Group titles and purposes are never searched. So the group whose title is **"Design tokens"** and
whose purpose is *"change the design system"* holds `set_project_tokens` and `set_style_preset` — and
`query: "theme"`, `"design"`, `"colour"`, `"style guide"`, `"palette"` all reveal **nothing**, while
`group: "theme"` reveals both.

🔴 **This is a contributing cause of phase 78's D10** — *"the template generators bypass the design
system"*. The style write tools are deferred behind disclosure; an agent told to style on-system
searches for the words it is thinking in and is told there is nothing there.

## 3. Scope

1. Remove `borderWidth` from the `primaryButton` composition (and audit the other compositions for
   the same shape — a parameter inert under the composition's own other parameters).
2. Match `find_tools`'s `query` against **group titles and group purposes** as well as tool names.

## 4. Acceptance criteria

1. **A person's sentence:** *when I ask the thing I am building for the tools that change how my app
   looks, using the words I would actually use, it shows me them.*
2. Applying every shipped composition verbatim to its documented element type produces **zero**
   `inactive-conditional-parameter` diagnostics. 🔴 Over **all** compositions — the audit is the
   task; `primaryButton` is the instance.
3. `query: "theme"`, `"design"`, `"colour"`, `"palette"`, `"style"` each reveal
   `set_project_tokens` and `set_style_preset`.
4. A **negative arm**: a query matching nothing still reveals nothing. Widening a search until it
   matches everything is not a fix.
5. `tpl001Components.ts`'s `withoutInertBorderWidth` workaround **lapses** — it was written as a rule
   so it would. Assert it is a no-op afterwards rather than deleting it silently.

## 5. Traps

- 🔴 **MCP has three budgets and the tool surface has a token gate.** Matching more text does not
  change the surface, but adding fields to the response might — measure `toolDisclosure` before and
  after.
- ⚠️ **A stale `dist/` hides a merged change** and can refuse correct work. Run the tool's functions
  **from `src`** when measuring.
- 🔴 **A checker's population is part of the checker.** "Zero warnings" over the compositions this
  template happens to use is not "zero warnings over the compositions we ship".


---

# 6. What s7 did, and the two things it found that this file did not contain

## 6.1 🔴 The rule was wrong, and its own contract test could not see it

**Two of the eleven `inactive-conditional-parameter` in the shipped recipes were the
rule's false positives.** `ui-slide-over`'s close button sets `useIcon: true` and
nothing else, and the validator reported `iconIconSource` and `iconColor` as never
read. They are read: `iconSourceType` **defaults to `icon`**, and the condition
`useIcon = true AND iconSourceType = icon` is satisfied by that default.

The cause is one line of semantics. `conditionIsUnsatisfied` was answered from the
**authored parameter bag**; the canonical evaluator asks `node.getParameter(name)`,
whose tail is `return port ? port.default : undefined`. So every unset gate read as
the string `"undefined"`, which no condition ever matches.

✅ **Fixed by resolving the bag against the node type's catalog defaults before
answering a condition** — `resolveAgainstDefaults` in `portConditions.ts`,
`CatalogIndex.inputDefaults`, one call site. `NOT SET` survives the merge because
canonically it means *"unset and no default"*, not *"unauthored"* — `Group.width`'s
`sizeMode NOT SET` clause is carried by `sizeMode`'s `explicit` default either way.

**Measured before it landed**, over the compositions, all 62 catalog examples and the
40 projects in `NodeGX test projects` (1,601 nodes): **3 findings removed, 0 added.**
⚠️ A zero is worth nothing without a control, so the sabotage — letting defaults
*win* over authored values — was run on the same corpus and moved it to **70 added**.
The instrument can see a new finding; there were none.

🔴 **`portConditions.test.ts` asserted agreement between the two evaluators for its
whole life and could not have caught this.** Its stand-in for the canonical evaluator
was `getParameter: (name) => parameters[name]` — a bag lookup, with the default
fallback deleted. It modelled away the one behaviour the two differed on. *A gate
cannot find what its own model deletes*, and this is the second file in this repo to
write that sentence about itself (`validate-examples.ts` has it too). A **type-aware**
arm now walks every declared port group of every shipped type and gives both
evaluators that type's defaults, with a negative arm that fails if the defaults are
dropped.

## 6.2 The corpus, and why the recipes were in scope at all

The compositions' own doctrine is that every parameter is **copied out of a shipped
recipe** and that any of them can be diffed against its source. Repairing
`primaryButton` and leaving `ui-split-hero` carrying the value would have deleted the
one property that doctrine claims. So the recipe went too — and once it did, the other
three with the identical shape were free.

| shape | count | fix |
|---|---|---|
| `borderWidth` under `borderStyle: "none"` | 4 recipes | drop the width; `borderStyle` was the whole instruction |
| `label` with `useLabel` defaulting to `false` | 5 controls in 2 recipes | `useLabel: true` |
| `iconIconSource` / `iconColor` under a defaulted `iconSourceType` | 2 | **the rule**, not the recipe |

⚠️ **`logic-consent-gate` demonstrated a consent form whose four checkboxes render no
words at all.** `addLabelInputs` writes the ` OR useLabel NOT SET` clause only when the
default is `true` — which is `Button` and not `Checkbox`, `TextInput` or
`RadioButton`. Confirmed at the runtime source (`Checkbox.tsx`'s `if (props.useLabel)`),
not from the catalog alone.

`catalog:examples` now runs the `inactive-conditional-parameter` / `inert-dimension`
family. 🔴 **Deliberately not the rest**, and with today's numbers rather than
LAS-007's: 2 `invalid-parameter-value`, 1 `unsized-absolute-box`, 1
`raw-color-literal`, plus 28 `dynamic-port-skipped` and 11
`unknown-type-check-skipped` notices that report a check *not run*. LAS-007's argument
for deferring those is unchanged; what changed is that the fourth family had grown
from 7 to 11 and had reached the design system itself.

## 6.3 (b), and the two sentences that were already promising it

`find_tools`' own description said *"search names and descriptions across everything"*
and its `query` parameter said *"free-text over tool names and titles"*. **Neither was
true.** The contract had been written; the code was the half that drifted. Both
sentences are now accurate, and the surface went **8,255 → 8,254** tokens saying so.

Group matching reads the **id, the title and a new `keywords` array — deliberately not
the `purpose` prose**. `backend`'s purpose contains "roles", so searching it would turn
`query: "role"` from four tools into all sixty and report the group advertised,
breaking a written contract (*a partial reveal must not claim the group is advertised,
or a model has no reason to ever ask for the rest of it*). Ids, titles and keywords are
short and chosen; prose matches everything eventually.

✅ **`keywords` is rendered into nothing**, which is what makes it free. Two comments in
`toolGroups.ts` had each recorded a discoverability cost taken deliberately — `project`
does not mention kits, `explore` does not mention prefabs — and both ended *"widening
the purpose costs resident tokens and belongs in the next budget renegotiation"*. This
is that widening at **8,255 before and 8,255 after** (the -1 came from the description
correction, separately). The renegotiation those notes were waiting for is not needed.

⚠️ **A tripwire fired and was right to.** `kitTools.test.ts` carried a control asserting
`query: "custom node"` reveals nothing, written *"to fail the day somebody widens the
purpose line, so the trade-off is re-decided deliberately rather than drifting"*. It
did its job; the decision was re-made against the measured cost and the test now
asserts the opposite, beside a new AC4 control that a query matching nothing still
reveals nothing.

## 6.4 🔴 §0 (c) — the sourcing survey, so it is a work-list and not a re-derivation

> ⚠️ **SUPERSEDED IN ONE PLACE — read §7.1 before acting on the table below.** The six sources
> are correct and were used verbatim. **The `field_error` judgement is not:** moving it to
> `--destructive` fails AA as text in two of the five presets, measured. `--red-700` was kept.
> The contrast reassurance in this section is against `--background` and against the default
> palette only, which is the thing its own next line warns against.

(c) is a **sourcing** task, not a design one: `StyleCompositions.ts`'s doctrine is that
a composition which cannot be grounded in a gated recipe is **left out rather than
invented**. The survey says it can now be grounded — which is the thing §0 did not
establish.

| composition | source | status |
|---|---|---|
| `field` (Group, column, `--space-2` gap) | `ui-form-field` › `field` | groundable, verbatim |
| `fieldLabel` (Text, `--text-sm`, `--font-medium`) | `ui-form-field` › `field_label` | groundable, verbatim |
| `textField` (the styled `textinput` itself) | `ui-form-field` › `field_input` | groundable, verbatim — **the biggest hole**, no composition has ever named a control that takes typing |
| `fieldError` | `ui-form-field` › `field_error` | 🔴 **one decision first** — see below |
| `fieldHint` (Text, `--text-xs`, `--muted-foreground`) | `ui-form-field` › `field_hint` | groundable, verbatim |
| `emptyState` (Group, centred, ruled, `--surface`) | `ui-empty-state` › `root` | groundable, verbatim |

🔴 **The one judgement: `field_error` reads `var(--red-700)`, a raw palette token.** The
semantic token for this exists — `--destructive`, `#dc2626`, described *"Dangerous
actions and errors"* — and a preset that re-themes an app moves `--destructive` and does
**not** move `--red-700`. Copying the recipe verbatim would ship a composition whose
error text no theme can reach, which is *a token nothing reads is a theme nobody sees*
with the arrow reversed. The recipe should move to `var(--destructive)` first and the
composition be sourced from that; DEF-001's own note pins red-600 at **4.83:1** against
white, so the contrast floor survives the move. ⚠️ Verify against every preset, not just
the default — that is DEF-001's whole lesson.

⚠️ **Not done this session and the reason is stated rather than implied:** it is five
new compositions plus a token decision plus a recipe edit plus a contrast pass, none of
it covered by an acceptance criterion — and a peer was regenerating `templates/members-area`
from `tpl001Components.ts` throughout, which reads `VOCABULARY.compositions`. Landing new
compositions into a file a peer is mid-generation against is the collision worth not
having.

## 6.5 Gates at close

`test:ci` **2889 specs, 4 failures, all four `AIX-006 style vocabulary` by name** — the
floor, fresh seed 75151, readout mtime fresh · `noodl-mcp` **956/956** · `catalog:examples`
**60/62, unchanged from before the session** (see §6.6) · `typecheck:editor`,
`typecheck:editor-tests`, `typecheck:mcp`, `catalog:check`, `catalog:merge:check`
(regenerated — the examples are one of its inputs), `catalog:groups:check`,
`docs:nodes:check` all clean.

**Mutants: 4 applied, 4 killed.** Restoring `primaryButton`'s `borderWidth` reddens the
AC2 audit; answering conditions from the authored bag again reddens `catalog:examples`
with the two false positives; letting defaults win reddens five specs; disabling group
matching reddens both (b) suites.

## 6.6 ⚠️ A red PR gate that is not this task's, measured rather than assumed

**`catalog:examples` is a PR CI gate (`pr.yml:210`) and it exits 1 at HEAD**, at
**60/62**, and did so before this session touched anything:

- `comp-repeater-set-item-object` — `signal-into-value-port` on a checkbox's `checked`
- `fn-aggregate-stats-function` — `failure-reaches-nothing` on a cloud aggregate

Both example files date to `c0d6c86f` (2026-07-23) and are unchanged since. **What
changed is the rules**: `failure-reaches-nothing` was promoted by DEF-002 on 2026-08-29,
and `catalog:examples` is warnings-as-errors. DEF-002's closing note says what is left of
that rule's corpus is *"two deliberately-malformed test probes"* — these are neither.
They are shipped recipes teaching the two defects phases 76 and 77 filed as findings, to
every agent that calls `get_example`.

🔴 **Not fixed here, on purpose.** Making it green would hide that a closed task's
rollout left a red gate, and the fix is a graph edit to two recipes that wants its own
row. Registered in `TASKS.md` with an owner slot rather than left as a sentence in a
task file.

---

# 7. ✅ (c) — CLOSED 2026-08-29 (s8), and §6.4's one judgement was wrong

**All six compositions landed, sourced verbatim.** The vocabulary is **26** compositions, and it
now names a field, a label, a control that takes typing, an error line, a hint and an empty state.

| composition | group | source node | notes |
|---|---|---|---|
| `field` | arrangement | `ui-form-field` › `field` | the column every form is made of |
| `fieldLabel` | type | `ui-form-field` › `field_label` | — |
| `textField` | control | `ui-form-field` › `field_input` | **the biggest hole** — no composition had ever named a control that takes typing |
| `fieldError` | type | `ui-form-field` › `field_error` | 🔴 **kept `--red-700`** — see below |
| `fieldHint` | type | `ui-form-field` › `field_hint` | — |
| `emptyState` | surface | `ui-empty-state` › `root` | dashed, `--border-strong` |

## 7.1 🔴 §6.4 said to move `field_error` to `--destructive`. Measured, that ships a defect.

§6.4's judgement was that `--red-700` is a raw palette token no preset re-themes, that
`--destructive` is the semantic token for the job, and that *"DEF-001's own note pins red-600 at
4.83:1 against white, so the contrast floor survives the move."*

**The first two are true. The third is the reading, and driving it inverted the decision.** As
14px text on the `--surface` a form card sits on, across the six shipped palettes:

```
--red-700      6.03 – 6.20:1     passes in all six
--destructive  4.38 – 6.18:1     FAILS in two — Playful 4.38, Soft 4.49  (AA floor 4.50)
```

`--destructive` is a **fill** colour, sized for white text on top of it, and Playful and Soft move
it to rose `#e11d48`. Taking §6.4's advice would have shipped an error message two of the five
presets render below AA — in the composition an agent is told to copy, into every form.

**Two things went wrong in that one sentence, and both are named traps:**

1. 🔴 **It measured against `--background` (white), not the ground the thing sits on.** 4.83:1 is
   `--destructive` on white. On `--surface` the same token is 4.62:1. The gap is small in the
   defaults and decisive in Playful.
2. 🔴 **It measured the default only — and its own next line said not to.** §6.4 ends *"⚠️ Verify
   against every preset, not just the default — that is DEF-001's whole lesson."* The survey wrote
   the warning and then did not take it. Both failing readings are preset-only.

## 7.2 ⚠️ The recipe was right, and its stated reason had gone stale — the conclusion outlived its evidence

`ui-form-field`'s own description already said *"The error line is --red-700, not --destructive"*,
and §6.4 read that as the defect to fix. It was not. But its **number** was stale: it said
`--destructive` measures **3.60:1** and fails AA, which is exact — for `#ef4444`, the value
`--destructive` held when that sentence was written on **2026-08-11**. DEF-001 moved it to
`#dc2626` on **2026-08-29 09:39** (`30eb92b2`), which is 4.62:1 and passes.

So at HEAD the recipe's *conclusion* was right and its *evidence* was false, and the thing that
still carries the conclusion — the two presets — is not what the sentence cites. Rewritten to be
true at HEAD, with the presets as the reason and the stale number named rather than deleted, so
the next reader does not "correct" it back.

🔴 **The shape worth keeping: a stale measurement does not announce itself by being wrong.** This
one had been right, was cited approvingly, and the conclusion it supported never stopped being
correct. Only the reason changed. **Re-measure a cited number when the thing it measures has
moved — `git log -S` on the value is the ten-second check.**

## 7.3 🔴 The gate would have passed the proposal — a hole shaped exactly like the defect

`design-token-contrast.test.ts` grades text with no declared background against **`--background`
only**. Measured on the real proposal:

```
--destructive as text, no declared ground:
  on --background   4.66 – 6.47:1   passes in ALL SIX palettes
  on --surface      4.38 – 6.18:1   fails in two
```

**The gate that exists to catch exactly this would have reported nothing.** Fixed: `groundsOf`
replaces `backgroundOf` and returns both implicit grounds, so a colour must clear its floor on
either surface it can land on. **Free at HEAD** — the population went **55 → 86 pairs (330 → 516
readings)** and nothing reddened.

Pinned by a new arm **(e)**, which plants the regression that is *invisible* on `--background` and
asserts it is caught, is caught **only** on `--surface`, and **only** in `playful` and `soft`.
🔴 **Narrowing `groundsOf` back to one ground reddens arm (e) and nothing else** — verified by
mutant; the other twelve tests stay green, which is the hole it now guards.

⚠️ Stated because an unstated limit reads as coverage: this is still not *every* ground. A
composition nested on `--surface-raised`, or on a fill an author sets at runtime, is outside it.
`--surface` is the darkest ground **the vocabulary itself ships**, not the darkest that can exist.

## 7.4 🔴 What is actually missing, and it is not this task's to invent

There is **no semantic token for error TEXT** — one a preset moves *and* that clears 4.5:1 as type.
`--destructive` is the only semantic red and it is a fill. That is why `fieldError` has to reach
for a raw palette token to stay legible, and why a re-themed app keeps a brick-red error line.

Adding one means adding it to `DefaultTokens.ts` **and all five presets**, and choosing five values
that clear AA as text — a design decision with a contrast budget attached. **Registered in
`TASKS.md` as its own row rather than invented here**, per this file's own doctrine that a
composition which cannot be grounded is left out rather than made up.

## 7.5 Gates at close (s8)

`typecheck:editor`, `typecheck:editor-tests`, `catalog:check`, `catalog:merge:check`,
`catalog:groups:check`, `docs:nodes:check` — **clean** · `styleVocabularyPorts` **13/13** ·
`design-token-contrast` **13/13** · `noodl-mcp` **956 passed** (2 failures in
`tpl001Template.test.ts`, from a peer's uncommitted `templates/members-area.security.json`) ·
`catalog:examples` **60/62 — unchanged, the same two `NONE`-owned recipes** ·
⚠️ `typecheck:mcp` red on **one** error in a peer's uncommitted `tests/tpl001Cloud.ts`
(`TOKEN_PRELUDE`, mid-refactor).

✅ **`test:ci` RAN after the peer announced teardown: 2889 specs, 4 failures, all four
`AIX-006 style vocabulary` BY NAME — the documented floor**, seed **74947**, readout mtime 19s
old (`test-results.json` deleted first, so a stale file could not pass as this run).
`3a112837` verified an ancestor of the compiled HEAD. ⚠️ The runner printed
`HEAD b25bc914`, which is a **P18 peer's docs commit made 18 seconds earlier** — `gitHead` is the
checkout at read time, never authorship.

⚠️ **The peer also offered their own floor reading (seed 07472), taken at 16:28 — after this
commit landed at 16:08, so it did compile this change.** It was not adopted as evidence: a relayed
measurement about somebody else's run is not a reading of your own commit, and the independent
seed is what makes the floor a floor rather than a repeat.

**Mutants: 3 applied, 3 killed.** An unknown token on `fieldError` reddens the token check *by
name*; reverting `textField` to the shipped `sizeMode: 'contentSize'` reddens the AC2 inert gate
with the catalog's own condition (`width` is off under `sizeMode = explicit OR contentHeight`) —
which is the recipe's measured 196px trap, confirmed from the catalog rather than the prose;
narrowing `groundsOf` reddens arm (e) alone.
