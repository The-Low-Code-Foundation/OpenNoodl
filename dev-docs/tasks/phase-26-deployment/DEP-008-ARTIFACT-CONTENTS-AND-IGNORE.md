# DEP-008: Artifact contents & the ignore mechanism

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEP-008 |
| **Phase** | Phase 26 — Deployment (Track K) |
| **Tier** | 1 — the constraint |
| **Priority** | 🔴 Critical — this is a live privacy defect in the deploy path that already ships, not only a blocker for what is coming |
| **Difficulty** | 🟢 Easy — the code is one function; the decisions about defaults are the work |
| **Estimate** | 2–3 days |
| **Prerequisites** | none |
| **Blocks** | AIX-009 (phase 15) |
| **Filed by** | AIX-009 scoping, 2026-07-27 |
| **Executor** | 🟠 Opus 4.8 |
| **Branch** | commit directly to `cline-dev` |

## Objective

Decide what is in a deploy artifact and what is not, and give the user a way to
say so — instead of shipping the entire project folder past a five-name
hardcoded filter.

## Background

Every deploy target in this phase copies the project folder before it writes
anything of its own. `deployToFolder` calls `copyProjectFilesToFolder` as its
first real action ([`deployer.ts:57`](../../../packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts#L57)),
and that function copies **everything**:

```ts
// packages/noodl-editor/src/editor/src/utils/compilation/build/copy.ts:5-24
export async function copyProjectFilesToFolder(projectPath: string, direntry: string): Promise<void> {
  // TODO: Load something like .noodlignore file list
  const ignoreFiles = ['.DS_Store', '.gitignore', '.gitattributes', 'project.json', 'Dockerfile'];
  ...
  files = files.filter((f) => {
    if (ignoreFiles.indexOf(f.name) !== -1) return false;
    if (f.fullPath.indexOf('.git') !== -1) return false;   // Ignore git files
    if (f.fullPath.indexOf('.noodl') !== -1) return false; // Ignore noodl files
    return true;
  });
```

Anything a creator puts in their project folder — notes, a credentials scratch
file, client PDFs, design exports — is served from the app's public origin after
the next deploy, with no warning and no way to opt out. The TODO asking for the
mechanism that would fix it has been sitting on line 6 the whole time.

This matters more with every target this phase adds. Today there is one
destination and one fairly technical audience. After DEP-002, DEP-003 and
DEP-005 there are five, and DEP-006 aims one of them at people who have never
pointed a domain before.

Two further problems live in the same seven lines:

1. **The substring checks over-match.** `f.fullPath.indexOf('.git') !== -1`
   excludes any path containing `.git` *anywhere*, so a legitimate folder like
   `pre.gitlab-assets/` is silently dropped from the deploy. Same class of bug
   for `.noodl`. Silent under-copying is harder for a user to diagnose than
   over-copying — nothing reports it.
2. **v2 project source is currently deployed.** `project.json` is excluded by
   name, but `nodegx.project.json`, `nodegx.routes.json`, `nodegx.styles.json`
   and `components/` are not. So the app's source graph ships alongside the
   built bundle. That may be fine — it is arguably a feature for a legible-
   by-design product — but it is currently an accident, and this phase should
   make it a decision.

## The immediate consumer

Phase 15's [AIX-009](../phase-15-ai-collaboration/AIX-009-PROJECT-CONTEXT-DOCS.md)
introduces a `docs/` folder at the project root holding the creator's scoping
notes, rejected approaches, backend contracts and AI conventions — explicitly
not for publication. It is deliberately **visible** rather than hidden under a
dotfile, so that people read and edit it in their normal editor and commit it to
git. Visible plus the current copy behaviour equals published.

AIX-009 declined to patch `ignoreFiles` with a sixth hardcoded entry: that would
leave every other private file leaking and lengthen a list this task should be
deleting. It is blocked on this task instead, and its acceptance criterion 8 is
the interlock between the two tracks.

## Scope

1. **A real ignore mechanism.** `.noodlignore` in the project root,
   gitignore-style syntax, applied to the project-file copy step. Absent file →
   defaults only.
2. **A default ignore set**, applied whether or not the file exists, covering at
   minimum: `docs/`, `.git/`, `.gitignore`, `.gitattributes`, `.DS_Store`,
   `node_modules/`, `Dockerfile`, and the editor's own dotfiles. The user's file
   extends the defaults; overriding one requires a negation, so nobody
   accidentally un-ignores `.git/` by writing a short file.
3. **Path-anchored matching** replacing the two `indexOf` substring checks, so
   exclusion is by path segment rather than accidental substring.
4. **A recorded decision on v2 project source** (`nodegx.*.json`, `components/`)
   in deploy output — either way, written down in this task's notes rather than
   inherited silently. Consider that DEP-001 changes what `nodegx.project.json`
   means at runtime.
5. **Visibility in the deploy report.** How many files were excluded and by
   which rule. A creator must be able to tell "my asset is missing" from "my
   asset was ignored" without reading source.
6. **One code path.** Every target in this phase copies through the same
   function. No target may grow its own filter.

### Out of scope

- Excluding anything from the *built bundle* — this is about the verbatim
  project-file copy only.
- Secret scanning. WF-003 already has a credential scan that fails the build;
  this task does not duplicate or replace it.

## Acceptance

1. A project containing `docs/`, `node_modules/` and `notes.txt` deploys with
   `docs/` and `node_modules/` absent from the output, and `notes.txt` present
   (it is not in the defaults — the user must say so).
2. Adding `notes.txt` to `.noodlignore` excludes it on the next deploy.
3. A negation line can re-include a defaulted path, and doing so is the only way
   to.
4. A folder named `pre.gitlab-assets/` **is** deployed — the substring
   over-match is fixed and has a regression test.
5. The deploy report states the excluded count and the rule that excluded each
   path.
6. All targets added in this phase inherit the behaviour without their own
   filter code.
7. **The AIX-009 interlock:** deploying a project with a populated `docs/`
   produces an output containing no `docs/` and no `.md` originating from it.

## Risks

| Risk | Mitigation |
|---|---|
| A new default breaks someone's existing deploy by excluding an asset they relied on | Defaults are conservative and named individually; the deploy report makes every exclusion visible (criterion 5) |
| Two ignore semantics (ours vs gitignore) confuse users | Use gitignore syntax as-is; do not invent a dialect |
| The fix lands per-target and drifts | Criterion 6; one function, asserted |

## References

- [AIX-009 — Project context documents](../phase-15-ai-collaboration/AIX-009-PROJECT-CONTEXT-DOCS.md) — the blocked consumer
- [DEPLOY-HANDOFF-PROJECT-DOCS.md](../phase-15-ai-collaboration/DEPLOY-HANDOFF-PROJECT-DOCS.md) — the original hand-off from the AI track
- `packages/noodl-editor/src/editor/src/utils/compilation/build/copy.ts`
- `packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts`
