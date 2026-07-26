# PLAT-004 NOTES — Type Escape-Hatch Ratchet

Status: the mechanism landed 2026-07-24 (spec steps 1–4, 6), plus six burn-down slices —
`noodl-preview` 16 `TSFixme` → 3 (§7), the AI client 44 → 0 (§8), the io specs 66 `any` → 0 (§11),
the unowned editor spec clusters 20/15 → 0 (§12), the MCP response payloads 12 `any` → 0 (§13) and
`nodegx-backend` 108 `any` → 16 (§14) — and a typecheck gate for the editor's specs and the
backend's, neither of which anything checked before (§9, §14).

**Every cluster PLAT-004 owns is now done.** What remains of the burn-down belongs to PLAT-002 and
PLAT-003, and what remains of *this* task is §6.2: lowering the baseline as they land — which §14
finally moved off this task's plate by putting the re-baseline in *their* definitions of done.
Resume from **§14.7**.

Run in parallel with PLAT-002 and PLAT-003. Boundary: PLAT-004 owns the counter, the baseline, the
CI job and the policy, plus burn-down in code no concurrent task is editing. It deliberately does
**not** sweep markers in the files PLAT-002 is converting (`noodl-editor/src/editor/src/views`) or
PLAT-003 is typing (`noodl-runtime`, `noodl-viewer-react`, `noodl-types/src/runtime`), because both
tasks remove those markers as a side effect of work already in flight and a third editor would only
cause conflicts.

The boundary is by **task, not by package** — see §6.1. The AI client sits inside `noodl-editor` but
belongs to AIX-001, which is finished, so slice 2 typed it without racing anyone.

## 1. What shipped

| File | Purpose |
|---|---|
| `scripts/tsfixme-ratchet.js` | Parser-based counter; `--update` rewrites the baseline, `--report` regenerates the clustering report |
| `.tsfixme-baseline.json` | The committed gate: per-marker totals, per-package and per-file breakdowns |
| `dev-docs/reference/TYPE-ESCAPE-HATCHES.md` | Generated clustering report, for PLAT-002/003 targeting |
| `.github/workflows/pr.yml` | `npm run tsfixme` added to the existing `lint` job |
| `dev-docs/guidelines/CODING-STANDARDS.md` | §"The escape-hatch ratchet" — the policy and the escape valve |
| `package.json` | `tsfixme`, `tsfixme:baseline`, `tsfixme:report` |

Shape deliberately mirrors the existing `scripts/lint-ratchet.js` + `.eslint-baseline.json` pair,
down to the `--update` flag and the failure-message wording. The spec proposed
`scripts/count-tsfixme.ts`; plain JS was used instead so CI needs no `ts-node` hop, matching the
lint ratchet it sits beside in the same job.

## 2. Baseline

Measured at `3a302b9` when the mechanism landed. Since then: slice 1 (§7) lowered `TSFixme` to 568
at `0395b24`; slice 2 (§8) set it to 571 / 393 `any` at `5b3cca0`; slice 3 (§11) brought it to
561 / 314 at `7a49cae`; slices 4 and 5 (§12, §13) bring it to 538 / 287 at `c354d4e`, then
**538 `TSFixme` / 288 `any`** at `6f9b79b`. The table below is the original measurement.

…and then **540 `TSFixme` / 287 `any`** at `78ba241`, which is where it stands.

The last two moves are worth recording as a pattern rather than as events, because closing the loop
against two live sessions took three passes in under an hour:

| Pass | HEAD | What moved |
|---|---|---|
| 1 | `c354d4e` | Slices 4 + 5 land: 538 / 287 |
| 2 | `6f9b79b` | PLAT-003's slice 6 lands `+1 any` in `user/userservice.ts` — absorbed, 538 / 288 |
| 3 | `78ba241` | PLAT-002's wave 5b lands `+7 TSFixme` in the new `shared/view.ts` and removes that `any` — absorbed, 540 / 287 |

Both increases were absorbed rather than fixed: those files are live for their tasks, and a third
editor in them buys nothing. That is §8's escape valve used as designed, and the rule that makes it
tractable is that the number may drift up on someone else's in-flight work — but never *silently*.

The real lesson is §6.2's, sharpened: **re-baselining is not a step you do once at the end of a
slice.** With concurrent tasks landing, the gate goes red within the hour, every hour. Chasing it
commit-by-commit from a third session is a treadmill; the durable fix is the deferred item in §10 —
a baseline-update line in PLAT-002's and PLAT-003's own definition of done, so the task that moved
the number is the one that records it.

Each re-measurement also banks whatever PLAT-002 and PLAT-003 landed in between — 1 `TSFixme` and
2 `any` this time, on top of the 35 markers slices 4 and 5 removed. The gate only blocks increases,
so a win nobody records simply evaporates. That is §6.2 in practice, and it is now the whole of
what this task has left to do.

Slice 2's number went *up* by 3 `TSFixme` and 1 `any` against slice 1's, and that is deliberate —
see §8. It is the escape valve being used as designed: HEAD had drifted 47 markers above the
baseline, 44 of them the AI client's (now typed) and 4 belonging to files PLAT-002 and PLAT-003 are
mid-way through. A baseline that stays below reality is a gate that everyone learns to ignore.

| Marker | Count |
|---|---|
| `TSFixme` | 581 |
| `any` | 392 |
| `@ts-ignore` | 22 |
| `@ts-nocheck` | 0 |
| `@ts-expect-error` | 88 |

All five are gated **separately**. This is the point: a single summed budget would let someone
delete a `TSFixme` and add a bare `any`, or silence the resulting error with `@ts-ignore`, and pass.
Per-marker counts make the trade fail.

The phase-start figure was 554 `TSFixme`. It is 581 now — the count **rose** during Phase 14 despite
PLAT-002 and PLAT-003 both removing markers, because new work (SUB-009's `noodl-preview`, the AI
assistant client) added them faster. That is the whole argument for the ratchet, and it is why the
mechanism was worth building before the cleanup rather than after.

## 3. Why the parser, not grep

The spec called for "a simple grep-based count". Grep was tried and rejected — it cannot distinguish
`any` the keyword from `any` in a comment, in a string, or inside "company", and it cannot see that
the three `type TSFixme = any` declarations are the alias's own definition rather than uses of it.

The first implementation used TypeScript's raw scanner, which is cheap but has no parser context. It
silently lost `@ts-ignore` comments in **eight files** — a scanner alone cannot tell a regex literal
from a division, or JSX text from a comparison, so it desynchronises and swallows trivia. Caught only
because the counts were cross-checked against grep per file rather than in aggregate.

The shipped version parses each file and walks tokens via `getChildren()`, reading comment ranges off
each token's leading trivia. Every comment in a file is leading trivia of exactly one token, so this
reaches all of them — including comments before a closing brace and after the last statement.

Verified against grep per file across all 1,549 files: the only three disagreements are exactly the
three alias declarations, which are skipped by design. Repeated runs on an unchanged tree produce
byte-identical output. Full scan takes ~3.5s.

### Directory exclusions

Skipped by *name* anywhere: `node_modules`, `dist`, `out`, `coverage`, `.git`, `.cache`,
`storybook-static`. Nothing else — an early version also skipped `build` and `lib` by name, which
silently hid the five real sources in `noodl-editor/src/editor/src/utils/compilation/build`. An
exclusion that quietly shrinks the denominator is worse than no exclusion. Anything further goes in
the baseline's `exclude` array as an explicit path, where a reviewer sees it. It is currently empty:
no generated `.ts` in the repo carries a marker.

## 4. Verified behaviour

| Test | Result |
|---|---|
| Repeated runs, unchanged tree | Byte-identical output |
| Counts vs. per-file grep | Match on all 1,549 files (modulo the 3 alias declarations) |
| Unchanged tree | Exit 0, "Holding the line" |
| Add `TSFixme` + `any` + `@ts-ignore` | Exit 1, names the offending file with a `+3` delta |
| Remove a marker | Exit 0, prompts to lower the baseline |
| Swap a `TSFixme` for a bare `any` | Exit 1 — the trade does not pass |

## 5. Known live consequence — resolved by slice 2

The baseline was measured from a clean `git archive` of `3a302b9`, **not** from the working tree,
which was dirty with two other sessions' in-flight work at the time. A tree-measured baseline would
have baked in uncommitted markers and would not be reproducible from any commit.

The consequence was that work already in flight would trip the gate when it landed, and it did —
HEAD sat 47 `TSFixme` and 1 `any` above the baseline once AIX-001 and PLAT-002's wave 3 were in.

| In-flight work | Markers over baseline | Outcome |
|---|---|---|
| AI assistant client (`models/AiAssistant/client/**`, `tests/ai/**`) | +44 `TSFixme` | Typed — §8 |
| PLAT-002 `views/importpopup.ts` | +3 `TSFixme` | Absorbed into the baseline; PLAT-002's to remove |
| PLAT-003 `react-component-node.ts` | +1 `any` net | Absorbed into the baseline; PLAT-003's to remove |

None of it was a defect in the ratchet — it was the ratchet doing its job on new code. The
prediction that the AI markers were "in fresh provider code where the types are knowable" held: all
44 came out, and typing them found two latent defects (§8).

**The lesson to carry**: a ratchet whose baseline is measured from a commit *will* go red the moment
concurrent work lands, and a gate left red is a gate nobody reads. Someone has to close the loop
promptly — which is the argument for §6's point 2 rather than a reason to measure from the tree.

## 6. Where to resume

1. **Harvest the easy wins** (spec step 5) in packages no one else is editing. `noodl-preview` is
   done (§7); the AI client is done (§8). `noodl-types`' remaining 11 are in `src/runtime/*.d.ts`,
   which is PLAT-003's published API — leave those to that task. Everything else is live territory
   for PLAT-002/003.
   Ownership is by *task*, not by package: the AI client lives in `noodl-editor` but belongs to
   AIX-001, and PLAT-002 is nowhere near `models/AiAssistant`, so typing it raced nobody. Check what
   the concurrent task is actually editing before assuming a whole package is off limits.
2. **Lower the baseline as PLAT-002/003 land.** Neither task is required to update it — the gate
   only blocks increases — so the number will drift high unless someone re-runs
   `npm run tsfixme:baseline` after each merge. Worth adding to those tasks' definition of done.
3. **Regenerate the clustering report** (`npm run tsfixme:report`) after any large merge; it is a
   snapshot, not a live view.
4. The target is under 100 `TSFixme` by the end of PLAT-002 and PLAT-003, with the residue
   documented as genuinely ambiguous. The clustering report shows the residue is concentrated in
   `noodl-editor/src/editor/src/views` (422 markers) — i.e. mostly PLAT-002's deletion path.

## 7. Burn-down slice 1 — `noodl-preview`, 16 → 3

Chosen because no concurrent task owns it (SUB-009 is complete), so it could be typed without
racing PLAT-002 or PLAT-003. Baseline lowered to 568 `TSFixme` at `0395b24`.

| Was | Now | Why it was removable |
|---|---|---|
| `(project as TSFixme)._retainedProjectDirectory` | `project._retainedProjectDirectory` | Declared `public` on `ProjectModel` — the cast was stale |
| `(legacy as TSFixme).name` | `legacy.name` | `LegacyProject.name` is a required field |
| `readV2`'s 4 markers | `RegistryV2File`, `ImportInput['components']`, generic `readJson<T>` | The io engine already publishes a schema for every v2 file it reads |
| test helpers' 6 markers | `PreviewStatus`, `PreviewEvent` | These types did not exist; `server.ts` now names its own HTTP contract |
| 3 of `preview.test.ts`'s 4 | `ExportedComponent` | Only `name` was actually needed at the call sites |

The helpers were the interesting case. The right type did not exist, so the fix was to name the
server's public contract rather than to invent a shape in the tests: `PreviewStatus` for
`GET /__preview/state`, and a `PreviewEvent` union for the SSE frames. `helloFrame()` and
`broadcast()` were returning/accepting `unknown`. Typing them found four real defects in the specs,
including reaching for `.report` on a `PreviewState` union with no narrowing — which only compiled
because the value arrived as `TSFixme`.

**The three that stay** are documented in place, which is the standard the success criteria set
("the remainder documented as genuinely ambiguous rather than merely unconverted"):
`PreviewBuild.exportJson`, `parseProjectData`'s return, and `ExportedComponent.nodes`. All three
describe the output of the editor's `Exporter.exportToJSON`, which is itself untyped and returns
`TSFixme`. A type there would be an assertion about someone else's return value, not a real type.

Verification: `typecheck:preview` clean; preview suite 13/14. The one failure is pre-existing and
unrelated — `expect(content-length).toBeGreaterThan(1_000_000)` on `noodl.deploy.js`, which is
872KB in this tree because PLAT-003 is rebuilding the viewer. Confirmed pre-existing by running the
same suite against the unmodified files. An earlier run showed 4 failures; those were timeouts from
two other sessions saturating the machine, and did not reproduce.

## 8. Burn-down slice 2 — the AI client, 44 → 0

Chosen because the gate was **red at HEAD**: AIX-001 landed after the baseline was measured and
brought 44 `TSFixme` with it, so `npm run tsfixme` failed for everyone, on work that was nobody's
fault. Fixing a red gate outranks harvesting a quiet package.

Ownership was checked first, not assumed. The client is `packages/noodl-editor`, which §6 calls
PLAT-002's territory — but PLAT-002 is retiring jQuery in `views/` and has never touched
`models/AiAssistant`. Both files were clean in the shared working tree when the work started.

| Was | Now | Why it was removable |
|---|---|---|
| `raw: TSFixme` / `block: TSFixme` ×5 (anthropic) | `AnthropicMessage`, `AnthropicContentBlock` + two type guards | The response shape is knowable; `.filter(isTextBlock)` narrows the array properly |
| `as AsyncIterable<TSFixme>` | `AnthropicCreateResult` union + `isEventStream` | See below — this one was hiding a real failure mode |
| `json: TSFixme` ×4, `call/item/block: TSFixme` ×5 (openai, ollama) | Per-provider wire interfaces | Every field the adapters read, named in the adapter that reads it |
| `error: TSFixme` ×6 | `providers/errors.ts` | Structural readers over `unknown` |
| tests' `let caught: TSFixme` ×6 | `expectAiClientError()` | The helper the specs were missing |
| tests' `emitted: TSFixme[]` ×3 | `AiToolCall[]` | The type already existed |
| tests' `(message as TSFixme)` ×3, `content as TSFixme[]` ×2 | Typed builder returns + `blocksOf()` | The builders were returning `Record<string, unknown>[]` |

**Wire types are hand-written, not imported from the SDK.** `anthropic.ts` already documented why —
a structural client type keeps the adapter testable against a stub and immune to SDK type churn —
and importing `Anthropic.Message` just to type the response would have undone that. Every field is
optional, because it comes off the wire; what the types buy is a typo check and a written-down
contract, not a guarantee that the server sent anything.

**Two latent defects fell out**, both of the kind `TSFixme` exists to hide:

- `messages.create` was cast to `AsyncIterable<TSFixme>` in `chatStream` and read as an object in
  `chat`. Nothing checked which it actually was, so a gateway that ignored `stream: true` would have
  produced `for await (const event of {...})` — "is not async iterable" — rather than anything a
  user could act on. It is now declared to return either, and both entry points narrow with a
  runtime check that throws an `AiClientError`.
- `(error as TSFixme)?.name === 'AbortError'` looks like it works and mostly does, but the cast was
  standing in for a judgement nobody made: `instanceof Error` is *not* sufficient here, because
  fetch raises abort as a `DOMException`, which is not an `Error` in every environment the editor
  runs in. `providers/errors.ts` reads the fields structurally instead, and `wrapError` now passes
  an `AiClientError` through rather than re-wrapping its message under a generic "request failed".

### Verification without Electron

The editor's specs run under jasmine in Electron via webpack, which is a heavy thing to boot while
two other sessions are building in the same tree. Instead: esbuild-bundle `tests/ai/*.test.ts` for
node (esbuild reads the `paths` aliases straight from `packages/noodl-editor/tsconfig.json`, and
`@anthropic-ai/sdk` must be marked `external` — it is `require`d lazily and never loaded by the
specs), with a ~70-line `describe`/`it`/`expect` shim. All 66 specs pass.

The control matters more than the run: the same bundle was built from a clean `git archive HEAD`
export of the *pre-change* sources and produced identical output — 66 passed, same two expected
console warnings. That is what makes "no behaviour change" a measurement rather than a claim.

`client.test.ts` is excluded from the headless run because it pulls in `AiConfigStore` and therefore
electron-store; it is typechecked and unchanged in behaviour, but it has only been *run* in the
Electron suite.

Typechecking needed a throwaway tsconfig: `packages/noodl-editor/tsconfig.json` includes
`src/editor` only, so `tsc -p packages/noodl-editor` never sees `tests/`. Nothing in CI typechecks
the editor's tests today — worth knowing before trusting a green `typecheck:editor` on a test-only
change.

### The baseline went up by 3, on purpose

After the 44 came out, HEAD still sat +3 `TSFixme` and +1 `any` over the old baseline: 3 in
`views/importpopup.ts` (PLAT-002's wave-3 conversion, and all three describe the untyped import
payload — the same `Exporter.exportToJSON` residue slice 1 documented as genuinely unknowable) and
a net +1 `any` in `react-component-node.ts` (PLAT-003's live file, mid-slice). Both were left alone
per §6: they are those tasks' to remove, and a third editor in the same files buys nothing.

So the baseline records reality at `5b3cca0` — **571 `TSFixme`, 393 `any`** — which is the escape
valve the policy provides, used with the reason written down. The alternative was leaving the gate
red on other people's work, and a red gate teaches everyone to skip it.

Measured, as always, from a clean `git archive HEAD` export rather than the working tree (§5). Two
mechanical notes for next time: the export needs a `node_modules` symlink for the script's
`typescript` require, and it has no `.git`, so the script records `commit: "unknown"` — patch the
real short SHA into `.tsfixme-baseline.json` and the report header before copying them back.

## 9. The editor's specs were never typechecked

Found while verifying slice 2. `packages/noodl-editor/tsconfig.json` includes `src/editor`,
`src/shared`, `src/main` and `@include-types` — the specs are deliberately outside it so they cannot
reach the app bundle, and the side effect is that `tsc` never saw them. `npm run typecheck` (the
root config) does not include them either.

That matters directly to this task. The whole policy is "removal must come with a real type, not a
cast" — but in a spec, a real type was unverifiable. Slice 2 rewrote a lot of spec types; a wrong
one would have compiled silently.

They are clean already: 0 errors, both in the working tree and in a clean `git archive HEAD`
export. So `packages/noodl-editor/tsconfig.tests.json` + `npm run typecheck:editor-tests` is a gate
starting at zero, not a cleanup. It lists only `tests` — the sources under test arrive through the
imports, and `npm run typecheck` covers the rest of them. Wired into the existing Typecheck job.

Worth knowing generally: a green `typecheck:editor` says nothing about that package's specs, and
several other packages likely have the same hole.

## 10. Still open

> **Superseded by §14.7.** All three items below were resolved or absorbed in slice 6; this section
> is kept because the reasoning it records is still the live reasoning. Read §14.7 for the current
> list.

- ~~**Baseline updates in PLAT-002/003's definition of done**~~ (§6.2, and a spec checklist item).
  Was blocked because it meant editing those tasks' spec documents while both sessions were live in
  the same working tree. **Done in slice 6** (§14.7): PLAT-002 is complete so its line is marked
  retro-added; PLAT-003's is a live unticked item. **This was the last open item that belonged to
  PLAT-004 itself.**
- **Keep lowering the baseline.** 538 / 287 at `c354d4e`; 545 / 461 at `d0cd779` after §14's
  deliberate raise. The target is under 100 `TSFixme`, and the clustering report still puts 400-odd
  of them in `noodl-editor/src/editor/src/views` — PLAT-002's deletion path. Re-run
  `npm run tsfixme:baseline` and `npm run tsfixme:report` from a clean export after each merge —
  which is now *their* checklist item, not this task's.
- **PLAT-002's in-flight work sits above the baseline again**, as it did at every previous
  re-measure: +7 `TSFixme` in the new `noodl-editor/src/shared/view.ts` (wave 5b's View-framework
  replacement), uncommitted in the shared tree at the time of measuring. Theirs to resolve when it
  lands — §5 all over again, which is exactly why §6.2 matters.

Nothing is left in the `tests/` clusters: `tests/io` (§11), `tests/services/github`,
`tests/models/EmbeddedTemplate.test.ts`, `tests/canvas/InteractionController.test.ts` (§12) and
`noodl-mcp/tests` (§13) are all at zero.

### An unrelated finding worth acting on

`noodl-editor/tests/services/github/GitHubClient.test.ts` and `tests/services/StyleAnalyzer.test.ts`
are **Jest** specs, and `noodl-editor` has no Jest runner. Its suite is jasmine under Electron
(`tests/index.ts` → webpack → `run-electron-tests`), and `tests/services/index.ts` deliberately does
not export them because importing them crashes that runner. So they are typechecked (§9) and never
executed — 500 lines of GitHub client coverage that has never run. `services/index.ts`'s comment
saying StyleAnalyzer "runs via `npm run test:editor`" is wrong; that script *is* the Electron runner.

Out of scope here — PLAT-004 types markers, it does not choose test runners — but it belongs in
whatever owns the editor's test infrastructure. Noted in both files' headers.

## 11. Burn-down slice 3 — the io specs, 66 `any` → 0

`tests/io` was the largest cluster with no owning task, and 60 of its 66 markers were a single
idiom: `result.files.find((f) => f.relativePath === path)?.content as any`.

`ExportFile.content` is `unknown` for a good reason — one export produces a heterogeneous list
(project, registry, routes, styles, three files per component) — so every assertion narrowed it
inline. `tests/io/v2-files.ts` now holds that narrowing once, and narrows to the schemas the
exporter publishes: `ProjectV2File`, `ComponentV2File`, `NodesV2File`, `ConnectionsV2File`,
`RegistryV2File`, `RoutesV2File`, `StylesV2File`.

The point is not tidiness. Those are the same types `ImportInput` demands, so the round-trip specs
now fail to *compile* if the two engines drift apart, where before they would have round-tripped and
silently dropped a field. `fileAt()` also throws naming the paths that were exported, instead of
surfacing two lines later as a property read on `undefined`.

| Was | Now | Why it was removable |
|---|---|---|
| `?.content as any` ×~60 | `contentAt<T>` / `fileAt<T>` / `firstFileMatching<T>` | The schemas exist and the importer already demands them |
| `(c.graph as any).comments`, `.visualRoots`, `(thumbnail as any).thumbnailURI` | Direct access | All declared on `LegacyGraph` / `LegacyProject` — the casts were stale |
| `keyUnion(FIXTURES as any)` ×4 | `keyUnion(objects: Array<object \| undefined>)` | The parameter was `Record<string, unknown>`, which **no interface satisfies** — interfaces get no implicit index signature, so the type forced every caller to cast |
| `(p.metadata as any)?.styles?.colors` | `metadataAt(project, ['styles', 'colors'])` | The legacy `metadata` bag is genuinely untyped; a guard-based walk beats a cast |
| `(comp as any).graph = undefined` | `delete (comp as Partial<LegacyComponent>).graph` | Says "degrading the fixture on purpose" rather than "silence the compiler" |
| `walkNodes(roots: any[], visit: (n: any) => void)` | `LegacyNode` | The type was one import away |

`keyUnion` is the one worth remembering: a helper typed `Record<string, unknown>` looks stricter than
`object` but is *less* usable, because the model interfaces cannot satisfy it. Every call site paid
for that with an `any`. When a helper's parameter type forces casts at every call, the helper is
usually what is wrong.

### Verification

Same recipe as §8 — esbuild-bundle the specs for node, run against the shim, then run the identical
bundle built from a clean pre-change `git archive HEAD` export. **174 passed, 0 failed on both.**

The io specs use nested `describe` blocks with an outer `beforeEach`, which the throwaway shim did
not implement (the AI specs are flat). It reported 20 failures that were entirely its own —
`Cannot read properties of undefined`. Worth stating plainly: a green run from a hand-rolled harness
proves nothing until the harness is checked against a known-good control. The control run is the
part that matters, not the run.

## 12. Burn-down slice 4 — the unowned editor spec clusters, 20 `TSFixme` + 15 `any` → 0

The three `tests/` clusters §10 listed as unowned. Ownership was checked, not assumed (§6.1):
PLAT-001 is finished so the canvas spec is free, and neither the template nor the GitHub spec is
anywhere near what PLAT-002 and PLAT-003 are editing.

| File | Was | Now |
|---|---|---|
| `tests/canvas/InteractionController.test.ts` | 8 `TSFixme` | `StubOwnerShape` + `MembersOf` |
| `tests/models/EmbeddedTemplate.test.ts` | 12 `TSFixme` | `ProjectContent` + `routerPages()` |
| `tests/services/github/GitHubClient.test.ts` | 15 `any` | `GitHubClientInternals` + `MockOctokit` |

**The canvas spec.** `owner: TSFixme` was a hand-written stub of `NodeGraphEditor`; a typo in
`setCanvasCursor` would have produced a spy nothing ever called and an assertion that quietly never
ran. It cannot be a `Partial<NodeGraphEditor>` — the stub supplies jasmine spies where the editor has
methods, and a partial of the real class demands the real signatures. So `StubOwnerShape` declares
the slice structurally and `MembersOf<NodeGraphEditor, StubOwnerShape>` checks the *names*:

```ts
type MembersOf<Base, T> = keyof T extends keyof Base
  ? T
  : ['not a member of the editor:', Exclude<keyof T, keyof Base>];
```

If the editor renames a member, `stubOwner()`'s return type becomes that tuple and the object literal
fails to compile with the offending key in the error message. That is the check `TSFixme` was
costing. `mouse()` takes the existing `MouseEventType`; the mouse and wheel event bags are named
locally, because `InteractionController.mouse` itself still takes `TSFixme` for its event argument
and that marker is the source's — `views/` is PLAT-002's.

**The template spec.** `download()` writes `JSON.stringify(projectContent)`, so the file it reads
back is a `ProjectContent` — the provider's own published output type, not a shape invented for the
test. The one genuinely untyped thing is the Router's `pages` parameter: `NodeDefinition.parameters`
is a `Record<string, unknown>` bag, and all four places in the editor that read `pages` are untyped
JS-in-TS (`RouterAdapter`, `utils/exporter/router.ts`). A guard-based `routerPages()` reader beats a
cast for the same reason `metadataAt` did in slice 3 — it reports a malformed fixture as a failed
assertion rather than a crash two lines later. Inventing a shared `RouterPages` type in the editor
would have been an assertion about four call sites this task is not typing.

**The GitHub spec.** All fifteen were `(client as any).<private member>`. TypeScript offers no way to
*name* a private member from outside its class — `GitHubClient['setCache']` is an error, not an
escape hatch — so the cast has to stay. What changes is that the surface is now written down once,
as `GitHubClientInternals`, behind a single `internals(client)` helper with the reason in a comment.
`MockOctokit` is the better half of the trade: the mock was `any`, so `mockOctokit.issues.listForRepo`
could have been misspelled and would have stubbed nothing while the spec still "passed".

### Running editor specs headlessly, extended

§8's recipe (esbuild-bundle for node + a jasmine shim + a control run from a pristine export) works
for specs that touch only models. These two reach further, and needed four more things:

1. **A platform.** `tests/index.ts` imports `@noodl/platform-electron` before anything else; the
   headless equivalent is importing `@noodl/platform-node` first in the generated entry. Without it
   `filesystem` is undefined and every spec fails on `.exists`.
2. **jsdom.** `keyboardhandler.ts` adds a `document` listener in a static initialiser, so the module
   graph will not even load without a DOM. jsdom needs `url: 'http://localhost/'` or `localStorage`
   throws `SecurityError` on an opaque origin.
3. **`require.context`.** The core-ui icon registry uses webpack's, so it is injected via esbuild's
   `banner` — which runs in the bundle's own module scope, the same `require` those call sites see.
   Patching it from the runner file does not work: node builds a fresh `require` per module.
4. **tsconfig `paths` as a plugin, not `alias`.** esbuild's `alias` matches by prefix, so the exact
   entry `"@noodl/git"` swallowed `@noodl/git/src/core/open` and rewrote it under `index.ts`. An
   `onResolve` plugin that honours exact keys exactly and `x/*` keys as wildcards is required.

Also worth knowing: `jsdom`, `electron-store` and `@anthropic-ai/sdk` must be `external`, and the
bundle must be **written inside the export tree** so those externals resolve through its symlinked
`node_modules`.

Results, each against the identical bundle built from a pristine `git archive HEAD` export:
`InteractionController` 11/11 both, `EmbeddedTemplate` 14/14 both. `typecheck:editor-tests` clean.

**The trap that nearly ate the control**, and it is worth stating because it is the second time:
the first "control" run used an export that already had the changed files copied into it for
typechecking. It was green, and it proved nothing. A control has to be a *separate* pristine
directory, verified against `git show HEAD:<path>` before it is trusted.

## 13. Burn-down slice 5 — the MCP server's response payloads, 12 `any` → 0

Every one of `noodl-mcp`'s markers traced to a single cause: `call()` in `tests/helpers.ts` returned
`data: any`, so nine call sites in `tools.test.ts` paid for it with `(n: any) => n.id`.

`call()` was `any` because there was nothing to point it at. The tools build their JSON payloads as
inline object literals inside `registerTool`, so nothing named them and nothing checked them — which
means the end-to-end specs, the closest thing this package has to a contract test, would have kept
passing through a field rename on either side.

The fix is the one slice 1 and slice 3 both arrived at from different directions: when a helper's
type forces a cast at every call site, the helper is what is wrong, and the type belongs at the
**producer**. `src/tools/responses.ts` now declares the success payload of every tool, the error
envelope `errorResult` builds, and the two `details` bags that carry structure
(`ValidationFailureDetails`, `DeletionRefusalDetails`). Most of it composes types the package already
published — `ComponentDescription`, `NodeTypeRow`, `NodeTypeDetail`, `ExampleRow`,
`ComponentListRow`, `Usage`, `Diagnostic`. Each handler annotates the object it hands to
`jsonResult`, so drift fails to compile at the producer rather than silently at the consumer.

`call<T>()` and `readJson<T>()` are then generic and the specs name what they expect. `get_node_type`
returns a union per requested name, so `asDetail()` / `asMiss()` narrow it and throw a readable
message on the wrong branch, instead of the old positional destructure reading `.outputs` off a miss.

### Writing the types down found four disagreements

None of these were guesses about the future — they are places where what the payload *is* and what a
reader would reasonably assume differ:

| Declared | Actual | Consequence |
|---|---|---|
| `brokenReferences: Usage[]` | `Diagnostic[]` | `validateDeletion` reports diagnostics against the *other* components, not the deleted one's usages. A consumer treating them as usages reads `.nodeId` off the wrong shape. |
| `target: string` | `string \| undefined` | `validate_component` can resolve no target. |
| `ports: NodePort[]` | `{ inputs?, outputs? }` | `get_component` forwards `component.json`'s object, not an array. |
| `summary: ValidationSummary` | `{ errors, warnings, infos }` | The write path's summary is the three-count subset; it has no `nodesChecked` / `endpointsChecked`. |

Verified: `tsc --noEmit` clean, `npm run build` clean, jest 31/31 — identical to the same suite run
from a pristine pre-change export. `noodl-mcp`'s tsconfig already includes `tests/**/*` and has
`strictNullChecks`, which is why this package's specs typecheck harder than the editor's do (§9).

## 14. Burn-down slice 6 — `nodegx-backend`, 108 `any` → 16, and the authoritative re-baseline

The gate was **red at `678d1c0`**, badly: `any` stood at **557 against a baseline of 287**. The
task brief quoted +117; by the time work started it was +270, because an agent-SSE workstream had
landed in `noodl-runtime` in between. That gap is itself the finding — see §14.6.

### 14.1 What the +270 actually was

| Package | `any` over baseline | Owner | Outcome |
|---|---|---|---|
| `noodl-runtime` | +128 | PLAT-003 slice 10 + the agent-SSE workstream | **Absorbed** — off-limits |
| `nodegx-backend` | +108 | Nobody (phases 19/22 complete) | **Typed** — this slice |
| `noodl-viewer-react` | +29 (+13 `TSFixme`) | PLAT-003 slice 10 | **Absorbed** — off-limits |
| `noodl-editor` | +1 net (`TSFixme` −8) | NodePicker is live; `validation/` is not | normalize.ts typed; rest absorbed |
| others | +4 | assorted | Absorbed |

`nodegx-backend` **did not exist** when the baseline was measured at `78ba241`. Phases 19 and 22
built the whole thing — realtime, workflows, triggers, email, backups, files, search, ops — and it
arrived carrying 108 `any`, 78 of them in its specs. That is the ratchet doing exactly its job on
new code, and it is the third time (§5, §8) a whole subsystem has landed above the line at once.

### 14.2 The prediction held, for the third slice running

§8, §11 and §13 all converged on the same rule: **when a helper's type forces a cast at every call
site, the helper is what is wrong, and the type belongs at the producer.** The brief predicted the
backend's HTTP test helpers would be that shape again. They were, and more literally than expected:

**Fifteen spec files each hand-rolled the same eight lines** — `fetch`, `try { await res.json() }`,
`return { status, json }` — and every one declared `let json: any = null`. Those fifteen `any`s paid
for roughly sixty downstream ones: `(s: any) => s.nodeId`, `(t: any) => t.name`, `(e: any) =>
e.status`, `(f.data as any).action`. None of them was an assertion about anything; all of them would
have survived a field rename on either side of the wire.

`tests/helpers/http.ts` is now the one typed client (`request<T>`, `httpClient(() => base)`), and
`T` defaults to **`unknown`, not `any`** — an un-annotated call gets a value it must narrow rather
than one that pretends to be everything. `tests/helpers/sse.ts` and `tests/helpers/local-sql.ts`
join it.

### 14.3 Three producers were declaring less than they knew

| Producer | Was | Now |
|---|---|---|
| `RealtimeHub` | `OutFrame { event: 'connected'\|'change'\|'resync'; data: unknown }` over three distinct inline payloads | An exported discriminated union; consumers narrow on `event` and *get* the payload |
| `ExecutionHistory` | `store: unknown` + `as any` at all five call sites; `list()`/`get()` return `unknown` | The cloud runtime's own `ExecutionStore`/`WorkflowExecution`/`ExecutionWithSteps`, via `import type` |
| `ChangeBus` | `adapter: any` | `ChangeSource` — the `on`/`off` pair it actually calls |

The `ExecutionHistory` one is worth stating plainly because the comment in the file argued the
opposite: *"Untyped on purpose — the classes carry their own types where they live."* They do carry
their own types, which is an argument for **importing** them, not for throwing them away. The
construction stays a runtime `require` (this package must not pull the cloud runtime into its module
graph); `import type` is erased at compile time, so the black box is intact and the field names are
now checked on both sides. That needed a `paths` entry mirroring the esbuild alias and the jest
`moduleNameMapper` that already existed — see §14.5 for the `rootDir` trap it hit.

Beyond those three, every HTTP response envelope in the package now has a name and a `satisfies` at
the handler: triggers, workflow defs/runs, the step-kind catalog, email templates, file
upload/sign/config/sweep, admin schema and its four mutations, backups, schema-diff, search config,
the audit query, the workflow-runner status. Drift now fails to compile at the producer.

### 14.4 The backend's specs were never typechecked either — and did not start clean

Exactly §9's finding, in a second package: `tsconfig.json` has `"exclude": ["**/*.test.ts"]`, so
`tsc` never saw `tests/`. **Unlike the editor's, this gate did not start at zero — it started at 32
errors.** Every one was real:

- `files-http` read `await upload.json()` (typed `unknown` by undici) as a record, 17 times.
- `realtime-hub` passed `addConnection`'s `string | null` on as a clientId five times. The null
  branch is the connection-cap refusal — a real branch, never meant to be taken here, and now
  asserted with a message instead of surfacing three lines later as something unrelated.
- `email-flows`, `ops-request-id`, `service-http`, `triggers-http` each read `unknown` bodies.

`packages/nodegx-backend/tsconfig.tests.json` + `npm run typecheck:backend-tests` now gate it, wired
into CI's Typecheck job beside `typecheck:editor-tests`. Worth repeating §9's general warning: **a
green `typecheck` for a package says nothing about that package's specs.** Two packages down.

### 14.5 What writing the types exposed

Every prior slice found defects; this one found seven, plus two traps.

| Finding | Consequence |
|---|---|
| `findRole()` returned `Record<string, unknown>`, so `role.objectId` was `unknown` — and went straight into `addRelation`/`removeRelation`/`rawDelete` | Only compiled because `schemaManager` was `any`. A malformed `_Role` row would have addressed *nothing*, silently. Now `asRole()` throws naming the row. |
| `SchemaManager.deleteTable` is feature-detected in `schema-migrate` but called unguarded by `POST /admin/schema` | An adapter without it crashed the route. Now a 501 with a reason. |
| `sessionToken` is returned only by signup and login; the webhook secret and API-key secret only by the create that mints them | Five specs read them as always-present and would have sent `undefined` as a header — which the server reads as *anonymous*, so the test fails on an unrelated 209. |
| `createLogger()` returns null when the history DB refused to open (WF-006 policy: never block a run on history) | `workflow-engine.test.ts` assumed non-null. |
| `ExecutionStep.inputData`/`outputData` are open bags | The catch-payload shape (`previous.error.{message,statusCode}`) is now named at the read instead of asserted field by field. |
| `AdapterFacade.schemaManager` **can** genuinely be absent (its own two readers guard with `&&`), but fifteen call sites treat it as present | Declared non-optional with the reason in place. Left as a finding, not fixed: making it `\| undefined` under a *typing* change would have altered fifteen routes' behaviour. **Open.** |
| `SearchIndexer` had already invented its own `SchemaManagerLike` interface | One adapter, described twice, differently. Now one shared declaration in `persistence/SchemaManagerLike.ts` covering all five former `schemaManager: any` sites. This is the same convergence the shared-SecretsStore work hit: two modules independently reaching for the same convention is a signal to *collapse* it, not to celebrate it. |

**Two traps.**

1. **The index-signature trap, again.** The first `SchemaColumnLike` carried
   `[option: string]: unknown`, which looks permissive and is the exact opposite: an *interface*
   never satisfies a type with an index signature, so every caller passing its own `ColumnDef` or
   `ImportColumn` would have had to cast — the precise failure the file existed to remove. §11
   learned this on `keyUnion`; it fired again here, on the first compile. The rule to carry:
   **an index signature on a parameter type makes it harder to satisfy, not easier.**

2. **A shadowed `const` only visible once the outer name existed.** `ops-audit.test.ts` had
   `const audit = (service as ...).audit` inside a block that also called a *new* outer `audit()`
   helper two lines above it. The TDZ error was latent the whole time; it only became reachable
   when there was an outer binding to collide with.

**The `rootDir` trap.** `import type` from `@cloud-runtime` produced `TS6059` — "not under rootDir"
— even though a type-only import emits nothing. The fix is not a cast: `outDir`/`rootDir`/
`declaration` in this package's tsconfig were configuring an output **nothing generates**, because
`dist/` comes from esbuild (`scripts/build.js`) and every `tsc` invocation in the repo is
`--noEmit`. They are now replaced by `"noEmit": true`, which is what was actually happening.

### 14.6 What was deliberately raised, and why

The baseline is now **545 `TSFixme` / 461 `any` / 17 `@ts-ignore` / 0 `@ts-nocheck` /
79 `@ts-expect-error`** at `d0cd779`, measured from a clean `git archive` export (§5). That is a
**deliberate raise of `any` from 287 to 461**, and it is the escape valve used as designed:

- **`noodl-runtime` (+128, now 185 total).** PLAT-003 slice 10's territory, plus a live agent-SSE
  workstream (`nodes/std-library/agent/*`, 65 markers). Off-limits by §6.1; a third editor there
  buys nothing and costs conflicts.
- **`noodl-viewer-react` (+29 `any`, +13 `TSFixme`).** Same task, same reason.
- **`noodl-editor` NodePicker (+5 `TSFixme`, −1 `any`) and `views/panels/propertyeditor` (+5).**
  Live in other sessions right now (UIX-013 and its neighbours).
- **`nodegx-backend`'s residual 16.** These are the ones genuinely not knowable *here*: the
  untyped `LocalSQLAdapter` (`AdapterFacade.adapter`, `createAdapter`), `node:sqlite`'s
  `DatabaseSync` reached through `getBuiltinModule` (four sites in `backup/`), the `cloudRunner`
  from the cloud runtime, `security/state.ts`'s `db`, three `globalThis` shims in `service.ts`,
  and `ctx.res as any` where `http.ServerResponse` is handed to the hub's `SSEResponse`. Each
  belongs to PLAT-003's runtime typing or to a Node built-in whose types this package does not
  control. They are documented in place, which is the standard §7 set.

The `TSFixme` +5 is entirely other tasks' in-flight work; PLAT-004 removed none and added none.

`@ts-expect-error` fell **88 → 79** and `@ts-ignore` **22 → 17**. The brief asked whether PLAT-003
slice 9's `global.d.ts` fix (it had a top-level `import`, so `interface Window { Noodl }` had never
been in effect) had moved the figure: it had — six suppressions retired there, and the rest is
PLAT-002/003 drift banked in this re-measure. **Neither number moved because of this slice**; both
are wins from other tasks that would have evaporated unrecorded, which is §6.2's whole point.

### 14.7 Still open

- **The re-baseline is now in PLAT-002's and PLAT-003's checklists.** §10's last PLAT-004-owned
  item, closed. PLAT-002's is marked retro-added (that task is complete); PLAT-003's is a live
  unticked item on a task that is between slices. The treadmill §2 describes — chasing the gate
  from a third session, hourly — should now stop.
- **`AdapterFacade.schemaManager` should be `| undefined`.** Real, deliberately not fixed here
  (§14.5). Fifteen call sites need the guard they never had; that is a behaviour change and wants
  its own change, not a typing slice.
- **`noodl-runtime` is now the largest single `any` cluster in the repo** (185, of which 65 are the
  agent-SSE nodes). It is entirely PLAT-003's, and its slice-10 scope should be checked against
  that number — the agent nodes are new work, not legacy, and nothing has claimed them.
- **The blocker in the brief does not reproduce.** `tests/nodepicker/NodePickerReducer.test.ts`
  was reported as importing a non-existent `NodePicker.selectors`; UIX-013 (`8b1886d`) landed the
  module before `678d1c0`. Both `typecheck:editor` and `typecheck:editor-tests` are clean at that
  tip and at this branch's head. No workaround was needed.
- The clustering report still puts **403 markers in `noodl-editor/src/editor/src/views`** and 128
  in `models/`. That is the target for whatever picks this up next, and it is PLAT-002's deletion
  path plus live UI sessions — so check ownership before touching it (§6.1).

### 14.8 Verification

| Check | Result |
|---|---|
| `nodegx-backend` jest, before any change (control) | 57 suites, 533 passed, 10 skipped |
| `nodegx-backend` jest, after every batch | **Identical** — 57 / 533 / 10, unchanged four times |
| `tsc -p packages/nodegx-backend` | Clean |
| `tsc -p packages/nodegx-backend/tsconfig.tests.json` | 32 errors → **0** |
| `tsc -p packages/noodl-editor` | Clean |
| `tsc -p packages/noodl-editor/tsconfig.tests.json` | Clean |
| `noodl-mcp` jest (consumes `normalizeV2Component`) | 61/61 |
| editor `tests/validation/*` headless (§8 recipe) | 13/13 — and **13/13 from a pristine `678d1c0` export** |
| `nodegx-backend` jest from that same pristine export | 57 / 533 / 10 — identical |
| `node scripts/tsfixme-ratchet.js --check` | **✓ Holding the line** |

The control run is the part that matters (§11, §12): the suite was captured at `678d1c0` *before*
the first edit, and every subsequent run was compared against those exact numbers rather than
against "it looks green". §12's trap was respected — the control is a **separate** `git archive`
export of `678d1c0`, verified to still carry the old `nodesFile: any` signature before it was
trusted, not a directory with the changed files copied in.

The editor's two `validation/` specs are the only ones covering `normalizeV2Component`, and they
needed none of §12's four extra pieces (no platform, no jsdom, no `require.context`) because they
are pure model specs — only §12.4's tsconfig-`paths`-as-a-plugin was required.

**Not verified.** Nothing here was run in the live editor or against a live backend process — this
slice types code and its specs, and the backend suite covers real HTTP over a real `node:sqlite`
database, which is as close to live as this package gets. `noodl-mcp`'s `tsc` reports jasmine-vs-jest
matcher collisions when run from a worktree against the parent checkout's `node_modules`; that is an
artifact of the shared-`node_modules` setup (the worktree has none of its own and Node resolves
upward), not of any change here, and its jest run is green.
