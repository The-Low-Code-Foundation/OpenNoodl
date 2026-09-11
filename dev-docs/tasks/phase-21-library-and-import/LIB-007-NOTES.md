# LIB-007 — build notes

**Built:** 2026-09-11, on `cline-dev` from `096524400`. PR [#44](https://github.com/The-Low-Code-Foundation/NodeGX/pull/44).
**Spec:** [LIB-007-PUBLISHING-THE-SHELF.md](./LIB-007-PUBLISHING-THE-SHELF.md)

**Status: the machinery is built and nothing is published yet.** Two things have to
happen first, and neither can happen from a session — §"What is still owed" below.

---

## The measurement still stood

Re-measured before building anything, because a spec's own numbers are a claim
about the day it was written:

```
prefabs: library/ 46, origin 42, sharing 42 labels
modules: library/ 32, origin 30, sharing 30 labels
  known  [prefabs] Advanced Columns · Format Date · Format Full Name · Sanitise Email
  known  [modules] Charts
  🔴 NEW [modules] Media Recorder
```

Unchanged. Six entries, all shipped in 0.2.3, none reachable.

---

## The finding that shaped the design

**§3 of the spec is right, and it is the half worth having.** The gate did not
fail to notice — `library:verify-origin` compares the origin against
`origin-baseline.json` and answers *"has the divergence CHANGED?"*. That is
D21's question and it answers it correctly. Five of the six were written down in
the baseline, so they printed `known`, and the run had been red for days, which
is the state in which a red run reads as furniture.

A baseline that records "not published yet" cannot also be the thing that tells
you to publish. So the second question got its own instrument rather than being
bolted onto the first:

- `library:verify-origin --require-published` **does not consult the baseline at
  all.** Any entry under `library/` with no published counterpart fails.
- Orphans are reported and deliberately **not** gated. A published entry with no
  source is untidy, not unreachable. Gating both is how the first question ate
  the second in the first place.
- It runs where the claim is made: after the push in the publish workflow, and
  on a version tag in `release.yml`.

The release job carries **no `needs:`** on the packaging matrix on purpose — it
answers in a minute instead of ninety, so it can never be the reason an urgent
fix does not ship. What it does is make the release run red beside a draft a
human still has to press publish on.

---

## 🔴 `nodegx-content`'s Pages workflow is worse than the trap says

The spec's trap reads *"if that repo's `pages.yaml` ever runs it flips back to a
Docusaurus build"*. Measured:

| | |
|---|---|
| `pages.yaml` state | **active**, `on: push` to `main` |
| Runs on the last three publishes | **all three ran**, all three **failed** |
| Failing step | `npm run build` |
| Last successful run | **2025-12-06** |
| Pages config today | `build_type: legacy`, source `main:/` — so `/static` still resolves |

**It already runs on every publish. Its failure is the only thing preserving the
`/static` suffix in `getContentEndpoint.ts`.** If anyone ever fixes that
Docusaurus build, the next publish — manual or from CI — flattens `static/**` to
the site root and 404s every URL the editor constructs.

No cross-repo credential can suppress another repo's `on: push` trigger, so the
workflow does not try to dodge it. Instead the reachability assertion fetches the
**served** index through `getContentEndpoint()` itself, so a flip surfaces as an
UNAVAILABLE origin and a red publish rather than a silent success. The trap is
armed, not avoided.

A deliberate flip is still ALPHA-006 B5's, and it moves the suffix in
`getContentEndpoint.ts` in the same change.

---

## The credential — a deploy key, not the PAT §4.2 named

§4.2 asked for *"a fine-grained PAT or GitHub App installation token scoped to
`nodegx-content` contents-write, and nothing else."* What landed is a **write
deploy key**, which meets that sentence more strictly than either named option:

- bound to `nodegx-content` by construction — it cannot address another repo at
  all, where a PAT is scoped by a setting someone chose and can widen;
- **not bound to a person**, so it does not leave when they do;
- **no expiry**, so the publish does not silently stop working in six months —
  the specific way a PAT-based publish rots;
- creatable and revocable from the CLI, so rotation is three commands rather
  than a browser session.

Setup and rotation are written up in
[RELEASE-PROCESS.md §1e](../../guidelines/RELEASE-PROCESS.md).

---

## What was measured rather than asserted

| Claim | How |
|---|---|
| The new gate fires on the real defect | `--require-published` names all six and exits 1, run **before** anything was changed. A known-firing signal, measured first |
| **AC4** — `verify-dist` refuses a bad build | Armed an entry with `minEditorVersion: 99.0.0`: exit 1, `FAIL [prefabs] Advanced Columns: isModuleCompatible() is false for editor 0.2.3`. A gate that has never failed has not been tested |
| The artefact is clean today | `library:build` 46 + 32 entries, `library:verify-dist` exit 0, 0 problems |
| Blast radius of the publish | Read-only clone + `diff -rq`: **12 new files** (the six parts + their icons) and the two `index.json`. Nothing else |
| `--delete` would be wrong | `static/library/` also holds `examples/` and `prefab-contributions/`, and 56 published files carry legacy pre-LIB-001 names no `library/` entry generates. Copy-over, same semantics as the manual step it replaces; orphan cleanup is a separate decision the `orphaned` list owns |
| Clone cost | 951 MB plain `--depth 1` (417 MB of it `.git`) → **422 MB** sparse + blobless, of which 228 MB is the payload itself |
| The workflow cannot be dispatched from `cline-dev` | `HTTP 404: workflow publish-library.yml not found on the default branch`. `workflow_dispatch` registers only from the default branch |

---

## What is still owed

**AC1, AC2, AC3 and AC5 are not met, and cannot be met from a session.** In order:

1. **Merge PR #44.** Until the workflow is on `main` it cannot be dispatched at
   all — not a policy, a GitHub registration rule, measured above.
2. **Create `NODEGX_CONTENT_DEPLOY_KEY`** — three commands, RELEASE-PROCESS.md §1e.
3. **Run `Publish library`.** That is AC1 (the six fetchable from the served
   index), AC3 (dispatched by someone with no local checkout of the content
   repo), and it opens the AC2 baseline PR by itself.
4. **Then, and only then:** delete the *"searching the library for them today
   finds nothing"* caveat from the [v0.2.3 release
   notes](https://github.com/The-Low-Code-Foundation/NodeGX/releases/tag/v0.2.3),
   and add the dated PROGRESS.md §Log entry naming the content-repo commit.
   That is AC5.

The caveat is still in the release notes because it is still **true**. It comes
out when step 3 makes it false, not before.

### One adjacent hazard, not LIB-007's

`library/prefabs/form-fields/project/project.json` has an **uncommitted** edit in
the shared checkout (phase 78's). The local build turns it into a
`form-fields-1.0.0.zip` whose bytes differ from the published one **under an
unchanged version number** — which `library/README.md` explicitly forbids
("Bump this on any content change"). CI publishes from the committed ref, so the
workflow will not ship it; whoever commits that edit owes the version bump.
