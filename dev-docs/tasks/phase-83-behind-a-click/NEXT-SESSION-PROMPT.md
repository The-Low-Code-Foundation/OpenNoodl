# Phase 83 — next session

**Session 14 (2026-09-10): Richard ruled R4 — YES — and HLS-015 was built and driven the same
session, 5/5 ACs.** [HLS-015-WHAT-WAS-BUILT.md](HLS-015-WHAT-WAS-BUILT.md).

`nodegx deploy <project> <out>` writes a ready-to-host site with no editor and no build step. Run
from a directory that is neither the repo nor the project, served, and opened in a real Chrome, it
draws **1,881 characters across 151 elements**.

🔴 **Re-derive the board from the task FILES, not from this table.** `ls` the directory and look for
`*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

Read [README.md](README.md) first — **§2 carries rulings, not questions, and R4 is now one of them.**

## 1. The board

| id | task | state |
|---|---|---|
| HLS-001…HLS-011, HLS-013, HLS-015 | see each `-WHAT-WAS-BUILT.md` | 🟢 **BUILT** — HLS-006 is 2/4 + 2 person halves |
| HLS-012 | The thread gets an answer | 🟡 **drafted, NOT posted** — [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md) |
| HLS-014 | The second deploy | ⬜ never built — ✅ **GATE NOW OPEN** (R4 ruled, HLS-015 ships the first deploy) |

**14 of 15 built. 50 acceptance criteria closed, 2 half-closed.**

## 2. The next task — and for the first time in two sessions there IS one

🔴 **HLS-014, `the second deploy`.** It was gated on R4 and on HLS-010's verdict; both are now
settled, and HLS-015 shipped the first deploy it generalises. Read
[HLS-014-THE-SECOND-DEPLOY.md](HLS-014-THE-SECOND-DEPLOY.md) — **and re-measure its §2 before
believing it.** Five of the last six task files in this phase had a wrong §2, and re-measuring has
never cost more than ten minutes.

What HLS-015 leaves it, stated as things it does NOT know:

- ⚠️ **`environment` has never been anything but `undefined`** in any deploy this phase has run —
  the spike's, HLS-015's drive, or its gates. A deploy carrying cloud-services metadata is exactly
  what HLS-014 generalises and **nothing has ever exercised it**.
- ⚠️ **`--base-url` is parsed and forwarded and never driven.** No arm served a site from a
  subfolder.
- ⚠️ **`copyProjectFilesToFolder` runs before the export and does not delete.** Redeploying over a
  running app is a second write into a folder that already holds one — the copy step already says
  loudly when an *excluded* path is already present, and says nothing about a stale hashed export
  from the previous deploy. That is HLS-014's idempotency question in its concrete form.
- ⚠️ **C69 is guarded but still latent** — `_isReadOnly` is now set, and what would make it matter
  has still not appeared. A `serve` that also deploys is where it would land.

If HLS-014 is not the session's job, the honest alternatives are unchanged from s13 and are in §3.

## 3. 🧭 Waiting on Richard

1. **Post the HLS-012 replies** (or say he will not). @dominikstohl has waited since **2025-04-16**
   and **a draft is not a reply**. #36 is more answerable now than at any point in this phase:
   `nodegx export`, `nodegx deploy`, `nodegx serve`, `nodegx render` and `export_react` all ship.
2. **[PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — R5 is "merge it first".
3. 🔴 **The security one, unchanged since s7.** The installed `/Applications/NodeGX.app` still
   listens on `*:8574`/`*:8575` and still hands out its relay token. HLS-006 fixed the **source**;
   a source fix is not a shipped fix. **R1 is still unruled**, so nothing is scheduled to ship it.
4. ⚠️ **Docker Desktop** was started on this box on 2026-09-10 for HLS-011 and left running, with 13
   of Richard's `restart=unless-stopped` containers up. Still his call.

## 4. The smaller rows, if HLS-014 is not the job

1. **C75's second half** — the report names each dropped dimension wire; nothing names the
   *capability*. One sentence in the emitted README, or a sink on the element.
2. **C76** — README §1 and §6 say `npm ci`; the product correctly says `npm install`.
3. **C74** — read the URL back after navigating, so a redirected route stops being reported under
   the name that was asked for. Affects `render_report` and every F4 grader.
4. **C77's other half** — `noodl-preview/src/cli.ts` still reaches the platform through a named
   import alone, which is the shape that cost an hour this session. One bare import.
5. **C79's other half** — `platform-node`'s `getAppPath()` still throws a **bare string at module
   scope** from any directory that is not an npm package. Fixed for the bundles by shipping a
   `dist/package.json`; every other consumer still has it.
6. **The person halves of HLS-006 AC1 and AC4** — five minutes, **two devices**. 🔴 Neither HLS-011's
   container nor HLS-015's drive closes these: a network namespace is not a second machine.

## 5. What HLS-015 leaves you

- **`tests/hls015-drive.mjs`** — one command, `node packages/nodegx-export/tests/hls015-drive.mjs`.
  Needs Chrome and a built engine (`npm run build --workspace @noodl/preview`).
- 🔴 **The presence control in it is the pattern to copy.** Arm 2 empties every `roots` array **in
  the written artefact** — no source edit, no rebuild — so the two arms differ by exactly the field
  the refusal is built on. A control whose arms differ by more than the thing under test is not a
  control.
- **`noodl-preview/src/deployReading.ts` imports `fs` and `path` and nothing else.** That is what
  makes the decision gradeable at all: the rest of the engine cannot be required from ts-jest.

## 6. 🔴 Standing warnings — three are new

- 🔴 **A ROW THAT ASSERTS AN ABSENCE MUST NAME SOMETHING NOTHING WILL EVER CLAIM.** Register row
  **C78**: `hls002-cli.test.ts`'s "a command this binary does not have" named `deploy`, with a real
  project and a real output folder. The day the command existed it deployed successfully and read
  exit 0 — and took **520 seconds** doing it. Renamed to `upload`; 70 seconds.
- 🔴 **A NAMED IMPORT DOES NOT HOLD A SIDE EFFECT IN A BUNDLE.** Register row **C77**: esbuild drops
  an import whose bindings are all unused, so deleting the one call to `bootstrapNodeLibrary()`
  deleted the `@noodl/platform` binding with it, and the bundle died at module load with a sentence
  naming neither. If a module's value is its side effects, import it bare as well.
- 🔴 **A REGISTER ROW IS A CLAIM ABOUT AN INSTRUMENT AS WELL AS A DEFECT.** **C79**: C68 named an
  ancestor walk that does not exist and predicted an `ENOENT` that never fired, because the real
  failure happens one layer earlier and throws a bare string. The defect was real; the row's account
  of *how you would see it* was wrong, and following it would have sent the reader to the wrong
  file. Re-measure a row before inheriting its mechanism, not just its verdict.
- 🔴 **A CONTENT PROBE AND A BUILD GATE ARE DIFFERENT INSTRUMENTS** (HLS-011). And now a third pair:
  **a grading function cannot see a blank page and a browser cannot see an exit code table.**
- 🔴 **A COUNT AND A PICTURE ARE DIFFERENT INSTRUMENTS** (HLS-007). C74.
- 🔴 **RUN THE CHECK A TASK FILE ASKS FOR** (HLS-007). Fifth session running to re-measure §2.
  HLS-015's was right in every clause **except its conclusion**: *"One thing is missing, and it is a
  path"* named C68 and there were **two**, and the one you hit first is not the path — the platform
  throws a bare string at module scope before any path is resolved. A §2 can be accurate line by
  line and still send you to the wrong file, which is a milder version of the same trap HLS-010's
  §2 sprang ("true in every clause and wrong in its conclusion").
- 🔴 **A SHARED FILE IN SEVERAL COMPILERS IS A SHARED FILE IN SEVERAL SESSIONS' GATE RUNS.**
  HLS-015 edited `noodl-editor/.../deploy-index.ts` and `scripts/devtools/render-report.js`; both
  `typecheck:editor` and `typecheck:editor-tests` were re-run because of it.
- 🔴 **AN IN-REPO GATE CAN BE BLIND BY ARITHMETIC** (C72). `resolveEngine` has the same two
  depth-coincidence candidates as `resolveHarness` and the same graded refusal for an install.
- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is.
- ⚠️ **C65 — 7 tokens of resident MCP headroom.** Measure before you place a tool.
- ⚠️ **C52 unchanged**: `sbr009ThemeEditorDrive` (2) and `def018-def020-layout-drive` (1), **NONE**.
- 🔴 **"GREEN ALONE, RED UNDER LOAD" DOES NOT DISTINGUISH A FLAKE FROM A CEILING THAT IS TOO SMALL.**
  `test:main` came back 446/7,359 with one red — **phase 84's** `fld-009/projectLevelWatch`, 276 ms
  alone. I re-ran it, read green, and filed it as a flake. The session that owns it read the spec
  instead and found a **4,000 ms** latency ceiling that had taken REL-009b's stopwatch note only
  half way; it now carries REL-009b's own 30,000. Re-running is the cheap check and it answers a
  different question from the one you have.
- ⚠️ **`noodl-mcp`'s jest runs `diagnostics: false`.** The suite is not the typecheck there.
- ⚠️ **`nodegx serve` defaults to 8575**, which collides with the editor's design-tool import socket
  (`NOODLPORT + 1`). Pass `--port`, or move the editor with `NOODLPORT=8674`.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 7. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md), 48 rows. **C77, C78 and C79 are
new** (C78 closed, C77 and C79 half-closed with a named remainder). **C67 and C68 are CLOSED by
HLS-015**; C69 is guarded and still latent. Still OPEN and owned by `NONE`: **C52**, **C59**,
**C60**, **C65**, **C66**, **C70**, **C71**, **C73**, **C74**, **C75**, **C76**, plus the community
rows C31b, C40, C12 and C20 (C20 is R5, awaiting Richard).

## 8. ⚠️ Two other phases exist and are not this one

- **phase-84** (`FLD`, Richard's field report) and **phase-85** (`CMP`, the component-doctrine loop).
  Leave both alone unless you are that session.
