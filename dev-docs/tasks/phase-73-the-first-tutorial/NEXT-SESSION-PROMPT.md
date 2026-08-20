# Phase 73 — next session

**Written 2026-08-20, end of session 5.** Read [README §0](README.md) and [TASKS.md](TASKS.md)
first; this file is the working state, not the phase.

---

## 1. TUT-003 is done. The bundle exists and it was driven.

[`project-examples/lessons/log-a-thing/`](../../../project-examples/lessons/log-a-thing/) — 35 files,
8 steps, 6 graded, **F1–F4 all pass, `installable: true`**, driven end to end in the real editor.
All seven ACs are answered in
[TUT-003 §"Session 5"](TUT-003-THE-TUTORIAL-ITSELF.md) with the readings beside them.

**Only TUT-004 is left in this phase, and it still needs R2 (§4).**

## 2. 🔴 Start here: the finding TUT-003 hands TUT-004

**The bundle shipped the solution project's `id`, and every installed copy had the same one.**

`create_project` stamps an `id` → `derive_starter` copies it → `create_lesson` copies it again → and
`LearningFolderModel.install` copies the whole directory verbatim. So the bundle root, its
`solution/`, the authoring project and the learner's installed copy all carried
`620eff71-718e-4be7-a39b-462eafcdeb23`.

That matters because `findReusableBackend` matches on backend **name plus ownership**, and ownership
is *"this project id is in the backend's `projectIds`"*. Two projects with one id is README §1B's
two-apps-one-datastore defect **with the ownership check intact and useless** — the exact thing
`provisionBackend.ts:120-138` was written to end.

- **Worked around in the bundle:** `id` removed from both `nodegx.project.json` files.
  `ensureProjectId` mints one on demand, and an absent id is the supported pre-DSG-007 state.
- **The real fix is one line inside a caller that already exists:** `install()` should mint a fresh
  project id into the copy it writes ([`learningfolder.ts`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts),
  the `fs.copyRecursive` at ~line 410). That is TUT-004's, and it is **not** a new mechanism — §1D
  still holds.

⚠️ Do not "fix" this by re-stamping the bundle. A shipped bundle is a template; a template must not
carry an identity, and N learners installing one bundle is exactly the case that breaks.

## 3. 🔴 The trap this session paid for: the dist that would have refused the lesson

`check_lesson` through the registered `nodegx` MCP server would have refused this bundle — for the
defect session 4 **fixed**. The server runs `packages/noodl-mcp/dist/noodl-mcp.cjs`, built **07:26**;
`b5058f3b` landed **08:58**.

Probed with a known-firing control, which is the only reason the absence was believable:

| probe | dist | source |
|---|---|---|
| `"so it will tick itself the"` (the OLD F2′ message) | **1** | 1 |
| `"never as it will be when a learner opens the starter"` (the NEW guard) | **0** | 1 |

✅ **The way round it, and it is reusable.** The tools are thin wrappers; call the same functions off
`packages/noodl-mcp/src` directly:

```
NODE_PATH=<repo>/node_modules npx ts-node --transpile-only \
  -P packages/noodl-mcp/tsconfig.json <script>.ts check <bundleDir> <backendId>
```

`editor-deps`, `lessons/bundleWriter` (`nodeBundleFs`), `lessons/starterWriter`,
`lessons/lessonDatabase`, `lessons/wholeSolutionGrader` and `lessons/bundleVocabulary` **all load in
plain Node**. So does `models/learningfolder.ts`, and so do `NoodlBlocks` / `NoodlGenerators` — see §5.
The scripts from this session are in the session scratchpad, not the repo; they are ten lines each and
faster to rewrite than to find.

🔴 A rebuild would **not** have helped in-session: the MCP server process is already running with the
old module loaded, and this session cannot restart it.

## 4. Owed by Richard

- 🔴 **R2** — what provenance does a community bundle install under? `lessoninstallpolicy.ts` grades
  `local` / `local-ai` / `curated` / `org`; a platform bundle is a **third** trust profile.
  **Blocks TUT-004 AC3 only.**
  ⚠️ New context from the drive: this bundle declares `authoredBy: "ai"`, so it installs as
  **`local-ai`** and is held to F1+F2+F3 — and it passed. Whatever R2 decides has to be at least that
  strict, or the "a claim may only ever cost the claimant" spec inverts.
- **The copy.** The lesson prose is mine. It is the argument as much as the tutorial, and it should
  read the way Richard would say it before it goes near the community. When he has been through it,
  `authoredBy: "ai"` is his call — it is a true statement today and only ever tightens the gate.

## 5. Two smaller things worth carrying

**A Visual Function's `workspace` / `generatedCode` can be generated headlessly.** `NoodlBlocks` and
`NoodlGenerators` import cleanly into plain Node; load the workspace JSON into a real
`Blockly.Workspace`, call `javascriptGenerator.workspaceToCode`, and print
`detectIO(JSON.stringify(state))` beside it. That is how this lesson's program was written, and it
turns "is my workspace JSON well-formed and does it publish the ports I think?" into a two-second
question instead of a drive.

🔴 **And the bug it caught, which is a runtime fact and not a lesson one:** an unconnected Logic
Builder value input has **no default** (`registerInputIfNeeded`, `logic-builder.ts:231`), so
`Inputs["x"]` is `undefined` until something writes it. Blockly's `text_trim` emits a bare `.trim()`
with no coercion. `isEmpty(trim(get input entry))` therefore **throws** the first time a learner
presses the button — and `String(undefined)` is `"undefined"`, so coercing makes it save a record
instead. `logic_negate` is the block that is actually right.

## 6. Findings filed elsewhere, not this phase's to fix

- ⚠️ **The lesson format's Markdown has no blockquote.** `renderMarkdown` does headings, lists,
  paragraphs and inline; a `> ` line renders with the `>` visible. Found by **looking at a
  screenshot** with every gate green. Both occurrences were rewritten as bold.
- ⚠️ **A completed task card's title fails AA in both themes** — 1.76:1 dark, 2.47:1 light, measured
  off computed styles with the theme flipped by `data-theme` and read in a *second* call. The lesson
  **prose** passes comfortably (9.64 / 13.33) and so does CHECK MY WORK (6.94 / 4.57). This is the
  lesson layer's own `completed` styling, NAT-002/003's territory. ⚠️ Only the `completed` state was
  measured; the active state is **untested**.
- ⚠️ **The Backend Services panel would not open under CDP** — clicking the rail button produced its
  tooltip and no panel, three times, on a lesson project. TUT-001 drove this panel successfully in
  session 1, so something about this state differs. The backend and collection were created by calling
  `provisionBackend` instead, so **the Data-panel route to creating a collection is unverified**. If a
  learner's Data-panel route ever answers `columns: []`, drop `hasColumns` from step 2 and keep
  `collectionExists`.

## 7. Housekeeping

- **This session changed no source.** The repo diff is the new bundle directory plus these docs, so
  no gate can have regressed from it.
  ✅ **`test:main` is green again, and the reading covers this work.** Session 4 recorded it red —
  3 suites unrun on a peer's phase-72 typecheck errors. The **UNI-007 peer** has since fixed those and
  measured **289 suites / 4714 tests / 0 failures** at `4cea617b`, which has `aababde6` as an ancestor
  (checked with `git merge-base --is-ancestor`), so the tree it ran on contains this bundle.
  ⚠️ **Relayed, not mine** — I did not run it, and it says nothing about `typecheck:editor` or
  `test:ci`. Re-measure rather than quote it. `test:ci` floor is **2849 specs / 10 failures @
  `NOODL_SPEC_SEED=39393`**, re-measured 08-20.
- 🔴 Peers commit to `cline-dev` from this same checkout and did so during this session.
  **`git commit -- <pathspecs>`, never `git add -A`, never stash.** Untracked files need
  `git add <paths> && git commit -- <paths>` as **one chain**, `-m` before the `--`.
  ~~One peer has `communityorigin.ts` pointed at `localhost:3947`~~ — reverted and verified clean
  (`COMMUNITY_URL` back to `https://community.nodegx.io`, empty `git status`), so that warning is spent.
- **Working directories outside the repo** (kept, not needed):
  `NodeGX test projects/tut003-log-a-thing-solution` (the authoring project, bound to backend
  `backend_mt17opj2xbxsi` on 8585), `…-starter`, `…-bundle`, `tut003-drive-bundle`. The installed
  learner copy is at `~/Library/Application Support/NodeGX/Learning/log-a-thing` with its own backend
  `backend_mt18kzpf2usu6` on 8586 — **and the two being different is AC6.**
- The editor stack was torn down (`dev:stop`, 27 processes, CDP 9222 free) and both peers told.
