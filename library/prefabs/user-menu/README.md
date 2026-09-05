# User Menu

The avatar button in the top-right corner. Click it, the account menu opens;
click anywhere else, it closes.

```
                                    ┌──────────────────────────┐
  (AM) Alexandra Morgan  ˅          │ Alexandra Morgan         │
       alexandra.morgan@…           │ alexandra.morgan@exampl… │
                                    ├──────────────────────────┤
                                    │ 👤  Your profile         │
                                    │ ⚙   Account settings     │
                                    │ 💳  Billing              │
                                    │ 🔔  Notifications        │
                                    ├──────────────────────────┤
                                    │ ⏻   Sign out             │
                                    └──────────────────────────┘
```

Out of the box it draws a sample person and four sample items, so it shows what
it is the moment you place it. Connect anything and yours wins.

| Input | What it does |
|---|---|
| `Name` | `"Ada Lovelace"` → **AL**, `"ada.lovelace"` → **AL**, `"Ada"` → **AD**, empty → **?** |
| `Email` | Shown under the name, in the button and at the top of the menu. Hidden when empty. |
| `Avatar` | Photo URL or project asset path. Empty falls back to the initials. |
| `Items` | Array of `{ Label, Icon }`. `Icon` is a bare Lucide name — `"credit-card"`, not an icon object. |
| `Sign Out Label` | Defaults to "Sign out". |
| `Show Details` | Name and email beside the avatar in the button. On by default; turn it off for an avatar-only button. |

| Output | When |
|---|---|
| `Opened` | Boolean, true while the menu is open. |
| `Item Clicked` | An item was clicked. Fires once, **before** the menu closes. |
| `Clicked Label` | That item's `Label`. |
| `Clicked Item Id` | That item's repeater id. |
| `Sign Out` | Sign out was clicked. Once. |

**The person is all-or-nothing.** The moment any one of `Name`, `Email` or
`Avatar` arrives with a value, the sample person is gone entirely. Falling back
field by field would have left the sample's *photo* attached to your user's
*name* while you were half way through wiring it up, which reads as a bug in
the prefab rather than as an unfinished graph.

## Wiring it to Auth Pages

This is the other half of `auth-pages`. Two connections:

```
User Menu.Sign Out ──> Log Out.Do
Log Out.Done       ──> Router Navigate ──> /Auth Pages/Sign In
```

The prefab does **not** ship the `Log Out` node itself. Signing out is a POST
to your backend, and a component library entry that fires one the first time
anybody clicks it — in a drive, in a preview, on a project with no cloud
services configured — is a component that does something on your behalf that
you did not ask for. `Sign Out` is a signal; you decide what it means. Same
contract as `Stepper`, which publishes `Current Step` rather than owning your
step content.

For the person, wire the `User` node's outputs at `Name`, `Email` and `Avatar`.

## The open/close state, and why it is boot-safe

`Switch` (`Menu open?`) holds it. Three wires:

```
Trigger.onClick   ──> Switch.Flip
Scrim.onClick     ──> Switch.Off
Item.Clicked      ──> Switch.Off      (and Sign out row.onClick ──> Switch.Off)
Switch.state      ──> Menu.mounted, Scrim.mounted, Opened
```

**Why not a Function that remembers a boolean.** Because that is the bug the
`accordion` entry shipped and had to measure its way out of: a Function that
flips `Outputs.IsOpen` has to know whether it has ever run, and with no input
that ever arrives it has *not* — so the first click is silently consumed as the
missing boot run and the menu needs two clicks to open. `Switch` is a runtime
node, not a Function: its `initialize()` sets the state to `false` before
anything is rendered, so there is a real answer in it before anybody touches it
and no click is ever spent on a boot run. `Menu` and `Scrim` also carry
`mounted: false` as a *parameter*, so the menu is closed at load whether or not
the Switch publishes its state before the first change.

Accordion's Counter was the right answer *there* — one node, one toggle. Here
there are three ways to close and only one to open, and a click count cannot
express that: after closing by clicking outside, the count's parity still says
"open", so the next click on the avatar computes closed and does nothing. A
state machine can express it and a parity count cannot, so this is a Switch.

**The scrim covers the trigger too, and that is deliberate.** `Scrim` is
`position: fixed`, full-viewport, `zIndex: 40`; `Menu` is `zIndex: 50`; the
trigger has no `zIndex` at all. So while the menu is open the trigger is *under*
the scrim and its `onClick` cannot fire — clicking the avatar again closes the
menu through `Off`, not through `Flip`. That makes closing idempotent: every
close in this component goes through the same input, and `Flip` only ever runs
the closed → open transition it cannot get wrong. It also removes the classic
dropdown bug where the scrim closes and the button reopens in the same click,
because only one element can be the target of one click and the two are not
ancestor and descendant.

**Connection order is load-bearing.** In `project.json` the two connections that
report a click come *before* the one that closes the menu:

```
For Each.itemOutput-Label       ──> Clicked Label
For Each.itemActionItemId       ──> Clicked Item Id
For Each.itemOutputSignal-Clicked ──> Item Clicked      ← report
For Each.itemOutputSignal-Clicked ──> Switch.Off        ← then close
```

Closing unmounts the `For Each` that is doing the reporting. Same for the sign
out row. Reordering these looks harmless and is not.

## The icons are stamped in one place

An item row carries a bare name — `{ "Label": "Billing", "Icon": "credit-card" }` —
and the `Choose items` Function turns it into the icon source object. A Lucide
source is **three** fields:

```js
{ class: 'lucide', code: 'icon-credit-card', codeAsClass: true }
```

Leave `codeAsClass` out and the glyph's *name* renders as visible text. That
shipped on this shelf for six weeks. Building the object centrally means a row
cannot be written wrong, and a caller never has to know the shape — the same
reason `Avatar Group` stamps `Overlap` onto each row rather than asking for it.

## The avatar is inlined on purpose — and what to replace when that changes

The circle in the button is this entry's own `Group "Avatar"` subtree, not an
instance of the `avatar` prefab, even though `scripts/library/schema.json` now
has a `dependencies` field that would install `avatar` alongside this entry in
the same click. This entry deliberately does **not** declare one yet.

**The blocker is the render gate, not the installer.** `scripts/library/build.js`
resolves `dependencies` and the editor's `ModuleLibraryModel._installWithDependencies`
consumes the resolved list — that half works. But `scripts/library/render-check.js`
`checkEntry()` builds its scratch project from `readComponents(entry.dir/project)`
plus its own harness components and nothing else; `grep -an dependencies
render-check.js` returns zero hits. So under the render gate a dependency's
components are simply not there, and an unresolved component type is not a
silent blank — `packages/noodl-runtime/src/noderegister.ts:75` and `:83` throw
`Unknown node type with name /Avatar`. An entry that declares the dependency and
places an `/Avatar` instance installs correctly and cannot be rendered or driven
by the shelf's own gate, which means it cannot be verified before it is
published.

**To switch it over, once render-check loads resolved dependencies:**

1. add `"dependencies": ["prefabs/avatar"]` to `library.json`;
2. in `project/project.json`, component `/User Menu`, replace the single node
   `05e40000-1000-4000-9000-000000000012` (`Group`, label **"Avatar"**) and its
   two children — `…013` (`Image` "Photo") and `…014` (`Text` "Initials") — with
   one node of type `/Avatar`;
3. repoint the four connections that currently land on those children —
   `out-Avatar → …013.src`, `out-HasImage → …013.mounted`,
   `out-NoImage → …014.mounted`, `out-Initials → …014.text` — at the instance's
   `Image` and `Name` inputs instead, and set its `Size` to `36`;
4. drop `HasImage`, `NoImage` and `Initials` from the `Choose user` Function,
   which exists only to feed them.

Everything else — the Switch, the scrim, the panel, the For Each — is untouched
by that change. The initials rule in `Choose user` is deliberately the same rule
`avatar` uses, so a project holding both never shows one person two ways.

## Two more things worth knowing before you change it

**The menu is right-aligned to the button.** `Menu` is `position: absolute` with
`alignX: "right"`, because that is where this component lives — the top-right of
a header, opening leftward. The render harness places the showcase at the *left*
edge of the page instead, so the panel's left edge sits close to x=0 there; with
the default sample person the button is wider than the 220px panel and it stays
on screen. Turn `Show Details` off and the button narrows to about 78px, so in
the harness — and only in the harness — the panel would hang off the left edge.
That is a fact about where the harness puts the component, not about the
component. Set `alignX: "left"` if you are placing it on the *left* of a header.

**`position: fixed` degrades, it does not break.** An ancestor with a `transform`
turns a fixed element into an absolute one. If a page transition ever puts a
transform above this component, the scrim stops covering the viewport and covers
the page instead — clicks outside the menu but inside the page still close it,
which is the case that matters.
