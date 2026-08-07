# BCN-009 — Notes

**Scope of this run: steps 1, 3, 5 and 6.** Steps 2 (converging the metadata keys), 4 (the per-node
backend picker) and 7 (the live pass) were explicitly out of scope and are not started. Step 5 — the
security disclosure — is the deliverable, and the whole of it is reproduced below so it can be read and
marked up without running the editor.

**Branch:** `wt-bcn009`, based at `b0ac1591`.

---

## 1. The security disclosure — the prose, for review

This is the text as shipped, in
[`models/BackendServices/security.ts`](../../../packages/noodl-editor/src/editor/src/models/BackendServices/security.ts).
Each backend has three sentences plus, where there is one that will not rot, a link.

### The rules the prose follows

BCN-001 §5.4 set the voice for the capability reason strings, and three of its rules carry over
unchanged. The fourth is this task's:

1. **Name the backend and the thing, not the mechanism.** "Your Supabase anon key is published with your
   app" — not "credential exposure in the client bundle".
2. **Say where to go.** A sentence that says a rule exists but not which screen sets it has moved the
   problem, not solved it.
3. **No backlog language.** These are product facts about somebody else's backend, not our roadmap.
4. **Written for a beginner about to press publish.** Second person; no term used without being glossed
   once; and never a threat where a fact will do.

Rules 1–3 are enforced by a test rather than by memory, the same way BCN-001 enforced its three.

### Built-in

> **Your app publishes an app id, not a password.**
>
> Anyone who opens your published app can read its app id, and that is fine — on its own it opens
> nothing. What each visitor is allowed to see and change is decided by the backend itself, on every
> request, and nothing you set here is published alongside it.
>
> Open Access on this backend to say who can read and write each collection. Individual records can carry
> their own rule too, which is how a visitor ends up seeing only their own.

### Parse Server

> **Your app publishes the application id of your Parse server.**
>
> Anyone who opens your published app can read that id. It is not a password: what it reaches is whatever
> your class-level permissions and per-record ACLs allow, and your Parse server checks them on every
> request. A master key is never published — nothing in NodeGX puts one into an app.
>
> Class-level permissions and record ACLs are set on the Parse server itself, usually through a Parse
> Dashboard run by whoever hosts it. If someone else hosts your server, they own that screen.
>
> *Link: Parse security guide.*

### Directus

> **The public token you enter here is published with your app.**
>
> Every visitor can read that token, and can use it from outside your app just as easily as from inside
> it. It does exactly what its Directus role is allowed to do — no more and no less. So give that role
> read access to the collections you want the world to see, and nothing else.
>
> Roles and their permissions are set in Directus under Settings → Access Control, called Roles &
> Permissions in older versions. The admin token you enter here stays in the editor and is never
> published.
>
> *Link: Directus documentation.*

### Supabase

> **Your Supabase anon key is published with your app, and it is only safe with Row Level Security on.**
>
> Every visitor can read the anon key. Supabase is built that way and the key is meant to be public — but
> only while Row Level Security is switched on. Row Level Security is Supabase's per-row permission
> system; with it off, that key can read and write whole tables for anyone who copies it out of your app.
>
> Turn Row Level Security on for every table in your Supabase dashboard, then write a policy for each
> thing an anonymous visitor may do. The service_role key you enter here stays in the editor and is never
> published — it ignores those policies entirely, which is why it must not travel.
>
> *Link: Supabase Row Level Security.*

### PocketBase

> **PocketBase needs no key in your published app.**
>
> Nothing secret is published. PocketBase decides what an anonymous visitor may do from the API Rules on
> each collection, checked on its own server. Leave the public token empty unless you have a specific
> reason for one: if you fill it in, it is published with your app and every visitor can read it.
>
> Open a collection in the PocketBase admin UI and use its API Rules tab. An empty rule means anyone may
> do that thing; a rule such as published = true narrows it.
>
> *Link: PocketBase API rules.*

### Custom API

> **Whatever you put in the public token is published with your app.**
>
> Every visitor can read it and use it from outside your app. This is the one backend where we cannot
> tell you what that token reaches, because it is your API. Before you publish, check that it can do only
> what a stranger is allowed to do, and keep the more powerful one in the Admin field, which stays in the
> editor.
>
> Your API decides for itself. NodeGX sends the token and passes on the answer — it cannot loosen or
> tighten what your server allows.

### Changing backends

Thirty ordered pairs would be thirty paragraphs that drift within a phase, so the comparison is
**derived**: each disclosure carries two noun phrases — what it publishes, and where its rules live —
and the dialog puts the two backends' phrases side by side. Only a change in the *kind* of published
credential gets its own sentence, so that a line which appears every time does not train people to skip
it.

Two columns, "Now" and "After this change", each reading:

> **Built-in** — Publishes an app id, which opens nothing on its own. Access decided by the Access rules
> on each collection, checked by the backend.
>
> **My Supabase** — Publishes the anon key, which any visitor can copy and use elsewhere. Access decided
> by Row Level Security policies on each Supabase table.

Then, when the kind changed:

> This changes what your app publishes: My Supabase puts a token into the app that any visitor can copy
> and use from somewhere that is not your app.

And always:

> Permissions do not travel between backends. Anything you set up on Built-in stays there, and My
> Supabase starts with its own rules — check them before you publish.

### Why none of it is red

The task's own trap: *"The disclosure will be tempting to write as a warning. A red banner on every
backend teaches nothing and gets dismissed."* Red in this product means danger — a destructive action or
a failure — by phase law, and five of the six disclosures describe a backend working exactly as
designed. Amber was considered for the same reason and rejected. The tint is
`--theme-color-primary-bg` (azure at 13%), which is the token this design system already uses for *this
is worth reading*.

**The disclosure is shown always**, on every card, including the two backends that publish nothing a
visitor can use — because a disclosure that only appears when something is wrong teaches the user to
read its absence as safety, and absence is not the same claim.

---

## 2. Open question for Richard

**Phase question 6, unchanged and still his:** *are the four maturity levels the right gate for the
security disclosure?* BCN-009 says show it always and that is what shipped; OPS-001's Playing level shows
nothing.

The concrete alternative, so the choice is a choice rather than a shrug: **the disclosure stays always-on
and only the `publicToken` *finding* is gated.** The disclosure costs one collapsed line and answers "what
does choosing this mean"; the finding is a Critical item on a list that, at Playing, is a list of things
somebody experimenting on their laptop has not done wrong. That split keeps the awkward case — a lesson
project on a shared backend — informed without nagging, and it needs no new machinery: the finding
already exists as a pure function whose caller decides whether to run it.

---

## 3. What the spec got wrong

Four premises, in the order they cost time.

### 3.1 ⚠️ OPS-003's findings store does not exist, so step 6 cannot mean what it says

Step 6 is "register the `publicToken` visibility finding with OPS-003's findings store for OPS-006 to
consume". **Phase 31 has not started.** Every one of its nine tasks is `📋 Specced`, there is no
`.findings/` anywhere, no `Finding` type in `packages/`, and nothing that could be registered with.

The instruction that matters more is the one beside it — *"Do not build a second security-findings
mechanism"* — so this run did the only version of step 6 that honours both: it shipped **the check**, as
a pure function over the project's configured backends, returning exactly the facts a finding needs. It
writes nothing and persists nothing.
[`securityFindings.ts`](../../../packages/noodl-editor/src/editor/src/models/BackendServices/securityFindings.ts)
is what OPS-006 maps onto a `Finding` with `source: 'builder'` when there is a store to map onto.

Two shapes in it were chosen against OPS-003 §1 and OPS-006 §2 as specced, and are the parts worth
reviewing before phase 31 starts:

- **`anchor` is `{panelId, backendId}`, not `focusNodeId`.** OPS-006 §5 assumes every finding is
  graph-anchored so that clicking it selects a node. A backend binding is project metadata and is on no
  node. Inventing a node id to satisfy the shape would have produced a click-through that lands
  somewhere arbitrary.
- **`dismissalKey` includes a fingerprint of the token, not just the backend id.** A dismissal says "this
  key is safe to publish". A rotated key has not earned that, so rotating one re-opens the finding. The
  fingerprint is a length and a cheap non-cryptographic hash — the token itself never enters the
  finding, and there is a test that asserts it.

### 3.2 ⚠️ The Data Browser cannot be generalised yet, and the reason is not the adapter

Step 3 asks for "the Data Browser available for any backend whose adapter supports the browse operations
rather than only the local one". **The Data Browser does not speak HTTP at all.** Every call it makes is
an Electron IPC invoke — `backend:getSchema`, `backend:queryRecords`, `backend:saveRecord` — answered in
the *main* process by the manager that owns the `nodegx-backend` child processes. There is no URL in it
to repoint and no adapter seam to swap.

Generalising it needs two things that do not exist: BCN-004's REST adapter, **and** a main-process route
that hands an arbitrary `BackendHandle` to an adapter instead of a local process id. The shortcut that is
available today — pointing it at another backend's REST surface from the renderer — is the exact coupling
this phase is removing, and the spec's own trap says so.

What shipped instead is the phase's actual rule, which *is* implementable now:
`dataBrowserAvailability(type, kind)` asks the capability descriptor for the four record operations
first, then asks whether the editor can reach that backend at all, and returns a sentence either way. The
external cards carry a **Browse records** item in their `⋯` menu, disabled, with the reason on it —
because an absent button reads as "this backend has no records", which is the opposite of true. When
BCN-004 and the main-process route land, the second gate loses cases and the first is unchanged.

### 3.3 The panel had *three* mechanisms, not two

The spec's background says "One panel, two unrelated mechanisms". It is three: the `cloudservices`
endpoint pointer, the IPC-listed managed backends (which are not in project metadata at all — they live
in the editor's own `config.json` and become the project's backend by *writing* `cloudservices`), and the
`backendServices` REST configs. That matters for step 2, which is why §5 below is written in terms of
three.

### 3.4 The editor's `BackendType` was reachable from four places, not the whole tree

Widening the union looked like the risky part of step 1. It is not: `BackendType` is referenced only
inside `models/BackendServices/` and by `AddBackendDialog`, and `parseSchemaResponse` dispatches on
string equality with a generic fallback. Nothing in the runtime imports it. The union is now the
contract's, re-exported, which is the reconciliation `backends.ts`'s own comment asks BCN-009 for.

---

## 4. Deviations, with reasoning

| # | What the spec said | What shipped | Why |
|---|---|---|---|
| 1 | "one list, **one card shape**" | One list, one `Section`, one `+`, one disclosure component on every card — but still three card *components* (`LocalBackendCard`, `BackendCard`, the endpoint card) | The three cards already share a frame from PNL-004: same container query, same elevation, same header/identity/status/actions structure. Collapsing them into one component means rewriting ~200 lines of process control (start/stop/ephemeral/persistence-failure/cloud-functions/seven surfaces) that **cannot be run from a worktree**. The user-visible complaint — three headings implying three layers — is fixed; the component count is not, and is recorded rather than claimed |
| 2 | Add `parse` and `nodegx` "preset entries with endpoints, auth help and capability descriptors" | Both added with endpoints and auth help; the capability descriptor is **referenced**, not copied | The descriptors already exist and are complete in `@noodl/backend-contract`. A second copy on the preset would be the two-copies-of-one-fact mistake this phase is about. `BackendPreset.security` carries the disclosure; `descriptorFor(type)` carries the capabilities |
| 3 | The six presets go in the add dialog | They do, and the two Parse-wire ones **hand off** rather than showing the REST form | A Parse-wire backend needs `{endpoint, appId}` and nothing else. Making it fill in URL + admin token + public token + endpoint patterns would be a second place to configure the same thing, in a different shape — the duplication the task removes. `BackendPreset.configuredBy` is the dispatch |
| 4 | "reachable before publish" | Reachable in the panel, in the add dialog, and in the switch dialog. **Not** wired into a deploy/export flow | The deploy surfaces are phase 26's territory and were not mine this run. Where it should go is in §6 |
| 5 | The endpoint card shows "No backend connected" when empty | It renders **nothing** when empty | In a list that also contains backends, an empty card announcing there is no backend is the same confusion one level down. The empty state is now one message for the whole list |
| 6 | — | `LocalBackendCard` now says "Built-in • Port N", not "Local SQLite • Port N" | One name in both places is most of what makes a list stop reading as two products. "SQLite" is the leaked implementation detail the phase's own answered question rejected |

### Things deliberately not done

- **`packages/noodl-editor/package.json` was not touched.** BCN-003 already added
  `"@noodl/backend-contract": "file:../nodegx-backend-contract"` to it in `361a2a61`, which is not in this
  branch's base. That file is minified to a single line, so two branches editing it conflict on the whole
  file. Resolution works either way through the hoisted `node_modules`, so this branch imports the package
  without declaring it. **If this branch is merged and `361a2a61` is not, the orchestrator should add that
  one key.**
- **No runtime change.** `endpointBackendType` maps WF-007's `'nodegx' | 'external'` onto the contract's
  union in the editor only. The runtime's `resolveBackend` is BCN-003's territory this week and step 2's
  work next.

---

## 5. What step 2 needs: the converged metadata shape

Three homes today, and this is the whole of them:

| Home | Written by | Shape | Read by |
|---|---|---|---|
| `cloudservices` project metadata | `setCloudServices` (`projectmodel.editor.ts:200`) | `{instanceId, endpoint, appId, type: 'nodegx' \| 'external'}` | the Parse-wire clients directly; inlined into `index.js` at export by `utils/exporter/json.ts` via `{{#export#}}` |
| `backendServices` project metadata | `BackendServices.saveToProject` | `{backends: BackendConfigSerialized[], activeBackendId}` | `byob-utils.ts::resolveBackend`, with an `_active_` sentinel |
| editor `config.json` (not the project) | the main-process local-backend manager | `{id, name, port, createdAt, projectIds}` | the `backend:*` IPC handlers; the panel over IPC |

The third is correctly not project metadata — a locally-run process is a property of the machine, not of
the project. It enters the project only by writing `cloudservices`. **So the convergence is two keys, not
three**, and the third stays where it is.

### The proposed converged shape

One key, `backends`, holding what `BackendHandle` already needs plus what the editor needs to configure
it:

```jsonc
{
  "backends": {
    "active": "backend_1753...",          // replaces both `activeBackendId` and the implicit
                                          // "cloudservices is the one the record nodes use"
    "items": [
      {
        "id": "backend_1753...",
        "type": "nodegx",                 // the contract's six-value union, always present
        "name": "Built-in",
        "url": "http://localhost:8577",   // was `endpoint` on cloudservices, `url` on backendServices
        "appId": "backend_1753...",       // Parse-wire only; absent elsewhere
        "publicToken": "",                // REST only; the field BCN-009's disclosure is about
        "endpoints": { },                 // REST only; absent for nodegx/parse
        "responseConfig": { },            // REST only
        "schema": { },                    // editor cache, both families
        "managedId": "backend_1753..."    // present when a local process owns this entry, so the
                                          // panel can pair a card with its process without
                                          // string-matching a port out of a URL
      }
    ]
  }
}
```

Three decisions inside that shape, all of which will be argued about, so they are stated:

1. **`type` is mandatory and is the contract's union.** WF-007's `'external'` becomes `'parse'`. Today an
   endpoint with no `type` is ambiguous, and this branch reads it as `parse` (the narrower descriptor —
   guessing wide offers aggregate on a server that answers "master key is required"). The migration must
   make the same choice and write it down, once, rather than leaving the field absent.
2. **One `active`, not two.** Today `cloudservices` binds the record/auth/file nodes and
   `backendServices.activeBackendId` binds the BYOB nodes, and **both can be set at once**, pointing at
   different servers, with nothing in the product saying so. That is the strongest single argument for
   step 2 and it should be the migration's headline: a project with both gets one, and the user is told
   which one won.
3. **`url`, not `endpoint`.** `BackendHandle.url` is the contract's name and nine tasks register against
   it.

### What the migration must do

- Run **on load, write once**, and be idempotent — the `needsOperatorMigration` pattern BCN-003 used for
  saved filters is the precedent, and the reason is the same: opening a project must not rewrite data
  nobody touched (F46, the autosave allowlist).
- Produce **one** `active` from two, deterministically. Recommended rule: `cloudservices` wins if set,
  because the Parse-wire family is what the record nodes have always used; the surviving
  `backendServices` entries stay in `items` and are no longer active. Log it, and surface it once in the
  panel.
- Leave the **exporter** injecting the same runtime-visible shape it does today until the runtime reads
  the new one — the export path inlines `cloudservices` into `index.js` and OPS-002's build identity was
  explicitly warned not to be built out of the frozen endpoint. Changing the injected shape and the
  reader in one commit is what the trap "a project that half-migrates resolves a backend that does not
  exist" describes.
- Be tested **against a project saved by the previous build**, not against a fixture written by the
  migration's author. The NodeGX QA fixture is the obvious candidate.

---

## 6. Could not verify

Long, and precise rather than apologetic. **Nothing below was run.**

1. **The editor was never launched.** `lerna exec` resolves the package root through a `node_modules`
   that is a symlink to the primary checkout — confirmed here: `wt-bcn009/node_modules ->
   /Users/richardosborne/vscode_projects/OpenNoodl/node_modules`. An editor launched from this worktree
   compiles the primary's sources. So: no screenshot, no click, no confirmation that any of the new UI
   renders at all.
2. **The Jasmine suite was not run**, for the same reason — `npm run test:ci` goes through
   `scripts/test-editor.ts` → `lerna exec --scope noodl-editor`.
   `tests/models/BackendSecurity.test.ts` is written and wired into `tests/models/index.ts`, and it
   **typechecks** (`tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit`, clean), but it has never
   been executed by Jasmine.
3. **The assertions themselves were run, outside Electron.** A throwaway harness compiled the four model
   modules against this worktree's own copy of `@noodl/backend-contract` and ran the Jasmine spec's
   assertions, expanded per backend where the spec loops: **204/204 pass**. That verifies the model
   layer's logic and none of the rendering.
4. **`@noodl/backend-contract` resolved to the *primary* checkout during typechecking**, for the symlink
   reason above. I do not modify that package and BCN-003's in-flight work is in `translators/`, not in
   the descriptors or `backends.ts` that this task reads — but the typecheck is against their tree, not
   mine.
5. **No CSS was seen.** `SecurityDisclosure.module.scss`, `BackendSwitchDialog.module.scss` and the
   rewritten `CloudServicesEndpointSection.module.scss` are unrendered. In particular: whether the
   disclosure block reads as informational rather than as an error at 240px panel width, whether the
   two-column switch dialog wraps correctly inside `Modal`, and whether the endpoint card's `ACTIVE` badge
   collides with a long app id.
6. **`IconName.QuestionFree` and `IconName.CaretUp/CaretDown` were chosen from the enum, not from
   looking at them.** If `QuestionFree` reads as "help" rather than "here is a fact", it is one line.
7. **The add-dialog hand-off was not exercised.** "Run one on this computer" sets panel state that opens
   an inline name form; "Connect to a deployed one" / "Enter endpoint and app id" sets state the endpoint
   card reads through a `useEffect`. Both are plausible and neither was clicked.
8. **The switch dialog has never been opened.** It only triggers when a project has two external backends
   *of different types* and one is already active — a two-step setup that needs a running editor.
9. **The empty state was not seen.** `isEmpty` reads `ProjectModel.instance` synchronously during render
   to decide whether an endpoint is configured; that is the same pattern the endpoint card already used,
   but it now runs on every panel render rather than once.
10. **No export was produced**, so success criterion "a deployed app resolves its backend from the
    unified metadata" is untouched — it belongs to step 2 in any case.
11. **The `parse`/`nodegx` preset endpoint patterns are unused by any code path.** They are recorded for
    BCN-004 and are transcribed from the Parse REST API rather than probed. `schema: '/schemas'` in
    particular is the Parse schema route and has not been called through this preset.

### Gates that were run, and their results

| Gate | Command | Result |
|---|---|---|
| Editor typecheck | `tsc -p packages/noodl-editor --noEmit` | ✅ clean |
| Editor tests typecheck | `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | ✅ clean |
| Hex-colour ratchet | `node scripts/hex-color-ratchet.js` | ✅ `noodl-editor 16 / baseline 16`, holding. No new raw hex |
| Lint ratchet | `node scripts/lint-ratchet.js` | ✅ 828 errors vs a 3916 baseline |
| TSFixme ratchet | `node scripts/tsfixme-ratchet.js` | ⚠️ **RED, and not from this task.** `TSFixme +26`, `any +26` — the same pre-existing red BCN-001 §9 recorded on `cline-dev`, concentrated in `noodl-viewer-react/tests` and editor canvas tests. None of the listed grown files are this task's; the four new model files and the four new/edited view files contribute zero of either marker |
| Model assertions | throwaway harness, outside Electron | ✅ 204/204 |

---

## 7. Live-QA script, in order

To be run **from the primary checkout after merge**, not from the worktree. Editor CDP traps apply:
`--target=dashboard` (not `editor`, which attaches to the preview window), launch detached, relaunch
rather than `cdp reload`.

1. Open any project. Open **Backend Services** from the rail.
   - **Expect:** exactly one section, titled **Backends**. Not three. One `+` in its header.
   - **Expect:** if the project has nothing configured, one message — *"No backend yet"* — and no empty
     endpoint card.
2. Click **+**.
   - **Expect:** six cards in the grid: Built-in, Parse Server, Directus, Supabase, PocketBase, Custom
     REST API. Built-in is selected. Test hooks: `[data-test="preset-nodegx"]` … `preset-custom`.
   - **Expect:** under the grid, one collapsed azure line — *"Your app publishes an app id, not a
     password."* Click it; two paragraphs appear. Click again; they collapse.
   - **Expect:** no URL / admin key / public key fields while Built-in is selected. Two buttons: **Run one
     on this computer**, **Connect to a deployed one**.
3. Click **Supabase** in the grid.
   - **Expect:** the disclosure line changes to the Row Level Security one, and the form appears (Name,
     URL, Admin API Key, Public API Key).
   - **Expect:** the note under Public API Key reads *"Published with your app — every visitor can read
     this one"* — no ⚠️ glyph.
4. Click **Parse Server**.
   - **Expect:** the form disappears again; one button, **Enter endpoint and app id**.
   - Click it. **Expect:** the dialog closes and the endpoint card in the panel opens with its Endpoint /
     App ID form showing, carrying its own disclosure (`[data-test="backend-security-endpoint-form"]`).
   - Tick *"This is a deployed built-in backend"*. **Expect:** the disclosure text in the form changes
     from the Parse one to the Built-in one.
   - Cancel.
5. Click **+** → **Built-in** → **Run one on this computer**.
   - **Expect:** dialog closes; an inline *"Name this backend"* field appears at the top of the list
     (`[data-test="new-local-backend-name"]`). Name it, **Create**.
   - **Expect:** a card appears reading **Built-in • Port N** — *not* "Local SQLite".
6. Start it.
   - **Expect:** the endpoint card appears above it (WF-004 auto-fill), marked ACTIVE, reading *"Deployed
     built-in backend — supports realtime"*, with its own disclosure.
   - **Expect:** the started card's **Data** button is enabled and opens the record grid, exactly as
     before this change.
7. Add a Directus backend through **+ → Directus** with a URL and any admin token (Create will fail
   without a reachable server; use **Test Connection** only if one is running — the card is created
   regardless of connectivity if the fields are filled).
   - **Expect:** its card carries the Directus disclosure, and its `⋯` menu has **Browse records**,
     disabled, with a tooltip explaining that the editor can only open the grid for a backend it runs on
     this computer.
8. Add a **second** external backend of a different type — Supabase — and click **Set active** on it
   while Directus is active.
   - **Expect:** the **switch dialog** (`[data-test="backend-switch-comparison"]`). Two columns, "Now" and
     "After this change", each naming what is published and where access is decided.
   - **Expect:** *no* `[data-test="backend-switch-token-change"]` note here — Directus and Supabase both
     publish an access token, so nothing about token visibility changed. This is the case that proves the
     line is not boilerplate.
   - Cancel. **Expect:** the active backend is unchanged.
9. Now set the **Directus** one active while Supabase is (i.e. repeat step 8 in the other direction) — no
   note again. Then delete one and re-add a **Custom REST API** backend, and switch to it.
   - **Expect:** `[data-test="backend-switch-token-change"]` **is** present, saying the answer is yours
     because it is your own API.
10. Confirm the switch. **Expect:** the card's ACTIVE badge moves, and nothing else changes.
11. Reload the editor (relaunch — do not `cdp reload`) and reopen the panel.
    - **Expect:** the list and the active marker are as they were. The disclosure is collapsed again
      (it is not persisted, deliberately).

**What this script cannot cover, and why:** step 7's "confirm a deployed app resolves its backend from
the unified metadata" needs step 2, and the per-node picker's appear-at-two-backends rule needs step 4.
Neither was in scope.

---

## 8. Files

New:

- `packages/noodl-editor/src/editor/src/models/BackendServices/security.ts` — the disclosure
- `packages/noodl-editor/src/editor/src/models/BackendServices/securityFindings.ts` — the OPS-006 input
- `packages/noodl-editor/src/editor/src/models/BackendServices/backendList.ts` — one list, and the
  Data Browser gate
- `packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/SecurityDisclosure/` —
  `SecurityDisclosure`, `BackendSwitchDialog`, and their stylesheets
- `packages/noodl-editor/tests/models/BackendSecurity.test.ts`

Edited:

- `models/BackendServices/types.ts` — the union is the contract's
- `models/BackendServices/presets.ts` — six presets, `configuredBy`, `security`
- `models/BackendServices/index.ts`
- `views/panels/BackendServicesPanel/BackendServicesPanel.tsx` — one section, one add flow, the switch
- `views/panels/BackendServicesPanel/AddBackendDialog/AddBackendDialog.tsx` — six, and the hand-off
- `views/panels/BackendServicesPanel/BackendCard/BackendCard.tsx`
- `views/panels/BackendServicesPanel/LocalBackendCard/LocalBackendCard.tsx`
- `views/panels/BackendServicesPanel/CloudServicesEndpointSection/` — a card, not a section
- `tests/models/index.ts`
