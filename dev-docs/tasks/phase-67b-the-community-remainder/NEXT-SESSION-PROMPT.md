# Phase 67b — next session

**Written 2026-08-20 (session 45), replacing session 43's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task
files**; its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **Check for a live peer yourself — that is a per-session fact, not this file's to assert.**
At 07:0x–07:3x one OpenNoodl peer was live on **phase 73 TUT-002** (`lessonformat.ts`,
`lessonverify.ts`, `lessonevalconditions.ts`, plus TUT-001's uncommitted `BackendServicesPanel`
work). It ran `test:ci` at 07:1x and reported **the floor — 2849 specs / 10 failures @ seed 39393,
same 10 by name**. Session 45 touched no file of theirs.

---

## 1. ✅ UNI-012 IS BUILT — all four ACs, measured on a packaged build

`OpenNoodl@4652adc9`. This was one of the three "an agent alone" jobs session 43 named, and it is
the one that was actually agent-alone. Full write-up in
**[UNI-012](../phase-67-nodegx-university/UNI-012-F4-ON-A-PACKAGED-INSTALL.md) §0 and §4b–4d.**

The task had sat since 2026-08-16 with the reason stated plainly: *"the change cannot be verified
without producing a packaged build."* One was produced (`electron-builder --dir`, unsigned) and the
sidecar was driven through a **real MCP stdio client**, which is the same *build the caller* method
this phase keeps returning to.

### 🔴 Three things to read before touching any of it

1. **`ELECTRON_RUN_AS_NODE` reads, executes and resolves `require` INSIDE `app.asar`. Plain
   `node` does none of them** — `ENOTDIR` on the first read. All four were measured against the
   installed 0.1.7 app *before* any code was written, and they are why the harness ships **inside
   the asar** rather than beside it in `extraResources`: the 14MB viewer bundle the editor already
   ships is read where it already is, not duplicated. 🔴 **If a future change makes the harness
   spawn under plain Node, every packaged candidate stops resolving and the checkout ones still
   work** — the failure that reads as "fine on my machine". Both spawns now set the variable
   **explicitly** rather than inheriting it, because inheriting it was a load-bearing accident.
2. **§3's "three data files" was wrong in both directions, and only listing the shipped asar
   showed it.** Two of the three (`viewer`, `ws`) were **already shipped**; `DefaultTokens.ts` — a
   TypeScript source file read as text and regex-scraped — was **not shipped and is named nowhere
   in the task**. ✅ Generalisation: *measure the artefact before believing the plan for it.*
3. **A missing catalog is now a named refusal, not a silent abstention.** The catalog readers
   abstain to `null`, which is right *inside* the walk — but abstaining quietly is how a packaged
   install would score F4 **with a strictly weaker rule than the checkout applies to the same
   project**, certifying a lesson against a page the checkout would have judged differently, every
   gate green.

### ⚠️ Two facts for anyone driving the MCP sidecar

- **Lesson tools are deferred.** `create_lesson` answers `MCP error -32602: Tool create_lesson
  disabled` until `find_tools { group: 'lesson' }` reveals it. AWP-006's surface budget, working.
- 🔴 **`NODEGX_RENDER_DISABLED=1` does not disable the lesson render** — it is consulted by
  `planTools` **only**. Reaching for it to prove an "F4 unanswerable" refusal measures nothing and
  looks like it measured something. Make the harness genuinely unresolvable instead.

## 1b. ⚠️ A correction to session 43's §4: UNI-008 is NOT agent-alone

Session 43 listed UNI-008 first under *"An agent alone — nothing needs Richard"*. Reading D9 before
starting it, that is **not right, and the reason is in the ruling rather than in the build**. D9's
five obligations include **a DPA** (the builder becomes a controller and we a processor) and the
task's own scope needs **a share domain with Cloudflare in front** and a **record-capped
multi-tenant backend** — on nexus-1, which shares a box with three live sites and an
all-or-nothing Caddy. A hosting product with a legal posture is not a thing to stand up
unilaterally. **The build is still ours; the domain, the DPA and the go-live are Richard's.**

## 1c. ⚠️ And curriculum hosting is RULED, not open — the blocker is the lessons

Session 43's §1c reads as though curriculum hosting were undecided. It is not: **D17 was ruled
2026-08-16 — *part of the platform API under D14; GitHub Pages as v0*, with the standing constraint
that a lesson must stay installable from a local directory with no origin.** So of §11's "two
problems, not one", the hosting route has its answer and **fifteen unwritten lessons** are the real
wall. That second half is not an agent's call to scope alone, and phase 73's TUT-003 is the live
work on lesson *content*. ⚠️ CURRICULUM-DESIGN §11 also notes hosting is **less urgent than it
was**, because UNI-007 made the lesson reader injectable — a lesson already installs from a local
directory with no origin to fetch from.

## 2. Gate readings — 2026-08-20, session 45

Sidecar and package were **rebuilt after the last edit** and all three acceptance arms re-driven on
that artefact, so no reading below is against a stale build.

| Gate | Reading |
|---|---|
| `npx tsc -p packages/noodl-mcp --noEmit` | ✅ **0 errors**, no pipe |
| `packages/noodl-mcp` jest | ✅ **54 files / 644 tests / 0 failures** |
| `npm run test:main` | ✅ **271 suites / 4388 tests / 0 failures** (up 1 suite / 7 tests — UNI-012's guard) |
| Packaged `render_report` | ✅ 7272ms, `182 shipped defaults + 23 project override(s)`, 87 texts / 12 images |
| `test:ci` | ⚠️ **NOT MINE.** A peer measured the floor (2849 / 10 @ 39393, same 10 by name) at ~07:1x. Re-measure before quoting |
| `nodegx-community` | ⚠️ **Untouched this session.** Session 43's readings stand: `tsc` clean, 48 files / 1164 tests |

⚠️ **`noodl-mcp` failed 2 of 644 on the first run of the final pass and they were flakes** —
`provision.test.ts` and `projectOwnsBackend.test.ts`, both real-backend specs that bind real ports,
neither on the render path. Green in isolation *and* on a full re-run of all 54 files. Recorded
because "I re-ran it and it was fine" is the sentence that hides a real intermittent: this suite has
two specs that can flake when the machine has just packaged an Electron app and driven four MCP
servers, which is exactly what this session had been doing.

## 3. What to do next

### An agent alone

1. **UNI-010's remainder** — the last genuinely agent-alone item left in this phase.
2. **Wiring UNI-007 AC1 into the editor.** The platform end is complete and has **no caller**, the
   same shape UNI-006 was in before session 42 built its bridge — and *building the caller is what
   finds what a shipped thing does not do*, which is how this session found §1's three items. The
   three routes are in `docs/API.md` §5c. 🔴 **This overlaps phase 72's editor surface directly** —
   `communityapi.ts`, `CommunityPanel.tsx` and `useCommunityThread.ts` are NAT-007's. Check for a
   live peer first, and expect to coordinate rather than assume.

### Needs Richard

3. **UNI-008** — see §1b. Scope and build are ours; the domain, the DPA and the go-live are not.
4. **The fifteen unwritten lessons** — see §1c.

### 🔴 The deploy warning is UNCHANGED and still applies

nexus-1 is at **`0cbd716`**. Everything since — NAT-014's mail drain, E7, NAT-006's read API,
UNI-006's bridge, UNI-007's AC1 — is undeployed. **The next deploy installs phase 72's mail timer,
and the first drain will refuse because the outbox backlog is older than `MAIL_DRAIN_MAX_AGE_DAYS`
(7). That refusal is the guard working — do not route around it.** Releasing weeks-old mail is
Richard's decision. ✅ **Deploy from a pristine clone of a named commit**: `git clone` to `/tmp`,
`git checkout main` (the **branch**, not the bare sha, or the stamp records `branch: HEAD`), run
`ops/deploy.sh` there. ⚠️ A deploy now also needs `ANTHROPIC_API_KEY`, or tier-1 projection answers
`unavailable` on every request — the honest degraded state, and a config step somebody must *choose*
not to take.

⚠️ Session 43's isolated databases `nodegx_community_s43` and `nodegx_community_s42` still exist on
the 55432 container. Tidy up when nobody needs them.

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**, built and committed, **not deployed**. UNI-018 is
**NAT-015**; UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
