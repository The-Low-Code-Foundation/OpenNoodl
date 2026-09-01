# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s38 built SBR-010 — all four ACs DRIVEN, and the drive found a defect that had been shipping since SB-004.**

**Six tasks in six sessions.** s33 SBR-006, s34 SBR-015, s35 SBR-012, s36 SBR-005, s37 SBR-009,
s38 SBR-010.
🔴 **Two tasks have still never been started**, and the phase cannot close until they are.

The contact form has stored rows since SB-004 and **nothing had ever read one back**; the admin rail
has carried a *Messages* item since SBR-006 and it went nowhere. Both ends are closed:
`/Pages/Messages` (11 nodes), `/Admin/MessageRow` (9 nodes), and `goMessages` + one wire on
`/Admin/Shell`. The template regenerates at **33** components from 31, and **7** pages from 6.

Read in this order:

1. **[SBR-010 §5](SBR-010-MESSAGES.md)** — the shape and the four AC verdicts, all driven.
2. **[TASKS.md → s38](TASKS.md)** — the session log and the nine lessons.
3. **[D42 and D43](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — both new, one fixed, one owned by `NONE`.

---

## 🔴 THE BOARD — re-derived from the task FILES, 2026-09-01

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

s38 filed **two** new rows. D42 was fixed in the session because it was in the graph the task was
shipping; D43's twin was deliberately left alone and is registered with `NONE`.

### 🟢 BUILD THIS: **SBR-011 or SBR-013** — pick one and build it

| | what | note |
|---|---|---|
| **next** | **SBR-011 / SBR-013** — never built | **SBR-011 was ruled BUILD, not strike.** SBR-013 is doctrine text across three surfaces, and its AC2 wants a cold authoring session driven |
| then | **SBR-003** — the `var(--token)` dimension-port probe, and nothing else | |
| last | **SBR-014** — the gate on closing phase 77 | it also owes SBR-009's AC1 live half and AC3 — **and those are NOT blocked, see below** |

---

## 🔴 THE BIGGEST THING s38 CORRECTS IN THIS FILE

**s37's handoff said: *"No test in this repository drives with a backend yet — that is the cost, and
it is SBR-014's to pay once for several ACs at the same time."*** That is false against the tree, and
it was false when it was written.

`packages/nodegx-backend/tests/` has driven with a real backend for ten sessions:

- `helpers/site-drive.ts` — `authorSiteTemplate()` authors the whole template through the real MCP
  server, `makeSiteDataDir()` writes the shipped policy, `bindProjectToBackend()` points the project
  at it, and `withRenderedPage({ projectDir, backendPort })` drives headless Chrome against it;
- `sb008-public-site-drive`, `sbr006-unpublish-drive`, `sbr015-execution-steps-drive`,
  `tpl001-members-drive`, `tpl002-account-drive`, and now `sbr010-messages-drive`.

🔴 **So SBR-009's AC1 live half and AC3 are not blocked on building an instrument** — they are one
session's use of one that already exists. `sbr010-messages-drive.test.ts` is the shortest worked
example: sign up, `claimSite`, seed, three `withRenderedPage` arms, ~4 minutes.

✅ **A relayed blocker is a claim about an artefact. Re-derive it from the tree before pricing work
around it.**

---

## 🔴 The register: two new rows, and two still open from before

### [D42](DEFECTS-THE-SITE-BUILDER-FOUND.md#d42) — 🟢 FIXED s38. The one public endpoint stored every enquiry TWICE

Three anonymous visitors pressed **Send** once each; the store held **six** rows. The browser was
never at fault — three `submitContactForm` runs, and each run's step list read
`fallback → pick → save` **twice**, because `ContactRecipient`'s `SiteSettings` query had its
load-time fetch ticked *and* a `storageFetch` wire. The node's own comment named the rule it was
breaking, from a premise (*"this node has no `storageFetch` wire"*) that its own wire list
contradicts eight lines below. Fixed; the drive asserts `stores: 1` exactly.

🔴 **It had been shipping since SB-004 and nothing could see it, because nothing had ever read a
`ContactMessage` back.** The endpoint had been driven repeatedly for its RESPONSE, and the response
is correct on both paths.

### [D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43) — 🔴 OPEN, owner `NONE`. A refused list says "No pages yet"

Fixed on `/Pages/Messages`; **`/Pages/Admin`'s `count` is wired identically and still says `true`**,
so the page list is expected to render the refusal AND *"No pages yet"* to a signed-in non-admin.
Left alone on purpose: that screen carries SBR-006's, SBR-015's and SBR-016's verified ACs.

✅ **The row is a MEASUREMENT, not a note.** `sbr010Messages.test.ts` asserts `/Pages/Admin`'s flag
is still `true`, so the day somebody fixes it the arm reddens and the row gets closed.

### [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) — nothing on a published page scrolls. Owner SBR-002

**Unchanged, and still the cheapest open control in the phase:**

> Render `templates/members-area/` through the **same** `withRenderedPage` and read the same four
> numbers. If it scrolls, D40 is the site-builder's ground and SBR-002 owns a real defect. If it does
> not, D40 is `render-from-disk.js` and the row is about the harness.

⚠️ `stat` the members-area tree before running it and re-check `tpl001Template` is green first — s37
skipped it because a peer was mid-edit there. ⚠️ It still contradicts phase 81's VIB-001
(`unreachablePx: 0` on all 44 shots); **two instruments disagree and neither reading is safe to relay
until one is re-derived.**

### [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) — the hero's scrim vs `colorOnPrimary`. Owner SBR-003

⚠️ A hypothesis with a named test, not a finding. Nobody has rendered it. `sbr009ThemeEditorDrive`
shows how to put a preset's tokens on a subtree and read the computed result with no backend.

---

## ⚠️ FOUR reds in `test:main` that are NOT s38's, and one that WAS

The four were measured by putting **HEAD's artefact** back for one run (md5-checked in and out):
`sb-018 (1)` ×2 (`/Admin/SectionRow` gained `DropAt`/`DropIndex` and the census was never moved),
`sb-018 (3)` (`/Site/SectionView body` has no standing value), and `aib-007`
(`noodl.cloud.listusersinrole` unclassified — that one reads no template at all). Owner: `NONE`.

🔴 **And `test:ci`'s SB-017 acceptance 6 was red at HEAD by SIX.** Its `browserFunctions.length`
literal said **26** while the committed artefact carried **32** — SBR-005's section kinds and
SBR-009's theme editor both moved it and neither session ran `test:ci`, which is the *third*
consecutive session that has happened (the comment on that case already records SBR-006's). s38 set
it to **34** and re-ran the gate.

✅ **A literal gate only works if somebody runs it. Run `test:ci` in any session that regenerates the
template** — the count is the population, and while it is stale the assertion under it does not run
at all.

---

## 🔴 The phase's end condition, unchanged

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. It cannot
start while two tasks are unbuilt. 🔴 **That is the distance to done — not the length of the
register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — **D15**, no drop-target capability in the runtime for a
file arriving from outside the page, re-measured at HEAD with a boundary control at s29.
**Phase 77 must not close pretending AC3 is met.**

⚠️ **AC1 of SBR-005 has a second half nobody has ruled**, and **SBR-009 AC1 has a companion
question**: whether the five section kinds and the rebuilt theme editor are worth *looking* at is
Richard's. The SBR-005 pictures are in
`dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/sbr-005/2026-09-01/site-builder-living/`;
**no pictures have been taken of the theme editor or of the new Messages screen** — both drives
measured computed styles and text, not screenshots, and a shot list is a cheap thing to add.
