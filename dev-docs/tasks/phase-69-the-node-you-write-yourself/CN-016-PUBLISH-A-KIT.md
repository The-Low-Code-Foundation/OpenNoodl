# CN-016 — Publish a kit

| Field | Value |
|---|---|
| **Tier** | 6 |
| **Effort** | L |
| **Surface** | `library` |
| **Rulings** | ✅ **D5** — ship a **new, minimal** reference kit; the cashflow kit is docs material, not shipped content |
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

1. The reference kit installs from the **real origin** into a fresh project, and its node is placeable
   with zero console errors. (LBR-001's standard: *"install from the real origin"* — not from a local
   folder that happens to resolve.)
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
