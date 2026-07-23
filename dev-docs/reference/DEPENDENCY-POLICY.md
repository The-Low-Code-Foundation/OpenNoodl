# Dependency Policy

How OpenNoodl decides what to upgrade automatically, what needs a task, and
how accepted security risk gets documented instead of silently carried.
Written as part of REV-005 (dependency hygiene); see
`dev-docs/tasks/phase-12-reanimation/REV-005-NOTES.md` for the full
investigation behind the register below.

## Upgrade cadence

| Change | Who does it, when |
|---|---|
| Patch/minor bump, no advisory | `npm audit fix` (no `--force`) or a manual bump, as part of whatever task touches that area. No task needed. |
| Patch/minor bump that resolves a reachable advisory | Do it directly, verify with the affected package's build/test, commit as its own changeset. No task needed. |
| Major bump, no advisory, low blast radius (isolated leaf dependency) | Fine to do opportunistically; verify the consuming package still builds/tests. |
| Major bump that touches a widely-shared toolchain version (TypeScript, webpack-cli, Electron, Node) | Needs a task — it's monorepo-wide and needs full verification (typecheck + test + build across every affected package), like REV-004 and REV-005 itself. |
| Major bump on a package with no fix otherwise, where the vulnerable code path is reachable at runtime | Assess first (below). If it's a genuine migration (auth, session handling, embedded native binaries, anything without test coverage to catch a regression), open a dedicated task rather than rushing it inside an unrelated changeset. |
| No fix available at all | Assess reachability (below), document the decision in the accepted-risk register, do not churn trying to force a fix that doesn't exist. |

**Never use `npm audit fix --force`** without going through the assessment
below first — it silently accepts semver-major bumps, and those need the
same scrutiny as any other major.

## Reachability assessment

Before accepting or bumping a finding, trace `npm audit --json`'s
`vulnerabilities.<name>.nodes` field back to an actual consumer, not just
the declared dependency graph. In order:

1. **Is the flagged package actually required/imported anywhere in tracked
   source?** Search `packages/*/src` (and any build/publish scripts)
   excluding `node_modules` and compiled `.bundle.js` output. A dependency
   that's declared but never `require`d is dead weight — remove it rather
   than document it as accepted risk. REV-005 found two of these
   (`s3`/`aws-sdk` and `websocket-stream`) responsible for eight separate
   findings between them.
2. **If it is used, is the vulnerable code path reachable by an end user
   running the packaged app**, or only during a maintainer's `npm install`
   / build / publish step? A `postinstall` script that downloads a fixed
   artifact from a trusted URL (e.g. dugite's embedded-git download) is a
   different threat model than something in the request-handling path of
   a server the app spins up. The task doc's framing holds: most of this
   repo's backlog clusters in publishing/packaging paths that run on
   maintainer machines, not in anything an end user's app executes — but
   verify that per finding, don't assume it.
3. **If it's reachable, does fixing it require a major bump to
   auth/session/security-relevant code with no existing test coverage?**
   If yes, that's a migration project (per REV-005's own risk table: "hand
   any single dependency that turns into a migration project to Opus as
   its own task"), not a same-changeset fix.
4. Record the decision either way in the register below, with reasoning.
   Silent risk is not an acceptable outcome; a documented decision is.

## Accepted-risk register

| Package(s) | Severity | Reachable at runtime? | Fix available | Decision | Reasoning |
|---|---|---|---|---|---|
| `dugite`'s nested `got`/`tar` | high / moderate / critical (tar) | No — only in dugite's `postinstall` (`script/download-git.js`), which downloads the embedded git binary from a fixed GitHub Releases URL once, at install time | `dugite@3.2.2` (semver-major, changes the embedded git version) | **Accepted, not bumped** | End users never run `npm install`; the exposure is limited to a maintainer's machine trusting the same GitHub Releases source the rest of the toolchain already trusts. A major bump risks the git integration REV-002/REV-003 spent significant effort hardening (the merge driver, the Git specs, `ELECTRON_DISABLE_SANDBOX` handling) for a vulnerability with no runtime exposure. Revisit if dugite ships a minor/patch that resolves it without the major jump. |
| `passport` (+ `passport-local`) | moderate (CVSS 4.8, session not regenerated on login/logout) | Yes — `noodl-editor` bundles `@noodl/noodl-parse-dashboard`, a local Parse backend the editor spins up per-project, which pins `passport@0.5.3` | `passport@0.7.0` (semver-major) | **Accepted for now, deferred as its own task** | A major bump to session/auth-handling code with zero existing test coverage of the local backend's login/logout flow. This is exactly the "single dependency that turns into a migration project" case — needs a dedicated task with real auth-flow testing (manual or new automated coverage) before landing, not a drive-by bump inside a dependency-hygiene pass. |

When an entry here gets resolved, move it out of the table (into the
resolving task's notes) rather than leaving a stale "fixed" row — this
table should only ever list currently-accepted risk.

## Removed, not documented

Some findings turned out to trace to dependencies with zero real
consumers. These were deleted outright rather than added to the register
above, since "accepted risk" implies the risk is actually being carried:

- `s3` (`github:noodlapp/node-s3-client`, vendoring `aws-sdk@2.4.14`) —
  removed from `noodl-editor`, along with its `@include-types/s3.d.ts`.
  Zero consumers anywhere in tracked source or git history. Responsible
  for the `aws-sdk`, `mime`, `xml2js`, `xmlbuilder`, and a nested `lodash`
  finding, all at once.
- `websocket-stream` — removed from `noodl-editor`. Zero consumers; the
  app's real websocket usage goes through the separate top-level `ws`
  dependency, which was already unaffected. `websocket-stream`'s only
  release permanently bundled a vulnerable `ws@3.x` with no fixed release
  ever published, so even if it had been used there was no non-major fix.

If either capability is genuinely wanted again (S3 publishing, a
websocket-stream-style duplex wrapper), add it fresh against a maintained
client rather than reviving these.

## Version coherence

TypeScript and webpack-cli existed at two different majors across the
monorepo before REV-005 (TypeScript 4.9.5 vs. 5.9.3; webpack-cli 4.x vs.
5.x), which produced errors that reproduced in one package and not
another — exactly the kind of friction that makes a codebase feel
unsalvageable when it isn't. Going forward:

- **One TypeScript major, one webpack-cli major, across every package.**
  When bumping either for one package, bump it everywhere in the same
  changeset and re-verify each affected package's own build/typecheck —
  don't let a new split reappear.
- Exact-pinned versions with no caret (like the `mkdirp@0.5.1` and
  `cookie-session@2.0.0` REV-005 found) are a smell, not a deliberate
  safety measure, unless a comment says otherwise. If you find one during
  other work, check whether a same-major patch fixes an open advisory
  and bump it.
- `engines` in root `package.json` should reflect the Node/npm actually in
  use in CI (`.github/workflows/pr.yml`) and be kept in sync when either
  changes — REV-003 and REV-004 already did this for the current Node 22 /
  npm 10 baseline.

## Out of scope for routine hygiene

These are known, deliberately not chased as part of ordinary dependency
maintenance — each is a major migration in its own right:

- Storybook 8 → 10
- Babel 7 → 8
- TypeScript 5 → 7 (a future major, not on the roadmap yet)
- `@anthropic-ai/sdk` modernisation (superseded by AIX-001's rewrite in
  Phase 15)
