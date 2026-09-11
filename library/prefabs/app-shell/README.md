# App Shell

The frame an app lives inside: a fixed **sidebar** (app name + navigation), a
**top bar** (page title, actions, user area), and a **content outlet** where
your pages render. Drop it at the root of your app and put a Page Router inside
the outlet — every page then shares the same chrome.

```
┌────────────┬──────────────────────────────────────┐
│ ◆ My App   │ Page Title        [actions]  ⊙ user  │
├────────────┼──────────────────────────────────────┤
│ • Home     │                                      │
│ • Projects │           Content outlet             │
│ • Settings │        (your Page Router here)       │
│            │                                      │
└────────────┴──────────────────────────────────────┘
```

## The content outlet — where your pages go

Inside the **App Shell** component, the main column's last child is a Group
labelled **Content outlet**. It contains a placeholder Text node:

1. Open the **App Shell** component after importing.
2. Delete the **Content placeholder** Text node.
3. Place a **Page Router** node inside the **Content outlet** Group (or any
   content, if you are not using routing).

The outlet flexes to fill everything under the top bar (`flex: 1 1 0%;
min-height: 0;`), so pages get the full remaining area and can scroll
internally.

## Navigation items

Nav items are plain data: an array of objects with `Label`, `Icon` (a
[Material Icons](https://fonts.google.com/icons?selected=Material+Icons) code,
optional), `Target` (the URL path to navigate to) and optionally
`IsHome: true` for the item that should light up on `/`.

Out of the box the items come from the **Default nav items** Static Data node
inside the component — edit its JSON to change the menu. Alternatively, connect
your own array (from a Function, Variable, or records) to the **Nav Items**
input; a non-empty connected array wins over the Static Data defaults.

Clicking an item:

- navigates to its `Target` via a Navigate To Path node,
- closes the mobile menu (if open),
- emits the **Nav Click** signal and the **Nav Target** value, in case you want
  to drive your own navigation or analytics.

**Active-route highlighting** is automatic: the shell tracks
`location.pathname` and marks the item whose `Target` is a prefix of the
current path (the `IsHome` item matches `/`). The active item renders in
`var(--primary)`.

## Responsive collapse

Below the breakpoint (default **768px**, override via the **Collapse Below**
input) the sidebar unmounts and a hamburger button appears in the top bar.
The hamburger toggles the sidebar; choosing a nav item closes it again.
At the collapsed width the sidebar re-mounts **in flow** (pushing content)
rather than as an overlay — restyle the Sidebar group (e.g. `position:
absolute`) if you prefer an overlay drawer.

## Inputs

| Port | Type | Meaning |
|---|---|---|
| `App Name` | string | Sidebar header label. Defaults to "My App" |
| `Page Title` | string | Top bar title. Defaults to "Page Title" |
| `Nav Items` | array | Overrides the Static Data defaults when non-empty (shape above) |
| `Collapse Below` | number | Viewport width in px under which the sidebar collapses. Defaults to 768 |

All inputs are optional — unconnected inputs keep the defaults.

## Outputs

| Port | Type | Fires when |
|---|---|---|
| `Nav Click` | signal | A nav item was clicked |
| `Nav Target` | value | The clicked item's `Target` path |

## Slots to fill in after import

- **Actions slot** (top bar): an empty Group — drop buttons/icons for
  page-level actions into it.
- **User area** (top bar): a placeholder icon + "Signed in" text — replace with
  your real user menu/avatar.
- **App logo** (sidebar header): a placeholder Material icon — swap for your
  logo image.

## Styling

Everything is design-token driven so the shell picks up your project's theme:
`var(--background)`, `var(--surface-raised)` (sidebar), `var(--border)`,
`var(--foreground)`, `var(--muted-foreground)`, `var(--muted)` (hover),
`var(--primary)` (active item). Titles use the shipped Inter Medium font.

Layout note: the sidebar is pinned with `min-width` and `flex: 0 0 auto`, and
the main column uses `flex: 1 1 0%; min-width: 0` — flex items refuse to shrink
below their content's min-width without that, which is what usually breaks
shells at narrow widths. Keep those if you restyle.
