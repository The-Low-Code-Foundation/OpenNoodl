# OPS-005: Observability Plumbing & the Analytics Module

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-005 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 2 — visibility |
| **Priority** | 🟠 High — and the plumbing half is the only irreversible thing in the phase |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | OPS-001 (ladder), OPS-002 (build identity supplies the release id) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Every artifact NodeGX builds captures the things that cannot be captured retroactively — source maps,
a release id, an environment tag — whether or not the user has switched on any dashboard. Switching on
a dashboard is then one optional module.

## Background

This is the one chapter whose argument is about *time*, and it is worth quoting because it is the whole
justification for doing anything at Playing level:

> "Source maps must be uploaded at build time. […] If the map was never uploaded, the error is
> permanently undebuggable. You can't go back and de-minify it."
>
> "The asymmetry is the whole point: *setting up* the plumbing is cheap and reversible […] But *not
> having it* is irreversible — you cannot retroactively create data that was never captured."

In a code project this requires the user to edit a deploy script, add a CI build-arg, and remember a
`posthog-cli sourcemap upload` invocation — which is why the chapter's client hit production with eight
gaps and two of them were unfixable.

**NodeGX owns the build.** The irreversible half can be automatic and unskippable, at zero user cost,
for every project regardless of declared level. That is a thing Bubble does for you and no open tool
does at all.

The chapter's second argument matters for scoping: six of its eight gaps are features of a single
error-tracking product, and it recommends consolidating on PostHog rather than adding a second vendor.
It also draws a line this task must respect — **application errors and infrastructure uptime are
different axes**, and pointing Prometheus at application errors throws away every stack trace.

## Current State

| Piece | State |
|---|---|
| Export bundling | esbuild/webpack per target; source maps not retained or uploaded |
| Release identity | OPS-002 supplies `buildId` — nothing consumes it as a release |
| Environment tag | none; a dev preview and a production deploy are indistinguishable downstream |
| Error capture in the viewer | NDA-004 built a runtime error channel + `On App Error`; it terminates in-app |
| Module system | LIB-003 — manifest + `Noodl.defineModule`, injected at preview/deploy |
| Uptime monitoring | none |

## Desired State

### 1. The irreversible half, always on

For every artifact, at every level, with no setting to find:

- **Source maps generated and retained**, associated with the `buildId`. Where the target allows,
  stripped from the served bundle and kept in the artifact's sidecar; where it does not, retained and
  clearly marked.
- **The release id is the `buildId`.** OPS-002 already computes a content digest; it is the release
  identifier, and reusing it means an error is traceable to an artifact the Ops panel can describe.
- **An environment tag** — `preview` \| `development` \| `production`, derived from the deploy target
  and the declared level, never guessed at runtime.

Two readiness items, both flagged `irreversible` (OPS-001 §4): `ops.sourcemaps` and
`ops.release-tagging`, both at **Live** — visible from Sharing as deferred, so the "cheap now,
impossible later" sentence is read *before* it matters.

### 2. The runtime error channel reaches somewhere

NDA-004 built the channel and the `On App Error` node, and found (FINDINGS H-ii/H-iii) that
`createConsoleErrorSubscriber` was unreachable outside a deployed browser build, so SSR and SSG
produced no console output at all for a raised failure. That channel is the correct tap.

- A raised runtime failure becomes a `runtime-error` **finding** (OPS-003) when the app is running at
  Playing or Sharing — the local, no-vendor path, and the one a hobbyist gets for free.
- At Live and Scale it additionally forwards to whatever the analytics module has registered.
- The two are independent: an app with no module still records its own errors somewhere the AI can
  read them.

### 3. The analytics module

One optional module (LIB-003) providing error autocapture, session replay, release association and
alerting, with the source-map upload step wired into the export rather than into a deploy script the
user has to edit. PostHog first, per the chapter's reasoning; a self-hosted Sentry-compatible target
(GlitchTip) as the second, for users who will not send data to a vendor.

**The module is never a dependency.** Uninstalling it must leave §1 and §2 intact.

### 4. Uptime is a separate axis and is treated as one

The chapter is emphatic that infra uptime and application errors are different concerns. So:

- An **uptime check** readiness item at Live, satisfied by registering the app's health URL with
  something — a hosted checker, or an Uptime Kuma instance the user runs. Where DEP-005/DEP-006
  provision a machine, offer to provision the check alongside it; where they do not, accept a URL and
  a verification ping.
- No metrics stack in the product. At Scale, link out.

### 5. Alerting, three shapes only

The chapter's observation that AI adds nothing to authoring alert conditions is right, and this task
takes it literally. Three toggles, no expression language:

1. a new kind of error appeared
2. error count over a threshold in a window
3. errors after a release that were not there before

Delivered to email (BAK-002 owns SMTP) or a webhook. **Point the AI at investigating fired alerts, not
at authoring conditions.**

## Implementation Steps

1. Source-map generation and retention per target; decide and document the **generate → associate →
   strip → package** ordering once, in one place.
2. `buildId` as release id; environment tag derivation.
3. The two irreversible readiness items, with their sentence.
4. NDA-004's channel → `runtime-error` findings, in every runtime including SSR/SSG (H-ii is the
   warning here: verify in a *deployed* build, not a preview).
5. The analytics module + upload step; prove uninstall leaves §1/§2 working.
6. Uptime item; provisioning path where a deploy target supplies a machine.
7. The three alert shapes.
8. **Live pass**: deploy, throw a real error from a real node in a *minified production build*, and
   read a legible stack trace naming the node. That single demonstration is the point of the task.

## Success Criteria

- [ ] Source maps and a release id are produced for every target with no user action.
- [ ] A production, minified, deployed build produces a **legible** stack trace for a thrown error —
      demonstrated, screenshotted.
- [ ] SSR and SSG produce error output (the H-ii regression does not recur).
- [ ] The two irreversible items carry the marker and the sentence, and are visible as deferred from
      Sharing.
- [ ] Uninstalling the analytics module leaves error findings and source maps intact.
- [ ] Environment tags never mix a preview with production.
- [ ] The three alert shapes fire; a fired alert links to something an AI can investigate.
- [ ] No metrics stack was added to the product.

## Out of Scope

- **Prometheus/Grafana in-product.** Different axis, explicitly rejected by the chapter for
  application errors and overkill for the infra half at this scale.
- **Native mobile crash reporting.** The chapter's gap 3 is conditional on a Capacitor build. NodeGX
  has no mobile target in flight.
- **Session replay UI in the editor.** The module's vendor owns that surface; we link to it.
- **Deciding a default vendor for everyone.** PostHog first because the chapter's reasoning is sound
  and the MCP-server angle fits our AI loop. It stays a module.

## Traps

- **The ordering is load-bearing.** Generate maps, associate them with the release, *then* strip them
  from the served bundle, *then* package. Any other order ships either an unusable map or a public one.
- **Shipping source maps publicly is a security decision, not a default.** Decide it explicitly per
  target and write the decision down; "it worked" is not evidence it was intended.
- **NDA-004 found `if (this.editorConnection)` is always true**, which made a whole error path
  unreachable in every non-browser runtime while appearing to work. Verify this task's tap in SSR and
  SSG deployed builds specifically, not in preview.
- **`On App Error` was registered, working, and absent from the curated picker index** (NDA-004,
  2026-07-30) — so every fixture that measured it had hand-written `project.json`. If this task adds a
  node or a port, regenerate the catalog and confirm it is *creatable*, not merely present.
- **An error tracker with no environment tag mixes your own preview errors with your users'** and the
  dashboard becomes noise within a week. Tag before shipping the module, not after.
- **Do not let the module become load-bearing for §1.** The tempting refactor is to move source-map
  upload into the module because that is where the API key lives. Then a user who uninstalls it loses
  the irreversible half silently.
</content>
