# Deliberately empty — and 🔴 deliberately still here

This entry ships **no module code**. The `/PDF Viewer` component uses the
`module.inlineHtml` node, which is registered by the standalone **Custom HTML**
module (`library/modules/custom-html`). PDF Viewer used to bundle its own copy
of `custom-html-module` here; LBR-006 removed it because two copies of the same
module fight over `noodl_modules/custom-html-module/` in the installing project.

Since LBR-007 the requirement is declared rather than described: the entry's
`library.json` carries `"dependencies": ["modules/custom-html"]`, which
`scripts/library/build.js` resolves into `index.json` and the editor's
`ModuleLibraryModel._installWithDependencies` installs ahead of this entry. See
the entry README for the full reasoning.

## Why this directory survives with nothing in it

`scripts/library/check.ts` derives `providesNodes` from
`fs.existsSync(project/noodl_modules)`, and that flag is what exempts an entry
from the FH-023 rule that no node may reference a type the catalog does not
know. `/PDF Viewer` legitimately references a type another entry registers, so
deleting this directory makes `npm run library:check` fail this entry for being
correct. The rule ought to read "provides nodes **or declares dependencies**";
until it does, this placeholder is load-bearing.

Nothing here reaches a user's project: the import engine copies only
`noodl_modules` *subdirectories that carry a `manifest.json`*
(`import-engine/analyze.ts::listModules`) and excludes files under
`noodl_modules` from the resource list.
