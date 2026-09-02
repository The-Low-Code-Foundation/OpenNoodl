# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

---

## 🟢 THE BOARD — re-derived from the task FILES, 2026-09-02 (s44)

| task | state, read off its own file |
|---|---|
| SBR-001 | ✅ closed s2 — now owns **D49** and **D50** (both filed s44, neither blocking) |
| SBR-002 | ✅ closed s4 |
| SBR-003 | 🟡 built s4 — owes the `var(--token)` dimension-port probe; owns [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) |
| SBR-004 | ✅ built s5, driven s8b |
| SBR-005 | 🟡 built s36 — AC1's second half is **Richard's to look at** |
| SBR-006 | ✅ closed s33 |
| SBR-007 | 🟡 **AC3 CANNOT BE MET** — D15, no runtime drop-target capability |
| **SBR-008** | 🔴 **AC1 UNMET — and it is now the phase's blocker.** See below |
| SBR-009 | 🟡 built s37 — AC1's live half and AC3 owed to SBR-014 |
| SBR-010 | ✅ built and driven s38 |
| SBR-011 | 🟡 built and driven s39 — **AC3 open; D46 fixed s42, drive still owed** |
| SBR-012 | ✅ built s35 |
| SBR-013 | ✅ closed s41 |
| **SBR-014** | 🔴 **RUN 1 DONE s44 — reached step 3 of 8. Steps 3–8 ⬜, blocked on SBR-008 AC1** |
| SBR-015 | ✅ built s13 |
| SBR-016 | ✅ fixed and driven s15 |
| SBR-017 | ✅ built and driven s14 |

---

## 🔴 FIRST JOB: **SBR-008 AC1**. It blocks SBR-014, so by the standing rule it is the job

s44 ran SBR-014, the phase's acceptance drive, through the panel's UI on a wizard-created project.
**It got to step 3 and stopped, and the reason is a criterion this phase already knows is unmet.**

**Full record — read this first:**
[`notes/sbr014/SBR-014-DRIVE-2026-09-02.md`](notes/sbr014/SBR-014-DRIVE-2026-09-02.md)

### What was measured

A page created through the **New page dialog** persists **no title and no slug**. The **page
editor's save** then writes nothing at all — `updatedAt` did not move. Driven twice, through two
different input methods (`cdp type`, and a native value setter + `input` event), so it is not the
harness. The `Page` table never gains the columns:

```
Page columns: ['objectId','createdAt','updatedAt','ACL','published','showInNav','navOrder']
```

The three columns that *are* written are exactly the three the create node holds as **literal
parameters**. The two missing are exactly the two that arrive **over a wire**
(`closeResult-title → prop-title`, `closeResult-slug → prop-slug`).

### Why this is SBR-008 AC1 and not a new defect row

[SBR-008 §6.4](SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md) already drove this symptom and named
the cause — on a fresh site a column exists only once something has written it, and the graph that
writes it is the graph whose `prop-` ports are missing, so the wire is dropped as unhealthy and
*"the panel writes a page with no title, and the save reports success."* §6.5 records **AC1 as
unmet** and says of the browser side: *"nothing yet fixes it."*

🔴 **What s44 adds is the severity.** In SBR-008's own drive `Title` **saved correctly**, because
that fixture's `Page` class already had the column; only `seoDescription` was lost. On a
**wizard-fresh site there is no column for anything**, so the loss reaches the *primary* fields and
it is a deadlock with no way out through the UI: the only way to create the column is to write it,
and the wire that would write it is the one being dropped.

### 🔴 The one thing s44 did NOT measure — do this first, it is cheap

The **runtime half of the fix is present and shipped**: `recordWiredFieldPorts` is called from
`dbmodelcrudbase.ts:392` with `plug: 'input'`, and it is in the built viewer bundle
(`recordWiredFieldPorts` ×6, `recordWiredFieldNames` ×3, control `recordFieldPorts` ×5).

**So the surviving explanation is the editor-side export/health path dropping the wire before the
viewer ever sees it — and that was not confirmed on this fixture.** SBR-008 §6.4 measured it on
*its* fixture (four `prop-` wires unhealthy, exactly the columnless ones). Confirm it on
`sbr014-drive`, then fix the export half. ⚠️ **Do not fix the runtime half again — it is already
there.** That is the trap this hand-off exists to prevent.

✅ **Population check already done:** `record-ports.ts`, `dbmodelcrudbase.ts` and the export path
are all **clean in `git status`** — the defect is in committed code, not a peer's in-flight edit.
The one dirty template file (`site-builder.content.json`, +6 lines) is the D46 realtime work and
does not touch the create wiring.

### ✅ The fixture is left ready — do not rebuild it

`sbr014-drive` (in `NodeGX test projects/`) is **claimed and sitting in the admin shell**, so the
next session resumes at step 3 without repeating the wizard or the claim:

- backend `backend_mtkip2rjf20ct`, port **8604**; owner `owner@sbr014.test` / `DriveMe123!`
- setup token `sbr014-drive-setup-token`, already provisioned under `functions`
- **two nameless `Page` rows are in it — they are the repro**

---

## 🟢 THEN: finish SBR-014 from step 3

Steps 3–8 are ⬜ and unreached; **nothing about them has been disproved**. Once a page can hold a
title and a slug, the drive continues into the public site, the theme, the live repaint, Messages
and the deploy — and it collects **SBR-009's AC1 live half and AC3** and **SBR-011 AC3** on the way.

⚠️ **SBR-014 AC2 is the criterion that was met, and the only one.** Every unreached step is ⬜
against its task by name in the record. Keep it that way — nothing rounded off.

⚠️ **AC3's screenshots (steps 4, 5, 7) do not exist**, because those steps were never reached.
Four other pictures were taken. 🔴 **The preview window is 456×313 css px — resize it before any
run that owes a look**, or the shots are worthless to Richard.

⚠️ Pre-known and unchanged: **SBR-007 AC3** ⬜ (D15, no runtime drop-target capability). The phase
must not close pretending otherwise.

⚠️ **SBR-011's D46 drive is still owed** and is the peer's lane — the fix landed s42 and is **now in
the built bundle** (s44 rebuilt it: `SharedSseConnection` 10, `openConnectionCount` 4, against
0/0/0 before). `sbr011-live-preview-drive` has not been re-run.

---

## 🔴 New rows filed by s44 — both with owners, neither blocking

### [D49](DEFECTS-THE-SITE-BUILDER-FOUND.md#d49) — the claim screen shows both failure sentences before anything is attempted. Owner SBR-001
Measured visible on first render (`display:flex`, `opacity:1`, 708×19px, on top per
`elementFromPoint`). Both `Text` nodes ship `"visible": false`, but that parameter is **inert** — a
`Condition` with `runOnChange-condition: true` and a literal `condition: true` fires at init and
pushes `true` before any `failure` reaches its `eval`. **Confirmed at HEAD** (`claimGate`,
`signupGate`), so it shipped. 🔴 Not cosmetic: a *real* failure then looks identical to the initial
state — which is exactly what happened during the s44 drive. Fix is
`runOnChange-condition: false` on both gates, via a template **regenerate**, not a hand edit.

### [D50](DEFECTS-THE-SITE-BUILDER-FOUND.md#d50) — a person who finishes the wizard cannot claim their site. Owner SBR-001
`claimSite` needs `SITE_SETUP_TOKEN`; provisioning never writes it. Measured on the fresh backend
(`adminToken` only) **with a control** (ten other backends do carry it). Known cost (SB-015 §6),
worked around by every prior drive — but never registered as a person-facing row, and SBR-014 is
the task whose subject is the person's story. ✅ Re-claiming **adopts** the orphan account rather
than locking the person out.

---

## 🔴 The register's older open rows, unchanged

- **[D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48)** — owner `NONE`. Seven tokens of MCP surface
  headroom (~28 chars). **Anything that widens a tool description is a design question, not an edit.**
- **[D45](DEFECTS-THE-SITE-BUILDER-FOUND.md#d45)** — 🟡 half closed; the leak is fixed, mutant-graded.
- **[D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40)** — nothing on a published page scrolls. Owner
  SBR-002. Still the cheapest open control in the phase; ⚠️ contradicts phase 81 VIB-001.
- **[D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43)** — a refused list says "No pages yet". Owner `NONE`.
- **[D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38)** — hero scrim vs `colorOnPrimary`. Owner SBR-003.
  ⚠️ A hypothesis with a named test; nobody has rendered it.
- **[D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47)** — ✅ closed s43.

---

## ⚠️ Uncommitted work in the tree — read before you commit anything

`DEFECTS-THE-SITE-BUILDER-FOUND.md` now carries **three sessions' rows**: the peer's D46 row (s42),
s43's D47 closure, and s44's D49/D50. **Whoever commits it commits all three — say so in the
message.** Also uncommitted and load-bearing: `SseConnectionPool.ts` (untracked — `git add` it
explicitly, a pathspec commit skips untracked files **silently**), the three `noodl-runtime`
realtime edits, `sbr011-live-preview-drive.test.ts`, phase 82's edits to `text-input.ts` and
`render-from-disk.js`, and the `site-builder.content.json` realtime lines.

s44's own new files: `notes/sbr014/` (untracked) and the appends to `SBR-014-THE-DRIVE.md`.

---

## 🔴 Traps s44 paid for — read before driving the editor

- 🔴 **`grep` skipped every `.tsx` silently.** A plain `grep -rn` for the wizard returned hits *only*
  inside `index.bundle.js` and read as *"the wizard is stale-bundle-only"*. `grep -ra` found eleven
  real source hits. **An absence measured without `-a` is unmeasured.**
- 🔴 **"The click did nothing" was a control reading zero.** The wizard *had* opened; the probe was
  looking at `#root`'s innerText and `.dialog-layer`, neither of which is where it renders.
  **Check the container before believing an absence.**
- 🔴 **`input[type="text"]` matched nothing** — `type` in a probe was the DOM *property* default;
  there is no `type` attribute. A client property read as a fact about the markup.
- ⚠️ Wizard entry-mode cards: the clickable element is `button[class*=ModeCard-hit]`.
- ⚠️ Five of eight backend surfaces (**Secrets** included) are behind the card's `···`
  (`[data-test=local-backend-more-<backendId>]`), and that menu renders **outside** `.popup-layer`.
- ⚠️ Page routes are the `Page` node's `urlPath` (`admin/setup`, `admin/pages`), **not** the
  component name. `/setup` falls through to the public catch-all at `{slug}`.
- ⚠️ The renderer does not mount until webpack-dev-middleware has finished
  `/src/editor/index.bundle.js`. `health` reads `reactMounted: false` until then — wait for the
  bundle to serve 200, **then** reload. It is not a crash.

---

## 🔴 The phase's end condition

**SBR-014 is still the gate on closing phase 77**, but the distance to done is now
**SBR-008 AC1 → the rest of SBR-014**, plus the peer's owed D46 drive. 🔴 That is the distance, not
the length of the register.

⚠️ **SBR-007 AC3 cannot be met at all** (D15). Phase 77 must not close pretending otherwise.

⚠️ **Richard still owes two looks**, and no session can substitute: the five section kinds
(SBR-005 AC1) and the rebuilt theme editor (SBR-009 AC1). s44 produced **the phase's first picture
of the admin shell** (`notes/sbr014/step2-admin-shell.png`) — but it is 456×313 and still no
picture exists of the theme editor, Messages, or the live site updating.
