# SB-017 — the deploy drops half the cloud graph, and every endpoint times out

**Status: ⬜ MEASURED s15, NOT FIXED. Needs a ruling on where the fix goes.**

Found by the drive nobody had run: making a project from `embedded://site-builder` in the
real editor, opening it, provisioning a backend through the real UI, and calling the
endpoints.

## 1. The claim

**Every cloud function in the shipped Site Builder template times out when it is deployed
through the editor.** Not "is slow", not "refuses" — answers nothing, for 30 seconds, and
then the backend gives up.

- `claimSite`, called from the template's own Setup page with a real signup and the real
  generated setup token: execution record `status = error`, duration **30005 ms**,
  `Cloud function "claimSite" did not send a response within 30000ms`.
- `submitContactForm`, whose policy is `public`, called with curl and no credential at all:
  **HTTP 504 in 30.017 s**, same message.

Two of the two endpoints reachable without an admin session. They fail identically, and
`claimSite` is the one that mints the admin, so nothing downstream of it is reachable either.

## 2. The mechanism, measured rather than inferred

**The editor's deploy silently drops every connection whose port the target node does not
declare.** Counted over the deployed bundle
(`~/.noodl/backends/<id>/workflows/<project>.workflow.json`) against the project on disk:

| component | on disk | deployed | dropped |
|---|---|---|---|
| `publishPage` | 16 | 5 | **11** |
| `duplicatePage` | 22 | 8 | **14** |
| `submitContactForm` | 19 | 9 | **10** |
| `claimSite` | 20 | 14 | **6** |
| `site/CopySectionToPage` | 9 | 4 | **5** |
| `site/ContactRecipient` | 9 | 5 | **4** |
| `site/SetSectionAccess` | 5 | 4 | **1** |
| **total (cloud)** | **100** | **49** | **51** |

**51 of 100.** Half the cloud graph does not reach the backend.

`claimSite`'s `JavaScriptFunction` is the clearest case. On disk it is wired
`in-expected`, `in-supplied`, `in-unclaimed`, `in-rows`, `run` in and
`out-ok`, `out-claimed`, `out-denied` out. In the deployed bundle the node declares only
`out-ok` and `out-denied`, and the only surviving wires are `run` in and those two out —
**all four `in-*` connections and `out-claimed` are gone.**

So the script's first line, `if (Inputs.rows === undefined) return;`, returns every time.
Nothing is published, no `Response` node is ever reached, and the request hangs until the
30-second cap. The backend's own timeout message even names the shape —
*"Check that every path through the graph reaches a Response node"* — and it is right about
the symptom and misleading about the cause: every path **does** reach one in the authored
graph. The paths were deleted on the way.

State left behind by the timed-out `claimSite`: `_User` 1 (the signup worked),
**`_Role` 0**, **`_Join_users__Role` 0**, and `Page` / `SiteSettings` / `Theme` present as
tables with **0 rows**. `execution_steps` is **empty for a 30-second execution** — the graph
never advanced past its first node, so it did not run the gate and deny. It never ran.

## 3. This is SB-010, and SB-010 understated it

[SB-010](SB-010-THE-SCRIPT-PORTS-THE-DOOR-DOES-NOT-WRITE.md) recorded that the MCP door does
not derive a `JavaScriptFunction`'s script ports, and filed the consequence as *dead custom
signal outputs once deployed*. The consequence is larger: the **inputs** go too, and a node
that receives no inputs does not misbehave subtly — it never runs, and the endpoint hangs.

SB-004 F10 fixed the signal-output half by hand, by declaring `out-ok`/`out-denied` as ports
on the node. That is exactly the two ports that survive. **The fix was applied to the half
that had been noticed.**

## 4. 🔴 Why every existing test passes

`nodegx-backend/tests/sb004-publication-invariant.test.ts` deploys these same component sets
and its 29 specs are green. It builds its runtime bundle with a **test helper**,
`nodegx-backend/tests/helpers/authored-bundle.ts` — **not the editor's deploy path**.

So the suite measures a bundle the product never builds. Same graphs, two deploy paths,
opposite outcomes, and the path nobody had run is the one a person gets.

This is the phase's own recurring shape, and the second instance of it in this task file:
SB-015 §6.5 found that `SITE_SECURITY` was a typed constant in a test helper, so SB-008 had
measured a publication boundary produced by a file no project would ever receive. That was
fixed by making the helper import the shipped artefact. **The same question was never asked
of the bundle**, which is the larger half.

⚠️ **The lesson is not "the helper is wrong".** The helper exists because the editor's
converter needs a live `NodeLibrary` (SB-004 §7). The lesson is that a helper standing in for
a product path owes a test that the two agree — and there is no such test.

## 5. The editor says so on open, and nobody had looked

Opening the project raises **84 `port doesn't exist` warnings** (`WarningsModel` holds 85; the
badge shows 84 and the extra is a script warning on `/Pages/Site`). Census by port prefix,
taken from the editor's own connection refs:

| ports | count | what they are |
|---|---|---|
| `in-` target 22 + `out-` source 22 | **44** | `JavaScriptFunction` script ports — this defect |
| `prop-` | 32 | Record / `NewDbModelProperties` property ports |
| `qp-`, `acl-` | 4 | query-parameter and access-control ports |
| plain | 4 | see [SB-018] below |

🔴 **Re-measured with a real backend created, bound, started and holding the schema: the same
84.** The obvious reading — *no backend, so no schema, so no dynamic ports* — is refuted by a
control that varied exactly one thing.

**The warnings are a preview of what the deploy will delete**, and that connection had never
been drawn because nothing had ever opened this template in an editor.

⚠️ Bounded honestly: saving does **not** prune them. 255 connections in the shipped artefact,
255 on disk after install, 255 after the editor's own save. The project file is faithful; only
the deployed bundle is lossy.

## 6. What is NOT yet known

- **Whether the browser half is affected.** 40 of the 84 warnings are on browser components,
  and the browser runtime is not this deploy path. SB-008 drove the public site successfully,
  so at least the parts it exercised survive — but nothing has clicked the admin panel.
- **Whether the drop is in the converter or upstream of it.** The bundle is the first place it
  was observed; the node's `ports` array is already short on disk, so the converter may simply
  be honest about a node that was written incomplete. **That distinction decides the fix** and
  is one file's reading away.
- Whether a fix belongs in the authoring door (derive and write the ports), in the deploy
  converter (derive at deploy), or in both.

## 7. Acceptance for whoever takes this

1. A test that the editor's deploy path and `authored-bundle.ts` produce the same connection
   count for the same components — the assertion whose absence let this ship.
2. `claimSite` answers a real request, and the site can be claimed from the template's own
   Setup page.
3. `submitContactForm` answers.
4. The 44 script-port warnings are gone on a freshly installed project, or their absence from
   the deployed bundle is shown to be harmless with something better than an argument.
5. A known-firing control: a graph whose ports really are wrong still fails.
