# TUT-001 — one database, not forty

**Surface:** editor · **Tier 1** · **Effort:** S/M · ✅ **DONE 2026-08-19** · ✅ **R1 answered and driven**

> Richard, 2026-08-19:
>
> > *"How do we make [sure] that the database tab in the editor doesn't become insanely cluttered,
> > which it is right now. I propose we make just one database visible, the one that's currently
> > attached or was previously attached to the project, and all the other databases go into a search
> > modal or something that makes them invisible until you want to find them."*

## The premise

Every backend on the machine renders flat, forever. Two `.map()` calls do it —
[`BackendServicesPanel.tsx:478`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/BackendServicesPanel.tsx)
(local backends) and `:535` (the rest). Nothing filters, nothing collapses, nothing sorts by
relevance. A machine that has run ten AI-built projects and five tutorials shows fifteen cards, of
which one matters.

## 🔴 What is already computed — this task adds a filter, not a data model

Everything the proposal needs is already on hand in that component:

| Fact | Where | Gives you |
|---|---|---|
| `activeBackendId` — the project's **one** converged active id | `:94`, and `models/BackendServices/activeBackend.ts` | "currently attached" |
| `boundLocalBackend` | `:332` | the local backend the endpoint points at |
| `projectNamesByBackend` | `:529` | **"previously attached"** — `projectIds` is stamped at creation and never widened |
| `name`, `createdAt` (ISO8601), `port`, `projectIds` on `BackendMetadata` | [`BackendManager.js:47-57`](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js) | every filter Richard named, with no new persistence |

⚠️ **`createdAt` is a string on the metadata and a `Date` nowhere.** Sort and filter on it as an
ISO string or parse it once at the boundary — do not assume a `Date`. (The platform paid for the
inverse of this assumption in NAT-006: a `Date`-typed column arriving as a raw string on some
pooled connections.)

## 🔴 The trap this task must not walk into

`ProjectBackendLifecycle` **stops only the backends it started itself**. A backend that was already
running when the project opened is *adopted*, and adopted backends are deliberately not stopped —
the module says so, and the reason (not dropping open SSE streams to reach an identical state) is
good.

So the Backend Services panel is **the only place a hand-started backend can be stopped**. Hide the
list unconditionally and a running process has nothing on screen pointing at it. That is R1: the
collapsed state has to stay honest — something like `1 attached · 14 others, 2 running` — rather
than a bare hidden count or nothing at all.

## Acceptance criteria

1. With a project bound to a local backend, the panel shows **that backend** and no other cards;
   the count of rendered `LocalBackendCard`s is 1, asserted against a fixture with ≥5 backends.
2. A finder (modal or drawer) lists the rest and filters by **name substring**, **created date
   range**, and **owning project** — each driven against a fixture where the filter excludes at
   least one row and includes at least one, so a filter that returns everything cannot pass.
3. "Previously attached" resolves through `projectIds`, not through a new field: a backend whose
   `projectIds` contains the open project appears in the attached position even when the project's
   endpoint currently points elsewhere. A backend with an **empty** `projectIds` (every one that
   predates the stamp) is owned by nobody and appears only in the finder — 🔴 it must **not** be
   promoted, for `findReusableBackend`'s reason.
4. **R1's answer, driven:** with a hand-started backend that the open project is not bound to, the
   collapsed panel still communicates that something is running, and there is a path to stop it in
   ≤2 interactions.
5. A project bound to **no** backend, and a project bound to the **endpoint** rather than a local
   backend, both render sensibly — these are separate cases in the current render (`:466`) and the
   filter must not collapse them into one.
6. `test:ci` and `test:main` stay at their floor; the panel's own specs are extended, not replaced.

## Out of scope

- Disposal of unused tutorial databases. It is the natural follow-on (README §1A: disk, not CPU) and
  it belongs with TUT-004's install/uninstall lifecycle, not here.
- Any change to `findReusableBackend`, ownership, or provisioning. This task is presentation only.

## Watch out for

- 🔴 **`BaseDialog` renders every dialog twice** — if the finder is a dialog, a DOM-count assertion
  must filter `:not([class*=MeasuringContainer])` or it will read double.
- The panel is one of the surfaces NAT-002/003 repainted on 08-19. Take the tokens as they are now;
  do not reintroduce `fg-muted` for the secondary lines.

---

## Built — 2026-08-19 (session 1)

**Surfaces:** four new files under `packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/`
plus the panel itself, and two spec files under `tests-unit/tut-001/`.

| File | What it is |
|---|---|
| `backendVisibility.ts` | **the whole rule**, pure and import-free — `partitionBackends`, `filterFinderRows`, `describeCollapsedSummary`, `toEpoch` |
| `BackendFinder/BackendVisibilityList.tsx` | the hook-free list **both** the panel and the finder draw through |
| `BackendFinder/BackendFinderBody.tsx` | the finder's three filters and its result count, hook-free |
| `BackendFinder/BackendFinderDialog.tsx` | the `Modal` around it; holds the query state and nothing else |
| `BackendServicesPanel.tsx` | builds candidates, calls the rule, renders **one** card + the summary line |

### The shape of the change

The two flat `.map()` calls are gone. The panel now builds one `renderRow` closure and hands the
**same one** to its own list and to the finder — so a backend looks and behaves identically in both
places, and there is exactly one `<LocalBackendCard` and one `<BackendCard` render site in the file
(asserted). That is not tidiness: it is what makes R1's answer true, because Stop lives on
`LocalBackendCard` and the finder had to be able to draw it.

### 🔴 R1 — answered as the task's own trap section recommends

The collapsed panel carries one line: **`1 attached · 6 others, 1 running`**, a button that opens
the finder. A bare hidden count was rejected — *"14 others"* reads as inert, and
`ProjectBackendLifecycle` never stops a backend it merely adopted, so this panel is the only place a
hand-started backend can be stopped at all. **Two interactions to stopped**: click the line, press
Stop on the same card the panel would have drawn.

`describeCollapsedSummary` says nothing about running when nothing hidden is running (no false
alarm), and counts only *hidden* running backends — a running attached one is already on screen.

### 🔴 A fourth tier the task did not name: a hand-made backend was about to vanish on creation

Not in the acceptance criteria, and it would have shipped as a regression in the **create** flow. A
backend made by hand in this panel is not the endpoint (nothing points at it until it is started),
is not active, and has an **empty `projectIds`** — so all three tiers miss it and Create would have
filed it straight into the finder. The user presses Create and watches their backend fail to appear.

Fixed with `justCreatedBackendId`: **panel state, written nowhere**. Stamping `projectIds` instead
would have been the ownership change this task is explicitly not making, and would have fed
`findReusableBackend` a claim the user never made.

🔴 **It is the LOWEST tier, and that ordering is the whole correctness of the summary line.** Built
first as the *highest* tier, which is wrong: creating a backend while the project is bound to
another would have drawn the new one, hidden the bound one, and left the line above reading
*"1 attached"* about a backend nothing is attached to — while the backend the running app actually
talks to sat in the finder. **A fix can manufacture a lie one line above itself.** Ranked last it
only ever fills an *empty* attached slot — the fresh-project and new-tutorial case, which is the one
that matters and the only one in which it cannot lie. Both arms are specced.

### 🔴 One more the partition cannot see: the endpoint is an attachment with no card

`activeBackendId` may be `ENDPOINT_BACKEND_ID`, which matches **no candidate**, so under a live
Parse endpoint the partition correctly reports zero attached — and the line would have read
*"No backend attached"* with the endpoint card sitting directly above it saying otherwise.
`describeCollapsedSummary` takes an `endpointCardVisible` flag for exactly this, and a spec asserts
the flag does not invent an attachment when false.

### AC-by-AC

| AC | Status | Evidence |
|---|---|---|
| 1 — one card against a ≥5 fixture | ✅ | 7-backend fixture; `cards(tree)` is `['tutorial-2']`. **Control:** the same list drew **7** when handed the unfiltered machine |
| 2 — name / date range / owning project | ✅ | each filter asserted to **exclude ≥1 and include ≥1**; an empty query is asserted to exclude nothing, so "returns everything" cannot pass |
| 3 — `projectIds`, and empty is not promoted | ✅ | promoted with no endpoint and no active id; **refused** for empty `projectIds`; refused for another project's id; newest wins among several |
| 4 — R1, running backend reachable in ≤2 | ✅ **DRIVEN** | line became `1 attached · 6 others, 1 running`; two clicks to Stopped; **port 8584 confirmed dead at the OS**, not just the badge |
| 5 — no backend, and endpoint-not-local | ✅ | both asserted; the endpoint section's own render is untouched |
| 6 — `test:main` / `test:ci` at floor | ✅ | `test:main` **265 suites / 4249, 0 failures**; `test:ci` **2849 specs / 10 failures @ seed 39393** — the recorded floor, and **the same 10 by name** (4× AIX-006, 2× model registry, 1× AIX-011, 3× SUB-011). **43 specs** in `tests-unit/tut-001/` |

⚠️ **AC6 says "the panel's own specs are extended, not replaced". There were none** — `grep` over
`tests-unit/` and `tests/` for `BackendServicesPanel`, `LocalBackendCard` and `localBackends` hits
only `tests/index.bundle.js`, a build artefact. Nothing was replaced because nothing existed; the
two spec files are new.

### What the instrument can and cannot see

- ✅ **Four controls, all red, all restored.** Unfiltered finder → **9 failed**; panel fed the raw
  list → **1 failed**; no `projectIds` tier → **3 failed**; summary stops counting running →
  **4 failed**; empty `projectIds` promoted → **6 failed**. Restored: **39/39**.
- 🔴 **Neither the panel nor `LocalBackendCard` can be loaded by this runner** — the panel calls
  hooks and the card imports `common/Icon` (`require.context`). The finder's `TextInput` is
  `jest.mock`ed with a factory so the real module is never required. The claim that the *panel*
  feeds the partition to the render is therefore **source-derived, with comments stripped first**.
- ⚠️ That source check is blind to a rename. It is backed by the count assertions
  (`<LocalBackendCard` appears exactly once) rather than by a bare substring, but it is the weakest
  link in this task and a drive is what closes it.

### ✅ The drive — RUN, and all five predictions held

Driven 2026-08-19 against a **copy** of `Puppy test 3` (`tut001-drive`), on the seven real backends
this machine carries. **Traps met, in order:**

1. 🔴 **`BaseDialog` doubled every count, exactly as warned.** The open finder gave **13** card
   roots raw and **7** after filtering `:not([class*=MeasuringContainer])` — 1 panel + 6 finder.
   The `backend-finder-count` node appeared **twice**, both reading "6 backends".
2. 🔴 **And a trap the task did not name: the MEASURING copy is the FIRST match in the DOM.**
   `document.querySelectorAll('[data-test=backend-finder-name]')[0]` is the invisible one, so the
   obvious `cdp type '[data-test=backend-finder-name]'` types into a field nobody can see and
   observes **nothing changing** — a false negative that looks exactly like a dead filter. The
   selector that works is `[data-test=…]:not([class*=MeasuringContainer] *)`, verified to match 1.
3. ✅ Drove a **copy**; the launcher store entry was cloned from the real project's (its `id`
   `692d3658-…` is the one `backend_msjck0y2ukxwv` carries in `projectIds`).

`data-test` hooks are in place: `backend-visibility-summary` (the collapsed line),
`backend-finder-name` / `-created-from` / `-created-to` / `-project` (the filters),
`backend-finder-count` (the *"3 of 14"* line) and `backend-finder-empty`.

### The prediction, written before the drive

This machine already carries **seven** local backends (`~/.noodl/backends/`), which is AC1's "≥5"
fixture in real life rather than a fabricated one. Four have an **empty `projectIds`**; three are
owned. `Puppy test 3`'s `cloudservices.instanceId` is `backend_msjck0y2ukxwv`, so **tier 1** fires.

| # | Predicted | Falsified by |
|---|---|---|
| 1 | exactly **one** `LocalBackendCard`, "Puppy test 3 backend" (port 8581) | any other count |
| 2 | the line reads **`1 attached · 6 others`** | "No backend attached", or a wrong count |
| 3 | the finder opens with **6** rows and the text **"6 backends"** | 7, or 12 (the `BaseDialog` double) |
| 4 | typing `stock` gives **2** rows and **"2 of 6"** | 6 rows — a filter that excludes nothing |
| 5 | the four empty-`projectIds` backends are **only** in the finder | any of them on the panel |

### What the drive actually returned

| # | Observed | |
|---|---|---|
| 1 | `LocalBackendCard-module__Root` count = **1** ("Puppy test 3 backend", port 8581, ACTIVE, Running) | ✅ |
| 2 | **`1 attached · 6 others`** — no running tally, because the only running backend WAS the attached one | ✅ |
| 3 | finder: **7** roots visible (1 panel + **6**), text **"6 backends"** | ✅ |
| 4 | typed `stock` → **"2 of 6"**, 3 roots visible (1 panel + **2**), both Stock Cupboard backends | ✅ |
| 5 | none of the six other names appeared anywhere on screen — `hiddenNamesPresent: []` | ✅ |

**Then R1's actual claim, end to end.** Started the hidden `Stock Cupboard Backend` (port 8584),
which the open project is not bound to, and closed the finder:

> the collapsed line became **`1 attached · 6 others, 1 running`**

Then **two interactions** — click the line, press Stop on the card the finder draws — and:

> the card read **Stopped**, `lsof -ti :8584 -sTCP:LISTEN` returned **nothing**, and the line went
> back to **`1 attached · 6 others`**

🔴 The port check matters: the badge is the *mechanism*, a dead listener is the *consequence*. A
card that says "Stopped" over a live process is precisely the failure a UI-only assertion cannot
see. **AC4 closes.**

⚠️ Left behind on purpose: the `tut001-drive` copy and its launcher-store row, so the next session
can re-drive without repeating the store dance. `dev:stop` reported **27 processes stopped, nothing
left running**; ports 8578–8584 all clear; the 10 peer MCP servers untouched.
