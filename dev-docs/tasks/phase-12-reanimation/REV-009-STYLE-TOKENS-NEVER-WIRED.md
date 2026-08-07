# REV-009: The style-token system is not connected to anything

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-009 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🟡 Medium — nothing is visibly broken, but a shipped subsystem does nothing and a live one writes invalid CSS |
| **Difficulty** | 🟡 Medium — the code is small; the decision is a product one |
| **Estimated Time** | 1–2 days |
| **Prerequisites** | None. Found during REV-008 Stream D1. |
| **Branch** | `cline-dev` — work directly on it, no task branch (see `.clinerules`) |
| **Recommended executor** | 🟠 **Opus 4.8** — the work is small but the call on what the design system *is* is not mechanical |

## Objective

Decide whether the STYLE-001 / STYLE-002 design-token system is finished or
retired, and make the code say so. Today it is neither: half of it is dead code,
the other half is live and writing CSS values that resolve to nothing.

## What was found

REV-008 set out to verify the StyleTokens work that arrived with the
`cline-dev-tara` merge — flagged in
[MERGE-NOTES-cline-dev-tara.md](../../reviews/MERGE-NOTES-cline-dev-tara.md) as
having zero automated coverage. It does not work, for three independent reasons.

### 1. The injector is never constructed

`packages/noodl-viewer-react/src/style-tokens-injector.ts` exports
`StyleTokensInjector`, whose constructor injects a `<style>` element of CSS
custom properties into the viewer document. Nothing anywhere calls `new
StyleTokensInjector(...)`:

```bash
grep -rn "new StyleTokensInjector" packages/   # no matches
```

Its only importer is itself. **No tokens are ever injected into a preview.**

### 2. The two halves use different token vocabularies

Even if it were wired up, the names would not line up.

| Source | Tokens |
|---|---|
| `StyleTokensInjector.getDefaultTokens()` and `models/StyleTokens/DefaultTokens.ts` | `--primary --background --foreground --border --space-sm --space-md --space-lg --radius-md --shadow-sm --shadow-md` (10) |
| `models/ElementConfigs/configs/*.ts` | `--font-sans --text-base --text-xs --font-normal --leading-normal --foreground --primary --primary-foreground --secondary --radius-md --space-3 --surface --space-4 --border-1 --border-subtle --radius-lg --shadow-md --muted …` |

The overlap is `--foreground`, `--primary`, `--radius-md`, `--shadow-md`. The
vocabulary the configs actually use — the Tailwind-style scale with `--space-4`,
`--font-sans`, `--surface` — appears **only in the phase-9 task documents**
(`dev-docs/tasks/phase-9-styles-overhaul/STYLE-001-token-system-enhancement/README.md`),
never in shipped code. STYLE-002 was written against the token set STYLE-001's
design document promised; STYLE-001 shipped a different, smaller one.

### 3. ElementConfigs is live and stamping unresolvable values

This is the part that is not merely dead. `NodePicker.utils.ts` calls
`ElementConfigRegistry.applyDefaults(node, type.name)` on every node creation, and
`TextConfig` is keyed on `'Text'`, which **is** the real node type. So every new
Text node gets written into `project.json` with:

```js
fontFamily: 'var(--font-sans)',
fontSize:   'var(--text-base)',
fontWeight: 'var(--font-normal)',
lineHeight: 'var(--leading-normal)',
color:      'var(--foreground)',
```

None of which are defined at runtime. The three `net.noodl.controls.*` configs
are equally live and equally affected.

Note this is *not* purely cosmetic: the values are persisted into the user's
project file, so retiring the tokens later means those projects still carry them.

### Already actioned in REV-008

`GroupConfig` keyed on `net.noodl.visual.group`, which is not a node type — the
real one is `Group`. It had therefore never applied to anything, and was deleted
rather than repointed, precisely because activating it would have stamped the
undefined `var(--surface)` / `var(--space-4)` vocabulary onto the most-used node
in the product. Tara's `ImageConfig` had the same defect and was not ported.
`TextConfig`'s own identifier is correct, which is why it is live.

## Correction — what was actually true on execution

Two of the three findings above did not survive contact with the code. They were
written against a **stale duplicate** of the token system, and against a grep
that missed a `.jsx` file. The record is left intact above; this section is the
correction.

### There are two StyleTokens directories, and the spec read the dead one

| Directory | Origin | State |
|---|---|---|
| `models/StyleTokens/` | commit `188d993`, pre-revival | 10 tokens. **Zero importers.** Genuinely dead. |
| `models/StyleTokensModel/` | commit `297dfe0`, STYLE-001 proper | ~200 tokens, full Tailwind scale. Live. |

The 10-token vocabulary in finding #2's left-hand column is the dead one.
`StyleTokensModel` is wired end-to-end in the editor:

```
StyleTokensModel  →  ProjectDesignTokenContext (mounted in EditorPage)
                  →  PreviewTokenInjector.attachModel
                  →  CanvasView dom-ready  →  webview <style id="noodl-design-tokens">
```

plus a `DesignTokenPanel` registered in `router.setup.ts`.

### The vocabularies already line up — exactly

Finding #2 claimed the configs reference tokens nothing defines. Measured against
the *live* table: the four `ElementConfig`s reference **46** distinct custom
properties, and `DefaultTokens.ts` defines **all 46**. Zero missing. Every name
finding #2 called undefined — `--font-sans`, `--text-base`, `--space-4`,
`--surface`, `--border-1`, `--muted` — is present.

### The injector *is* constructed

`grep -rn "new StyleTokensInjector" packages/` does match: `viewer.jsx:194`. It
was constructed on every viewer boot.

### What was genuinely broken

The defect is real but it is one level down from where the spec put it: **the
deployed/exported runtime had no working token injection.**

- `PreviewTokenInjector` only drives the editor's preview webview. A deployed
  build never runs it.
- The viewer's own `StyleTokensInjector` was the only thing running in a deploy,
  and it was broken three ways: it emitted the *dead* 10-token vocabulary; it
  read `metadata.styleTokens`, a key nothing writes (`StyleTokensModel` persists
  under `designTokens`); and its `metadataChanged` listener tested
  `'styleTokens' in metadata` when `GraphModel` emits `{ key, data }`, so it
  never fired.

So a Text node's `var(--font-sans)` resolved correctly while you were editing and
resolved to nothing the moment you deployed — the failure mode least likely to be
noticed. `StyleTokensModel.generateCss()` even carries the docstring "Used for
injection into the preview iframe **and deployed projects**"; the second half was
never built.

## Decision — **A, narrowed**

Finish it. Not the large A the spec imagined (expanding `DefaultTokens.ts` to a
new scale) — that work is already done and correct. What was missing is the
export path.

B and C were both rejected on the same ground: the system is not half-built
scaffolding, it is a shipped, UI-exposed feature (a Design Tokens panel, presets
at project creation, a style analyser that suggests tokens). Stripping it would
be deleting working product to fix a bug in one code path.

### What changed

1. **`ProjectTokenCss.ts`** (new) — side-effect-free core: merge defaults with a
   project's stored overrides, emit the `:root` block. No model lifecycle, so the
   exporter can call it.
2. **`HtmlProcessor`** now stamps `<style id="noodl-design-tokens">` into the
   exported `index.html`, ahead of the user's own head code. This closes the
   deploy gap for both the `deploy` and `ssr` runtimes, which share the processor.
3. **`StyleTokensModel._buildEffectiveTokens`** rewritten onto that shared core,
   so the preview and a deployed build cannot drift apart again.
4. **Deleted** `packages/noodl-viewer-react/src/style-tokens-injector.ts` and its
   construction in `viewer.jsx`. Nothing replaces it: the editor path is covered
   by `PreviewTokenInjector`, the deploy path is now static CSS in the HTML.
5. **Deleted** the dead `models/StyleTokens/` directory.
6. **`tests/models/StyleTokenCoverage.test.ts`** (new) — asserts every `var(--x)`
   any `ElementConfig` stamps is defined in `DefaultTokens`, and that
   `generateProjectTokenCss` emits the full set and applies overrides. This is
   the regression guard that would have caught the original drift.

### Incidental finding — `test:ci` needs an artefact it does not build

Not part of this task; recorded because it cost most of the execution time and
should become its own spec.

On a clean tree `npm run test:ci` fails three Git specs and spawns seven Electron
windows that each throw:

```
Unable to find Electron app at .../packages/noodl-editor
Cannot find module '.../packages/noodl-editor/src/main/main.bundle.js'
```

`noodl-git` installs a merge driver that shells out to
`electron <editor-dir> --merge %O %A %B %L` (`core/init.ts`). That needs
`src/main/main.bundle.js`, which REV-008's `10ea2a8` correctly untracked as
generated output — but `test:ci` builds only the renderer test bundle, so the
driver's Electron cannot boot, never writes the merge, and the spec times out
after 60s.

REV-008 recorded "705 specs, 0 failures" because the bundle was still on disk
from an earlier `build:editor`. That is precisely the stale-artefact trap REV-008
was written to close, reappearing one level up: the suite's result now depends on
whether someone happened to build recently. `npm run build:main:dev` before
`test:ci` is the workaround; building main as part of `test:ci` is the fix.

Separately, the harness can exit **0 having reported nothing** — observed once
here when the renderer never sent results. `test.js` guards the `totalCount === 0`
case but only on the path where results arrive at all.

## The decision to make (original framing)

Three coherent end states. Pick one deliberately; the current state is none of
them.

**A. Finish it.** Instantiate `StyleTokensInjector` in the viewer, and reconcile
the vocabularies — most likely by expanding `DefaultTokens.ts` to the full scale
the phase-9 design document specifies, since that is what the configs already
expect. Largest option, and the one that makes the property panel's variant and
size dropdowns actually mean something.

**B. Retire STYLE-002's tokenisation, keep the layout fixes.** Strip the `var(…)`
defaults from `TextConfig` and the control configs, leaving the parts that are
real bug fixes — `TextConfig` documents `width: auto` + flex participation as
fixing text pushing siblings off-screen in row layouts. Delete
`style-tokens-injector.ts` and the StyleTokens model, or leave them clearly
marked unused.

**C. Retire the whole thing.** Remove ElementConfigs, its registry, and the
property-panel variant/size UI that consumes it, along with the StyleTokens
model. Smallest surface left behind.

## Steps

1. Confirm the finding in a running preview: create a project, add a Text node,
   and read `getComputedStyle` on the rendered element via
   `npm run cdp -- eval --target=viewer`. Expect the `var()` references to
   resolve to nothing. (REV-008 established this statically; a live confirmation
   costs one dev-loop launch and removes all doubt.)
2. Make the call above. Record it here.
3. Implement, with regression tests — `tests/models/ElementConfigRegistry.test.ts`
   and `tests/models/EmbeddedTemplate.test.ts` are the existing surface.
4. If option A: verify token injection end-to-end in a preview, not just in a
   unit test. That is the specific gap that let this sit unnoticed.

## Live verification

Done against a running editor (`npm run dev:debug` + CDP), on a throwaway project
created in a scratchpad and removed afterwards. Step 1's expected result —
"the `var()` references resolve to nothing" — was **not** reproduced, because the
preview was never the broken path.

**Preview** (through the webview, the same channel `PreviewTokenInjector` uses):

```
styleEl:    true          #noodl-design-tokens present
cssLen:     4787
--font-sans      → ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", …
--text-base      → 16px
--foreground     → rgb(15, 23, 42)
--leading-normal → 24px
--space-4        → 16px
```

**Export** — the real `createIndexPage(ProjectModel.instance, …)`, i.e. the
production path, against the real `external/deploy/index.html` template:

```
htmlLen:  6545
hasBlock: true      <style id="noodl-design-tokens">
blockLen: 4789
--font-sans / --text-base / --space-4 all present
```

Before this task that block did not exist, so the same call would have produced a
document in which every `var()` an ElementConfig stamped resolved to nothing.

## Success criteria

- [x] One of A/B/C chosen, with the reasoning recorded — **A, narrowed**
- [x] No shipped code references a CSS custom property that nothing defines —
      all 46 referenced tokens defined, asserted by `StyleTokenCoverage.test.ts`
- [x] No exported class that nothing constructs — `StyleTokensInjector` deleted
      along with the dead `models/StyleTokens/`
- [x] `npm run test:ci` green (712 specs, 0 failures), `npm run typecheck:editor`
      clean. Note: `test:ci` needs `npm run build:main:dev` first — see the
      incidental finding above; without it three Git specs fail for reasons
      unrelated to any code change.
- [x] Injection verified in a running preview via CDP — and in the export path,
      which is where the defect actually was

## References

- `packages/noodl-viewer-react/src/style-tokens-injector.ts` — the uninstantiated injector
- `packages/noodl-editor/src/editor/src/models/StyleTokens/DefaultTokens.ts` — the 10 shipped tokens
- `packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/` — the configs, and the vocabulary they expect
- `packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.utils.ts` — where `applyDefaults` fires
- [MERGE-NOTES-cline-dev-tara.md](../../reviews/MERGE-NOTES-cline-dev-tara.md) — how this arrived unverified
- [REV-008-DEV-LOOP-HARDENING.md](./REV-008-DEV-LOOP-HARDENING.md) — Stream D, which surfaced it
- `dev-docs/tasks/phase-9-styles-overhaul/` — the original STYLE-001/002 design intent
