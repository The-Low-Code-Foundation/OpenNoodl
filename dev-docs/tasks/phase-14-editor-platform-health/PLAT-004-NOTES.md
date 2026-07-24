# PLAT-004 NOTES — Type Escape-Hatch Ratchet

Status: the mechanism landed 2026-07-24 (spec steps 1–4, 6). The burn-down itself (steps 5, 7) is
ongoing and mostly happens inside PLAT-002 and PLAT-003. Resume from **§6**.

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

## 2. Baseline at `3a302b9`

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

1. **Harvest the easy wins** (spec step 5) in packages no one else is editing. `noodl-preview` (16
   `TSFixme`) and `noodl-types` (11) are the safe targets; everything else is live territory for
   PLAT-002/003.
2. **Lower the baseline as PLAT-002/003 land.** Neither task is required to update it — the gate
   only blocks increases — so the number will drift high unless someone re-runs
   `npm run tsfixme:baseline` after each merge. Worth adding to those tasks' definition of done.
3. **Regenerate the clustering report** (`npm run tsfixme:report`) after any large merge; it is a
   snapshot, not a live view.
4. The target is under 100 `TSFixme` by the end of PLAT-002 and PLAT-003, with the residue
   documented as genuinely ambiguous. The clustering report shows the residue is concentrated in
   `noodl-editor/src/editor/src/views` (422 markers) — i.e. mostly PLAT-002's deletion path.
