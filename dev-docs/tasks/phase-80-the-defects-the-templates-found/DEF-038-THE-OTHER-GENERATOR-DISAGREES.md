# DEF-038 — the other template generator means one thing on disk and another once loaded

**Status: ✅ BUILT AND MEASURED — 2026-09-03, session 42.** Promoted from
[UNOWNED-ROWS-TO-MEASURE.md §10](UNOWNED-ROWS-TO-MEASURE.md), owner `NONE`, where it had been
**measured but not fixed** since 2026-08-31.

## Who it bites, and in what words

> *"I installed the members' area, opened it, and a page that fetched its rows on load stopped
> fetching them. I changed nothing."*

Every person who installs the members-area template and opens it in the editor. **The opening is
the act that breaks it** — nothing about the artefact on disk is wrong, and every path that does
not load it (export, deploy, headless render, the MCP door) reads it correctly.

## What was wrong

`applyPatches` runs NDA-017's `runOnValueChange` migration on every editor open. That migration's
evidence that a graph was authored **before** NDA-017 §2 is *absence of the `runOnChange-*` key,
and nothing else* — there is no version guard anywhere in the pass, because the format has nowhere
to carry one.

A generated template has no pre-§2 author to preserve. Its absent keys already mean **ticked**. So
loading it rewrites parameters nobody wrote and silences deliberate load-time fetches — which is
exactly what P77 D5 and D11 measured on the site builder before DEF-007 §3.2 settled it.

🔴 **DEF-007 §3.2 fixed the generator somebody was looking at.** `toTemplateContent` (the site
builder) calls `pinRunOnValueChangeDefaults`; `prepareArtefact` (TPL-001, the members' area) never
did. **That is the decaying-hand-list shape DEF-007 AC4 exists to prevent**, and the gate that was
supposed to catch it — `DEF-007 AC3` in `sb007Template.test.ts` — regenerates the *site builder*
and compares bytes, so a second artefact was never in its population.

## The measurement

🔴 **Re-measured at HEAD before building anything** (2026-09-03), both arms through the same
planner, `planRunOnValueChangeMigration`:

| artefact | `writes` | `familyNodes` | `signalDriven` | `preserved` |
| --- | --- | --- | --- | --- |
| **`templates/members-area` (TPL-001)** | **57** | 107 | 76 | 78 |
| `site-builder.content.json` (control) | **0** | 97 | 51 | 98 |

✅ **Both arms carry a non-zero `familyNodes`, which is what makes the 0 an absence and the 57 a
presence** rather than two readings of a broken instrument. Same function, two inputs, one script.

⚠️ **§10's recorded `familyNodes` was 105 and it reads 107 today.** The template moved between
2026-08-31 and now. The `writes` figure did not — **57 both times** — so the row was re-derived,
not re-read.

⚠️ **The artefact already carried 81 `runOnChange-*` keys, every one of them `false`, and they are
NOT part of this defect.** Those are authored answers (the generator's own sources write them
deliberately, and `preserved` counts them). The pin never touches a key that is already present —
*"this single check is the whole of idempotency"* — so it wrote the 57 that were absent and moved
nothing else.

### After

| artefact | `writes` | `familyNodes` | `preserved` |
| --- | --- | --- | --- |
| `templates/members-area` | **0** | 107 | 135 |
| `site-builder.content.json` | 0 | 97 | 98 |

`preserved` moved 78 → 135, which is 78 + 57 exactly. `familyNodes` did not move, so the zero is a
settled artefact and not an instrument that stopped seeing the population.

## What was built

1. **`packages/noodl-mcp/tests/templateArtefact.ts` — a new module.** Holds `readAsLegacyProject`
   (moved, not copied) and the new `pinRunOnValueChangeDefaultsInDirectory`.
2. **`pinRunOnValueChangeDefaultsInDirectory(projectDir)`** — the same settling as
   `toTemplateContent`, for a generator that ships a **v2 directory** rather than an embedded
   `content.json`. Plans through the editor's own reader, then writes the named parameters back
   into the `nodes.json` files, **governed checkbox first** in the bag (queued inputs drain in key
   order — same rule as `writeGovernedCheckboxes`, same reason).
   🔴 **Writes by node id, with the cardinality asserted**: a plan entry matching two files, or
   none, throws rather than settling the wrong node. Ids in a v2 directory are component-scoped by
   schema, not project-unique. (Measured on the shipped artefact: 551 nodes, 551 distinct ids —
   true today, and not a property the function may assume.)
3. **One call in `prepareArtefact`**, before the id pinning reads the files.
4. **`templates/members-area` regenerated** — 57 insertions, 0 deletions, 18 files. Nothing else in
   the artefact moved, which is itself a check: the generator is byte-reproducible, so unrelated
   churn would have shown up here.

### 🔴 Why the module extraction is part of the fix, not tidying

`readAsLegacyProject` lived in `sb007Template.ts`, which imports `SB004/005/006_COMPONENTS` and
`createServer` **at module scope** — the whole site-builder authoring surface. The first run of this
row's gate died with `FIELD is not defined` and **`Tests: 0 total`**, from a peer's half-saved edit
to `sb006Components.ts` in a lane with nothing to do with this one.

⚠️ **`Tests: 0 total` is the dangerous half** — it reads like a deleted spec, not a broken import.
A gate over the *committed artefacts* must not be able to fail that way because of an unrelated
generator's source. After the extraction the gate ran green while that file was still broken, which
is the decoupling proved by the failure that motivated it. TPL-001's generator was on the same
chain and is now off it too.

## The gate — `def038SettledTemplates.test.ts`, and it is NOT beside one generator

🔴 **§10's third instruction was *gate it across BOTH generators, or this row recurs with a third
template*.** So the gate does not name its artefacts — it **finds** them: every directory under
`templates/` carrying a `nodegx.project.json`, and every `*.content.json` in the editor's embedded
template folder. Two shapes, because the two generators ship differently.

| arm | what it reads |
| --- | --- |
| control | the sweep found ≥ 2 artefacts, and both shapes are named in the result |
| per artefact | an editor load would write nothing (`writes === []`) |
| per artefact | presence control: `familyNodes > 0` **on the same reading** |
| per artefact | mutant: un-settle exactly one parameter and the planner finds work again |

The last arm is what stops this passing against a planner that had quietly stopped finding
anything. The control arm is what stops it passing over an empty population — *a sweep that reached
nothing reports the answer you wanted*.

### Mutants, each killed by its own arm

| # | mutant | result |
| --- | --- | --- |
| **M1** | restore the pre-fix artefact | **2 failed, 3 passed** — both members arms red, all three site-builder/control arms green |
| **M2** | remove the one call from `prepareArtefact` and regenerate | artefact returns **byte-identical to pre-fix HEAD** (empty diff, the 57 `true` gone); same two arms red |

🔴 **M2 is the one that matters**: it proves the settling lives in the generator, not in a
hand-edited artefact. Without it, a commit that edited `templates/` directly would read the same.

## Gates run

| gate | result |
| --- | --- |
| `def038SettledTemplates.test.ts` | **5/5** |
| `tpl001Template.test.ts` (regenerates and compares bytes) | **72/72** |
| `sb007Template.test.ts` (the site-builder drift gate, whose module lost a function) | **62/62** |
| `npm run typecheck:mcp` | **exit 0**, 0 `error TS` |

## Bounds — stated so this is not over-read

- ⚠️ **`hello-world.template.ts` is outside the sweep by construction.** It is a `.ts` module, not a
  discoverable artefact. It contains **none of the fifteen families** (measured: zero occurrences of
  any family type), so there is nothing to settle — but **a third template written as a `.ts` module
  would escape this gate the same way.** That is the known hole, not a claimed absence.
- ⚠️ **This gate grades the artefacts as committed, not the generators.** `tpl001Template.test.ts`
  and `sb007Template.test.ts` own that half by regenerating and comparing bytes. Both halves are
  needed: this one fails if a committed artefact drifts, those fail if a generator stops producing
  it.
- ⚠️ **The 81 authored `false` values were not audited for correctness.** They are outside this
  row: it is about the parameters nobody wrote, and the pin is defined never to touch an answered
  one. Whether each of the 81 is the answer its author wanted is a different question and nobody
  has asked it.
- 🔴 **A template already published to a shelf still carries the old bytes.** This fixes what the
  generator writes and what this repository ships; anything already installed from a curated shelf
  is unaffected until it is republished. Related but not the same row —
  [§9](UNOWNED-ROWS-TO-MEASURE.md) owns the curator's door.
