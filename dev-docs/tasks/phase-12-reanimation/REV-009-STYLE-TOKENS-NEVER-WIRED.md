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
| **Branch** | `task/rev-009-style-tokens` |
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

## The decision to make

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

## Success criteria

- [ ] One of A/B/C chosen, with the reasoning recorded
- [ ] No shipped code references a CSS custom property that nothing defines
- [ ] No exported class that nothing constructs
- [ ] `npm run test:ci` green, `npm run typecheck:editor` clean
- [ ] If tokens survive: injection verified in a running preview via CDP

## References

- `packages/noodl-viewer-react/src/style-tokens-injector.ts` — the uninstantiated injector
- `packages/noodl-editor/src/editor/src/models/StyleTokens/DefaultTokens.ts` — the 10 shipped tokens
- `packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/` — the configs, and the vocabulary they expect
- `packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.utils.ts` — where `applyDefaults` fires
- [MERGE-NOTES-cline-dev-tara.md](../../reviews/MERGE-NOTES-cline-dev-tara.md) — how this arrived unverified
- [REV-008-DEV-LOOP-HARDENING.md](./REV-008-DEV-LOOP-HARDENING.md) — Stream D, which surfaced it
- `dev-docs/tasks/phase-9-styles-overhaul/` — the original STYLE-001/002 design intent
