# PLAT-004 NOTES — Type Escape-Hatch Ratchet

Status: the mechanism landed 2026-07-24 (spec steps 1–4, 6), plus the first burn-down slice —
`noodl-preview`, 16 `TSFixme` → 3 (§7). The rest of the burn-down mostly happens inside PLAT-002 and
PLAT-003. Resume from **§6**.

Run in parallel with PLAT-002 and PLAT-003. Boundary: PLAT-004 owns the counter, the baseline, the
CI job and the policy — nothing in `packages/`. It deliberately does **not** sweep markers in
`packages/noodl-editor` (PLAT-002's territory) or `packages/noodl-runtime` /
`packages/noodl-viewer-react` (PLAT-003's), because both tasks are removing those markers as a side
effect of work already in flight, and a third editor would only cause conflicts.

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

Measured at `3a302b9` when the mechanism landed; now `0395b24` after slice 1 (§7) lowered
`TSFixme` to **568**. The table below is the original measurement.

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

## 5. Known live consequence — read before the next commit lands

The baseline was measured from a clean `git archive` of `3a302b9`, **not** from the working tree,
which was dirty with two other sessions' in-flight work at the time. A tree-measured baseline would
have baked in uncommitted markers and would not be reproducible from any commit.

The consequence is that work already in flight will trip the gate when it lands. As of writing:

| In-flight work | Markers over baseline |
|---|---|
| AI assistant client (`models/AiAssistant/client/**`, `tests/ai/**`) | +44 `TSFixme` |
| PLAT-003 `react-component-node.ts` | +2 `any` |

Neither is a defect in the ratchet — it is the ratchet doing its job on new code. Whoever lands
those either gives the values real types or runs `npm run tsfixme:baseline` and commits the raised
baseline with a reason, per the policy. The AI assistant markers are in fresh provider code where
the types are knowable (SDK response shapes), so typing them is the better answer there.

## 6. Where to resume

1. **Harvest the easy wins** (spec step 5) in packages no one else is editing. `noodl-preview` is
   done (§7). `noodl-types`' remaining 11 are in `src/runtime/*.d.ts`, which is PLAT-003's published
   API — leave those to that task. Everything else is live territory for PLAT-002/003.
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
