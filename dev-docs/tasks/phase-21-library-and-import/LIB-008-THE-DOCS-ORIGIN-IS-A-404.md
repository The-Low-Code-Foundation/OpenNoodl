# LIB-008 — Every documentation link in the shipped editor is a 404

> ✅ **CLOSED 2026-09-12. AC1–AC4 all met — see [LIB-008-NOTES.md](LIB-008-NOTES.md).**
>
> 🔴 **§4's scope line was wrong, and the notes say why.** "Rewriting the 159 catalog URLs" stayed
> out, correctly. But the **derivation** was addressing the old site's tree: measured live, only
> **30 of 159** legacy paths resolve. A repoint with the right suffix would still have 404'd for
> 129 nodes while AC1/AC2 passed on the 30 that happen to agree — the same shape as the trap §3
> names, one layer down. `nodeDocsPath()` now derives from the node's category and type name, the
> way `generate-node-docs.js` names the pages: **176 of 176**.

**Found while measuring LIB-007, and it is the same defect one door along.** `getContentEndpoint`
was repointed after the content repo was renamed. `getDocsEndpoint` was not. It still names a
GitHub Pages site that no longer exists, and it shipped that way in **0.2.3**.

## 1. The person sentence

**A person clicks "docs" on a node and reads the documentation for that node.**

## 2. What was measured — 2026-09-11

```
https://the-low-code-foundation.github.io/opennoodl-docs/            HTTP 404   ← what we ship
https://the-low-code-foundation.github.io/NodeGX/                    HTTP 200   ← where the docs are
https://the-low-code-foundation.github.io/NodeGX/docs/nodes/logic/and HTTP 200
https://the-low-code-foundation.github.io/NodeGX/nodes/logic/and      HTTP 404
```

`getDocsEndpoint.ts` returns the first line. The repo was renamed `opennoodl-docs` →
`nodegx-content` on **2026-08-07**; **GitHub Pages does not follow a repo-rename redirect** the way
git and the API do, so this is a hard 404 rather than something a fetch survives. That cause is
already written down in `getContentEndpoint.ts` — the note there explains why *that* function was
fixed, and the sibling was left behind.

Meanwhile the documentation itself moved somewhere else entirely: `deploy-docs.yml` publishes
`docs-site/` to **this** repository's Pages, which is the `…/NodeGX/` line above and is healthy.

### Who is broken

| caller | what the person sees |
|---|---|
| `nodeDocs.ts` | the docs body fetched for a node — empty |
| `NodeLabel.tsx` | the docs link on the property panel |
| `NodePicker.hooks.ts` | docs from the node picker |
| `McpSettingsSection.tsx` | the MCP settings help link |

**159 node catalog entries carry a doc URL**, so this is not an edge.

## 3. The fix, and why the suffix is the whole job

`nodeDocs.ts` takes the **pathname** off the catalog's legacy URL and joins it to the endpoint —
`https://docs.noodl.net/nodes/logic/and` becomes `/nodes/logic/and`, deliberately, so the legacy
host never appears in this file as a literal.

The live site serves node pages under `/docs/`. So the endpoint needs the suffix:

```
https://the-low-code-foundation.github.io/NodeGX/docs
```

🔴 **This is the same shape as `getContentEndpoint`'s `/static`**, for the same reason — where a
payload sits depends on how that site is built — and it is the part a naive repoint gets wrong.
Dropping the rename in without the suffix turns a 404 site into a 404 path and looks fixed.

## 4. Scope

**In:** `getDocsEndpoint.ts`, the comment that says why the suffix exists, and a check that fails
when the origin stops serving a known page.

**Out:** rewriting the 159 catalog URLs (`nodeDocs` deriving the path is the design, not a
workaround); the local-docs branch; anything in LIB-007.

## 5. Acceptance criteria

**AC1 — A node's docs load in a running editor.** Driven, not asserted from source: open the
property panel on a node with docs and read the body. 🔴 Source text saying the right URL proves
nothing here — the old value was also "correct" until a repo was renamed.

**AC2 — The fetched URL is measured, not derived.** Capture the request the editor actually makes
and assert the response is 200, for at least one node in the picker and one in the property panel.

**AC3 — A dead origin fails a gate.** A check resolves a known page through `getDocsEndpoint()` and
goes red on a non-200, so the next rename is caught by CI instead of by a user. Prove it by
pointing the check at a dead host and watching it fail — ⚠️ and make it distinguish *unreachable*
from *wrong path*, the way `verify-origin` already distinguishes `UNAVAILABLE` from divergence.

**AC4 — Both endpoints are checked by the same sweep.** `getContentEndpoint` is healthy today and
was equally healthy right up until a rename. One of these was fixed and the other was not; a sweep
that only covers the one that broke has learned nothing.

## 6. Traps

- 🔴 **Two functions, two origins, and they have already diverged once.** They were split on
  2026-08-13 precisely so they could move independently. Do not "simplify" them back together.
- 🔴 **Pages does not redirect after a rename.** git does, the API does, Pages does not. That
  asymmetry is what made this invisible: every other reference to the old name kept working.
- ⚠️ **The suffix depends on the other repo's build type.** `/static` on the content endpoint
  exists because `nodegx-content` runs a *legacy* Pages build; `/docs` here exists because
  Docusaurus serves `docs/` under the site root. Either can move if either site's build changes.
  Whatever gate AC3 adds is the thing that will tell you.
- ⚠️ **`docs.nodegx.io` does not resolve** (measured: no response). If a custom domain is the real
  destination, that is a different task and this one should not guess at it.
