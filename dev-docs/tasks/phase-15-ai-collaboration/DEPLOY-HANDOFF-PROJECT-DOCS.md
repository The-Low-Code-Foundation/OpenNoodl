# Hand-off to the deployment overhaul: private project files must not deploy

**Filed by:** AIX-009, 2026-07-27
**Status:** **accepted 2026-07-27** — owned by [DEP-008](../phase-26-deployment/DEP-008-ARTIFACT-CONTENTS-AND-IGNORE.md) (phase 26, tier 1). AIX-009 remains blocked until it lands.
**Original purpose:** paste-ready hand-off to the deployment overhaul. Kept as the record of what was asked for; DEP-008 is now the live spec.

---

## The defect

`copyProjectFilesToFolder` copies the **entire project folder** into the deploy
output. Its exclusion set is a hardcoded five-name list plus two substring
checks, with a TODO on line 6 asking for exactly the mechanism that is missing:

```ts
// packages/noodl-editor/src/editor/src/utils/compilation/build/copy.ts:5-24
export async function copyProjectFilesToFolder(projectPath: string, direntry: string): Promise<void> {
  // TODO: Load something like .noodlignore file list
  const ignoreFiles = ['.DS_Store', '.gitignore', '.gitattributes', 'project.json', 'Dockerfile'];
  ...
  let files = await filesystem.listDirectoryFiles(projectPath);
  files = files.filter((f) => {
    if (ignoreFiles.indexOf(f.name) !== -1) return false;
    if (f.fullPath.indexOf('.git') !== -1) return false;   // Ignore git files
    if (f.fullPath.indexOf('.noodl') !== -1) return false; // Ignore noodl files
    return true;
  });
```

Called unconditionally at the top of `deployToFolder`
([`deployer.ts:57`](../../../packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts#L57)),
before the export JSON is written.

Anything a creator puts in their project folder — notes, credentials scratch
files, design PDFs, a `docs/` folder — is served from the app's public origin
after the next deploy. It is not gated on file type, and there is no warning.

Two secondary problems in the same seven lines:

1. **The substring checks over-match.** `f.fullPath.indexOf('.git') !== -1`
   excludes any path containing `.git` *anywhere*, so a legitimate asset in a
   folder named e.g. `pre.gitlab-assets/` is silently dropped from the deploy.
   Same class of bug for `.noodl`. Silent under-copying is harder to notice than
   over-copying.
2. **`project.json` is excluded by name but `nodegx.project.json`,
   `nodegx.routes.json`, `nodegx.styles.json` and `components/` are not.** The
   v2 project source is currently deployed alongside the built bundle. Whether
   that is acceptable is a decision the deployment overhaul should take
   explicitly rather than inherit.

## Why AIX-009 is blocked on it

AIX-009 introduces a `docs/` folder at the project root holding the creator's
scoping notes, rejected approaches, backend contracts and AI conventions —
explicitly *not* for publication. That folder is chosen to be **visible** (not
`.nodegx/docs/`) precisely so people read and edit it in their normal editor and
commit it to git. Visible plus the current copy behaviour equals published.

AIX-009 deliberately does not patch `ignoreFiles` with one more hardcoded entry.
That would leave every other private file still leaking and add to a list that
this overhaul should be deleting.

## What deployment needs to provide

1. **A real ignore mechanism.** `.noodlignore` (or the overhaul's equivalent) in
   the project root, gitignore-style, applied to the project-file copy step.
2. **A sensible default ignore set** applied when no file is present, covering
   at minimum: `docs/`, `.git/`, `.DS_Store`, `.gitignore`, `.gitattributes`,
   `node_modules/`, `Dockerfile`, and the editor's own dotfiles.
3. **Path-anchored matching**, replacing the two `indexOf` substring checks, so
   exclusion is by path segment rather than by accidental substring.
4. **An explicit decision on v2 project source** (`nodegx.*.json`,
   `components/`) in deploy output — recorded either way.
5. **Visibility.** The deploy report/UX should state how many files were
   excluded and why, so a creator can tell the difference between "my asset is
   missing" and "my asset was ignored".

## Acceptance the AI track will check against

Deploying a project containing a populated `docs/` folder produces an output
directory with no `docs/` and no `.md` originating from it. This is acceptance
criterion 8 of AIX-009 and the interlock between the two tracks.

## References

- [AIX-009 — Project context documents](./AIX-009-PROJECT-CONTEXT-DOCS.md) — §Blocking point
- `packages/noodl-editor/src/editor/src/utils/compilation/build/copy.ts`
- `packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts`
