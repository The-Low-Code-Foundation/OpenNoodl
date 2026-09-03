# SBR-011 — Live preview over the realtime hub

**Fixes finding 6.** 🧭 **Ruled s1: BUILD it** — against the assessment artifact's
recommendation to strike. The README §2 promise ("live preview via `Subscribe to Changes`, SSE
realtime hub — delivery gated by the same ACL predicate as queries") becomes true instead of
deleted.

## 1. The person sentence

**With the site open in one tab and the admin panel in another, publishing a change updates the
open site without a reload.**

## 2. Scope

- `Subscribe to Changes` into the public site's query chains: page/section/theme change events
  re-drive the affected queries (slug resolve, sections, nav, theme overlay).
- The admin panel's Preview (SBR-007) rides the same mechanism: an owner editing sees the
  preview move.
- Theme record changes propagate live: the SBR-009 demo becomes "watch the site repaint".
- Scope boundary: the SSE hub itself exists and is not this task's to modify — this is template
  wiring plus whatever thin gaps a real consumer flushes out (this template's whole job,
  historically: expect to find platform defects and file/fix them as they surface).

## 3. Acceptance criteria

1. **(person)** Two contexts open (anonymous site + owner admin); owner publishes a page; the
   site's nav gains the link without reload — driven, with the no-reload half proven (e.g. a
   stamped window property surviving the update).
2. Section edit on the currently-viewed page updates its rendering live.
3. Theme save repaints the open site live.
4. ACL predicate honoured: an anonymous subscriber does NOT receive draft/unpublished change
   payloads (drive the negative — subscribe, edit a draft, assert silence beside a known-firing
   signal for the published case).
5. With the hub unreachable, the site still works statically (subscription failure degrades to
   the current refresh-to-see behaviour, silently — not a broken page).

## 4. Traps

- 🔴 Asserting "no event arrived" needs the known-firing twin beside it, or the spec passes on
  a dead subscription.
- 🔴 `Run` is additive and a node can run on its own — wiring a re-query must not double-fetch
  (assert cardinality of fetches per event where two producers meet).

---

## 5. 🟡 BUILT AND DRIVEN — s39, 2026-09-02. The wiring is three parameters; the work was the defect underneath it.

### 5.1 What was built

Three queries on the public site now hold a subscription open. That is the entire template change —
six lines in the artefact — and it is deliberately small: the mechanism already existed on both
sides, and the task's own scope said so.

| query | component | which AC |
|---|---|---|
| `pages` | `/Site/Nav` | AC1 — a published page grows the nav link |
| `sections` | `/Pages/Site` | AC2 — a section edit reaches the open page |
| `theme` | `/Pages/Site` | AC3 — a theme save repaints it |

🔴 **The node is Query Records' own checkbox, not the standalone `Subscribe To Changes` node**, and
the two are not interchangeable. `subscribetochanges.ts` says so in its own header — *"Query Records'
checkbox stays as the query-refreshing form and the two are not alternatives"* — and it is the
checkbox that is literally **displayed** as *Subscribe To Changes* (`dbcollectionnode2.ts:1266`).
README §2's promise names the port, and the port is this one. Wiring the standalone node would have
matched the name and missed the mechanism: it publishes a changed row and fires signals, and never
re-runs a query.

🔴 **Three queries and not five, and that is a budget rather than an oversight.** `SseTransport`
opens **one `EventSource` per subscription, deliberately** — both servers' subscription POST
*replaces* the set for a `clientId`, so a shared stream would clobber itself. A browser gives an
HTTP/1.1 origin about six connections, shared with the fetches the page still has to make, so five
subscribing queries would spend the pool on idle streams. `pageQuery` and `settings` stay static:
their changes appear on the visitor's next navigation, which is the behaviour that shipped before
this task. `sbr011LivePreview.test.ts` asserts the count is exactly **three**, so a fourth is a
decision somebody makes on purpose.

### 5.2 The verdicts

🔴 **Read the caveat first, because it applies to every line below.**
[D45](DEFECTS-THE-SITE-BUILDER-FOUND.md#d45) makes the timing of a subscription **unpredictable
between runs of identical code** — one run had six streams open for three subscriptions and warmed up
in seconds, the next had **fifteen** and never warmed up inside a 120-second window. So the two
post-D44 runs are reported as a **pair**, and a criterion is called met only where **both** agree.
**This drive is not yet a stable gate**, and saying so is part of the verdict.

| | run A | run B | verdict |
|---|---|---|---|
| AC1 — publish a page, the nav grows the link | 🟢 | 🟢 | **MET** |
| AC2 — section edit reaches the open page | 🟢 | 🟢 | **MET** |
| AC3 — theme save repaints the open site | 🔴 | 🔴 | **NOT MET** — blocked by [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46), isolated s40 |
| AC4 — draft not delivered, twin proves the wire | 🟢 | 🟢 | **MET** |
| §4 trap 2 — one event, one re-query | 🟢 | 🟢 | **held** |
| MUTANT — subscriptions stripped, nothing moves | 🟢 | 🟢 | **held** |
| AC5 — hub unreachable, the site still works | 🟢 | 🟢 | **MET** (own drive, 3/3) |

**AC1 — 🟢 DRIVEN.** An anonymous browser sat on `/workshop` and **never navigated again**. The owner
published *Visit us* over HTTP from outside it; the link appeared in the open document's nav. Not
there before, there after — the pair is the claim.

**AC2 — 🟢 DRIVEN.** The owner edited the section on the page being looked at; the new opening hours
replaced the old ones. **And the old body is gone** — a re-query that appended would satisfy "the new
text is present" while showing the reader both versions.

**AC3 — 🔴 NOT MET, and as of s40 the cause IS isolated.** The theme save did not repaint:
`--primary` stayed at its pre-save value in all three runs to date.

✅ **It is not a `Theme` defect.** s40's run reads `liveCollections` as
**`{Page: false, Section: false, Theme: false}`** — all three collections equally dead inside the
warm-up window — which settles the question the s39 pair could not: there is nothing
`Theme`-specific here. AC1, AC2 and AC4 pass because their windows fall after a retry cycle happens
to land; AC3's does not.

🔴 **What blocks it is [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46), and nothing else.** The
subscription registration POST is **queued in the browser for 15007ms and then answered by the
backend in 5ms** — never sent, not slow. `SseTransport` opens one never-ending stream per
subscription, and those streams hold the per-origin connection pool the POSTs need. The pool is
**six**, measured. ⚠️ **AC3 must not be claimed met until D46 is fixed**, and specifically not by
lengthening the warm-up: that would be closing it on the instrument, which is the thing
[D45](DEFECTS-THE-SITE-BUILDER-FOUND.md#d45) forbade in the same breath as naming the test.

**AC4 — 🟢 DRIVEN, and it is the arm worth the most.** A draft page (`DRAFT_ACL`, `showInNav: true`)
was created while the anonymous page sat open and subscribed; nothing arrived, over a **12-second**
window with no early exit. Then **that same record's ACL was opened** and the link appeared, on the
same document, down the same connection. The silence means something only because the noise that
followed it came down the same wire. Delivery is gated per event on `canReadRecord`, and this is the
measurement of it.

**§4 trap 2 — 🟢 one event, one re-query.** `Section` fetched **exactly once** for one edit. Two
producers meet on these nodes — the cloud-store subscription for this browser's own writes, the hub
for everyone else's — and a doubled fetch is invisible in the rendering because the screen is simply
correct twice. ⚠️ The counter wraps **`XMLHttpRequest` as well as `fetch`**: the first version
counted `fetch` alone and read `{}` on a page that had visibly rendered its records, because this
store speaks the Parse wire and that client uses XHR. A control that can only read zero is worth
reading before it is believed.

**AC5 — 🟢 DRIVEN, and it is the only arm here that is a stable gate.**
`sbr011-hub-unreachable-drive.test.ts`, 3/3, 44 seconds. The hub is made unreachable **by the
backend's own refusal path** rather than by breaking an address: `ops.json` caps
`rateLimit.realtimeMaxConnections` at **1**, the test holds the one stream, and every subscription
the page opens gets the real `503 Retry-After` — while `/classes/*` answers normally. The control
calibrates the instrument first: a second stream is refused `stream status 503`, so "the hub was
unreachable" is a reading rather than an assumption about a config file.

Both halves of *"degrades silently"*:

| | |
|---|---|
| **not a broken page** | the site renders completely — body text, nav, title — and logs **`errors: []`**. Nothing on the page says *realtime*, *subscription*, *Retry-After*, *503* or *EventSource*; the visitor is reading a website |
| **refresh-to-see** | the owner's edit does **not** arrive on the open page (`inPlace: unchanged`) and **does** after a reload (`afterReload: UPDATED`) — the second half is what makes the first a statement about the subscription rather than about the write |

⚠️ `version` is not optional in `ops.json` even in a one-key file: `OpsState` validates before
merging and **refuses to start** on `unsupported version undefined`. That is the right posture — a
config that would not be fully honoured is never silently half-applied — and it is not visible from
`mergeOpsOver`.

**MUTANT — 🟢.** The defect restored rather than a repair reversed: the same project with `realtime`
stripped from the three queries, counted `removed:3`. It loads correctly and shows every record, and
the same owner write against the same open page changes nothing. ⚠️ It is given the **same 90
seconds** the live page gets — under D45 a mutant on the short wait would come back empty either way
and read as if it had proved something.


### 5.3 🔴 The defect underneath, which is most of what this task actually was

**[D44](DEFECTS-THE-SITE-BUILDER-FOUND.md#d44) — realtime had never connected for the built-in
backend, because the runtime sent the project's app id as a session token.** Fixed in the session,
in `noodl-runtime`.

The first drive read the ACs as failing and it would have been easy — and wrong — to file that as
"the template wiring does not work". The reading that settled it was **the hub's own
`connectionCount`, taken in-process while the page sat open**: the browser opened three
`EventSource`s and the hub held **zero**. Those are two different findings with opposite fixes, and
from the browser they are the same picture.

| oracle | said |
|---|---|
| the hub, subscribed to directly | 🟢 delivers to an anonymous subscriber |
| the shipped artefact | 🟢 three queries carry `realtime: true` |
| the page's resource list | 🟢 three `GET /__backend/realtime?token=…`, one per query |
| the hub's `connectionCount` | 🔴 **0** |
| the page's console | 🔴 **nothing at all** |

The token in that URL was the project's **appId**. Measured against a real backend with no browser
in the loop: `/realtime` with no token is `200 connected`; `/realtime?token=<appId>` is
**`400 Invalid session token`, code 209**. The full chain and the fix are in the register.

### 5.4 The specs

- **`packages/noodl-mcp/tests/sbr011LivePreview.test.ts`** — six arms over the shipped artefact.
  Mutation-checked: flipping one `realtime` to `false` in the committed file reddens **four** of the
  six, and the artefact was md5-verified identical after restoring.
- **`packages/nodegx-backend/tests/sbr011-live-preview-drive.test.ts`** — the person sentence, on a
  real `BackendService` with the shipped policy and enforcement ON.
- **`packages/nodegx-backend/tests/sbr011-hub-unreachable-drive.test.ts`** — AC5, which needs a hub
  that refuses. It caps `rateLimit.realtimeMaxConnections` at **1** in `ops.json` and holds the one
  stream, so every subscription the page opens is refused **by the server on the real refusal path**
  (`503`, `Retry-After`) while `/classes/*` answers normally.
- **`packages/noodl-runtime/test/backends/realtime-transports.test.ts`** — three new arms on the
  token a subscription puts on the wire, in a file whose 357 existing arms were green through the
  whole of D44.

⚠️ **One gate had to be widened, and the cheap way of widening it would have been wrong.**
`sb007Template.test.ts`'s SBR-016 control asserts that every parameter a query carries is in
`PARAMETER_CHECKBOX`, and `realtime` was not. Adding it to that map would have told shape 2 that a
stored `realtime` means *"this query runs with nobody involved"* — which would have graded
`sections`, the query carrying `NO_LOAD_TIME_FETCH` precisely so it cannot run before its filter
exists, as **free**. The rule protecting it would have started passing because of a parameter that
does not trigger it. There is now a second, disjoint `NOT_A_TRIGGER` map, and `realtime` is in it
because `handleRealtimeChange` returns on the `init` frame **before** `scheduleFetch`.

---

## 🟢 s47, 2026-09-03 — AC1, AC3 and AC4 DRIVEN, all three on the DEPLOYED artefact

Driven inside SBR-014 run 3 — full record:
[`notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md`](notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md).

The instrument was two headless Chromes on the deployed folder (served statically, backend 8604):
one signed in as owner, one anonymous with a fresh profile and an empty `localStorage`. The
anonymous page was stamped with a `window` property and a MutationObserver.

✅ **The subscription was proved alive first** — `POST /realtime/subscriptions`, principal
`anonymous`, in the backend log for *that* page load, beside an open `/realtime` stream. Without
that, every silence below would be a fact about a dead subscription (§4's own trap).

### AC1 — met, including the no-reload half

Published a page the person's way: titled `The Bindery Journal`, slug, `Show in navigation`,
`Save page`, then **`More → Publish`** on the panel (`POST /functions/publishPage`).

The anonymous site's nav went `PUBLISHED CANARY S47 | Our Studio` →
**`The Bindery Journal | PUBLISHED CANARY S47 | Our Studio`**, with the stamped property
**unchanged** across the update. That is AC1's *"no-reload half proven (e.g. a stamped window
property surviving the update)"*, verbatim.

### AC3 — met

Primary colour changed to `#3ba55d` on the deployed panel, `Save theme` pressed. The anonymous
site's resolved `--primary` moved `#d9a441` → `#3ba55d`, **one transition, same stamp, no reload**.
Restoring it repainted back — the arc runs both ways.

### AC4 — met, with the firing twin beside it

Back to back, same page, same stamp:

| owner edits | changes seen | nav | canary on page |
|---|---|---|---|
| a **draft** | **0** | unchanged | absent |
| a **published** page | **1** | changed | present |

The draft's canary never appeared even after the published event, so its payload was not late. The
stamp survived both, so the silence is a reading and not a wiped instrument. **Exactly one** change
per event — §4's cardinality trap held.

### 🔴 A trap this run paid for — and the product was right, the instrument was wrong

The first attempt published by writing `published: true` over REST. The nav did **not** gain the
link, and that was **not** a propagation defect. The ACLs say why:

| published via | ACL |
|---|---|
| the panel's `Publish` | `{"role:admin": …, "*": {"read": true}}` |
| a bare REST write | `{"role:admin": …}` — **admin only** |

`published` is a flag; the **ACL** is the gate, and `publishPage` sets both. ✅ **Drive the
product's own path before calling a difference a defect.**

### ⬜ Still open

- **AC2** — a section edit on the currently-viewed page updating live was not separately driven.
- **AC5** — the hub-unreachable degradation arc is undriven.
- **D46**'s drive is still owed.
