# HLS-015 — `nodegx deploy`

**Scoped 2026-09-09 (session 9) by [HLS-010's verdict](HLS-010-THE-DEPLOY-SPIKE.md#6--the-verdict--2026-09-09-session-9).**
⚠️ **Gated on ruling R4** — the spike recommends building it; whether it ships is Richard's call.

🔴 **Read §5 before writing a line.** The mechanism is already proven; the whole risk in this task is
an artefact that looks perfect and renders nothing.

## 1. The person sentence

**Somebody who has a project folder and wants it on the internet types one command, and gets a
folder they can upload — with no editor, no build step, and no way to be handed a blank page
without being told.**

## 2. What is already true (measured by HLS-010, not assumed)

- `deployToFolder` **runs to completion in plain Node.** No Electron, no window, no
  `@electron/remote`. The full transitive import graph bundles under the esbuild config
  `nodegx serve` already ships.
- The engines it needs — `ProjectModel.fromJSON`, `Exporter.exportToJSON`,
  `exportComponentBundle`, `HtmlProcessor` — are **the same ones `noodl-preview/src/loader.ts`
  already drives headlessly**.
- The output is a self-contained static site: `index.html`, a hashed export `.js`,
  `noodl_bundles/*.json`, and the ~14.9 MB interpreter. Every asset served 200 over plain HTTP.
- **One thing is missing, and it is a path** — see C68.

## 3. Acceptance criteria

1. **`nodegx deploy <project-dir> <out-dir>` writes a folder that renders the project in a real
   browser.** 🔴 Not "resolves", not "writes eight files" — *renders*. The spike deliberately did not
   establish this and it is the criterion that carries the task.
2. **A deploy that would ship a blank app refuses instead of succeeding.** The C67 arm — an
   unpopulated node library — must exit non-zero and say what is wrong. Graded with the
   **reverted arm**: remove the guard and the same project deploys "successfully" with
   `roots: []`.
3. **The runtime assets resolve from the installed package, not from `process.cwd()`.** Graded by
   running the built binary from a directory that is neither the repo nor the project (C68).
4. **A project with assets ships them.** `templates/landing-pages` copies **zero** project files —
   every top-level entry is excluded by default rules — so it cannot grade the copy half at all.
   Pick a project with `noodl_modules` and/or static assets and assert they arrive.
5. **The deploy does not write to the project it reads.** Hash the tree before and after (C69).

## 4. Where it should live

🔴 **In `noodl-preview`'s bundle, or one built exactly like it — not in `nodegx-export`'s.**

`@nodegx/export`'s CLI is the **React source** exporter and is a pure-format program. The deploy
needs `ProjectModel`, `NodeLibrary` and the viewer's node register, which is a
**14.9 MB-interpreter-shaped** dependency. HLS-013 measured what happens when the editor's model
graph is pulled into another package's type program: **201 type errors and a renderer view module
in a server bundle.**

So: the `nodegx` binary keeps one front door (`args.ts` gains a third command beside `export` and
`serve`), and `deploy` dispatches into the preview-shaped bundle — the same separation HLS-013 used
for the cloud deploy, for the same measured reason.

⚠️ **Reuse `noodl-preview/src/headless.ts`.** `bootstrapNodeLibrary()` already throws on an empty
library, which is AC2's guard for free. A deploy that builds its own bootstrap re-opens C67.

## 5. 🔴 Traps

- 🔴 **The success report is not evidence.** With no node library the deploy resolves, writes every
  file, logs `copied 0 project file(s)` exactly as a good run does, and serves a blank page.
- 🔴 **Do not grade this with a connection count.** It reads **93/93 in both arms**. The field that
  moves is `roots` — `measure-deploy.js` in `hls010-spike/` reads it.
- ⚠️ **`environment` is unmeasured.** The spike ran `environment: undefined` only. A deploy carrying
  cloud-services metadata is the shape HLS-014 generalises and is untested.
- ⚠️ **`copyProjectFilesToFolder` runs before the export** and its exclusion rules are already
  opinionated (`components/`, `docs/`, `nodegx.project.json`). A person who expects their whole
  folder to ship will be surprised; the report exists (DEP-008) but only reaches a console.

## 6. What this task is NOT

- Not the cloud-function deploy — that is HLS-013, shipped, and a separate mechanism.
- Not a remote/hosted deploy. It writes a folder. Where that folder goes is the person's business
  and, if it ever becomes ours, HLS-014's.
