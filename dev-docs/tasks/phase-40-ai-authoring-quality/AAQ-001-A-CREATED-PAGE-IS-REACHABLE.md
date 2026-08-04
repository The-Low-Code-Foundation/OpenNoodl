# AAQ-001 — A created page is reachable

**Findings:** #5 (router has no pages after apply), #6 (`navigate to path /puppies` with no such page)
**Status:** criteria 1, 3, 4, 5 **closed live** (2026-08-05). Criterion 2 remains closed-by-construction.
The live pass found **three defects that 2165 green specs could not see**, all now fixed, plus one
contract nobody had written down. Read the next section before anything else in this file.

## ⚠️ The live pass, 2026-08-05 — what was actually wrong

Layer 1 was mechanism-verified and spec-covered and had never been seen running. Driving the launcher
wizard end to end (`packages/noodl-editor/scripts/aaq40-live/`) found this, in the order it bit:

1. **A plan whose first page linked to its second was UNAPPLIABLE.** The apply's pre-check
   (`ProjectAuthoringView.applyPlan`) builds its component list **forward** — each operation sees the
   ones before it — so `/Pages/Puppies` was refused for navigating to `/Pages/Admin`, a page staged in
   the same transaction and about to be applied alongside it. `plannedComponents` had been threaded into
   every authoring *session* and not into the apply. Both now call one function,
   `plannedComponentNames`, because the failure was never bad code — it was one fact existing twice, and
   once. The most ordinary two-page app there is could not be applied.
2. **The start page never moved, so every wizard-built app opened on "Hello World!".**
   `isPlaceholderPage` measured "empty" as *the root having no children*, on the stated belief that "the
   template's Home is one `Page` node". It is not: `hello-world.template.ts` gives Home a `Page` node
   **with a Text child**. The one case the whole start-page mechanism exists for could never match. Now
   measured as the template's real shape — a single root with at most one leaf `Text` under it.
3. **A registered page still rendered a blank screen.** The headline. Listing a component in a Router's
   `pages.routes` does not make it a page: the runtime's page index is built **exclusively from `Page`
   nodes** (`exporter/router.ts::_getPageInfo`), `getPagesForRouter` drops every route it cannot resolve
   to one, and the Router then mounts nothing. Verified against the live `routerIndex`: three routes
   listed, one page indexed. Nothing anywhere said a page component needs a `Page` node —
   `stagedComponentIsPage` accepts the `/Pages/…` *name*, which is right for deciding what to register
   and was never a claim about what renders. Now `DiagnosticCode.PageWithoutPageNode` plus an explicit
   sentence in the authoring prompt. **The diagnostic is a warning, not blocking, and that is a
   deliberate half-measure with a bill attached — see the note in `validate.ts`.**
4. The repair message the agent reads offered `/Pages/Admin` **twice** and called `App` a page. Both
   fixed in `checkNavigation`; it now dedupes and says "component names", and states when the list is
   truncated.

### What the live pass proved

Against a real preview window, with the fixes in:

- The router lists all three pages, `startPage` is `/Pages/Puppies`, and the app **opens on it**
  (`document.title` = "Puppies"). Criterion 5. ✅
- The panel says, before Apply: *"2 pages (Puppies, Admin) will be registered in the "Main" router in
  App"*, and after: *"…The app opens on Puppies."* Same function, so they cannot disagree. ✅
- Both navigation targets resolve to real components. Criterion 3. ✅
- `validate:project` is untouched; the rules are wired into the authored gate only. Criterion 4. ✅

Gates at the end of the pass: editor suite **2168 specs, 0 failures**; `typecheck:editor` and
`typecheck:editor-tests` clean.

### Still owed

- **Promote `PageWithoutPageNode` to `BLOCKING_WARNINGS`.** It fires on **57 fixture sites across 15 AI
  spec files**, every one of which builds a `/Pages/…` component out of a bare Group — the belief the
  product itself held until this pass. Correcting them changes what a large part of the suite asserts and
  deserves its own read; it was not tacked onto the session that found the defect. Until then a blank
  page is a warning the agent is shown and a contract the prompt states, not a refusal.

## What was built

**The registration is performed by the apply, not asked of the model.** `authoring/pageRegistration.ts`
(pure, shared-able with `noodl-mcp`) computes what the router should list; `staging.ts` finds the routers
in the live project and writes the value; `planStaging.ts` performs it inside the plan's one undo group,
after the components are in. The reasoning is the provision row's: which components the plan created and
which of them are pages is something the apply *knows* exactly, and a fact the apply knows should not be
re-derived by a model that then has to be believed and checked. It is idempotent, so an agent that DOES
write the router update loses nothing.

The rules, all under test:

- Pages already listed are not listed twice; a component that is not a page never reaches the router.
- The start page moves **only** when there is none, when it dangles, or when it is an *empty placeholder* —
  a page component whose root has no children, which is exactly a freshly created project's Home. A start
  page someone has built in is never taken, however many pages the plan adds.
- The placeholder stays *routed* after the start page moves. Unregistering a component is a destructive
  decision this apply deliberately does not make.
- `prospectivePageRegistration` is the same function the plan review calls, so the sentence shown before
  Apply and the change made by Apply cannot disagree. Both appear in the panel (`PageRouter` icon).

**The contract entered both prompts.** `prompts/planning.ts` gains "PAGES ARE REGISTERED, OR THEY DO NOT
EXIST" (a plan creating pages must also update the router's host, with the names stated in the intent);
`prompts/authoring.ts` gains "PAGES AND NAVIGATION" with the exact `pages` wire format, `RouterNavigate`'s
`target` being a component name, and where a page's `urlPath` actually lives.

**Navigation is validated.** New `validation/navigation.ts` + `DiagnosticCode.UnresolvedNavigation`,
blocking for authored output via the existing `BLOCKING_WARNINGS` seam. `AuthoringSession` and `PlanRun`
now carry `plannedComponents`, so a page linking to a sibling the fan-out has not authored yet is not
told its correct link is broken.

### What was found on the way, that the task did not know

- **`RouterNavigate.target` and `Page.urlPath` are not in the catalog at all** — they are runtime-discovered
  ports (`registerInputIfNeeded`, `_updatePorts`). This is very likely *why* the model reached for
  "Navigate To Path": `PageStackNavigateToPath.path` is the only navigation target the catalog declares
  statically. It also means no existing check could see a wrong target: `checkParameterValues` skips
  dynamic-port nodes entirely, so any string passed.
- Consequently the handover's note that `Page.title`/`Page.urlPath` were caught as phantom parameters does
  **not** hold today: `catalog.isDynamicNode('Page')` is true and they are exempt. Verified by probe.
- `allowEditOnly` (the router's `pages`) is **not** `allowConnectionsOnly` — the trap this file warned
  about does not fire. Parameters apply normally; the spec suite writes and reads the value on a real
  `ProjectModel`.

### Decisions taken

- **Criterion 2 is closed by construction rather than by a diagnostic.** With registration performed by the
  transaction, "a plan that creates a page without routing it" is not a state the editor can reach. A
  project-level unreachable-page rule would only serve the MCP client, which has no plan transaction; it is
  recorded here as the remaining gap rather than built speculatively.
- **The corpus rule was calibrated before landing** (the phase-38 rule): the navigation check run over all
  96 `project.json` files in the repo yields 3 findings, all true positives (two library prefabs with a
  deliberately unset target/path, one genuinely dangling `/Pages/Assessment setup` in a test fixture).
  `validate:project` is untouched — the check is wired into the authored gate only, so criterion 4 holds
  by construction.
- **A pre-existing unresolved navigation in an updated component is charged to the revision.** Blocking
  warnings are not baselined today (only errors are), and that is left as it is rather than changed for one
  code — but it is the reason an update to a component with a dead Navigate now has to fix it.

## The mechanism, verified

- A page exists only by being listed in a Page Router node. The router's `pages` input is
  `type: { name: 'pages', allowEditOnly: true }`
  ([router.tsx:187](../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L187)) whose
  value is an object carrying `startPage` and `routes` (an array of component names —
  [router-handler.ts:125](../../../packages/noodl-viewer-react/src/nodes/navigation/router-handler.ts#L125)).
- **The word "Router" appears nowhere in the AI stack.** Grepped: `scoping/scope.ts`,
  `prompts/planning.ts`, `prompts/authoring.ts`, `plan.ts`, `PlanRun.ts` — zero hits. The planner's
  own rule ("integration is edits to the neighbours") cannot fire on a contract the model has never
  seen, so it invented `navigate to path /puppies` against a component that was never registered.
- Nothing validates that a navigation target resolves, and nothing warns that a component named
  `Pages/...` is unreachable.

## What to build

### Slice 1 — the contract enters the prompts

- Scoping already collects `pages`. The **planner** must know: a plan whose creates include pages
  must also include an update to the component holding the Page Router (usually `App`), whose intent
  names the pages to register and which one is home. This is the canonical "integration is edits to
  the neighbours" case — state it as such, with the router named.
- The **authoring** prompt gets the wire format: the router's `pages` parameter shape, exactly, in
  the same register as the units block ("A PAGE IS NOT A PAGE UNTIL THE ROUTER LISTS IT"). Verify
  first that a statically-authored `pages` parameter survives the runtime — `allowEditOnly` is not
  `allowConnectionsOnly`, but this phase's opening lesson is that those flags lie; drive it live
  before writing the prompt text.
- Navigate nodes: the prompt must state that navigation targets are page component names/routes as
  registered, not invented URL paths.

### Slice 2 — validation closes the loop

Two new rules in the semantic validator, blocking for authored output (the AIB-001 `BLOCKING_WARNINGS`
seam already exists for exactly this):

1. **Unreachable page**: a component created under the pages convention that is neither listed in any
   router's `pages` parameter nor instantiated by another component. Severity: warning project-wide,
   blocking for authored changesets.
2. **Unresolvable navigation**: a navigate/`RouterNavigate` parameter naming a path or page that no
   router in the changeset-applied project resolves. Same severity split.

Calibrate against the corpus before setting severities — the phase-38 rule. If existing projects
carry legitimately-unrouted components (they will — component libraries do), the rule must key on
the *changeset* creating a page it then fails to register, not on the project's standing state.

### Slice 3 — apply-time repair, not rollback

When an applied plan creates pages, the apply path should surface registration as part of the plan
review (the provision row is the precedent — `planStaging.ts`): the user sees "3 pages will be
registered in App's router; Puppies becomes the home page" before pressing Apply.

## Acceptance criteria

1. Cold replay of the puppy brief: after Apply, the Page Router lists the created pages, a home page
   is set, and the preview opens on it — no manual router surgery.
2. A plan that creates a page without routing it fails authored validation with a diagnostic naming
   the router and the fix.
3. A navigate node pointing at a nonexistent page is a blocking diagnostic naming the available
   routes.
4. `validate:project` over the corpus gains **zero** new errors (warnings acceptable and counted).
5. The router's `pages` parameter, written by the agent, is proven live — screenshot of the router
   rendering the registered page, not just a green validator.

## Traps

- `allowEditOnly` may interact with parameter application the same way `allowConnectionsOnly` did —
  the port *exists* so no rule fires, and the value may be silently ignored. Prove the write path
  first (criterion 5 exists because of this).
- A saved project applies a parameter before the port exists (the standing runtime trap). The
  router's `pages` has no `default`, and `router.tsx:400-415` already handles the no-pages case —
  read it before assuming ordering is safe.
- Don't let the planner solve this by *always* planning an App update — a plan updating a component
  the request never touched will read as scope creep in review. The update belongs in the plan only
  when the plan creates or renames pages.
