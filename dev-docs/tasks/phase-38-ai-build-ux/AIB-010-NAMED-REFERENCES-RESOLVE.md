# AIB-010 — A named reference must resolve

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience (filed 2026-08-04 from phase 39's [POL-008](../phase-39-alpha-polish/POL-008-SAMPLE-DATA-AND-A-THIN-BUILD.md) Part B) |
| **Priority** | 🟡 Important — not alpha-blocking. An invented name is ugly output, not a crash |
| **Difficulty** | 🟠 Medium — the check is small; deciding the tier and sourcing the project's tables into a *pure* module is the work |
| **Recommended executor** | 🟠 Opus — the mechanism is written down; the reject-vs-report policy and the context budget are judgement |
| **Prerequisites** | [AIB-001](AIB-001-PARAMETER-VALUE-CONTRACT.md) (built — this is the other half of its table) |
| **Status** | ☐ filed, not started. Deferred out of phase 39 on Richard's call, 2026-08-04 |

## Objective

An AI-authored parameter that **names** something — a text style, a colour style, an image file, a
component — must name something that exists. Today the gate checks that the value is a *string* and
stops there, so `textStyle: "heading-3"` in a project whose styles are `Body Text`, `Button Label`
and `Label Text` is reported to the user as **"Submitted — passed validation."**

And the other half, which is the reason the first half alone would only produce a nagging gate:
**the agent is never told what the project's style names or assets are.** It cannot write
`Body Text` if nothing has ever said the project has one.

## What happened

POL-008 Part B's re-judge, 2026-08-04, real provider, one Profile page through the Build panel. The
output was good — seven nodes, a spacing scale, a card with `var(--surface)` and `var(--radius-2xl)`,
a 140px avatar, rendering in Inter. Two values in it named nothing:

- `textStyle: "heading-3"` on one Text and `textStyle: "muted"` on the other. Neither exists, so both
  Texts fell back to identical 16px black. **The page has no type hierarchy at all** — the single
  most visible thing wrong with it — and nothing anywhere said so.
- `src: "profileIcon.svg"` on the Image. No such file. A broken-image box, which is most of the
  screenshot's emptiness.

Both passed. The full node-by-node inventory and the screenshot are in POL-008's Part B section.

## The mechanism, verified 2026-08-04

Two independent halves, each verified by reading the code rather than inferred from the symptom.

### 1. The check stops at `typeof value === 'string'`

AIB-001 built the wire-format table in
[`validation/parameterValues.ts`](../../../packages/noodl-editor/src/editor/src/validation/parameterValues.ts).
Five port types are grouped as `NAME_TYPES` — ports "whose value is a name looked up in a project
table" — and the table's own prose is exact about what each one means:

```ts
const NAME_TYPES: Record<string, string> = {
  color:     'a token name, a project colour-style name, or a hex string',
  font:      'a font family name or a project font path',
  textStyle: 'the name of a text style declared in this project',   // ← says "declared in this project"
  component: 'the full path of a component, e.g. "/Pages/Home"',
  image:     'a project-relative image path'
};
```

Their shared `check` is the whole of it (`nameTypeFormat`, `parameterValues.ts:159-174`):

```ts
check(value) {
  if (typeof value === 'string') return null;   // ← any string passes
  return { severity: 'error', message: `${typeName} expects ${NAME_TYPES[typeName]} — a string. …` };
}
```

This is not an oversight in AIB-001, it is that module's deliberate boundary: `parameterValues.ts`
is **pure** — no `ProjectModel`, no Electron — so it bundles into the headless harness and the MCP
server. It has no project in scope to look a name up in. The lookup therefore has to be a *separate*
check with a project-table input, not a stricter `check()` in this table.

Note the asymmetry it creates, which is worth stating in the fix: a **wrongly-shaped** value is an
error that the authoring loop's repair round fixes inside the session; a **wrongly-named** value is
nothing at all.

### 2. The agent is never told the names

Three sources feed the authoring context, and none of them carries the project's name tables:

- **`ContextBuilder.projectOverview()`** (`ContextBuilder.ts:156-166`) lists **components only** —
  name, node count, ports. No styles, no assets.
- **`ContextBuilder.styleVocabulary()`** → `renderStyleVocabulary` (AIX-006,
  [`StyleTokensModel/StyleVocabulary.ts`](../../../packages/noodl-editor/src/editor/src/models/StyleTokensModel/StyleVocabulary.ts))
  carries **design tokens by category, element variants/sizes, and presets**. That is why the spacing
  and colour in the re-judge were right — `var(--space-8)` and `var(--surface)` came from here and
  resolved. It does **not** carry `styles.text` / `styles.colors`, the legacy per-project tables that
  a `textStyle` port actually reads (`StylesModel.getStyles('text' | 'colors')`, stored under
  `getMetaData('styles')`).
- **The read tools are three**: `get_node_types`, `get_component`, `submit_component`
  (`authoring/tools.ts:42-44`). There is no tool that lists project assets or styles, so the agent
  cannot even ask.

So `textStyle` is a port whose legal values live in a table the agent has never seen and cannot
request. Inventing a plausible name (`heading-3`, `muted` — both perfectly good design-system names)
is the only thing it can do.

**The same absence explains the image.** Nothing lists the project's files, so `profileIcon.svg` is
a guess at a filename by a model that was told an Image node has an `src`.

## What to build

Four slices. 1 and 2 are the pair; 3 and 4 are what stops it regressing.

### Slice 1 — a resolver check, with the project's tables as input

A new check alongside `checkParameterValues`, taking a `NameTables` argument (text styles, colour
styles, image/asset paths, component paths) so the pure module stays pure and the caller supplies
the project. Callers: the authoring gate (`authoring/validate.ts`), and the same seam SUB-006's
validator uses so a hand-edited project gets it too.

**Decide the tier deliberately, and say why in the code.** The options are not equal:

- **error** — rejects the submission, the loop repairs it in-session. Correct for `textStyle` and
  `component`, where the value resolves to *nothing* and the property is silently inert.
- **warning/finding** — reported to the agent as an improvement pass, the way
  [`styleLint.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/styleLint.ts)
  already does. Probably correct for `image`, where a user may legitimately intend to add the asset
  next, and for `color`, which has a legal free-form branch (a hex string) that must not be flagged.

`styleLint`'s two-tier arrangement — validator errors reject, lint findings ask for one more pass —
is the precedent and the plumbing already exists.

### Slice 2 — tell the agent the names

The check without this is a gate that fails work the agent had no way to get right.

- Extend the style vocabulary (or add a sibling handout) with the project's `styles.text` and
  `styles.colors` names. Names only, as the vocabulary already does for tokens — the resolved values
  are not what the agent emits.
- List the project's assets. Budget matters: a project with 400 images cannot spend its context on
  a filename list, so this is plausibly a **tool** (`get_project_assets`, filtered by kind) rather
  than a handout, with the overview stating only that the tool exists and roughly how many files.
- Whatever the surface, it goes through `charge()` like every other handout, so its cost is visible.

**A judgement worth making explicitly:** if a project has *no* text styles (many will not), the right
handout is not an empty list but a sentence saying so — otherwise the agent reads silence as "I have
not been told" and invents again. The same rule as AIB-001's "state the truncation rather than drop
it".

### Slice 3 — the prompt legend

`WIRE_FORMAT_LEGEND` already ends with:

```
- color/font/textStyle/image/component take a NAME (a token, a project style, or a component path).
```

Extend that one line to say the name must be one that exists, and where the list is. One table, both
halves — the AIB-001 rule that a format the validator enforces and the prompt does not describe is a
format the model can only discover by failing.

### Slice 4 — measure it against the same brief

POL-008's re-judge is the "before". Re-run `scripts/pol39-live/pol008b-rejudge.js` (it spends
provider money) and record: does the Profile page come back with a real `textStyle`, and does the
Image either name a real asset or omit `src`? A pass is **a visible type hierarchy in the
screenshot**, not a green gate.

## Criteria

1. A candidate carrying `textStyle: "heading-3"` in a project without that style **does not report
   "passed validation"**. Whichever tier is chosen, the miss is on screen or in the repair loop.
2. The tier decision (error vs finding) is written down per port type, with its reason, in the code.
3. The agent's context names the project's text styles and colour styles — and says so explicitly
   when there are none.
4. An agent can discover the project's image assets without guessing a filename.
5. `parameterValues.ts` stays pure (no `ProjectModel` import) — the tables arrive as an argument.
6. A project with no styles and no assets sends a context that is not measurably larger than today's.
7. The re-judge is re-run and the screenshot shows a type hierarchy.

## Traps

- **`color` has a legal free-form branch.** A hex string is a correct `color` value. A resolver that
  demands a table hit will flag every legitimate literal in the corpus. Same shape as AIB-001's
  `dimension` mistake — check the rule against the 35-project corpus before shipping it.
- **`component` may already be covered.** SUB-006's validator reasons about component references for
  the graph closure (`changeClosure.ts`); confirm before adding a second, differently-worded check
  for the same miss.
- **The style tables are legacy and the token system is not.** `styles.text` is not the design-token
  system UIX-001 built; a project can have tokens and no text styles, or both. Do not merge the two
  handouts into one list that implies they are interchangeable.
- **Deciding to `error` on `image` would reject a reasonable authoring order** (build the page, add
  the art). That is the argument for the finding tier there, and it is why the tier is per-type.
- The pure-module boundary is load-bearing: `parameterValues.ts` bundles into the MCP server and the
  headless harness. An accidental `ProjectModel` import taints both and the failure is at bundle
  time, not test time.
