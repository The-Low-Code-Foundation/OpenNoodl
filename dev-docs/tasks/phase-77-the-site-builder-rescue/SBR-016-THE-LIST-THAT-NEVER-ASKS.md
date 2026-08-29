# SBR-016 — The list that never asks

> 🟢 **FIXED AND DRIVEN, 2026-08-29 (s15).** All four acceptance criteria are met — §7 has the
> cause, §8 the drive. **The cause was not a missing wire.** The page list was authored to fetch at
> load, deliberately and with a comment saying so; the NDA-017 back-compat migration writes
> `runOnChange-collectionName: false` into it on **every project load**, because its `storageFetch`
> happens to be wired. The gate that guarded this was green throughout, because it reads the
> parameters the door wrote and the runtime reads the parameters the migration left. **A second
> instance was found by checking rather than assuming**: `/Pages/PageEditor`'s section list had the
> same defect through `runOnChange-qp-pageId`.

**Found by SBR-015's drive (s12, 2026-08-29), which could not own it.** Arriving at
`/admin/pages` renders the shell, the heading and `New page` — and no rows, no count
sentence — while the same session can read both pages over HTTP. The collection does not
ask. Not once.

## 1. The person sentence

**An admin who opens the admin panel sees their pages.** Today they see an empty screen
that reads as "you have no pages", and the only way to make the list appear is to create
another page.

## 2. The evidence

Two pages exist in the backend, one of them published:

```
GET /classes/Page   (admin session token)  → 200, results: 2
```

The screen, immediately after loading `/admin/pages`:

```
Site admin · Pages · Theme & settings · Messages · View site · Pages · New page
```

Nothing else. No rows. No `countLine` sentence — `countLine` is empty, not "No pages".

🔴 **It is not a refused query. There is no query.** Measured in the viewer after the load,
with the control beside it:

| `performance.getEntriesByType('resource')` | count |
|---|---|
| requests to `:8597` (the backend) | **0** |
| requests to `:8574` (bundle, fonts, icons) | **5** |

So the instrument records requests, and the backend was never contacted. Reproduced twice:
on a hard reload of `/admin/pages`, and on an in-app navigation from the public site back
to `/admin/pages`.

### 2.1 Why the screen is nonetheless not blank in a drive

`pages-2` has exactly two triggers into `storageFetch`:

```
create done                     → pages-2 storageFetch
list itemOutputSignal-Changed   → pages-2 storageFetch
```

Both are *consequences of an edit*. So a session that creates a page sees the list populate
and never notices; a session that merely arrives sees nothing. SBR-006's s9 drive created a
page as its second step, which is why this survived that drive.

### 2.2 🔴 The third state SBR-006 §5.8 did not have

§5.8 recorded that **a refused query and an empty collection are the same screen**. There is
a third, pixel-identical to both: **a collection that never asked**. Their fixes are three
different fixes, and the screen distinguishes none of them.

## 3. Scope

- **`packages/noodl-mcp/tests/sb005Components.ts`** (not `sb004Components.ts` — that one holds the cloud endpoints) — give `/Pages/Admin`'s `pages-2` a mount-time fetch, and decide
  whether the same hole exists on `/Pages/ThemeEditor`, `/Pages/PageEditor` and
  `/Pages/Site`. ⚠️ **Check, do not assume**: `settings-4` in `claimSite` deliberately sets
  `runOnChange-collectionName: false`, so "it has no explicit trigger" is not the same
  question as "it does not fetch".
- Decide what an empty list *says*. "No pages yet" is a different sentence from "you are not
  signed in", and both are different from a spinner. AC1 of SBR-006 is about a screen that
  reads as something.
- Regenerate the artefact (`npm run template:site-builder`).

## 4. Acceptance criteria

1. **(person)** Loading `/admin/pages` cold, with pages already in the backend and no edit
   made in that session, shows the rows and the count sentence. **Driven** — a fresh load,
   not a navigation that follows a create.
2. **A negative control in the same drive**: with zero pages in the backend, the screen says
   so in words. An empty list and a populated one must not be told apart only by row count.
3. **A gate over the artefact** that asserts every `DbCollection2` in a *page* component has
   a path to `storageFetch` that does not depend on an edit having happened. 🔴 Grade the
   reason for any exemption by name — an exclusion list cannot fail.
4. A mutant: remove the mount trigger and the gate reddens.

## 5. Traps

- 🔴 **Do not measure this from the screen alone.** Empty-because-refused,
  empty-because-empty and empty-because-never-asked are the same pixels. The instrument that
  separates them is `performance.getEntriesByType('resource')` in the viewer, and it needs a
  known-firing control beside it (requests to `:8574`) or a zero reading proves nothing.
- ⚠️ A drive that creates a page first cannot see this bug. Arrive, then look.
- ⚠️ `runOnChange-*` is written by the NDA-017 migration on load for every node whose control
  signal is wired (SBR-004 §9.2) — **disk and loaded disagree**, so read the running graph,
  not only the artefact.

## Reproduced independently, with a stronger control — 2026-08-29 (s14, SBR-017's drive)

The original reading was **"0 requests to `:8597` after load"**, which is real but is *consistent
with a query that was refused before it left the page*. SBR-017's drive took the reading the other
way round, from inside the running app, on the **session the panel itself holds**, at the moment
the panel was showing nothing:

```
GET http://localhost:8599/classes/Page
X-Parse-Session-Token: <the panel's own token>
→ 200, 1 row, 2 ms
```

Same principal, same instant, row readable. So the panel is not refused and the collection is not
empty: **it never asks.** Second backend (`backend_mte82r1qhnr87`), project minted from the
regenerated template.

⚠️ **Both arms are on one fixture**, which is the cheapest reproduction this defect has: in the
same session the list *did* render its row immediately after `New page`, because `pages-2` fetches
on `create.done`. **Create-then-look works; sign-in-and-look does not.** That is also why s9, s12
and s13 missed it — every one of them created a page first.

🔴 **It now blocks another task's acceptance criterion.** SBR-017 AC1 asks the owner to sign back
in and *"reach `/admin/pages` with the rows visible"*. They reach it; the rows are not visible; and
nothing in SBR-017 can fix that. See SBR-017 §6.4.


---

## 7. 🔴 The cause — the gate and the runtime were reading two different graphs

### 7.1 The page list was already authored to do the right thing

`sb005Components.ts`, above `ADMIN_NODES`, has said this for five sessions:

> 🔴 **`pages` deliberately does NOT carry `NO_LOAD_TIME_FETCH`.** […] The page list wants exactly
> the load-time fetch the filtered queries must suppress, and the pair of them is asserted together
> for that reason.

And it *is* asserted, by `assertUnfilteredQuery` in `sb005AdminPanel.test.ts` — which checks that
the author did not write `runOnChange-collectionName: false`, has a mutant, and was green the whole
time the panel was blank.

### 7.2 The migration writes that exact `false`, on every load

`runOnValueChangeMigration.ts` runs in `applyPatches`, before `ProjectModel.fromJSON`, and writes
`runOnChange-<input>: false` for the governed value inputs of any node in the fifteen families
**whose control signal is wired**. `DbCollection2`'s control signal is `storageFetch`. The page
list's `storageFetch` is wired — from `create.done` and from `list.itemOutputSignal-Changed`, both
consequences of an edit — so the node is squarely in the migration's population, and
`setCollectionName` (`dbcollectionnode2.ts:564`) then asks `shouldRunOnValueChange('collectionName')`
and schedules nothing.

**Measured through the real module** over the shipped artefact, before the fix:

```
/Pages/Admin  pages-2 (DbCollection2)  runOnChange-collectionName=false
/Pages/Admin  pages-2 (DbCollection2)  runOnChange-querySettings=false
/Pages/Admin  pages-2 (DbCollection2)  runOnChange-records=false
/Pages/Admin  pages-2 (DbCollection2)  runOnChange-search=false
```

🔴 **The migration is not wrong.** Richard's decision of 2026-08-06 was to preserve what pre-§2
authors actually built, and under the old contract wiring `storageFetch` *did* silence
`collectionName`. What the migration cannot do is tell a graph written before §2 from one this
template minted this morning — the module says so itself: *"nothing is stamped into the project (the
format has nowhere to put a marker — an open question §2 recorded and did not close)"*. So it fires
on a project authored today and reverses its author's intent. That is **D11** in the register, and
it is owned by **[DEF-007 §1.1](../phase-80-the-defects-the-templates-found/DEF-007-DISK-AND-LOAD-DISAGREE.md)**
in phase 80 — reassigned from `NONE` the same day, by that task's owner.

🔴 **There is no version guard in the pass and there cannot be one.** The conditions are only *"in a
family"*, *"control signal wired"*, *"key absent"* — and **absence is the only evidence it has**. A
modern author who never set the parameter is indistinguishable from a legacy author relying on the
old default. That is why an authored `true` is not merely *a* defence but the only one that can
exist, and why writing explicit values at generation time stops being the cheap option.

### 7.3 The second instance, which §3 asked to be checked rather than assumed

The same run named `/Pages/PageEditor  sections-2  runOnChange-qp-pageId=false`. That query carries
`NO_LOAD_TIME_FETCH` on purpose, so *the filter value arriving* is its only unprompted trigger — the
wire comment says exactly that — and the migration silences the discovered `qp-` ports too. **Open a
page for editing and its sections did not load until you added one.**

`/Pages/ThemeEditor`, `/Pages/Site` and `/Site/Nav` are clean, and for a reason rather than by luck:
none of their queries has `storageFetch` wired, so none of them is in the migration's population at
all.

### 7.4 The fix, and why it is the same shape in both places

An authored `runOnChange-<input>: true`. **The migration never touches a key that is already
present, whatever its value** — that single check is its whole idempotency — so an explicit `true` is
how a graph written after §2 says *"I meant the new default"*. It is the idiom the `count` node in
the same component already used.

| node | key | why that input |
|---|---|---|
| `/Pages/Admin` `pages` | `runOnChange-collectionName: true` | the class name is a stored parameter, so it lands at load |
| `/Pages/PageEditor` `sections` | `runOnChange-qp-pageId: true` | ⚠️ **not** `collectionName` — that would fetch every Section on the site before `pageId` exists, which is F12, the defect `NO_LOAD_TIME_FETCH` exists to prevent |

**Confirmed on the minted project, after two opens** — the migration ran twice and the authored
values survived both:

```
Pages/Admin       {"runOnChange-records": false, "runOnChange-querySettings": false,
                   "runOnChange-search": false, "runOnChange-collectionName": true,  "collectionName": "Page"}
Pages/PageEditor  {"runOnChange-records": false, "runOnChange-search": false,
                   "runOnChange-collectionName": false, "runOnChange-querySettings": false,
                   "runOnChange-qp-pageId": true, "collectionName": "Section", …}
```

### 7.5 What the screen says now

Three states, three sentences, where §2.2 had one screen for three states:

| state | words |
|---|---|
| signed out | `You are not signed in. Sign in to manage this site.` (SBR-017's, in the shell) |
| empty | `No pages yet. Use New page to make your first one.` |
| refused | `The page list could not be loaded. You may not have permission to manage this site.` |

The empty sentence replaces `No pages, no published`, which was the count sentence with a zero in
it. The refusal is a `Text` with `mounted: false`, raised by a `States` node driven from
`pages.failure` and lowered by `pages.fetched` — two ports of the one query, so a refusal cannot be
raised by a successful fetch and cannot outlive one.

---

## 8. 🟢 The drive — 2026-08-29 (s15)

**Fixture: `SBR-016 Arrive Drive`** — minted through the launcher's own template flow from the
regenerated artefact, backend **`backend_mte9omazclxw6`** on port **8600**, secret
`SITE_SETUP_TOKEN=drive-token-016`, owner `owner@sbr016.test` / `drive-pass-016`. A fresh mint was
required for the usual reason: a project is a copy of the template at mint time.

### 8.1 The instrument, and the reading that had to be thrown away

🔴 **`performance.getEntriesByType('resource')` reads ZERO on an in-app navigation — including for
the bundle, which is its own control.** SBR-016 §5 named that instrument, and it works for the hard
reload the original reading used; for a navigation there is nothing new in the timeline, so a zero
for the backend sits beside a zero for the control and proves nothing at all.

Replaced with a spy on `XMLHttpRequest.open` and `window.fetch`, and **the control was read first**:

| arm | requests to `:8600` |
|---|---|
| **CONTROL** — arrive at `/` (the public site, which always queried) | **4** — `Page`, `SiteSettings`, `Theme`, `Page` |
| **SUBJECT** — arrive at `/admin/pages` | **1** — `POST /classes/Page` |

Before the fix that subject row was **0**.

### 8.2 The sequence

| # | act | result |
|---|---|---|
| 1 | claim through `/admin/setup` | lands on `/admin/pages` |
| 2 | **the empty list, cold, zero pages** | **`No pages yet. Use New page to make your first one.`** — AC2 |
| 3 | create a page | row renders — `About us`, `about`, `Draft`, `Edit`, `More` |
| 4 | sign out | **31 ms** → `/admin/signin` |
| 5 | sign in, wrong password | **113 ms** → refusal, path stays `/admin/signin` |
| 6 | sign in, right password | **85 ms** → `/admin/pages`, **the row is there**; 2 backend requests since the click — `POST /login` and `POST /classes/Page` |
| 7 | **arrive-and-look**: `/` → `/admin/pages`, no edit in that navigation | **the list answered in 63 ms** with the row and `One page, no published`; **2 × `POST /classes/Page`** — AC1 |

Timings in 4–7 are polled to the condition, with no `sleep` inside the measured window.

### 8.3 The second instance, driven

| act | result |
|---|---|
| open a page for editing, cold | **2 × `POST /classes/Section`** on arrival — before the fix, none |
| add a section, go back to the list, open the page again | the section row (`Body`, `Choose image`, `Save`, `Delete`) is **on screen on arrival** |

### 8.4 ⚠️ An oracle that was wrong, and how it announced itself

The first arrive-and-look asserted `document.body.innerText.includes('About us')` — and it passed
**at `/`, before anything was driven**, because the public site's own nav lists the page by title.
A drive can pass on a broken feature; here it nearly passed on a feature it had not reached. The
oracle became `/(No|One|Two|Three) pages?[,.]/`, which only the admin list can produce, because
`count` runs on `pages.fetched` and nothing else.

### 8.5 Two things observed in passing, both recorded

- 🔴 **Every arrival issues the query TWICE** once a row exists — the `list.itemOutputSignal-Changed`
  wire re-fetches when the repeater first renders a row. One wasted round trip per arrival, on both
  screens. **D12** in the register.
- ⚠️ **SBR-008's symptom did not reproduce** — the created `Page` row carries `title` and `slug`,
  read on the panel's own session: `{"title":"About us","slug":"about", …}`, where SBR-017 §6.5
  recorded them missing on a mint one commit older. Recorded as an observation for SBR-008's owner,
  **not** as a closure — the fixture differs in more than one way.
  🔴 **s16 re-measured it and the caution was right, for a sharper reason than "the fixture
  differs": the two fixtures do NOT differ.** They are the same project on every static axis, and
  the export filter that drops these wires reads a debounced warnings store nothing forces to
  settle — so both readings are what one mechanism produces and neither discriminates. **This
  bullet unblocks nothing.** See **SBR-008 §5** and **D13**.

### 8.6 ⚠️ What was NOT observed

**The refusal sentence has never been seen on a live refusal.** This template's `Page.find` is
`public`, so a signed-out or non-admin visitor gets an empty result rather than a 403 — which is why
the signed-out screen correctly shows *both* the signed-out sentence and the empty sentence, and
both are true. Editing the backend's `security.json` to `role:admin` did not take effect without a
restart, and restarting the cloud runtime mid-drive was not worth it. **So the refusal path is gated
structurally and observed nowhere.** Left as a stated gap rather than an implied pass.

---

## 9. Acceptance criteria — verdicts

1. **(person) ✅ Met.** §8.2 step 7: `/` → `/admin/pages`, no edit in that navigation, the list
   answers in **63 ms** with the row and the count sentence, and the spy shows the query going out.
   Step 6 is the same thing after a sign-in, which is what **unblocks SBR-017 AC1's second half**.
2. **✅ Met.** §8.2 step 2 — zero pages in the backend, cold arrival, and the screen says
   `No pages yet. Use New page to make your first one.` in words. The populated arm is step 7, and
   the two are told apart by a sentence rather than by a row count.
3. **✅ Met** — `sb007Template.test.ts`, `SBR-016 — every query can run before anybody has edited
   anything`. The artefact is put **through the migration first**, then every `DbCollection2` in
   every browser component is asked whether it has a trigger that predates an edit. **Nine rows, each
   with its reason asserted by name**, three of them chains three hops deep. Producers are
   *classified*, not listed: an unrecognised type is an offender, and there is a mutant that proves
   it. Two controls beside it — the mapping covers every parameter a query in this artefact carries,
   and the migration really does rewrite the artefact before it is graded.
4. **✅ Met** — three mutants: remove `/Pages/Admin`'s explicit `true` (the state every project
   minted before today is actually in) and it reds naming that node; the same for
   `/Pages/PageEditor`; and an invented producer type reds rather than being skipped. **The offender
   message carries the diagnosis** — `collectionName is stored but the migration silenced
   runOnChange-collectionName` — rather than a bare boolean.

### 9.1 🔴 The gate's own first finding was about the gate

Two of them, and both are worth more than the rule they interrupted:

- The population split was derived twice — `noodl.cloud.request` **or `Component Outputs`** — and the
  cross-check caught it at once: `/Admin/PageRow` and `/Admin/SectionRow` have `Component Outputs`
  too, because that is how a repeater row signals `Changed`. **And two of the three cloud workers
  hold no `noodl.cloud.*` node at all**, so no graph property separates them from a browser
  component. The split is the `/#__cloud__/` prefix, and the control is now the one direction that is
  provable: a cloud-only node may never appear outside it. ⚠️ **The mis-classification was invisible
  to the rule itself** — neither row component holds a query — so a control scoped to the graded rows
  would have stayed green.
- `flatProject()` spread nodes shallowly, so `parameters` was shared with the module-level artefact
  and a mutant's `delete` leaked into every later test. It announced itself as the page-editor mutant
  reporting the page list as an offender too.
