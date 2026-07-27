# DEP-006: Hetzner Provisioning — "Make Me a Server"

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEP-006 |
| **Phase** | Phase 26 — Deployment (Track K) |
| **Tier** | 4 — provisioning & assist |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | DEP-004, DEP-005 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — a well-documented API and a cloud-init file; the care is in spending someone's money and in cleaning up after a failure |

## Objective

Turn "I need a server" into a guided, gated flow: paste a Hetzner API token, confirm a machine and
its monthly price, and get a provisioned, Docker-ready box registered as a DEP-004 deploy target.

## Background

The maintainer's stated flow:

> Here's a guide on how to sign up to Digital Ocean / Hetzner / Hostinger / OVH / whatever and get an
> API key for a project. Let Noodl's AI create a small appropriate VM for you (gated), so that it can
> do the SSH key deployment and link the SSH key to your Noodl project.

Everything in that sentence except "appropriate" is deterministic. Creating a server is: upload a
public key, create a server with an image and a type and a cloud-init user-data blob, poll until it
is running, take the IP. Four calls. This task implements those four calls; DEP-007 supplies the
"appropriate", and it does so as a *recommendation the user confirms*, never as an action.

**Hetzner first** (settled in scoping): roughly €4/month for a machine that comfortably runs this
stack, a clean and stable API, and an EU footprint that suits the data-residency argument WF-003
already made for the education wedge. Write the adapter behind an interface so a second provider is a
new file — but do not write a second provider here. One provider that works completely is worth more
than three that mostly work.

## Current State

- No provisioning code exists.
- DEP-004 owns targets, secrets and keypairs; a provisioned server becomes a target with
  `provider: 'hetzner'` and a `providerResourceId`.
- DEP-005 owns everything after the box exists. Provisioning ends where preflight begins, and the
  two must not overlap: if cloud-init installs Docker, preflight still checks for Docker, because a
  cloud-init can fail silently and a user can also bring their own box.

## Desired State

### 1. A provisioning interface, one implementation

```ts
interface ServerProvider {
  id: 'hetzner';
  authenticate(token: string): Promise<{ projectName: string }>;
  listRegions(): Promise<Region[]>;
  listServerTypes(region: Region): Promise<ServerType[]>;   // incl. monthly price, in the account's currency
  createServer(spec: ServerSpec): Promise<ProvisionedServer>;
  getServer(id: string): Promise<ProvisionedServer>;
  deleteServer(id: string): Promise<void>;
}
```

Prices come from the API, in the account's own currency and tax treatment. A hardcoded "€4/month"
will be wrong for someone, and being wrong about a price the user is about to be charged is a
specific kind of bad.

### 2. The flow

1. **Get a token.** Inline, specific instructions: the exact path through Hetzner Cloud Console to
   create a *project-scoped* read/write API token, with a note that the token is shown once. Not
   "create an API token".
2. **Choose region.** Default to the one nearest the user; say why it matters (latency, and where
   the data physically lives — the education wedge cares about the second).
3. **Choose a size**, with prices from the API and a default appropriate for a NodeGX backend.
   DEP-007, if present, annotates this with a recommendation for *this* project; if absent, a static
   sensible default. The screen works with no AI configured.
4. **Confirm**, on a screen that states plainly: this creates a server on your Hetzner account and
   **you will be billed <price> per month until you delete it**. Explicit confirm. Never
   auto-provision as a side effect of a Deploy click — creating and deploying are separate verbs, and
   the phase README says so for a reason.
5. **Create**, with progress: uploading key → creating server → waiting for boot → installing Docker
   → ready.
6. **Register as a DEP-004 target**, with the IP, the resource id, and a default `sslip.io` site URL
   so the user has a working HTTPS address before they own a domain.

### 3. Cloud-init that does the boring part

A user-data blob that: installs Docker and the compose plugin from the official repository, creates a
non-root deploy user with the public key in `authorized_keys`, disables password SSH and root SSH
login, enables a firewall allowing 22/80/443 only, and writes a marker file the editor can poll for
so "ready" means finished rather than booted.

Keep it minimal and readable. Every line is a line someone will have to debug over SSH at some point,
and there is no configuration-management story in this phase.

### 4. Failure leaves nothing behind

The most important behaviour in the task. If server creation succeeds and cloud-init fails, the user
is being billed for a machine they cannot use and may not know exists. So:

- Any partial failure surfaces the resource id and the console URL.
- Offer to delete it, saying what will be lost.
- A created server is registered as a target **before** cloud-init is polled, so a crash mid-flow
  leaves a visible record instead of an orphan.
- If the editor closes mid-provision, the target is still there with a "provisioning did not
  complete" state and a way to check or delete.

### 5. Deletion is in the product

If the editor can create a billable resource it must be able to delete one, with a confirmation that
names the server, states that all data on it is lost, and points at BAK-007's backup if the target
has ever been deployed to. An abandoned server is the most expensive bug this phase can ship.

## Implementation Steps

1. Verify the API by hand with a real token and a real (immediately deleted) server. Record the
   observed shapes.
2. Provider interface + Hetzner adapter, injected `fetch`, offline tests.
3. Cloud-init blob; test it by provisioning for real and inspecting the result.
4. The wizard, price display, and the confirmation gate.
5. Target registration, the incomplete-provision state, and deletion.
6. **End-to-end**: provision → DEP-005 deploys to it → app live over HTTPS on sslip.io → delete the
   server → confirm it is gone from the Hetzner console. Record cost incurred.

## Success Criteria

- [ ] A user with a Hetzner account and no server gets a live NodeGX app over HTTPS without touching
      a terminal or the Hetzner console after copying the token.
- [ ] The monthly price shown comes from the API, in the account's currency, and is confirmed before
      creation.
- [ ] A server is never created without an explicit confirmation step.
- [ ] A failure mid-provision leaves a visible, deletable target — verified by inducing one, not by
      reading the code.
- [ ] Deleting a target deletes the server, with a confirmation naming it and warning about data.
- [ ] The provisioned box passes DEP-005's preflight unmodified.
- [ ] Cloud-init disables password and root SSH login, and the firewall allows only 22/80/443 —
      verified against a real box, e.g. with `ssh -o PreferredAuthentications=password`.
- [ ] Adapter tests run offline; the live run is recorded in notes, not in CI.

## Out of Scope

- Any second provider. DigitalOcean, Hostinger and OVH are follow-ups if the interface holds and
  someone asks.
- Resizing, snapshots, volumes, floating IPs, private networks, backups (BAK-007 already covers app
  data).
- Managing DNS records at the provider.
- Cost tracking or budget alerts beyond showing the monthly price at creation.
- Multi-server topologies.

## Traps

- **The user is spending real money.** Every default that costs more than necessary is a default that
  costs someone real money. Bias small — DEP-005 can redeploy to a bigger box far more easily than a
  student can get a refund.
- **The token is shown once by Hetzner.** If the editor fails to store it, the user must create
  another. Store before proceeding, and confirm the store succeeded.
- **`safeStorage` may be unavailable on Linux** — DEP-004's store already handles this; do not add a
  second path.
- **Cloud-init failures are silent by default.** Poll for a marker written at the *end*, not for SSH
  becoming available. SSH is up long before Docker is.
- **sslip.io depends on a third party.** It is excellent and free and it is not ours. Say so in the
  UI where it is offered, so a user with a real domain uses the real domain.
- **Rate limits and quotas**: a new Hetzner account has a server limit, and hitting it produces an
  error that must be translated into "your account limit is N; raise it here" rather than a raw 403.
