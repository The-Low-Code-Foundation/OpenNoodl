# DEP-003: Publish to Netlify & Cloudflare Pages — No GitHub

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEP-003 |
| **Phase** | Phase 26 — Deployment (Track K) |
| **Tier** | 2 — local & static |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | DEP-001; DEP-002 for the popup structure |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — two third-party APIs with different upload models; mechanical once understood, opaque while you are learning them |

## Objective

Let someone with a frontend-only NodeGX app — or a frontend talking to an external backend — get a
live public URL from inside the editor, with a token and a button, and no git repository anywhere in
the flow.

## Background

The community request is "make deploying to Vercel/Netlify/Cloudflare/GitHub Pages simpler", and the
assumed shape is GitHub + CI. That assumption is worth breaking rather than serving: **Netlify and
Cloudflare Pages both accept direct uploads over their APIs.** A personal token, a bundle of files,
one HTTP conversation, a live URL. No repo, no Actions workflow, no YAML, no webhook.

For a NodeGX user this is a strictly better story than the git route, because a NodeGX project is
already a git repository whose contents are a *graph*, not a built site. Pushing it to GitHub and
having CI build it would require NodeGX to run in CI — which is a much larger feature (headless
export exists in `noodl-preview` and `noodl-mcp`, but productising it is not this phase).

So the design is: **the editor builds, the editor uploads.** Nothing else runs anywhere.

The two providers differ enough to be a real test of the abstraction:

- **Netlify** — create (or reuse) a site, POST a zip of the built folder to a deploy endpoint, poll
  until the deploy state is ready. Simple, one request for the payload.
- **Cloudflare Pages** — Direct Upload: a project, then a file-manifest negotiation (hashes offered,
  server says which it lacks, client uploads only those), then a deployment. More moving parts, and
  the incremental-upload model means the second publish of a large app is much faster.

Building both first means the adapter interface is shaped by two genuinely different flows rather
than by one and a guess.

**Vercel and GitHub Pages are out of scope**, argued rather than omitted. Vercel's own onboarding is
already about as easy as this feature would be, so it buys little. GitHub Pages fundamentally
requires a git push, which is the thing this task exists to avoid; someone who wants it can use the
folder output and their own tooling.

## Current State

- No HTTP client abstraction for third-party deploy providers exists anywhere in the editor.
- Token storage precedent: [`store/AiCredentials.ts`](../../../packages/noodl-editor/src/editor/src/store/AiCredentials.ts)
  — Electron `safeStorage` over `electron-store`, with a migration from an older plaintext key. **Reuse
  this pattern; do not invent a second credential store.** (DEP-004 generalises it; if DEP-004 lands
  first, use its store.)
- The build side already works: `compilation.deployToFolder()` produces exactly the folder that needs
  uploading.
- DEP-001 gives every published build a `nodegx-config.json`, so an app published here can be
  re-pointed at a different backend without a rebuild.

## Desired State

### 1. One provider interface, two implementations

```ts
interface StaticHostProvider {
  id: 'netlify' | 'cloudflare-pages';
  displayName: string;
  /** Validate a token and return the accounts/teams it can publish to. */
  authenticate(token: string): Promise<HostAccount[]>;
  listSites(account: HostAccount): Promise<HostSite[]>;
  createSite(account: HostAccount, name: string): Promise<HostSite>;
  publish(site: HostSite, dir: string, onProgress: (p: PublishProgress) => void): Promise<PublishResult>;
}
```

`PublishResult` carries the live URL, a provider deployment id, and whatever the provider calls its
log/dashboard page — the user must always be one click from the provider's own view of what happened.

The interface is written from the *harder* provider (Cloudflare's manifest negotiation), so the
easier one is a degenerate case. Writing it from Netlify's zip POST and then bending it around
Cloudflare is how these abstractions end up wrong.

### 2. The flow

1. Choose provider.
2. Paste a token. Inline help: exactly where in that provider's UI the token is created and which
   scope it needs — with the current path through their settings UI, not "create a token".
3. Pick an existing site, or name a new one.
4. Publish. Live progress: building → uploading (n/m files) → live.
5. The URL, copyable and clickable, plus a link to the provider's deployment page.

The chosen provider and site are remembered per project; the token is remembered globally per
provider. Second publish is one click.

### 3. Honest handling of the backend question

The app being published is a static frontend. If the project's `cloudservices` points at
**localhost** — the overwhelmingly common case, because the editor auto-points it at the local
backend — then the published app will be broken for everyone but the developer.

This must be caught **before** publishing, not diagnosed afterwards, and the message must state the
options plainly: publish anyway (frontend-only demo), point at an external backend in the Backend
Services panel, or use DEP-005 to deploy the backend somewhere. WF-003 already built a
"baked-endpoint audit" for exactly this failure in the Docker target
(`scripts/package-deploy.js`) — read it, and reuse its judgement rather than re-deriving the rule.

### 4. Errors that say what to do

The four failures that will actually happen, each with a specific message: token expired or revoked;
token lacks the required scope; site name already taken; upload interrupted mid-flight. The last one
matters most — both providers' deployments are atomic, so an interrupted upload leaves the previous
deploy live. Say that, so nobody panics and re-publishes into a worse state.

## Implementation Steps

1. **Verify both APIs by hand first**, with `curl` and a real token, and write the observed request
   and response shapes into the notes file before writing any code. These APIs are not stable
   contracts and a spec written from documentation alone will be wrong somewhere.
2. Provider interface + Netlify adapter, with an injected `fetch` as the test seam (the AIX-001
   pattern — all 69 AI specs are offline because of it).
3. Cloudflare Pages adapter. Expect the manifest negotiation to reshape the interface; that is what
   it is for.
4. Token storage via the shared credential store.
5. The publish tab, progress reporting and error surface.
6. The localhost-endpoint pre-flight, reusing WF-003's audit logic.
7. **Publish for real to both**, on real free accounts: a fresh site and a re-publish of the same
   site. Record URLs and timings.

## Success Criteria

- [ ] A frontend-only project publishes to a live public URL on Netlify, from a cold start, in under
      five minutes including token creation.
- [ ] The same project publishes to Cloudflare Pages.
- [ ] Re-publishing an existing site is one click and updates the same URL.
- [ ] Cloudflare's second publish uploads only changed files, and this is visible in the progress UI.
- [ ] Publishing an app whose backend is `localhost` is blocked before upload with a message naming
      the three ways out.
- [ ] All four named failures produce a specific, actionable message — tested against the real APIs
      where possible (an expired token is easy to produce; a revoked one is easy to produce).
- [ ] All adapter tests run offline against injected `fetch`.
- [ ] Tokens are in `safeStorage`, never in `project.json`, and a test asserts the project file after
      a publish contains no token-shaped value.
- [ ] No git operation occurs anywhere in the flow.

## Out of Scope

- Vercel, GitHub Pages, S3, Surge, Firebase Hosting. Add on demand, not speculatively.
- Custom domain configuration. Link to the provider's own domain UI; they do it well and it is their
  DNS.
- Preview/branch deploys, rollback to an earlier deploy, environment variables. Providers' own
  dashboards own all three.
- Publishing SSR output. Both providers can run server functions, but that is a materially different
  integration — record it as a follow-up if anyone asks.

## Traps

- **Cloudflare's Direct Upload has more than one API generation.** Confirm which one a fresh account
  gets today; the older one is widely documented and may not be what you receive.
- **Netlify site names are globally unique.** "my-app" is long gone. The name field must handle
  rejection gracefully and suggest an alternative rather than failing the publish.
- **A file-hash manifest is only as good as its hash algorithm and its treatment of empty files** —
  both providers have specific rules. Get them from observed behaviour, not documentation.
- **`safeStorage` is unavailable in some Linux desktop configurations.** `AiCredentials.ts` already
  faces this; read what it does rather than inventing a second answer.
- **Do not put the token in the project.** It is trivially easy to "helpfully" persist the whole
  publish config next to the site id. `project.json` is committed and shared.
