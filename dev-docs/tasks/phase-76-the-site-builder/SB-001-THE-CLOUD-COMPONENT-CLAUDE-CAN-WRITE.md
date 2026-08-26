# SB-001 — The cloud component Claude can write

**Status: OPEN, mapped s1 (2026-08-26).** Findings 3–4 of the phase README §3, corrected below.

## The map corrected the README

README §3.3 said "`toPathForm` strips the leading `#`". **`toPathForm` is correct** — it exactly
mirrors the editor's `legacyNameToPath` (`ProjectExporter.ts:171-179`); `__cloud__/X` *is* the
canonical registry key. **The broken half is the inverse**: `pathToLegacyName`
(`noodl-mcp/src/paths.ts:24-26`) is a bare `'/' + path`, missing the two special cases the editor's
real inverse has (`ProjectImporter.toLegacyName`, `ProjectImporter.ts:160-176`): `__cloud__/…` →
`/#__cloud__/…` and `%rootcomponent`. Root cause is an asymmetry: `editor-deps.ts:233` already
re-exports `legacyNameToPath` from the editor, but the inverse was re-implemented locally.

Consequences of the missing case, verified:

- `create_component` (`author.ts:455`) mints `component.path: '/__cloud__/X'`. Importer prefers the
  stored `path` field (`ProjectImporter.ts:161-164`) so the fallback can never repair it. The
  component then **fails** `isCloudFunctionComponent` (prefix `'/#__cloud__/'`), so it ships in the
  **browser bundle** (deployer keeps `!startsWith('/#__cloud__/')`) and never reaches the cloud
  bundle — `POST /functions/X` 404s.
- Plans reconstitute with `pathToLegacyName` at **six** sites (`planTools.ts:232,261,401,574-575,
  756,954`) — same loss. Plus `:954`: a mis-prefixed cloud component whose path matches
  `/(^|\/)pages\//i` would get **router-registered**.
- The other spelling (`#__cloud__/X`) breaks differently: correct legacyName, wrong registry
  key/directory (disagrees with `legacyNameToPath`); next editor save orphans the MCP directory.
  `ProjectStore.resolve`'s lenient fallback (`ProjectStore.ts:284-286`) masks a half-fix in
  MCP-only round trips — test through the editor's reader, not just the MCP's.
- `stage_plan_operation` never passes `type` (`planTools.ts:760-768`) — always falls to
  `inferComponentType`. Fine once paths are right (`__cloud__` infers `cloud`), but note
  `inferComponentType` is a lowercased `includes('__cloud__')` checked before Pages
  (`ProjectExporter.ts:190-196`) — `/Pages/__cloud__Backup` is typed `cloud`; the strict test is
  `refFromComponentName`'s prefix match (pinned by `functionrefresolution.test.ts:41`).

## Finding 4 (no runtime-context check), located

The catalog field is **`availableIn`** (`node-catalog-enriched.json`; census: 91 browser-only,
69 both, 15 cloud-only). MCP surfaces it (`catalog.ts:241,297,364,703`) and `validate.ts` never
reads it. The editor enforces same-runtime in the picker (`createnodeindex.ts:28,96-99`), paste
(`EditorClipboard.ts:231`), and extraction (`ExtractToComponent.ts:392-406`) — but the write gates
check nothing: `noodl.cloud.request` into `/Pages/Home` validates clean, and `Text` into a cloud
graph does too.

**Placement ruling (from the repo's own conventions): the shared gate, not MCP-local.**
`gateParity.test.ts` asserts the editor gate and MCP gate return identical verdicts — an MCP-only
check breaks that premise. So: an eleventh precondition in `authoredPreconditionDiagnostics`
(`authoredCandidate.ts:426-447`), behind a new `runtime` option following the file's stated
"omitted means do not check" convention; a new `DiagnosticCode` (`diagnostics.ts:48`); an entry in
`AUTHORED_BLOCKING_WARNINGS` (`authoredCandidate.ts:208-240`) to make it blocking. Check each
node's `availableIn`, and component-*instance* nodes by the target component's prefix (the
same-runtime rule, `createnodeindex.ts:96-99`).

## The plan

1. Fix `pathToLegacyName` to mirror `ProjectImporter.toLegacyName` (prefer sharing the editor's
   logic through `editor-deps` over a second local copy). Both spellings then normalize:
   `#__cloud__/X` → toPathForm → `__cloud__/X` → legacyName `/#__cloud__/X`.
2. Cross-check `type` vs path at create: explicit `type` that disagrees with the path-inferred one
   is a rejection with a diagnostic (metadata and destiny must agree).
3. The runtime-context precondition (shared placement above); MCP passes `runtime` derived from the
   path prefix. Cloud components with no Request node are **legal** (helpers — the composition
   idiom; SB-003 handles their HTTP boundary). No `pages/` segment in a cloud path
   (`looksLikePageComponent` is name-driven — `navigation.ts:122`).
4. AWP-002 gate: author a fourth fixture at `#__cloud__/…` in `writePathConformance.test.ts`
   `beforeAll`, flip the pinned set to `['cloud','page','root','visual']`, delete the ⚠️ comment at
   `:214-221` (it was written as exactly this tripwire). `gateParity` + `vocabularyParity` stay
   green.

## ⚠️ Doctrine traps for SB-002 (and any cloud guidance)

- **A cloud function's interface is the `params` string on its `noodl.cloud.request` node, NOT a
  `Component Inputs` node** (`newFunctionFromStep.ts:113-145`). The server's own instructions
  prominently teach Component Inputs — correct for frontend, wrong for cloud roots. Helper cloud
  components (composed by instance) DO use Component Inputs/Outputs.
- Budget: schema-description prose lives in editor `authoringVocabulary.ts`, is inlined multiple
  times, and is measured by the surface gate (~57 tokens free). Teach the `#__cloud__/` spelling in
  rejection diagnostics and tool results, not schema prose.
- MCP has essentially no concept of "cloud" today: no prefix constant, no runtime notion, one enum
  value and a comment. `cloudFunctionUnavailableReason` (`createMenu.ts:118-140`) enforces
  top-level-only for *functions* at the editor door; nested helper names are shipped practice
  (`Stripe/Subscriptions/*`) — see SB-003's FUNCTION_NAME_RE half before enforcing anything.

## Session log

- **s1 (2026-08-26)** — mapped (Explore, verified file:lines). Plan above; not started.
