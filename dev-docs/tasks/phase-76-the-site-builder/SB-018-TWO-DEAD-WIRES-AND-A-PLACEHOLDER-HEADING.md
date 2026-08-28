# SB-018 — two dead wires, a port that resolves in one runtime and not the other, and a heading that says "Text"

**Status: ✅ ALL THREE FIXED s19. §2 RESOLVED s16 and MOVED — it is not small, and it is not a separate question.**

🔴 **All three dispositions in this file turned out to be wrong, and §7 is what each was wrong about.** (1) was not a redundant wire to delete — the port existed under another name. (3) was not one heading — it was six nodes. (5)'s stated mechanism was not a missing default — the port was written twice and settled on the falling edge, which made that section's own suggested fix insufficient. Every correction came from reading the module that owns the behaviour instead of the graph that exhibits it.

Findings from the same drive as
[SB-017](SB-017-THE-DEPLOY-DROPS-HALF-THE-GRAPH.md). Filed together because each is
individually too small for its own task and none should be lost. **§§1, 3 and 5 below
are left as they were written — they are the record of what was measured at the time,
and §7 says what each got wrong.**

## 1. `For Each` has no `Changed` output, and the template wires one twice

> ✅ **FIXED s19 — see §7.1, and the disposition below is wrong.** The wire is not
> redundant and the port is not missing: `For Each` republishes it as
> `itemOutputSignal-Changed`. Renamed, not deleted.

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

> ✅ **FIXED s19 — see §7.2.** It was **six** nodes, not one; the census over the
> shipped artefact is the finding.

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

> ✅ **FIXED s19 — see §7.3, and both the mechanism and the suggested fix below are
> wrong.** The port is not unset: a pulse writes `true` then `false` and the body
> carried the rearm. Publishing a value on `compose` would have answered `true` on
> the failure path too.

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


## 7. s19 — the three fixes, and why none of them is the one this file proposed

Every item above is closed. What follows is what changed and, in each case, the
measurement that changed the disposition — because in all three the fix this file
had written down would have been wrong, and in two of them it would have shipped
something worse than the defect.

### 7.1 (1) The wire was not redundant, and the port exists

**Fixed by renaming, not deleting**: both wires now read
`For Each.itemOutputSignal-Changed -> DbCollection2.storageFetch`.

§1 called `For Each.Changed` "a redundant second trigger" on the grounds that a
valid `NewDbModelProperties.done -> storageFetch` sits beside each. 🔴 **The two
triggers do not cover the same events.** `done` is the *page's* create; publish,
unpublish, duplicate, save and remove all happen inside the **row** component,
which does not own the query and cannot refresh it. Deleting the wire would have
made "the list does not refresh after you publish a page" permanent — and the
comment on `/Admin/PageRow`'s `Component Outputs` node had said what the author
wanted all along: *"`For Each` forwards an item component's Component Outputs
signal as an output port of its own."* That is **true**. They used the wrong name.

`foreach.tsx:1030-1037` republishes every **signal**-typed output port of the
template component as `itemOutputSignal-<name>`, derived from the component's own
port list. So the port the wire wanted existed; `Changed` never did.

`packages/noodl-editor/tests-unit/sb-018/the-list-refreshes-when-a-row-changes.test.ts`
— **5 cases, 1 mutant** — drives the real module with the item components' ports
read off the **shipped artefact**, and asserts both directions: it announces
`itemOutputSignal-Changed`, and it announces nothing called `Changed`.

⚠️ **This moves the two out of SB-017 §11's census rather than fixing them there,
and that is a real difference.** `itemOutputSignal-Changed` needs only the
template component, which is always in the graph — not a class with columns,
which is `prop-`'s problem. So the viewer announces it, the wires resolve, and the
census drops **21 → 19**. §6's instruction to SB-017 — *its fix must not restore
these two* — is therefore satisfied by them no longer needing it, and the
known-firing control it was about is now the file's own negative case.

🔴 **§1's "interesting half" is untouched and still open.** No authoring door
checks that a wired port exists on a **standard** node. The door accepted
`Changed` for five sessions and would accept it again tomorrow.

### 7.2 (3) It was six nodes, and the census is the finding

**Fixed by giving every wired `Text` a standing `text` parameter.**

§3 filed this as one `<h1>`. Running the rule over the shipped artefact instead of
over the node the drive happened to see found **six**:

| component | node | fed by |
|---|---|---|
| `/Pages/Site` | `pageTitle` (the `<h1>` s15 drove) | `readPage.out-title` |
| `/Pages/Site` | `siteName` | `readSettings.out-siteName` |
| `/Site/SectionView` | `body` | `unpack.out-body` |
| `/Admin/PageRow` | `rowTitle` | `inputs.title` |
| `/Admin/PageRow` | `rowSlug` | `inputs.slug` |
| `/Admin/SectionRow` | `kindText` | `inputs.kind` |

🔴 **The template already had the rule and four nodes broke it.** `link`
(`'Page'`), `rowStatus` (`'Draft'`) and `notFound` all carried a standing value
already, so this is a rule being enforced rather than a convention being invented.

🔴 **And it compounds SB-017 §11.** A deployed admin panel writes `Page` rows with
no title and no slug because the `prop-` wires are dropped. Before this fix those
rows listed in the panel as the literal word **"Text"** — a placeholder that reads
as content. They now list as blank, which is what they are. That changes what the
failure looks like and nothing about what it is.

⚠️ The standing value is `''` and not a phrase, deliberately: these are headings
and row labels on live pages *mid-load*, and any word put there would be read as
the site's own copy for the moment before the record arrives.

`tests-unit/sb-018/every-wired-text-has-a-standing-value.test.ts` — **4 cases, 1
mutant** — takes `default: 'Text'` from the real module and, in the same case,
drives the module's own setter to show `''` **overrides** it. That second half is
not decoration: `''` is falsy, and a setter written `props[name] = value || default`
would have taken this whole change and changed nothing.

### 7.3 (5) The port was not unset — it was written twice

**Fixed by raising the flag after the write**, not by publishing a value on
`compose`.

§5 offered two shapes and recommended the cheap one: *publish a value
(`Outputs.built = true` beside the signal)*. 🔴 **That would have swapped one
constant for another, and the new one lies in the worse direction.** `compose`
runs on `req.receive` — *before* anything is stored — so a `true` published there
is `true` on the failure path too: the visitor whose message was lost would be
told it arrived.

🔴 **And the stated mechanism was wrong, which is what made that visible.** §5 said
*"the port simply never receives a value and the response reports the declared
default"*. A `pm-` port is typed `*` with no default, and `Response.initialize`
starts `responseParameters` at `{}` — **an unset port leaves its key out of the
body entirely**, so `{"received": false}` was proof the port *had* been set. It
had been set twice: `OutputProperty.sendPulse` delivers a signal into a value port
as `true` and then `false` in one drain pass (`node.ts:686-692`), and the response
carried the rearm.

The shipped graph now reads:

```
save.done      -> stored.run
stored.out-received -> res.pm-received      (a value, published only once the row exists)
stored.out-ready    -> mail.send            (in the chain, so the value cannot lose a race)
save.failure   -> res.send                  (unchanged — and it does not pass through `stored`)
res: parameters { params: 'received', 'pm-received': false }
```

The `false` is a **parameter** on the Response node rather than an unset port, so
the two paths answer with the same **shape** and a caller never has to tell `false`
from absent. A parameter and not a wire on purpose: SB-017 §11 measured that the
export copies parameters verbatim and the runtime registers the input on that path,
so it survives whatever happens to the node's dynamic port list.

Three files, at the level each belongs to:

- `noodl-runtime/test/sb-018-a-signal-into-a-value-port.test.ts` — **3 cases, 1
  mutant**. A signal output into a value input delivers `[true, false]`; the
  control is the same pair of nodes with a **value** output, which delivers
  `[true]`. Only the output's type varies.
- `noodl-viewer-cloud/tests/sb-018-received-is-the-outcome.test.ts` — **4 cases**.
  Through the Response node's own setter: an unset port gives `{"result":{}}`, a
  pulse gives `{"received": false}`, the fixed success path gives `true` and the
  fixed failure path still gives `false`.
- `noodl-editor/tests-unit/sb-018/the-contact-endpoint-answers-the-outcome.test.ts`
  — **6 cases, 1 mutant**. The shipped graph is the one those two describe, read
  by node **label** because the door remaps ids.

### 7.4 What this cost elsewhere, and what it did not

Four suites moved, each for a stated reason and none by relaxing an assertion:

- `tests-unit/sb-007/site-template.test.ts` — **193 → 194** node ids: the `stored`
  node.
- `nodegx-backend/tests/sb017-helper-is-lossless.test.ts` — **100 → 101**
  connections, with `submitContactForm`'s own count (20) asserted beside the total
  so a future move has to say which component made it.
- `tests-unit/sb-017/the-browser-half-drops-every-record-field.test.ts` — the
  census is **19**, expressed as s17's panel reading **minus** the two SB-018
  fixed, so a number that moves for any other reason still reddens.
- `tests/cloud/sb017-deploy-connection-parity.test.ts` — 🔴 **the one that needed
  care.** Two cases compared the current template and the current export against
  `fixtures/sb017-deployed-bundle.workflow.json`, a **frozen record of one deploy
  of an older template**, and asserted the shortfall was `[]`. A template that
  deliberately removes a wire silently changes what that question means: the
  fixture stops being a floor and becomes a claim about a graph that no longer
  exists. Both cases now assert the shortfall **equals** a named
  `REMOVED_BY_SB018` list of exactly two wires. That is an exemption list, not a
  relaxation — a wire that goes missing for any other reason reddens exactly as
  before, and so does one of these two coming back without the list being updated.

⚠️ **Not driven.** Every one of these is measured against the shipped artefact and
the real runtime modules; none of the three fixes has been seen in a running app.
The list refreshing after a publish, a blank heading on an unclaimed site, and
`{"received": true}` over real HTTP are all still predictions — well-founded ones,
but the drive is SB-017 acceptance 2's and it has not happened.
