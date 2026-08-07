# DEP-005: Remote Deploy over SSH + the Caddy Target

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEP-005 |
| **Phase** | Phase 26 — Deployment (Track K) |
| **Tier** | 3 — your own machine |
| **Priority** | 🟠 High |
| **Difficulty** | 🔴 High |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | DEP-001, DEP-004; DEP-008 for what goes in the artifact |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — the failure modes are remote, partial, and network-shaped, and the recovery design is the task |

## Objective

Deploy a full-stack NodeGX app to a Linux server the user owns, from the Deploy popup, over SSH —
using the deployment machinery WF-003 already built and tested, with automatic TLS.

## Background

WF-003 built the destination and proved it works: `packages/nodegx-backend/deploy/` has
`nodegx-deploy.sh` with `build`, `up`, `deploy`, `versions`, `rollback`, `status`, `logs` and `down`;
images built from a content-digest artifact so `rollback <id>` names a build rather than a date; a
credential scan that fails the build; a baked-endpoint audit. Deploy → redeploy → rollback →
roll-forward with data intact was **run for real**, not described.

What is missing is the transport. Today the user must find that folder, get it onto a server, and run
the script by hand.

**This task is a transport wrapper, not new deploy logic.** Every temptation to re-implement
build/rollback/versioning in TypeScript should be resisted: the shell script is tested, it is what
the docs describe, and a second implementation means two things to keep correct. The editor's job is
to get the artifact and the script onto the machine, run it, and stream back what happened.

### Caddy, and why now

`deploy/Caddyfile.example` already exists, unused. nginx is the default for the hand-run path, and it
is right there: the operator controls TLS themselves.

For a remote deploy driven from the editor, **Caddy is the better default** for one reason that
outweighs the rest — automatic TLS with no certificate step. The maintainer's stated flow ends with:

> The AI gives me the IP address to point my domain name to and boom, or I just ask for an sslip IP
> if I'm just pushing to cloud for testing and don't have a domain name.

Both halves of that need TLS to arrive on its own. With Caddy, `https://1-2-3-4.sslip.io` works
minutes after the box boots, with a real certificate, no account, no DNS. That is the difference
between a demo you can send someone and a demo you have to apologise for.

Keep nginx as the documented alternative for people who want it. Do not delete it.

### The ssh2 decision

Settled in scoping: **bundle `ssh2`**, do not shell out. The reasoning and its consequences:

- One code path on macOS, Linux and Windows. Windows ships an OpenSSH client but no `rsync`, so the
  shell-out route needs a second file-transfer strategy there — precisely on the platform where the
  fewest people will test it.
- Programmatic session control is what makes streamed output, structured errors and progress
  reporting possible. Parsing a subprocess's stderr for "Permission denied (publickey)" is a worse
  version of the same feature.
- The cost is real and lands in packaging: `ssh2` has optional native crypto bindings. **The pure-JS
  path must be confirmed working in the packaged Electron app on all three platforms**, or the
  bindings must be confirmed to build and ship. Do this early — a native-module surprise found in
  week three is a rewrite; found in day one it is a flag.

The OpenNoodl packaging traps apply here in full: externals hoisting and `ELECTRON_RUN_AS_NODE`
behaviour mean a green `npm test` proves nothing about the packaged app. Verify in a packaged build.

## Current State

| Piece | Where | State |
|---|---|---|
| Deploy driver | `packages/nodegx-backend/deploy/nodegx-deploy.sh` | Works; tested incl. rollback |
| Compose file, Dockerfiles, nginx.conf, entrypoint | same folder | Work |
| `Caddyfile.example` | same folder | Present, **unused, unverified** |
| Packaged artifact + digest build id | `scripts/package-deploy.js` | Works |
| Route-table drift test | `tests/deploy-assets.test.ts` | Reads live `getRouteTable()` |
| Targets & keys | DEP-004 | Prerequisite |
| Portable artifact | DEP-001 | Prerequisite — this is what lets one build reach dev and prod |
| SSH from the editor | — | Does not exist |

## Desired State

### 1. An SSH layer

Connect with a key from `DeploySecrets`. Run a command with streamed stdout/stderr. Upload a
directory. Host-key verification with trust-on-first-use: the fingerprint is stored on the target,
shown at first connect, and a **change** is a hard failure with an explicit explanation — not a
prompt that people click through. Sensible timeouts everywhere, and a `Test connection` that
distinguishes: host unreachable, port closed, auth rejected, user lacks Docker permission.

### 2. Preflight, before anything is built

Refusing early is worth more than any other single behaviour in this task, because the alternative is
a five-minute build followed by a failure that was knowable at the start. Check: SSH works; the user
can run Docker (or Docker is absent — offer to install it, which is a handful of commands on a
supported distro, and say which distros are supported); the disk has room; ports 80/443 are free; the
architecture matches the images being deployed.

That last one is a real trap. WF-003's images were **built on arm64 only**. An Apple Silicon laptop
deploying to an x86 VPS is the single most likely configuration in this phase, and it must be caught
in preflight rather than producing an exec-format error inside a container.

### 3. The deploy

1. Build the app (DEP-002's packaging path, DEP-008's ignore rules).
2. Write `nodegx-config.json` (DEP-001) pointing at **this target's** site URL. This is where the
   portable artifact pays for itself: dev and prod get the same build with different config.
3. Upload the artifact, the deploy assets and the Caddyfile.
4. Run `nodegx-deploy.sh deploy` over SSH, streaming output into a deploy log panel.
5. Health-check the deployed site from the editor's own network — verifying from the server tells you
   the container is up, not that anyone can reach it.
6. Report: URL, build id, duration. Surface the admin credential and the `/_admin` URL on first
   deploy (WF-003's P1 is exactly this, and it made BAK-005's dashboard unusable in the deployment it
   was built for).

### 4. Rollback and history

`versions` and `rollback <id>` are already implemented and tested in the script. Surface them:
a list of what is on the machine, and a one-click rollback with a confirmation naming the build.
Do not reimplement.

### 5. Caddy target

A `Caddyfile` generated from the target's site URL, replacing nginx in the compose file when the
target is configured for it. It must reproduce nginx.conf's behaviour exactly on the two things that
matter — the backend route families and SSE passthrough — and it must be covered by the **same live
route-table test**, not a hand-maintained parallel list. sslip.io hostnames must work, including the
certificate.

The two open WF-003 residuals land here: **SSE and file upload through the proxy are untested.**
Realtime (BAK-001) and files (BAK-006) both go through this path, and both are the sort of thing that
works in every test and fails behind a proxy. Test them through Caddy for real.

## Implementation Steps

1. **Day one: prove `ssh2` works in a packaged build on all three platforms.** Everything else
   depends on the answer.
2. SSH layer + host-key policy, tested against a real server.
3. Preflight, including the architecture check.
4. Caddyfile generation + the route-table test extension; verify sslip.io TLS on a real box.
5. Deploy orchestration, log streaming, health check.
6. Rollback and version UI over the existing script commands.
7. First-deploy credential and permissions surfacing.
8. **A full run on a real VPS**, ideally two: one x86, one arm. Deploy, use the app, write data,
   redeploy, roll back, roll forward, confirm data intact. Then repeat with a *second* target from
   the same build to prove the portable artifact. Record it in the WF-003 notes format.

## Success Criteria

- [ ] A full-stack project deploys from the editor to a fresh Ubuntu VPS with only SSH access
      configured, and is reachable over HTTPS.
- [ ] TLS is automatic, on both a real domain and an sslip.io hostname.
- [ ] The **same build** deploys to two targets with different URLs and both work — no rebuild.
- [ ] Preflight catches, before building: bad key, no Docker, insufficient disk, occupied port,
      architecture mismatch.
- [ ] A changed host key is a hard failure with an explanation.
- [ ] Deploy output streams live; a failure names the failing step.
- [ ] Rollback works from the UI and is proven with data written between two deploys.
- [ ] SSE (realtime) and file upload verified through Caddy, closing two WF-003 residuals.
- [ ] The admin credential is surfaced on first deploy, and the 403-by-default read behaviour is
      explained where the user will hit it.
- [ ] `ssh2` verified in packaged builds on macOS, Windows and Linux.
- [ ] No new deploy/rollback logic in TypeScript — the shell script remains the implementation.

## Out of Scope

- Provisioning (DEP-006).
- Zero-downtime deploys, multiple servers, load balancing.
- Managing DNS records. DEP-007 explains what to create; the user creates it.
- Backups. BAK-007 owns that and works on the deployed backend already.
- Non-Docker deployment targets.

## Traps

- **`lerna exec` runs the main checkout, not a worktree.** A worktree cannot drive the editor, which
  is why WF-003 could never deploy a real export. If this runs in a worktree, the live pass must
  happen from the primary checkout.
- **Port 8080 is the editor's webpack dev server.** Deploying to a dev machine needs another port.
- **Anonymous reads 403 by default** (BAK-003), so a successful first deploy renders a shell and no
  data. This looks like a broken deploy and is not. `PUT /admin/permissions/collections/:name` with
  `{"permissions":{…}}` is the fix; the bare `{"find":"public"}` shape **silently persists nothing
  and answers `success:true`** (BAK-009).
- **`devOpen: true` is the shipped default** and BAK-003's interlock refuses a non-loopback bind while
  it is set. `entrypoint.sh` writes a locked policy on first run only; understand that before
  changing anything near it.
- **Images were built arm64-only in WF-003.** Multi-arch or an explicit architecture check — silence
  is not an option.
- **The credential-rotation P1 is fixed but its shape recurs**: when a later task takes ownership of
  a value, an earlier task's safety net around that value becomes an active bug. Grep for other
  writers before adding one.
- **Do not let the deploy log leak secrets.** The script's output includes environment handling;
  scrub before it reaches a panel or a support paste.
