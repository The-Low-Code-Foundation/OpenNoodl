# Deliberately empty

This entry ships **no module code**. The `/PDF Viewer` component uses the
`module.inlineHtml` node, which is registered by the standalone **Custom HTML**
module (`library/modules/custom-html`) — install that module alongside this
one. PDF Viewer used to bundle its own copy of `custom-html-module` here;
LBR-006 removed it because two copies of the same module fight over
`noodl_modules/custom-html-module/` in the installing project.

This directory (with this note in it) stays in the entry so it is explicit
that the module dependency is external, not forgotten. The import engine
copies only `noodl_modules` *subdirectories that carry a `manifest.json`*
(`import-engine/analyze.ts::listModules`) and excludes files under
`noodl_modules` from the resource list, so this file never reaches a user's
project.
