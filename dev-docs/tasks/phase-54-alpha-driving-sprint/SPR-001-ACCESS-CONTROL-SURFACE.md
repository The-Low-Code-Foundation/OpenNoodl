# SPR-001: The access-control surface

| Field | Value |
|-------|-------|
| **ID** | SPR-001 |
| **Phase** | 54 — The alpha driving sprint |
| **Tier** | 1 — blocks the alpha |
| **Findings** | F84, F85, F86, F87 |
| **Measured** | 2026-08-06 against `91fcd680` |
| **Branch** | commit directly to `cline-dev` |

## Objective

The NodeGX backend's access-control model is **real, correct, and property-tested**. The
editor surfaces on top of it are not usable for the job they exist to do. Close that gap
without touching the model.

## §1 — F87 first, because it changes what the rest of this task means

**Richard's question:**

> *"In the create records node, I'm using our SQLite backend, and it offers me Access
> Control Rules, do they actually work? … I'm worried it's a vestige of the Parse Server
> nodes which had this ACL system, but if not I'm really happy to still have it."*

**Answer: they work. It is not a vestige.** Verified end to end on 2026-08-06:

| Link | Evidence |
|---|---|
| The node collects an ACL | `noodl-runtime/src/nodes/std-library/data/newdbmodelpropertiesnode.ts:118` — `acl: this._getACL()` |
| The adapter sends it | `noodl-runtime/src/api/backends/ParseWireAdapter.ts:497` and `:545` — `{ ACL: options.acl }` |
| The backend models it | `nodegx-backend/src/security/model.ts` — `principalKeys()` returns `['*', userId, ...roles.map(r => 'role:' + r)]`, which is exactly the key set an ACL object may use |
| The backend enforces it | Same file — the JS twin of the SQL ACL predicate, **property-tested against the SQL** in `tests/security-model.test.ts`, and shared with realtime delivery so "query filtering and event filtering can never drift apart" |

The normative document is
`dev-docs/tasks/phase-22-production-backend/BAK-003-SECURITY-MODEL.md`, and its own
header states the rule to keep: *if code and document disagree, the document wins and
the code is the bug.*

⚠️ **The one real caveat, and it is not on this backend.** `RestDataAdapter` — the BYOB
REST path (Supabase, PostgREST, and the rest) — **drops a per-record ACL**:

```
RestDataAdapter.ts:1032   if (options.acl && !this.allows(handle, 'data.acl')) {
RestDataAdapter.ts:1038     console.warn(`[RestDataAdapter] ACL ignored on ${handle.type}. …`)
```

That is deliberate and documented in place: those backends control access with roles,
RLS or API rules instead. The record is still created. **It warns to the console and
nowhere else** — which is the right call for a `console.warn` and the wrong call for a
user, and is worth a line in SPR-001's follow-up rather than a fix here.

**Deliverable for §1:** no code. Write the answer into the Create Record node's ACL port
description and into the backend authoring reference, so the next person does not have
to re-derive it. Richard asked a question that took forty minutes to answer from source;
that is the defect.

## §2 — F84: the data browser hides the ACL 🔴

**Richard:**

> *"I created a record with a specific ACL attached. When I go into the data explorer, I
> don't see the ACL for the record I created, which would make debugging a question like
> 'Why can't this user see this record?' much more difficult."*

This is the finding that gates the other three: **without it, no ACL work can be
verified by looking.** Do it first.

Where: `packages/noodl-editor/src/editor/src/views/panels/databrowser/DataGrid.tsx`.
`READ_ONLY_FIELDS` at `:45` is `{objectId, createdAt, updatedAt}` — ACL is not in it,
and not in the column list either.

⚠️ **Measure before you fix.** Two different defects produce the same screen and they
need different fixes:

1. the backend does not return `ACL` on a record read, or
2. it returns it and the grid's column derivation drops it.

Check (1) first with a direct read against the running backend. Do not assume the grid
is at fault because the grid is where you noticed it.

**Wanted:** an `ACL` column, shown by default, rendered as JSON, **editable as JSON**.
Richard was explicit about the scope — *"json editor for now, we'll do visual stuff
later"*. A visual ACL editor is out of scope for this phase.

## §3 — F85: collection permission rules are free text

**Richard:**

> *"can we make the 'Access' page 'Collection permissions' section fields dropdowns?
> Right now you have to manually type 'nobody' into the field, which is going to lead to
> disaster."*

He is right, and the vocabulary is closed and already written down. `security/model.ts`
declares it:

```
type ClpOp = 'find' | 'get' | 'create' | 'update' | 'delete'
a rule is  'public' | 'authenticated' | 'nobody' | 'role:<name>'
```

Where: `packages/noodl-editor/src/editor/src/views/panels/permissions/PermissionsPanel.tsx`.
Every rule cell is a raw `<input className={css.RuleInput}>` — `:583-586`, `:651`,
`:674-678`, `:692-696`, `:731`. A typo in any of them is silently a different policy.

**The detail that makes this more than a widget swap:** the roles are *in the same
panel*. `:762` is the "new role name" field. So the dropdown can offer
`role:<name>` for every role the user has actually created, which is what Richard asked
for:

> *"would be nice if the dropdown inherited the roles you create and allowed them to be
> added from the dropdowns too"*

A rule is comma-separated OR (the panel's own help text says so), so the control needs
to express **a set**, not one choice — a multi-select over
`public | authenticated | nobody | role:*`, with `nobody` and `public` mutually
exclusive with everything else. He explicitly invited a better layout:
*"if you can think of a more clever layout … be my guest."*

**Do not drop free-text entry entirely** without checking `ruleToText`/its inverse for a
form the dropdown cannot express; keep an escape hatch if one exists.

## §4 — F86: nothing can put a user in a role 🔴

**Richard:**

> *"say I'm signing up a user and I want them to become part of the 'member' role or
> whatever, what node would I use? If one doesn't exist, this should be created."*

**It does not exist.** `packages/noodl-runtime/src/nodes/std-library/user/` contains
exactly three files — `user.ts`, `user-ports.ts`, `setuserproperties.ts`. There is no
role node anywhere in the library.

So today: roles are creatable in the Permissions panel, and members can only be added by
**pasting a user's objectId into a text field by hand, in the editor**. There is no
runtime path at all. That means the entire role half of the access-control model is
unreachable from a running app — you can write `role:member` in a rule, and nothing your
app does can ever put anyone in `member`.

**Wanted:** at minimum, a node that adds and removes a user from a role at runtime.

⚠️ **Two design questions this task must answer before building, not during:**

1. **Who is allowed to call it?** A node that adds the current user to any role, callable
   from client-side graph, is a privilege-escalation primitive. The likely correct answer
   is that role mutation is backend-only — a cloud function or workflow step, not a
   browser node — which makes this a *cloud* node and changes where it lives. **Decide
   this first; it determines the whole shape.**
2. **Nested roles.** Richard notes Parse allowed roles to contain roles: *"even add roles
   to roles so you get a kind of nested ACL if that's possible."* Check whether
   `principalKeys()` resolves transitively — it takes `principal.roles` as already
   resolved, so the question is what resolves them. **Phase 54 records this question and
   does not have to answer it**; say which you chose and why.

Richard's framing is worth keeping: in Parse, Role was *"considered as a default table
that you could create records in, update records (add users to roles)"*. Whether NodeGX
exposes roles as a collection or as a node API is the design call.

## Acceptance criteria

1. F87's answer is written into the product (port description) and the reference — not
   only into this file.
2. The data browser shows an `ACL` column by default and can edit it as JSON, and the
   underlying cause was **measured** before it was fixed.
3. Collection permission rules are chosen from the closed vocabulary, roles included,
   with multi-select for the OR case.
4. A user can be added to and removed from a role by a running app, with the
   who-may-call-it question answered explicitly in the task's notes.
5. Every one is **driven in a real editor** against a real SQLite backend. A green suite
   is not a pass for any of these — all four are surfaces.

## What would make this task fail

Fixing F85 and F86 before F84. Without the ACL column you cannot see whether a role
membership or a permission rule did anything, so you would be building two features and
verifying neither.
