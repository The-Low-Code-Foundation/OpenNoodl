# Phase 76 — next session

Read `TASKS.md` here first, then `SB-004-THE-SITE-IS-RECORDS.md`. In that file the three sections
that matter now are **§1** (the measured ground everything rests on), **§6 F2/F7** (the two traps
that can make a passing run mean nothing), and **§7a** (how the next piece of work actually runs —
scoped last session, not built). The canonical backend model is
`dev-docs/reference/BACKEND-AUTHORING-MODEL.md`. Before authoring any cloud component, read SB-001's
"Doctrine traps".

## Where s3 left it (2026-08-26)

**SB-004's authoring is finished.** All six components — three endpoints and three helpers — are
authored through the MCP doors and green: `noodl-mcp/tests/sb004Authoring.test.ts`, 13 specs,
noodl-mcp **60 suites / 694**, `typecheck` clean. s3 added `duplicatePage`, `submitContactForm`,
`site/CopySectionToPage`, `site/ContactRecipient`, and drove the contact pair through the plan door
as well as `create_component`. Committed as `02206e0a`.

**The session's real finding was about s2's own work.** Reading `Query Records` and `Response`
closely enough to author `duplicatePage` showed the *already-green* publish flow was wrong twice
(§6 **F5**): its section query carried **no filter**, so it returned every Section in the site and
would have flipped their access rules in one authority; and its Response declared two parameters and
wired neither, answering 200 with `{}`. Both are **legal graphs** — an absent `visualFilter` means
"match everything", an unwired parameter means "omit it" — so no validator could have called either
an error. Both are fixed and pinned by assertions on the files **on disk**, each graded by a mutant.
The lesson to carry: s2's green meant *well-formed*, which is all it ever claimed.

Also new: **F6** — one plan can hold a helper and the endpoint that instantiates it (staging
resolves an unapplied sibling), measured beside a known-firing refusal arm. And **SB-009 got its
sharp form**: the same helper named as a node **`type`** is refused `unresolved-component-ref`,
named through a `taskTemplate` **parameter** it is accepted `0/0/0`. Not "the door fails to resolve
references" — *one spelling of the same reference goes unresolved*, which names the fix's diagnostic.

## Two things to read before trusting any ACL work here

🔴 **F2 (§6).** `devOpen` (default `true`, active on loopback) disables **row-level ACL**
(`SecurityState.aclFor` returns `undefined`) and does **not** disable collection permissions
(`checkClp` has no such branch). So a local backend refuses an anonymous caller via CLP — which
*looks* like enforcement — while the published/draft boundary, which is entirely ACL, is never
exercised. It inverts once this template's own `security.json` lands: with `Page.find: 'public'`
there is nothing left to refuse, and a loopback backend serves **every draft** to anonymous callers.

🔴 **F7 (§6), new in s3.** **Nothing creates the `admin` role that every rule in §3 and §4 names.**
`principal.kind === 'admin'` is the backend-admin *credential* (the `secrets.json` bearer) and
bypasses everything; `role:admin` is a row in `_Role` joined through `_Join_users__Role`, there is
no built-in role of any name, and `signup` is a rule about who may sign up — it cannot grant one. So
the template as specified is **un-authorable** on a fresh deploy: `Page.create: 'role:admin'`
refuses the site owner and the draft ACL grants nobody. Read from source, not yet from a run — and
the run should assert the un-provisioned refusal, because that failure otherwise reads as "the
permissions work".

## Next work, in order

1. **The real backend run** — SB-004 §7 acceptance 2–4, 7, 8. This is the first thing that can say
   the invariant holds; a green authoring run explicitly cannot, because the door returns
   `dynamic-port-skipped` over exactly the ACL parameters and says the node is *"unverified by that
   check rather than verified as correct"*. **§7a scopes it** — read that before starting. The
   short version:
   - `new BackendService({ dataDir, port: 0 })`; `allowEphemeral` already defaults to `false`, so a
     real SQLite engine needs no argument. Write `security.json` with `devOpen: false` **before**
     `start()`, and assert `started.security.enforced === true`.
   - Copy `nodegx-backend/tests/cloud-system-roles.test.ts` — it is `devOpen: false`, a cloud
     function over HTTP, and a row a reader 404s on until a role is granted. Helpers in
     `tests/helpers/http.ts`.
   - 🔴 **Drive the components the MCP door wrote, not twins of them.** Functions register by
     dropping a `*.workflow.json` (`{components, settings, metadata}`) into `<dataDir>/workflows/`,
     in the legacy nested `graph.roots` shape. `reconstructLegacyComponent` / `unflattenNodes`
     (`ProjectImporter.ts:82`, `:185`, re-exported by `noodl-mcp/src/editor-deps.ts:250-258`) are
     **pure** — no `ProjectModel`, no `NodeLibrary`, no Electron. `noodl-mcp/tests/roundtrip.test.ts`
     is the working template.
   - ⚠️ Budget for new ground: **no existing backend test puts a Record node inside a cloud
     function**, and none drives a project directory end to end.
   - ⚠️ A function runs with `masterKey`, so its own writes bypass both layers. Test the invariant
     from the **outside** — an anonymous and a non-admin caller reading over HTTP — never from the
     function's own view.
2. **SB-005/006** (admin panel, public site). SB-005 owns F7's provisioning step.
3. **SB-007** (ship embedded), **SB-008** (the drive — same `devOpen: false` requirement).
4. **SB-009** whenever it fits; its blocking promotion needs a corpus sweep, not an argument.

## Traps that will bite here specifically

- **`Create Record`'s `sourceObjectId` is a LOCAL model-scope read, not a backend fetch**
  (`newdbmodelpropertiesnode.ts:106`). An unfetched source seeds `{}` **in silence**.
- **A Pointer is a tagged object on the wire** and `prop-<field>` stores it verbatim. Write a bare id
  string into `Section.page` and `inferColumnType` makes a **String** column, after which `pointsTo`
  refuses for want of a `targetClass`. §2's one unhedged bet lives on one line of one code node.
- A cloud FUNCTION's interface is the Request node's `params` — and a `stringlist` is **one
  comma-separated string, not an array**. Helpers (no Request node) use Component Inputs/Outputs.
- `Run Tasks` pushes an item's **keys** onto matching Component Inputs (and `Id`/`id`). **Nothing
  constant across tasks can be passed**, and `Array Map` cannot supply it either — the per-item
  payload is built in a `JavaScriptFunction`.
- `Run Tasks` matches `Do`/`Success`/`Failure` on its template **by string**. A worker whose output
  is named `Done` makes the run hang for ever, with no warning.
- `Update Record`'s `collectionName` is **edit-only**, so one helper cannot serve two collections.
- Use **`receive`** as a Request node's trigger — it fires after every parameter output is updated.
  Triggering from `pm-<param>` works only by wire order.
- 🔴 **The MCP dist on this machine is stale** (2026-08-20, pre-SB-001/002/003) and the bound servers
  run it — proven by `get_project_info` returning no `backendDoctrine`. Author through
  `noodl-mcp/tests/helpers.ts` → `createServer` from `src`. Rebuild the dist before trusting any
  live MCP call.
- Shared checkout: commit by pathspec, never stage-then-commit; announce before any editor
  launch/teardown; `test:ci` alone, and completion is the **summary line**, never `$?`. s3 touched no
  editor or runtime source, so `test:ci` was not re-run — the floor recorded in s2 still stands
  (`Jasmine: 2856 specs, 4 failures`, all `AIX-006 style vocabulary`).
