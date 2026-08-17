# CN-006b — drive notes

**Observations written 2026-08-17 (s21) BEFORE launching the editor.** The standing obligation: say
what would be observably true of a *working* feature first, and make sure each sentence could not
also be true of a broken one. **Readings are appended under each observation after the drive; this
file was committed to the plan with them blank.**

## The fixture, and why it is built rather than picked

⚠️ **No existing test project discriminates.** `cn069-s15-drive` has three kits and *nothing else* in
`noodl_modules/`, so "the list shows 3 cards" is equally true of a correct list and of one that
simply enumerates every module folder. `cn001-kit-drive` has one kit plus `inter` and `lucide-icons`,
so it discriminates — but with one kit it cannot show that counts are joined per-kit.

So the drive project is a `cp -R` of **`cn069-s15-drive`** with `inter` and `lucide-icons` copied in
from `cn001-kit-drive`: **5 module folders, 3 of them kits.** One project answers both questions.

🔴 **A copy, never the original.** Opening a project writes three files into it, and AC3's drive
deletes a kit folder outright.

⚠️ **Written expecting the pre-D8 kit (hex, not tokens); that expectation was wrong.** The property
panel showed `var(--green-600)` / `var(--amber-600)` / `var(--red-600)` on `Balance Strip`, so
`cn069-s15-drive` carries the **tokenised** kit. Nothing in this task reads colour so it changed no
reading — but the standing note that "`cn001-kit-drive` and `cn019-drive` still carry the pre-D8
kit" says nothing about *this* copy, and I had generalised it to one it does not cover.

## Observations, written before launch

### AC1 — the kits list

**O1 — exactly the three kits, and none of the two non-kits.** The Node kits section lists
`Cashflow Kit`, `Harbour Metrics`, `Wren Analytics`, and there is **no card for `Inter` or
`Lucide`**. *Discriminates:* a section that enumerated `noodl_modules/` would draw 5 cards. The
negative half is the load-bearing one — three cards alone is what both a correct list and a
list-everything bug produce on the un-augmented fixture.

> **Reading — MET.** Exactly 3 cards: `Cashflow Kit`, `Harbour Metrics`, `Wren Analytics`. **No
> `Inter` and no `Lucide` card**, while `ls noodl_modules/` on the same project at the same moment
> returned all five folders. The negative half is therefore about a real disk state, not an empty
> directory.

**O2 — the counts are joined per kit, and come from the runtime.** With the preview loaded:
`Cashflow Kit` **5 nodes**, `Harbour Metrics` **1 node**, `Wren Analytics` **1 node**.
*Discriminates:* a join on the folder name rather than the manifest name yields 0 for all three, and
three equal counts would mean nothing was joined per-kit at all.

> **Reading — MET.** `5 nodes` / `1 node` / `1 node`, matching the 5, 1 and 1 node definitions
> counted in each kit's `index.js` before launch. The singular *"1 node"* beside the plural
> *"5 nodes"* also shows the number is read and pluralised, not templated.

**O3 — a kit that has not run says so, and does not say "0".** Before a runtime has executed the
kits, each card reads *"Installed. Reload the preview…"* rather than a zero count. *Discriminates:*
✅ D3 — "installed but not executed" and "executed and registered nothing" are different states, and
the first is the one an author hits seconds after pressing New node kit.

> **Reading — MET, but not in the sequence predicted, and the difference matters.** The preview
> auto-starts, so by the time the settings panel was first opened all three kits had already
> registered and the "not yet loaded" state was **already past** — it could not be observed by
> looking. It was instead produced the way an author actually meets it: **"New node kit" →
> `Midsession Kit`**, created against the running session. Its card appeared immediately reading
> *"Installed. Reload the preview to load its nodes — the picker lists what a running runtime has
> registered."* while the other three showed counts. ✅ D3's two states, distinguishable, in one
> screenshot. ⚠️ **An observation about a startup-ordering state is not measurable after startup** —
> writing it down before launching did not make it observable, and the honest recovery was to
> construct the state rather than to claim the reading.

**O4 — expanding names the node types.** Clicking `5 nodes` lists five `nodegx.cashflow.*` type
names.

> **Reading — MET.** `nodegx.cashflow.Lane`, `.Pill`, `.BalanceStrip`, `.DayAxis`,
> `.DangerBanner`.

### AC2 — provenance in the property panel

**O5 — the control pair, and it is the whole of P1.** Selecting a kit node draws exactly one
`[data-test=node-provenance]` reading **"from Cashflow Kit"**; selecting a built-in on the same
canvas draws **zero**. *Discriminates:* one arm alone proves nothing — a row that appeared on
everything would satisfy the first sentence and violate the ruling.

> **Reading — MET, both arms, same canvas, consecutive selections.** Kit node
> (`nodegx.cashflow.BalanceStrip`): **1** element, text `from Cashflow Kit`. Built-in (`Group`):
> **0** elements. Screenshots: [cn006b-panel-kit-node.png](cn006b-panel-kit-node.png) and
> [cn006b-panel-builtin.png](cn006b-panel-builtin.png) — the kit's header reads
> `Balance Strip` / `BALANCE STRIP · VISUAL` / `from Cashflow Kit`, the built-in's
> `Screen` / `GROUP · VISUAL` and then straight to `COMMENT`.

**O6 — the P1 capability check, made countable.** AC4 asks for a side-by-side screenshot and calls
any difference beyond the provenance row a finding. A screenshot is a weak instrument for *absence*,
so the header's action rail is counted instead: a kit node and a built-in must have the **same
number of `.property-header-icon-button`s** (help, rename, delete).

🔴 **Predicted to have been BROKEN before this session's change, and that prediction is the point:**
`getNodeDocs` reads the enriched catalog, which is keyed by type name and generated at repo-build
time, so a kit type can never be in it — the help button was gated on that lookup, so a kit node
had **2 buttons and a built-in 3**. A capability a kit node cannot reach is what P1 forbids. The
equality must be shown to be *caused by* this change, not merely to hold.

> **Reading — MET, and the causal half is the one worth keeping.** Both arms show **3**
> `.property-header-icon-button`s. Equality alone would have been worth little, so the pre-change
> world was reproduced live: clearing `type.docs` on the kit node in the running renderer and
> re-selecting it dropped the help button and the count fell to **2**, against the built-in's 3.
> So the equality is *caused by* this change and was not already true. ⚠️ The provenance row stayed
> at 1 through that, which is correct — attribution is not conditional on the author having written
> a sentence.

**O7 — the help text is the author's sentence, and there is no dead link.** The kit node's help
tooltip carries the `docs` prose from `index.js` and offers **no "Read more"** fine type, while a
built-in's does. *Discriminates:* the spec said to render `docs` as a link; on a kit it is prose, so
a link would open nothing.

> **Reading — MET, via the Tooltip's props rather than its pixels; the instrument is named
> because it is weaker.** 🔴 **CDP hover does not open this tooltip** — a real
> `Input.dispatchMouseEvent` `mouseMoved` onto the button's measured centre, twice, with a neutral
> move in between, left the tooltip layer empty; so did synthetic `mouseover`/`mouseenter`. This is
> the recorded "transport OK, effect nothing" trap in a new surface. What was read instead is the
> `content`/`fineType` React actually passes the `Tooltip`, which is one step short of the rendered
> text: kit node → `"A cumulative balance bar: one cell per day, banded ok / warn / danger."`, the
> exact string at `cashflow-kit/index.js:427`, with **`fineType: null`** — no "Read more", so no
> dead link is offered. Built-in `Group` → the catalog summary plus **`Read more · F1`**.
> ⚠️ **Also a trap worth carrying:** the obvious fiber walk reported `"Delete the node"` for all
> three buttons, because following `sibling` from the root escapes the button's own subtree and
> lands on the last button in the rail. Descend only.

### AC3 — removal

**O8 — the folder goes, the card goes, and the nodes are accounted for.** Removing `Wren Analytics`
deletes `noodl_modules/wren-analytics` from disk, drops its card, and — because the live runtime
still has its node registered — draws it as an **orphan card reading "not on disk"**.
*Discriminates:* the orphan card is a specific prediction; a join that silently dropped unmatched
groups would leave the node in the picker with nothing anywhere saying why.

> **Reading — MET in full.** Confirm text: *"Remove \"Wren Analytics\"? This deletes
> noodl_modules/wren-analytics. Its 1 node will stay in the picker until you reload the preview."*
> After: the folder is gone from disk, the card is gone from the list, and the orphan card is drawn
> — `Wren Analytics · not on disk`, *"The running preview still has 1 node from this kit
> registered."* ⚠️ **First attempt failed and the failure is the spec's own trap**: selecting nodes
> for AC2 had switched the sidebar to Properties, so the remove button measured **0×0** and the
> click was refused. Re-opening settings and re-measuring was the fix — the button was never
> broken.

**O9 — removal refuses what it did not offer.** `removeNodeKit` against `lucide-icons` — an iconset
the list never listed — is refused, and the folder survives.

> **Reading — MET, against three real modules rather than one.** `lucide-icons` (iconset) →
> *"not a node kit — refusing to delete it"*; `inter` (asset module, no `main`) → the same;
> `../cn006b-drive` (traversal) → *"is not a module folder name"*. All three folders present on
> disk afterwards, and `listNodeKits` reported exactly the three real kits.

## Instrument notes

- 🔴 **`window.confirm` is a native modal in Electron and blocks the renderer**, taking CDP with it.
  Override it to `() => true` before clicking ✕ and restore it after. Clicking that button without
  doing so hangs the drive, and the hang reads exactly like a broken handler.
- ⚠️ The editor opens in preview mode; the node canvas needs the `ModeSegmentedButton` toggle before
  a property panel exists to measure at all (carried from s20).
- ⚠️ `window.__req` is not in this build — rebuild it with
  `window.webpackChunknoodl_editor.push([['probe'], {}, r => { window.__req = r; }])`.
- ⚠️ The Node kits section's `CollapsableSection` must be **open** before its children are in the
  DOM — a `mounted`, not a `visible`, distinction.
