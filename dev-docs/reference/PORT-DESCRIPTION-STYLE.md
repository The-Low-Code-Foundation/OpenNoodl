# Port description style

**Status:** normative for the node library. Written for NDA-005 (Track O, phase 30), beside
[`REACTIVITY-CONTRACT.md`](./REACTIVITY-CONTRACT.md), [`EMPTY-VALUE-CONTRACT.md`](./EMPTY-VALUE-CONTRACT.md),
[`FAILURE-CONTRACT.md`](./FAILURE-CONTRACT.md), [`PORT-TYPE-CONTRACT.md`](./PORT-TYPE-CONTRACT.md),
[`BINDING-CONTRACT.md`](./BINDING-CONTRACT.md), [`PORT-GROUP-VOCABULARY.md`](./PORT-GROUP-VOCABULARY.md)
and [`ICON-SOURCE-MODEL.md`](./ICON-SOURCE-MODEL.md).

⚠️ **This file governs the sentence on a port. [`PORT-GROUP-VOCABULARY.md`](./PORT-GROUP-VOCABULARY.md)
governs the heading above it**, and is where the rule that every port must declare a `group` lives.
The two are independent: a heading says what *sort* of thing a port is, a description says what that
particular port does.

## The field, and why it is not `tooltip`

Write descriptions in the port's **`description`** field:

```ts
inputs: {
  offset: {
    type: 'number',
    displayName: 'Offset',
    description: 'Number of items to skip before the first result',
    set(value) { … }
  }
}
```

**`description` and `tooltip` are two documents for two readers, and neither can stand in for the
other.**

| | `tooltip` | `description` |
| --- | --- | --- |
| Read by | the editor's hover popup | the node catalog, the semantic validator, the AI authoring loop |
| Shape | HTML — a heading, paragraphs, sometimes images | one sentence of plain text |
| Available on | inputs only | inputs **and outputs** |

The heading in a tooltip legitimately restates the display name, because it is a popup title. That
is precisely what makes a flattened tooltip a bad description. Before NDA-005 the catalog derived
`description` from `tooltip` by stripping the tags and joining what was left, which is how the
library's 142 documented ports came to read like:

> Clip content Controls if elements that are too big to fit will be clipped Enabled Disabled

That flattening survives as a **fallback** — a port with a tooltip and no description still shows
something rather than nothing — but it is not the target. A port with both keeps them independent:
the popup stays rich, the catalog gets the sentence.

⚠️ **`description` was declared on both port types and copied nowhere** until NDA-005. If you are
reading an old node and wondering why its careful `description` never appeared anywhere, that is
why — three of them had been sitting on the Variables nodes since NDA-003.

## Which channel wins

There is a **third** channel the table above does not mention, and three channels with no declared
winner is how they drift. Settled by Richard on 2026-08-01:

| Channel | Status |
| --- | --- |
| **`description` on the port declaration** | ✅ **Canonical.** The single source of truth. Everything else derives from it or adds to it |
| enrichment `ports` in `docs/node-catalog/enrichment/*.json` | May **only add what the source cannot know** — usage guidance, cross-node context, examples. It must not contradict `description`, and it is **not** a place to correct one |
| `tooltip` | **Display-only and derived**, per the table above |

**Why the port declaration and not the enrichment file**, which would have let docs be corrected
without touching runtime code: the truth would then live in two repositories, and the port
declaration — the thing a person editing the node is looking at — would be the one that could
quietly go stale.

⚠️ **A consequence worth stating: a `description` may name a defect.** Several do, because an
author reading the property panel is where that warning has to land. They come out when the defect
is fixed — grep for `⚠️` in the port declarations to find them.

⚠️ **And one for the enrichment channel: a `description` that changes makes the enriched catalog
stale, not wrong.** `npm run catalog:merge:check` is the gate; regenerate rather than hand-editing
the merged file.

## The rules

1. **One sentence. No trailing period.** The panel and the catalog both add their own punctuation
   and framing; a sentence that ends mid-clause reads badly in a list.
2. **Say what it does, not what it is.**
   - ✅ `Number of items to skip before the first result`
   - ❌ `The offset`
3. **Never restate the display name.** `Offset — the offset` is *worse than blank*, because a blank
   port is visibly undocumented and a restatement looks answered. This is the single most common
   failure mode when documenting in bulk.
4. **Start with a verb for signals, a noun phrase for values.**
   - signal input: `Runs the query and replaces Items with the result`
   - signal output: `Fires once the query has returned and Items is up to date`
   - value: `How many results the query matched, ignoring Offset and Limit`
5. **State the unit when it is not obvious**, and state it in the sentence rather than trusting the
   type: `Time before the request is abandoned, in milliseconds`.
6. **State the empty behaviour where it is not obvious.** This is where the
   [Empty-Value Contract](./EMPTY-VALUE-CONTRACT.md)'s decisions get written down for authors, and
   the sentence is often the only place they are visible: `Leave blank to keep every record`.
7. **Name the port it depends on, if it has one.** Ports do not exist alone and the AI loop has no
   other way to learn the pairing: `Ignored unless Store Type is Cloud`.
8. **Do not document the mechanism.** How the node implements the port belongs in a code comment.
   The description is for someone deciding whether to wire it.
9. **A failure or error port says what has gone wrong, not that something has.** `Fires when the
   record could not be written` beats `Failure signal`. See the
   [Failure Contract](./FAILURE-CONTRACT.md).

## Three worked examples

**A value input with a dependency and an empty behaviour.**

```ts
filter: {
  type: 'string',
  displayName: 'Filter',
  description: 'Records are kept only where this expression evaluates true; leave blank to keep every record',
  set(value) { … }
}
```

Rules 2, 6, 7. It says what happens, what blank means, and does not mention the parser.

**A signal output on a node that can fail.**

```ts
failure: {
  type: 'signal',
  displayName: 'Failure',
  description: 'Fires when the record could not be written, after the reason has been reported on the error channel'
}
```

Rules 4 and 9. It says what went wrong and where the detail is — an author reading only this knows
to look at On App Error next.

**A shared visual port, documented once for the 22 nodes that carry it.**

```ts
visible: {
  type: 'boolean',
  displayName: 'Visible',
  description: 'Hides the element while keeping the space it occupies in the layout',
  set(value) { … }
}
```

Rule 2 doing real work: "whether the element is visible" would be a restatement, and the fact worth
knowing — that it does *not* collapse the layout — is the only reason to read the sentence.

## Where to write them

**Shared definitions first, and re-measure before touching anything per-node.** The port population
is far more concentrated than the raw count suggests:

| | Count |
| --- | --- |
| Ports in the library | 2,654 |
| Carried by the 29 **visual** nodes | 1,767 (67%), averaging 61 ports each |
| Port *names* appearing on 5 or more nodes | 133 distinct names → **1,861 instances, 70% of the library** |
| Port names appearing on 10 or more nodes | 77 distinct names → 1,464 instances |

So roughly 130 sentences, written in two files, cover 70% of every port in the product:

- [`packages/noodl-viewer-react/src/react-component-node.ts`](../../packages/noodl-viewer-react/src/react-component-node.ts)
  — the universal visual base: `visible`, `enabled`, `opacity`, `zIndex`, `position`, the transform
  set, the bounding-box outputs, `didMount`/`willUnmount`, `cssClassName`/`styleCss`.
- [`packages/noodl-viewer-react/src/node-shared-port-definitions.ts`](../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts)
  — the opt-in mixins: dimensions, margins, padding, alignment, corner radius, border, shadow,
  text style, icon and label sets.

Only after those are done is the per-node tail worth measuring, and it will be much smaller than
2,508. Work the remainder by category alongside the [NDA-012 worksheets](../tasks/phase-30-node-library-audit/audit/):
check C1 *is* this task, and reading a node to audit it is the expensive part — writing the sentence
while the file is open is nearly free.

## Measuring

`node scripts/node-audit/register.js` regenerates `NODE-REGISTER.md` from
`packages/noodl-types/src/node-catalog.json`, so **coverage only moves once the catalog is
regenerated** (`node scripts/node-catalog/generate.js`). A description added to a node file and not
yet folded into the catalog is invisible to every measurement — and to the validator and the AI loop
with it.
