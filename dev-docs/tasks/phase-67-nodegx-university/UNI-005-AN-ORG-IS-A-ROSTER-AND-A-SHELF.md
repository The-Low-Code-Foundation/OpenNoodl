# UNI-005 — an org is a roster and a shelf

**Surface:** platform · **Tier 2 (R1 names orgs in the big focus; R4 makes them contact-us)** · **Effort:** L · ✅ **UNBLOCKED — D6 and D10 ruled 2026-08-14**

> **D6 — two membership sources, one roster** ([RULINGS.md](RULINGS.md)):
>
> ```
> Org identity
> ├─ Company  ->  GitHub org      (admin role = org admin, per R5)
> └─ School   ->  invite list / email domain
>                 the org mints handles and keeps the mapping (D10)
> ```
>
> Both feed **one** roster table. Most state schools have no GitHub org, and schools are the
> population D10 was ruled for — a GitHub-only identity would exclude the users the privacy ruling
> exists to serve. 🔴 **Membership source is a column, not a second roster**: roles, assignment and
> grading (UNI-006) read the roster and must never branch on where a member came from. **Phase 68's
> coaching groups (D13) also consume this roster** — a coaching group is a use of it, never a
> second group system.
>
> **D10** — org-owned pseudonymous accounts; the school is the data controller and **the
> handle→pupil mapping stays with the org**, or we hold child PII by another route.

## Premise

Schools and companies get a workspace: a **roster** (who's in the org, with roles) and a
**shelf** (prefabs, modules, templates shared org-internally). Richard's rulings: provisioning
is **contact-us, not self-serve** (R4) — every early org gets white-glove setup, which is also
the consulting funnel; and an org can **hook up its GitHub org** so the admin manages and
inspects the team through the role they already hold (R5).

## Scope (v1)

- **Org model**: name, admins, members; created only by us (R4). A member is a NodeGX account
  attached to the org — org membership adds surfaces, it never restricts the member's own account.
- **Membership rails per D6**: GitHub-org sync (membership mirrors the GitHub org, admin role
  mirrors GitHub admin — R5) *and* invite-list/email-domain for orgs without GitHub (most
  schools). Both can coexist in one org.
- **The shelf**: org-scoped publishing of prefabs/templates — same publish flow as the public
  shelf, scoped to the org. Members pull from the shelf in the editor through the signed-in
  session (editor-outbound, as always).
- **Admin inspection**: the admin sees roster, member activity on org surfaces (shelf publishes,
  assignment states once UNI-006 exists), and org settings. 🔴 Inspection reaches **org
  surfaces only** — an admin never sees a member's non-org projects or personal profile beyond
  what is public. Write this boundary into the model, not just the UI.
- ✅ **D10 compliance posture — RULED 2026-08-14: org-owned pseudonymous accounts** for minors.
  The school is the data controller; we hold no child PII.

  🔴 **This reverses a design law, and the reversal has obligations.**
  [LEARN-005](../phase-17-noodl-learn/LEARN-005-CLASSROOM-MODE.md) states *"No accounts by
  default… Accounts are a privacy liability, an IT obstacle, and a friction point"* and
  *"Local-first data"*; [ECO-004](../phase-20-ecosystem/ECO-004-HOSTED-PLATFORM.md) says reversing
  it *"must be a considered choice with proper legal advice, not an implementation detail."*
  Four things follow, and none was in this task as written:
  1. **Amend LEARN-005** rather than contradict it: account-free stays the default and local
     classroom mode stays valid; org-provisioned pseudonymous accounts are the **opt-in** path.
     Two live documents disagreeing is how the next phase re-derives this argument.
  2. **Pseudonymity must be real.** If the roster maps handle → pupil name *and we store that
     mapping*, we hold child PII by another route. The mapping stays with the org (R5's GitHub
     org, or the school's own list); the platform stores the handle only.
  3. **LEARN-005's local-AI constraint is untouched** — *"verified zero external data
     transmission"* is a network-level claim about minors' work reaching third-party model APIs.
     UNI-007's tier-1 AI projection is therefore **off by default for org-minor accounts**, or
     runs on pathing metadata only, never pupil project content.
  4. **Phase 18 export stays a hard requirement** — ECO-004: *"Users' work must remain theirs and
     retrievable."*

## ✅ The archaeology — done 2026-08-14

Full write-up: [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md). Three results bind here.

**1. R6's "old scoping" is two documents that disagree — ruled in favour of phase 51.**
[Phase 51](../phase-51-collaboration/README.md) (COL-001…006) is **async git-merge** collaboration,
specced and near-buildable, and it lists real-time collab in its *"Deliberately out of scope"*.
[ECO-001](../phase-20-ecosystem/ECO-001-COLLABORATIVE-EDITING.md) is the real-time one: 🔒 gated
behind Gate G3, **4–6 months**, "a specification, not an implementation plan". **UNI-005 builds on
phase 51. ECO-001 stays parked** — nothing here may assume live co-editing.

**2. Two phase-51 tasks the shelf should inherit rather than reinvent:**
- **COL-004 — component claiming, 3 days.** Phase 51's own emphatic recommendation: *"Ship this
  first, alone, before COL-001… It is three days and it prevents most of the collisions that
  COL-001…003 exist to resolve."* A soft advisory lock ("Bob has had this open for 20 minutes") is
  the whole of what a shared org shelf needs in v1.
- **COL-005 — the agent declares its blast radius.** An MCP plan already names every component it
  will touch; refuse the apply cleanly if a member has one open. Org sharing needs no new locking
  story.

**3. 🔴 D10's ruling reverses a stated law — see the compliance section below.**

## Acceptance criteria

1. An org provisioned by admin CLI/console; a GitHub-linked org syncs membership and admin role;
   an invite-list org admits by email; a member leaving the GitHub org loses org surfaces on next
   sync but keeps their personal account untouched.
2. A prefab published to the shelf is visible to members and invisible to non-members, including
   via direct URL.
3. The inspection boundary holds: a written spec proves an admin cannot read a member's non-org
   data through any org endpoint.
4. For a school org: no child email/PII stored — accounts are org-owned handles (D10, ruled
   2026-08-14). **Prove it the hard way:** a written data inventory showing no table, log or
   analytics event can hold a pupil's real name or email, *including* the roster mapping, which
   stays org-side.
5. LEARN-005 carries an amendment recording this reversal, so the two documents no longer
   contradict each other.

## Not in v1

Self-serve org creation, billing/seats, real-time collab (the old phases' build — referenced,
not implemented), cross-org sharing, SSO beyond GitHub.
