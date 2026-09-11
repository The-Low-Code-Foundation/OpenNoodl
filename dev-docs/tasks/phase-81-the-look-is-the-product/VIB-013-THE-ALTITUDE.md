# VIB-013 — The Altitude

**Opened 2026-08-31, from Richard's question about what we are actually fighting.**

**Register rows V6, V16 (M4) · prevention of V8, V25, V27, V33, V39 (M5).**

## §1 The diagnosis this task exists for, in Richard's words

> *"It shows I think at what point we're fighting with the Claude LLM wanting to just build in React
> and being annoyed having to 'learn' a unique way of building the elements almost from scratch every
> time. It has to read an instruction manual and kind of take a NodeGX training course before every
> session."*

**The mismatch is one of ALTITUDE, not of competence.** The model is asked to emit a node graph —
individual `Group`s, parents, children, `sizeMode`, `flexDirection` — which is roughly the altitude of
hand-writing `<div>`s with inline styles. It is good at *"a hero with a photograph, a headline and two
buttons"*. Every trap in this phase's register lives in the gap between those two altitudes.

## §2 🔴 The evidence is VIB-006's own generator, and it was an accident

The worked page is 129 nodes. **It is good partly because I did not write 129 nodes.**
`demo/write-vib006-example.js` declares the compositions once as constants —

```js
const band  = { width: PCT100, flexDirection: 'column', alignItems: 'center', paddingTop: 'var(--space-20)', … };
const shell = { width: PCT100, maxWidth: {value:1200,unit:'px'}, sizeMode: 'contentHeight', … };
const card  = { …, clip: true, borderRadius: 'var(--radius-xl)' };
```

— and then **composes** them. Eight bands, five item components, one consistent gutter, because a
composition is one constant used N times rather than a parameter set retyped N times.

🔴 **That script is a hand-rolled prototype of the missing tool.** The quality came from three things:
the compositions being right (VIB-002/004 built that), them being composed *consistently* (the script
did that), and someone looking (VIB-007's M1 makes that mandatory). **A model handed the second one as
an API gets it for free, and does not need the doctrine paragraph that currently tries to buy it.**

⚠️ It also explains VIB-006's own defects honestly: every one of the five things the renders caught
was in the ~10% of that page written **outside** the composed vocabulary — the bespoke nav row, a
hand-set measure, a hand-written label. The composed parts did not misbehave.

## §3 M4 — the section expander

A tool that takes a **section spec** and expands it deterministically to a node graph:

```
create_page_from_sections({ page: "/Pages/Home", sections: [
  { kind: "imageGround", imagery: "texture-soil.webp", headline: "…", lead: "…", actions: [...] },
  { kind: "featureStrip", items: [ {glyph, title, body}, … ] },
  { kind: "cardGrid",     ground: "surface", cards: [...] },
  { kind: "ctaBand",      badge: "…", headline: "…" },
  { kind: "footer",       columns: [...] } ]})
```

The model works where it is strong — **subject, copy, imagery choice, section order, rhythm**. The
expander owns what it keeps getting wrong: `sizeMode` on every shell (**V1**), a scrolling page spine
(**V2**), the gutter identical on every band (**V25**), no `maxWidth` on display type (**V29**), a gap
on every multi-child row (**V27**), `codeAsClass` on every glyph (**V20**), `iconColor` set (**V21**),
and no inert parameters (**V38**).

⚠️ **Deliberately NOT a page generator.** It expands *sections a person chose*, in an order they chose,
with words and pictures they chose. The failure mode to design against is 500 identical pages:
**fix the structure and the ground rhythm; leave the subject, copy, imagery and palette free.**
VIB-007's M3 poverty findings are what catch the model that took the skeleton and left the sample copy
in it — 🔴 **the two tasks are each other's guard rail and neither is safe alone.**

Also closes **V16** by construction: the site builder's four "section kinds" are one layout, which is
exactly what a real expander replaces.

## §4 M5 — generate the corpus from the compositions

Today a composition is **hand-copied** into a recipe. That is how **V25** happened — the shipped hero
skipped the `shell` composition whose own description warns against exactly that, *and the corpus
outvoted the vocabulary*. Generate the examples from the same expander and the two cannot disagree.

🔴 **Scoped honestly, from the mapping in `VIB-007-THE-LOOP.md` §2: M5 retires five register rows and
NOT ONE of them is still open** (V8, V25, V27, V33, V39 are all closed — each already paid for by
hand). **M5 is prevention, not cleanup.** That is a real argument for building it and a real argument
for it going last. Do not let it delay M4.

## §5 Acceptance criteria

1. **AC1** — the expander ships as a door tool and produces a graph that passes `catalog:examples`
   strict, warnings-as-errors.
2. **AC2 — the honest test: it reproduces `ui-landing-page`.** Feed it the section spec for VIB-006's
   page; the output must be **structurally equivalent** to the committed example. ⚠️ Not byte-identity
   — compare the rendered DOM and the band/ground/measure readings, because byte-identity would fail
   on ids and pass on a page that renders wrong.
3. **AC3 — it cannot emit the traps.** For each of V1, V2, V20, V21, V25, V27, V29, V38: a spec that
   asks the expander for the shape that would trip it and asserts the emitted graph does not.
   **Mutation-checked** — break the expander and the row must red.
4. **AC4 — a cold agent beats the atoms.** Two sessions, same brief, no phase-81 coaching: one with
   the expander, one without. Both judged through README §3. 🔴 **This is VIB-010's method and this AC
   is its rehearsal** — if the expander does not move the cold result, it is a convenience, not a fix.
5. **AC5 — M5**: at least the marketing recipes are generated from the compositions rather than
   hand-copied, and a spec asserts a composition change propagates to the corpus.

## §6 Explicitly NOT in this task

- Mandatory render, diagnostics, poverty findings — **VIB-007**.
- The runtime-default family (V1/V2/V14/V17/V21/V38 as *diagnostics*) — **VIB-005**. This task stops
  the expander from *emitting* them; VIB-005 catches a human or a model that writes them by hand.
- ⚠️ **V35**: a new tool costs resident surface, and there is **one token** of headroom. Measure
  before adding, and expect this task to have to buy the room by trimming elsewhere.
