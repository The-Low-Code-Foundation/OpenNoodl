# Merge notes — `cline-dev-tara` → `cline-dev` (2026-07-22)

Tara's branch was 16 commits ahead and 49 behind, last touched 2026-01-16. It was
merged after REV-002 restored the test harness, so for the first time this work
could actually be verified rather than assumed.

## The main finding: duplicated ElementConfigs

Both branches contained an independent implementation of the same subsystem, with
different architectures **and** different consumers. This produced 9 of the 14
conflicts, all `add/add`.

| | `cline-dev` | `cline-dev-tara` |
|---|---|---|
| Registry | 202 lines, module-level functions + plain object | 491 lines, singleton class with `.instance` |
| API | `getVariantNames`, `getSizeNames`, `resolveVariant` | `register`, `validate`, `resolveStyles`, `getSummary` |
| Consumers | `propertyeditor.ts`, `NodePicker.utils.ts` (variant/size dropdowns) | `NodeGraphNode.ts` (defaults on create), `router.tsx` |
| Origin | 2026-02-18, via a 249-file bulk commit titled "Added sprint protocol" | 2026-01-16, byte-identical across all 7 of tara's commits |

**Resolution: kept `cline-dev`'s.** It is the version that currently compiles and
is wired into the property-panel UI. Tara's registry was dropped, along with her
two call sites:

- `NodeGraphNode.ts` — `ElementConfigRegistry.instance.applyDefaults(this)` on
  construction. Removed; `cline-dev` already applies defaults at node creation via
  `NodePicker.utils.ts`, so keeping both would have double-applied.
- `router.tsx` — `initElementConfigs()`. Removed; `cline-dev`'s registry
  self-registers its configs at module load, so no init call is needed.

Tara's richer API (`validate`, `resolveStyles`, `register` with options) is not
lost — it remains on the `cline-dev-tara` ref if it is ever wanted.

## Dropped: `ImageConfig.ts`

Tara's `ImageConfig` was the one ElementConfigs file with no counterpart on
`cline-dev`, so it merged in cleanly — but it is written against her type shape
(`description`, `categories`, neither of which exist on `cline-dev`'s
`ElementConfig`) and would not have typechecked.

While porting it, a **pre-existing bug** surfaced that is worth its own task:

```
net.noodl.controls.button     → exists (packages/noodl-viewer-react/src/nodes/controls/button.ts)
net.noodl.visual.group        → DOES NOT EXIST
net.noodl.visual.image        → DOES NOT EXIST
```

The real node types are `Group` and `Image`. So `cline-dev`'s `GroupConfig` keys on
an identifier that never matches — it is dead config that has never applied to
anything — and tara's `ImageConfig` has the same defect. `TextConfig` (`'Text'`)
and the three `net.noodl.controls.*` configs are correct.

`ImageConfig` was dropped rather than ported, because fixing the identifier would
*activate* a previously-dead config and change node-creation behaviour — not
something to smuggle into a merge commit. Porting it and fixing `GroupConfig`
should be a small deliberate task.

**Resolved in REV-008 (2026-07-22): both deleted, neither ported.** Repointing the
identifiers would have activated configs whose variants reference `var(--surface)`,
`var(--space-4)` and similar — and nothing defines those. The token system they
were written against was never wired up: `StyleTokensInjector` is not constructed
anywhere, and the tokens that *did* ship use a different vocabulary. `GroupConfig`
is gone from the tree; `ImageConfig` stays recoverable from `d67ee72` if the wider
question is ever settled. See
[REV-009](../tasks/phase-12-reanimation/REV-009-STYLE-TOKENS-NEVER-WIRED.md).

## Other resolutions

**`LocalProjectsModel.ts`** (the only genuine code conflict). The "create project
with no template" path: `cline-dev` wrote a minimal `project.json` inline, tara
downloaded her embedded hello-world template. Took tara's flow — the template
system is the point of her TASK-009 — but kept `cline-dev`'s
`runtimeVersion = 'react19'`, which her January branch predates. Dropping it would
have silently regressed new projects to the old runtime.

**`LEARNINGS.md`.** Tara's final commit renamed it to `LEARNINGS_TARA.md` "for
parallel work". Accepting that rename would have deleted `LEARNINGS.md`, which
`.clinerules` and 10+ docs reference by path. The rename was undone; her two unique
sections (STYLE-001 style-token injection gotcha, and the `project.json` missing
`graph` object bug) were folded into `LEARNINGS.md` and `LEARNINGS_TARA.md` removed.

**`.clinerules`.** Union. Kept the Dishant sprint block from `cline-dev` and
appended tara's sections 14-16 (node creation checklist, task sizing, comment
language), minus a stale trailing `_Last Updated: December 2025_` and an orphaned
code fence.

**Two `PROGRESS.md` trackers.** Took `cline-dev`'s — both sides were snapshots and
`cline-dev`'s are newer (2026-02-18 vs 2026-01-12, and 2026-01-18 vs 2026-01-09).

## What tara's branch actually contributed

Merged cleanly, no conflicts, independent of the ElementConfigs fight:

- **StyleTokens** — `StyleTokensModel.ts`, `DefaultTokens.ts`, and a viewer-side
  `style-tokens-injector.ts` (STYLE-001).
- **Embedded template system** — `ProjectTemplate.ts`,
  `EmbeddedTemplateProvider.ts`, `hello-world.template.ts`, and
  `local-template-provider.ts` (TASK-009).
- Incidental fixes to `text.js` sizing, `router.tsx` (viewer), `projectmodel.ts`,
  and the project-creation path.

## Verification

- `npm run typecheck:editor` — clean.
- `npm run test:ci` — **540 specs, 0 failures, exit 0** on the merged tree.
- Root `npm run typecheck` still reports 12 errors, all **pre-existing on
  `cline-dev`** and untouched by tara: the
  `@noodl-viewer-cloud/execution-history` path alias that REV-001 added lives in
  `packages/noodl-editor/tsconfig.json` but not in the root `tsconfig.json`, plus a
  `LauncherPageMetaData` export missing from noodl-core-ui. Worth a follow-up.

## Not verified — resolved by REV-008

The merge was structurally sound and the suite green, but the editor had not been
launched against it, and StyleTokens and the embedded template system had no
automated coverage. REV-008 (2026-07-22) closed that:

- **Embedded template system — works.** `tests/models/EmbeddedTemplate.test.ts`
  covers it: the provider writes a `project.json` with components, a root
  component, and a `graph` object on each component (the missing-`graph` crash in
  LEARNINGS.md). `runtimeVersion` round-trips as `react19`, so the hand-resolved
  combination in `newProject` — tara's template flow plus cline-dev's react19 —
  is now guarded.
- **StyleTokens — does not work.** `StyleTokensInjector` is never constructed, so
  no tokens are ever injected, and the tokens that shipped use a different
  vocabulary from the one ElementConfigs references. Written up as
  [REV-009](../tasks/phase-12-reanimation/REV-009-STYLE-TOKENS-NEVER-WIRED.md).
