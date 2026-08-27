# SB-018 — two dead wires, a port that resolves in one runtime and not the other, and a heading that says "Text"

**Status: ⬜ MEASURED s15, NOT FIXED.** Three small findings from the same drive as
[SB-017](SB-017-THE-DEPLOY-DROPS-HALF-THE-GRAPH.md). Filed together because each is
individually too small for its own task and none should be lost.

## 1. `For Each` has no `Changed` output, and the template wires one twice

`/Pages/PageEditor` and `/Pages/Admin` both carry
`For Each.Changed -> DbCollection2.storageFetch`.

`packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx` declares
`itemActionItemId`, `itemsRendered`, `Refresh`'s outcome, and the dynamic
`itemOutput-*` / `itemOutputSignal-*` family. **There is no `Changed`.** Both wires are dead.

⚠️ **Bounded rather than dramatised:** each of those two components *also* carries a valid
`NewDbModelProperties.done -> DbCollection2.storageFetch`, so the refresh after a create or
update still fires. The dead wire was a redundant second trigger, and the panel is not broken
by it.

🔴 **The gap it names is the interesting half:** no authoring door checks that a wired port
exists on a **standard** node. SB-009 measured that a *component* named in a parameter goes
unchecked; this is the same hole one level down, for a port name on a node type the door
already knows everything about. The author invented `Changed`, the door accepted it, and the
first thing to notice was the editor — five sessions later.

## 2. `DbCollection2.storageFetch` resolves in a browser component and not a cloud one

Of the four "plain" dangling ports in s15's census, all four are wires into
`DbCollection2.storageFetch`, and the editor flags **only the cloud ones**:

| component | wire | flagged? |
|---|---|---|
| `/Pages/PageEditor` | `NewDbModelProperties.done -> storageFetch` | no |
| `/Pages/Admin` | `NewDbModelProperties.done -> storageFetch` | no |
| `/#__cloud__/claimSite` | `noodl.cloud.secret.done -> storageFetch` | **yes** |
| `/#__cloud__/site/ContactRecipient` | `Component Inputs.Fetch -> storageFetch` | **yes** |

`packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.ts:1222` pushes
`storageFetch` **unconditionally**, so the runtime source has the port. Something in how the
editor derives ports for a *cloud* component does not.

⚠️ **This was a candidate cause for SB-017 and is now excluded as the common one** — SB-017's
mechanism is the missing script ports, which explains both failing endpoints, and
`submitContactForm`'s own graph has no `DbCollection2` at all. It survives as a separate
question, and it is not cosmetic: in `claimSite` all four `runOnChange-*` are `false`
(SB-004 F12's fix), so that wire is the collection's **only** fetch trigger. If it is inert
rather than merely mis-reported, then SB-013's explicit-fetch barrier is doing nothing and its
readiness guard is carrying the whole fix alone. SB-013 shipped two barriers graded
independently, so **its specs would still be green either way** — which is exactly why this
needs reading rather than assuming.

## 3. The public site's heading renders the literal word "Text"

On a site nobody has claimed, `http://localhost:8574/` renders:

```
Text
This site has not been set up yet.
```

The second line is s14's fix working correctly — the right one of `diagnoseNotFound`'s three
sentences, on a genuinely unclaimed site with the policy enforced.

The first line is an `<h1 class="ndl-visual-text">`. The Site page's title `Text` node sets
**no `text` parameter** and is fed only by `out-siteName` from a `JavaScriptFunction`. With no
`SiteSettings` row, `out-siteName` never publishes, and the node falls back to the runtime's
default — `packages/noodl-viewer-react/src/nodes/visual/text.ts:41`, `default: 'Text'`.

🔴 **This is F27's territory and F27 did not cover it.** s14 made the *body* of that screen
name its cause in a sentence a visitor can act on; the heading above it still says `Text`, and
a heading is what a person reads first. The same node will do the same thing on any page whose
record has not arrived.

Cheapest fix: give the node a `text` parameter that is a sensible standing value, so the wire
overrides something rather than filling a blank. ⚠️ Note this is a *template* fix and the
template content is **generated** — edit the component set and run
`npm run template:site-builder`, or `sb007Template.test.ts` reddens.
