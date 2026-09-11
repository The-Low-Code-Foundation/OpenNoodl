---
title: "List Users In Role"
---
Lists the accounts in a permission role, from inside a cloud function. Cloud-only and read-only — the inverse of Get User Roles.

Get User Roles answers 'which roles is this user in'. List Users In Role answers the other direction: 'who is in this role'. Both walk the same membership junction, and until this node existed only one direction was reachable — so 'show me the member list', the most ordinary screen in a membership app, could not be built at all except by maintaining a separate collection that duplicates the role table and goes stale the first time somebody changes a membership by hand. `Users` holds the member records in the same shape the User node reads, so a For Each over them uses the same property names. `Total` is the whole membership before `Limit`, so a clipped page is always visible as one rather than silently looking like the complete roster. `unchanged` fires when the role exists and nobody has joined it; a role that does not exist is a `failure` naming it, because answering an empty list for a misspelled role draws the empty-community screen for a typo.

## When to use it

Whenever a cloud function needs the membership of a role rather than the roles of a member — rendering a members directory or a staff list, counting how many people hold a subscription tier, or fanning a notification out to everyone in a role. Compare `Total` with the length of `Users` to decide whether to ask for another page.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.listusersinrole` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `limit` | Number | `100` | How many members to return in one call; Total still reports the whole membership, so a clipped page is always visible as one |
| `role` | String | — | Name of the role to list the members of, matching the name a permission rule uses after "role:" — letters, digits, underscore and hyphen only |
| `skip` | Number | `0` | How many members to step over before this page — Skip 100 with Limit 100 is the second page |
| `treatUnchangedAs` | Enum (`unchanged`, `done`, `failure`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way; Failure suits one whose idiom is that a no-op is a bug. Completed fires whatever this is set to. |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `read` | Signal | — | Reads the members of the role |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `total` | Number | — | How many members the role has in total, before Limit — compare it with the length of Users to know whether there is another page |
| `userIds` | Array | — | Object ids of the members in this page, in the same order as Users |
| `users` | Array | — | The member records for this page, shaped exactly like the account record /users/me answers with, so a For Each over them reads the same property names the User node does |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once Users and User Ids hold this page of the role membership |
| `unchanged` | Signal | — | Fires when the role exists and has no members at all — the "nobody has joined yet" branch |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed |
| `failure` | Signal | — | Fires when the members could not be read — a blank Role, an unusable name, or a role that does not exist |

## Patterns

- Put this behind a cloud function whose call rule names the role that may see the roster — a member list is other people's account records, and a cloud function runs as system, so the function's own permission rule is the only thing deciding who may read it.
- Page a large role by wiring Skip from a page counter and comparing Total against the running count of rows already shown, rather than assuming one call returned everybody.

## Watch out for

- Rendering Users straight onto a public page without a call rule on the function — the graph's Allow Unauthenticated port is what applies when no rule is written, and ticked means the whole membership roster is readable by anyone on the internet.
- Treating the length of Users as the membership count; it is the size of one page, and Total is the number that answers 'how many members are there'.

## Examples

**Show the member list for a role, a page at a time**

Get User Roles answers 'which roles is this user in'. List Users In Role answers the other direction — 'who is in this role' — and that direction is the one an ordinary membership screen needs. Both walk the same junction, so neither can disagree with what a permission rule's `role:` check would say. Paging is done with Limit and Skip rather than by fetching everything and slicing in the browser, because the member list of a role is exactly the collection that is small in development and large in production; Skip is computed from the page number in an Expression so the arithmetic lives in one place. `Total` is the count for the WHOLE role, not the page, which is what a pager needs to know how many pages there are — a function that returns only the rows cannot render '3 of 47'. `unchanged` fires instead of `done` when the role is empty or does not exist, and it is wired to the same Response here on purpose: an empty member list is a perfectly good answer to send back, and leaving that outcome dangling would make a brand-new role look like a broken function to the caller. Read-only throughout — nothing on this path writes, so it is safe to call on every render of the screen.

## Related nodes

[Get User Roles](./noodl-cloud-getuserroles.md), [Add User To Role](./noodl-cloud-addusertorole.md), [Remove User From Role](./noodl-cloud-removeuserfromrole.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
