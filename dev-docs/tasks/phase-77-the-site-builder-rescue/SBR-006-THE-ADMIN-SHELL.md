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

- ✅ **AC4's fix is now driven — s12, 2026-08-29.** On a project minted from the
  regenerated template, clicking `View site` in the shell lands on
  `location.pathname === "/"`. Not `/%7Bslug%7D`. **AC4 passes.**
- **AC1 was driven with one page, not ≥2** — the second row arrived only as
  `duplicatePage`'s untitled copy. s12 drove it with **two** rows created through
  the dialog and the list rendered both, but the rows still carry no title or
  slug (SBR-008), so the "names, slugs and status" half of the person sentence
  is still unverifiable. Re-drive once SBR-008 lands.
- **AC2** still cannot close on SBR-008.
- 🔴 **s16: AC1/AC2 do NOT unblock on s15's observation.** s15 read a `Page` row carrying `title`
  and `slug` and recorded, carefully, that this was an observation and not a closure. Re-measured:
  the fixture that produced it is identical to s14's on every static axis, and the filter that
  drops these wires reads a debounced store nothing forces to settle — so a named row and a
  nameless one are both what the mechanism produces (**SBR-008 §5**, **D13**). §5.6's two-row
  table stands as evidence; what it is evidence *of* has changed.
  ✅ **s17: AC1 IS MET — driven with three rows.** On `SBR-016 Arrive Drive`, two further pages
  were created through the dialog (`Arm A Early Build`/`arm-a-early` at 12:20:36Z,
  `Arm B Settled Build`/`arm-b-settled` at 12:22:26Z, both confirmed in the backend's `Page` table).
  The list renders **three rows with their names, slugs and status** — `About us / about / Draft`,
  `Arm A Early Build / arm-a-early / Draft`, `Arm B Settled Build / arm-b-settled / Draft` — under
  the sentence **`Three pages, no published`**. That is the whole person sentence: more than one
  page, each with its name, slug and status. **The blocker was the rows arriving nameless; they no
  longer do on this fixture**, because its `Page` class has now been written to and the columns mint
  the ports (SBR-008 §6.3).
  ✅ **Screenshot and DOM both taken**, as AC1 asks: `notes/sbr006-ac1-three-pages.png` shows the
  sidebar (`Site admin` / `Pages` / `Theme & settings` / `Messages` / `View site` / `Sign out`),
  the three rows each with a `Draft` **pill**, and the one primary action `New page`.
  ⚠️ **Correction to the standing drive note**: `npm run cdp -- screenshot --target=viewer` did
  **not** hang — it returned a real 988×313 PNG in ~10 s. The prompt has carried "it hangs" since
  s14; on this stack it works.
  ⚠️ **AC2 does not come with it.** AC2 is about the deployed panel, and the reason these rows are
  named is a property of *this fixture's grown schema*, not a fix — on a fresh site the same act
  still produces a nameless row. **AC1 is met on its own terms; AC2 stays blocked on SBR-008.**
- 🟡 **AC3 is unblocked and half-driven.** SBR-015's drive answered §5.7 (see
  `SBR-015 §2.3a`): publish now answers in 19 ms rather than hanging 30 s.
  Through the UI, a **successful** publish closes the menu at 211 ms and flips
  the pill to `Published` with the count sentence following — AC3's second half,
  driven. Its first half fails: a **refused** publish still shows the admin
  nothing, because `/Admin/PageRow`'s cloud-function nodes have no `failure`
  wire. That is SBR-015 AC1, not this task.
- `test:ci` still owed from s8.

### 5.10 🔴 s12: the page list issues no query when you arrive at it

Separate from §5.8, and sharper. Arriving at `/admin/pages` — cold load *or*
navigation from the public site — renders the shell, the heading and `New page`
and **nothing else**, while `GET /classes/Page` with that same session returns
both rows. Not a refused query: **no query**.

Measured, with the control beside it:
`performance.getEntriesByType('resource')` after the load lists **0 requests to
`:8597`** and **5 to `:8574`** (the bundle, the fonts, the icons) — so the
instrument records requests and there were none to the backend.

The rows only ever appear after `create.done` or a row's `Changed` signal fires
`pages-2.storageFetch`. §5.8's *"a refused query and an empty collection are the
same screen"* is true and is a third state: **a collection that never asked** is
pixel-identical to both. Owner: **NONE** — carried to phase 80.

---

## 5.11 🟢 s19 (2026-08-29) — **AC2 is MET**, on a site whose `Page` class has no `title` column

AC2 has been blocked since s9 for one reason: the dialog wrote a row with
`title: None, slug: None`. SBR-008's fix landed at `a14fb8e7`; this is that fix
arriving at *this* task, driven on the one fixture where the reading cannot be an
artefact of a grown schema.

### 5.11.1 Why `SBR-017 Sign In Drive` and not a fresh mint

🔴 **s17's warning was the design constraint**: the rows were named on
`SBR-016 Arrive Drive` *because that fixture's `Page` class had already been
written to* — SBR-008 §6.3's self-healing, where `SchemaHandler` fetches the
schema on `window-focused` and `recordFieldPorts` mints a port per **column**. A
drive on a grown fixture cannot tell the fix from the healing.

`SBR-017 Sign In Drive` (`backend_mte82r1qhnr87`, port 8599) was left deliberately
unspent, and its `Page` class is a photograph of the defect:

| on `/Pages/Admin` → `Create a draft page` (`NewDbModelProperties`, class `Page`) | column in the fixture? |
|---|---|
| `prop-published`, `prop-showInNav`, `prop-navOrder` — arrive as **parameters** | ✅ all three exist |
| `prop-title`, `prop-slug` — arrive as **wires** | 🔴 neither exists |

The export copies parameters verbatim and filters wires, so **the table records
which half survived**. That split is also what excludes the confound: with no
`title` column, the schema path *cannot* mint `prop-title`. Only the wire can.

### 5.11.2 The four-cell control, one node, one call

`/Pages/Admin` node `a9988e3f-…`, `node.getPort(...)`:

| port | column? | wired **here**? | `getPort` |
|---|---|---|---|
| `prop-title` | **no** | **yes** | ✅ **TRUE** ← the fix |
| `prop-slug` | **no** | **yes** | ✅ **TRUE** ← the fix |
| `prop-published` / `prop-showInNav` / `prop-navOrder` | yes | no (parameters) | ✅ TRUE |
| `prop-seoDescription` | no | **no** (it is wired on `/Pages/PageEditor`) | 🔴 **false** |
| `prop-neverWiredNoColumn` | no | no | 🔴 **false** |

✅ **`prop-seoDescription` is the better of the two negative controls** and is worth
keeping: it is a *real field of this template's `Page` model*, wired on another
component, and this node still says **false**. So the port set is **per-node and
wire-derived** — not "every `prop-` name the project mentions". A `getPort` that
had started saying yes to everything is excluded twice, once by a name that does
not exist and once by a name that does.

With `evaluateHealth()` forced (D13 held constant, per §6.5 of SBR-008), the
export keeps **336 of 336** connections project-wide, `/Pages/Admin` **10/10**
with **2/2** `prop-` wires.

⚠️ **336/336 on its own proves nothing** — it is equally what an inert filter
produces. It is the two `false` cells above, taken through the same instrument in
the same call, that make the 336 mean something.

### 5.11.3 The act, and what the backend says

One dialog, one `Create page`, title `S19 Wire Is The Declaration`, slug
`s19-wire-declaration`:

| | reading |
|---|---|
| **pre-state 14:03:01Z** | `Page` = 7 columns, **no `title`, no `slug`**; `_Schema.Page` `10:28:24`; 1 row |
| **post-state 14:03:42Z** | `Page` = 9 columns — **`title` and `slug` created by that act**; `_Schema.Page` → **14:03:07**, the second of the create |
| **controls, same DB, same moment** | `SiteSettings` `10:28:00`, `Theme` `10:28:00`, `_User` `10:27:59` — **unchanged** |
| **no reload** | `window.__S19` set before the click, still set after |

```
objectId  | title                       | slug                 | createdAt
7cb644bb… |                             |                      | 10:28:24.920Z   ← s14's build
086848fa… | S19 Wire Is The Declaration | s19-wire-declaration | 14:03:07.857Z   ← s19's build
```

✅ **The before/after sits in one table, and then renders in one list.** Same
project, same dialog, same node, same backend, same row component — the only
variable is which build wrote the row. `notes/sbr006-ac2-named-row.png` shows it:
the top row blank where its name and slug belong, the bottom row named, under
**"Two pages, no published"**.

✅ **AC2 is met.** The row appears without a reload *and* it has a name.

⚠️ **The two rows differ in wall-clock as well as in build**, so this is a
before/after pair rather than a two-arm control. What removes the alternative
reading is not the pairing but §5.11.1: the schema path had no column to mint from
at 14:03:01, measured, not argued.

---

## 5.12 🔴 s19 — AC3's other two actions cannot be driven: **both cloud functions throw at their first node**

AC3 was `🟡 half-driven` — publish's success arm at s12. Unpublish and duplicate
were never driven, and they still cannot be. On this fixture, through the menu:

| action | UI | backend |
|---|---|---|
| Publish | `This page could not be published.` in **71 ms** | `error`, HTTP 400, **59 ms** |
| Duplicate | `This page could not be duplicated. A partial copy may exist.` in **35 ms** | `error`, HTTP 400, **13 ms**, and `Page` really is unchanged (2 rows before, 2 after) |
| `claimSite` | — | ✅ **success, 39 ms** — the control, same backend |

✅ **The refusals are visible and fast, which is SBR-015's fix working**: the old
behaviour was a silent 30 s 504. The template says the right thing. What it says
is that the action failed.

### 5.12.1 The cause, named — and it is only nameable because of DEF-004(a)

`execution_steps` on `backend_mte82r1qhnr87` (written per action since
`d229bf4b`):

```
exec_…u8ug0w2op  duplicatePage  JavaScriptFunction  error
    function/script-threw: The script threw: Outputs.ready is not a function
exec_…8xls7gh82  publishPage    JavaScriptFunction  error
    function/script-threw: The script threw: Outputs.ready is not a function
```

Both are the **first** node in their chain — the gate that holds the request until
its parameters arrive — so nothing downstream ran.

🔴 **SBR-006 s9 and SBR-015 both looked straight at this and could not see it.**
The same failure was an opaque HTTP 400 with **zero** steps. DEF-004(a) is what
turned "publish does not work" into a file, a node and a message. That is the row
paying for itself within a day.

🔴 **And it refutes a recorded refutation.** SBR-015 s10 listed four candidate
causes and marked the first REFUTED: *"undeclared signal ports — the artefact
declares all six."* Measured on the shipped artefact at HEAD:

```
18 Function nodes call a signal output (Outputs.x())
 0 of them declare it in `scriptOutputs`
```

Not six of six declared — **eighteen of eighteen undeclared**, `claimSite`
included. The refutation was about a different field from the one that decides.

### 5.12.2 🔴 What I could NOT establish, and the experiment that would

`publishPage` **succeeded in 12 ms** at `09:26:44Z` on `SBR-015 AC1 Drive`. So
"undeclared ⇒ throws" is **not** the whole story, and neither is the 18/18 census
above: `claimSite` is in it and works.

Two variables sit between that success and my failure, and **I eliminated
neither**:

1. **The cloud runtime.** `d229bf4b` (12:10Z) is the only commit today touching
   `packages/nodegx-backend/src`. The backend process serving the 09:26 success
   predates it; mine (pid 78333, started 13:48Z) postdates it. I did **not** run
   the pre-commit runtime, so this is a timing coincidence, not a mechanism —
   and the `node.ts` diff adds step recording, it does not touch how `Outputs.x`
   is built.
2. **The project.** 🔴 **I diffed the two projects' `publishPage`, found them
   byte-identical bar node ids, and wrongly concluded the project was constant.**
   Both files had been rewritten *after* the 09:26 success (mtimes 11:17 and
   12:13) — they match each other because **both were equally migrated**, not
   because neither was. The artefact's gate node carries **only** `functionScript`;
   the project's carries `runOnChange-in-pageId: false` and
   `runOnChange-in-isPublic: false`, added on open. That is D5/D11's NDA-017
   migration writing to the very node that now throws.

⚠️ **A `diff` between two mutated copies is not a control.** Both had passed
through the same mutation, so it measured that they were mutated *alike* — which
is the one thing it could not fail to find.

✅ **The experiment that separates them**, for whoever takes this: mint a project
and **never open it**, then call `publishPage` against a backend built from a
commit *before* `d229bf4b`. Vary one, then the other.

⚠️ **`_updatePorts` builds output ports from `scriptOutputs` *and* from
`_parseScriptForErrorsAndPorts` over the script text** (`simplejavascript.ts:781`).
I first read only the `scriptOutputs` branch and claimed there was no script
derivation; there is. Whether that parser types `Outputs.x()` as a **signal** is
the open question, and `simplejavascript.ts` itself has not moved since 08-12.

**AC3 stays ❌ for unpublish and duplicate, and it is not this task's to fix.**
Filed as **D14**.
