# DEF-005 — Membership is a category the graph cannot express

✅ **BUILT — session 27.** AC1–AC4 met and graded; **AC5 is outstanding and was never the acceptance** (§5).

**Rank 5.** Sources: phase 78 **D2** and **D3**. Both **NONE**-owned.

🧭 **Larger than a defect and closer to a gap**, which is why it needs a ruling before it needs code.
The category TPL-001 is aimed at — membership sites, communities, clubs, anything with members — runs
into two missing reads.

## 1. (a) The browser cannot read the current user's roles at all

- `_Role` is a system class: `isSystemCollection` gives every `_`-prefixed class a fixed `nobody`
  posture **regardless of config**, so no query reaches it.
- The `User` node's outputs are the columns of `_User`, and role membership is not one.
- The whole roles family (`getuserroles`, `addusertorole`, `removeuserfromrole`) is **cloud-only,
  deliberately** — *"adding the current user to a role from client-side graph is one wire from a
  button to 'make me an admin'"*, which is **right for the writes**.

**Cost:** every membership app needs a bespoke cloud function (`myStanding`, in TPL-001) *just to
decide whether to show a page* — a round trip, a security policy entry and four nodes before a single
screen can branch.

⚠️ **Phase 78's D4 lowered this from high to medium and the reason matters.** An app *can* branch on
the **refusal** of a query it was going to run — `DbCollection2` has a `failure` signal and an `error`
output, confirmed at HEAD. So the cost of not having (a) is a screen that must issue a members-only
query, have it refused, and *then* say "you may not", **flickering through "nothing here" on the
way**. That is worse than a round trip, not impossible without one.

**Fix candidate.** A read-only `roles` output on the `User` node, resolved from the session the same
way enforcement resolves it (`SecurityState.rolesForUser`). **Reading one's own roles grants
nothing** — the server still decides every request — and it removes the round trip from the most
common branch in the product.

## 2. (b) Nothing enumerates the members of a role

`getuserroles` answers *"which roles is this user in"*. **There is no inverse.** So *"show me the
member list"* — the most ordinary screen in a membership app — cannot be built at all without
maintaining a projection collection that duplicates `_Role`, which goes stale the first time somebody
changes a role by hand.

**Fix candidate.** A cloud `List Users In Role` node. The junction is already there and the resolver
already walks it in one direction.

**TPL-001 ships without the member list because of this.**

## 3. Acceptance criteria

1. **A person's sentence:** *I can show a members-only page without asking the server twice, and I
   can show my members who else is a member.*
2. (a) A browser graph branches on the current user's roles **without a bespoke cloud function**.
3. (a) 🔴 **A negative control:** the new output grants nothing — a user who edits it client-side is
   still refused by the server. **Assert the refusal**, not just the read.
4. (b) A role's members are enumerable from a cloud graph, with the same ACL posture as
   `getuserroles`.
5. TPL-001's member list is built on it — as **evidence**, not as the acceptance.

## 4. Traps

- 🧭 **The security posture is a ruling, not an implementation detail.** The cloud-only rule on the
  *writes* is correct and must survive. Get the read/write asymmetry ruled before building.
- 🔴 **Assert an absence only beside a known-firing signal.** "The role read was refused" and "the
  role read was never requested" look identical and have opposite fixes.
- ⚠️ **A new table or route owes four sweeps** (UNI-001). A **method** fires none — prefer the
  method if it will do.


---

## 5. Built — session 27

**Richard's ruling of 2026-08-30 built as ruled: both halves.** The cloud-only rule on the role
**writes** survives untouched and is pinned by a test that would redden if it moved.

### 5.1 (a) The `User` node's `Roles` output

| where | what |
|---|---|
| `nodegx-backend/src/server/users.ts` | `login`, `/users/me` and `signup` answer a synthetic `roles`, resolved per response by a new private `rolesFor()` from `SecurityState.rolesForUser` — the same JOIN the access check runs. `updateUser` strips an incoming `roles`. |
| `noodl-runtime/…/user/user.ts` | a static, read-only `roles` output (`array`, group General), refreshed wherever the user model is. |

🔴 **No new route and no new table**, so the UNI-001 four sweeps are not owed — the value arrives on
the read the client was already making. That was the ruling's own constraint and it held.

⚠️ **Three answers, not two.** `undefined` = nobody signed in, *or* a backend that does not track
roles; `[]` = signed in and in none. Collapsing them would render *"we could not ask"* as *"you are
not a member"* — the confident-wrong version of the screen the port exists to draw. A mutant that
collapses them reddens two rows and nothing else.

⚠️ `roles` is **not** a `_User` column and must never become one. It is resolved, never stored.

### 5.2 (b) `List Users In Role`

`SystemRoles` gained a `members` op (`RoleStore.members` already walked the junction); the node is
`noodl-viewer-cloud/src/nodes/cloud/listusersinrole.ts`, registered cloud-only beside the other
three, in the picker's `Roles` group, with a catalog enrichment entry.

Outputs `Users` / `User Ids` / `Total`, with `Limit` (default 100) and `Skip`. 🔴 **`Total` is not
decoration**: turning ids into records is N fetches and a role can hold every account, so the page is
bounded — and a clipped page has to be legible as one, or a member list silently reports six people
as two.

⚠️ **The default lives in the BACKEND, not on the port.** A declared default never runs its setter
(DEF-033), so `_internal.limit` is `undefined` until somebody sets the port — and a Request parameter
arrives as a *string*. `boundedInt` handles both; the spec sends `'2'` deliberately.

### 5.3 🔴 AC3 — the negative control, and what it actually measured

`nodegx-backend/tests/def005-membership.test.ts`, **13 rows, real HTTP, `devOpen: false`.**

The first test is the **known-firing signal**: `staffer`, genuinely in `member`, calls `memberonly`
and gets **200**. Every 403 after it is an absence of *permission*, not an absence of a request —
same fixture, same transport, same run. Copied from `def009-public-write-default.test.ts`'s
`declared-tight` arm, as the handoff said to.

The tamper arm then does the thing AC3 names: `impostor` PUTs `{roles:['member']}` onto their own
record, and is **still 403** on the identical call that returned 200 above.

🔴 **A mutation found something worth writing down.** Removing `delete body.roles` reddens the
*stripped* row and **leaves the refusal row green** — which is the correct result and the real
finding: the escalation is impossible *architecturally*, because enforcement reads the junction and
has never read a `_User` column. The strip is **hygiene, not the defence**. A future reader who
deletes it will break a test that says so.

⚠️ **`/users/me` alone cannot grade the strip.** The resolved value is spread last, so a stored
`roles` column is invisible in the response either way — "stripped" and "stored but shadowed" read
identically there. `GET /admin/schema/_User` is what tells them apart, and that row carries its own
known-firing control: the same PUT also sent `nickname`, which **did** land.

### 5.4 The port itself

`noodl-runtime/test/corpus/def005-user-roles-output.test.ts`, **7 rows**. Values cross a real wire
into a receiver rather than being read off `getOutput().value` — the defect is a graph that *could
not branch*, so what must be proved is that the value reaches something that could. One row asserts
there is **no `roles` input**: a settable port would be the door this ruling opened on condition it
stayed shut, and a silent one, because the server would ignore it while the page rendered as though
it had worked.

### 5.5 Gates run

`nodegx-backend` def005 + cloud-system-roles + cloud-system-users + def009 → **58 passed**.
`noodl-runtime` full → **2604 passed**. `noodl-viewer-cloud` → **219 passed**. `noodl-mcp` budget and
catalog gates → **57 passed**. Editor library-index specs → **44 passed**. `catalog:check` and
`catalog:merge:check --require-coverage` → **green** (the coverage gate caught the missing enrichment
entry; it is written).

### 5.6 🔴 AC5 is NOT done, and it was never the acceptance

> *"5. TPL-001's member list is built on it — as **evidence**, not as the acceptance."*

Not built. It is a change to `templates/members-area/`, which is another lane's artefact, and the
handoff flags the template lanes as active. **The capability AC5 would demonstrate is graded
directly** by §5.2's rows — what is missing is the demonstration, not the mechanism. Whoever picks
it up owes `helpers/members-drive.ts` a roster page and nothing else.

### 5.7 Owed elsewhere

- ⚠️ **The `Roles` output is undriven in a real editor.** It is graded end to end over real HTTP and
  at the port, but nobody has watched it appear in the property panel of a running editor. Cheap.
- ⚠️ Four MCP/editor spec comments say *"175 built-ins"* in prose; the catalog is now **176**. They
  are historical measurements in other lanes' files and assert nothing, so they were left alone
  rather than churned.
