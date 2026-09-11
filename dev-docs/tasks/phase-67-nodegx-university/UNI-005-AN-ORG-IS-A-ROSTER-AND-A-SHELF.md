# UNI-005 — an org is a roster and a shelf

**Surface:** platform · **Tier 2 (R1 names orgs in the big focus; R4 makes them contact-us)** · **Effort:** L · ✅ **BUILT 2026-08-16 (eighteenth session) — all five acceptance criteria met**

> ✅ **BUILT.** `nodegx-community`, fifth commit. **363 specs / 16 files** (baseline 245/12),
> `tsc --noEmit` clean, `next build` succeeds with **14 routes** (was 11). Driven over HTTP
> against **30 consequences written before the drive, 30/30 passed**. Ten control runs.
> **The write-up is [§ What was built](#-what-was-built-2026-08-16) at the foot of this file.**
>
> 🔴 **AC5 was already met before this session started** and is the phase's own trap in
> miniature: [LEARN-005's amendment](../phase-17-noodl-learn/LEARN-005-CLASSROOM-MODE.md) was
> written 2026-08-14 by the first session. Checked before writing one, per *"grep the record
> before claiming a new finding"*. Its condition 2 — *"the handle → pupil-name mapping stays
> with the org"* — is the constraint the schema had to honour, and it is now a trigger.

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

---

# ✅ What was built (2026-08-16)

**Files:** `src/db/sql/0005_uni005_orgs.sql` (five tables, six functions, four triggers),
`src/lib/orgs.ts`, `src/lib/shelf.ts`, `src/lib/viewer.ts`, four suites
(`uni005-orgs`, `uni005-shelf`, `uni005-inspection-boundary`, `uni005-data-inventory`),
three routes under `/orgs`, `scripts/provision-org.mjs`, and UNI-005's half of `scripts/seed.mjs`.

## The five criteria

| AC | State | How it is proved |
|---|---|---|
| **1** provisioning, three rails, removal on sync | ✅ | 33 specs. The removal half is asserted as **two** claims — the membership goes and the **account, its handle and its OAuth identity stay** — because the criterion is two claims in one sentence |
| **2** shelf visible to members, invisible to non-members **including via direct URL** | ✅ | One SQL function, **quantified over the module's own exported readers** × four kinds of non-member, plus the mirror that proves a member DOES see it |
| **3** an admin cannot read a member's non-org data through **any** org endpoint | ✅ | A **sentinel sweep over every export of both modules**, with a recipe-coverage assertion and **two known-firing controls** |
| **4** no table, log or analytics event can hold a pupil's real name or email | ✅ | A **data inventory censused against `information_schema`** — 73 columns, every one classified, and nine executable probes |
| **5** LEARN-005 carries the amendment | ✅ | **Already true**, written 2026-08-14. Verified rather than rewritten |

## 🔴 The four things worth carrying past this task

**1. `orgsFor` had no viewer, and building AC3's sweep is what found it.** The first version
read `orgsFor(sql, accountId)` with a comment saying *"its own membership, so no viewer
argument is needed"* — true of every call site that existed, and false as a property. An org
admin legitimately holds a member's account id, so a self-scoped endpoint with no viewer is one
call away from telling them **which other organisations that member belongs to**. The sixth
instance in this phase of *build the caller and it shows you what the thing does not do* — and
the first where the caller was **a test being designed**, not a feature. ⚠️ Its control is the
sharpest in the set: removing the viewer check fails exactly one spec, and that spec is the
sweep.

**2. The sync's rail scoping is a read of `source`, and D6's ban is on *consumers*.** The
obvious reconciliation — *delete every member not in the GitHub list* — is correct for an org
with one rail and catastrophic for the org D6 describes, where a school has invited teachers,
minted pupil seats **and** a GitHub org. D6 says roles, assignment and grading must never
*branch* on `source`; a rail reconciling itself is the one legitimate reader, because the
question it asks is literally *"is this row mine"*. 🔴 The spec runs a sync over a roster holding
all three sources rather than asserting the `where` clause exists — *asserting the clause would
pass on a query that had it in the SELECT and not the DELETE.* Control: the naive delete fails
exactly that spec.

**3. A control found the module's own header to be true of one reader and false of the other.**
`src/lib/shelf.ts` claimed *"every reader is defined in terms of `shelf_item_visible_to`"*.
`shelfItem` was; `orgShelf` filtered `hidden_at` inline and agreed **by coincidence**. The
control that makes the function always-true failed five specs rather than nine and nothing
looked wrong — a control quietly measuring half the surface it names.

🔴 **And the fix was initially unmeasurable, which is the more useful half.** With the listing
routed through the function, the obvious control (drop `hidden_at` from the function) still
failed **1** spec either way — because the one spec that touched hidden-ness asserted *both*
readers at once, so it failed for `shelfItem`'s reason regardless. **A spec that fails for
either of two reasons cannot be a control for one of them.** Split into two specs, the arms
separate: **as shipped 2 fail, with the inline copy restored 1 fails** — the listing carrying
a second copy of the rule survives the rule being deleted.

**4. An inventory that cannot go stale.** AC4 says *"prove it the hard way"* and a written
inventory is a snapshot — the artifact this phase repeatedly finds stale. So the inventory is a
**census**: all 73 free-text columns in the live schema must carry a classification, an
unclassified one fails the suite by name, and a classification naming a column that no longer
exists fails too. Control: adding `org_members.pupil_real_name` fails **three** specs — the
census, the *"the roster has no free-text column at all"* assertion, and the drift test.

⚠️ **Where AC4's claim stops, stated in the suite rather than implied:** six columns are
`adult-authored`, and no mechanism stops a teacher typing a pupil's name into an org name or a
report reason. The claim is that **no pupil-facing path deposits child PII and no field is
*for* it** — which is the data-controller boundary D10 already drew. It is not a claim that no
adult ever typed a child's name anywhere, and a census that implied otherwise would be worse
than none.

## The judgement calls, both reversible in one line

🔴 **An org-minor account reads the shelf and does not publish to it.** `payload` and `summary`
are free text, and no mechanism short of refusing the write keeps a name out of a free-text
field — the conclusion 0003 already reached about a profile bio. The cost is real and is not
hidden: **a school shelf that pupils cannot publish to is a teacher's shelf.** UNI-006 is where
pupil work is meant to go, and a submission has one reader where a shelf item has an
organisation, so it can answer this differently. One line in `shelf_publisher_gate()`.

⚠️ **An org-minor account belongs to exactly one org — the one that owns it — and can never be
an admin.** Derived from LEARN-005's condition 2: the mapping is held by one school, and a
pupil rostered into a second org makes the platform the join between two parties each holding
half an identification. Trigger, not convention.

## What is NOT built

- **No GitHub API call.** `syncGithubOrg()` takes the membership list as an argument; the fetch
  needs an org token nobody has issued. What is built is the **reconciliation**, which is where
  AC1 is either true or false.
- **No email is sent** — an invite is a row with a hashed token, and there is still no sender.
- **No write path in a browser.** Inviting, publishing, syncing and hiding are specced and
  reachable only from a test, exactly as UNI-002/3/4 left their writes — because there is no
  way to sign in and therefore no way to be an admin at a URL.
- 🔴 **`src/lib/viewer.ts` is a session READER and nothing mints one but `db:seed`.** Built
  because UNI-005 is the phase's first task with **no public half at all**: every route would
  otherwise have exactly one reachable branch, the 404, and *a drive over a surface that 404s
  for everybody passes identically when the surface is broken.* The mechanism is UNI-001's real
  one against UNI-001's real table; the missing half is the issuer, which needs the domain.

## The drive — 30 consequences written first, 30/30 passed

Personas: an Acme **admin**, an Acme **member**, a signed-in **member of no org**, and an
**org-owned seat** at a school. Non-members 404 at the org page and at a shelf item's direct
URL; an ordinary member sees the roster and **not** the settings; the wrong org slug with the
right item id renders for a member and 404s for a non-member (the slug is decoration, and the
page says so); COL-004's *"1 person has this open"* renders.

🔴 **The absence assertion carries its own known-firing signal.** *"No email address anywhere on
the school's page"* is worthless alone — so the record also shows the teacher's **handle** on
that page (the grep reaches the roster), her display name and address **absent**, and the same
grep finding that address when it is present. ⚠️ Two instrument caveats carried from UNI-003/4
and both still bite: strip React's `<!-- -->` before grepping, and never read a `grep -c` on
HTML as an occurrence count.

## Ten controls

| # | Control | Result |
|---|---|---|
| 1 | D10's foreign-org check removed | **2 fail** (the D10 spec, the AC4 probe) |
| 2 | the shelf's org-minor publisher gate removed | **2 fail** |
| 3 | `shelf_item_visible_to` always-true | **5 fail** — and the number is the finding, see above |
| 3b | `hidden_at` dropped from the function, **as shipped** | **2 fail** |
| 3c | same patch, **listing checking inline** | **1 fail** — the arm that proves the duplicate |
| 4 | the naive sync (delete everyone not in the list) | **1 fail** — the mixed-roster spec |
| 5 | `orgsFor` without its viewer check | **1 fail** — the sweep |
| 6 | `orgMemberActivity` without its admin check | **1 fail** |
| 7 | `orgMemberActivity` widened to every org's shelf | **2 fail** |
| 8 | a `pupil_real_name` column added to the roster | **3 fail** |
| 9 | the advisory claim turned into a lock | **2 fail** — the behavioural spec **and** the structural one |

⚠️ **Patched literally, never with `perl -0pi`.** UNI-004's control that measured nothing used a
replacement containing `$$`, which perl expands to the **process id**. The harness here does a
literal split/join in Node **and prints the patched region before running**, so a control that
failed to apply cannot read as a result.
