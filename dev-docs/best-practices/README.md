# NodeGX architecture and design best practices

**Created:** 2026-08-08
**Origin:** Richard's write-up of how he actually built apps in Noodl, prompted by an AI-authored
storefront that looked good and was architected wrongly — one 66-node page with its sections inlined
and its repeated rows hand-duplicated.

## What this folder is

The reference an LLM — or a person — should read **before** creating a single node in NodeGX.

It exists because of a diagnosis we should state plainly rather than defend against: **AI is bad at
NodeGX today, and for good reasons.** A model arrives at every new project with no memory of the
last one, no worked examples of an *architecture* (only of wiring), a node library it has never used,
and a set of habits from writing React and HTML that map onto NodeGX badly. It then does the only
thing available to it — draws the page it can see, top to bottom, node by node — and produces
something that renders correctly and is built wrong.

Nothing in here is a NodeGX quirk dressed up as a principle. It is the ordinary architecture any
competent developer would apply to a coded app, expressed in the vocabulary this tool actually has.

## The one rule the rest of this folder serves

> **Decide the component tree before you create any nodes.**

Ask what you would build if this were a coded app — what components exist, what each one is
responsible for, what varies per instance — and write that list down. *Then* work out which nodes
live inside each component. Building a page top-to-bottom, deciding each section's nodes as you reach
it, is what produces a single enormous graph with no reusable parts. The architecture is a decision
taken once, up front, not something that emerges from drawing.

## The documents

| # | Document | The question it answers |
|---|---|---|
| 01 | [Think in components first](01-THINK-IN-COMPONENTS-FIRST.md) | How do I decompose an app before touching a node? |
| 02 | [Data-driven repetition](02-DATA-DRIVEN-REPETITION.md) | Why is a Repeater over JSON always better than three siblings? |
| 03 | [Interaction and state](03-INTERACTION-AND-STATE.md) | How do hover, disabled, transitions and click signals actually work? |
| 04 | [Responsive layout](04-RESPONSIVE-LAYOUT.md) | What in this runtime reacts to width, and what never will? |
| 05 | [Worked example: a storefront](05-WORKED-EXAMPLE-STOREFRONT.md) | What does all of it look like on one real app, end to end? |

Read 01 and 05 first. 05 is the one to copy from: it is a real app decomposed the way an experienced
NodeGX developer would decompose it, before any nodes exist.

## What this folder is NOT

It is not the *visual* design doctrine — the bands, the type scale, the token discipline, the
"images are not decoration" rule. That lives in
[`design.ts`](../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design.ts)
and is shipped to both authoring clients as prompt text. This folder is about **architecture**: what
components exist and how they talk to each other. A beautiful page with no components is still a
failure, and that is the failure this folder exists to prevent.

## Related, and why it is separate

- **Component doctrine** —
  [`decomposition.ts`](../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/decomposition.ts)
  is the short, prompt-sized version of document 01, shipped to both clients.
- **The checks** — `repeated-sibling-subtree` turns "never three siblings" into a validator warning.
  Prose that nothing enforces is advice, and advice is what gets skipped under pressure.
- **The recipes** — `docs/node-catalog/examples/ui-*.json` are validated fragments an agent can fetch
  with `get_example`. They are the executable form of these documents.
