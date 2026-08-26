# Phase 76 — next session

Read `TASKS.md` here first. **Tier 2 closed at s9; SB-013/SB-014 at s10; SB-015 driven at s11,
built at s12 with SB-016; s13 wired the second spawner and drove §6.4.** Both of Richard's
rulings are shipped code with graded specs, and SB-015's last ⬜ is closed. What remains is
**one owed number, one unbuilt fix with a fresh measurement behind it, and four Tier 3 findings
that want a corpus sweep or a ruling.**

Before touching the template, read **SB-007 §3** (why the content is generated) and **§4** (F22).
Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Five things a deployed graph does not do the way the canvas does"** and §**"The endpoint
gate has no defaults tier"**. Before authoring any *browser* component, read **SB-005 §7** and
**SB-006 §7**.

## Where s13 left it (2026-08-27)

**SB-015 is wired for both spawners.** The editor's `ServiceSupervisor` passes `--project-dir`,
so a project picked off the shelf comes up on its own policy. **20 specs / 7 mutants**, split
across the two runners that can each see one half of the chain.

🔴 **F26 — §7 predicted two call sites. There were FOUR** (`provisionBackend`,
`ProjectBackendLifecycle`, the panel's `useLocalBackends`, and `models/lessonbackend`, which
nothing had named). The hole is closed **twice**, because the halves do not cover each other:

- **`projectDir` is a required positional parameter** of `BackendServices/startLocalBackend.ts`,
  so a fifth call site does not compile until its author has decided;
- **a census asserts no renderer module invokes `backend:start` except that module**, because
  the compiler cannot see a call that bypasses the helper.

🆕 **The census reddened when it was written, on prose.** Matching a *quoted* `backend:start`
reads as the tighter instrument and is the looser one — it counts a docblock's backticks and
misses a template literal. It strips block comments and matches the bare string.

🔴 **F27 — §6.4's prediction was wrong in the direction that matters, and driving it is what
found that.** §6.4 predicted *"a site that renders, a nav, and an admin panel whose every write
is refused"*. What a person provisioned into this template actually gets is **the not-found
panel on their own home page**:

| | as provisioned | one secret later (control) |
|---|---|---|
| `claimSite` | **400** | 200 |
| roles held | **`[]`** | `['admin']` |
| every write | **403** | 201/200 |
| `SiteSettings` / `Theme` | **never minted** | present |
| their home page | **"That page could not be found."** | the real site, with a nav |

The refusal is at the **start** of the experience, not the edge — `claimSite` is what mints the
singletons, so there is nothing for the admin panel to point at. **And that screen now has
three pixel-identical causes** (a genuine draft, a policy-refused read, an unclaimable site)
wanting three different fixes, and **the one a person reaches for first is turning the boundary
off**.

⚠️ **The lesson keeps repeating.** That is the **fifth** time this phase a statement in a task
file carried a confident description of a result nobody had measured (SB-013's row count,
SB-016 §4/F25, s11's F24, s13's F26 call-site count, and now §6.4's prediction).
**Re-derive the numbers in a recommendation before building on it.**

## Next work, in order

1. 🔴 **`test:ci` is OWED and s13 could not take it.** Two full attempts, both **timed out at
   900s without reporting results** — the documented shape that exits **1** exactly like a
   clean floor. They reached **2812** and **2711** of 2856 specs, at *different* stopping
   points with **no spec repeated**, so this is **pacing under contention, not a hang**. A
   peer's `vitest` in a different checkout (`nodegx-community`) held the machine for both
   windows, as it did for the whole of s12. 🔴 **Do not raise the timeout** — wait for a
   genuinely solo window. **The bound, stated as a bound and not as a pass**: every changed
   editor module reaches `test:ci` only by *compilation*, which `typecheck:editor` covers
   (exit 0); the editor's own **350 suites / 5776** exercise the changed modules directly
   (32 specs across `sb-007`, `sb-015`, `tut-005` and `tests-main/local-backend`); and
   `prompts/backend.ts`'s only consumer, `noodl-mcp/src/editor-deps.ts`, is not in `test:ci`'s
   graph at all. ⚠️ Read the **summary line**, never `$?` — the floor is
   `Jasmine: 2856 specs, 4 failures (failed)`, all four `AIX-006 style vocabulary` **by name**.
2. 🔴 **Fix the first five minutes (SB-015 §6.4), now that it is measured.** Two candidates,
   neither built: the template's setup page mints and stores the token itself, or provisioning
   seeds `SITE_SETUP_TOKEN` when it applies a policy that references one. 🆕 F27 adds a
   consideration neither had: **whatever is chosen must also account for the screen**, because
   even a correct fix leaves the not-found panel as what an author sees when anything else goes
   wrong. `sb015-first-local-run.test.ts` is the instrument — its two arms already differ in
   exactly the one value a fix would change.
3. **SB-009 / SB-010 / SB-011 / SB-012** — all measured-not-fixed, all needing a corpus sweep
   or a ruling rather than an argument.
4. 🧭 **Richard's, still open**: F8 (does a contact message reach anyone), `Section.kind`'s
   fifth value with no destination, D3 (does SB-003's boundary fix ride 0.2.1).
5. 🧭 **Still the better half of SB-014 §5**: *for every collection a template reads, is there a
   node that creates it?* and its sibling *for every collection a template names, is there a
   rule?* Both are asked of this template; neither is asked of an arbitrary project, and both
   are questions a linter could ask of any.

## Traps that will bite here specifically

- 🔴 **The backend's `typecheck` DOES NOT COVER ITS TESTS.** `tsconfig.json` is
  `include: ["src/**/*"]`, so `npx tsc --noEmit` exits **0** on a test file with a wrong
  argument type. s4 recorded it, s11 hit it, **s13 hit it again** — a `bundleAuthoredComponents`
  call passed component objects where registry keys go, and only ts-jest saw it. **Run the suite.**
- 🔴 **`test:ci`'s timeout and its clean floor are the same exit code and the same `$?`.** The
  only signal is the **summary line**. A run with no summary line is **NOT MEASURED** — never
  report it as a pass or a failure.
- 🔴 **A failing spec that starts a `BackendService` leaks it** (the `stop()` is in the success
  path), so jest cannot exit. **Use `--forceExit` when grading mutants that make service specs
  fail**, and never conclude "hung" from a run whose specs are supposed to be red.
- 🔴 **`python3` buffers stdout** — `python3 -u`, or a killed mutant run loses every result.
- 🔴 **Kill by PID, never by name.** A peer's `vitest` ran throughout s12 and s13.
- 🔴 **A green authoring run means well-formed and nothing else**; **a green REFUSAL means
  nothing either** — read the consequence, not the status code. s10's arm answered the correct
  refusal having just granted the caller admin.
- 🔴 **`Run` is purely ADDITIVE**, and `isEmpty`/`count`/`firstItemId` all answer **pre-fetch**;
  take readiness from `items`.
- 🔴 **An absence in a payload is not a signal** (SB-007's `registeredPages`).
- 🔴 **The artefact and the component sets are two populations.** Edit a component set and
  **regenerate** (`npm run template:site-builder`) or `sb007Template.test.ts` reddens.
  ⚠️ **`site-builder.security.json` is NOT generated** — it is hand-edited, deliberately. Its
  gate is `sb015-project-policy.test.ts`.
- 🔴 **All three component sets are data files** (`sb004Components.ts`, `sb005Components.ts`,
  `sb006Components.ts`). Edit graphs there, never in a spec; **nine** suites now drive them.
- 🔴 **An authored node id is a request, not a handle (F9).** Read a written graph by node
  **type** or **label**; `claimSite` has **two** `NewDbModelProperties`, so resolve by
  `collectionName`.
- **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `createServer` from `src`.
- ⚠️ `npm run template:site-builder` runs `ts-node -T` deliberately — type-checking that
  program takes ts-node past 2 GB.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch/teardown; `test:ci` **alone**.

## Gates, s13

- nodegx-backend **108 suites / 1240** (10 skipped) ✅ EXIT 0 — +1 suite / +14 tests over s12's
  107/1226, which reconciles exactly.
- noodl-editor jest **350 / 5776** ✅ EXIT 0 — +2 suites / +20 tests, also exact.
- `typecheck:editor`, `typecheck:editor-tests`, `typecheck:mcp` and the backend's own `tsc`:
  all exit **0**, run unpiped.
- noodl-mcp **not re-run** — no `noodl-mcp` source moved (s12's 64/773 stands).
- 🔴 **`test:ci` NOT MEASURED** — see item 1. This is the second session running that it has
  been owed, and both times for the same reason.
