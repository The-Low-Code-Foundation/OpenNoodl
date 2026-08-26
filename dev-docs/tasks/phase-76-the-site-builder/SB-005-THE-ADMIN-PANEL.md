# SB-005 — The admin panel

**Status: ⬜ SCOPED s5 (2026-08-26), not built.** The design below is grounded in what was read from
the working tree today (§1); everything not in §1 is marked as an assumption. Nothing here has been
authored yet.

Depends on SB-004 (✅ s4 — the classes, the ACL invariant and the four cloud functions all exist and
are driven). Feeds SB-006 (the public site) and SB-008 (the drive). The doctrine an author must read
first is `BACKEND_DOCTRINE_MD` §"Four things a deployed graph does not do the way the canvas does" —
but **three of those four rules do not apply on this side of the boundary**, and §2 says which, because
over-applying them is its own defect.

🔴 **The single claim this task owes, from SB-004 §7's closing warning:** *"a panel that forgets the
ACL produces a world-readable draft and every spec in §7 still passes."* §7 wrote its rows through the
REST API as the owner because this panel did not exist. Acceptance 2 is therefore **not yet held on
the path that will ship** — it is held on a stand-in. SB-005 is what moves it onto the real path, and
until it does, no spec anywhere in this phase can tell a panel that sets the ACL from one that does not.

## 1. What this is grounded in (measured s5, not assumed)

Each read from the working tree today, through a real MCP server built from `src` (the dist on this
machine is stale). Probes were throwaway; the measurements are restated here because the probe is gone.

- **The browser vocabulary is 127 node types** (`list_node_types`, `availableIn ∋ 'browser'`; 142 rows
  total, 15 cloud-only). Everything this panel needs exists and none of it is new ground:
  - auth — `net.noodl.user.SignUp`, `net.noodl.user.LogIn`, `net.noodl.user.LogOut`,
    `net.noodl.user.User`
  - calling the backend — `CloudFunction2`
  - records — `DbCollection2` (Query Records), `NewDbModelProperties` (Create Record),
    `SetDbModelProperties` (Update Record), `DeleteDbModelProperties`
  - files — `Open File Picker` + `Upload File`
  - live preview — `SubscribeToChanges`
  - UI — `Page`, `Router`, `Group`, `Text`, `Image`, `For Each`, `net.noodl.controls.textinput`,
    `net.noodl.controls.button`, `net.noodl.controls.checkbox`, `net.noodl.controls.options`
- 🔴 **`CloudFunction2`'s parameters are dynamic ports, and BOTH a wire and a parameter register
  them.** `in-<name>` / `out-<name>` are minted on demand by `registerInputIfNeeded`
  (`cloudfunction2.ts:210-223`, `:194-202`), and `NodeScope` calls that hook on the connection path
  (`nodescope.ts:149`) **and on the parameter path** (`nodescope.ts:203`) before queueing the value.
  So `publishPage`'s `publish` can be a constant `in-publish: true` on the Publish button and
  `in-publish: false` on Unpublish, with no wire and no declared port.
  ⚠️ **This is why rule 1 of the doctrine must not be over-applied here.** F10 was specifically about
  `JavaScriptFunction`, whose ports are derived by *parsing the script* in a `setup()` that returns
  early without an editor connection. `CloudFunction2` derives nothing and needs nothing derived — the
  name pattern *is* the registration. Two different mechanisms that look alike from the outside.
- **The ACL ports on `Create Record` are the same dynamic-port family**: each entry in
  `accessControl` spawns `acl-<ruleId>-target`, then `acl-<ruleId>-role` (or `-userid`), plus
  `acl-<ruleId>-read` and `acl-<ruleId>-write` (`get_node_type` `runtimeBehavior`). `-target` is
  edit-only (SB-004 §1), so the panel writes the admin rule as parameters. **This is the mechanism
  acceptance 2 rides on**, and it is authorable — there is no blocker here, only the risk of omission.
- ⚠️ **`Page` is invisible to every catalog listing an author would use.** It is excluded from
  `list_node_types` in plain form, under `visual_only: true`, and even under `query: 'page'` (7 rows,
  none of them `Page`). It appears only under `include_hidden: true` — a flag whose own description is
  *"Include deprecated and picker-hidden types"* — among 33 excluded types **31 of which are genuinely
  deprecated** (`Button`, `Checkbox`, `Label`, `Text Input`, `DbModel`, `Model`, `REST2`, `Variable`…).
  `Page` is one of only three that are `inNodePicker === false` rather than deprecated;
  `catalog.ts:267` collapses the two flags into one exclusion.
  ✅ **But the consequence is small, and the honest reading is the opposite of the alarming one.** A
  two-arm probe: a `Group`-rooted page component is **refused by the write door** —
  `WARN [page-without-page-node] … "will be registered as a page, but it has no Page node — so the
  router has nothing to show and the app renders a blank screen"`, blocking, with a *did you mean*.
  A `Page`-rooted one is accepted and auto-registers in the router. So the cost of the catalog gap is
  **one wasted round-trip**, not a shipped blank page. Recorded here rather than filed as a task:
  it is a discoverability wart on a door that fails closed and names its own fix.

## 2. The four doctrine rules, and which of them cross the boundary

Written out because a panel author will read `BACKEND_DOCTRINE_MD` and it is about the *cloud* runtime.

| rule | applies in the browser? |
|---|---|
| 1 — declare a code node's custom signal outputs | **Only for `JavaScriptFunction`.** Same node type, same `setup()`, same absent editor connection in a *deployed* app — so a panel that uses a code node with `Outputs.ok()` needs the port. `CloudFunction2` is NOT this case (§1). |
| 2 — a signal is not a promise that the values arrived | **Yes, unchanged.** It is `Node.update`'s queue drain (`node.ts:609`), which is runtime-wide, not cloud-specific. A Save button wired from two producers has F11 exactly. |
| 3 — a query fetches once, unfiltered, at graph-build | **Yes, and it is worse here**, because the panel is the one surface that legitimately queries *unfiltered* (list all pages) next to ones that must not (sections of the page being edited). SB-004's correction applies verbatim: the `runOnChange-*: false` shape is right **only** on a query that has a filter parameter. |
| 4 — `points to` widens instead of failing | **Assumed no** — the stated cause is the schema cache never being populated *in the cloud runtime*, and the browser has an editor/loaded schema. **Not measured.** SB-004 §2 moved `Section.pageId` to a String anyway, so this panel never needs to filter on a Pointer and the question can stay open. Do not record it as answered. |

## 3. Surfaces

Five, in build order. Each names the one thing that makes it more than a form.

1. **First-run / claim** (`Pages/Setup`) — owns `claimSite`'s front (SB-004 F7). Takes the setup
   token, signs the owner up through the ordinary public signup (`net.noodl.user.SignUp` — the
   function never touches a password), then calls `claimSite` with the token. 🔴 **Every failure
   answers identically by design** (F7): the panel must not decorate the refusal with a reason it
   invents, or it re-opens the *"is this site claimed yet?"* oracle the backend closed.
2. **Page list** (`Pages/Admin`) — the unfiltered query. Draft and published together, told apart by
   `published`, which is the mirror SB-004 §3 keeps for exactly this reader. Publish/unpublish call
   `publishPage`; duplicate calls `duplicatePage`. 🔴 **The panel must never write `published`
   itself** — a `Set Record Properties` on that boolean moves the mirror and leaves the enforced ACL
   behind. This is the invariant's one authoring rule and it is worth an assertion.
3. **Page editor** — title/slug/nav fields on the `Page` row, and the section list for that page
   (the *filtered* query, rule 3's shape). 🔴 **Create Record for `Page` and `Section` carries the
   `role:admin` rule from creation** (SB-004 §3): an absent ACL means public, so a draft born without
   it is world-readable from the instant `Page.find` goes public. This is acceptance 2's real path.
4. **Theme editor** — the `Theme` singleton's `tokens` Object. Assumed simplest useful form: a small
   fixed set of named tokens rather than a free JSON editor, so the public site can rely on the keys.
5. **Image upload + live preview** — `Open File Picker` → `Upload File` → the resulting `cloudfile`
   onto a section's `data`; `SubscribeToChanges` for preview. ✅ Delivery is gated by the same
   row-level predicate as queries (SB-004 §3), so the preview cannot leak a draft to a visitor.

⚠️ **The contact section is SB-006's, and F8 blocks it, and F8 is Richard's.** `SiteSettings` is
world-readable (`find`/`get: public`, because the public site reads `siteName`), so
`contactRecipient` cannot live in that row; the fix is to take the address from the `Secret` alone,
which changes SB-004 §2's field list. Nothing in SB-005 needs it — the panel does not display the
recipient — so this task is **not blocked**, but do not add a recipient field to the settings form.

## 4. What can and cannot be measured without a browser

Stated up front so this task does not repeat the phase's recurring mistake.

- ✅ **Authorable and assertable now**: every graph lands, the ACL parameters are present on the
  `Create Record` nodes, no `Set Record Properties` anywhere targets `Page.published`, the filtered
  queries carry rule 3's shape and the unfiltered one does not.
- 🔴 **Not evidence of behaviour.** SB-004 s2 and s3 both produced green authoring runs over graphs
  that published the wrong rows and could not answer a request. A structural assertion that the ACL
  parameters *exist* does not say the row written at run time *carries* them.
- **The behavioural claim belongs to SB-008's drive**, which is already scoped as the browser half and
  must run against a backend with `devOpen: false`. When it runs, the thing to check is not that the
  panel works but that **a draft created through it 404s for an anonymous caller** — the same reading
  §7 takes, on the path that ships.

## 5. Acceptance (draft — build order §3)

1. All five surfaces authored through the MCP door, each landing as a browser component with a `Page`
   root where it is a page, registered in the router.
2. `Create Record` for `Page` and for `Section` carries the `role:admin` rule **as parameters**, and
   a mutant that drops it reddens.
3. No node anywhere in the panel writes `Page.published`; publish goes through `CloudFunction2` →
   `publishPage`. Graded by a mutant that adds the direct write.
4. The sections-of-a-page query carries rule 3's shape (`runOnChange-*: false`, `Do` unwired) and the
   page-list query **does not** — asserted as a pair, because applying the fix to the unfiltered one
   is what broke `claimSite` in s4.
5. The claim screen's refusal path is single-messaged (F7's oracle stays closed).
6. ⬜ **Deferred to SB-008**: a draft created through the panel is unreadable to an anonymous caller
   over HTTP with enforcement on. Recorded here so it cannot be quietly counted as met by §5.2.

## 6. Session log

- **s5 (2026-08-26)** — scoped. §1 measured against a live MCP server from `src`. Two hypotheses were
  formed and both were **wrong in the safe direction**, which is the reason §1 and §2 are written the
  way they are: (a) `Page`'s absence from the catalog looked like a shipped blank-page defect and the
  write door turns out to block it by name; (b) `CloudFunction2`'s dynamic parameters looked like the
  browser twin of F10 and `nodescope.ts:203` turns out to register them on the parameter path too.
  Neither was filed. Nothing authored yet.
