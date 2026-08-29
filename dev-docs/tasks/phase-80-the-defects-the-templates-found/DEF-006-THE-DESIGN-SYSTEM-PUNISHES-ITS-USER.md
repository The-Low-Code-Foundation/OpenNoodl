# DEF-006 — The design system punishes the agent that uses it

**Rank 6.** Sources: phase 78 **D12**, **D15** and **D20**. All **NONE**-owned.

Cheap, and it removes a standing reason the next template arrives unstyled.

---

## ✅ STATUS 2026-08-29 (s7) — §3's SCOPE IS DONE. §0's (c) IS NOT.

**Both scope items landed, all five acceptance criteria are met, and one thing this
file did not ask for turned out to be the larger half of the defect.** Read §6 before
believing any present-tense sentence below it: §0's *"18 compositions ship"* is now
**20**, and §2's *"confirmed at HEAD"* has been acted on.

| what | where |
|---|---|
| (a) `primaryButton` no longer sets a port its own `borderStyle` switches off | `StyleCompositions.ts`, and `ui-split-hero` it was copied from |
| **the rule itself was wrong in two of eleven cases** | `parameterValues.ts` + `portConditions.ts` — see §6.1 |
| the 4 recipes with the same shape, and 5 more with a `label` nobody sees | `docs/node-catalog/examples/` — **11 → 0** |
| `catalog:examples` now grades this family, so it cannot come back | `scripts/validate-examples.ts` |
| (b) `find_tools` finds a group by what it is *for* | `disclosure.ts` + a `keywords` field that costs **zero** resident tokens |
| AC5 — the template's workaround has lapsed, asserted | `tpl001Template.test.ts` §4b |

🔴 **§0 (c) — the missing compositions — is NOT done**, and §6.4 is the sourcing
survey it needs so the next session does not re-derive it. It is not covered by any
of the five acceptance criteria and is not in §3's scope; it was agreed into the file
separately, and it is the part with a real judgement in it.

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
