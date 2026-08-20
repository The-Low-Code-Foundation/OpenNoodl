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

> 🔴 **Four rulings are OPEN (README §4) and each blocks a named task.** D6 (what stays
> browser-only) blocks NAT-012. D7 (moderation) blocks NAT-007's post rendering. D8 (caching policy)
> blocks NAT-013. D10 (inbound relay) blocks NAT-014's AC4.
> ✅ **D9 settled 08-19** (`fg-muted` retired) and **D11/D12** were raised and settled with it.
> ✅ **D5 settled 08-20 — the editor gets the same session scope as the browser**, so every Tier-3
> write is unblocked. ✅ **The consent copy was rewritten in s10** (`eb563f4`) and says the reach is
> the browser's. 🔴 It also had to say the uncomfortable half: **the editor is the only place that
> grant can be ended** — 30-day sessions, and this platform has no account page.

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
| **[NAT-003](NAT-003-LESS-DARK-ON-DARK.md)** ✅ | **Less dark on dark.** `bg-0`→`bg-1` is **1.06:1** — cards dissolve into the canvas. Open the elevation ramp, lift the dark end off near-black | tokens / editor | **1** | M | ✅ **DONE 08-19** — bar **1.15 dark / 1.09 light**, derived from the complaint. 🔴 Ramp could not open without moving the INKS; D11 made it affordable. ✅ **AC6 CLOSED 08-19 s4** — CodeMirror, launcher + dialog driven in light. 🔴 Found: syntax graded on `bg-2`, but `.cm-activeLine` composites `bg-hover` over it — **8/21 dark, 10/21 light sub-AA there** (pre-existing 5/7; this task widened it by 3). Fixed a `#444444` in `DeployPopup.tsx` live since the initial commit |
| **[NAT-004](NAT-004-LIGHT-BY-DEFAULT-ON-THE-WEB.md)** | **Light by default on the web.** OS-follow with a **light** fallback, plus the visible toggle the site never had (it reads `nodegx-theme`; nothing writes it) | platform | **1** | S | ✅ D2. Independent of the tokens — do it whenever |
| **[NAT-005](NAT-005-THE-TAB-THAT-IS-A-LIST-OF-GREY-LINES.md)** ✅🟡 | **The tab that is a list of grey lines.** Two inline styles and one 13px column. Real hierarchy and rows that show the metadata the view model already carries and throws away | core-ui / editor | **1** | M | ✅ **6/7 DONE 08-19 s7** — `components/community` is the shared vocabulary; **both** surfaces draw from it; 12 PAIRS rows added and **5 corrected** (the tab moved up a ground). 🔴 Found: **this jest CAN grade a React component** — `tests-unit/support/renderElements.ts`, and Tier 3 should use it. 🟡 **AC4 open: Storybook does not start in this repo** — three breaks fixed, a fourth unnarrowed, **99 stories unopenable** |
| **[NAT-006](NAT-006-THE-API-THE-EDITOR-CANNOT-SEE.md)** ⭐🟡 | **The API the editor cannot see.** 19 pages, 15 routes, **zero** endpoints for people, profiles, RFPs, coaching, University, tutorials or replays. The reason the scope looked thin | platform | **2** | L | 🟡 **READ SURFACE DONE 08-19 s6** — `126a0b6`, 10 endpoints, AC1/2/3/4/6/7 closed. **AC5 = the writes; ✅ D5 settled 08-20 and they are now unblocked**. 🔴 Found: returning the read modules' own types LEAKS an internal account id no page renders — and a `Date`-typed column arrives as a raw string on some pooled connections |
| **[NAT-014](NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)** 🟡 | **The queue that nothing empties.** No mail leaves this platform: `drainOutbox` exists, is tested, and has **no production caller**; the relay queue has no drainer at all | platform / ops | **2** | M | 🟡 **AC1/AC5/AC6 DONE 08-19 s5** — `b41a94a`, timer + script + a disk-derived caller gate (**hole found by its own control**: a *comment* satisfied it). 🔴 **AC2/AC4/AC7 need Richard**: a real MX, the relay domain (D10), a claim against nexus-1. ⚠️ **AC3 recommended, not ruled** — do NOT build a second drainer; the relay's `Reply-To` needs inbound. **Still blocks NAT-009/010/013 until mail is seen in an inbox** |
| **[NAT-007](NAT-007-A-THREAD-YOU-CAN-ACTUALLY-ANSWER.md)** ⭐✅ | **A thread you can actually answer.** Open it, read every post, render its attachments, **reply** — the flagship | editor / core-ui | **3** | L | ✅ **8/8 AC DONE 08-20 s10** — `bb73b50c`+`eb563f4`, 84 tests, **red 42/42**. The composer and the accept verb are built and **driven on a real database**: an answer typed in the launcher reached the web, and the asker accepted it on both clients. The rail was driven too. 🔴 Found: a **true screen that is still a lie** — post succeeds, re-read fails, and the cached copy predates the answer with nothing saying so; **an accept is never offered once one exists** because moving it awards a second person and un-tells nobody; **the consent screen authorised a read and now authorises a write**, and the editor is the ONLY place that grant can be ended; **PAIRS had 75 rows and 41 pairings** and quoted the row count as coverage |
| **[NAT-008](NAT-008-THE-PEOPLE-ARE-THE-PRODUCT.md)** ✅🟡 | **The people are the product.** The directory and profiles, with author lines everywhere becoming entry points | editor / core-ui | **3** | M | ✅ **6/6 AC DONE 08-20 s9** — `736af592`+`b19f2ec2`, 71 tests, **red 14/14**, 14 new PAIRS rows. Driven over real HTTP against a local platform. 🔴 Found: **the directory endpoint has no `q` at all** (5th such endpoint) *and it pages* — so search is local **and reports its bound**; **four rate-band keys guessed and all four wrong**, invisible because the guard draws nothing; **no contact route exists**, so AC6 closes by drawing no button. 🟡 **The rail's layout was not driven** — a peer held the editor |
| **[NAT-009](NAT-009-WORK-YOU-CAN-TAKE-FROM-THE-EDITOR.md)** 🟡 | **Work you can take from the editor.** The RFP board, browsable and **answerable** from the tool the qualified person is already sitting in | editor / platform | **3** | M/L | 🟡 **PLATFORM HALF DONE + the client and every sentence, 08-20 s11** — `6b2360b`+`638c82cc`, 92 tests, **16 red of 18 mutations**. AC4 closes (posting stays on the web). 🔴 **No view yet and nothing driven.** Found: **the capability model expressing D15 had never gated anything** — a read-only org-minor reached `serve` with a 201, and **the route's own spec could not have found it** because the database refuses the same population into the same bytes; **§6 specified ONE refusal and the migration raises 18**; **`acceptConnection` has no caller**, so a response's state can never move; **no JSON write on this platform had a byte cap** and **the four bench write routes take no rate-limit token at all** |
| **[NAT-010](NAT-010-COACHING-WITHOUT-A-BROWSER.md)** | **Coaching without a browser.** Browse, request and track a session from the editor; the call itself is an honest hand-off | editor / platform | **3** | M | NAT-005, NAT-006. ✅ D5 settled 08-20 · 🔴 P67 D9. ⚠️ Timezones — drive it from a non-UTC machine |
| **[NAT-011](NAT-011-THE-UNIVERSITY-BESIDE-YOUR-PROJECT.md)** | **The University beside your project.** Syllabus and full tutorial bodies, readable **next to the canvas** — the surface where alt-tabbing costs the most | editor / platform | **3** | M/L | NAT-005, NAT-006. 🔴 **Three phases own adjacent ground** (67b UNI-006/007, P68) — grep the *behaviour* before claiming anything is new |
| **[NAT-015](NAT-015-A-GRAPH-YOU-CAN-PULL-INTO-YOUR-PROJECT.md)** 🔴 | **A graph you can pull into your project.** An attached fragment stops being something you read and retype. Was UNI-018 | editor | **3** | S/M → **ruling + M** | 🔴 **BLOCKED 08-19 s8 — NOTHING COMPOSES A `graph_fragment`.** The kind is in the enum, the DB takes it, the web renders it, and **no client makes one** — the editor refuses to, on purpose (`uni-016/nodeartifact.test.ts:306`). Building the producer means publishing an **unredacted** graph, which is a ruling. ✅ NAT-007 built and specced the pull **seam** |
| **[NAT-012](NAT-012-THE-DOOR-NOT-THE-EXIT.md)** | **The door, not the exit.** One navigation model; `openExternal` survives only as a labelled hand-off, every call site audited — **and the rail icon stops being drawn for a viewer D15 refused** | editor / core-ui | **4** | M | NAT-007..011, NAT-015. 🔴 **D6 open.** 🔴 A route is outside every sweep — derive from disk, drive it |
| **[NAT-013](NAT-013-WHAT-IT-DOES-WITH-NO-NETWORK.md)** | **What it does with no network.** P3 made real: distinct offline states, cached content that admits its age, and an editor that starts fine with the community unreachable | editor | **4** | M | Specified early, verified last. ⚠️ **D8 open** — caching a member directory to every laptop is a privacy decision |

---

## The order

**NAT-001 first, and observed failing** — everything in Tier 1 is unmeasurable without it, and a
gate added after a fix proves nothing.

Then Tier 1 (**NAT-002/003 together**, NAT-004 whenever, NAT-005 last) answers Richard's item 1:
the look. ✅ **NAT-005 landed on 2026-08-19 (s7) and Tier 3's vocabulary now exists** —
`@noodl-core-ui/components/community` carries the row, the four states and the metadata
formatters, in two densities, and the rail panel and the launcher tab both import it. 🔴 **Anybody
starting NAT-007..011 should read that task's status section first**: it names the instrument that
can grade a React component in this runner, and the one design constraint that keeps it usable.
⚠️ **NAT-004 is now the only unstarted Tier-1 task.** **NAT-006 was the long pole and its read half is now built** (`126a0b6`, 08-19 s6): ten
endpoints across the seven missing surfaces, one envelope, D15 per endpoint, a written contract in
`nodegx-community/docs/API.md`. 🔴 **The five Tier-3 tasks are unblocked, writing included** — the reply, the RFP response
and the coaching request are AC5, they are specified in that document, and ✅ **D5 settled on
2026-08-20** (same session scope as the browser). Anybody starting NAT-007..011 should read §3 and §4 of the
contract first; §4 is why a client must never render *"you do not have permission"* from a 404.

🟡 **NAT-014 was started on 2026-08-19 (s5) and is three-quarters closed.** The caller exists —
`nodegx-community@b41a94a` — so the machinery now runs. ⚠️ **It has still delivered nothing to a
human**, and until it has, the three Tier-3 tasks behind it (NAT-009 AC5, NAT-010 AC5, NAT-013 AC4)
should not be closed on the strength of it. What is left is not code: a real send to a real MX
(AC2), the relay domain (AC4, **D10**), and running it on nexus-1 (AC7). 🔴 **Its own gate had a
hole shaped like the defect** and only the red-verification found it — read that section before
writing any "does a caller exist" check elsewhere.

Tier 3 is four independent surfaces plus the flagship; **NAT-007 went first** (08-19 s8) and
**NAT-008 second** (08-20 s9); the other two copy their shapes — the row, the four states, the post-body renderer, the six-state
thread machine and the attachment card are all in
`@noodl-core-ui/components/community` now, and `threadview.ts` is the pattern for a
surface's view model. 🔴 **Read NAT-007 §Status *and* NAT-008 §Status before starting NAT-009/010/011.** NAT-008 adds
three things they all need: the `{items, page}` envelope and the **paging** every NAT-006 list
endpoint has, the fact that **none of those endpoints reads a `q`** (so a keyword filter is the
client's job and must report the bound it searched over), and the reminder that a **vocabulary
copied from the platform must be read off the platform** — four rate-band keys were guessed and
all four were wrong, silently. 🔴 **Read NAT-007 §Status too**: it names
the instrument, the D15 branch order that every one of them needs, and the two ways this client
has now silently outlived the platform's payload.

🔴 **NAT-015 did NOT ride along, and the reason is not that it was skipped.** Nothing anywhere
composes a `graph_fragment` — the pull has no population, and building the producer is a decision
about publishing an unredacted graph rather than an S/M build. NAT-007 built and specced the seam
so nothing has to be rediscovered; see NAT-015 §Status for the three things it now needs, in order.
Tier 4 closes the phase by making them one place.

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
