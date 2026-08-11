# Port group vocabulary

**Status:** normative for the node library. Settled by Richard on 2026-08-11 (SIG-003 §2), out of
[phase 60](../tasks/phase-60-values-and-signals/README.md). Sits beside
[`PORT-DESCRIPTION-STYLE.md`](./PORT-DESCRIPTION-STYLE.md), which governs the *sentence* on a port;
this file governs the *heading* above it.

**Gate:** `npm run catalog:groups:check` ([`scripts/node-audit/port-groups.js`](../../scripts/node-audit/port-groups.js)),
run in the `node-catalog` CI job. ⚠️ It reads the generated catalog, so run `npm run catalog:check`
first — a `group` added to a node file and not folded into the catalog is invisible to it. And run
both against a **committed** tree, because the generator reads the working tree.

## Every port declares a `group`. There is no opt-out.

[`ConnectionBar.tsx`](../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx)
reads:

```ts
const name = p.group ? p.group : OTHER_GROUP;
```

So **`Other` is not a category anyone chose.** It is the absence of a `group:` line, rendered as if
it were a decision. Before SIG-003, 167 static ports across 58 node types landed there, and on every
Variable node that was the four ports the node exists for — `Value` in, `Set`, `Value` out, `Changed`
— while the only port that *had* a heading was `treatEmptyAs` → `Advanced`.

⚠️ **`group: ''` is not "no heading".** The empty string is falsy, so the ternary above files it under
`Other` exactly as if the line were absent. `logic-builder.ts` carried `group: '', // Empty group to
avoid "Other" label` for exactly this reason and it never once worked.

## The three kind headings

A heading either names the **kind** of a port or names its **subject**. These three name the kind, and
they are exclusive — the gate fails on a port whose kind does not match:

| Heading | Holds | Reads as |
| --- | --- | --- |
| **Values** | any non-signal port, either plug | a thing that *is*, and stays |
| **Actions** | signal **inputs** | a thing you *cause* |
| **Events** | signal **outputs** | a thing that *happened* |

This is the whole of what phase 60 is named for, carried by the heading rather than by prose: a
builder who drags a value at a signal input and a builder who hunts for a `Set` that is not there are
asking the same question, and the popup can now answer it before either asks.

⚠️ **Retired, and the gate refuses them:** `Value` (singular) → `Values`; `Signals` → `Actions` or
`Events` by plug; `Changed Events` → `Events`.

⚠️ **`Change` is *not* retired**, and SIG-003's own census was wrong to pair it with `Changed Events`
as a duplicate. Every port under `Changed Events` is a signal output; every port under `Change` — on
Array Changed and Object Changed — is a **value** describing what changed (`index`, `item`, `key`,
`previousValue`). It is a subject heading, and folding it into `Values` would merge "what the array
is" with "what changed about it" on the two nodes whose whole job is the difference.

## Subject headings may hold more than one kind

`Style`, `Pointer Events`, `Scroll`, `Bounding Box`, `Snap To Position X`, `Realtime`, `Run On Value
Change`, `Error`, `Status`… group by what the ports are *about*, and the gate does not police their
kinds.

⚠️ **SIG-003's acceptance criterion "no node files a signal port and a value port under the same
heading" is wrong as written, and was not implemented.** `Snap To Position X` is `Do` + `Duration` +
`Value` — a task and its parameters. Splitting the trigger from the parameters by kind would put the
three ports an author uses together under two headings and would be strictly worse than the defect it
fixes. The rule that *was* implemented is the narrower one above: kind headings must be pure; subject
headings need not be.

**When a subject heading and a kind heading both fit, prefer the subject.** It carries more
information. `Values` is for the ports whose only shared property is that they are values.

### Where the shared visual outputs go

`childIndex`, `childrenCount` and `this` (44 ports across the visual nodes, declared once in
[`react-component-node.ts`](../../packages/noodl-viewer-react/src/react-component-node.ts)) are
`Advanced`. They describe the element's place in the tree and a reference to the node itself — not
anything the node is *for* — and filing them under `Values` would cost `Values` its meaning on every
visual node in the library.

## Ordering

[`refusalPlan.ts`](../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/refusalPlan.ts)
owns both halves, import-free and graded by `tests-unit/connection-popup/groupOrder.test.ts`.

**`DEFAULT_GROUP_PRIORITY`** — what a node gets when it declares no `connectionPanel.groupPriority`:

```
General · Values · Actions · Events · Status · Error · States · Advanced
```

It reads as a sentence about the node: what it is, what it has, what you do to it, what it tells you,
how it is doing, what went wrong. The previous default was `['General', 'Events', 'Actions',
'States']`, which put what *happened* above what you can *cause* and named neither of the two headings
the library leans on hardest.

**`orderGroups`** — three tiers:

1. groups named in the priority list, in that order;
2. everything else, **alphabetically**;
3. `Other` last — and after the rule at the top of this file it should be empty.

⚠️ Tier 2 is the new one. The old sort floated each priority entry to the top one pass at a time and
left every unlisted group in whatever order it happened to be **built** in — so a heading's position
was a property of declaration order in a node file, and nothing said so. Recorded in source at
[`text-input.ts:45`](../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L45) about
`Run On Value Change`.

## Two things a static read cannot see

⚠️ **`groupPriority` is matched against `group` by literal equality.** Renaming one side and not the
other silently demotes the group to the unordered tier. The gate reads every `groupPriority: [...]`
**from source**, not from the catalog — the catalog carries `connectionPanel` on none of its 175 node
entries, so a gate reading it there is a check that can never go red. It caught four cloud nodes
(`hmac`, `secret`, `jwtsign`, `jwtverify`) still listing `'Value'` after their ports became `'Values'`.

⚠️ **Dynamic ports do not appear in the catalog's port lists.** 88 node types build ports at runtime.
`isPortConnectable` only refuses `allowEditOnly` *object* types, so a dynamic port declared
`type: 'string'` or `type: 'component'` reaches the connection popup and needs a `group` like any
other. Two were found ungrouped this way and are listed in the gate's `DYNAMIC_SEAMS`:

| Seam | Ports | Now |
| --- | --- | --- |
| [`eventreceiver.ts`](../../packages/noodl-viewer-react/src/nodes/std-library/eventreceiver.ts) | one `*` output per payload key | `Values` |
| [`navigation-stack.tsx`](../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx) | `pageComp-*`, `pagePath-*` | `Pages` |
| [`logic-builder.ts`](../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts) | a block program's signal in/out | `Actions` / `Events` |

The `intype-*` / `outtype-*` ports on the script hosts and Page Stack's per-page enums are
`allowEditOnly`, so they never reach the popup and are exempt.

## What this does not change

It does not touch `description` or `tooltip` — see
[`PORT-DESCRIPTION-STYLE.md`](./PORT-DESCRIPTION-STYLE.md). A heading says what *sort* of thing a port
is; the description says what that particular port does.
