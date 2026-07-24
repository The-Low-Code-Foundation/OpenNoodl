# PLAT-004 NOTES — Type Escape-Hatch Ratchet

Status: the mechanism landed 2026-07-24 (spec steps 1–4, 6), plus three burn-down slices —
`noodl-preview` 16 `TSFixme` → 3 (§7), the AI client 44 → 0 (§8), and the io specs 66 `any` → 0
(§11) — and a typecheck gate for the editor's specs, which nothing checked before (§9). The rest of
the burn-down mostly happens inside PLAT-002 and PLAT-003. Resume from **§6** and **§10**.

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
**561 `TSFixme` / 314 `any`** at `7a49cae`. The table below is the original measurement.

Slice 3's re-measurement also banked PLAT-002's wave 4, which landed in between — the gate only
blocks increases, so a win nobody records simply evaporates. That is §6.2 in practice.

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

- **Baseline updates in PLAT-002/003's definition of done** (§6.2, and a spec checklist item). Not
  done here on purpose: it means editing those tasks' spec documents while both sessions are live in
  the same working tree, and their NOTES files are exactly what those sessions are writing to. It is
  a two-line change to each checklist once they are quiet.
- **The remaining `tests/` clusters**, all still unowned: `tests/services/github` (15),
  `tests/models/EmbeddedTemplate.test.ts` (12), `tests/canvas/InteractionController.test.ts` (8,
  PLAT-001 is finished so it is free), `noodl-mcp/tests/tools.test.ts` (9). `tests/io` is done
  (§11). They are typecheck-gated by §9, so typing them means something.
- **PLAT-003's in-flight work is above the baseline again** as of the slice-3 re-measure: +5
  `TSFixme` in `noodl-types/src/runtime/node-definition.d.ts` and +2 `any` in
  `noodl-viewer-react/src/nodes/std-library/states.ts`, both uncommitted in the shared tree. Theirs
  to resolve when they land — §5 all over again, which is why §6.2 matters.

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
