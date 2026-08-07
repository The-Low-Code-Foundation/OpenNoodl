# SPR-003: What the Ports tab claims

| Field | Value |
|-------|-------|
| **ID** | SPR-003 |
| **Phase** | 42bis — The alpha driving sprint |
| **Tier** | 1 — blocks the alpha |
| **Findings** | F82, F92, F93, F94 |
| **Measured** | 2026-08-06 against `91fcd680` |
| **Branch** | commit directly to `cline-dev` |

## Objective

The Ports tab is new and it is good. It currently tells the user something false about
139 ports, and three smaller layout defects make the true part hard to read.

**Do F82 first.** It is one condition, and it is the only correctness bug here.

## §1 — F82: the tab lists ports the canvas refuses to connect 🔴

**Richard:**

> *"On the ports panel, it's listing 'ports' that aren't actually ports but are
> properties in the props panel that don't expose ports, like … the string node has stuff
> like 'Treat unchanged as' as a port, when actually it's not in the port menu for that
> node, but it is a property in the props panel"*

**Confirmed, with the exact mechanism.** Two lists are built from the same
`model.getPorts(direction)` and differ by one filter:

**The canvas connection popup** — `views/ConnectionPopup/components/ConnectionBar.tsx:18-20`:

```js
function isConnectable(p) {
  return !(typeof p.type === 'object' && p.type.allowEditOnly);
}
```

**The Ports tab** — `views/panels/propertyeditor/components/PortsTab/PortsTab.tsx:71-76`:
applies `applyPortConditionsFilterForNode(model)` and **nothing else**. `allowEditOnly`
is never consulted.

So a port declared `allowEditOnly` — meaning *"this is a setting, it may not be
wired"* — is absent from the connection popup and present in the Ports tab. That is
exactly what Richard saw.

**The two ports in his screenshot, at file:line:**

| Port | Declared | Marked |
|---|---|---|
| `Treat Unchanged as` | `noodl-runtime/src/outcome.ts:243-245` | `type: { name: 'enum', enums, allowEditOnly: true }` |
| `Run On Value Change → Value` | `noodl-runtime/src/run-on-value-change.ts:131` | `type: { name: 'boolean', allowEditOnly: true }` |

`run-on-value-change.ts:66` states the intent in its own words: marked `allowEditOnly`
**"so it cannot be wired"**.

**Blast radius: 139 declarations** across `noodl-runtime` and `noodl-viewer-react`
(measured 2026-08-06 — `grep -rn "allowEditOnly" packages/noodl-runtime/src
packages/noodl-viewer-react/src | wc -l`; **file the date and this command if you
re-quote the number**). They concentrate in exactly the nodes a beginner meets first:
Variables, Expression, Logic Builder, the whole `data/` family, `simplejavascript`,
`runtasks`.

### The fix, and the judgement call inside it

Mechanically: apply `isConnectable` in `buildRows`. But the tab's own docstring
(`PortsTab.tsx:16-29`) says it deliberately shows *"Every port on this node, whether or
not it has a property"*, and that intent is good — it is why the tab is useful. So:

- **Do not** simply delete the rows. An `allowEditOnly` port is real, it is just not
  connectable.
- **Do** stop them reading as connectable. Either a separate section, or a per-row
  marker that says *setting — not connectable*. The tab already renders a type label
  and a connections list per row, so it has somewhere to put it.

⚠️ **A second, subtler divergence in the same two functions — check it while you are
here.** The popup calls `applyPortConditionsFilterForNode(model, ['extended'])`; the tab
calls it with no second argument. Those are different filter scopes and they will
disagree about conditional ports. Whichever is right, **both lists should ask the same
question**, and the honest fix is one shared helper rather than a third copy of the
predicate. `PortsTab.tsx:29` already states the goal — *"so the two tabs agree about
what the node's ports are"* — and it is currently not met.

**Write the test before the fix.** A String node's rows must not include
`Treat Unchanged as` as connectable, and the connection popup and the Ports tab must
agree on the connectable set for a sample of nodes across the 139.

## §2 — F92: the tab labels are not centred

**Richard:**

> *"the properties label has less spacing at the right than the left. You need to make
> the tab widths bigger so properties is centred, not overflowing X"*

Visible in his screenshot: `Properties` sits hard against the right edge of its tab
while the left edge has padding. The tab is sized to something narrower than its label.
Cosmetic, one rule, but it is the first thing the eye lands on in the panel.

Fix in the Ports/Properties tab styles under
`views/panels/propertyeditor/components/`. Check **both themes** and the narrow-panel
case — the property panel is resizable and this is a squeeze artefact.

## §3 — F93: port name and type collide

**Richard:**

> *"the name of the port and the type shouldn't be responsively on the same line, as you
> can see in the screenshot they squish each other sometimes. Make them on two lines
> please"*

In his screenshot the String node's `Treat empty as` renders one character per line down
the left while `enum: Null (default), Empty string ("")` takes the width beside it —
the name has been squeezed to nothing.

`PortsTab.tsx` already trims long enum labels (`MAX_ENUM_VALUES`, `:60-68`) *"because a
font-weight enum is longer than the row it sits in"* — the row was known to be tight and
the mitigation was applied to the wrong side. **Stack them: name on one line, type
label beneath.** That also removes the need for the trimming, so check whether
`MAX_ENUM_VALUES` should relax once the layout changes.

## §4 — F94: the port explainer popup is occluded

**Richard:**

> *"The little port explainer popup thing that appears when you hover a port in the node
> port menu when connecting two ports is very cool, but it very easily gets hidden behind
> other stuff. I think it'll be a tricky one to place correctly without messing up the
> layout."*

His screenshot shows the `Changed` explainer rendering **behind and to the left of** the
STEP 1 list, clipped by the panel edge, with its text running under the components panel.

He is right that it is tricky — and this repo has the answer written down already.
`dev-docs` records the `DialogLayer` mechanism and the trap that goes with it:
**`DialogLayer` does not centre; `CoreBaseDialog` does** (see the launcher settings
notes). Whatever the explainer currently renders into, the fix is almost certainly to
portal it to the dialog layer and flip its side when it would leave the viewport, rather
than to fight z-index in place.

Do this one **last** — it is the only one of the four with real design risk, and the
other three are cheap.

## Acceptance criteria

1. No `allowEditOnly` port reads as connectable in the Ports tab, and the two lists ask
   the same question through one shared helper.
2. A regression test covering both the String node case and a cross-node sample.
3. Tab labels centred; name and type on separate lines; both checked in **both themes**
   and at a narrow panel width.
4. The explainer popup stays fully visible when a port near a panel edge is hovered.
5. All four **driven in a real editor**. Every one of these is a thing you can only see.

## What would make this task fail

Deleting the `allowEditOnly` rows. The tab exists to show every port, and a beginner
needs to know `Treat Unchanged as` exists — they need to know they cannot *wire* it.
Removing the row trades a false statement for a missing one.
