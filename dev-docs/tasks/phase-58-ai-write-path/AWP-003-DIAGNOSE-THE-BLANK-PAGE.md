# AWP-003 — A blank page must be diagnosed, not guessed at

**Status:** 📋 open · **Track: the instruments** · out of **F43**'s second half · pairs with AWP-004

## The defect: a guess presented as a diagnosis

When nothing renders, `render_report` emits one finding with one message:

> *"The page rendered nothing at all — no text and no images. A page component renders blank without
> a Page node at its root, and a route no Router lists is never reached."*

([render-report.js:500](../../../scripts/devtools/render-report.js#L500))

That sentence names the two causes the author knew about. DeepSeek V4 Pro had **neither** — a correct
`Page` node at its root, and a Router listing it — so it spent turns 42→60 on `urlPath`, `startPage`,
`clip` and `flexDirection`, and at turn 60 deleted the Group holding its six sections in a last
restructuring attempt. **The message did not merely fail to help; it aimed the model at the wrong
subsystem and kept it there for 18 turns**, which is 30% of its run and about $1.70.

**And it poisons the control experiment.** Both session-8 models ran the standard probe — put a text
node somewhere and see if anything draws:

- **Kimi** added its probe to the *existing page*, saw it render, correctly concluded the fault was in
  its components, and issued `set_visual_roots` for all ten in one turn. Fixed in 4 turns.
- **DeepSeek** created a *new* component to hold its probe (`Pages/Test` — a `Page` node and one
  "Hello World" `Text`, via `create_component`). That component was born without visual roots too, so
  the control rendered blank as well, and it concluded:

> *"I'm now fairly confident this is an environmental issue — the viewer bundle likely needs to be
> rebuilt. The project structure is valid (validated with 0 errors), the components are correctly
> wired, but the renderer produces no output."*

It reasoned correctly from a poisoned control. **A diagnostic that defeats the standard bisection is
worse than no diagnostic**, because it converts a solvable problem into a confident wrong conclusion.

## The fix: answer "why is nothing on screen" from the graph, not from a list of guesses

Everything needed to answer this properly is already on disk before a browser is opened. The report
should walk it and name **the specific cause and the specific component**, in the order a bisection
would:

1. **Is there a root component / start page at all?** — `rootComponent`, the Router's `pages`, the
   page's `urlPath`. (The current message's two guesses live here, and stay — as *checked facts*, not
   as a list of possibilities.)
2. **Does the page component have a visual root?** — the AWP-001 derivation, applied as a *check*.
3. **Does each component instance on the page have a visual root?** ← **this is F43**, and it is the
   check that was missing. It must name the components: *"`/Components/NavBar`, `/Components/Hero`
   and 4 others have no visual root, so every instance of them renders nothing."*
4. **Did the tree reach the DOM but with zero size / zero opacity / clipped away?** ← AWP-004's
   territory; hand off rather than duplicate.

**Each finding must carry the node or component it is about.** `blank-render` today carries only a
viewport. A finding that cannot say *which* component is the problem forces exactly the manual
bisection that F43 sabotages.

### The stronger form, worth scoping: a `why_is_it_blank` answer on the tool

The above improves a message. The better product is that an agent can *ask*. Both models tried to ask
and had to improvise it with probe nodes — which is the improvisation that failed. Options, in
increasing cost:

- **Cheapest:** fold the walk above into `render_report`'s existing findings, which the models already
  call unprompted (both did, 7 times each). No new tool, no new surface bytes — and given AWP-006 that
  matters.
- **Fuller:** a dedicated diagnostic tool. Costs schema bytes on every turn forever; weigh against
  AWP-006 before adding.

**Recommendation: the cheapest form.** The models are already calling `render_report` on their own
initiative; the defect is what it tells them, not that they cannot reach it.

## The wider rule this establishes

**A finding must state what was checked, not what might be wrong.** Grep the finding set for other
messages that enumerate possible causes rather than reporting a determined one — `blank-render` is
unlikely to be the only one, and each is a trap of the same shape.

## Acceptance

- On `phase55-s8-deepseek-v4-pro` **as it was staged** (the AWP-001 fixture, before derivation),
  `render_report` names the components lacking visual roots, and does not mention `Page` nodes or
  routing — because both were correct.
- On a project whose page genuinely has no `Page` node, it still says so.
- On a project whose page is not listed by any Router, it still says so.
- Every `blank-render`-class finding carries a component path or node id.
- The three cases above are fixtures, not manual checks.
- A written note on the "dedicated tool vs a better finding" choice, with the AWP-006 cost weighed.

## Register

| # | Finding | State |
|---|---|---|
| A5 | The probe-node bisection is what a competent agent reaches for — **two of two models used it unprompted**. Any diagnostic we ship must not be defeated by it, and should ideally make it unnecessary | 📋 design constraint |
| A6 | Both models called `render_report` unprompted, 7 times each. **The self-verification loop phase 55 wanted already exists**; its input is what is wrong | ✅ observed, session 8 |
