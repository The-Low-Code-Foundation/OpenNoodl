# LIB-007 — Publishing the shelf stops being a manual copy

> ✅ **CLOSED 2026-09-11. All five ACs met.** Published from CI — content repo `cf873c1e3`,
> from NodeGX `52578dd78`, [run 34648841604](https://github.com/The-Low-Code-Foundation/NodeGX/actions/runs/34648841604).
> Prefabs 42→46, modules 30→32 **at the served index**; `library:verify-origin --require-published`
> exit 0; the caveat below is deleted from the release notes. What happened, and the two things
> this spec's build notes got wrong, is in [LIB-007-NOTES.md](./LIB-007-NOTES.md) §"What was still
> owed" and in [PROGRESS.md](./PROGRESS.md) §Log.

**0.2.3 shipped six parts nobody can install.** They are authored, gated, rendered, drive-tested
and named in the public release notes — and absent from the origin the editor actually fetches.
The gap is not the work; the work is done. The gap is that publishing is a human copying a folder
between two repositories, and on 2026-09-11 the human was busy shipping a release.

## 1. The person sentence

**A person reads the release notes, opens the Library panel, searches for the part it named, and
installs it.**

## 2. What was measured — 2026-09-11, on the v0.2.3 tag

`npm run library:verify-origin`:

```
prefabs: library/ 46, origin 42, sharing 42 labels
modules: library/ 32, origin 30, sharing 30 labels

  known  [prefabs] unpublished: Advanced Columns
  known  [prefabs] unpublished: Format Date
  known  [prefabs] unpublished: Format Full Name
  known  [prefabs] unpublished: Sanitise Email
  known  [modules] unpublished: Charts
  🔴 NEW [modules] unpublished: Media Recorder
```

Six entries, all shipped in 0.2.3, none reachable. Supporting measurements:

| question | answer | how |
|---|---|---|
| Does the app bundle the library? | **No** — neither `library/` nor `library-dist/` | `build.files` + `build.extraResources` in `packages/noodl-editor/package.json` |
| Where does the picker fetch from? | `https://the-low-code-foundation.github.io/nodegx-content/static` | `getContentEndpoint.ts` |
| Is that origin healthy? | **Yes, HTTP 200** on `/library/prefabs/index.json` | `curl` |
| Is `library-dist/` in git? | **No** — gitignored, 0 tracked files | `.gitignore:219`, `git ls-files library-dist` |
| What publishes it? | **A person, by hand** | `library/README.md` §Publish |
| When last? | **2026-09-05**, content repo `02ad8a6` | [PROGRESS.md](PROGRESS.md) §Log |

So the publish path is: `npm run library:build` → `library-dist/{prefabs,modules}/*` → copy into the
**`nodegx-content`** repo under `static/library/` → push `main` → its legacy Pages build serves the
repo tree verbatim.

🔴 **The release notes currently carry a caveat that is the exact opposite of this task's
deliverable** — *"searching the library for them today finds nothing"*. Closing this task means
deleting that sentence from the notes and from the published changelog.

## 3. Why it went unnoticed, which is the part worth fixing

The gate did not fail. `origin-baseline.json` records the divergence **as measured**, so a known
gap prints `known` and the run still goes red — but a red that has been red for days reads as
furniture. Five of the six were `known`; only `Media Recorder` printed `🔴 NEW`.

**A baseline that records "not published yet" cannot also be the thing that tells you to publish.**
It was built to catch *drift* (CN-016 / D21) and it does that correctly. Nothing owns the question
*"is everything we authored actually reachable?"* on the day a release is cut.

## 4. Scope

### In scope

1. **A publish that runs from CI**, not from one laptop — `workflow_dispatch` at minimum, so anyone
   with repo access can publish without a local checkout of `nodegx-content`.
2. **The credential**, which is the only genuinely new thing: `GITHUB_TOKEN` **cannot** write to a
   second repository. A fine-grained PAT or GitHub App installation token scoped to
   `nodegx-content` contents-write, and nothing else.
3. **`library:verify-dist` gates the push**, and `library:verify-origin` runs *after* it against
   the served index.
4. **`origin-baseline.json` is updated by the same change that publishes**, or the gate starts
   lying in the other direction.
5. **A dated [PROGRESS.md](PROGRESS.md) §Log entry** naming the content-repo commit, per the
   existing convention.
6. **The one-off that is owed now**: publish the six, then remove the caveat from the v0.2.3
   release notes and the changelog artifact.

### Out of scope

- **Changing `nodegx-content`'s Pages build type.** The `/static` suffix exists because that repo
  runs a *legacy* build; flipping it to Docusaurus is ALPHA-006 B5 and it moves the endpoint. See
  the traps.
- The library schema, the picker UI, and what belongs on the shelf.
- Committing `library-dist/` — considered and rejected in §6.
- `getDocsEndpoint`'s dead origin. Real, shipped, and **separately owned** — see
  [LIB-008](LIB-008-THE-DOCS-ORIGIN-IS-A-404.md).

## 5. Acceptance criteria

**AC1 — The six are fetchable from the live origin.** Asserted by fetching the **served index**,
not by reading this repo and not by trusting the gate's own summary:
`curl $(endpoint)/library/prefabs/index.json` lists Advanced Columns, Format Date, Format Full Name
and Sanitise Email; the modules index lists Charts and Media Recorder.

**AC2 — `library:verify-origin` exits 0 with an EMPTY `unpublished` list**, and
`origin-baseline.json` records that emptiness rather than the current six.

**AC3 — Someone who is not Richard can publish.** Proved by *running* the workflow, not by reading
it: a `workflow_dispatch` from this repo lands a change in `nodegx-content` with no local checkout
of that repo anywhere in the loop.

**AC4 — A broken build cannot be published.** Arm a deliberately invalid entry, run the publish,
and watch `library:verify-dist` refuse before anything is pushed. 🔴 **A gate that has never
failed has not been tested** — assert the refusal, not the success.

**AC5 — The public claim becomes true.** The "not on the shelf yet" caveat is gone from the v0.2.3
release notes *and* the changelog artifact, and PROGRESS.md carries the dated entry.

## 6. Traps

- 🔴 **`GITHUB_TOKEN` cannot write cross-repo.** This is the whole reason the step is manual today.
  Anything that looks like it works with the default token is writing to the wrong place.
- 🔴 **The `/static` suffix is load-bearing and fragile.** `nodegx-content` currently publishes via
  a **legacy** Pages build (`build_type: legacy`, source `main:/`), which serves the repo tree
  verbatim — so the payloads sit one level down, exactly where they sit in the repo. If that repo's
  `pages.yaml` ever runs it flips back to a Docusaurus build, `static/**` flattens to the site root,
  and the suffix must come **off** `getContentEndpoint.ts`. **A publish workflow must not trigger
  that workflow.** The reasoning is already written down in `getContentEndpoint.ts` — read it
  before touching either side.
- 🔴 **`getContentEndpoint` is not `getDocsEndpoint`.** Two functions, two origins, deliberately
  split on 2026-08-13 so they could move independently — and they have. Measuring the wrong one
  will tell you the library is down when it is fine, or fine when it is down.
- 🔴 **A red baseline is not a reminder.** Whatever ships here must answer *"is everything we
  authored reachable?"* at release time, not merely *"has the divergence changed?"*. Those are
  different questions and only the second one has an owner today.
- ⚠️ **Do not commit `library-dist/`.** It makes the publish a plain file copy, which is tempting.
  It also puts generated output into every review diff and invites hand-edits of a generated tree —
  the failure mode already registered as **P36** (a regenerate is an unperformed merge). Build it
  in CI.
- ⚠️ **`verify-origin` touches the network.** It distinguishes `UNAVAILABLE` from divergence on
  purpose, and it self-tests that a dead endpoint raises rather than resolving to an empty index.
  Keep that distinction: "the origin is down" and "the content is missing" must not print the same.
- ⚠️ **Publishing is not the same as being installable.** AC1 fetches the index; a part that is in
  the index and still fails to install is a different bug. The behavioural drives
  (`library:drive`) are what grade that, and they run against `library/`, not the origin.
