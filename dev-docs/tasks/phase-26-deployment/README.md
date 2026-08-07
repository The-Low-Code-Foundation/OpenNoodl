# Phase 26: Deployment (Revival Track K)

**Phase:** 26
**Track:** K — the three ways a NodeGX app reaches the world: a folder you run, a static host, a machine you own
**Source:** Scoping session 2026-07-27, from community requests plus the maintainer's own deployment practice (Docker + Caddy on cheap Linux VMs).
**Status:** 📋 Specced, not started — 7 tasks. See [PROGRESS.md](./PROGRESS.md).
**Starts:** Anytime. DEP-001 is a prerequisite for the rest and is small.

## Why this phase exists

Phase 19's WF-003 built a genuinely good deployment *destination*: Docker Compose, one origin,
content-digest build ids, tested rollback, a credential scan that fails the build. What it did not
build is anything between the editor and a machine. Today the entire user-facing deployment surface
is one tab:

```tsx
// views/DeployPopup/DeployPopup.tsx:26
<Tabs tabs={[{ label: 'Self Hosting', content: <DeployToFolderTab /> }]} />
```

That tab writes a folder containing the **frontend only**. If your app has a backend — and after
phases 19 and 22 the backend is the reason to use NodeGX at all — the folder is half an application,
and the other half is a shell script in `packages/nodegx-backend/deploy/` that you are expected to
find, read, and run on a server you provisioned yourself.

Three gaps follow directly, and they map to the three things people ask for:

1. **There is no local full-stack story at all.** Phase 5's TASK-007F ("bundle the backend with the
   exported app") was specced and never started. `nodegx-backend` already builds to a single ~690KB
   esbuild bundle that runs on plain Node — the editor spawns exactly that as a child process — so
   this gap is much cheaper to close than it looks.
2. **Frontend-only apps are pushed at GitHub for no reason.** Netlify, Cloudflare Pages and Vercel
   all accept direct uploads with a token. No repo, no CI, no YAML. We send people through GitHub
   because nobody wrote the two hundred lines.
3. **Full-stack deployment requires the user to be a sysadmin.** Provision a box, install Docker,
   copy an artifact, run a script, configure TLS, point DNS. Every step of that is deterministic and
   none of it is in the product.

### The constraint that shapes all three

The exported app's backend endpoint is **frozen at build time**. `index.js` is written as:

```js
window.projectData = {{#export#}};   // external/deploy/index.js
```

with `metadata.cloudservices` inlined, and every consumer reads it at call time from there
([`cloudfunction2.ts:53`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/cloudfunction2.ts#L53),
[`cloudstore.js:36`](../../../packages/noodl-runtime/src/api/cloudstore.js#L36),
[`userservice.ts:173`](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts#L173),
[`configservice.ts:58`](../../../packages/noodl-runtime/src/api/configservice.ts#L58)).

WF-003 designed *around* this rather than fixing it — the single-origin nginx layout exists because
"every additional URL is another way for a frozen value to be wrong." That was the right call for one
deploy target. For a phase that adds five, it means:

- you cannot build once and deploy to dev and prod — each needs its own build;
- provisioning must complete *before* export, because the artifact needs the final hostname;
- a deployed app cannot be re-pointed without reopening the editor.

**DEP-001 removes the constraint** in about a hundred lines, and everything downstream gets simpler.
It is first for that reason and no other.

## Task Table

| Order | ID | Title | Tier | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|---|
| 1 | [DEP-001](./DEP-001-RUNTIME-BACKEND-CONFIG.md) | Runtime backend config — un-freeze the endpoint | 1 — the constraint | 🔴 Critical | 2–3 days | none | 🟠 Opus 4.8 |
| 1 | [DEP-008](./DEP-008-ARTIFACT-CONTENTS-AND-IGNORE.md) | Artifact contents & the ignore mechanism | 1 — the constraint | 🔴 Critical | 2–3 days | none | 🟠 Opus 4.8 |
| 2 | [DEP-002](./DEP-002-LOCAL-FULLSTACK-BUNDLE.md) | Local full-stack bundle — one process, no Docker | 2 — local & static | 🔴 Critical | 1–1.5 wks | DEP-001 | 🔵 Opus 5 |
| 3 | [DEP-003](./DEP-003-STATIC-HOST-PUBLISH.md) | Publish to Netlify & Cloudflare Pages, no GitHub | 2 — local & static | 🟠 High | 1–1.5 wks | DEP-001, DEP-002 (popup IA) | 🟠 Opus 4.8 |
| 4 | [DEP-004](./DEP-004-DEPLOY-TARGETS-AND-SECRETS.md) | Deploy targets & secret storage | 3 — your own machine | 🟠 High | ~1 wk | DEP-002 (popup IA) | 🔵 Opus 5 |
| 5 | [DEP-005](./DEP-005-REMOTE-DEPLOY-SSH.md) | Remote deploy over SSH + the Caddy target | 3 — your own machine | 🟠 High | 2–3 wks | DEP-001, DEP-004 | 🔵 Opus 5 |
| 6 | [DEP-006](./DEP-006-HETZNER-PROVISIONING.md) | Hetzner provisioning — "make me a server" | 4 — provisioning & assist | 🟡 Medium | 1–1.5 wks | DEP-004, DEP-005 | 🟠 Opus 4.8 |
| 7 | [DEP-007](./DEP-007-DEPLOY-ASSISTANT.md) | The deploy assistant — sizing, DNS, diagnosis | 4 — provisioning & assist | 🟡 Medium | 1–1.5 wks | DEP-005 (DEP-006 for sizing) | 🔵 Opus 5 |

Serial worst case ~9 weeks; realistic with parallelism ~5–6. DEP-003 and DEP-004 have disjoint file
territories once DEP-002 has landed the popup structure and can run concurrently.

## The decisions this phase starts from

Taken in the 2026-07-27 scoping session. They are settled unless a task's assessment step contradicts
them, in which case the assessment wins and the deviation is recorded.

**The deploy path is deterministic code. The AI is a guide and a troubleshooter, never load-bearing.**
Provisioning a VM is four API calls and a cloud-init file — that is not fuzzy work, and a deploy that
only succeeds when an LLM improvises cannot be reproduced, tested, or supported when someone files a
bug. Every step from "click Deploy" to "the app is live" runs offline with no model configured. The
assistant earns its place on the parts deterministic code covers badly: choosing a VM size for *this*
project, explaining DNS to someone who has never pointed a domain, and reading the logs when a deploy
fails. DEP-007 is additive by construction — if it is never built, tiers 1–3 are still a complete
product.

**SSH is `ssh2` (pure JS), bundled.** Shelling out to the system `ssh`/`rsync` is cheaper on
macOS/Linux and awkward on Windows, which ships an OpenSSH client but no `rsync`. One code path on
all three platforms is worth the dependency, and programmatic session control is what makes streamed
deploy output and structured error handling possible. See DEP-005 for the packaging consequences.

**Hetzner is the first — and for now only — provisioning provider.** Cheapest by a distance
(~€4/month for a box that comfortably runs this stack), clean API, and its EU footprint suits the
data-residency argument WF-003 already leaned on for the education wedge. The adapter interface is
written so a second provider is a new file, but no second provider is in this phase.

**Both Netlify and Cloudflare Pages ship in DEP-003.** One adapter interface, two implementations —
enough to prove the abstraction holds before anyone depends on it, and the two have genuinely
different upload models (zip POST vs. file-hash negotiation), so it is a real test rather than a
rename. Vercel and GitHub Pages are explicitly out; Vercel's own onboarding is already easy, and
GitHub Pages is the one target that genuinely cannot avoid git.

## Sequencing notes

- **DEP-001 is worth doing whether or not the rest of the phase is agreed.** It removes a limitation
  that is already biting: today you cannot move a deployed app between hosts without a rebuild.
- **DEP-008 is the same kind of item and is filed alongside it** (added 2026-07-27, from the phase-15
  scoping session). Every target in this phase copies the project folder through
  `copyProjectFilesToFolder`, which ships **everything** past a five-name hardcoded filter with a
  `// TODO: Load something like .noodlignore file list` on line 6 — so a creator's private notes are
  served from their app's public origin today, before this phase adds four more destinations. It also
  carries two adjacent bugs: the `.git`/`.noodl` checks are unanchored `indexOf` substring matches
  that silently drop legitimate assets, and v2 project source (`nodegx.*.json`, `components/`) is
  currently deployed by accident rather than by decision. It blocks phase 15's
  [AIX-009](../phase-15-ai-collaboration/AIX-009-PROJECT-CONTEXT-DOCS.md), whose `docs/` folder of
  scoping notes is exactly the thing that must not ship; that task's acceptance criterion 8 is the
  interlock. Deliberately **not** solved by adding `docs` as a sixth hardcoded name — that leaves
  every other private file leaking.
- **DEP-002 owns the Deploy popup's new information architecture** because it is the first task that
  needs more than one destination. DEP-003 and DEP-005 add to that structure; they must not fork a
  second popup or a second target list.
- **DEP-004 before DEP-005** so the SSH work has somewhere to put a host and a key. DEP-004 is
  useful alone: it is where the "dev VM / prod VM" list the maintainer asked for actually lives.
- **DEP-005 works against a machine you already own**, with no provisioning. That is deliberate — it
  means tier 3 is a complete, shippable feature for anyone with a VPS, and DEP-006 becomes a
  convenience rather than a dependency.
- **Tiers are stopping points.** Tier 1 alone unblocks portable artifacts. Tier 2 gives every app a
  way to be run and a way to be published. Tier 3 is the full-stack story. Tier 4 is the part most
  worth challenging before it is built.

## What this phase deliberately does not do

- **Code export (Phase 18) is still 0/5** and this phase does not change that. WF-003's docs already
  point at it honestly as a roadmap item rather than an escape hatch; keep doing that.
- **No managed NodeGX hosting.** That is ECO-004's territory and is gated on G3.
- **No Kubernetes, no Terraform, no multi-region.** The target user has one server.
- **No CI/CD integration.** The whole point of DEP-003 is that you do not need one. If someone wants
  GitHub Actions they can already have it; a static folder is a static folder.
- **No mobile/desktop targets.** Phase 5's Capacitor and Electron targets stay parked.

## Verification posture

Every task in this phase touches something that only fails in the real world — a token that expired,
a firewall, a DNS record, a disk that filled. Two rules, both learned from WF-003:

1. **Container- and network-level behaviour is not in CI**, and no task may claim it is. Record what
   was actually run in a `-NOTES.md`, in the table format WF-003 used.
2. **A test reads the live contract wherever one exists.** WF-003's `deploy-assets.test.ts` starts a
   real service and reads `getRouteTable()` so the proxy config cannot drift from the real routes.
   DEP-002 and DEP-005 inherit that pattern rather than re-asserting a hand-written list.
