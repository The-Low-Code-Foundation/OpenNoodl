# SB-018 — two dead wires, a port that resolves in one runtime and not the other, and a heading that says "Text"

**Status: ⬜ MEASURED s15, NOT FIXED. §2 RESOLVED s16 and MOVED — it is not small, and it is not a separate question.** Findings from the same drive as
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

### 🔴 RESOLVED s16 — the exclusion above was wrong, and this belongs to SB-017

The paragraph that stood here excluded `storageFetch` as a cause of SB-017 on the grounds that
the mechanism was "the missing script ports". **Both halves of that reasoning were wrong**, and
the closing sentence — *"this needs reading rather than assuming"* — was the right instinct.

1. **It is the same mechanism, not a separate question.** `dbcollectionnode2.ts:1222` pushes
   `storageFetch` from inside the node's **dynamic** ports function, not from a static
   declaration. Dynamic ports reach the editor only when a runtime client pushes them over
   `sendDynamicPorts`, and cloud components have had no such client since WF-007 deleted the
   cloud-runtime window. That is *identical* to the script ports' cause — see SB-017 §6.3,
   which tabulates all five affected families. The browser/cloud asymmetry in the table above
   is explained exactly: the browser viewer pushes them, nothing pushes them for the cloud.

2. **`submitContactForm` having no `DbCollection2` did not exclude it**, because the argument
   only ever needed one endpoint to break. And it *does* break by this family: all four of its
   `request.pm-* -> NewDbModelProperties.prop-*` wires are dropped, so the record it stores
   would carry no name, email, message or page.

3. 🔴 **It is on `claimSite`'s critical path.** `secret.done -> DbCollection2.storageFetch` is
   the wire that starts the function, and this file already said why: all four `runOnChange-*`
   are `false`, so it is the collection's **only** fetch trigger. It is dropped from the
   deployed bundle. **A fix scoped to script ports clears 32 of the 51 dropped connections and
   `claimSite` still hangs for 30 seconds.**

So this is not one of three small things. It is a second family of the SB-017 defect, and it
is tracked there — **SB-017 §6.4 and acceptance 2**. It stays written down here because the
browser/cloud table above is the measurement that identified the family, and because the
question this file asked about SB-013 is still open and still worth an answer:

⬜ **Still open, and inherited by SB-017:** in the *deployed* bundle `claimSite`'s collection
has no fetch trigger at all, so SB-013's explicit-fetch barrier is inert there and its
readiness guard is carrying the fix alone. SB-013 shipped two barriers graded independently,
so **its specs are green either way**. Whoever fixes SB-017 should re-read SB-013 against a
bundle that has the wire back.

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

## 5. 🆕 A third one, found by SB-017's drive (s17)

`submitContactForm` answers **`{"received": false}`** on a request whose message it stored
correctly — driven over real HTTP against a real backend, so this is the answer a visitor's
form gets.

`compose`'s script ends `Outputs.built()`, which makes `out-built` a **signal**, and
`compose.out-built` is wired to `res-3.pm-received` — a **value** parameter port on the
Response node. `canCastPortTypes` allows the cast, so nothing warns on the canvas and nothing
drops on the way out; the port simply never receives a value and the response reports the
declared default.

Same family as §2 and §3: a wire that is structurally fine and semantically dead. Two shapes
of fix — publish a value (`Outputs.built = true` beside the signal, with a second
`scriptOutputs` entry) or drop the `received` parameter and let the 200 be the answer — and
the second is a change to what the endpoint promises, so it is not a free pick.

⚠️ It is also the one connection WFA-009's `pm-` rule kept when SB-017 dropped the other 51,
which is why it survived to be observed at all.


## 6. s18 — the two `For Each.Changed` wires are 2 of SB-017's 23

SB-017 §11's census of the browser half accounts for every one of the 23 warnings s17 read on
the installed template, and **these two are two of them** — the residue after the 19 `prop-`
wires. So this file's item (1) is not only dead on the canvas: **both wires are dropped by the
browser deploy as well**, for the same reason every other undeclared port is.

That does not change the disposition here — it stays bounded, because a valid
`NewDbModelProperties.done` wire sits beside each and the refresh still fires — but it does
change who fixes it. **SB-017 §11.4's fix must not restore these two.** They are the case its
known-firing control is about: a wire to a port that exists on nothing has to keep being
dropped. The right fix for these two is to delete them, which is this file's, not SB-017's.
