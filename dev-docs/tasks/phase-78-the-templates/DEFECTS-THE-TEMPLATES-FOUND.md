# Defects the templates found

**Richard, 2026-08-28:** *"If you find a problem with the codebase or MCP or whatever, add it to
the next session prompt to fix please. We're making templates to surface bugs and issues with the
whole NodeGX concept as well."*

So this file is a **standing output of phase 78**, not a one-off. Building a real app through the
real doors is the only thing that exercises them the way a customer will, and what it turns up
belongs here the moment it is measured.

## House rules for this file

- 🔴 **A row is a measurement, not an impression.** Say what was done and what happened. A defect
  filed on a hunch costs the next session more than it saves.
- ⚠️ **Disproved candidates stay, marked.** "I thought this was broken and it is not" is worth as
  much as a real row — it stops the next person re-deriving it. See D6.
- Each row names **where it bites a person**, not just where the code is wrong.

---

## D1 — 🔴 The MCP door accepts wires to ports that do not exist. Three classes, all silent.

**Severity: high.** This is the class SB-018 (1) lived in for five sessions.

Measured by sabotage during TPL-001 authoring. In each case the run came back `isError: false`
with **exactly the same 46 `info dynamic-port-skipped` diagnostics as the clean run** — no error,
no warning, and not even an info about the wire:

| what was sabotaged | what the door said |
|---|---|
| `standing.isMember` → `standing.isMemberXX` (a **component-instance** output) | nothing |
| `send.in-name` → `send.in-nameXX` on a **`CloudFunction2`** whose endpoint declares `name,email,password,message` | nothing |
| `goDetail.pm-announcementId` → `pm-noSuchParam` on a **`RouterNavigate`** whose target page declares `announcementId` | nothing |

🔴 **All three targets are components the door has already resolved on disk**, and each declares
its ports in a file the door reads:

- a component instance → the `Component Inputs` / `Component Outputs` node in the target component
  (⚠️ note the inversion: `Component Inputs` declares *output*-plugged ports inside the component,
  and those are the *inputs* an instance exposes);
- `CloudFunction2` `in-*`/`out-*` → the target cloud component's `noodl.cloud.request` `params`
  stringlist and its `noodl.cloud.response` `params`;
- `RouterNavigate` `pm-*` → the target page's `PageInputs.pathParams` and the `{braces}` in its
  `Page.urlPath`.

**Where it bites a person.** Every gate in the members' area is a component-instance port —
`isMember` reveals the content, `isModerator` reveals the moderator's tools, `Member`/`Moderator`
are the *only* triggers the queries have. A typo in any of them fails **shut and silently**: a
screen that stays empty, a list that never loads, and a green authoring run. An agent authoring
through this door has no way to learn it made the mistake.

**Fix.** Extend the connection check to resolve these three references the same way
`For Each.template` already is (`repeater-template-unresolved` is blocking, and it is the proof
this is the door's job). ⚠️ If a full check is too strong to land at once, the cheap half is worth
having on its own: **emit an info naming the wires that were not verified**, the way
`dynamic-port-skipped` does for parameters. Today the door is silent about connections in a way
that reads as "checked and fine".

**Interim cover:** `packages/noodl-mcp/tests/tpl001Template.test.ts` §3 does the instance-port
check over the shipped artefact. It covers one template, not the door.

---

## D2 — 🔴 The browser cannot read the current user's roles at all

**Severity: high — it is a hole in the concept, not just the code.**

- `_Role` is a system class: `isSystemCollection` gives every `_`-prefixed class a fixed `nobody`
  posture **regardless of config**, so no query reaches it.
- The `User` node's outputs are the columns of `_User`, and role membership is not one.
- The whole roles family (`getuserroles`, `addusertorole`, `removeuserfromrole`) is **cloud-only**,
  deliberately — *"adding the current user to a role from client-side graph is one wire from a
  button to 'make me an admin'"*, which is right for the writes.

**Where it bites a person.** Every membership app — which is to say the entire category this
template is aimed at — needs a bespoke cloud function (`myStanding`, here) *just to decide whether
to show a page*. That is a round trip, a security policy entry and four nodes before a single
screen can branch. Anyone building this without our findings will instead infer membership from
whether a query came back empty, which is D3's trap and is wrong.

**Fix candidate.** A read-only `roles` output on the `User` node, resolved from the session the
same way enforcement resolves it (`SecurityState.rolesForUser`). Reading one's own roles grants
nothing — the server still decides every request — and it would remove the round trip from the
most common branch in the product.

---

## D3 — 🔴 Nothing enumerates the members of a role

**Severity: medium-high. It makes an ordinary screen unbuildable.**

`getuserroles` answers *"which roles is this user in"*. There is no inverse. So **"show me the
member list"** — the most ordinary screen in a membership app, and named in TPL-001 §3 — cannot be
built at all without maintaining a projection collection that duplicates `_Role`, which then goes
stale the first time somebody changes a role by hand.

**Fix candidate.** A cloud `List Users In Role` node. The junction is already there and the
resolver already walks it in one direction.

**Until then** TPL-001 ships without the member list, and the decision is Richard's (TPL-001 §10).

---

## D4 — ⬜ Is a refused query distinguishable from an empty one? (the drive answers this)

**Open. Filed here because the answer decides whether D2 is a convenience or a necessity.**

`DbCollection2` has a `failure` signal and an `error` output, and `setError` raises a runtime error
code — so **if** a 403 reaches that path, an app can tell "you may not read this" from "there is
nothing here". Prior sessions recorded the opposite (a refused query publishing `[]` like an empty
one), which is why every members-only screen in TPL-001 is branched on `myStanding` instead.

**What to observe on the drive**, with the policy enforcing (`devOpen: false`): sign in as a
**pending** member, let a members-only query run, and record whether `failure` fires and `error`
carries a message, or whether `items` simply publishes `[]`.

- If `[]` with no failure → that is a **defect** with a real product consequence, and it belongs
  above this line with the others.
- If `failure` fires → the trap is narrower than recorded, the memory note should be corrected,
  and screens can branch locally in the common case.

⚠️ Either way TPL-001's design stands: the standing check is what stops the query running at all.

---

## D5 — ⚠️ `net.noodl.user.LogOut`'s signal input is named `login`

**Severity: low, and unfixable in the obvious direction.** `logout.ts:67` says why: the port name
is persisted in every project that uses the node, so renaming it breaks them. It is displayed as
"Do".

✅ **The door already handles this well** — it refused `logout` and named `login` as the
alternative, which is how it was found in one minute rather than one hour. Recorded only so the
next person does not re-derive it. If anything is worth doing, it is accepting `logout` as an
alias in the door's suggestion path.

---

## D6 — ✅ DISPROVED: "the door hides its node id remapping"

**Filed and then withdrawn in the same session, kept as a row on purpose.**

The door de-duplicates node ids **project-wide**, so a second component reusing `emptyState` is
written as `emptyState-2` — which broke two assertions written against authored ids. The first
reading was "the door rewrites ids and does not say so".

**It does say so.** `create_component` returns `remappedNodeIds` and `remapNote`, and
`responses.ts` states the reason in exactly the terms that were needed: *"a caller that intends a
follow-up `update_component` keyed on the id it just sent needs to know the id changed"*. **The
generator was throwing the payload away** — the same mistake it was making with the door's
diagnostics.

Both are now collected and printed (`built.remaps`, `built.diagnostics`). 🔴 **The lesson is about
the caller, not the door: an absence you have not looked for is not an absence the tool has.**
