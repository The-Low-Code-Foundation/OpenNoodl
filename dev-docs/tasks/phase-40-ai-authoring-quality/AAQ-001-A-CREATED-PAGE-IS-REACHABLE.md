# AAQ-001 — A created page is reachable

**Findings:** #5 (router has no pages after apply), #6 (`navigate to path /puppies` with no such page)
**Status:** open

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
