# SUB-002 — Field Audit & Working Notes

_Executor: Opus 4.8 (Sonnet-tier task per spec). Committed to `cline-dev`._

## 1. Field Audit

Method: enumerated every property on the legacy project / component / graph / node /
variant TypeScript types in [ProjectExporter.ts](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts),
then cross-checked against what the exporter emits and the importer restores. "Real
evidence" columns come from the six real `project.json` files in
`packages/noodl-editor/tests/testfs/` (import_proj1/2/5, watchproject, git-repo-utf8 (44
components), big-merge-test-mine (176 components)) — see §2.

Legend: ✅ carried · ❌ dropped (gap) · ⚠️ carried but lossy/asymmetric

### Project level (`LegacyProject`)

| Field | Exporter emits | Importer restores | Status | Notes / real evidence |
|-------|----------------|-------------------|--------|-----------------------|
| `name` | ✅ | ✅ | ✅ | |
| `version` | ✅ (`?? '4'`) | ✅ | ⚠️ | Coalesces missing → `'4'`. All 6 real projects set it, so no divergence on the corpus. Left as-is (documented). |
| `runtimeVersion` | ✅ | ✅ | ✅ | |
| `settings` | ✅ (if non-empty) | ✅ (if non-empty) | ✅ | Symmetric empty-drop. |
| `rootNodeId` | ❌ | ❌ | ❌ **GAP** | Present in 5/6 real projects. Named in spec. |
| `metadata` | ✅ (minus styles/routes) | ✅ (merges them back) | ⚠️→✅ | See styles/routes gaps below; fixed. |
| `lesson` | ❌ | ❌ | ❌ **GAP** | Named in spec. No real fixture sets it; synthetic coverage added. |
| `variants` | ✅ | ✅ | ⚠️ | `conflicts` sub-field dropped — see variant table. |
| `components` | ✅ | ✅ | ✅ | |
| `id` | ❌ | ❌ | ❌ **GAP** | project-v2 schema already declares `id`; exporter never read it. Present in import_proj2, watchproject. |
| `thumbnailURI` | ❌ | ❌ | ❌ **GAP** | Not in any type or schema; real top-level key in watchproject. |

### Graph level (`LegacyGraph`, → `nodes.json`)

| Field | Exporter emits | Importer restores | Status | Notes |
|-------|----------------|-------------------|--------|-------|
| `roots` | ✅ | ✅ | ✅ | Flatten/unflatten by id. |
| `connections` | ✅ | ✅ | ✅ | |
| `visualRoots` | ❌ | ❌ | ❌ **GAP** | Named in spec. No real fixture; synthetic coverage added. |
| `comments` | ❌ | ❌ | ❌ **GAP** | Named in spec. Present in git-repo-utf8 (rich comment objects). |

### Node level (`LegacyNode`, flatten/unflatten)

All 16 declared fields (`id`, `type`, `variant`, `version`, `label`, `x`, `y`,
`parameters`, `stateParameters`, `stateTransitions`, `defaultStateTransitions`, `ports`,
`dynamicports`, `conflicts`, `children`, `metadata`) are ✅ carried. The `[key: string]:
unknown` index signature is **not** carried, but a scan of every node in all 6 real
projects found **zero** keys outside the known set — no real-data gap. Documented as a
known non-goal; the drift guard (§ drift) covers the model-declared surface.

Empty-collection asymmetry (⚠️, intentional): exporter omits empty `parameters: {}` etc.;
importer only restores present keys. `{}` ↔ absent is semantically identical in this
format and jest `toEqual` treats an `undefined`-valued key as absent, so round-trip holds.
Not weakened — normalisation is inherent to the format, not hidden in the assertion.

### Variant level (`LegacyVariant`, → `styles.json`)

| Field | Exporter emits | Importer restores | Status | Notes |
|-------|----------------|-------------------|--------|-------|
| `name` | ✅ | ✅ | ✅ | Real variants often omit `name`; `toEqual` tolerates the `undefined`. |
| `typename` | ✅ | ✅ | ✅ | |
| `parameters` | ✅ | ✅ | ✅ | |
| `stateParamaters` (sic) | ✅ (→ `stateParameters`) | ✅ (→ `stateParamaters`) | ✅ | Typo normalised on export, reversed on import. |
| `stateTransitions` | ✅ | ✅ | ✅ | |
| `defaultStateTransitions` | ✅ | ✅ | ✅ | |
| `conflicts` | ❌ | ❌ | ❌ **GAP** | Latent — no real fixture sets it, but it is a declared model field. |

### Styles (`metadata.styles`, → `styles.json`)

| Legacy key | v2 key | Status | Notes |
|------------|--------|--------|-------|
| `colors` | `colors` | ✅ | |
| `text` | `textStyles` | ❌ **GAP** | Exporter read `metaStyles.textStyles` — a key that **does not exist** in legacy (real key is `text`). All text styles silently dropped for every real project (import_proj5, git-repo-utf8 both have `text`). Fixed by mapping `text` ↔ `textStyles`. |

Union of `metadata.styles` keys across all 6 real projects: `{colors, text}` only.

### Routes (`metadata.routes`, → `routes.json`)

| Case | Status | Notes |
|------|--------|-------|
| array-shaped routes | ✅ | Carried to routes file, restored to `metadata.routes`. |
| non-array routes | ❌ **GAP** | Stripped from metadata unconditionally but only re-emitted when array-shaped → lost. No real fixture has non-array routes; fixed by not stripping what cannot be emitted. |

## 2. Fixture corpus (real projects)

The corpus references the real projects already committed under `tests/testfs/` directly
(single source of truth — no 6 MB duplication). Loaded via `require()` in
`tests/io/roundtrip-fidelity.test.ts` and `schema-drift.test.ts`:

| Fixture (testfs) | Why chosen |
|------------------|-----------|
| import_proj2 | Smallest; only `{id,name,components,version}`. |
| import_proj1 | rootNodeId + settings + empty metadata + variants array. |
| watchproject | Exercises `thumbnailURI` top-level key. |
| import_proj5 | 9 variants + `metadata.styles.{colors,text}`. |
| git-repo-utf8 | 44 components, 17 variants, real `comments`. |
| big-merge-test-mine | 176 components — scale/perf sanity. |

Plus one **synthetic** fixture committed at
`tests/io/fixtures/synthetic-awkward.project.json` that sets the fields no real project in
the repo happens to use — `lesson`, `visualRoots`, variant `conflicts`, non-array
`routes`, dynamic-port nodes, deep nesting, state transitions — so the awkward cases are
still covered.

Empty-collection normalisation (documented in the test header): the v2 format
intentionally omits empty `{}`/`[]` (a tested contract — ProjectExporter.test.ts "omits
empty parameters object"). Real nodes carry thousands of empty `ports`/`dynamicports`/
`parameters`. The round-trip suite strips empty collections from **both** sides before
`toEqual`, so only the semantically-void empty-vs-absent noise is collapsed; any non-empty
difference still fails.

## 3. Drift guard

`schema-drift.test.ts` reflects over the declared legacy model surface and asserts each
project/graph field has a representation in the v2 schemas, so a future field added to the
model that the exporter forgets to carry fails a test instead of vanishing silently.
