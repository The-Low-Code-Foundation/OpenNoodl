# WF-003 — One Managed Deploy Target, Done Well: implementation notes

**Status:** Complete. **Branch:** `task/wf-003-managed-deploy`.
**Date:** 2026-07-26.

---

## 1. The target decision

**Docker Compose self-hosting.** This is the spec's own default candidate, and
after working the criteria it is also the right answer — but the reasoning below
is the record, not the note in the spec.

### Against the spec's three criteria

**"Where do actual users want to deploy?"** No pilot-user or community evidence
exists in the repository, so this criterion cannot be decided on evidence and I
did not pretend otherwise. What the repository does contain is a decision that
has already been made about *who the product serves*: phase 17's education
emphasis, and the backend-gap re-scope that produced a standalone service
explicitly framed as deployable to "a school server or a small VPS". Absent user
evidence, deferring to the audience the rest of the roadmap commits to is the
defensible move.

**Self-host versus managed.** Decisive, and the code decides it. Two facts:

- The backend is SQLite on a local filesystem (`node:sqlite`, `<dataDir>/data/local.db`).
  Every managed platform worth naming is either ephemeral-filesystem (Fly.io
  machines without volumes, Railway, Render's free tier) or turns this into a
  paid volume with its own backup story. BAK-007's whole backup/restore/promotion
  design assumes a directory you own. Putting SQLite on a managed platform means
  fighting the platform.
- The education wedge's data-residency constraint — school data that may not
  leave the premises — is not a preference a managed target can accommodate.
  It is a hard exclusion.

**Cost and friction for a beginner.** Every managed target requires an account,
and all but the smallest require a card before anything runs. For a
learning-oriented product this is not a minor tax; it is the first screen a
teacher hits and the one that ends the evaluation.

### What I looked for that would have overturned it

I went looking for a reason to argue against the note, because the brief asked
for evidence rather than compliance. Three candidates, all rejected:

- **"Managed is less work for the user."** It would be, if the backend were
  stateless. It is not, and the state is a file.
- **"Phase 20's ECO-004 hosted platform makes managed the strategic direction."**
  ECO-004 is explicitly out of scope here, and this task's own risk table names
  "scope drifts toward hosting as a product" as the failure mode.
- **"Code export (Phase 18) is the general answer, so this target barely
  matters."** This one nearly landed — until I checked. **Phase 18 is 0/5, not
  started**, and its phase-7 predecessor is 0/8. The export escape hatch that
  the spec leans on *does not exist yet*. That makes this target more important
  than the spec assumed, not less: it is currently the only supported way to
  deploy a NodeGX application at all. I have documented code export honestly as
  a roadmap item rather than pointing users at something they cannot use.

### What was deliberately not built

No second provider. No Fly/Railway/Render templates, no Kubernetes manifests, no
PWA/Capacitor/Electron targets. `docs/runtime/SELF-HOSTING.md` closes with a
concrete "other hosting" section — the app is a static folder and the backend is
one file that runs under `node cli.js serve` — which serves the general case
without implying support.

---

## 2. Design decisions

### 2.1 One origin, and why it is load-bearing

The stack is nginx serving the app and forwarding the backend's route families
on **one port**. The alternative (app on 8080, API on 8577, CORS between them)
was rejected on a specific finding:

> A NodeGX application does not discover its backend at runtime. The editor
> writes `metadata.cloudservices` into `window.projectData` inside the hashed
> `index-<hash>.js` at "Deploy to folder" time, and there is **no post-deploy
> override** — no config file, no bootstrap fetch, no environment variable.

So the endpoint is a value chosen in the editor, frozen at export, and wrong
forever if wrong once. Every additional URL in the deployment is another way for
it to be wrong. One origin means the correct answer is a single value the
operator already knows — the site's own address — and it also collapses CORS,
firewall rules and TLS termination to one of each. For the school-server case
that is the difference between a deploy and a ticket.

`/_admin` forced this too: the dashboard's client calls absolute root paths
(`/admin/schema`, `/api/_User`), so the backend must be at the origin root. It
cannot be mounted under a prefix without editing BAK-005's UI, which is not my
territory and would be the wrong fix anyway.

**Cost:** nginx must enumerate the backend's top-level path families (18 of
them). That is drift-prone, so it is not maintained by vigilance —
`tests/deploy-assets.test.ts` starts a real `BackendService`, reads
`getRouteTable()`, and fails with an actionable message naming the missing
segments. A task that adds a route family gets a red test, not a production 404.

**Consequence documented for users:** those 18 names are reserved and an app
cannot use them for its own files or routes. Listed in SELF-HOSTING.md.

### 2.2 The image is built from a packaged artifact, not from source

`Dockerfile.backend` has no build stage. Building the bundle inside the image
would drag the whole monorepo and ~1,300 hoisted packages into the build context
to run one 50 ms esbuild, and the result would still be whatever npm resolved
that morning. Packaging outside gives a 1.5 MB single-file input, a build id
derived from the artifact's own content digest, and one artifact that serves both
the container deploy and a plain `scp` to a VPS.

Determinism is real and was checked: two consecutive packaging runs over
unchanged sources produced the identical digest
(`a73e4cbbeaad092f…`). `createdAt` is recorded in the manifest but deliberately
excluded from the digest, so the id does not move because the clock did.

The base images are pinned to a minor (`node:22.23-alpine`, `nginx:1.29-alpine`)
rather than a floating major. Not pinned by digest — see residuals.

### 2.3 Rollback is retagging, and it is tested

Images are tagged with the build id. `nodegx-deploy.sh` records the outgoing tag
before the new one takes over, so a rollback target exists even if the operator
never ran `versions`. `rollback` refuses a tag whose images are not on the
machine — the failure being avoided is a `compose up` during an incident that
pulls nothing, finds nothing, and leaves the stack down. Rolling back pushes the
version being left onto the history, so rolling forward is the same command.

It rolls back **code, not data**, and says so in its own output and in the docs,
pointing at BAK-007 for the data half. I did not reinvent BAK-007: backups,
restore, and dev→prod schema promotion are referenced, not reimplemented.

### 2.4 Secrets

Three tiers, documented in increasing order of care: auto-minted (written to the
volume, mode 0600), `NODEGX_ADMIN_TOKEN` in `.env`, and
`NODEGX_ADMIN_TOKEN_FILE` reading a Compose secret. The `_FILE` form is the one
recommended for anything shared, because the value then never enters `.env`, an
image layer, or `docker inspect`.

**Honest limitation, documented:** the entrypoint passes the credential to the
CLI as `--token`, so it is visible in the container's process arguments even
with the `_FILE` form. I considered having the entrypoint merge the value into
`secrets.json` directly to avoid argv entirely, and rejected it: that duplicates
the SecretsStore whole-file read-modify-write convention outside the module that
owns it, which is exactly the kind of second implementation that drifts and
eats another subsystem's namespace.

"No credentials in artifacts" is **verified, not asserted**:
`scripts/package-deploy.js` scans every byte of the staged tree and fails the
build on a hit. Ten patterns matching credential *values* (private keys, cloud
API key shapes, JWTs, serialised admin tokens, connection strings with
passwords) plus forbidden machine-local files (`secrets.json`, `.env`, `*.db`,
`*.pem`, …). The patterns are deliberately high-confidence: this scans a 1.5 MB
bundle containing an SMTP client and a great deal of the word "token", and a
scanner that cries wolf is a scanner someone turns off. There is a test that
plants real-shaped secrets and confirms they are caught, and another that
confirms the vocabulary of the real bundle does not trip it.

### 2.5 The dev-open interlock

The brief asked me to find BAK-003's interlock and make sure the deploy path
cannot silently ship a wide-open backend. It cannot — and I confirmed the
refusal in a container (exit code 1, no port bound).

But the interlock had a first-run ergonomics problem that only shows up here:
`defaultSecurityConfig()` ships `devOpen: true`, and `SecurityState` writes that
default **before** the interlock check. So an unprovisioned first run on a
container (which always binds `0.0.0.0`) would write the dev default and then
immediately refuse to start, greeting the operator with a hard error about a
file they had never heard of.

Fix: `entrypoint.sh` writes `security.production.json` (the shipped default with
`devOpen: false`) when — and only when — `security.json` is absent. An existing
policy is the operator's and is never modified; if it carries `devOpen: true`
from a promoted development directory, the entrypoint explains *that specific
cause* before the interlock fires, because "your data dir came from your laptop"
is not something the interlock's own message can know.

I did not add an escape hatch. There is no `NODEGX_ALLOW_DEV_OPEN`.

---

## 3. The defect this task found and fixed

**The admin credential of every deployed backend rotated on every restart.**

Found empirically: brought the stack up, read the minted credential from
`/data/secrets.json`, restarted the container, and got a different credential.
With `restart: unless-stopped`, that means the admin dashboard's password
silently changes on every reboot — a deployed backend nobody can administer, and
BAK-005's dashboard effectively unusable in the deployment it was built for.

Cause: `resolveOptions()` minted an `authToken` whenever the bind was
non-loopback — a WF-004-era safety net against exposing an unauthenticated
service. BAK-003 superseded that blanket bearer wall with the security model and
made `SecurityState` the sole owner of the admin credential. `SecurityState`
reads a non-null token as *"the operator chose this"* and writes it over the
stored one, so a fresh random value on every start:

1. rotated the stored credential, and
2. took the `deps.cliToken` branch, which suppressed the
   `adminTokenMintedThisStart` flag — so the "FIRST RUN: here is where to find
   your credential" message never printed, precisely in the deploy case that
   needs it.

Fix: `resolveOptions()` no longer mints. A null token means "I am not choosing
one", which `SecurityState` already answers correctly and durably.

`tests/config.test.ts` asserted the old behaviour and now asserts the new one,
with the history in a comment. The property that matters is compositional —
options resolution, then `SecurityState`'s branch, then the file on disk — and
a test of either half passed while the product was broken, so
`tests/deploy-credential-stability.test.ts` pins it end to end (mint on first
start, reuse on restart, an operator's `--token` never overwritten by a later
tokenless start, and the interlock's refusal).

**Files touched outside my declared territory:** `src/config.ts` and
`tests/config.test.ts`. Neither is BAK-006 (files/storage) or BAK-008
(search/query-grammar) territory, so merge risk is low, but it is disclosed.

---

## 4. What was verified, and how

Docker 27.3.1 / Docker Desktop 4.35 was available in the sandbox, so the
container-level claims below are **run, not asserted**.

### Automated (in CI, from this worktree)

| Gate | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | Clean |
| `npx jest` (full suite) | **40 suites / 376 tests, all passing** (baseline before this task: 38 / 351) |

New tests: `tests/deploy-assets.test.ts` (21) and
`tests/deploy-credential-stability.test.ts` (4).

### Manual container runs

| What | How | Result |
|---|---|---|
| Artifact determinism | Two packaging runs, unchanged sources | Identical digest `a73e4cbbeaad…` |
| `node:sqlite` on the base image | `docker run node:22-alpine` opening a DB | OK (Node 22.23.1) |
| Image build | `docker compose build` | Both images build |
| Stack up | `docker compose up -d` | Backend healthy, then web starts |
| Health through the proxy | `GET /health` | 200, `devOpen:false`, `enforced:true`, `persistent` |
| Admin dashboard | `GET /_admin` | 200, 75 KB, CSP + nonce intact |
| Admin credential | `GET /_admin/whoami` with bearer | 200, `readonly:false`, all 12 features |
| Unauthenticated admin route | `GET /admin/schema` | 401 |
| App serving | `GET /` | Serves `index.html` |
| SPA deep link | `GET /dashboard/settings` | Falls back to `index.html` |
| Cache policy | Headers on hashed asset vs `index.html` | `immutable` / `no-store` |
| Write + read data | `POST /admin/schema`, `POST /api/Notes`, `GET /api/Notes` | Created and read back |
| Persistence | Full `down` then `up` | Record still present |
| Credential stability | Restart, recreate, full down/up | Same credential throughout |
| First-run mint | Fresh volume | `FIRST RUN:` hint printed with the file path |
| Secrets file | `NODEGX_ADMIN_TOKEN_FILE` + mounted secret | Stored verbatim, trailing newline stripped |
| **Dev-open interlock** | Data dir with `devOpen:true`, bind `0.0.0.0` | Refused to start, **exit code 1**, entrypoint explanation printed first |
| **Redeploy** | Changed app, `./nodegx-deploy.sh deploy` | New build id, new content live |
| **Rollback** | `./nodegx-deploy.sh rollback` | Previous app live again, **data intact** |
| **Roll forward** | `./nodegx-deploy.sh rollback <newer-id>` | Newer app live again |
| No secrets in the image | `docker run` + `ls /app`, `find / -name secrets.json -o -name .env`, grep for the live credential | Three files in `/app`, `/data` empty, no matches |

Two defects were found by these runs and fixed: nginx answered `403 Forbidden`
at `/` for a backend-only deploy (a `$uri/` in `try_files` resolving to a
directory with autoindex off), and `package-deploy.js` packaged a stale bundle
because `build.js` returns before its async esbuild finishes.

---

## 5. Residuals — what I could not or did not verify

Listed honestly; several need the orchestrator or a human.

1. **No real editor export was ever deployed.** `lerna exec` runs the main
   checkout rather than this worktree, so I could not drive the editor to produce
   a genuine "Deploy to folder" output. Every app-serving check above used a
   hand-built fixture shaped like the real thing (`index.html`, a hashed
   `index-<hash>.js` carrying `window.projectData` with `metadata.cloudservices`,
   `noodl.deploy.js`, `noodl_bundles/`). The nginx rules were verified against
   that shape, not against real editor output. **This is the single most
   important post-merge check:** export a real project and deploy it.
2. **No NodeGX app has actually talked to the deployed backend from a browser.**
   The API was exercised with `curl`. The end-to-end claim "a real project
   deploys successfully following the documentation alone" — the spec's headline
   success criterion — is therefore **not** proven. It needs a real export, a
   browser, and someone who did not write this.
3. **Realtime (SSE) through the proxy is untested.** The nginx location has the
   right directives (`proxy_buffering off`, `Connection ''`, 24h read timeout)
   and a test asserts they are present, but no SSE stream has been opened through
   nginx. Given BAK-001's own residual is a live two-browser test, these should be
   done together.
4. **File upload through the proxy is untested**, including whether
   `client_max_body_size 64m` is the right number. BAK-006 is changing file
   storage concurrently; worth a joint check after both merge.
5. **Workflow and trigger deployment is inherited, not separately exercised.**
   Workflows load from `<dataDir>/workflows/` and the container reported
   "workflows: 0 loaded" because the fixture had none. Cron triggers in a
   container with a restart policy (missed-fire behaviour across restarts, WF-005)
   were not tested.
6. **Base images are pinned to a minor, not a digest.** `node:22.23-alpine` can
   still move. Digest pinning would be more honest about "deterministic" but
   makes the file harder to maintain; deferred as a deliberate choice.
7. **Multi-architecture images were not considered.** Everything was built and
   run on `linux/arm64` (Apple Silicon). A school server is very likely `amd64`.
   The Dockerfiles contain nothing architecture-specific and the base images are
   multi-arch, so this should just work — but "should" is the operative word, and
   `docker buildx` cross-building is not set up.
8. **`docs/runtime/SELF-HOSTING.md` has not been followed by anyone but its
   author.** The spec asks for a clean-machine deploy following only the
   documentation. My verification used the same commands the doc gives, but I
   knew the answers; that is exactly the bias the criterion exists to catch.
9. **No CHANGELOG-driven release or signed build** was produced; out of scope,
   but WF-003 is phase 22's exit-criterion dependency ("an app deployed by
   WF-003's path"), so that consumer still needs residuals 1 and 2 closed.
10. **The editor has no "deploy to my server" button.** The spec allowed
    "editor-integrated if practical, otherwise a documented procedure with a
    script"; I took the script. Editor integration would need live editor
    verification, which a worktree cannot do.

---

## 6. Traps worth remembering

- **`resolveOptions` minting a token is not a safety net any more, it is a
  liability.** Any future "helpfully fill in a credential" default needs to ask
  whether a downstream owner will read it as an explicit choice.
- **`build.js` is fire-and-forget.** It starts an async esbuild and returns.
  Anything that needs the bundle must spawn it, not `require` it.
- **nginx `try_files $uri $uri/ /index.html` gives 403, not 404, when the root
  is empty** — autoindex is off, and `error_page 404` never fires. Drop `$uri/`.
- **The admin dashboard calls absolute root paths.** It cannot be served under a
  path prefix without changing BAK-005's UI.
- **`COPY emptydir/ dest/` is an error in Docker**, not a no-op; packaging writes
  an `app/.keep` so a backend-only artifact still builds.
- **A `_FILE` secret written with `echo` carries a trailing newline**, and a
  credential with a newline fails authentication in a way that looks exactly
  like a wrong credential. The entrypoint strips it.
- **This worktree had no `node_modules` at all.** They were symlinked from the
  main checkout to run any gate. They are untracked and *not* gitignored at the
  repo root, so every commit here used explicit pathspecs — an `add -A` would
  have committed two symlinks, which is a mistake this repo has already made once
  (`423d9e9`).
