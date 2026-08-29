# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **SBR-016 is fixed and driven. SBR-017 AC1 is unblocked and now met in full.**

**s15 (2026-08-29)** closed the defect that had survived three drives, and the cause was not what
three sessions had been looking for. The panel was not refused, was not empty, and **was not
missing a wire**: it was authored to fetch at load, deliberately, with a comment saying so — and the
NDA-017 back-compat migration wrote `runOnChange-collectionName: false` into it on every project
load, because its `storageFetch` happens to be wired.

Read in this order:

1. **[SBR-016 §7](SBR-016-THE-LIST-THAT-NEVER-ASKS.md)** — the cause, the two instances, and why the
   fix is a parameter rather than a wire. **§9.1 is the part worth your time**: the new gate's first
   two findings were both about the gate.
2. **[DEFECTS-THE-SITE-BUILDER-FOUND.md](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — **D11** and **D12**
   are new, both `NONE`. D11 is the product-side half of this session and it is the largest thing
   found today.
3. **[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md)** — now 56 rows.

---

## 🔴 FIRST JOB — pick one of these two; they are both real and they do not overlap

### (a) **SBR-006 AC1/AC2**, which were blocked on SBR-008 — and SBR-008's symptom did not reproduce

s14 recorded that a created `Page` row had *"no `title`, no `slug`"*. On a fixture minted one commit
later, read on the panel's own session:

```
{"objectId":"62d8abb8…","published":false,"showInNav":true,"navOrder":0,
 "title":"About us","slug":"about"}
```

🔴 **This is an observation, not a closure.** The two fixtures differ in more than one way and the
right move is to re-measure asking *"is this reading right?"* rather than *"is it stale?"*. If it
holds, SBR-006 AC1/AC2 unblock and SBR-008 may already be paid.

### (b) **D11** — the migration reverses a graph authored after the contract it migrates from

The sharpest product row in the phase, and `NONE` owns it. 56 writes over 35 nodes on a template
authored entirely after §2; two of them were live defects. The fix is a marker in the project
format, or a diagnostic when the migration writes into a project whose `nodegxVersion` postdates §2.
⚠️ It is adjacent to but **not the same as** DEF-007 (the disk/load seam) — that one is about
reading the loaded graph, this one is about the migration's population.

## Where the ACs now stand

| | verdict | evidence |
|---|---|---|
| **SBR-016 AC1** | ✅ | §8.2 step 7 — `/` → `/admin/pages`, no edit, the list answers in **63 ms** with the row; spy shows the query |
| **SBR-016 AC2** | ✅ | §8.2 step 2 — zero pages, cold, `No pages yet. Use New page to make your first one.` |
| **SBR-016 AC3** | ✅ | `sb007Template.test.ts` — the artefact **put through the migration first**, 9 rows each with its reason asserted by name |
| **SBR-016 AC4** | ✅ | three mutants, incl. an unclassified producer; offender messages carry the diagnosis |
| **SBR-017 AC1** | ✅ | re-driven in s15 — sign out **31 ms**, refusal **113 ms**, sign in **85 ms**, **row visible** |
| **SBR-017 AC2/3/4** | ✅ | s14, §6.2 |
| **SBR-015 AC1/2/3** | ✅ | s13, §2.3d |
| **SBR-015 AC4** | 🟡 | `execution_steps` 0 rows — the task says why, and it is right |
| **SBR-006 AC1/AC2** | 🟡 | see (a) above — may be unblocked |
| **SBR-006 AC3/4/5** | ✅ | s9, s12, s13 |

## What s15 changed, in one paragraph

Two parameters and two sentences. `/Pages/Admin`'s query gains `runOnChange-collectionName: true`
and `/Pages/PageEditor`'s gains `runOnChange-qp-pageId: true` — **the migration never touches a key
that is already present**, so an authored `true` is how a post-§2 graph says *"I meant the new
default"*. ⚠️ The two repairs are deliberately **not** the same key: turning `collectionName` back
on for the filtered query would fetch every Section on the site before `pageId` exists, which is
F12. `/Pages/Admin` also gains `EMPTY_PAGE_LIST_TEXT`, and a refusal `Text` raised by
`pages.failure` and lowered by `pages.fetched` through a resetting `States`. Plus one stale pin
fixed: `templateAppearance.test.ts` pinned the site-builder at 5 pages and s14 made it 6.

## 🔴 Three traps this session paid for

- **A gate over the artefact cannot see a migration that rewrites it on load.** `assertUnfilteredQuery`
  asserted exactly the right property and was green for five sessions while the panel was blank. Any
  check that reads `node.parameters` directly has this hole. The new gate applies
  `planRunOnValueChangeMigration` first, and that one call is the whole difference.
- **`performance.getEntriesByType('resource')` reads ZERO on an in-app navigation — including for
  its own control.** SBR-016 §5 named it as the instrument; it works for a hard reload and not for a
  navigation. A spy on `XMLHttpRequest.open` / `fetch` works, and **read the control first**: the
  public site's arrival gave 4 requests, which is what made the subject's 1 mean something.
- **An oracle can pass somewhere else on the page.** `innerText.includes('About us')` passed at `/`
  before anything was driven, because the public nav lists the page by title. The oracle became
  `/(No|One|Two|Three) pages?[,.]/` — a string only the admin list can produce.

## 🔴 Read this before any drive of the preview

Unchanged from s14, and it is still the thing that will cost you twenty minutes:

**The editor's preview pane gives the viewer webview a `96 × 0` viewport.** Every CDP click reports
success, arrives `isTrusted: true`, and hit-tests to `<html>` — `document.elementFromPoint` is
`null` outside the visual viewport. `getBoundingClientRect()` answers normally throughout.

✅ **`Emulation.setDeviceMetricsOverride` on the viewer target, on the same connection as the
clicks** — `npm run cdp` opens one per invocation and the override dies with it. s15's harness is
`drive.js` in the scratchpad: one connection, override + `setFocusEmulationEnabled`, a `clickText`
that refuses to click anything `elementFromPoint` cannot reach, and a `go()` that uses
`window.Noodl.Navigation.navigateToPath`.

🔴 **New in s15: `Page.reload` on the viewer target KILLS IT** — the webview target disappears and
the editor falls back to the launcher. Reopening the project from the launcher is the recovery, and
it is also the cleanest cold start available.

⚠️ Also: `npm run cdp -- screenshot --target=viewer` **hangs**; `location.href = '…'` does not reach
a page (the Router resets to `/` on load); and the `cdp eval` execution context **persists between
invocations**, so a bare `const x` collides on the second call — wrap every eval in `(() => { … })()`.

## Standing context

- 🔴 **Drive fixtures — do not overwrite.**
  **`SBR-016 Arrive Drive`** (backend `backend_mte9omazclxw6`, port 8600, secret
  `SITE_SETUP_TOKEN=drive-token-016`, owner `owner@sbr016.test` / `drive-pass-016`) is the current
  one: minted from the fixed template, claimed, one `Page` with one `Section`. **It is the only
  fixture whose queries fetch on arrival.**
  **`SBR-017 Sign In Drive`** (`backend_mte82r1qhnr87`, 8599, `drive-token-017`,
  `owner@sbr017.test` / `drive-pass-017`) has a sign-in page but **pre-dates the SBR-016 fix**.
  **`SBR-015 AC1 Drive`** (`backend_mte62ofkj8whc`, 8598, `drive-token-ac1`, `owner@ac1.test` /
  `drive-pass-ac1`) is left in the **refusal** arm — `Section.pageId` renamed to `pageId_hidden`.
  **`SBR-015 Zero Section Drive`** and **`SBR-006 Admin Drive`** are pre-fix and test nothing current.
- 🔴 **A project is a copy of the template at mint time.** Any template change needs a freshly minted
  project to drive. Verify the copy on disk first — and for anything `runOnChange`-shaped, verify it
  **after the project has been opened**, because that is when the migration runs.
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written; if the
  platform cannot express what an AC asks for, **say so and record the gap**. s15's gap: the refusal
  sentence is gated structurally and **has never been seen on a live refusal**, because this
  template's `Page.find` is `public` (SBR-016 §8.6).
- ✅ **Gates run in s15**: `noodl-mcp` jest **938 passed, 0 failed** (69 suites), `typecheck:mcp`
  clean. `test:ci` was not run — no editor, runtime or MCP *source* was touched. A peer ran it at
  12:52 over this session's uncommitted artefact and got **the floor: 2889 specs, 4 failures, all
  four `AIX-006 style vocabulary` by name**.
  🔴 **Their correction is worth keeping: `test:ci` webpacks the working tree, and the readout's
  `gitHead` names a commit.** A peer's uncommitted work is silently inside your measurement.
- Census pins moved in s15, deliberately: **22 → 22** components (no new component), `/Pages/Admin`
  gains two nodes, and `templateAppearance`'s site-builder page pin **5 → 6**.
- Shared checkout: **pathspec commits only, never `git add`**; announce editor launches **and**
  teardowns; `test:ci` alone, never beside a live stack.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
