# DEF-005 — Membership is a category the graph cannot express

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
