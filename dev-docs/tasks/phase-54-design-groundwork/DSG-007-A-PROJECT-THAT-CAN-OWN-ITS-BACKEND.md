# DSG-007 — A project that can own its backend

**Status:** 🔴 **open** · README register **F2**, verified still true 2026-08-10 · acquired while
building [DSG-001](DSG-001-THE-REFERENCE-BUILD.md), not design work · blocks nothing, costs an hour
every time it is met

## The defect

`findReusableBackend` matches on name **and** ownership
([`provision.ts:193-201`](../../../packages/noodl-mcp/src/backend/provision.ts)):

```ts
if (!projectId) return undefined;
return existing.find((b) => b.name.trim().toLowerCase() === wanted && (b.projectIds ?? []).includes(projectId));
```

`projectId` comes from `nodegx.project.json → id`
([`provisionTools.ts:102`](../../../packages/noodl-mcp/src/tools/provisionTools.ts) —
`projectId: projectFile?.id`). **No v2 project on this machine has an `id`.** Checked again on
2026-08-10: `ecommerce-example` and `Puppy test 3` both return `undefined`, and nothing in the v2
creation path writes one — though `project-v2.schema.json:19` defines the field.

So `projectId` is `undefined`, the guard returns `undefined` before it compares anything, and
`createBackendDir` stamps `projectIds: []` at creation (`:222`). **The match can never succeed for a
v2 project, in either direction.**

## §1 — The ownership half of the rule is right; its failure mode is not

Matching on **name alone** is what made every AI-created project on a machine bind to the first
backend ever provisioned on it, which is a worse defect than this one. The comment at `:186-192` is
correct and should stay: ownership is not an optimisation, it is the correctness half.

The bug is the *undefined* branch. When the project cannot say who it is, the right behaviour is to
**fall back** — refuse to reuse *and say so*, or adopt on name plus an explicit confirmation — not to
silently create a second backend as if none existed.

## §2 — What the disk shows, 2026-08-10

`~/.noodl/backends/*/config.json`, all seven:

| Backend | Port | `projectIds` |
|---|---|---|
| SQLite backend | 8578 | `[]` |
| BCN009 QA | 8579 | `[]` |
| App backend | 8580 | `[]` |
| Puppy test 3 backend | 8581 | `["692d3658-…"]` |
| **Shop backend** | 8582 | `["ecommerce-example"]` |
| **Stock Cupboard Backend** | 8583 | `["1de70885-…"]` |
| **Stock Cupboard Backend** | 8584 | `["31fb013d-…"]` |

Three things in that table, and none of them is in the README:

1. ⚠️ **The `ecommerce-example` workaround is half gone.** The README says the project was fixed by
   hand — *"wrote `id`, stamped `projectIds`"*. The backend still carries the stamp, but it carries
   the **project name**, and the project file has no `id` at all today. The hand fix does not survive
   whatever rewrote that file.
2. ⚠️ **Two `Stock Cupboard Backend`s exist**, on consecutive ports, each owning a different id. That
   is the predicted stranding, on disk, with the first one's data in it.
3. Three backends have `projectIds: []` — orphans that can never be reused by anyone.

## §3 — The mitigation the README does not mention, and its limit

`provision_backend` **refuses outright** when the project is already bound
([`provisionTools.ts:87-95`](../../../packages/noodl-mcp/src/tools/provisionTools.ts)) — *"This
project already points at …. Nothing was created or started"* — unless `force` is passed. That has
been there since `460f17e3` (2026-08-06), before F2 was filed, and it blunts the worst case: for a
bound project the second-backend path is not reachable by accident.

⚠️ **It does not close the defect.** The refusal reads `metadata.cloudservices`, so it protects a
project that is *currently bound*. It does nothing for a project whose backend was reaped
(`reapOrphanedBackends`), for a fresh copy of a project, or for the reuse case the rule exists to
serve — and the two `Stock Cupboard Backend`s are what the gap looks like.

## §4 — The fix, in the order it should be built

1. ⭐ **Write an `id` at project creation.** The schema already defines it; the creation path does not
   populate it. One field, and it is the root cause of every row above. ⚠️ Check **both** creation
   paths — the editor's new-project flow and `create_project` in the MCP server — or half the
   projects on a machine keep the defect.
2. **Backfill on load, once.** A project with no `id` gets one written the first time it is opened,
   so existing projects stop being permanently unmatched. ⚠️ It is a write to `nodegx.project.json`
   on open, which is the kind of damage noticed a week later — it must be idempotent, and a project
   opened and closed with no other change must otherwise be byte-identical.
3. **Degrade the match instead of failing it.** With no `projectId`, `findReusableBackend` should
   report *"a backend named X exists and this project cannot prove it owns it"* rather than returning
   `undefined` into a code path that creates a second one.
4. **Sweep the orphans.** Three backends with `projectIds: []` and two duplicate Stock Cupboards —
   decide once whether they are adoptable or garbage, and make `list_backends` say which.

## Acceptance

- A newly created v2 project has an `id`, from **both** creation paths, pinned by a spec each.
- Provisioning a backend for a project, restarting the MCP server, and provisioning again **reuses**
  it — the number of directories under `~/.noodl/backends` does not change. This is the whole task in
  one check.
- An existing project with no `id` acquires one on open; opening and closing it changes nothing else
  in the file.
- With no `id` available, the tool result **says why** it could not reuse. It does not silently
  create a second backend.
- ⚠️ The name-only match is **not** reintroduced: two different projects both named "Shop" must not
  share a backend.

## Register

| # | Finding | State |
|---|---|---|
| F2 | `findReusableBackend` can never reuse a backend for a v2 project, because `projectId` is always `undefined` | 🔴 **open** — re-verified in source and on disk 2026-08-10 |
| F27 | **The `ecommerce-example` workaround is gone from the project file**; the backend still carries `projectIds: ["ecommerce-example"]`, which is a *name*, not an id | 🔴 open — the README's F2 row overstates the mitigation |
| F28 | **Two `Stock Cupboard Backend`s on ports 8583/8584** — F2's predicted stranding, observed | 🔴 open |
| F29 | The already-bound refusal (`provisionTools.ts:87-95`, since `460f17e3`) blunts the worst case and is **not** in the README's account of F2 | ✅ verified — see §3 for what it does not cover |
</content>
