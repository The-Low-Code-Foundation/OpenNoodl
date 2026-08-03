# POL-001 — The settings panel crashes on open

**Severity:** alpha-blocking. This is the only route to the theme switch and the AI provider key
(see the comment at `router.setup.ts:376`). A user who cannot open it cannot configure the product.

## What was reported

Clicking the gear at the bottom of the rail throws the "aw snap" error boundary:

```
TypeError: Cannot read properties of undefined (reading 'sitemap.enabled')
    at SitemapSection (…/SettingsPanel/sections/SitemapSection.tsx:17:171)
    at ProjectSettingsTab (…/SettingsPanel/ProjectSettingsTab.tsx:70:92)
```

## The mechanism — confirmed

`ProjectModel`'s constructor, [projectmodel.ts:147-150](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L147-L150):

```ts
this.settings = {};
if (args) {
  this.name = args.name;
  this.settings = args.settings;   // ← unconditional. undefined wins.
  …
```

The `= {}` on the line above is dead the moment `args` is present. A project whose `project.json`
carries no `settings` key loads with `settings === undefined`.

The model already knows this. `setSetting` carries a comment saying so and heals it on write
([projectmodel.ts:596-600](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L596-L600)),
and `getSettings()` exists at line 587 to return `{}` for exactly this case:

```ts
getSettings(): ProjectSettings {
  return this.settings ? this.settings : {};
}
```

**Four read sites bypass it and index the field directly:**

| File | Line | Read |
|---|---|---|
| `SettingsPanel/sections/SitemapSection.tsx` | 10 | `ProjectModel.instance.settings['sitemap.enabled']` |
| `SettingsPanel/sections/DeploySection.tsx` | 14 | `…settings['deployEnvDate']` |
| `SettingsPanel/sections/DeploySection.tsx` | 15 | `…settings['deployEnvGitStats']` |
| `SettingsPanel/sections/DeploySection.tsx` | 16 | `…settings['baseUrl']` |
| `utils/compilation/passes/sitemap.ts` | 60 | `context.project.settings['sitemap.enabled']` |

`SitemapSection` renders first, so it is the one in the trace. `DeploySection` would throw next.
The compilation pass would throw on export.

## What is *not* yet confirmed

**Which projects lose their `settings` key.** The embedded template does write `settings: {}`
([hello-world.template.ts:119](../../../packages/noodl-editor/src/editor/src/models/template/templates/hello-world.template.ts#L119)),
so a brand-new project should be fine — yet Richard's project ("AIB38 Live Chat") was not.

The leading hypothesis is the **v2 decomposed format**: nothing under
`services/ProjectStructure/` mentions `settings` at all, so whether an empty `settings: {}`
survives a `_adoptV2Format` round-trip is unverified. An empty object dropped on write and absent
on read would produce exactly this.

This does not gate the fix — the guard is correct regardless of who drops the key — but it is worth
a slice, because if v2 silently drops `settings` it is also dropping any settings a user *had* set.

## What to build

**Slice 1 — stop the crash (30 minutes).**

- `this.settings = args.settings ?? {};` in the constructor. See the concurrent-session warning in
  the [README](README.md) before touching this file.
- All five read sites above go through `getSettings()`.
- A jest test that constructs `new ProjectModel({ name: 'x' })` with no `settings` and asserts
  `getSettings()` returns `{}` and that the field itself is an object.

**Slice 2 — find out where the key goes.**

Save a new project, read the on-disk files, and check whether `settings` is present after the v2
adoption. If it is being dropped, fix the round-trip and add a test that sets a setting, saves,
reloads, and asserts it survived. If it is not being dropped, find out what Richard's project did
instead and record it here.

**Slice 3 — the class, not the instance.**

`grep -rn "\.settings\[" packages/noodl-editor/src` must return only `getSettings()`-mediated
access and the model's own internals. Consider making `settings` private with a `readonly` getter
so the direct-index route stops being available.

## Criteria

1. The settings panel opens on a project whose `project.json` has no `settings` key.
2. All four tabs render — Sitemap and Deploy included.
3. `new ProjectModel({name})` leaves `settings` an object, covered by a test.
4. No `.settings[` indexer survives outside the model.
5. Verified **in the running editor**, not only in jest: open a fresh project, click the gear, and
   confirm both themes and the AI provider section are reachable.

## Traps

- **Do not "fix" this by adding `?.` at the call sites.** `settings?.['sitemap.enabled']` silences
  the crash and leaves the model in a state where a later `setSettings` merge can lose data. The
  field being an object is the invariant; the guard belongs at construction.
- `projectmodel.ts` is dirty in another session. Commit with an explicit pathspec.
- The editor suite is `test:ci`, not bare `jest`, and it lies three ways — only the `Jasmine:` line
  counts. See the memory note on the editor suite before trusting a green run.
