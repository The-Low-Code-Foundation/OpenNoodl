# Phase 40 — AI authoring quality: the handover prompt

Rewritten 2026-08-04 at the end of the **Layer-1 session**. The previous version of this file was the
*diagnosis* session's handover — it said "nothing is committed" and framed the next session as
pair-building with Richard. Both are out of date; what it knew that is still true has been folded in
below.

Paste the block below into a fresh session.

---

You are continuing **Phase 40 — AI authoring quality**. Read
`dev-docs/tasks/phase-40-ai-authoring-quality/README.md` and this file before doing anything, then the
task file for whatever you pick up. The phase's own rule applies to its documents as well as to the
code: **read the mechanism in source before trusting a stated fact, including the README's and this
file's.** Three premises written by the people who opened this phase did not survive that check — they
are listed below, and finding them was most of the value of the last session.

## Where the phase stands

**Layer 1 (the seams) is built.** Commits `4a0fdd4f`, `83647de9`, `c0bf8b5b` on `cline-dev`.
Editor suite **2165 specs, 0 failures**; `typecheck:editor` and `typecheck:editor-tests` clean.

| Task | State |
|---|---|
| AAQ-001 — a created page is reachable | Built. Criteria 1–4 closed in code and under test; **criterion 5 (proven live in a preview window) outstanding**. |
| AAQ-002 — the backend is first-class | Slices 1–3 built. **Slice 4 open** (the agent is still not told the collections). Criteria 1–3 are live-QA. |
| AAQ-003 — authored apps scroll | Scope→setting and prompt doctrine built; criterion 3 under test. **Criteria 1–2 are live-QA.** The static validation rule was deliberately dropped — the reason is in the task file. |
| AAQ-004 — the conversation is kept | Mechanism A built and under test. Mechanism B stays with AAQ-006, as that file directs. |
| AAQ-005 → 007 (the engine) | Not started. This is the next substantial work. |
| AAQ-008/009/010 (doctrine) | Not started. Prompt-encodable parts can land early; acceptance runs against the new engine. |
| AAQ-011 | Register, worked opportunistically. Nothing added this session. |

## The three corrections. Do not re-derive these the hard way

1. **`prop-age` / `prop-bio` was never a timing problem, and AAQ-002 said it was.**
   `SchemaHandler._fetch()` (`utils/schemahandler.ts`) had been a **stub since WF-007**: it set
   `dbCollections = []`, `haveCloudServices = false`, and `_store()` then wrote `undefined` — on *every*
   `window-focused` and *every* `cloudServicesChanged`. The only other source
   (`backendServices.backends[]`) holds BYOB configs only, and `endpointBackendEntry` — the synthetic
   entry the runtime builds for a `cloudservices` pointer — carries no `schema` at all. So those ports
   could not exist for a built-in backend **at any point, in any order**. Now fixed by introspecting over
   `backend:list` → `backend:status` → `backend:getSchema`.
   The chain, for anyone debugging a missing data port: `record-ports.ts` → `resolveSchemaPortContext`
   (`schema-ports.ts:477`) → `selectedBackend?.schema?.collections` → `dbCollections` fallback →
   `schemahandler.ts`.

2. **`RouterNavigate.target` and `Page.urlPath` are not in the node catalog.** Both are
   runtime-discovered ports (`registerInputIfNeeded`, `_updatePorts`), and `checkParameterValues`
   **skips dynamic-port nodes entirely** — so any string passed and nothing could ever have caught a
   wrong navigation target. This is very likely *why* the model reached for "navigate to path":
   `PageStackNavigateToPath.path` is the only navigation target the catalog declares statically. The
   model picked the one it had been shown.
   Corollary: the old version of this file said `Page.title`/`Page.urlPath` were caught as phantom
   parameters. **They are not** — `catalog.isDynamicNode('Page')` is true and they are exempt. Verified
   by probe. If you need to know whether a parameter is checked, write the four-line probe; do not
   reason about it.

3. **`buildBackendList` has no production caller.** The Backend Services panel composes three separate
   card components (`CloudServicesEndpointSection`, `LocalBackendCard`, `BackendCard`). The model-level
   list seam and `dataBrowserAvailability` are both reachable only from specs and from one caller that
   always passes `'managed'`. A right model seam is not a right panel — check which one a user actually
   looks at before fixing either.

## What was built, in one paragraph each

**AAQ-001.** Registration is performed by the **plan transaction**, not asked of the model:
`authoring/pageRegistration.ts` (pure) computes it, `staging.ts` writes it into the live project, and
`planStaging.ts` runs it inside the plan's one undo group after the components land. The reasoning is
the provision row's — which components the plan created and which of them are pages is something the
apply *knows* exactly. Idempotent, so an agent that writes the router update itself collides with
nothing. The start page moves only off an **empty placeholder** page (a freshly created project's Home),
never off a page someone built, and the placeholder stays routed. `prospectivePageRegistration` is the
same function the plan review shows a sentence from, so the promise and the act cannot disagree. Both
prompts gained the contract, and `validation/navigation.ts` + `DiagnosticCode.UnresolvedNavigation`
close finding #6 — blocking for authored output, with `plannedComponents` threaded through
`AuthoringSession`/`PlanRun` so the fan-out's *authoring order* never becomes a diagnostic. Calibrated
over all 96 `project.json` in the repo: 3 findings, all true positives.

**AAQ-002.** `matchEndpointToManaged` resolves the endpoint pointer to the managed process it names — by
`instanceId` (the provisioner writes it, so the match is exact) and by localhost port for older
bindings. The pair folds into one entry, the managed one, which is the one that can open its own schema
and data; it now carries the ACTIVE badge, "This project uses this backend", Set active and Disconnect.
Disconnect asks first and says what survives. Plus the schema-cache fix in correction 1 — which needed
no provision-time write, because `setCloudServices` already raises `cloudServicesChanged`.

**AAQ-003.** `ProjectScope.scroll` (`'page' | 'app'`, validated against the union, never cast) →
`AuthoringPlan.scroll` (set only when the plan builds pages, defaulting to `'page'`) →
`ApplyPlanOptions.settings`, applied undoably in the same group and **only where the project has no
value of its own**. `recoverPlan` carries it too. The authoring prompt gained "CONTENT THAT DOES NOT
FIT", with `scrollEnabled` read out of the catalog rather than remembered.

**AAQ-004 A.** Every prose round of a scoping turn is kept, joined by a blank line. The streamed view is
shifted by what has already been said (`withProsePrefix`), so the bubble only ever grows and ends
byte-equal to the transcript entry — the round-local `onText` was collapsing the long answer one layer
above the transcript bug. Failures keep what was said too.

## What to do next

**The live pass is the cheapest high-value work, and nobody has done it.** Everything in Layer 1 is
mechanism-verified and spec-covered, and *none of it has been seen running*. The phase's own doctrine
says a green suite proves nothing about the editor. Suggested order:

1. Cold-replay the puppy brief through the launcher wizard. Watch for: the router listing the created
   pages after Apply (AAQ-001 criterion 5), the app opening on a real page, one backend card with Data
   and Schema openable (AAQ-002 criteria 1–2), `prop-*` ports live at first load, and the page scrolling
   in a **detached** preview window (AAQ-003 criterion 1 — which doubles as a regression check on the
   diagnosis session's token-injection fix).
2. Then AAQ-002 slice 4 — the authoring context carries no backend schema block at all
   (`ContextBuilder` has none). With slice 3 in place the ports now exist, so a wrong `prop-*` name is a
   caught diagnostic rather than a phantom port; that is why it was left.
3. Then the engine: **AAQ-005 (substrate) → AAQ-006 (harness) → AAQ-007 (self-review)**. AAQ-005 is the
   risk-bearing task and the others depend on it in order.

Richard's bar has not moved: *"legendary creations rivaling the best Opus landing page artifacts."* A
page that validates is not the goal, and the exit criteria are three briefs judged side by side against
Claude artifacts — see the README.

## Traps that will bite you in this specific work

Still true from the diagnosis session:

- **The seams lie before the model fails.** When something looks wrong in the render, the first question
  is *"did this reach the runtime?"*, never *"why did the model not do this?"*
- **A declared `default` never runs its setter.** The most repeated trap in this repo.
- **A saved project applies a parameter before the port exists.** Jest never reproduces it; only a real
  load does.
- **HMR will not reach a mounted panel** — sidebar panels are hidden, not unmounted. Restart before
  concluding a UI change did not work. Anything in `main.js` / `web-server.js` needs a full Electron
  restart.
- **The editor test suite lies three ways. Only the `Jasmine:` line counts.**
- **Launching the dev editor rewrites the example project.** Revert it after killing the editor.
- **The `run-editor` skill's traps**: `--target=editor` attaches to the *preview*, and closing a webview
  CDP target white-screens the editor.

Learned this session:

- ⚠️ **Run jest from `packages/noodl-editor`, never from the repo root.** The root config is babel-based
  and fails on TypeScript `import { type X }` with a parser error that looks like a syntax error in your
  spec. `npx jest tests-unit/...` from the package directory is the working invocation.
- ⚠️ **Editor specs under `tests/` are registered by hand.** `tests/index.ts` re-exports directory
  barrels and `tests/ai/index.ts` lists each file. A *new* spec file that nobody adds to the barrel
  compiles, typechecks and **silently never runs**. Adding cases to an existing file avoids it; adding a
  file does not.
- `tsconfig.tests-main.json` (the jest one) has pre-existing unrelated errors from `.module.scss`
  imports. It is **not** a gate — the gates are `typecheck:editor` and `typecheck:editor-tests`.
- The corpus calibration pattern is cheap and worth repeating for any new rule: `git ls-files
  '*project.json'` is 96 real projects, and a rule that fires on them is a rule that needs a reason.

## The shared checkout

Fourteen files were modified and uncommitted before this session started and were **not touched** —
`package-lock.json`, `nodegx-observe`, `ProjectImporter.ts`, `projectmodel*.ts`, `featureFlags.ts`,
`LocalProjectsModel.ts`, `analyze.ts`, the whole `VersionControlPanel/` set, `tests/versioning/index.ts`.
They belong to another session's work and have been idle for days. **Do not attribute them, do not commit
them, never `git add -A`, and never `git stash`.** Commit with explicit pathspecs on *both* `git add` and
`git commit`.

No second session was live during this one (checked: no foreign commits, no Electron running, dirty-file
mtimes all a day or more old). **Check again yourself** — it is a per-session fact, not a standing one.
