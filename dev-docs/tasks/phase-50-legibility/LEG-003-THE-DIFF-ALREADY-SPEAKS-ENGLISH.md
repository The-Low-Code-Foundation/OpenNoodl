# LEG-003 — SUB-007 built this. Drive it, then do the half that is missing

**Status:** 📋 open · **Est. 2 d** (README said 1 week) · **Track: the read path**

## The correction

The README's mechanism table says graph diff rendering is *"Built. Renders ids"*, and budgets a week
to make it render `Button "Submit Order" → Navigate "Checkout"`.

It already renders that. `DiffFormatter.formatChange`
([`DiffFormatter.ts`](../../../packages/noodl-editor/src/editor/src/versioning/DiffFormatter.ts)),
SUB-007, with a naming rule stated in its header:

> a node is shown by its **label** when the user gave it one, otherwise by its **catalog display
> name** (SUB-004), otherwise by its raw type.

```ts
case 'connection-added':
  return `Connected ${endpoint(change.connection, 'from', displayName)} → ${endpoint(change.connection, 'to', displayName)}`;
```

and `endpoint` renders `nodeName.port`, where `nodeName` is `Button 'Submit Order'`. Twenty-odd
change kinds are covered — reparenting, rewiring, variant changes, state changes, parameter deltas
with a `+N more` tail, each with its own sentence.

**And it is wired.** `GraphDiffPanel/graphChangePresentation.ts:131` calls it with
`catalogDisplayNames()` and `includeCosmetic: true`. There is no id-rendering panel to replace.

⚠️ Note what changed *around* it: `nodeName` falls back to the display name when a node has no label,
and at the time SUB-007 shipped that fallback was the common case. With agent output labelling at
89%, the good branch is now the usual one. **The feature got better without being touched**, which
is exactly why nobody struck the README row.

## §1 — Drive it, because "wired" is not "correct"

The whole task starts as verification, and it is the kind this repo has been wrong about before —
a green catalog proves nothing, and a rendered sentence in a panel nobody opened is a claim, not a
result.

Make a real change to a real project — rename a label, rewire a connection, reparent a node, change
three parameters — and read the GraphDiffPanel in the running editor. Record what each of those four
actually renders.

Three specific things to check, each of which is a plausible failure that reads as success:

1. **Which side of the rename is named.** `node-renamed` renders
   `Renamed X 'oldLabel' to 'newLabel'` — the *old* label on the node ref. Correct, and worth
   confirming it is what a reviewer expects rather than assuming.
2. **The `nodeName` suppression rule.** `ref.label && ref.label !== typeLabel` — a node labelled
   exactly `"Button"` renders as bare `Button`, indistinguishable from an unlabelled one. Fine, and
   it should be a deliberate finding rather than a surprise.
3. **Whether the catalog resolves in the panel's context.** `catalogDisplayNames()` swallows its
   `require` failure and degrades to raw type names, silently. If the catalog is not loading in the
   packaged app, every sentence quietly renders `net.noodl.visual.columns` and the panel still looks
   like it works. **Check this in a packaged build, not only in dev.**

## §2 — The half that is genuinely missing: the Explain panel

The README asked for GraphDiffPanel *and* the Explain panel. The first is done. The second has the
target and not the sentence: `ExplainPanel.tsx:56-59` already scopes to node, subgraph or component
(*"Explain this node"*, *"Explain these 5 nodes"*, *"Explain this component"*).

What it should gain, in dependency order:

- **The component's `description`** at the top of a component-scope explanation — LEG-006 makes that
  field survive a save, so this depends on it and is worthless before it.
- **The node's `metadata.comment`** in a node-scope explanation, quoted as the author's own words and
  visibly distinct from generated prose. This is the payoff for LEG-001, and it is the moment the
  "why" channel reaches a reader.

⚠️ **Do not paraphrase a comment.** If a user wrote a décret citation, the panel shows the citation.
An explanation that rewrites the one authored sentence in the graph has destroyed the only
non-generated thing on screen — and this phase exists because the review channel is what catches the
generator being wrong.

## §3 — What this task does not do

- **It does not rewrite `DiffFormatter`.** If a sentence reads badly, fix that sentence. Twenty-odd
  change kinds already have considered wording and a shared naming rule.
- **It does not touch the command line.** That is LEG-004, and its renderer has a different
  constraint — one file, no base — so the two must not be merged into "one diff renderer".
- **It does not add a diff view to the Explain panel.** Explain says what something *is*; the diff
  panel says what *changed*.

## Acceptance

- Four change kinds — rename, rewire, reparent, multi-parameter — **driven in the running editor**
  and their rendered sentences recorded verbatim in the register. Not screenshots of a panel being
  open; the text.
- The catalog name provider is confirmed to resolve **in a packaged build**, so no sentence silently
  falls back to raw type names.
- Explain at component scope leads with the component's description (after LEG-006).
- Explain at node scope shows the node's comment **verbatim**, attributed, visually distinct from
  generated text (after LEG-001).
- ⚠️ Contrast measured for whatever distinguishes authored text from generated text, both themes,
  foreground and background hex printed with each ratio. If the distinction is carried by colour
  alone it also needs a non-colour cue.

## Register

| # | Finding | State |
|---|---|---|
| L28 | `DiffFormatter` renders named nodes and ports for ~20 change kinds and **is already wired** into GraphDiffPanel. The README's "renders ids" is wrong and the week is not needed | ⚠️ corrected |
| L29 | `catalogDisplayNames()` swallows a failed `require` and degrades to raw type names silently. Unverified in a packaged build | ⚠️ check first |
| L30 | A node labelled exactly its type name renders as if unlabelled. Harmless, worth knowing | 📋 noted |
| L31 | The Explain panel must quote a comment, never paraphrase it. Paraphrasing the one human sentence in the graph defeats the phase | ⚠️ standing |
