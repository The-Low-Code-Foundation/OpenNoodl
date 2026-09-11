# Defects phase 76 found — the register this phase never had

**Created 2026-08-29, after the phase closed.** Richard, on being handed a sweep of phases 77 and
78: *"don't forget phase 76."*

He was right, and it was the largest finding of that sweep. Phase 76 recorded **28 numbered
findings (F1–F28)** across eighteen task files and a 97KB `TASKS.md`, and **had no register at
all** — the same state phase 77 was in for ten sessions, one phase older and nearly three times the
size. A sweep of the two phases that *have* a register would have reported a clean bill for the
phase that does not.

## 🔴 The headline is the opposite of what a rescue file usually says

**Phase 76 did the follow-through properly, and it is the control that proves the other two phases
did not.**

| | |
|---|---|
| findings recorded | **28** |
| **resolved** — fixed in the session that found them, or by a task that is now done | **20** |
| owned by a task that was still **`⬜ open` at close** | **4** (F1, F10, F12, F13) |
| still real and **unowned** | **3** (F3 with a corrected premise, F15, F16) |
| open **ruling** | **1** (F8, Richard's, since s4) |

F18 was fixed in `QueryBuilder.ts` in the session that found it; F22, F24, F25, F26 and F27 all
landed the same way. **That is the standard**, and it is what phases 77 and 78 should be measured
against — not the other way round.

🔴 **CORRECTED 2026-08-29 at close.** The first version of this table counted **24 resolved**,
because it read *"F10, F12, F13 → SB-010, SB-011"* as a resolution. **It is not.** SB-009, SB-010,
SB-011 and SB-012 were all `⬜ open` when the phase closed — measured, worked around in the
template, and never fixed in the product. **An owner in a closing phase is not an owner**; it is a
row about to become unowned again, wearing a task id. All four are carried into phase 80.

⚠️ **This register is retrospective.** Everything below is read from the phase's own task files
except the four rows marked **re-measured**, which were checked at HEAD on 2026-08-29.

## Still real and unowned → phase 80

| id | finding | re-measured at HEAD | now owned by |
|---|---|---|---|
| **F15** | 🔴 **A bare number on a dimension port is read as a percentage.** | ✅ **REAL** — `react-component-node.ts:1925`: `if (typeof value !== 'object' && type.defaultUnit) value = { value, unit: type.defaultUnit }`. `width: 240` → `240%`. | **[DEF-003](../phase-80-the-defects-the-templates-found/DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md)** |
| **F16** | ⚠️ **A `Page` node's `title` port is dead after export**, so a records-driven title needs `Noodl.SEO.setTitle` — on the template whose product is SEO. | ✅ **REAL, and sharper than recorded.** The door returns `"notFound": ["title"]` and states why: *"`title` and `urlPath` are registered per instance **by the editor connection**"*. It is not that the title dies at export — **an agent authoring headlessly cannot set one at all.** | **[DEF-003](../phase-80-the-defects-the-templates-found/DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md)** |
| **F3** | ⚠️ **`submitContactForm` is a public door that writes rows** and *"no rate limiting was found in the sweep… Open question for Richard / possibly a core gap to file."* | 🔄 **PREMISE HALF REFUTED.** Rate limiting exists at HEAD (`ops/rate-limit.ts`, 65 references) **including per function** — `PUT /admin/permissions/functions/:name` sets `call / runAs / rateLimit / timeoutMs`. **The real row is narrower and still real:** a template shipping a public write endpoint sets no limit, and nothing warns. | **[DEF-009](../phase-80-the-defects-the-templates-found/DEF-009-A-PUBLIC-WRITE-DOOR-WITH-NO-LIMIT.md)** |

🔴 **F3 was never filed anywhere.** It says *"possibly a core gap to file"* and appears exactly once
in the entire phase. It is the clearest instance of the failure this register exists to stop: a
security-relevant finding that ended its life as a sentence in a task file.

## 🔴 F15 is the cost of an unowned row, measured

**Phase 77 recorded the same defect independently as D8**, one phase later, without knowing F15
existed. Two phases, two measurements, two write-ups, **zero fixes**. An unowned row does not sit
still and wait — it gets rediscovered, at full price, by someone who then also does not own it.

## Open ruling

- 🧭 **F8 — `contactRecipient` cannot live in a world-readable `SiteSettings` row.** Richard's,
  carried since **s4**, still open. It blocks the claim that a contact form reaches anyone.
  Recorded in [phase 80's TASKS.md](../phase-80-the-defects-the-templates-found/TASKS.md) so it
  stops being invisible.

## Owned by a task that was still open at close → carried into phase 80

🔴 **All four were measured, worked around in the template, and never fixed in the product.** Read
phase 76's task file for the measurement; phase 80 holds the schedule.

| finding | was | now | why it matters |
|---|---|---|---|
| **F1** | SB-009 ⬜ | **[DEF-010](../phase-80-the-defects-the-templates-found/TASKS.md)** | a component named in a **parameter** is unchecked; the same name as a node **`type`** IS refused. **One spelling of the same reference goes unresolved.** 13 `component`-typed ports, 1 has an owner |
| **F10** | SB-010 ⬜ | **[DEF-011](../phase-80-the-defects-the-templates-found/TASKS.md)** | 🔴 **every cloud component any agent authors** has dead custom signal outputs once deployed — **a 30s 504, not an error**. Same symptom phase 77's SBR-015 spent a session on |
| **F12, F13** | SB-011 ⬜ | **[DEF-012](../phase-80-the-defects-the-templates-found/TASKS.md)** | a cloud query returns **every row** when asked for a few, two independent ways |

⚠️ **F10's workaround survives in the shipped template** — verified 2026-08-29: `publishPage`'s two
`JavaScriptFunction` nodes declare `out-ready` / `out-built` as output signals in their `ports`
field, and the wires use those names. So SB-010 does **not** explain SBR-015's hang here. That is a
refutation worth keeping: it was a candidate that fitted.

## Fixed in-session — the other 20

| ids | disposition |
|---|---|
| **F2** | the two enforcement layers are not switched together — handled as a **drive discipline**: every drive asserts `started.security.enforced === true` first |
| **F4** | process, not product — a stale MCP `dist`. Vehicle changed to `createServer` from `src` |
| **F5, F6, F7, F9, F11, F14, F17, F19, F20, F21, F22, F23, F24, F25, F26, F27, F28** | fixed in-session, or → **SB-013**/**SB-014**/**SB-016**, all ✅ done |
| **F18** | fixed in `QueryBuilder.ts` (`convertQueryValue`) — a boolean literal could not bind on SQLite at all, and the public site had no navigation on any page |

⚠️ **F9 is real and by design** — the door makes node ids unique project-wide, so an authored node
id is a request, not a handle. Kept because it surprises everyone once.

## House rules, inherited

- 🔴 A row is a **measurement**, not an impression.
- ⚠️ **Disproved and corrected rows stay, marked** — F3's half-refuted premise is more useful than
  either the original claim or silence.
- Each row names **where it bites a person**.
- 🔴 Each row carries an **owner, or the literal `NONE`**.
