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
