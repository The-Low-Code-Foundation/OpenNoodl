# AAQ-010 — The whole styling surface

**Finding:** #9's second half, and Richard's second lesson, verbatim:

> *"Basic Noodl styling is shit. There are custom CSS nodes and the CSS editor on every node — you
> should use them. You can do a lot of magic with the existing props, such as corner rounding and
> transparency in different states (hover, disabled, etc), and State nodes work really well for
> creating custom styling systems for different node states, such as turning text red when a certain
> state is reached. There needs to be A LOT more effort put into styling, preferably using the
> existing props and not custom CSS, unless it's necessary or justified."*

**Depends on:** AAQ-009 (identity supplies the values this task spends), AAQ-007 (the render loop is
what holds the bar)
**Status:** open

## The mechanism

The authoring prompt's entire styling education is the ON-SYSTEM STYLING block: tokens, and the
variant/units corrections from the diagnosis session. The model has never been told that:

- visual states exist (hover/pressed/disabled styling per state on the node's ports);
- State nodes exist as a styling mechanism (interaction-driven style systems);
- transparency, corner rounding, borders, shadows compose into depth and hierarchy;
- every node carries a custom-CSS escape hatch, and custom CSS *nodes* exist;
- transitions/micro-interactions are available at all.

A model that styles with a tenth of the instrument produces a tenth of the design. Phase-30's audit
and the catalog enrichment (SUB-005) know what the surface actually is — the prompt just never
taught it.

## What to build

### Slice 1 — audit the surface, then teach it

Before writing prompt text, enumerate what the runtime *actually honours* per port family: which
props are per-state, how state styling is expressed on the wire, what the custom-CSS parameter
accepts, what State nodes can drive. (The opening lesson again: `variant` looked stylable and
wasn't. Every claim in the new prompt text gets verified against the runtime first, the way the
units block was — corpus + live render, not the docs.) The verified surface lands in the catalog
enrichment so `get_node_types` carries it per node.

### Slice 2 — the doctrine block

The prompt's styling section grows, in Richard's priority order:

1. **Props first.** States (hover/pressed/disabled) on interactive elements are mandatory, not
   optional polish; corner rounding, borders, shadows, transparency compose hierarchy; spacing rhythm
   from the token scale.
2. **State nodes** for interaction-driven styling systems (validation states, selection, emphasis).
3. **Custom CSS when necessary or justified** — gradients, backdrop filters, complex transitions —
   never for what a prop can do, and always with a comment saying why.
4. **Style once, reuse** (with AAQ-008): one styled Input/Button/Card component, instantiated
   everywhere — the "create one input style and duplicate it across all the inputs" Richard asked
   for, done the component way rather than the copy-paste way.

### Slice 3 — the lint holds the floor

Style-lint additions (advisory channel, like the existing token lint): interactive element with no
non-default state styling; text node at browser-default typography (the fingerprint); raw values
where tokens exist (exists already). The *ceiling* is held by AAQ-007's render pass, not by lints.

## Acceptance criteria

1. Cold puppy replay: buttons and inputs have visible hover and disabled treatments (driven live —
   CDP hover, screenshot); cards carry depth (shadow/radius from tokens); nothing renders at
   browser-default typography.
2. A brief that justifies custom CSS (e.g. "glassy hero with a gradient") produces custom CSS *only*
   where props couldn't do it, with the justification comment present.
3. The enquiry-form benchmark: one styled input component reused for every field (joint criterion
   with AAQ-008).
4. Every stylable claim in the new prompt text has a corresponding verified entry in the enrichment —
   a test enumerates prompt claims against enrichment, so the prompt cannot drift ahead of reality.
5. Richard's verdict on the three benchmark briefs' styling: not "valid", but *good*. Recorded here.

## Traps

- The four silent discard mechanisms (variant, units, tokens-in-preview, non-blocking warnings) were
  all found in exactly this territory. Any new styling wire format gets the AIB-001 treatment:
  corpus calibration, zero-false-positive test, live render proof.
- `IconSize` is inert at 130 call sites (UIX-010) — the audit in slice 1 will find more of these;
  file them, don't teach the model to use dead ports.
- Visual states and hand-tuned variants are preserved for kept node ids in update mode
  (`authoring.ts` update contract) — state styling written by the agent must ride the same
  preservation path; verify, don't assume.
- Remarkable eats `-->` (phase-38): if doctrine text ever includes CSS arrow examples in docs,
  mind the renderer.
