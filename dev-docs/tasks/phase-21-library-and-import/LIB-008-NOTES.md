# LIB-008 — what was measured and what was built

**2026-09-11/12. All four acceptance criteria met.** The repoint was the smaller half.

## 1. The finding the task did not have

LIB-008 read the defect as one dead origin plus one missing suffix. Both are real and both are
fixed. But the task's §4 put the path derivation out of scope on the grounds that "`nodeDocs`
deriving the path is the design, not a workaround" — and the derivation was addressing the wrong
site.

`nodeDocsPath()` took the **pathname off the catalog's legacy `docs` URL**
(`https://docs.noodl.net/nodes/logic/and` → `/nodes/logic/and`). Measured against the live docs
site on 2026-09-11:

```
30 of the 159 catalog `docs` URLs resolve.   129 are a 404.
```

The two sites' trees disagree **by design**. `scripts/generate-node-docs.js` names one page per
node `nodes/<slug(category)>/<slug(typeName)>`, grouped by the **picker's own category** rather
than the old site's hand-made hierarchy, because the two contradicted each other — its header
says so. `/nodes/logic/inverter` happens to agree. `/nodes/data/user/log-in` against
`/nodes/cloud-services/net-noodl-user-log-in` does not.

🔴 **So a correct repoint, with the correct suffix, would still have 404'd for 81% of nodes** —
and AC1/AC2 would have passed, because `And` and `Inverter` are in the 30 that agree. The task
warned that dropping the rename in without the suffix "turns a 404 site into a 404 path and looks
fixed". This is the same trap one layer further down.

The catalog's 159 URLs were **not** rewritten — that stays out of scope, and criterion 6's
instinct about the field being a stable key rather than an address is still right. What changed is
what the key is rewritten *into*: the node's own category and type name, which is how the pages are
actually named. That addresses **176 of 176** nodes, including the 17 carrying no `docs` URL at
all, which had a generated page but rendered no link.

## 2. What changed

| file | change |
|---|---|
| `getDocsEndpoint.ts` | → `https://the-low-code-foundation.github.io/NodeGX/docs`, with why the suffix is load-bearing |
| `nodeDocs.ts` | `nodeDocsPath()` derives from category + type name; `slugify` kept in step with the generator |
| `McpSettingsSection.tsx` | `MCP_DOCS_PATH` loses its own `docs/` prefix — the endpoint carries it now |
| `NodeLabel.tsx`, `externalLinks.ts` | comments that described the old derivation |
| `scripts/docs/verify-origin.ts` | new — `npm run docs:verify-origin` |
| `tests-unit/alpha-006/nodeDocs.test.ts` | the offline half of the gate |
| `.github/workflows/pr.yml` | `docs-origin` job |

⚠️ **The MCP link is the one that would have gone unnoticed.** Its page renders *only when a HEAD
probe answers*, so a doubled `/docs/docs/` would 404 exactly as it does today — and when MCP-004
finally publishes the page, the link would have stayed silently off forever. A self-healing surface
hides its own wrong path.

## 3. AC1 + AC2 — driven, not asserted

Editor launched (`dev:debug`), a **copy** of a real project opened through the editor's own
`openProjectRequested` seam, `platform.openExternal` hooked to capture rather than derive, then
real trusted clicks. Every URL below is what the editor handed the OS.

| surface | node | captured URL | |
|---|---|---|---|
| property panel | Page Router | `…/NodeGX/docs/nodes/visual/router` | **200**, serves *Page Router \| NodeGX* |
| node picker | Group | `…/NodeGX/docs/nodes/visual/group` | **200**, serves *Group \| NodeGX* |
| node picker | String Mapper | `…/NodeGX/docs/nodes/utilities/string-mapper` | **200**, serves *String Mapper \| NodeGX* |

🔴 **The control that makes this mean something.** `Router`'s legacy `docs` URL is
`https://docs.noodl.net/nodes/navigation/page-router`, so for that exact click:

```
0.2.3 shipped:        …/opennoodl-docs/nodes/navigation/page-router        404
origin fixed only:    …/NodeGX/docs/nodes/navigation/page-router           404
origin + derivation:  …/NodeGX/docs/nodes/visual/router                    200
```

The middle line is what a task-faithful fix would have produced. Picking `And` for the drive would
have shown 200 on all three and proved nothing.

The body is read, not just the link: the picker's preview pane rendered String Mapper's prose
("Looks a string up in a configured key list…") from the bundled catalog, and each URL above serves
that node's own page.

## 4. AC3 + AC4 — the gate, and it is armed

`npm run docs:verify-origin` calls **both** editor endpoint functions (imported, not copied) and
resolves the docs probes through `nodeDocsPath()` itself. Three distinguishable verdicts, because
"unreachable" and "wrong path" ask for different fixes:

| arm (endpoint temporarily repointed) | verdict | exit |
|---|---|---|
| `…/opennoodl-docs` — the 0.2.3 defect | **ORIGIN GONE** | 1 |
| `…/NodeGX` — suffix dropped, the naive repoint | **PATH MOVED** | 1 |
| `127.0.0.1:1` — no answer | **ORIGIN UNAVAILABLE** | 2 |
| `…/NodeGX/docs` — HEAD | ok | 0 |

AC4's half was armed the same way rather than assumed: repointing **`getContentEndpoint`** to the
dead name gives ORIGIN GONE and dropping its `/static` gives PATH MOVED (4 pages). A sweep where
only one arm can move grades one endpoint.

⚠️ **Liveness is per-origin, and neither site serves the obvious thing.** Docusaurus publishes no
document at its own `routeBasePath` (`…/NodeGX/docs/` is a 404 on a healthy site) and the content
origin has no `index.html` at all (`…/nodegx-content/` is 404 while every payload under `/static`
is 200). Probing "the root" would have called both dead. Each origin declares its build-shaped
suffix; stripping it gives the site root, and **that** is what separates a gone origin from a moved
suffix. The content origin's probe is its `README.md`, served above `/static` by the legacy Pages
build — if that README is ever deleted this goes red as a false ORIGIN GONE, which is loud, sits
beside four green payload probes, and is a one-line fix.

The script self-tests its own failure paths on every run and exits 2 if they are broken, including
a negative control that an *optional* 404 must not move the verdict.

**The offline half** is `tests-unit/alpha-006/nodeDocs.test.ts`: every catalog node's path must
name a page `generate-node-docs.js` actually wrote under `docs-site/docs/`. It needs no network,
runs on every PR via `test:main`, and catches a rename inside `docs-site/` before it deploys. It is
graded against the **artefact**, not against a second copy of the generator's slugify — two copies
compared with each other agree by construction. Armed: mutating `slugify` reddens it with 129 named
nodes.

## 5. Two findings registered, not fixed

- ⚠️ **`<content>/whats-new/feed.json` is a 404** (measured 2026-09-11) while the other four
  payloads are 200. `whats-new.ts` documents the feed as decoration — "not having one is a normal
  state, not a failure" — so the sweep reports it and does not gate on it. If a what's-new feed is
  meant to exist, nothing is publishing one.
- ⚠️ **`scripts/library/seed-from-live.js:30` still names `opennoodl-docs`.** A one-off historical
  import script (`IMPORTED_AT = '2026-07-25'`), not a shipped surface, and its endpoint is the
  content CDN rather than docs. Left alone deliberately: repointing a frozen seeding script is a
  guess about what a future re-run would want.

## 6. Gates run

- `tests-unit`: **432 of 433 suites green, 7195 of 7196 tests.** The single red is
  `tpl-003/landing-template.test.ts` (component count 21 vs 28) — phase-78 template work, red at
  HEAD, and neither the test nor its subject is in this diff.
- `tsc --noEmit -p packages/noodl-editor` — clean.
- `docs:verify-origin` — exit 0.
- ⚠️ `tsc --noEmit -p scripts/tsconfig.json` OOMs — **and does so at HEAD with this task's script
  removed**, so it is not a regression. That config is only ever used as a `ts-node -P` transpile
  config; nothing runs it as a whole-project typecheck.
