# DSG-005 — notes from building it

**Worked:** 2026-08-11, in a worktree off `cline-dev` tip `80868946`. Three commits:
`a96e70df` (the compositions), `c6953abc` (both clients + the measurement), `a9d8d0a9` (the gates).

Territory kept to exactly what the brief allowed: `StyleVocabulary.ts`, a new sibling
`StyleCompositions.ts`, `styleTools.ts`, the two barrels that re-export them
(`StyleTokensModel/index.ts`, `noodl-mcp/src/editor-deps.ts`), and two test files.
**`design.ts` was not touched** — see F25 below, which is a finding *about* it and is left for
whoever owns the doctrine.

---

## What the vocabulary now teaches

A fourth field beside `categories`/`elements`/`presets`:

```ts
compositions: VocabComposition[];   // { id, nodeType, group, description, parameters, recipe }
```

18 named parameter sets, in the order a page is built:

| group | ids |
|---|---|
| spine | `band`, `bandSurface`, `shell`, `sectionHead` |
| surface | `card`, `cardBody` |
| control | `primaryButton`, `outlineButton` |
| media | `cardImage` |
| arrangement | `gridAutoFit`, `columnsTwoUp` |
| type | `displayHeadline`, `sectionHeading`, `cardTitle`, `eyebrow`, `lead`, `body`, `meta` |

Doctrine §6 names six things — a `card`, a `shell`, a `sectionHead`, one `primaryButton`, one
`outlineButton`, and a type ramp. All six are there and pinned by a spec; the other seven exist
because the recipe they came from could not express the six without them (a `shell` with no `band`
around it is not centred by anything, and a `card` with no `cardBody` has no padding).

## Where each one is grounded

**Nothing here was authored from taste.** Every value was copied out of a shipped recipe in
`docs/node-catalog/examples/`, which `npm run catalog:examples` keeps error- *and* warning-free, and
which were in turn lifted from the measured DOM of the DSG-001 reference build. Each composition
carries the id of the file it came from, so any of them can be diffed against its source.

| composition | measured source | node in it |
|---|---|---|
| `band` | `ui-page-shell-bands` | `band_a` |
| `bandSurface` | `ui-page-shell-bands` | `band_b` |
| `shell` | `ui-page-shell-bands` | `shell_a` |
| `sectionHead` | `ui-page-shell-bands` | `a_head` |
| `card` | `ui-card-grid-repeater` | `card` |
| `cardBody` | `ui-card-grid-repeater` | `body` |
| `cardImage` | `ui-card-grid-repeater` | `photo` |
| `gridAutoFit` | `ui-card-grid-repeater` | `grid` |
| `primaryButton` | `ui-split-hero` | `cta` |
| `outlineButton` | `ui-split-hero` | `secondary` (one deviation — F25) |
| `columnsTwoUp` | `ui-split-hero` | `shell` |
| `displayHeadline` | `ui-split-hero` | `headline` |
| `sectionHeading` | `ui-page-shell-bands` | `a_heading` |
| `eyebrow` | `ui-page-shell-bands` | `a_eyebrow` |
| `lead` | `ui-page-shell-bands` | `a_sub` |
| `body` | `ui-page-shell-bands` | `a_body` |
| `cardTitle` | `ui-card-grid-repeater` | `title` |
| `meta` | `ui-card-grid-repeater` | `sub` |

The only edit made in transit is that **content-bearing parameters are dropped** — `text`, `label`,
`src`, `alt`, `iconIconSource`. A parameter set is not a copy of the words.

`recipe` is an **id, never a graph**. A second copy of a recipe here would drift, and drift in the
corpus an agent imitates is phase 55's F23 again. A spec checks that every id still names a file on
disk and that no composition contains `children`/`connections`.

---

## 🔴 F25 — `--border-control` does not exist

Found while checking the compositions against the token set, and it is the more interesting half of
this task.

- `design.ts:134` (the doctrine, §4): *"keep `--border` for hairlines and a distinct
  `--border-control` at 3:1 for controls. Trying to make one token do both is how a real project
  ended up with 143 controls at 1.00:1."*
- `docs/node-catalog/examples/ui-split-hero.json:175` writes `"borderColor": "var(--border-control)"`
  on the outline button — and that recipe is baked into `node-catalog-enriched.json`.
- **There is no `--border-control`.** Not in `DefaultTokens.ts`, not in any of the five presets. The
  only border tokens are `--border`, `--border-subtle`, `--border-strong` (plus the `--border-N`
  widths).

An undefined custom property makes the `border-color` declaration invalid, so the border falls back
to `currentColor` — which is *precisely* the "a control at 1.00:1" defect §4 exists to prevent,
shipped by the sentence preventing it. It reads as a working outline button in a graph and it is not
one in a DOM.

Measured (WCAG relative luminance, against `--background` #ffffff / `--surface` #f8fafc):

| token | value | vs `--background` | vs `--surface` |
|---|---|---|---|
| `--border` | `#e2e8f0` | **1.23:1** | 1.18:1 |
| `--border-subtle` | `#f1f5f9` | **1.10:1** | 1.05:1 |
| `--border-strong` | `#cbd5e1` | **1.48:1** | 1.42:1 |
| `--muted-foreground` | `#64748b` | **4.76:1** | 4.55:1 |
| `--primary` | `#3b82f6` | 3.68:1 | 3.52:1 |

**No border token in the default set reaches the doctrine's own 3:1.** The nearest neutral that does
is `--muted-foreground` at 4.76:1.

**What I did:** `outlineButton` emits `borderColor: 'var(--muted-foreground)'`, with the measurement
and the reason in a comment at the line, and a spec that fails if any composition ever names a token
that does not exist. Teaching a token that resolves to nothing was the one option that was clearly
worse than deviating from the recipe.

**What I did not do, and someone should:**

1. Add a real `--border-control` (or `--border-interactive`) token at ≥3:1 to `DefaultTokens.ts` and
   the presets — that is a design-token decision, and `DefaultTokens.ts` is outside this task's
   territory. When it exists, `outlineButton`'s one line is the only thing to change.
2. Fix `ui-split-hero.json` (DSG-003's territory, and it needs a catalog regeneration).
3. Decide whether the doctrine sentence should keep naming a token that has to be invented first —
   **`design.ts` was deliberately left alone**, because DSG-004 is working downstream of the same
   module and two agents editing shared state independently is a recorded failure mode here.

This also means the existing `catalog:examples` gate does not check parameter *values* against the
token set — it validates node types and port connectivity. That is the gap that let a non-existent
token into the corpus. It looks like DSG-004 territory, so it is filed here rather than built.

---

## Response size, measured on the wire

`jsonResult` emits `JSON.stringify(payload, null, 2)`, so the pretty-printed string is the cost.
Both numbers are direct measurements of the same code path before and after the change.

| | before | after | Δ |
|---|---|---|---|
| `detail:"full"` | 26,761 chars · ~6,690 tok | 36,817 chars · ~9,204 tok | **+38%** |
| `detail:"prompt"` | 5,137 chars · ~1,284 tok | 9,499 chars · ~2,375 tok | **+85%** |
| the composition section alone | — | 4,232 chars · ~1,058 tok | — |
| the tool *description* (resident every turn) | 390 chars · ~98 tok | 558 chars · ~140 tok | +42 tok |

Tokens at 4 chars/token, matching `toolDisclosure.test.ts`'s convention so the numbers are
comparable with its 8,000-token resident-surface budget — which is still green with the longer
description.

**On the "does not grow beyond its current budget" criterion.** The prompt block grows 85%, and it
cannot not: this is new content and nothing was removed to pay for it. What I checked instead is the
budget that has teeth — `ContextBuilder.charge()` refuses a handout outright once the shared
`DEFAULT_BUDGET.maxChars` of 120,000 is exceeded, so the risk was squeezing out a later handout. The
composition section is **3.5% of that budget**, and a `renderStyleVocabulary` call scoped the way
ContextBuilder scopes it (`elementTypes` given) goes 4,909 → 9,141 chars. Nothing is at risk of
refusal. A two-sided ceiling (prompt ≤ 3,000 tok, full ≤ 11,000 tok) is now pinned in
`noodl-mcp/tests/styleTools.test.ts` so the next thing that doubles the block fails a test rather
than a benchmark.

Deliberate terseness choices in the prompt rendering:

- **descriptions are not rendered** — they exist only in `detail:"full"`. The name plus the recipe id
  already say what a set is for.
- one line per composition, one header line per group.
- dimensions render as `{"value":N,"unit":"px"}`, not `100%`. The short form is the one
  `defineRegularInputProp` drops (it reads `value.value`), so abbreviating here would teach the
  failure. This costs ~24 chars a dimension and is worth it.

---

## What I deliberately left out, and why

- **A third `Columns` arrangement (`columnsThreeUp`).** `ui-icon-feature-strip` has it, and it
  differs from `columnsTwoUp` only in `layoutString` and one breakpoint. One worked example of the
  fixed-arrangement pattern plus doctrine §7's rule is enough; two near-identical lines is the kind
  of bulk that turns the block into a document. The recipe still teaches it.
- **`emptyState`** (`ui-empty-state`) and **`statTile`** (`ui-stat-tile-row`). Both are grounded and
  both are *arrangements of several nodes* rather than one node's parameter set — an `emptyState` is
  a dashed card + an icon disc + two Texts + a button. Flattening either into one composition would
  be inventing something the measurement does not contain. They are already fetchable as recipes.
- **`badge`** (`ui-card-grid-repeater`'s absolute-positioned pill). Left out for budget; it is the
  first thing I would add back.
- **Anything the doctrine implies but no recipe shows.** A `footer`, a `siteHeader`, a `formField`:
  the doctrine's §0 architecture and `05-WORKED-EXAMPLE-STOREFRONT.md` both describe them, and
  neither has a measured DOM behind it in this corpus. Authoring them from the prose would be
  exactly the F23 mistake, so they are absent.
- **A `MetaDataSource`-driven variant of the compositions.** `buildStyleVocabulary` ignores `source`
  for this field on purpose: a composition is a set of token *names*, and names are stable across
  projects. A project's overridden *values* are already reflected in `categories`.
- **Any validation rule or diagnostic.** DSG-004's territory, and it is live. The
  "no unknown token / no orphan port" checks added here are **specs over this module's own content**,
  not rules over authored projects.

## Deviations from the spec, and where the spec was wrong about the code

1. **`parameters` is not `Record<string, string>`.** §2.1 says "the same shape `variantStyles`
   already uses, so it costs no new format". It cannot be: `variantStyles` is all-`var(--token)`
   strings, but a `shell` needs `maxWidth`, a `columnsTwoUp` needs breakpoints, and AIB-001 measured
   (across ~4,000 real parameter values) that a dimension is `{ value, unit }` and a `"1200px"`
   string is read as `value.value === undefined` and dropped. The type is
   `string | number | boolean | { value: number; unit: string }`. A composition restricted to strings
   would have had to omit the doctrine's own `maxWidth 1100–1280px` rule.
2. **The compositions live in a sibling module, not in `StyleVocabulary.ts`.** §2 implies the field is
   added in place; `StyleVocabulary.ts` was 305 lines and the data is ~330. `StyleCompositions.ts`
   imports **nothing at all**, which keeps the `editor-deps` containment rule trivially satisfied,
   and `StyleVocabulary` re-exports its types so no consumer needs to know.
3. **The spec's line numbers were right.** `StyleVocabulary` at `:79`, `renderStyleVocabulary` at
   `:238`, `DEFAULT_MAX_TOKENS_PER_CATEGORY = 40`, `styleTools.ts:85`, and the F20 claim (zero
   occurrences of `composition`/`recipe`/`example` in the file) all checked out in source.
4. **`styleVocabularyPorts.test.ts` already existed**, as the spec said, at
   `packages/noodl-editor/tests-unit/aib-001/` — a **jest** spec, not one of the jasmine/electron
   suites, so `jasmine.arrayContaining` and two-argument `toBe` are not available in it.

## Gates, and the inversion

Five new specs in `styleVocabularyPorts.test.ts`, plus two in `noodl-mcp/tests/styleTools.test.ts`.
**Inverted to prove they are not decoration** (memory: a behavioural guard can be decoration —
invert it): a composition injected with `boxShadow` + `background` (neither is a port), `variant:
"muted"`, `maxWidth: "560px"`, `borderColor: var(--border-control)` and `recipe:
"ui-does-not-exist"` failed **four of the five**, one per defect class. Restored; green.

Runs, all from the package directory (never the repo root, never `lerna exec`):

- `packages/noodl-editor` → `npx jest`: **114 suites / 1606 tests green** (this is `test:main`).
- `packages/noodl-mcp` → `npx jest`: **27 suites / 286 tests green**, 2 suites / 45 tests skipped
  (skipped at baseline, not by this change).
- `npx tsc -p packages/noodl-editor/tsconfig.json --noEmit`: **clean**.
- `packages/noodl-mcp` → `npx tsc --noEmit`: 6 errors, **all pre-existing**, all
  `Property 'text' does not exist on type 'ToolCallResult<…>'` in `tests/interfaceGate.test.ts` and
  `tests/stagingDiagnostics.test.ts` — files this change does not touch.
- `npx eslint` on all five changed source files: clean.
- `npx prettier --check`: `StyleCompositions.ts`, `index.ts`, `styleVocabularyPorts.test.ts` and
  `styleTools.test.ts` conform. `StyleVocabulary.ts`, `styleTools.ts` and `editor-deps.ts` still
  fail, **on lines this change did not touch** (a ternary chain in `toPortParameters`, a `zod`
  builder, long `export` lines) — the installed prettier disagrees with how the file was already
  formatted. Running `--write` on them would have reformatted large untouched regions, so I did not.

## Could not verify

- **The acceptance criterion's drive** — *"an agent asked for a card, given only the vocabulary,
  emits the composition's parameters rather than inventing a radius."* Not run. A drive costs $5–8
  and is DSG-006; the brief forbade starting one.
- **Anything in a live editor.** `npm run dev:*` / `test:ci` / Electron were off limits (they reap
  processes by checkout and a second session is live in the primary). So: the in-editor authoring
  panel rendering the new block, and `ContextBuilder.charge()`'s real per-turn total on a real
  project, are both reasoned from source and not observed.
- **`packages/noodl-editor/tests/ai/authoring-style.test.ts`** — the jasmine/electron AIX-006 suite.
  Read it: its three assertions on `presets`, on `variantStyles.primary` and on the rendered block's
  contents are all still satisfied (nothing was removed and no deep equality is used), but the
  runner needs `test:ci`. **It is not proven green.** It is also where a jasmine-side composition
  assertion would go if someone wants one.
- **The esbuild MCP bundle** (`node build.mjs`) was not run. The reasoning that it is safe is that
  `StyleCompositions.ts` has zero imports, which is a stronger containment guarantee than
  `StyleVocabulary.ts` itself has; the in-memory MCP test suite exercises the real
  `createServer`/`get_style_vocabulary` path and passes.
- **The luminance figures in F25** are computed from the hex values in `DefaultTokens.ts` with the
  WCAG formula, not sampled from a rendered DOM. The claim they support — that
  `var(--border-control)` resolves to nothing — is from grep, and is not a matter of measurement.
