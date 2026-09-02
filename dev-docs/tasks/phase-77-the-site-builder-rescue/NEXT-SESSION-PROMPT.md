# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s40 ran D45 to ground. It was two defects. The harness half is fixed; the product half is [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46).**

**Seven tasks built in eight sessions.** s33 SBR-006, s34 SBR-015, s35 SBR-012, s36 SBR-005,
s37 SBR-009, s38 SBR-010, s39 SBR-011, s40 D45.
🔴 **One task has still never been started** — **SBR-013** — and the phase cannot close until it is.

Read in this order:

1. **[TASKS.md → s40](TASKS.md)** — what was measured and the four lessons.
2. **[D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46)** — the product defect, with the fix named and sized.
3. **[SBR-011 §5](SBR-011-LIVE-PREVIEW-OVER-THE-REALTIME-HUB.md)** — AC3's verdict, now with a cause.

---

## 🔴 THE BOARD — re-derived from the task FILES, 2026-09-02

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

⚠️ **Two sessions have now gone to defects rather than tasks** (s39 to D44, s40 to D45). The rule's
own arithmetic — *2 sessions, 0 ACs ⇒ the next MUST build* — is therefore live, and it points at
SBR-013. **D46 blocks AC3 and is real, but it is one AC on a task that is otherwise met, and the
phase's end condition is SBR-013 + SBR-014.** The recommendation below follows the rule; if you
disagree with it, say so in the file rather than quietly reordering.

### 🟢 FIRST JOB: **SBR-013 — the doctrine rule**, the last never-built task

| | what | note |
|---|---|---|
| **first** | **SBR-013** | Doctrine text across **three** surfaces (MCP `instructions`, the task template, `lessons/authoringBrief.ts`), and its AC2 wants a **cold authoring session driven** — read the transcript, not the text. ⚠️ `instructions` are fixed at `initialize` and the tool surface has **three token-budget gates**: measure the addition **on the wire**. |

### 🔴 THEN: **D46** — it is the only thing blocking SBR-011 AC3

| | what | note |
|---|---|---|
| next | **[D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46)** — six subscriptions silence the app | The fix is **one shared SSE connection per backend with a registry POSTing the union**, and the row names the two traps: per-subscription **filters** would over-deliver on a shared stream, and the **PocketBase** dialect keys its change event on the collection name so listeners must be added and removed with the registry. ⚠️ **Do not close it by raising the 15s deadline.** Then re-run `sbr011-live-preview-drive` and settle AC3 — `liveCollections` names which of the three went live. |
| then | **SBR-003** — the `var(--token)` dimension-port probe, and nothing else | it also owns **D38**, a hypothesis nobody has rendered |
| last | **SBR-014** — the gate on closing phase 77 | it also owes SBR-009's AC1 live half and AC3 — **not blocked**, `helpers/site-drive.ts` has existed for twelve sessions |

---

## 🔴 What s40 learned that the next drive will need

- 🔴 **When a client-side timeout has no server-side counterpart, read the BROWSER's own clock
  before theorising about the wire.** `performance.getEntriesByType('resource')` gives `fetchStart →
  requestStart` (**queued**, the request has not been sent) separately from `requestStart →
  responseStart` (**wait**, the server is taking that long). Three sessions reasoned about the
  server and the proxy from a message that could not tell those apart. The reading was
  `queued 15007ms, waited 5ms`.
- 🔴 **A symptom with two causes is closed by neither fix alone.** The leak fix took SBR-011's open
  streams from **15 to 3** and changed the confirmation behaviour *not at all*. A drive that only
  counted streams would have certified a fix that was not the fix.
- 🔴 **Six is the ceiling on a single origin.** Any drive or app holding six never-ending streams
  can make no other request to that origin. This is measured
  (`d45-realtime-proxy-timing.test.ts` §4), not inferred.
- 🔴 **Run the sibling drives before AND after a harness change.** s40's fix looked like it reddened
  24 tests; the identical 24 are red with the fix reverted and at committed HEAD ([D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47)).
- ⚠️ **A starved request is not slow, it is not sent** — cap it and record the cap as the reading.
  The uncapped probe sat **174 seconds** and killed the suite on its own timeout.
- ⚠️ **`packages/nodegx-backend/tsconfig.json` excludes `**/*.test.ts`.** `npx tsc -p` over it grades
  **no drive at all**. **The jest run is the typecheck.**

---

## 🔴 The register

### [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46) — 🔴 NEW, owner `NONE`. Six realtime subscriptions on one origin silence the app

The delay half of D45, and larger than the row it came from. `SseTransport` opens one never-ending
stream per subscription; the registration POST each one requires competes for the same per-origin
pool those streams hold. **The pool is six.** Blocks SBR-011 AC3. Fix named and sized in the row.

### [D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47) — ⚠️ NEW, owner `NONE`. Two drives are red in the working tree

`sbr010-messages-drive` 17/17 and `sb008-public-site-drive` 7 fail. ✅ **Not D45's fix** — measured
with the fix reverted and at committed HEAD. `sbr010` draws **no text input at all**
(`querySelectorAll('input, textarea')` is empty). Phase 82's REL-002a edits to `text-input.ts` and
the host stylesheet are in the tree and in the built bundle — a lead, not a finding. **Re-derive,
do not relay.**

### [D45](DEFECTS-THE-SITE-BUILDER-FOUND.md#d45) — 🟡 half closed. The leak is fixed

`render-from-disk.js`'s proxy now destroys its upstream when the downstream closes. Mutant-graded.

### [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) — nothing on a published page scrolls. Owner SBR-002

**Unchanged, still the cheapest open control in the phase:**

> Render `templates/members-area/` through the **same** `withRenderedPage` and read the same four
> numbers. If it scrolls, D40 is the site-builder's ground and SBR-002 owns a real defect. If it does
> not, D40 is `render-from-disk.js` and the row is about the harness.

⚠️ It still contradicts phase 81's VIB-001 (`unreachablePx: 0` on all 44 shots); **two instruments
disagree and neither reading is safe to relay until one is re-derived.** ⚠️ **Phase 82's REL-002a is
now editing exactly this** — `render-from-disk.js` serves the product's own host stylesheet in the
working tree, which is the change D40 has been waiting on. **Check that lane before re-deriving.**

### [D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43) — a refused list says "No pages yet". Owner `NONE`

Unchanged. `/Pages/Admin`'s `count` is still wired `true`; `sbr010Messages.test.ts` holds it as a
measurement, so a fix reddens the arm.

### [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) — the hero's scrim vs `colorOnPrimary`. Owner SBR-003

⚠️ A hypothesis with a named test, not a finding. Nobody has rendered it.

---

## 🔴 The phase's end condition, unchanged

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. It cannot
start while SBR-013 is unbuilt. 🔴 **That is the distance to done — not the length of the register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — **D15**, no drop-target capability in the runtime for a
file arriving from outside the page, re-measured at HEAD with a boundary control at s29.
**Phase 77 must not close pretending AC3 is met.**

⚠️ **AC1 of SBR-005 has a second half nobody has ruled**, and **SBR-009 AC1 has a companion
question**: whether the five section kinds and the rebuilt theme editor are worth *looking* at is
Richard's. The SBR-005 pictures are in
`dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/sbr-005/2026-09-01/site-builder-living/`;
**no pictures have been taken of the theme editor, the Messages screen, or the live site updating** —
every drive since s37 has measured computed styles and text, not screenshots, and a shot list is a
cheap thing to add.
