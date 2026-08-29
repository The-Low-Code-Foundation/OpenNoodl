# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: the sweep is done, phase 76 is closed, and the drive is owed twice

**s11 (2026-08-29)** swept phases 76, 77 and 78 — 54 findings, re-measured at HEAD — then closed
phase 76 with everything open carried forward or dropped **by name**. What it did **not** do is the
drive, which s10 also owed. **That is the first job.**

Read in this order:

1. **[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md)** — all 54, four columns each.
2. **[phase 80](../phase-80-the-defects-the-templates-found/TASKS.md)** — **13 tasks**, ranked by who
   they bite.
3. **[phase 76's closing section](../phase-76-the-site-builder/TASKS.md)** (end of the file) and its
   **[new register](../phase-76-the-site-builder/DEFECTS-PHASE-76-FOUND.md)**.

🔴 **The lesson that cost the most: "owned" was too generous, and it was the sweep's own trap.** The
first pass counted three rows as owned and stopped. Checking the *owners* rather than the assignment:
**SB-009, SB-010, SB-011, SB-012 and SBR-008 are all `⬜ open`.** An owner in a closing phase is not
an owner — it is a row about to become unowned again, wearing a task id. The check is not *"does a
task id appear?"* but ***"is that task open, and does its phase outlive this one?"***

---

## 🔴 FIRST JOB — the SBR-015 drive. Owed by s10 and s11; do not defer it a third time

**Publish a page with zero sections** (the drive's page `0826ed8b` had none — `Section: 0` across the
site) and read what happens.

### 🆕 s11 read the graph and the runtime, and it makes a falsifiable prediction

⚠️ **This is a reading, not a measurement — it is here to be refuted, not believed.** But it turns
"two candidates" into one crisp question.

`publishPage`'s post-SBR-015 wiring, traced from the artefact:

```
req.receive → prep.run
prep.out-pageId  → sections-3.qp-pageId          (a filter PORT, so the query re-fetches)
sections-3.items → withFlag.in-sections
sections-3.fetched → withFlag.run
withFlag.out-tasks → tasks.items ; withFlag.out-built → tasks.run
tasks.done → page-6.store ; page-6.done → res.send
prep|sections-3|withFlag|tasks|page-6 .failure → deny.send      ← SBR-015 added these
tasks.unchanged → deny.send                                     ← and this
```

Three source readings, each of which the drive can falsify:

1. **The guard passes.** `withFlag` returns early only if `Inputs.sections === undefined`. `items`'s
   getter returns `_internal.collection`, which `setCollection` **binds after a fetch** — so an empty
   fetch yields a bound collection, not `undefined`. And a Collection is an **array-backed Proxy**
   (`collection.ts`), so `.map` works.
2. **So `withFlag` runs**, publishes `out-tasks = []` and fires `out-built` → `tasks.run`.
3. **`Run Tasks` with an empty list fires `done`, not `unchanged`.** Its own port description:
   *"Fires when the run ended having done its work: every task completed without failing, **the Items
   list was empty**, or an Abort was honoured."* `unchanged` is for *"a Do while a run is already in
   progress"*.

🔴 **Prediction: the zero-section publish now SUCCEEDS** — `tasks.done` → `page-6.store` →
`page-6.done` → `res.send`.

### What each outcome means — this is the point of the drive

| what you see | what it means |
|---|---|
| **succeeds, fast** | the reading holds. 🔴 Then the 30s hang had a cause the failure-wiring did **not** address, and it is **still present** — SBR-015 §2.3 stays open and the repro is wrong, not the diagnosis |
| **fast `deny`** — *"This page could not be published."* | a node genuinely **failed** → **candidate 1** (the query against a `Section` schema created in that same second). SBR-015's fix is what made it speak. ⚠️ Also then a **template defect in its own right**: a page with no sections is legitimately publishable |
| **still hangs 30s** | **candidate 2** — a guarded `return` somewhere, which is **not** a failure and so reaches no `deny`. Refutes reading 1 above; find which guard |

Record the answer in **SBR-015 §2.3 whichever way it goes**, including "it simply succeeds".

⚠️ **A candidate that fitted and is now REFUTED, so nobody re-derives it:** phase 76's **SB-010** —
a deployed `JavaScriptFunction`'s custom signal outputs are dead unless the graph declares them as
ports, which is *also* a 30s 504. Checked at HEAD: `publishPage`'s `prep` and `withFlag` **do**
declare `out-ready` / `out-built` in their `ports` field and the wires use those names. The
workaround survived regeneration. **Not the cause here.**

⚠️ Needs a project minted from the **regenerated** template. The running editor holds the project in
memory, so an on-disk patch never reaches the viewer.

---

## 🔴 SECOND JOB — phase 80, top of the rank

**[DEF-001](../phase-80-the-defects-the-templates-found/DEF-001-THE-DEFAULTS-FAIL-ACCESSIBILITY.md)**
is the only row whose harm lands on **someone who never chose NodeGX**. Measured at HEAD,
`--primary-foreground` on `--primary` against the 4.5:1 AA floor:

| preset | ratio | |
|---|---|---|
| **defaults / `modern`** | **3.68** | 🔴 the wizard's default — and `ModernPreset` ships `tokens: {}`, so this is `DefaultTokens.ts` |
| `playful` / `soft` | **4.23** / **4.47** | 🔴 |
| `minimal` / `enterprise` | 17.72 / 17.85 | ✅ |

Plus `textinput`'s `default` border at **1.33:1** against WCAG 1.4.11's 3:1 — where `--border-control`
already exists and already passes.

🧭 **Needs a ruling first:** does `--primary` move, or `--primary-foreground`? It changes every
project created after it.

---

## 🔴 Phase 76 is CLOSED — what came across, and what did not

Four tasks were `⬜ open` at close and are now phase 80's, **by reference** (the P76 files keep the
measurements; a second copy of a task drifts). Each P76 file carries a banner.

| was | now | one line |
|---|---|---|
| SB-009 | **DEF-010** | a component named in a **parameter** is unchecked — the same name as a node **`type`** IS refused. One spelling of one reference goes unresolved |
| SB-010 | **DEF-011** | the door writes no script ports → **every cloud component any agent authors** has dead signal outputs, a 30s 504 |
| SB-011 | **DEF-012** | a cloud query **widens when it cannot narrow**, two independent ways |
| SB-012 | **DEF-013** | 🧭 an app whose pages link to each other **cannot be authored in one pass** |

⚠️ **DEF-002, DEF-010, DEF-011, DEF-013 are all `noodl-mcp/src/validate.ts`.** DEF-002 grades wires;
010/013 grade references in parameters; 011 is port derivation. 🔴 **Three of them say their fix
needs a corpus sweep to decide block-vs-warn — do that sweep ONCE.**

🧭 **Four rulings survive the close** and are in phase 80's TASKS.md: **F8** (`contactRecipient` in a
world-readable row — open since s4), **D3** (does SB-003's boundary fix ride 0.2.1?), **`Section.kind`
has five values and `data` expresses four**, and **SB-012's three candidate fixes**.

⚠️ **Consciously dropped, on the record** — the panel-UI-never-clicked residual (superseded by
SBR-006), **rule 4 UNMEASURED**, **SSG skips dynamic `{param}` routes** (a claim SB-007 must never
make), and **`typecheck:backend-tests` OOMing on this machine** (environmental; it *"needs an owner"*
and does not have one — file it if it recurs elsewhere).

---

## 🔴 Still owed inside phase 77

- **SBR-006 AC4's fix is authored and gated but NOT driven.** Click View site, expect `/`; the bug
  was `location.pathname === "/%7Bslug%7D"`. Same regenerated-template requirement.
- **SBR-006 AC1 was driven with one page, not ≥2.** Re-drive once SBR-008 lands.
- **SBR-006 AC2** stays half until **SBR-008** (`prop-*` is wire-only). ⚠️ **SBR-008 is `⬜ open`** —
  see the "owned" lesson above.
- ✅ **§5.8 is no longer Richard's call.** The sweep reclassified P77 D4 as template work:
  `DbCollection2` carries `failure` (signal) and `error` (string) at HEAD and phase 78's D4 **drove**
  it — a 403 fires `failure`. The site builder never wired them. → SBR-006/SBR-010.

## 🔴 The lessons most likely to repeat

- 🔴 **An unowned row gets rediscovered at full price.** P76 **F15** and P77 **D8** are one defect,
  measured and written up twice, fixed zero times.
- 🔴 **A re-measure scoped to the wrong question confirms everything.** The stated reason to re-verify
  P77's rows was *"the platform has moved under them"*. **It had not** — D6's source file predates its
  own measurement by three weeks. The derivations were wrong, not stale. Ask **"is this reading
  right?"**, not **"is it stale?"**
- 🔴 **P77 D2 has now been diagnosed wrong three times, each from the caller list rather than the
  caller.** `WorkflowRunner.ts:261` is the **`Log` node handler**; the template has zero `Log` nodes.
  `execution_steps` records what the author logged, never what the graph ran.
- 🔴 **A template-scoped test does not close a row.** SBR-015 ships its rule in one template's suite;
  `validate.ts` still has the hole. P77 D1 is open on purpose.

## Traps carried

- ⚠️ **Phase 78's register is the other session's lane** and is being edited concurrently. It needs
  two things from its owner (sweep §5): **renumber the duplicate `D10`** and **add an owner column**.
  Nothing in s11 touched it.
- ⚠️ **Artefact node types are not authoring names**; a component instance's type is its
  **legacyName**. A hand-written type list is an exclusion list that cannot fail.
- ⚠️ Two count pins move whenever a cloud graph does: `sb-007/site-template.test.ts` node ids (**234**)
  and `sb017-helper-is-lossless.test.ts` connections (**118**).
  `sb017-deploy-connection-parity.test.ts` compares against a **frozen deployed bundle** — a removed
  wire must join `REMOVED_SINCE_THE_BUNDLE` with a reason.
- ⚠️ Read the summary line, not the exit code: `test:ci` exits 1 at the floor (**2889 specs, 4
  failures, all `AIX-006 style vocabulary` by name**); readout is
  `packages/noodl-editor/tests/test-results.json`.
- ⚠️ **`test:ci` was not run in s11** — no editor, runtime or MCP source was touched; documentation
  only. s10's floor stands.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written; if the
  platform cannot express what an AC asks for, **say so and record the gap**.
- Drive artefacts: **`SBR-006 Admin Drive`** (claimed, backend `backend_mtdg3sdziq5nw`, token
  `drive-token-sbr006`) holds s9's three calls. 🔴 **It is DEF-004's before-arm; do not overwrite
  it.** `SBR-004 Mounted Drive` carries s8's.
- Shared checkout: **pathspec commits only**; announce editor launches **and** teardowns; `test:ci`
  alone, never beside a live stack.
