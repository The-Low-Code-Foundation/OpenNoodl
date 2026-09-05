# PDF Viewer — configuring it

## It pulls in the Custom HTML module for you

The `/PDF Viewer` component is built around the `Custom HTML` node
(`module.inlineHtml`), which this entry does not contain. That node comes from
the standalone **Custom HTML** module, and `library.json` now says so in a field
the installer reads:

```json
"dependencies": ["modules/custom-html"]
```

Installing PDF Viewer installs Custom HTML first, in the same click, without
asking you to know that. You will see one consent prompt — Custom HTML ships
executable module code, PDF Viewer does not — and, if you already have Custom
HTML in the project, the usual import screen for the collision.

**On an editor older than this field** (anything that predates NodeGX 0.2.2) the
`dependencies` key is ignored and only PDF Viewer installs. The symptom is a red
dashed `Custom HTML` placeholder inside `/PDF Viewer` and, at runtime,
`Can't find component model for module.inlineHtml`. The fix is to install
**Custom HTML** from the Modules library by hand; order does not matter.

## Using it

Place the `/PDF Viewer` component and set:

- **PDF URL** — the URL of the PDF to display. It is URL-encoded for you and
  handed to Google's document viewer (`docs.google.com/viewer`) inside an
  `<iframe>`, so the URL must be publicly reachable — the viewer runs on
  Google's servers, not in your app.
- **Width** / **Height** — the size of the viewer group.

A sample PDF URL is pre-wired as the default.

---

# Why this entry has a dependency instead of a copy (LBR-007)

This is written down so nobody re-derives it. Phase 65 shipped this entry in a
state where it *could not work*: it referenced a node type nothing installed,
and the only place the requirement was recorded was prose — this README and the
`description` on the library card. Prose is not an installer. Two shapes of fix
were on the table.

## Rejected: fold `custom-html` back into `pdf-viewer`

This is what the entry used to do, and it was removed for a reason that has not
gone away: **a bundled copy and the standalone module both land in
`noodl_modules/custom-html-module/` in the installing project, and whichever
installs second overwrites the first.** A user with both entries installed does
not have two modules, they have one module of indeterminate version, and no
surface anywhere tells them which. The duplication is not the objection —
the silent overwrite is.

It also does not generalise. The moment a second entry wants to share something
(a `user-menu` prefab that wants the `avatar` prefab; anything that wants a
shared icon set) the answer is another copy, and the copies drift. The library
had one entry with this problem and was about to have a second.

## Chosen: a `dependencies` field with a consumer at both ends

🔴 **A dependency field nothing reads is worse than no field at all** — that is
the standing rule in this repo, and it is why `runtimeVersion` is documented as
descriptive provenance rather than gated (see
`packages/noodl-editor/src/editor/src/models/moduleCompatibility.ts`). So the
field was only worth adding if the whole path existed. It does, and it is a
two-stage path:

| Stage | Where | What it does |
| --- | --- | --- |
| Author | `library/<type>/<slug>/library.json` | `"dependencies": ["modules/custom-html"]` — type-dir + slug, human-writable, cross-type. |
| Validate | `scripts/library/schema.json` | The field and its `"^(prefabs\|modules)/…"` item pattern. `library:check` and `library:build` both compile this schema, so a typo is a build failure, not a runtime surprise. |
| Resolve | `scripts/library/build.js` → `resolveDependencies()` | Resolves each slug against the other entries **on disk**, fails the build on an unknown slug, a self-reference or a cycle, flattens the transitive closure into dependency-first order, dedupes, and writes resolved descriptors (`{key,label,type,project,version,minEditorVersion}`) into `index.json`. |
| Consume | `ModuleLibraryModel._installWithDependencies()` → `_installDependency()` | Walks that flat list in order and installs each descriptor through the same `_install` a user's click uses, then installs this entry. |

**Why resolution is a build-time job.** Shipping the raw slugs and resolving in
the editor would mean deriving a slug back out of
`library/modules/custom-html-1.0.2.zip`, requiring the *other* tab's index to
have been fetched before a module could pull in a prefab, and putting a graph
walk in the click path. Resolving at build time makes the editor's half a `for`
loop, and makes an unresolvable dependency a loud failure of `npm run
library:build` — before anything is published — instead of a quiet one in a
user's editor.

**Why a failed dependency aborts the install.** Installing the dependent alone
is not a degraded success; it is exactly the red dashed placeholder this field
exists to abolish, arrived at more expensively. `_installDependency` re-throws
with a sentence naming both ends.

**Why the picker block moved.** `_install` used to take
`onBeforePopup`/`onAfterPopup` and hold them across its own body, because two
modals each taking and releasing the block would unblock the node picker in the
gap between them — the moment a second click starts a second install. A
dependency chain is that same gap one level up, so the hooks now live on
`_installWithDependencies` and are held across the whole chain, and `_install`
no longer accepts them at all.

**Backwards compatibility.** The field is additive. An editor that predates it
ignores it and installs one entry, which is precisely today's behaviour — which
is why this README still documents the manual install order above, and why the
card's `description` still names Custom HTML.

## 🔴 Do not delete `project/noodl_modules/README.md`

That directory is empty of module code on purpose, but its **existence** is what
`scripts/library/check.ts` reads as `providesNodes` — the flag that exempts an
entry from the FH-023 "no node has lost its type" rule. `/PDF Viewer` contains a
`module.inlineHtml` node whose type is registered by a *different* entry, so
without that directory `npm run library:check` fails this entry on a node that
is correct. The honest rule would be "provides nodes **or declares
dependencies**", and `check.ts` should grow it; until then the placeholder
directory is load-bearing.
