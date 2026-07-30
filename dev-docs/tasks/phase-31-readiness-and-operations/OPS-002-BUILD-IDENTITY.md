# OPS-002: Build Identity & Deploy Verification

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-002 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 1 — the frame |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium — small surface, but it must be right in the cases where everything looks fine |
| **Estimated Time** | 4–6 days |
| **Prerequisites** | none hard. DEP-001 (un-frozen endpoint) and DEP-008 (artifact contents) make it cleaner |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — the engineering is modest; the diagnosis of what can silently differ is not |

## Objective

Every artifact NodeGX produces carries an identity, serves it, and the editor compares what it built
against what is answering at the URL. The deploy surface is **red until they match**, and it never
reports success from the absence of an error.

## Background

The [deploy-verification chapter](../../../../ai-coding-docs/docs/part-5/deploy-verification.md) opens
with the failure nobody instruments for:

> "The most dangerous deploy failure isn't a crash — it's when everything looks green but old code is
> still running. Health checks pass, the CI says ✅, Docker says 'Started' — and your changes aren't
> live."

It then lists nine mechanisms (FM-1…FM-10, numbered out of order). Read them as a set and the shared
cause is structural rather than technical: **the thing that built the code and the thing that deployed
it are different systems that cannot compare notes.** Docker cannot know the image does not contain
your commit. The health endpoint cannot know it is answering from a bind-mount. The AI sees "Started"
and reports success because that is genuinely all the signal there is.

In NodeGX the builder and the deployer are the same process. The verification the guide has to bolt on
with a Dockerfile `ARG`, a GitHub Actions `build-args` block, a `/api/build-info` route and a
`.clinerules` rule is, here, **one field written at export and one fetch after publish.**

WF-003 already computes content-digest build ids for the managed-deploy target. This task generalises
that to every artifact and closes the loop back to the editor.

## Current State

| Piece | State |
|---|---|
| Content-digest build ids | exist, WF-003, managed deploy only |
| Folder export | `views/DeployPopup/tabs/` — writes a frontend folder, no identity |
| Backend health | `GET /health`, public, `HttpServer.ts:413` — reports liveness, not identity |
| `metadata.cloudservices` | inlined into `index.js` at export (`{{#export#}}`); DEP-001 un-freezes it |
| The editor after a deploy | knows nothing. There is no read-back of any kind |

## Desired State

### 1. Every artifact carries an identity

Written at export time into every artifact NodeGX produces — folder, static-host upload, local
full-stack bundle, managed deploy:

| Field | Source |
|---|---|
| `buildId` | content digest of the artifact (WF-003's, generalised) |
| `builtAt` | export timestamp |
| `projectId`, `projectName` | project metadata |
| `nodegxVersion` | the editor that produced it |
| `target` | `folder` \| `netlify` \| `cloudflare` \| `local-fullstack` \| `ssh` \| `managed` |
| `level` | the OPS-001 declared level at build time |
| `acknowledgements` | any unmet readiness items acknowledged at deploy (OPS-001 §5) |

`level` and `acknowledgements` are on the artifact deliberately: six weeks later, "was this thing
shipped knowingly or accidentally?" is answerable from the artifact itself.

### 2. It is served

A `/__nodegx/build-info` route returning the identity as JSON, present in every deployment shape:

- **Frontend-only / static host** — a `__nodegx/build-info.json` file beside `index.html`. No server
  required, works on Netlify and Cloudflare Pages unchanged.
- **Local full-stack and SSH** — served by the bundled Node process (DEP-002/DEP-005).
- **Managed** — behind the single nginx origin WF-003 established.

Public and unauthenticated, like `/health`. It contains no secrets by construction — assert that in a
test, because it is exactly the endpoint a future task will be tempted to enrich.

### 3. The editor verifies, and refuses to guess

After any publish that has a reachable URL, the editor fetches the identity and compares `buildId`
against what it just built. Four outcomes, all distinct in the UI:

| Outcome | Meaning | Shown as |
|---|---|---|
| match | live code is the code you built | ✅ with the digest and the time |
| mismatch | something older is answering | ❌ **naming both digests and when the live one was built** |
| absent | route 404s | ⚠️ "this deployment predates build identity — redeploy to enable verification" |
| unreachable | network/DNS/TLS | ⚠️ **not** a failure of the deploy; say which it was |

The mismatch case must name the age of the live build. "You are looking at a build from four days ago"
is the sentence that ends the debugging session.

### 4. It is a readiness item

Registers `ops.build-identity` at **Sharing**. `met` evidence is the last successful verification with
its digest and timestamp — so the readiness panel doubles as "when did I last prove this."

### 5. The deploy surface never reports success without it

The rule from the guide's `.clinerules` template, made structural rather than advisory:

> **Never declare "deploy is done" without verification output.**

Where a target has a reachable URL, the deploy popup shows *Publishing → Verifying → Verified*, and the
terminal state is never "Done" on the strength of an upload having not errored. Where a target has no
reachable URL (a folder on disk), it says exactly that: *"Written to disk. Nothing verified — NodeGX
cannot see where this ends up."*

### 6. The AI cannot claim it either

`deploy_verify` MCP tool returning the four-way outcome. The editor's own AI surfaces (AIX-002) must
call it rather than reading the deploy log, for the same reason the guide's rules exist: the log is
what lies.

## Implementation Steps

1. Generalise WF-003's digest computation to a single `buildIdentity(artifact)` used by every target.
2. Emit the identity into the artifact for each of the five shapes; static-host case is a file, not a
   route.
3. Serve it from the bundled Node process and behind the managed nginx origin.
4. Editor-side verification with the four-way outcome and the age sentence.
5. Register the readiness item.
6. Rework the deploy popup's terminal states so "Done" is unreachable without verification or an
   explicit "cannot verify" reason.
7. `deploy_verify` MCP tool.
8. **Live pass**: deploy, verify green. Then deploy a change, block the upload (rename the artifact
   mid-flight or point at a stale directory), and confirm the mismatch case fires with both digests and
   the age. A verification path that has never been shown a genuine mismatch is not tested.

## Success Criteria

- [ ] All five target shapes emit an identity; a test asserts the payload contains no secret material.
- [ ] `/__nodegx/build-info` (or the static file) resolves in each shape.
- [ ] All four outcomes are reachable and visually distinct; **the mismatch case has been produced for
      real**, not simulated in a unit test.
- [ ] The mismatch message names both digests and the live build's age.
- [ ] "Unreachable" is never rendered as "deploy failed."
- [ ] A folder export explicitly states that nothing was verified.
- [ ] The readiness item shows the last verification as evidence.
- [ ] `deploy_verify` returns the same four outcomes.

## Out of Scope

- **Rollback.** WF-003 has a tested rollback; this task tells you that you need one.
- **CI pre-flight checks.** The guide's `gh run list` pre-flight exists because a third-party CI builds
  the image. NodeGX builds it. If a user has wired their own CI, that is their pipeline.
- **Docker-specific failure modes.** FM-3 (`--force-recreate`), FM-4 (bind mounts), FM-5 (init
  containers) belong to WF-003's deploy script, which already force-recreates. Do not import the
  chapter's Docker advice into targets that have no Docker.
- **Browser cache (FM-6).** Content-hashed asset names are the fix and the exporter already does it;
  confirm and record, do not rebuild.

## Traps

- **A public endpoint is a temptation.** `/__nodegx/build-info` will attract "and the backend URL" and
  "and the module list" and eventually something that should not be public. Write the no-secrets test
  in the same commit as the endpoint, not after.
- **The static-host case has no server.** Netlify and Cloudflare Pages serve files. A route-shaped
  design that works everywhere else will fail exactly on the two targets DEP-003 is adding.
- **`metadata.cloudservices` is inlined at export today** and DEP-001 changes that. If DEP-001 has not
  landed, the identity is still correct — but do not build the identity *out of* the frozen endpoint,
  or DEP-001 will invalidate it.
- **The absent case will be the common one for weeks.** Every project deployed before this task ships
  404s. The message must read as "old deployment", never as an error, or the first week is a support
  queue.
- **Do not verify by fetching `index.html` and diffing it.** It is tempting, it appears to work, and it
  breaks on the first CDN that rewrites markup.
- **A CDN can serve a stale `build-info` while serving fresh assets, and vice versa.** Send
  `Cache-Control: no-store` on the identity, and when a mismatch is reported, say that a CDN edge is
  one of the possible causes rather than asserting the deploy failed.
</content>
