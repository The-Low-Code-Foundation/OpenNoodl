# SIG-004 — Every signal port says what it does

**Status:** 📋 open · **Track SIG**

> *"Write something in the port description that appears next to the port picker, clarifying on every
> signal port that it doesn't send a value but runs another node, and can be used in conjunction with
> value outputs, but often isn't needed."*

Right about the reader and the sentence. ⚠️ **Wrong about the field** — and the difference is a token
bill on every AI authoring turn.

## ⚠️ The correction, before anything is written

[`PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md) is normative:

| | `tooltip` | `description` |
|---|---|---|
| Read by | the editor's hover popup | **the node catalog, the semantic validator, the AI authoring loop** |
| Shape | HTML | one sentence of plain text |
| Available on | inputs only | inputs **and outputs** |

The connection popup's help comes from the **enriched catalog** — `getPortDocs(type.name)`, keyed on
canonical port name, read from `node-catalog-enriched.json` shipped inside the binary
([`DocsParser.ts`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/DocsParser.ts),
[`nodeDocs.ts`](../../../packages/noodl-editor/src/editor/src/utils/nodeDocs.ts)).

So writing this sentence into every signal port's `description` would:

- ship several hundred copies of one paragraph into the catalog;
- **re-pay for them on every `get_node_type` call in the AI loop** — where `get_node_type` on `Group`
  already costs 11k tokens, and the MCP surface is 27k tokens a turn before any node docs;
- and put a *type-level* fact in a *port-level* field, where it can drift port by port.

**A sentence true of every port of a type belongs at the render seam, once.**

## The seam, and it is one line

[`DocsPopup.tsx:57-59`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/DocsPopup.tsx#L57-L59)
already prints the port's type in the popup header:

```ts
const typeDocs = '(' + NodeLibrary.nameForPortType(type) + … + ')';
```

That `(signal)` is rendered for **every port of every node in the library**, with no per-node data
behind it. Replacing a bare type name with a sentence about that type is the whole mechanism.

## ⚠️ The guard that will make this appear on nothing

[`PortItem.tsx:48-62`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L48-L62):

```ts
const d = ports[p.name];
if (d) {                 // <- only documented ports get a popup at all
  setDocs(d);
  setShowDocs(true);
}
```

**A port the catalog has no entry for shows no popup**, so a type-level line added to `DocsPopup`
would appear only on already-documented ports — the ones that least need it. This guard has to invert:
show the popup when there is a type sentence **or** a body. That is shared with SIG-002, which needs
the identical change for value ports; do them together.

## The sentence

Richard's three clauses, which are the right three:

> **Signal — a moment, not a value.** It runs something on the node it points at. Value connections
> carry their data on their own, so you usually don't need a signal to set a value — reach for one when
> you want to control *when* something happens.

⚠️ Do not write *"a signal never carries a value"*. The cast table allows `boolean → signal`
([README §correction 1](README.md)). "A moment, not a value" is true; "never carries a value" is a
falsehood a builder will disprove.

The mirror line, for value ports, is SIG-002's:

> **Value — live.** Updates whenever the source changes. No trigger needed.

Two sentences, one seam, the whole library. Where a port also has catalog prose, the type sentence sits
above it and the port's own words follow.

## Build

1. **Type sentences at the render seam**, in their own import-free module keyed by type name, so they
   are graded by `tests-unit/` rather than by hovering the right port. Signal and value first; other
   types may fall out of it but are not this task's scope.
2. **Invert the `if (d)` guard** so an undocumented port still gets its type sentence.
3. **Header stays scannable.** `DocsPopup`'s header is one row of name + type; a paragraph does not
   belong in it. The sentence goes in the body, above the port prose, visually distinct from it —
   ⚠️ and *not* by opacity (see the phase's standing constraints).
4. **The signal glyph gets the same words on the node.** The lightning icon in the port list
   ([`PortItem.tsx:96-100`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L96-L100)) is
   currently unexplained anywhere. It is the same fact; it should not acquire a second wording.
5. **Leave `description` alone.** No node definition file is edited by this task. If that turns out to
   be impossible, the task is wrong and should be re-scoped, not widened.

## What this does not do

It does not give individual signal ports better prose — that is worth doing and it is a catalog
enrichment job, per port, in the `description` field, where it belongs. **This task is only the
sentence that is the same on all of them.**

## Acceptance

- [ ] Hovering **any** signal port in the connection popup shows the type sentence — including on a
      port with no catalog entry. Driven on a documented port and an undocumented one, both named.
- [ ] Hovering any value port shows the live sentence (shared with SIG-002).
- [ ] `git diff` touches **no** file under `packages/noodl-runtime/src/nodes/` or
      `packages/noodl-viewer-react/src/nodes/`.
- [ ] `node-catalog-enriched.json` is byte-identical before and after. This is the measurement that
      the token bill did not move.
- [ ] The sentence does not claim signals never carry a value.
- [ ] The wording matches SIG-001's and SIG-002's copy word for word where they overlap. One
      vocabulary, three surfaces.

## Register

| # | Finding | State |
|---|---|---|
| | | |
