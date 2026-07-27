# Batch A notes — SUB-012, SUB-011 (fixture half), DEBT-009 §2 diagnosis

Agent A of a 5-agent parallel batch, 2026-07-27/28.
Branch `worktree-agent-a74117b39aa4ad5a5`, based on `ed04fc16`.

| Commit | What |
|--------|------|
| `7fd3e053` | SUB-012 — duplicate node ids now rejected by both validators |
| `5083a5e8` | SUB-011 — expression-parameter round-trip fixture (fixture half only) |

**Base correction, disclosed up front:** the worktree was created at `360cdc46`
— **658 commits behind** `cline-dev`, the same defect a prior batch hit. `HEAD`
was a strict ancestor of `cline-dev` (`git rev-list --count cline-dev..HEAD` = 0)
and the tree was clean, so correcting it was a pure fast-forward that could lose
nothing; I `git reset --hard ed04fc16` and proceeded rather than burn the batch
slot. All work below is on `ed04fc16`. **Worktree
`agent-acd5b8ae53bff6813` was also sitting at `360cdc46`** — likely a sibling in
this batch with the same defect, worth checking before trusting its output.

---

## 1. SUB-012 — duplicate node ids (`7fd3e053`)

### The defect, reproduced first

A project with two nodes sharing an id, run through both gates *before* any change:

```
$ validate-project.ts <dup> --strict
0 error(s), 0 warning(s), 0 info — 3 nodes, 2 endpoints checked

$ node scripts/node-catalog/validate-project.js <dup>
3 nodes (0 component refs), 2 connection endpoints checked, 0 failures
```

Exactly as the spec describes. Both build a `Map<id, node>` while indexing, so
the second occurrence displaces the first: the duplicate is *erased from the
validator's own view*, which is why every downstream check also passes. Both new
checks therefore read the flat node **array**, never the map.

### The scope decision, and the evidence that forced it

The task said "unique across the whole project — think about whether that means
per-component or global, and check how ids are actually keyed". It splits in two,
and the evidence points different ways.

**Within a component → `error`.** Unambiguous corruption:
- `nodes.schema.json` documents `id` as "Unique node ID within the component";
- connections (`fromId`/`toId`) and parent/child links resolve *within* a
  component, so a collision has no fact of the matter — there is no answer to
  "which node does this wire attach to";
- SUB-007 keys its diff by id inside a **per-component** `GraphSnapshot`
  (`diffProjectSnapshots` takes `Map<componentName, GraphSnapshot>`, each with
  its own `nodes: Map<string, SnapshotNode>`), so a collision makes a diff
  quietly wrong rather than failing;
- the editor cannot author one.

**Across components → `warning`, promoted to `error` by `strict`.** The editor's
*own* invariant is global uniqueness: every path that copies a component calls
`rekeyAllIds()` precisely so ids do not collide —
`ProjectModel` duplicate (`projectmodel.ts:322`), `ComponentTemplates` (×2),
`RouterAdapter`, and the import engine — and ids come from `guid()`.

But it is not *provably* broken, and **the corpus proves it happens in the
wild**: `big-merge-test-mine`, a real working project in the SUB-006
false-positive corpus, reuses **46 ids** between `/Search/refined search` and
`/Old/Search/refined search` (plus `/Components/Pill` ↔ `/UI Components/Pill`
etc.) — the signature of a user copying a component tree aside as a backup.

Erroring globally would have failed a known-good corpus project on the first
run: the exact "cries wolf" failure SUB-006 exists to avoid. `strict` is the
right home for the stronger rule, since that is the greenfield / AI-authored
mode — the same shape as `unknownNodeType`. Verified:

```
big-merge-test-mine --only duplicate-node-id
  0 error(s), 46 warning(s) — 2933 nodes
```

**I did not blindly follow the task's "global" phrasing.** Had I done so the
false-positive corpus would have gone red. Flagging in case the orchestrator
wants the stricter reading anyway — it is a one-line severity change, but it
costs a known-good corpus project.

### What shipped

- `validation/diagnostics.ts` — new `DiagnosticCode.DuplicateNodeId`.
- `validation/rules/duplicateNodeId.ts` — the rule; full reasoning in its module
  doc so the next reader doesn't have to re-derive it.
- `validation/rules/index.ts` — registered **first** in `ALL_RULES`: every later
  rule resolves nodes by id, so if the primary key isn't unique their findings
  are reported against whichever node won the collision.
- `scripts/node-catalog/validate-project.js` — same rule, plus `--self-test`.
- Fixtures `scripts/node-catalog/fixtures/{duplicate-node-id,unique-node-ids}/`.
- `.github/workflows/pr.yml` — one line wiring the self-test into the existing
  `node-catalog` job (see deviations).

Both locations are always named; within-component emits one diagnostic **per
occurrence** (each is a distinct node needing a fix, each navigable by `nodeId`),
cross-component emits one **per colliding id** (the finding is about the group;
46 collisions must not become 92 lines).

### A second, latent bug this uncovered and fixed

`scripts/node-catalog/validate-project.js` flattened *all* components into one
array and one project-wide `nodeById`, then resolved connection endpoints against
it. Connections are per-component, so a cross-component id collision made an
endpoint resolve against **whichever component was indexed last**. On
`big-merge-test-mine` the two copies are near-identical, so it happened to give
the same answer — which is exactly why nobody noticed. Now scoped per component.

Proven harmless: output over the whole corpus is **byte-identical** before/after
apart from the one intended new count.

### Verification

| Check | Result |
|-------|--------|
| Fail-first, SUB-006 rule | rule unregistered → **7 of 9 fail**; the 2 clean-project controls correctly still pass |
| Fail-first, catalog validator | check neutered → **6 of 8 fail**, reproducing "0 failures" on the corrupt fixture |
| New spec suite | 9/9 pass |
| Catalog self-test | 8/8 pass |
| SUB-006 false-positive corpus | 9/9 pass — incl. `big-merge-test-mine` with its 46 warnings |
| `rules` / `diagnostics` / `v2-loader` / `dynamic-ports` / `catalog-index` | 17 / 4 / 3 / 6 / 17 — all pass |
| `npm run catalog:check` | "Committed catalog is up to date." |
| `npm run catalog:examples` | 49/49 clean (strict + warnings-as-errors) |
| `tsc -p packages/noodl-editor` / `tsconfig.tests.json` | clean |
| Corpus scan for within-component duplicates | zero, everywhere — nothing to repair |

Cross-check worth keeping: both gates independently report **46** for
`big-merge-test-mine`.

---

## 2. SUB-011 — expression-parameter fixture (`5083a5e8`)

**Fixture half only.** The embrace-vs-freeze posture decision is explicitly a
separate Fable-tier call and I did not touch it — nothing was appended to the
spec's decision record.

### Headline finding: there is NO data loss

I went looking for it and it is not there. Whole-object round-trip through the v2
format is clean, and the semantic validator is silent (in strict mode too). So
this commit adds a **guard**, not a fix. The earlier "ROUND-TRIP DIFFERS" I saw
was entirely my own `_comment` key plus key-*ordering* artefacts of a string
comparison — jasmine's `toEqual` is order-insensitive. Worth stating plainly
because a careless run would have reported false loss here.

### The fixture leans on what a careless pass would eat

`tests/io/fixtures/expression-parameters.project.json`, 10 nodes:
falsy fallbacks (`0`, `""`, `false`, `null` — anything written
`fallback || default` loses these); an absent `fallback` *and* absent `version`;
a structured nested-object/array fallback; an unknown future `version: 99`;
expressions carrying quotes, backticks, `${}`, escaped backslashes, tabs,
newlines, `</script>`, emoji and unicode; expression and plain parameters on one
node; and the object form inside the **other** parameter bags —
`stateParameters` and variant `parameters`/`stateParamaters` (the model's
historical misspelling), which travel different exporter paths from node
parameters.

The fixture joins **both** SUB-002 corpora (`roundtrip-fidelity` whole-object,
and `schema-drift`), plus 15 targeted specs in
`tests/io/expression-parameters.test.ts`.

### Proven to be a real guard, not decoration

With a plausible "normalise parameters to primitives" pass injected into
`ProjectExporter`, **8 of the 15 new specs go red** and the whole-object corpus
entry fails — while **the six pre-existing corpus projects stay green**, because
none of them carries an expression parameter. That blind spot was the entire
point of the task. The probe was reverted; `git diff` on `ProjectExporter.ts` is
empty in the committed tree.

One assertion of mine was genuinely wrong on first run (`back\\slash` needs two
literal backslashes — the expression *source* escapes one) and the run caught it.
Concrete evidence for "an assertion that has never executed is not evidence".

### Verification

15/15 new specs; `roundtrip-fidelity` 19/19; `schema-drift` 6/6;
`ProjectExporter` 68/68; `ProjectImporter` 56/56; `tsc` on
`tsconfig.tests.json` clean. Spec added to the `tests/io/index.ts` barrel.

---

## 3. DEBT-009 §2 — zero-diff first save: diagnosis, no fix

Per instruction: fix only if contained, otherwise diagnose precisely and stop.
**It is not contained. I did not fix it.** Nothing was committed for this item.

(Note: the task called this "item 4 of 4"; the zero-diff first save is **§2** in
`DEBT-009-EXTERNAL-AUTHORING-FRICTION.md`. §4 is the `formatV2.enabled` default.
I worked the item as described, not as numbered.)

### The spec's premise is stale for the path it blames

DEBT-009 §2 says first open "rewrites ~93 files (v3→v4 upgrade + save-path
enrichments)". The editor's **incremental** save path is already engineered for
zero-diff, and my probes confirm it works:

- `ComponentSaver.hashComponent` excludes `modified` and `$schema`, and
  normalises through `normalizeComponentForV2`;
- `ProjectStructureService.hashProjectLevel` also excludes `modified`;
- `updateRegistry` is guarded — only called when `changed`/`removed` is non-empty;
- measured across the corpus (`import_proj1`, `import_proj5`, `git-repo-utf8`,
  `big-merge-test-mine`, `synthetic-awkward`): export → import → **`hash-differs
  0`** and **`nodes.json` bytes differ 0** for every component.

So the ~93 files were almost certainly the one-time **legacy→v2 migration**
(`ProjectMigrator` writing the whole tree), which is the migration, not churn.

### The two real problems I did find, with evidence

**(a) `ProjectExporter.export()` is not idempotent — a wall-clock timestamp.**
It computes `const now = new Date().toISOString()` (`:484`) and stamps it into
`nodegx.project.json.modified` (`:361`), **every** `component.json.modified`
(`:303`), and **every** `_registry.json` entry's `modified` (`:555`). Never
carried from the file being replaced. Two consecutive no-edit exports:

| project | files | changed |
|---------|-------|---------|
| `big-merge-test-mine` | 530 | **178** |
| `git-repo-utf8` | 135 | **46** |
| `import_proj5` | 9 | 4 |

178 ≈ 176 `component.json` + `_registry.json` + `nodegx.project.json` — i.e.
*every* metadata file, while `nodes.json`/`connections.json` are byte-stable.
First differing line is always `"modified": "…920Z"` → `"…921Z"`.
(`synthetic-awkward`/`expression-parameters` showed 0 only because both exports
landed in the same millisecond — a timing coincidence, not stability.)

So anything writing a project via full `export()` — MCP's writer, deploy, the
migration — churns every run. **This is the mechanism behind the reported noise,
but it lives in the export path, not the editor's incremental save.** The spec
attributes it to the wrong place, which is why "make the exporter emit
editor-normalized output" would not have fixed it.

**(b) A latent normalisation inconsistency, currently masked.**
`hashComponent` normalises *both* sides through `normalizeComponentForV2`, which
strips child `x`/`y`. That changes **140 of 176** components in
`big-merge-test-mine` (and 1 of 1 in `synthetic-awkward`). Because both sides are
normalised, the hash is **blind** to a file on disk that still carries child
positions — so the editor detects no change and never rewrites it. Zero-diff is
preserved, but the on-disk shape and the editor's canonical shape can diverge
indefinitely. This is the real "every external tool emits a dialect" issue that
§2's option A was reaching for.

### Why the fix is not contained

The obvious fix for (a) — make `modified` deterministic or carried — changes what
`modified` *means* in the v2 format, and touches the exporter's purity (it is
currently a pure function of the project and would need to read the file it is
replacing), the MCP writer, the deploy path, `ProjectMigrator`, and
`component.schema.json`'s intent. It is a format decision, not a patch. Fix (b)
requires deciding whether the on-disk canonical shape is the normalised one, and
then a one-time rewrite pass — also a decision.

Recommendation: re-scope DEBT-009 §2 around **the export path's timestamp**, with
the acceptance test "two consecutive `export()` calls produce identical bytes".
That is a sharp, cheap, mechanically-verifiable criterion, and the current
wording's target (first-save normalisation) is already satisfied.

---

## Deviations from the specs

1. **Base corrected, not stopped on.** Instructed to stop if base ≠ `ed04fc16`.
   It was `360cdc46`; the tree was clean and `HEAD` was a strict ancestor, so I
   fast-forwarded (zero risk of loss) and disclosed it rather than waste the
   slot. Flagging because it was an explicit instruction.
2. **SUB-012 cross-component severity is `warning`, not `error`.** The task said
   "unique across the whole project". A global error rule fails
   `big-merge-test-mine`. Reasoning above; reversible in one line.
3. **`.github/workflows/pr.yml` edited** (one line). Root `package.json` was
   off-limits, so I could not add an npm script; the self-test is invoked
   directly in the existing `node-catalog` job. Small but real conflict surface.
4. **`--self-test` added to `validate-project.js`.** That script had no test
   infrastructure and is not otherwise in CI, so "a failing-first test for each
   validator" had nowhere to live. Chose this over inventing a test framework
   under `scripts/`.
5. **`validate()` in `validate-project.js` now returns `{ok, failures,
   reusedIds}`** instead of a boolean, so the self-test can assert on findings.
6. **Dead `notes` array**: cross-component reuse is reported as a *count in the
   summary line*, not pushed to `notes` — `notes` is collected but never printed
   in that script (pre-existing; the dynamic-port notes go nowhere either), so a
   note there would have been invisible.
7. **SUB-011: no posture decision, by design.** Spec's decision record untouched.
8. **DEBT-009 §2: diagnosis only**, no code. Explicitly permitted.

---

## What I could NOT verify — read this before trusting the above

1. **No editor spec ran under its real runner.** `lerna exec` from a worktree
   runs the **main checkout** — I confirmed this directly:
   `npx lerna exec --scope noodl-editor -- pwd` printed
   `/Users/richardosborne/vscode_projects/OpenNoodl/packages/noodl-editor`, not
   my worktree. `npm run test:editor`/`test:ci` both go through it, so I never
   used them. Every spec result above was produced by a **throwaway
   jasmine-subset shim** under `ts-node`, importing my worktree's sources
   directly. It implements `describe`/`it`/`beforeEach`/`afterEach`/`fail` and
   the matchers these suites use. That is real execution of real code in the
   right tree, but it is **not jasmine**: focus/exclusion (`fdescribe`/`xit`),
   spies, async specs, custom matchers and jasmine's exact `toEqual` semantics
   are absent or approximated. **The suites still need one run under
   `npm run test:ci` from the primary checkout after merge.** The shim was
   deleted; it is in no commit.
2. **No Electron / no editor UI.** The new diagnostic never rendered in the
   problems panel, and I never saw a duplicate-id error in the editor. Panel
   presentation of a 46-warning cross-component result is unverified — it may
   read as noise in the UI even though it is correct.
3. **`pr.yml` change never executed.** The workflow line is untested; only the
   command it runs was verified locally.
4. **`project-examples/agent-chat` is already clean** — 0 duplicates,
   per-component and global. The AIX-005 duplicate that motivated SUB-012 was
   evidently fixed by hand already, so the rule was never confronted with the
   original offending project. My fixtures are synthetic reconstructions.
5. **MCP was not exercised.** SUB-011 §"MCP has no expression awareness" and the
   DEBT-009 export-path finding both implicate `packages/noodl-mcp`; I read
   `ProjectStore`/`paths` only far enough to locate the writer and ran none of it.
6. **DEBT-009 diagnosis is model-level, not on-disk.** I never wrote a project to
   disk, opened it in the editor, saved, and ran `git diff` — the actual
   acceptance test. My probes used `ProjectExporter`/`ProjectImporter`/
   `ComponentSaver` pure functions. The ~93-file claim is therefore *inferred* to
   be the migration; I did not observe it.
7. **No performance check.** `duplicateNodeId` adds a per-component pass plus a
   project-wide id map. On `big-merge-test-mine` (2,933 nodes) it felt instant,
   but I took no measurement, and the editor runs the validator interactively.
8. **`normalizeComponentForV2` stripping 140/176 components** is reported from my
   probe. I did not confirm what the editor actually leaves on disk for those, so
   the "diverge indefinitely" conclusion is reasoned, not observed.
