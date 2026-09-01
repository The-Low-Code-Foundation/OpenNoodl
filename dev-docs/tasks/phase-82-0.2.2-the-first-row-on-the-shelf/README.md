# Phase 82 — 0.2.2: The First Row On The Shelf

**Opened 2026-08-31**, at Richard's request: *"Let's start a phase to start prepping 0.2.2 launch…
I'd like to get a handle on how much of [phase 81] is really left since I want to publish the
association page template but not the site builder yet."*

Two decisions were taken the same day and they define this phase's whole shape:

| decision | Richard's answer |
|---|---|
| publish the association template before or after its look is fixed? | **After VIB-005 + VIB-008.** The shelf's first row is the shop window |
| what is the next app cut called, and what's in it? | **0.2.2, and phase 75 rolls forward.** The served community work counts as "0.2.1 in practice"; P75's remainder gets triaged, not force-marched |

## §1 The state, measured at HEAD 2026-08-31

Everything below was re-derived from the artefacts, not relayed from a handoff. Three of the four
readings contradicted a task file.

### §1.1 The last shipped app is 0.2.0

`v0.2.0`, tagged 2026-08-21 20:08Z, is the newest release on the remote and the newest tag in this
repo. `packages/noodl-editor/package.json` still reads `0.2.0`, and the last commit to touch it is
`3a20f46c chore(release): 0.2.0`. **There was no 0.2.1 app cut.** Phase 75 is the 0.2.1 container
and much of its content did ship — to `community.nodegx.io`, which is **served**, not to the app.

So 0.2.2 is the first app release since 0.2.0, and its number reflects what users experienced
rather than what was tagged. That is a deliberate choice, recorded here so a later session does not
"correct" it back to 0.2.1.

### §1.2 🔴 Publishing the template does not need a release at all

Curated templates are **served** by `nodegx-community`. Phase 78's own delivery note says so, and
**phase 80/DEF-007 session 41 drove the whole path locally over real HTTP** against the real route
handlers: publish → picker row (`DEF-007 Home Check · Starter · Community`) → install into a real
project. Publishing is a **database-credential act** (`scripts/publish-project-template.ts`), not a
signed-in session on a live service.

Consequence: **REL-001 and REL-004 are independent.** The template can go out to everyone already
on 0.2.0 the moment its look is ruled, whether or not the app cut is ready. Do not let one block
the other.

### §1.3 🔴 P78's T6 is already done, and its handoff says otherwise

The phase-78 handoff (s17, 2026-08-29) says *"`T6` — three template fixes, and they are the only
buildable work left in this phase."* Measured in `templates/members-area/` at HEAD, all three are in:

| row | claimed defect | at HEAD |
|---|---|---|
| D22 | `claimAssociation` writes the founder's email into `Member.name`, every install | `Pages/Setup` asks **"Your name"**; `moderatorName` is required at the door. The email fallback survives with a comment saying the door makes it **dead** |
| D23 | `/members` and `/directory` are both headed "Members" | `Pages/Directory` heads **"Who belongs"**; `Pages/Members` heads "Announcements" |
| D24 | Approve and Decline touch — a pair with no gap reads as one object | `Members/RequestRow` sets `columnGap: var(--space-3)` |

The fixes rode in with the TPL-002 / DEF-011 work rather than as a task called T6. **P78 T5 has no
code blocker left** — see REL-006 for the doc correction this owes.

### §1.4 🔴 The blocker is the look, and it is not on P78's board

Six of phase 81's **nine SHITTY baseline verdicts are this template**: `/`, `/members`
unauthenticated, `/setup`, `/join`, and both living-state pages
(`phase-81-…/VIB-001-BASELINE-VERDICTS.md` §1–§2). The other three are the site builder.

The task that redeems them is **VIB-008**, unstarted, and it depends on **VIB-005**, also unstarted.
VIB-008 is not only cosmetic — its register rows include **V3** (the members chrome gates on `done`
only, so it **fails open** when there is no backend) and **V4** (no state for "the query was never
answered", so first run renders a bare eyebrow and buttons). Publishing before those land ships the
phase's own worked example of SHITTY as the shelf's first row.

### §1.5 How much of phase 81 is really left — for *this* release

Thirteen tasks; three closed (VIB-001 the Judge, VIB-006 the WORTHY page, VIB-012 prune-on-deploy);
four ruled PASSABLE with the capability landed (VIB-002, 003, 004, 011); VIB-007 has AC1 and AC3 in
and AC2 at five of six.

**Holding the site builder collapses the release-critical remainder to two tasks — VIB-005 and
VIB-008 — and both are now on this board, as REL-002a/b/c.** Everything else drops off *this
release's* path: VIB-009 (site-builder look), VIB-010 (the cold proof), VIB-013 (the altitude),
VIB-007's AC4/AC5, and all five unbuilt P77 tasks. They stay open in their own phases; they are
simply not what 0.2.2 waits on, and **a launch session should not open them**.

⚠️ **P81 is live.** At the time of writing a peer session held uncommitted VIB-007 V29 work
(`demo/build-vib007-v29.js`, `packages/nodegx-backend/tests/vib007-v29.look.ts`). **This phase does
not edit phase-81 files.** REL-002 tracks that work; it does not own it.

## §2 What this phase is, and what it is not

**It is the launch container, and it is the only board a launch session opens.** Richard,
2026-08-31: *"can we work through the next session prompt in phase 82, rather than me ending up
driving unnecessary tasks in other phases by accident — just so we focus on the tasks we need to
launch, over several sessions all in phase 82."*

So this phase owns the cut, the publish, the build debt, the triage — **and the look work**,
transferred here from phase 81 as **REL-002a/b/c** (was VIB-005 + VIB-008). The verdict scale and
the close protocol are **restated inside `TASKS.md`**; a session working REL-002 does not need to
open phase 81 at all.

🔴 **What is NOT in this phase is not in the launch.** If a row is not on this board, it does not
gate 0.2.2 — that is the point of the container. Resist widening it: every task pulled in from
another phase must be one 0.2.2 genuinely waits on, and must arrive with its close condition
restated here, not linked.

⚠️ **The transfer owes a note back to phase 81** (REL-006 AC4) so two phases do not both believe
they own the members' area. Write it after the peer session that was live on 2026-08-31 has ended.

**Standing rule applies unchanged**
([`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md)): a defect becomes
the next session's first job **only if it blocks an acceptance criterion**. Otherwise: register,
owner, and **build the next task**.

## §3 The hold list — recorded so it is not rediscovered

Deliberately **out** of 0.2.2, by Richard's decision:

- **The site-builder template.** It is not in `templates/` and has never been staged for
  publication, so holding it is the default state — no action, and no accidental publish.
- **VIB-009** (the site-builder look) and the three site-builder SHITTY verdicts. They stop
  mattering for this release the moment the template is held.
- **P77's five unbuilt tasks** (next is SBR-005). P77 stays live in its own lane; nothing here
  waits on it.

🔴 **This is a hold, not a cancellation. Owners named 2026-08-31 (REL-006 AC1):**

| held thing | owner after 0.2.2 | why that phase |
|---|---|---|
| the site-builder **template** and its publication | **phase 77** (the site-builder rescue) | P78 records it explicitly: *"P77 owns the site-builder template."* P77 is open, has five unbuilt tasks, and outlives phase 82 |
| **VIB-009**, the site-builder public site's look | **phase 81** | It is a phase-81 task on a phase-81 rubric; unlike VIB-005/VIB-008 it is **not** carried here, because 0.2.2 does not wait on it |
| P77's five unbuilt tasks (next: SBR-005) | **phase 77** | never left; nothing here touches them |

⚠️ **No action is needed to hold the template** — it is not in `templates/` and has never been
staged for publication, so holding it is the default state. The risk this table addresses is not an
accidental publish; it is the row being **rediscovered at full price** because nobody wrote down
where it went.

## §4 Close condition

0.2.2 is launched when **all** of:

1. The association template is **published** and installed from a clean launcher (REL-001).
2. Its landing and one members page are **WORTHY** at all three widths, in both states — the
   VIB-008 close condition, ruled by Richard before publication (REL-002).
3. The cut is tagged `v0.2.2` with release notes, built from a tree whose committed bundles are
   **not** stale (REL-003, REL-004).
4. What rode and what rolled forward is **written down** (REL-005), and the hold list survives into
   the next phase with a named owner (REL-006).
