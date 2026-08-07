# NodeGX

[![PR](https://github.com/The-Low-Code-Foundation/NodeGX/actions/workflows/pr.yml/badge.svg?branch=cline-dev)](https://github.com/The-Low-Code-Foundation/NodeGX/actions/workflows/pr.yml)

NodeGX is a visual, node-based app builder — design the UI, wire up logic, and connect
a backend without hand-writing the plumbing. It's a fork of [Noodl](https://noodl.net)
(GPL-3.0), continued and extended by The Low Code Foundation after the original project
stopped shipping.

This is an **alpha**. Expect rough edges, and please [report what you find](https://github.com/The-Low-Code-Foundation/NodeGX/issues/new/choose) — a working feedback loop is one of the things this phase of the project exists to build.

## Installing NodeGX

**[Download the latest release](https://github.com/The-Low-Code-Foundation/NodeGX/releases/latest)** — pick the artifact for your platform.

- **macOS**: signed and notarized — no Gatekeeper prompt.
- **Windows**: not yet code-signed, so Windows SmartScreen will warn on first run ("Windows protected your PC" → More info → Run anyway). This is expected for a new, unsigned publisher and improves over time; see [`INSTALLING-UNSIGNED-BUILDS.md`](dev-docs/guidelines/INSTALLING-UNSIGNED-BUILDS.md).
- **Linux**: AppImage and `.deb`, unsigned (normal for Linux desktop distribution).

Version-pinned download links go stale silently — they keep resolving, just to the
wrong thing — so this points at the release list instead, which cannot.

## Documentation

**[Docs site](https://the-low-code-foundation.github.io/NodeGX/)** — concepts, a
getting-started tutorial, and a generated reference page for every node in the library.

## Community

Questions, feedback, and general discussion happen on
**[Discord](https://discord.gg/dZw4w5pKf9)**. For bugs and feature requests, please
[open an issue](https://github.com/The-Low-Code-Foundation/NodeGX/issues/new/choose)
instead — it's the only channel that becomes a tracked, triaged queue.

## The backend

NodeGX ships its own backend (`nodegx-backend`) — a standalone Node service, not a
third-party dependency you have to provision separately. It gives your app:

- **Cloud functions** — a component in your project (nodes and wires, same authoring
  model as the rest of NodeGX) that runs server-side and answers one request at a time.
- **Workflows** — a step-based process (branch, retry, wait, transform…) that a webhook,
  a schedule, or a record change can trigger, and that can itself call your cloud
  functions to do the work.

In short: a workflow orchestrates, a cloud function computes, and a workflow calls
cloud functions when it needs one done. Data storage, auth, and file storage are built
in — nothing to stand up separately to get started.

## Building from source

```bash
# Install all dependencies
npm install

# Start the editor and build a production version of the cloud and React runtimes
# (useful when running NodeGX from source but deploying to production)
npm start

# Start the editor and watch the filesystem for runtime changes — development
# builds, not meant for production (larger, with source maps)
npm run dev

# Run the editor's test suite
npm run test:editor
```

## Contributing

We welcome contributions! To contribute:

1. **Fork the repository** and create your feature branch (`git checkout -b feature/my-feature`).
2. **Make your changes** and follow the existing code style.
3. **Test your changes** locally.
4. **Commit your changes** (`git commit -am 'Add new feature'`).
5. **Push to your branch** (`git push origin feature/my-feature`).
6. **Open a pull request** describing your changes.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details, or ask on
[Discord](https://discord.gg/dZw4w5pKf9) if you have questions.

## Licenses

This repository contains two different licenses for different parts of the platform:

- Components related to the **editor** (used to build NodeGX projects) are **GPL-3.0**.
- Components related to the **end applications** (what NodeGX deploys) are **MIT** — so
  you can make project-specific runtime changes without having to redistribute them.

Packages licensed under MIT:

- `noodl-runtime`
- `noodl-viewer-cloud`
- `noodl-viewer-react`
- `nodegx-backend`
- `nodegx-backend-contract`

Each carries its own `LICENSE` file. The rest of the repository is GPL-3.0.
