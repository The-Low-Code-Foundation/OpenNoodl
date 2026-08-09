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

---

## Built 2026-08-09 — and the premise this task got wrong

**Status: ✅ closed.** `blankDiagnosis()` in
[render-report.js](../../../scripts/devtools/render-report.js) walks the project in
bisection order and reports the cause it **determined** plus the component it is about;
`summarise()` carries it into the `blank-render` finding as a message, a `cause` code and
`evidence.component`. Both the CLI and the `render_report` MCP tool inherit it, because
both go through `renderReport()`.

### ⚠️ The acceptance predicted the wrong cause

> *"On `phase55-s8-deepseek-v4-pro` **as it was staged**, `render_report` names the
> components lacking visual roots"*

**It does not, because that is no longer why the page is blank.** Measured 2026-08-09:

- AWP-001 §3 landed derivation at read time **and** in `render-from-disk.js`, so all 11
  components missing `visualRoots` now resolve correctly. **F43 is genuinely closed** —
  the check this task called "the one that was missing" has no live trigger on the fixture.
- The staged project renders blank for a different reason: **`/Pages/Home` is a bare
  `Page` node with no children.** That is the state DeepSeek left it in at turn 60, when
  it deleted the Group holding its six sections. The fixture is that deletion, on disk.

So the shipped walk reports `page-has-no-content` and names `/Pages/Home`, and the two
guesses the old message led with are checked, held, and confined to `checked[]` — the
message mentions neither. `instances-without-visual-root` is still implemented, as the
residual form of F43 for a component that genuinely has nothing visual at its root.

**The lesson is the task's own:** an acceptance criterion is a prediction about a
mechanism, and this one aged out between being written and being built. Running it was
what surfaced that; reading the fixture would not have.

### The wider rule, applied

AWP-003 asks for a grep of the finding set for other messages that enumerate causes
rather than reporting one. It found two, and both had the answer already in hand:

| finding | was | now |
|---|---|---|
| `minimum-layout-width` | *"Something inside carries a fixed width or a non-collapsing row"* | names the widest element — *"The widest element inside it is img at 500px"* |
| `elements-overflowing` | *(mine, written this session)* *"A fixed width that does not collapse is the usual cause"* | *"the widest is div at 756px"* |

Both were attaching `overflowing` as evidence and not reading it — the same shape as
register note A7 one task over. `empty-decorated-box` and `single-column-grid` keep their
two-way sentences: those are genuine abstentions about **intent**, which no measurement
settles, not guesses about cause.

### The paraphrase, and the gate on it

`render-report.js` is plain JS and cannot import `visualRoots.ts`, so `rootNodes()`
restates the editor's own rule (`parent === undefined`). A restatement is the defect class
AWP-002 exists to gate, so the suite runs it against the real `deriveVisualRootIds` over
every component of the real project. **Watched fail**: perturbing `rootNodes` to return
every node fails that spec.

| # | Finding | State |
|---|---|---|
| A9 | **The acceptance named a cause that AWP-001 had already fixed.** A criterion written against a mechanism decays when a sibling task lands; the fixture is durable, the predicted cause is not | ⚠️ measured 08-09 |
| A10 | `render-from-disk.js` derives roots via `!childIds.has(id)` while `ProjectImporter` uses `parent === undefined`. **Two rules, agreeing on every fixture** — not a defect today, and worth a parity gate before it becomes one | 📋 filed |
