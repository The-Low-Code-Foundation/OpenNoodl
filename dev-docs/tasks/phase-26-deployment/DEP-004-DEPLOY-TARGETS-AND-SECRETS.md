# DEP-004: Deploy Targets & Secret Storage

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEP-004 |
| **Phase** | Phase 26 — Deployment (Track K) |
| **Tier** | 3 — your own machine |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | ~1 week |
| **Prerequisites** | DEP-002 (the Deploy popup structure) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — the model is small but decides where every credential in the phase lives, and that is expensive to reverse |

## Objective

Give a project a list of **deploy targets** — "dev VM", "prod VM", a Netlify site — that the user
picks from at deploy time, and put the credentials those targets need somewhere that is not the
project file.

## Background

The maintainer's description of the wanted flow is precise about this:

> Now when you want to deploy, you go to the deploy menu and click which VM you want to deploy to
> (in case they have dev and prod VMs).

That is a saved, named, per-project list. Nothing like it exists. `cloudservices` is a single pointer
to one backend, stored in project metadata; DEP-003's provider tokens have nowhere to live until this
task exists; and DEP-005 needs somewhere to put a hostname, a username and a private key.

The privacy half is the part that will bite if it is got wrong. **A NodeGX project is a git
repository that people share.** `project.json` and the v2 `nodegx.*.json` files are committed. Put a
DigitalOcean token or an SSH private key in there and it is in someone's GitHub the same afternoon —
and DEP-008 has just established that the whole project folder is currently copied into the deploy
output, so it would also be served from the app's public origin.

The editor already has the right pattern for this and it should not be reinvented:

```
packages/noodl-editor/src/editor/src/store/AiCredentials.ts
  — Electron safeStorage over electron-store, plus a documented migration
    from the older plaintext `aiAssistant.temporaryApiKey`
```

`nodegx-backend` independently arrived at the same conclusion server-side
(`src/config/SecretsStore.ts`). Two implementations of one idea already exist in the tree; this task
must produce a third only if it can state why neither fits, and should otherwise generalise
`AiCredentials`.

## Current State

| Piece | Where | Note |
|---|---|---|
| AI provider keys | `store/AiCredentials.ts` | `safeStorage` + `electron-store`; **the pattern** |
| Backend secrets (server side) | `packages/nodegx-backend/src/config/SecretsStore.ts` | Different process, different problem; do not merge |
| Per-project editor state | `utils/editorsettings.ts` | `Model` over `JSONStorage`, keyed by `ProjectModel.instance.id` — PNL-003 and `useSetupSettings` both use it |
| Backend pointer | `cloudservices` project metadata | Single-valued; set from the Backend Services panel |
| Backend service list | `models/BackendServices/` | **The closest existing shape** — a typed list of named services with a panel; read it before designing |
| Deploy destinations | — | Do not exist |

## Desired State

### 1. A target model

```ts
interface DeployTarget {
  id: string;
  name: string;                       // "prod", "staging", user's words
  kind: 'static-host' | 'server';
  siteUrl: string;                    // what the app will be reachable at
  // kind: 'server'
  host?: string;                      // IP or hostname
  sshUser?: string;
  sshPort?: number;
  provider?: 'hetzner' | 'manual';    // 'manual' = a box the user already had
  providerResourceId?: string;        // DEP-006 fills this in
  // kind: 'static-host'
  hostProvider?: 'netlify' | 'cloudflare-pages';
  hostSiteId?: string;
  // never stored here:
  //   private keys, API tokens, passwords
  secretRef: string;                  // an opaque key into the secret store
}
```

Targets live in **per-project editor settings**, not in the project file. Reasoning: a target is
about *this person's* deployment of the project, not about the project. Two people cloning the same
repo should not inherit each other's servers. Record this decision explicitly — it is arguable the
other way for a team with one shared prod server, and the argument should be written down so it can
be revisited rather than rediscovered.

### 2. Secrets keyed by target, never in a project file

A `DeploySecrets` store, generalising `AiCredentials`:

- `safeStorage`-encrypted where available, with the same documented degradation `AiCredentials`
  already implements for Linux desktops where it is not.
- Keyed by `secretRef`, holding: SSH private key, provider API token, and any target-specific
  password.
- Deleting a target offers to delete its secrets, and says what will be lost.
- **A test asserts that after creating a target with a key and a token, neither `project.json` nor any
  `nodegx.*.json` nor the deploy output contains a value matching either.** Not an inspection — an
  assertion in CI. This is the criterion that keeps the guarantee true in a year.

### 3. SSH keypair generation

The editor generates an ed25519 keypair per server target:

- Private key into the secret store. The public key is copyable, and shown, because the user needs to
  paste it into a provider's UI or an `authorized_keys` file.
- **Importing an existing key must be supported.** Plenty of people already have a key on the machine
  they want to deploy to, and refusing that forces them to reconfigure a working server. Support
  pasting a private key and pointing at a file on disk. Encrypted private keys need a passphrase
  prompt — decide whether to support them and say which; refusing them with a clear message is an
  acceptable answer, silently failing is not.
- Regenerating a key is possible and warns that the server needs the new public key before the next
  deploy will work.

### 4. Target management UI

In the Deploy popup's "Deploy to a server" destination (DEP-002 built the shell):

- The target list with name, kind, URL, and last-deployed timestamp.
- Add / edit / delete, and a **Test connection** button, which is the highest-value control here —
  it turns "the deploy failed" into "the deploy never could have worked, and here is why" before
  anyone waits for a build. Until DEP-005 lands it can be a stub that resolves the host.
- Adding a *manual* server target (host, user, key) must be complete and usable in this task. It is
  the path for everyone with an existing VPS, and it must not wait for DEP-006.

### 5. One target is current, per project

The last-used target is remembered so repeat deploys are one click, and it is visibly named on the
deploy button — "Deploy to **prod**" rather than "Deploy". Deploying to production because the
dropdown remembered something you forgot is a failure mode worth spending a word on.

## Implementation Steps

1. **Read `models/BackendServices/` first.** It is a typed list of named remote services with a panel
   and a store. If its shape fits, follow it; a second unrelated pattern for the same idea makes the
   editor harder to learn.
2. Target model + per-project persistence via `EditorSettings`.
3. `DeploySecrets` generalising `AiCredentials`, with the no-leak test.
4. Keypair generation and import.
5. Target management UI in the DEP-002 shell.
6. Wire DEP-003's provider tokens into the shared store if DEP-003 has landed; if not, leave the seam
   and note it so DEP-003 does not build a parallel one.

## Success Criteria

- [ ] A user can add a server target for a VPS they already own, paste or generate a key, and see the
      public key to install.
- [ ] Targets survive editor restart and are per project.
- [ ] Cloning the project on another machine yields **no** targets and no secrets — verified by
      actually cloning, not by reasoning.
- [ ] A CI test asserts no key or token material appears in `project.json`, `nodegx.*.json`, editor
      settings JSON, or a deploy output folder.
- [ ] Deleting a target offers secret deletion and states what is lost.
- [ ] The deploy button names the target it will deploy to.
- [ ] An existing key can be imported; encrypted keys either work or are refused with a clear message.

## Out of Scope

- Provisioning (DEP-006) and actually connecting over SSH (DEP-005).
- Team/shared targets, or syncing targets between machines.
- SSH agent integration. Consider it a follow-up; it is the most-requested thing this omits.
- Per-target environment variables for the app. If it turns out to be needed, DEP-005 raises it.

## Traps

- **`safeStorage` is not universally available on Linux.** `AiCredentials.ts` already deals with
  this; read it rather than discovering it in a bug report.
- **Do not put secrets in `EditorSettings`.** It is `JSONStorage` — plain JSON on disk. Targets go
  there; secrets do not. The two stores are separate on purpose and the split must survive a
  refactor, which is what the CI test is for.
- **A `secretRef` must not be derived from the target's name.** People rename things, and a rename
  that orphans a private key looks exactly like a broken deploy.
- **Deploying to the wrong target is the expensive mistake this task can cause.** Any interaction
  that changes the current target should be deliberate, not incidental.
