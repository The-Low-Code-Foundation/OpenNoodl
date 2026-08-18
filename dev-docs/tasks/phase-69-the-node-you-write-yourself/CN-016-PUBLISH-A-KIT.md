# CN-016 — Publish a kit

| Field | Value |
|---|---|
| **Tier** | 6 |
| **Effort** | L |
| **Surface** | `library` |
| **Rulings** | ✅ **D5** — ship a **new, minimal** reference kit; the cashflow kit is docs material, not shipped content · ✅ **D21** (2026-08-18) — **AC1 descoped** to a built artefact **plus a divergence gate** |
| **Status** | 🔴 Never started. **Unblocked as of D21** — the last task in phase 69. |
| **Depends on** | CN-006 (the scaffold), CN-017 (the trust gate, for anything not first-party) |

## The job

A kit that works in one project should install into fifty. The channel already exists:
`library/modules/<slug>/` with a `library.json`, zipped by `library:build`, validated by
`library:check` against `scripts/library/schema.json` (**strict**, `additionalProperties: false`),
installed by copying `noodl_modules/<name>/` into the target project. Registration is
**presence-on-disk** — there is no separate install manifest.

So this task is less "build a channel" and more "make the channel carry kits properly, and be honest
about the state it is in".

## ⚠️ Do not assume the existing fleet is healthy

P65's audit is the reason this task is Tier 6 rather than Tier 2:

- **0 of 29 shipped modules have ever been run** — preview or deploy (LBR-004).
- **3 register zero nodes** (LBR-006), and `type` drives install routing, so the taxonomy is already
  known to be wrong.
- **~9 vendor large third-party libraries with no licence text**, and **mapbox-gl v2+ is
  proprietary** (LBR-007).
- The **live CDN serves 2024 content** with a deleted node type in it (LBR-001).

**This task must not build on an assumption that "modules work".** Exactly one kit has been proven
end-to-end — the cashflow kit, on 2026-08-15 — and it is not one of the 29.

### ✅ First actual measurement of the fleet — 2026-08-18 (s31)

P65's audit said *"0 of 29 have ever been run"*. They have now been run, in CN-017's
`verifyKitSource` sandbox, which reports **what each declares**:

| outcome | count | which |
|---|---|---|
| **declares nodes** | **15** | avatar, chart-js (9 nodes), custom-html, data-context, geospatial-analysis, google-analytics, google-sheets, graphql, i18next-translation, marquee, mqtt-module, parse-cloud-function, pdf-viewer, qr-scanner, web-camera |
| **threw** | 4 | lottie (`getContext`), mapbox (`.style`), markdown, simple-tooltips (`querySelector`) |
| **declares no named nodes** | 2 | confetti, qr-code |
| **never calls `defineModule`** | 1 | form-validation |
| iconsets | 7 | — |
| no `noodl_modules/` at all | 3 | — |

🔴 **Read the four `threw` results as the INSTRUMENT, not the fleet.** The sandbox has a minimal
`document` and a noop `React`; every one of those four fails on a DOM API it does not stub
(`getContext`, `querySelector`, `.style`). They are **false negatives** — the tradeoff
`verifyLibrarySource`'s own docstring states in writing. **Nothing here says those four are broken**,
and CN-016 must not act as though it does. What it does establish is a floor: **15 modules
demonstrably declare nodes**, which is 15 more than anyone had confirmed.

⚠️ **`qr-code` puts a bare `function` in `reactNodes`** rather than a definition object. That is a
real oddity worth looking at when the taxonomy is decided.

### 🔴 The taxonomy problem is worse than "give kits a type"

**Measured: 22 of the 29 shipped modules are ALREADY kit-shaped** by the predicate the editor uses
(`manifestLooksLikeKit` — a `main`, not `kind: 'external-library'`, not `type: 'iconset'`). The
remaining 7 are iconsets.

So item 2's *"decide whether kits need their own `type`"* is not a greenfield choice. Adding
`type: 'kit'` to `library.json` creates a state where **22 existing entries are labelled `module`
while being kits**, and relabelling them is a content migration across entries whose code has only
just been run for the first time. ⚠️ **Whatever is decided, say what happens to those 22** — a new
field that only new entries carry is a taxonomy that describes nothing.

## ✅ What D5 settled

The library ships a **new, deliberately minimal reference kit** (1–2 nodes), optimised to be read as
a starting point rather than to demonstrate the phase's ideas.

⚠️ **The accepted cost:** a minimal kit cannot demonstrate P2 or composition. The mitigation is
binding and lives in **CN-007** — the docs must carry the cashflow kit as the worked example. If
CN-007 is descoped, this ruling needs re-opening, because the shipped reference alone teaches less
than the phase intends.

**The cashflow kit is therefore not shipped content.** It needs no licence sweep and no
`library.json` — but it must keep working, because the docs depend on it.

## What to build

1. **The minimal reference kit** — scaffold output, brought to shippable quality: tokens (✅ D8),
   a real `docs` string per node, a README, a licence.
2. **Kit-aware `library.json`** — a kit is a module, but "module" currently spans iconsets, UMD
   wrappers and node providers. Decide whether kits need their own `type` or a discriminating field,
   and reconcile with LBR-006's finding that `type` already drives routing incorrectly.
3. **Compat gating that means something** — `minEditorVersion` and `runtimeVersion` exist in the
   schema. A kit built against React 19 semantics installed into an 18.3.1 project should be caught
   at install, not at runtime.
4. **Versioning and update** — what happens when a project has kit v1 and the library offers v2, and
   nodes from v1 are on canvas. At minimum: do not silently replace.

## Acceptance criteria

1. ✅ **AMENDED BY D21, 2026-08-18.** The reference kit installs from a **built artefact** into a
   fresh project, its node is placeable with zero console errors, **and a gate fails the moment the
   origin and `library/` diverge.**

   🔴 **The gate is the load-bearing half.** Descoping alone would close this phase and leave the
   origin rotting further, which is the state that produced the problem.

   🔴 **This does not permit installing from a local folder that happens to resolve.** That is the
   move the original criterion forbade; it would read as green and be false. "A built artefact" means
   the output of `library:build`, addressed as a build output — ⚠️ and `library:build` writes a
   **gitignored** `library-dist/`, which is its own trap: a gitignored artefact makes tests vanish,
   and an ignored build leaves an observation with no provenance.

   *Original, unmeetable inside this phase:* the kit installs from the **real origin** — the origin
   serves 2024 Noodl content, nothing publishes `library/`, and the fix is phase 65's LBR-001, which
   is not started. See [RULINGS.md D21](RULINGS.md).
2. Installing does not disturb an existing kit, and installing twice is safe.
3. Compat gating refuses an incompatible kit **with a message naming why**.
4. `library:check` passes; the schema is strict, so a new field must be added to it deliberately.
5. **Build the caller**: install the kit, place the node, deploy the project, and load the deploy.
   `noodl_modules/` ships verbatim in a deploy (absent from `build/ignore.ts`) and NDA-007 §2 proved
   it live — but that was for an asset, not a kit.

## Traps

- ⚠️ **A gitignored artefact makes tests vanish**, and **`scripts/` is not in `build.files`** — both
  bite packaging work specifically.
- ⚠️ The **shipped library is not the repaired library**: the CDN serves 2024 content. Verify against
  what users actually receive, not against `library/` in the checkout.
- ✅ **`library:verify-dist` already exists and already does most of AC1's descoped form** — it serves
  `library-dist/` over HTTP at the editor's expected path, walks `fetchModules`/`ModuleCard`'s real URL
  construction, checks `isModuleCompatible` (imported, not re-implemented), and unzips through JSZip
  as `filesystem.unzipUrl` does. 🔴 **But it is NOT in CI** — `.github/workflows/pr.yml` runs
  `library:check` and not `library:verify-dist`. The artefact harness exists and is ungated; that is
  the cheapest half of D21's divergence gate already written.
- 🔴 **A peer is holding `scripts/library/check.ts` uncommitted** (as of 2026-08-18) and phase 65 is
  being scoped by them. `library:check` is AC4's gate and the divergence gate's likely home, so
  **announce before editing it** — this is the file most likely to collide in the whole task.
- ✅ **CN-017 gives this task its trust gate for free, if the install goes through `apply()`.** An
  install route that writes to `noodl_modules/` directly is gated by nothing, and `ImportPlan.origin`
  is required, so a new route will not compile until it states what it is. See CN-017 §1.

---

# 📐 s31 progress — the reference kit exists, and the artefact path works again

**2026-08-18.** Item 1 is built and AC1's harness is repaired and gated. Items 2–4 are scoped with
measurements rather than assumptions. What follows is measured; where it corrects an inherited
premise, it says so.

## ✅ Built

**`library/modules/example-node-kit/`** — scaffold output (✅ D5's "new, deliberately minimal"), one
React node (`example-node-kit.StatTile`), every visual decision a port with design-token defaults
(✅ D8, by construction — it is the scaffold's own template), the author's `docs` sentence per node,
the kit types, a README and an MIT `LICENSE`.

| gate | result |
|---|---|
| `verifyKitSource` on the kit | ✅ `defines-nodes` — 1 node, named |
| `library:check` | ✅ **59/59 clean**, and the new entry contributes **zero** warnings (total stays 183) |
| `library:build` | ✅ `example-node-kit-1.0.0.zip` |
| `library:verify-dist` | ✅ **29 prefabs + 30 modules, 0 problems — installable-shaped** |

⚠️ **`library:verify-dist` disclaims its own limit and so must this file:** *"This is NOT LIB-001
Criterion 5 — that needs a live editor install."* AC1's artefact half is proven; the live-editor half
is not, and no editor has been launched in four sessions.

## 🔴 AC1's harness was broken, and had been since ALPHA-006 §5

`library:verify-dist` — the script that serves `library-dist/` over HTTP and walks the editor's real
install path — **failed on every entry**, reporting `0 entries` for both tabs:

```
INDEX  prefabs: fetchModules rejected: Cannot convert object to primitive value
```

**Cause:** ALPHA-006 §5 split `getContentEndpoint` out of `getDocsEndpoint` (`307967a5`) and
`fetchModules` moved to the new one. `verify-dist`'s esbuild stub list still named only the old one,
so the real `getContentEndpoint` fell through to the catch-all noop `Proxy`, and
`` `${endpoint}/library/…` `` threw on the template literal.

🔴 **Confirmed pre-existing, not caused by CN-017**: re-run against `modulelibrarymodel.ts` at
`ce96338c~1` and it fails identically.

✅ **Fixed** (one line in the stub list, and a header explaining why both names are stubbed), and
✅ **added to CI** in `.github/workflows/pr.yml` alongside `library:check`.

**This is the argument for D21's divergence gate, demonstrated on the gate's own harness.** A script
outside CI rotted silently for however long, and the first thing the new CI step does is keep it
honest about itself.

## 🔴 The inherited "the origin serves 2024 content" premise, re-measured

The claim CN-016 and README §2 inherited was measured **s28**, three sessions ago and **before the
origin was repointed to `nodegx-content` on 2026-08-13** (`getContentEndpoint.ts`, ALPHA-006 B5).
Re-measured today against what `getContentEndpoint()` actually returns:

| | origin | `library/` | shared | in `library/`, unpublished |
|---|---|---|---|---|
| **prefabs** | 29 | 29 | **29** | **none** |
| **modules** | 26 | 30 | **26** | **4** — Confetti, Lucide Icons, QR Code, Example Node Kit |

Both indexes are **HTTP 200 and well-formed**. So the sharper statement is:

- 🔴 **"Nothing publishes `library/`" still stands** — the published zips carry *legacy pre-LIB-001
  filenames* (`chartjs-module-1-4`, `gsheets-1`, `modal-0`, `pagesandrows-0`) that no `library/`
  entry would produce. The content is the old fleet under old names.
- ✅ **But the origin is neither dead nor wholly stale.** Label coverage matches for every prefab and
  for 26 of 30 modules; the divergence is exactly the four entries authored in this repo since the
  last publish.
- ⚠️ **This was compared on `label` only.** Slug and filename comparison is meaningless across the
  naming schemes, and **content equality is unproven** — a zip could carry anything under a matching
  label. Any gate that claims more than label coverage must hash the payloads.

**What that means for the gate:** it can assert *coverage* today (every `library/` entry has a
published counterpart, by label) and cannot assert *content* until a publish from `library/` has
happened once. Saying which of the two it checks is the difference between a real gate and a green
tick.

## 🔴 Two divergences between the schema and its consumers

1. **`icon` is optional in `scripts/library/schema.json` and mandatory in practice.**
   `verify-dist` refuses an entry without one: *"missing/empty `icon` — ModuleCard destructures it
   unguarded."* An entry that passes `library:check` therefore breaks the card. **Either the schema
   should require it or the card should guard it; today neither is true.**
2. **22 of 29 shipped modules are already kit-shaped** (see the audit section above), so item 2's
   `type` decision is a migration question, not a greenfield one.

## What is left

| item | state |
|---|---|
| 1. The minimal reference kit | ✅ **done** |
| AC1 — installs from a built artefact | ✅ **done**; ⚠️ live-editor half not driven |
| AC1 — divergence gate | ◐ **half done** — `verify-dist` is repaired and in CI; the origin-vs-`library/` comparison itself is designed above but not written |
| 2. Kit-aware `library.json` | ◐ measured, not decided — 22 entries would need relabelling |
| 3. Compat gating that means something | ⬜ not started. ⚠️ **Ask what being wrong costs before making it block** — CN-017 §9b is the cautionary case |
| 4. Versioning and update | ⬜ not started |
| AC2 — install twice, don't disturb | ⬜ not started |
| AC5 — build the caller (install → place → deploy → load) | ⬜ not started |

