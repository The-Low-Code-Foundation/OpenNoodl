# Phase 72 — the tasks (NAT: nobody has to leave)

**Created:** 2026-08-19 out of [README.md](README.md). Read the README's **four principles** first —
**P1** read it and answer it *in the editor*; **P2** one palette, one gate, both surfaces;
**P3** local-first behaviour, not just local-first marketing; **P4** the security posture is not
negotiable for a nicer UI. All four are acceptance criteria in every task.

> 🔴 **Read [README §1](README.md) before starting anything.** The three findings that shaped this
> phase are not what the review started from: the default body colour **fails AA in both themes**
> (`fg-muted`, 3.93 dark / 3.62 light); **the platform already fixed this and fixed it by leaving
> the shared palette behind**; and people/jobs/coaching/University are missing from the editor
> because **there is no API for them**, not because the UI under-scoped them.

> 🔴 **Five rulings are OPEN (README §4) and each blocks a named task.** D5 (write auth) blocks
> every Tier-3 write. D6 (what stays browser-only) blocks NAT-012. D7 (moderation) blocks NAT-007's
> post rendering. D8 (caching policy) blocks NAT-013. D10 (inbound relay) blocks NAT-014's AC4.
> ✅ **D9 settled 08-19** (`fg-muted` retired) and **D11/D12** were raised and settled with it.

> ⚠️ **Phase 67b keeps most of what it owns** — UNI-017 (triage), UNI-006/007 (the assignment
> bridge), hosting, the packaged-install check and off-host backups are **not** in this phase, and
> tasks that touch them say so and defer.
>
> 🔴 **Three items were moved here on 2026-08-19, and each says why in its own file.** The mail
> drainer became **[NAT-014](NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)** because three Tier-3
> tasks assert that a write *sends*; pull-a-graph (UNI-018) became
> **[NAT-015](NAT-015-A-GRAPH-YOU-CAN-PULL-INTO-YOUR-PROJECT.md)** because it is this phase's
> closing sentence; and the rail icon drawn for a D15-refused viewer became **NAT-012 AC7**,
> because the task auditing every door should not be forbidden from closing one.

**Tiers:** 0 = instruments · 1 = the look · 2 = the contract · 3 = the surfaces · 4 = making it one place.

**Effort:** S ≈ a session · M ≈ 2–3 · L ≈ a week+.

| Task | One line | Surface | Tier | Effort | Depends on / must honour |
|---|---|---|---|---|---|
| **[NAT-001](NAT-001-THE-CONTRAST-FLOOR-THE-EDITOR-NEVER-HAD.md)** ✅ | **The contrast floor the editor never had.** The platform gates ~30 fg×bg pairs at 4.5:1 in both themes; the editor gates three components. Build the editor's PAIRS spec over the existing `themeTokens.ts` | core-ui / tests | **0** | S/M | ✅ **DONE 08-19** — 123/123, seen **22 red** first |
| **[NAT-002](NAT-002-THE-GREY-NOBODY-CAN-READ.md)** ✅ | **The grey nobody can read.** `fg-muted` is 3.93/3.62 and is the launcher's body colour; the site's proven answer (`fg-default-shy`, 5.98/5.34) comes upstream and the site's local override is retired | tokens / editor / platform | **1** | M | ✅ **DONE 08-19** — D9 = **retire**; raised **D11/D12** (accent + status split). ⚠️ ~99 files still paint words with a fill role |
| **[NAT-003](NAT-003-LESS-DARK-ON-DARK.md)** ✅ | **Less dark on dark.** `bg-0`→`bg-1` is **1.06:1** — cards dissolve into the canvas. Open the elevation ramp, lift the dark end off near-black | tokens / editor | **1** | M | ✅ **DONE 08-19** — bar **1.15 dark / 1.09 light**, derived from the complaint. 🔴 Ramp could not open without moving the INKS; D11 made it affordable. ⚠️ **AC6 part-done — CodeMirror never opened** |
| **[NAT-004](NAT-004-LIGHT-BY-DEFAULT-ON-THE-WEB.md)** | **Light by default on the web.** OS-follow with a **light** fallback, plus the visible toggle the site never had (it reads `nodegx-theme`; nothing writes it) | platform | **1** | S | ✅ D2. Independent of the tokens — do it whenever |
| **[NAT-005](NAT-005-THE-TAB-THAT-IS-A-LIST-OF-GREY-LINES.md)** | **The tab that is a list of grey lines.** Two inline styles and one 13px column. Real hierarchy and rows that show the metadata the view model already carries and throws away | core-ui / editor | **1** | M | NAT-002, NAT-003. ⚠️ **This is the vocabulary Tier 3 reuses** — build it once here or four tasks reinvent it |
| **[NAT-006](NAT-006-THE-API-THE-EDITOR-CANNOT-SEE.md)** ⭐ | **The API the editor cannot see.** 19 pages, 15 routes, **zero** endpoints for people, profiles, RFPs, coaching, University, tutorials or replays. The reason the scope looked thin | platform | **2** | L | 🔴 **Every Tier-3 task depends on this.** D5, D6 open. 🔴 Pages query the DB directly — share the query, never copy the SQL |
| **[NAT-014](NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)** 🔴 | **The queue that nothing empties.** No mail leaves this platform: `drainOutbox` exists, is tested, and has **no production caller**; the relay queue has no drainer at all | platform / ops | **2** | M | none — **start it immediately**. 🔴 **Blocks NAT-009, NAT-010, NAT-013.** D10 open (inbound relay) |
| **[NAT-007](NAT-007-A-THREAD-YOU-CAN-ACTUALLY-ANSWER.md)** ⭐ | **A thread you can actually answer.** Open it, read every post, render its attachments, **reply** — the flagship. The platform half already exists; this is an editor task | editor / core-ui | **3** | L | NAT-005, NAT-006. 🔴 **D5** gates the reply; **D7** gates moderation. AC7 drives the round trip **both** directions |
| **[NAT-008](NAT-008-THE-PEOPLE-ARE-THE-PRODUCT.md)** | **The people are the product.** The directory and profiles, with author lines everywhere becoming entry points | editor / core-ui | **3** | M | NAT-005, NAT-006. 🔴 Badges paint through a **CSS mask** — `<img>` renders them invisible; 🔴 control-test the search |
| **[NAT-009](NAT-009-WORK-YOU-CAN-TAKE-FROM-THE-EDITOR.md)** | **Work you can take from the editor.** The RFP board, browsable and **answerable** from the tool the qualified person is already sitting in | editor / platform | **3** | M/L | NAT-005, NAT-006. 🔴 D5. 🔴 The relay's `'relayed'` outcome + the missing drainer |
| **[NAT-010](NAT-010-COACHING-WITHOUT-A-BROWSER.md)** | **Coaching without a browser.** Browse, request and track a session from the editor; the call itself is an honest hand-off | editor / platform | **3** | M | NAT-005, NAT-006. 🔴 D5, P67 D9. ⚠️ Timezones — drive it from a non-UTC machine |
| **[NAT-011](NAT-011-THE-UNIVERSITY-BESIDE-YOUR-PROJECT.md)** | **The University beside your project.** Syllabus and full tutorial bodies, readable **next to the canvas** — the surface where alt-tabbing costs the most | editor / platform | **3** | M/L | NAT-005, NAT-006. 🔴 **Three phases own adjacent ground** (67b UNI-006/007, P68) — grep the *behaviour* before claiming anything is new |
| **[NAT-015](NAT-015-A-GRAPH-YOU-CAN-PULL-INTO-YOUR-PROJECT.md)** | **A graph you can pull into your project.** An attached fragment stops being something you read and retype. Was UNI-018 | editor | **3** | S/M | **NAT-007** — 🔴 build it in the **same session**, on the renderer NAT-007 writes |
| **[NAT-012](NAT-012-THE-DOOR-NOT-THE-EXIT.md)** | **The door, not the exit.** One navigation model; `openExternal` survives only as a labelled hand-off, every call site audited — **and the rail icon stops being drawn for a viewer D15 refused** | editor / core-ui | **4** | M | NAT-007..011, NAT-015. 🔴 **D6 open.** 🔴 A route is outside every sweep — derive from disk, drive it |
| **[NAT-013](NAT-013-WHAT-IT-DOES-WITH-NO-NETWORK.md)** | **What it does with no network.** P3 made real: distinct offline states, cached content that admits its age, and an editor that starts fine with the community unreachable | editor | **4** | M | Specified early, verified last. ⚠️ **D8 open** — caching a member directory to every laptop is a privacy decision |

---

## The order

**NAT-001 first, and observed failing** — everything in Tier 1 is unmeasurable without it, and a
gate added after a fix proves nothing.

Then Tier 1 (**NAT-002/003 together**, NAT-004 whenever, NAT-005 last) answers Richard's item 1:
the look. Then **NAT-006 is the long pole** — it is a platform task with no editor dependency, so
it can start in parallel with Tier 1 and should, because five tasks queue behind it.

🔴 **NAT-014 can start on day one and should.** It has no dependency on anything in this phase, it
is the only task whose defect is *currently telling users something untrue*, and three Tier-3 tasks
cannot close until it does. It is also the smallest platform task here — the caller is the
deliverable.

Tier 3 is four independent surfaces plus the flagship; **NAT-007 goes first** and the other three
copy its shapes. **NAT-015 rides along with NAT-007** — same session, same renderer, or it becomes
a second session relearning the same seam. Tier 4 closes the phase by making them one place.

## The closing bar

A proposal, for Richard to accept or change:

> **A person opens the editor, asks a question about a node, reads the answer, replies to it, looks
> up who answered, finds a job on the board and responds to it, books a coaching session, and reads
> a tutorial beside their graph — and never opens a browser. Then they pull the cable and the
> editor still works, and says clearly what it cannot reach.**

⚠️ That sentence is the *whole* phase. If a shipping bar is needed sooner, the honest cut is
**Tier 0–2 plus NAT-007 and NAT-015** — the look is fixed, the contract exists, mail actually
leaves the building, and the one thing you do most from the editor can be finished in the editor,
including taking the answer into your graph.
