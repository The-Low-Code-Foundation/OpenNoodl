# Phase 73 — next session

**Written 2026-08-20, end of session 6.** Read [README §0](README.md) and [TASKS.md](TASKS.md)
first; this file is the working state, not the phase.

---

## 1. One thing is left in this phase: **drive TUT-004**.

TUT-004 is built, specced and committed. **7 of its 8 acceptance criteria are closed with readings
beside them** in [TUT-004 §"Session 6"](TUT-004-ONE-CLICK-FROM-THE-PANEL.md). What nobody has done
is **watch a person click the row in a running editor** — which is AC1's second half and AC8's.

✅ **R2 is answered: `curated`.** Nothing in this phase is waiting on Richard any more.

### Commits

| | |
|---|---|
| `a86d13a6` | the project identity — `install()` mints, `reset()` keeps |
| `cd024b52` | the caller: fetch → stage → preflight → install → `{kind:'platform', url}` |
| `f3f20771` | the panel: `Tutorials.tsx`, the view model, the hook |
| `4521082` (nodegx-community@main) | `tutorial_bundles`, migration `0017`, the bundle route |

### The measurements, so you do not re-derive them

- `test:main` **295 suites / 4831 tests / 0 failures, exit 0** — re-measured after the last commit.
- `typecheck:editor` and `typecheck:editor-tests` **exit 0**.
- Platform suite **52 files / 1257 passed / 8 skipped / 0 failures, exit 0** — re-measured
  14:08 against `nodegx_community_tut004_s6`, *after* the last fix rather than before it.
  `tsc -p .` exit 0.
- **79 specs** in `tests-unit/tut-004/` (4 files) + **31** in `nodegx-community/tests/`.
- **7 mutations verified red.** Listed in TUT-004 §"Session 6".
- 🔴 **`test:ci` was NOT run this session.** The floor is still **2849 specs / 10 failures @
  `NOODL_SPEC_SEED=39393`** from session 5. **Re-measure; do not quote this.**
- ⚠️ **`typecheck:core-ui` exits 2 with 44 errors** — every one in `AiAssistant/`, `workflow/`,
  `utils/` or `CanvasOverlays/`, **none in a file this session touched**, and it is in no gate
  script. Observed, attributed, **not fixed**.

## 2. 🔴 How to run the drive, and the one hazardous step

Three things have to stand at once. Steps 1 and 3 are ordinary; **step 2 is a shared-checkout
source edit and a peer was already caught leaving it in.**

### 1. The community server, on **your own** database

```
cd ~/vscode_projects/nodegx-community
DATABASE_URL="postgres://nodegx:nodegx@localhost:55432/nodegx_community_tut004_s6" npm run dev
```

`nodegx_community_tut004_s6` was left **migrated, seeded and published**: article `log-a-thing`, and
its bundle (35 files, 57 KiB, version 1). Verify rather than trust:

```
docker exec nodegx-community-db psql -U nodegx -d nodegx_community_tut004_s6 \
  -c "select a.slug, b.version, jsonb_object_keys_count from tutorial_bundles b join articles a on a.id=b.article_id" 2>/dev/null \
  || docker exec nodegx-community-db psql -U nodegx -d nodegx_community_tut004_s6 \
       -c "select a.slug, b.title, b.version from tutorial_bundles b join articles a on a.id = b.article_id"
```

⚠️ **Peers hold `nodegx_community_s49` and `nodegx_community_p67b_s49`. Do not drop or claim
either** — one session already dropped a database today believing it free. If you need a fresh one,
make a new name.

To republish after editing the bundle:
`DATABASE_URL=… npx tsx scripts/publish-tutorial-bundle.ts log-a-thing <bundleDir>`

### 2. 🔴 `COMMUNITY_URL` — the hazardous step

[`communityorigin.ts`](../../../packages/noodl-editor/src/editor/src/models/community/communityorigin.ts)
is **one string with one owner** and points at `https://community.nodegx.io`. The drive needs it on
`http://localhost:3000`.

- **Announce it to peers before editing** — this file is on the shared checkout and phase-72 work
  reads it.
- **Revert it before the session ends** and prove the revert: `git diff -- <that file>` empty, and
  the constant back to `https://community.nodegx.io`.
- Session 5's handover recorded a peer leaving this pointed at `localhost:3947`. Do not be the
  second.

### 3. The editor

`/run-editor`, then open the **Community** panel in the rail. The new section is **Tutorials**, and
it sits **above** "Guides and tutorials" deliberately — the section that keeps you in the editor
comes before the one that opens a browser.

## 3. 🔴 Write these down before you drive, then check them

`verify-the-consequence`: a drive can pass on a broken feature if you decide what counts afterwards.

1. The row reads **`Log a thing`**, meta **`Beginner · data lists · 20 min · Install`**.
2. A tutorial **without** a bundle shows **no** `Install` word and does nothing when clicked. (Seed a
   second article with no bundle to have a control — an assertion with no negative case is not one.)
3. One click. The note under the row reads
   **`Installed. Checked as local-ai: F1, F2, F3 passed; F4 not checked.`**
   🔴 **If it says `curated`, stop** — `resolveProvenance` is not being reached and the strict gate
   did not run. That is the single most informative line on the screen.
4. The lesson appears in the launcher's **Learning** section and is **absent** from the Projects
   picker.
5. 🔴 `~/Library/Application Support/NodeGX/Learning/log-a-thing/nodegx.project.json` has an `id`,
   and `project-examples/lessons/log-a-thing/nodegx.project.json` has **none**. Two learners, two
   ids — that is `a86d13a6` doing its job on real disk.
6. `~/Library/Application Support/NodeGX/LearningStaging/` is **empty** afterwards.
7. **AC4, driven:** publish a deliberately-broken bundle under a second slug — the cheapest break is
   to point a `completeWhen` at a node the solution does not have — click it, and read the reason
   with **nothing** in Learning and nothing in staging.
8. **AC7, driven:** stop the Next server, click, and read the sentence. It must blame the network,
   not the tutorial.
9. **No browser opens at any point** (phase 72 P1). Watch for it rather than assuming.

## 4. What this session found that outlives it

- 🔴 **A CHECK constraint passes on NULL.** `jsonb_typeof(payload -> 'files') = 'object'` is *NULL*,
  not false, when `files` is absent — so the gate named after that shape had a hole in exactly the
  place it promised cover, and a *later* constraint caught the row by accident. Found by asserting
  **which constraint fired**, not that one did. Any `jsonb ->` in a CHECK wants an
  `jsonb_exists(...)` guard in front of it.
- 🔴 **A CHECK constraint may not contain a subquery at all** (postgres refuses the DDL), and `?` is
  the node driver's placeholder character. `jsonb_exists()` and `jsonb_path_exists()` are the
  function forms and neither trap applies.
- 🔴 **Four independent gates caught the new route before it was committed** — the NAT-006 contract
  sweep, the D15 visibility inventory, the UNI-005 data census, `uni-001/session-readers`. Adding a
  route to `nodegx-community` means answering all four. None of them can be satisfied by a made-up
  id: three of them explicitly refuse, because a 404 passes every assertion without exercising
  anything.
- ⚠️ **`apisurfaces.isoOf` is now exported.** A `timestamptz` arrives as a `Date` on a cold pool and
  a **raw string** on a warm one — NAT-006 recorded it, and this session hit it again in a route
  whose TypeScript said `Date`. Never `.toISOString()` on a column.
- ⚠️ **A one-off script that calls an `/api/v1` route handler will hang**, because `apiviewer`
  caches a pool nothing external can close. End it with `process.exit(0)`.

## 5. Housekeeping

- 🔴 Peers commit to `cline-dev` from this same checkout and did so during this session.
  **`git commit -- <pathspecs>`, never `git add -A`, never stash.** Untracked files need
  `git add <paths> && git commit -- <paths>` as **one chain**.
- The `nodegx-community` work is on **`main`**, not `cline-dev`.
- Nothing is running from this session: no editor, no Next server, no test process. The database
  container `nodegx-community-db` is shared and was already up.
- **After the drive, this phase closes.** TUT-001, 002 and 003 are done; TUT-004 is the last task,
  and the drive is the last thing in it.
