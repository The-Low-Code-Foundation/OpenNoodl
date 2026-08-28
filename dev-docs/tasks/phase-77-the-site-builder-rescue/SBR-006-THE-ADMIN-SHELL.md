# SBR-006 — The admin shell

**Fixes finding 4 for the client-facing half.** Screen 2. Today the pages list is a heading,
two unlabelled inputs and rows of four buttons. It becomes a shell the other admin screens live
inside: sidebar, content table, dialog-based create.

## 1. The person sentence

**A client signing in sees their pages as a table with names, slugs and status — and can make a
new page from a dialog — without reading a manual.**

## 2. Scope

- **Sidebar** — brand, then Pages · Theme & settings · Messages, plus "View site". Today the
  theme editor is reachable only by a button at the bottom of the list. Build it as a reusable
  admin-shell component the other screens (SBR-007/009/010) instantiate.
- **Pages list as a content table** — name + slug per row, status as a pill (Published/Draft),
  Edit, and one overflow menu holding publish/unpublish/duplicate (four buttons per row is the
  current design).
- **Create in a dialog** — "New page" opens a form (title, slug); the two bare inputs above
  the list go away.
- Row count sentence ("Four pages, three published") — derived, cheap, and it proves the query.
- Everything styled from tokens.

## 3. Acceptance criteria

1. **(person)** The list screen reads: sidebar, page rows with pills, one primary action —
   driven with a real backend and ≥2 pages, screenshot plus DOM assertions.
2. **(person)** Creating a page through the dialog puts the new row in the list without a
   reload (the `itemOutputSignal-Changed` / `create.done` machinery from s19 keeps working —
   re-run its spec, don't trust it).
3. Publish/unpublish/duplicate work from the overflow menu; the row's pill updates.
4. "View site" opens the public site.
5. The admin-shell component is instantiated by ≥2 screens (no copy-paste shells) — and its
   `Component Inputs` interface actually parameterises the active item (the ghost of "renders
   identically however many times placed" from the MCP guidance).

## 4. Traps

- 🔴 The list-refresh wire is name-derived from the item component's ports
  (`itemOutputSignal-<name>`) — renaming a row output silently orphans it again. The s19 spec
  (`the-list-refreshes-when-a-row-changes.test.ts`) is the guard; keep it green through the
  restyle.
- Dialog/menu UI in the *viewer app* is NodeGX components — don't import editor-UI habits;
  check what the node library dialogs/popovers actually offer before inventing one.

---

## 5. Built and driven — s9 (2026-08-28)

Two new components (`/Admin/Shell`, `/Admin/NewPageDialog`), three rebuilt
(`/Admin/PageRow`, `/Pages/Admin`, `/Pages/ThemeEditor`'s root). Driven on
**`SBR-006 Admin Drive`**, a project minted by the real wizard from the
regenerated template, claimed through `/admin/setup` with a `SITE_SETUP_TOKEN`
written into the backend's `secrets.json` under `functions`.

### 5.1 What the mechanism check found before a line was authored

§4 says not to invent a dialog. The popup family is real and lives under
**Navigation**, not under any name containing "dialog": `NavigationShowPopup` /
`NavigationClosePopup`. Three things were measured rather than assumed:

- The viewer installs the popup layer **unconditionally in its constructor**
  (`viewer.jsx:174`), so a popup needs no Page Stack and works under a Router.
  ⚠️ `showPopup` opens `if (!this.onShowPopup) return;` (`nodecontext.ts:1166`) —
  a host without that layer drops popups silently, which is why the caller was
  checked and not the node.
- ✅ **The close results land and are flagged dirty BEFORE the close action
  fires** (`showpopup.ts:204-210`). That ordering is the difference between this
  and a repeat of SB-017 §11.1, and this phase has been bitten twice by a value
  that arrives after the signal that reads it.
- ⚠️ Two spellings, one mechanism: Close Popup takes `result-<name>` **inputs**,
  Show Popup publishes `closeResult-<name>` **outputs**.

### 5.2 🔴 The finding: the admin set had never been walked by the layout gate

`sb006PublicSite.test.ts`'s `findGrowingNodes` rule, applied to the shipped
artefact for the first time, reported **11 growing nodes across the admin
screens against 2 on the public site** — and both of those two are named,
legitimate exemptions. `/Admin/PageRow` alone had four: title, slug and status
each defaulted to `width: 100%` along the row, and the row itself to
`height: 100%` along the list's column, so the rows **divided the page between
them instead of stacking**. This is the defect SBR-004 had just fixed next door,
live and unwatched, because the gate's population was the public site only.

🔴 **And the hole the new gate nearly shipped with.** A walk that stops at a
component instance never reaches the screen bodies behind `Component Children`.
It graded **41 nodes instead of 61** and `/Admin/PageRow` **vanished from the
report** — which read as an improvement. *The report got quieter, not louder.*
The hop is now in the walk, and a mutant asserts the graded population shrinks
without it. The green arm asserts two node names, not a count, because a count is
exactly what the hole moved in the wrong direction.

Four growing nodes remain, in `ADMIN_LAYOUT_OWED` with the task that owns each —
a list separate from the exemptions, because an exemption list that absorbs
everything cannot fail. `Pages/Setup | Form` is deliberately untouched: that
screen's ACs are driven and passing, and changing its size mode without
re-driving it would be a blind edit to another task's verified work.

### 5.3 Two door refusals worth keeping

- `width: 240` is refused: **these ports read a bare number as a PERCENTAGE**, so
  it meant `240%` — a rail two and a half screens wide. The object form
  (`{value:240, unit:'px'}`) is the fix.
- **`Text` declares no `paddingTop`/`paddingBottom`/`paddingLeft` and no
  `borderRadius`** — all four came back `unknown-parameter`, "never read". A
  padded pill-shaped nav item on a bare `Text` is not authorable; it needs a
  wrapping `Group`. The current item is distinguished by colour and weight.

### 5.4 🔴 The spec was grading a population the panel never ships into

`sb005AdminPanel.test.ts` authored the admin set into an otherwise **empty**
project. The first component to refer outward — "View site" → `/Pages/Site` —
was refused with `unresolved-navigation`, and **all twenty of that file's other
assertions failed with it**. The dependency was invisible while nothing crossed
the set boundary. The spec now writes the public site first, exactly as
`buildSiteTemplateProject` does.

### 5.5 The drive, AC by AC

| AC | verdict | evidence |
|---|---|---|
| 1 sidebar + rows + one primary action | ✅ **on screen** | rail items **stack** at y=65/96/127 (31px apart), all `x=16 w=207` inside the 240px rail; heading `x=272` and `New page` `x=382` share one row |
| 2 dialog creates a row without a reload | 🟡 **mechanism yes, persistence no** | popup opens (`.noodl-popup` = 1), closes on create, row appears with **no reload**, and the count sentence moves to **"One page, no published"**. But the record stores **`title: None, slug: None`** |
| 3 menu actions, pill updates | ❌ **blocked, not by this task** | menu opens/closes correctly; both cloud functions **time out with no response** |
| 4 View site opens the public site | ❌ **defect found; fix authored, NOT driven** | landed on `location.pathname === "/%7Bslug%7D"` |
| 5 shell placed by ≥2 screens, interface carries something | ✅ **control pair** | see below |

**AC5, the control pair** — same component, two placements, and the renders swap:

| | `Pages` | `Theme & settings` |
|---|---|---|
| `/admin/pages` | `rgb(30,77,140)` / **600** | `rgb(27,26,23)` / 400 |
| `/admin/theme` | `rgb(27,26,23)` / 400 | `rgb(30,77,140)` / **600** |

`rgb(30,77,140)` is `--primary`. Nothing was poked; the sidebar link was clicked
and the router did the rest. This is the ghost the MCP guidance names — "renders
identically however many times you place it" — measured *not* to be happening.

**AC3's two mounted arms**, worth keeping: before the click the buttons in the
DOM were `[New page, Edit, More]`; after, `[…, Publish, Unpublish, Duplicate]`.
The three actions are **absent**, not hidden — the `mounted`-not-`visible` choice
SBR-004 paid for, verified rather than asserted.

### 5.6 🔴 SB-017 §11.1 reproduced, and now with a two-row discriminator

The dialog changes where the title and slug come from and **does not change the
outcome**, because the drop is about `prop-*` being wire-only. After the drive
the one `Page` table holds two rows written by the two different halves:

| row | written by | `title` | `slug` |
|---|---|---|---|
| `0826ed8b` | the dialog (browser `prop-*` **wires**) | `None` | `None` |
| `0e65ab90` | `duplicatePage` (**cloud**) | `Copy of Untitled` | `page-copy-np3ui4` |

Same table, same columns, one written by each half. The three `prop-*` set as
**parameters** (`published`, `showInNav`, `navOrder`) arrived on both. **SBR-008
blocks AC2's second half**, and this is the cleanest evidence the phase has for it.

### 5.7 🔴 Both row-action cloud functions never respond — and they do not agree

| function | status | duration | effect on the record |
|---|---|---|---|
| `claimSite` | success | **29 ms** | wrote both singletons |
| `publishPage` | error | 30004 ms | **nothing** — `published` still `0`, `updatedAt` unchanged |
| `duplicatePage` | error | 30010 ms | **the copy WAS created** |

`Cloud function "…" did not send a response within 30000ms`, from the backend's
own `executions.sqlite`. `claimSite` on the same backend in the same session
succeeds in 29ms, so this is neither the mechanism nor this task's wiring — the
call arrived with the right arguments (`{"publish":true,"pageId":"0826ed8b…"}`).

🔴 **The two disagree**, which is the part a single reading would have missed:
duplicate did its work and stayed silent, publish did nothing and stayed silent.
"Times out" is one symptom over at least two causes. **This needs a task and an
owner** — it is not SBR-006's, and AC3 cannot pass until it is fixed.

### 5.8 🔴 A refused query and an empty collection are the same screen

On a cold load with no session the page list renders the shell, the heading and
`New page` — **and nothing else**: no rows, and no row-count sentence, because
`count` runs on `pages.fetched` and a refused query never fires it. There is no
"no pages yet", no "you are not signed in". The two states are pixel-identical
and their fixes are opposite. Recorded here because AC1's person sentence is
about a screen that *reads* as something, and on that path it reads as broken.

### 5.9 Owed

- **AC4's fix is not driven.** `pm-slug: ''` is authored, regenerated and gated,
  but the running editor holds the project in memory so an on-disk patch never
  reached the viewer. Verifying it needs a project minted from the regenerated
  template. The repro is exact: click View site, expect `/`, the bug is `/{slug}`.
- **AC1 was driven with one page, not ≥2** — the second row arrived only as
  `duplicatePage`'s untitled copy. Re-drive once SBR-008 lands, when rows have
  titles and slugs to show.
- **AC2 and AC3 cannot close** on SBR-008 and §5.7 respectively.
- `test:ci` still owed from s8.
