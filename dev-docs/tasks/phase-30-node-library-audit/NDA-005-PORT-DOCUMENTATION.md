# NDA-005: Port Documentation Sweep

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-005 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — the single biggest input to the AI authoring loop, and the cheapest win in the phase |
| **Difficulty** | 🟢 Low per port, 🟠 Medium in aggregate — 2,508 ports |
| **Estimated Time** | 3–5 weeks, or much less if batched with NDA-012 |
| **Prerequisites** | None. Ports touched by NDA-003 should be documented there instead |
| **Branch** | commit directly to `cline-dev`, one commit per category |
| **Recommended executor** | 🟢 **Sonnet 5** — mechanical once the house style is fixed |

## Objective

Write a `description` for every port in the node library. 2,508 of 2,650 are blank.

> **§0, 2026-07-30 — the premise was half right, and the wrong half was load-bearing.**
>
> `description` **was declared on both port types and copied nowhere.** `nodedefinition.ts` built
> its metadata from `tooltip` and never looked at `description`; the catalog then derived its own
> `description` by flattening that tooltip through `tooltipToText`. So the field this task tells an
> author to write was **inert** — and three descriptions NDA-003 had already written, on the
> Variables nodes, about the very contract that task established, reached no consumer at all.
> Writing 2,508 more would have produced 2,508 more of the same.
>
> Fixed: `description` is carried into the compiled metadata for inputs **and outputs**, and the
> catalog prefers an authored description over a flattened tooltip. The flattening survives as a
> *fallback*, so the existing 142 do not go to zero on the way to being improved.
>
> **`tooltip` cannot serve as the description and never could.** It is the editor's hover popup — a
> heading that legitimately restates the display name, paragraphs, sometimes image captions — which
> is why the library's 142 "documented" ports read like *"Clip content Controls if elements that are
> too big to fit will be clipped Enabled Disabled"*. It also **does not exist on output ports at
> all**, so before this change roughly half the library could not be documented by any means.
>
> The house style is at [`PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md)
> (criterion 3). Plumbing pinned by L1–L5 (runtime) and M1–M5 (viewer); the M-rows exist because
> `createNodeFromReactComponent` moves visual ports across three routes, and this phase has already
> been bitten once by a rebuild-the-object line silently dropping fields of a union.

## Why this is not a docs chore

Three consumers read `description`, and all three are degraded today:

1. **The property and connection panels** — where an author asks "what does this port do". Blank means
   they guess or leave the editor to search docs.
2. **The semantic validator (SUB-006) and catalog enrichment (SUB-005)** — which can only check what
   is described.
3. **The AI authoring loop (AIX-002, AIX-011)** — port descriptions are the primary signal the model
   has when choosing which port to wire. **95% blank is a direct explanation for wrong port choices**,
   and it is the cheapest quality improvement available to the authoring loop.

That third one makes this task pay for itself. Every other AI-authoring improvement competes with a
model that is guessing at ports.

## The shape of the work

| | Count |
|---|---|
| Total ports | 2,650 |
| Documented | 142 (5%) |
| Nodes where **no** port is documented | 112 of 155 |
| Nodes with no docs URL at all | 14 |

**Most of this is shared.** `node-shared-port-definitions.ts` supplies dimensions, alignment, margins,
padding, transforms, text style and pointer events to most of the 29 Visual nodes. Documenting the
shared definitions once covers a large fraction of the 2,508 — do those **first** and re-measure
before touching anything per-node, because the remaining count will be much smaller than it looks.

> **Measured 2026-07-30, and the premise holds harder than it was stated.** The 29 visual nodes
> carry **1,767 of the 2,654 ports** (67%), averaging 61 each; **133 distinct port names account for
> 1,861 instances — 70% of the entire library**, and 77 names account for 1,464.
>
> **Done 2026-07-30: 61 port names documented in two files, projected coverage 5.4% → 41.2%** (952
> port instances newly covered). The two files are `react-component-node.ts`'s universal visual base
> and `node-shared-port-definitions.ts`'s mixins.
>
> ⚠️ **Projected, not measured**, because `register.js` reads `node-catalog.json` and regeneration is
> blocked by a parallel session. Nothing in the catalog, the validator or the AI loop sees any of
> these sentences until it runs.
>
> **Criterion 2 needs the tail, and the shared pass barely moves it**: nodes at 0% went 112 → 106,
> because the 126 non-visual nodes hold 887 ports of their own and share almost nothing. Only **2 of
> 29 visual nodes** are still at 0%. So the remaining work is the per-node tail — which is exactly
> what NDA-012's category pass is already reading each node for.

## House style (settle this before writing 2,508 of anything)

**Settled 2026-07-30 at [`dev-docs/reference/PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md)**,
with the three worked examples criterion 3 asks for, the `description`-vs-`tooltip` split, and the
concentration table above. What follows is the proposal it was built from; the reference doc is
normative where the two differ.

Proposed:

- One sentence, no trailing period, starting with a verb for signals and a noun phrase for values.
- State the **unit and the empty behaviour** where either is non-obvious — this is where NDA-003's
  decisions get written down for authors.
- Say what it does, not what it is: "Number of items to skip before the first result", not "The offset".
- Do not restate the display name. `Offset — the offset` is worse than blank, because it looks answered.

Write the style into `dev-docs/reference/` next to the two contracts, and put three worked examples in
it.

## Method

1. Document the shared port definitions in `node-shared-port-definitions.ts`. Re-measure.
2. Work by category, using the [NDA-012 worksheets](./audit/) — check C1 is exactly this task, so if
   NDA-012 is running, **do both in the same pass**. Reading the node to audit it is the expensive
   part; writing the description while it is open is nearly free.
3. Regenerate the catalog and the register after each category so the number visibly falls.
4. The 14 nodes with no docs URL need one written or the field removed — a dead link is worse than none.

## §2 — the ports the coverage number cannot see (added 2026-07-30)

**Decision: this is NDA-005 §2, not a new task.** What is at stake is criterion 1 and criterion 2 of
*this* task — the number they are measured by excludes a whole class of port — so putting it anywhere
else would leave this task able to report success on a measurement it knows is partial.

It was raised as "89 of 156 nodes have dynamic ports, `sendDynamicPorts` carries no `description`, and
nobody owns this". **Measured, the gap is much narrower than that, and the difference matters enough
to write down.** The catalog already carries a per-node `dynamicPorts` record — `mechanisms`, an
`editorAdapter` where there is one, and a prose `description` — and **all 89 of the 89 have one**. So
the dynamic ports are not invisible to the catalog, the validator or the AI authoring loop; a consumer
can already learn that a node has them and where they come from. What does not exist is a sentence per
individual dynamic port, and for most of them one could not: the names are chosen by the author
(`pm-<pathParam>`, `result-<name>`, `closeAction-<name>`), so the documentable unit is the *family*,
which is what `dynamicPorts.description` already is.

Three real gaps survive that correction, and they are bounded:

1. **A node with zero static ports reports 100% coverage.** `Config` (`DbConfig`) is the case that
   surfaced this, and there are **5 such nodes** in the library. `0/0` is arithmetically 100% and
   substantively nothing. The register must report these as `n/a — all ports dynamic` rather than as
   fully documented, or criterion 2 ("no node has 0% coverage") is satisfiable by having no ports.
2. **11 nodes sit on the generic runtime-discovered boilerplate** — *"Some ports are discovered at
   runtime from user code, parameters or connected components…"* — which says nothing about what the
   ports of *that* node are. The other 78 have specific prose (`"Ports are derived from the target
   router and the path parameters of the selected page component"`). This is the flattened-tooltip
   failure of §0 in a second place: a field that is populated everywhere and informative in most of
   them. Only **3 of the 11 are in the node picker** — `Config`, `Array Filter`,
   `Subscribe To Changes` — so the author-facing part of this is three nodes.
3. **`sendDynamicPorts` has no `description` field**, which costs nothing for author-named ports and
   costs real information for the *fixed-name* dynamic ports — ports that are pushed dynamically but
   whose names and meanings are fixed by the node, not by the author. Those can and should carry a
   sentence.

**Scope of §2**, smallest-first, in the order that makes the number honest before it makes it bigger:

- (a) Teach `scripts/node-audit/register.js` to distinguish "documented" from "has nothing to
  document". A vacuous 100% is worse than a 0%, for §0's reason: a blank port is visibly undocumented
  and a restatement — or an empty denominator — looks answered.
- (b) Write specific `dynamicPorts.description` prose for the 11, starting with the 3 in the picker.
- (c) Add an optional `description` to the `sendDynamicPorts` wire format and populate it for the
  fixed-name dynamic ports.

⚠️ **Navigation is the sharpest case in the library and should be the worked example.** Seven of its
eight nodes carry their *primary* port dynamically — `Target Page`, `Router`, the path placeholders —
so the category now reads **100% documented** while the input that says where to navigate has no
sentence anywhere. See [`audit/navigation.md`](./audit/navigation.md).

## §3 — Channel precedence (settled by Richard, 2026-08-01)

> ✅ **Also written into the normative reference**, 2026-08-01 — see
> [`PORT-DESCRIPTION-STYLE.md` § Which channel wins](../../reference/PORT-DESCRIPTION-STYLE.md#which-channel-wins).
> A rule that lives only in a task spec is a rule the next person writing a description will not
> read: the style guide is what a node author is pointed at, and it did not mention the enrichment
> channel at all.

Three channels can carry text about a port, and until now **none of them was declared to win**
(FINDINGS **WD-3**). ~550 sentences were written across two sessions before anyone asked. The rule:

| Channel | Status |
|---|---|
| **`description` on the port declaration** | ✅ **Canonical.** The single source of truth. Everything else derives from it or adds to it |
| enrichment `ports` (`node-catalog-enriched.json`) | May **only add what the source cannot know** — usage guidance, cross-node context, examples. It must not contradict `description`, and it is not a place to correct one |
| `tooltip` | **Display-only and derived.** It is the editor's hover popup, with its own layout, images and title. It cannot serve as the description and never could — see the note at the top of this file |

**Why `description` and not the enrichment file**, which would have let docs be corrected without
touching runtime code: the truth would then live in two repositories, and the port declaration —
the thing a person editing the node is looking at — would be the one that could quietly go stale.
It is also simply where the ~550 sentences already are, so this rule cost nothing to adopt.

⚠️ **A consequence worth stating: a `description` may name a defect.** Three Visual sentences do
(`Repeater`'s `Items`, `Component Stack`'s `Clip Content`, `Video`'s `Pause`/`Reset`), because an
author reading the property panel is where that warning has to land. **They come out when the
defects are fixed** — grep for `⚠️` in the port declarations to find them.

## Success criteria

1. Port documentation coverage ≥ 95% (inverting today's number), measured by
   `node scripts/node-audit/register.js`.
2. No node has 0% coverage.
3. The house style exists in `dev-docs/reference/` with worked examples.
4. Spot-check the AI authoring loop before and after on the same prompt set; record whether port
   selection improved. If it did not, that is worth knowing and worth writing down.

## Out of scope

Rewriting the external docs site. This is the `description` field in node definitions only — the thing
that ships inside the product and inside the catalog.
