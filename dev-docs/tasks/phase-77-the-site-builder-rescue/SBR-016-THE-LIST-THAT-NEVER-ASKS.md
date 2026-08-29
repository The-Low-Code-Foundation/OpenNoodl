# SBR-016 — The list that never asks

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
