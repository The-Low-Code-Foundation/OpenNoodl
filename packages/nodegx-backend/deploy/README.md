# NodeGX self-hosting assets (WF-003)

The Docker Compose deployment target. **User-facing documentation lives at
[docs/runtime/SELF-HOSTING.md](../../../docs/runtime/SELF-HOSTING.md)** — happy
path, configuration, rollback, troubleshooting. This file is the map for
someone changing these assets.

```bash
cd packages/nodegx-backend/deploy
./nodegx-deploy.sh deploy --app /path/to/exported/app --site-url https://apps.example
```

## What is here

| File | Role |
|---|---|
| `nodegx-deploy.sh` | The driver: `build`, `up`, `deploy`, `versions`, `rollback`, `status`, `logs`, `down` |
| `docker-compose.yml` | Two services. `web` publishes one port; `backend` publishes none |
| `Dockerfile.backend` | `node:22.23-alpine` + the packaged bundle. No build stage — see its header |
| `Dockerfile.web` | `nginx:1.29-alpine` + `nginx.conf` + the app |
| `nginx.conf` | The single-origin front door: static app, SPA fallback, API proxy, SSE passthrough |
| `entrypoint.sh` | Env → CLI flags, `*_FILE` secrets, and the first-run production security policy |
| `security.production.json` | The policy written on first run: the shipped default with `devOpen: false` |
| `env.example` | Copy to `.env` |
| `.dockerignore` | Keeps `.env` and `secrets/` out of the build context |
| `artifact/` | Build product of `scripts/package-deploy.js` (git-ignored) |

## The three decisions worth knowing before you edit

**One origin.** nginx serves the app and forwards the backend's route families
on the same port. A NodeGX app has its backend endpoint baked in at export time
and cannot be reconfigured afterwards, so reducing the number of distinct URLs
is the highest-leverage thing this design does. The cost is that `nginx.conf`
must know the backend's top-level paths; `tests/deploy-assets.test.ts` starts a
real service and fails if the list falls behind, so that cost is paid by a test
rather than by production.

**The image is built from a packaged artifact, not from source.** The build id
is the artifact's own content digest, which is what makes rollback a name
(`rollback 09cbcd63b440`) instead of a date. `scripts/package-deploy.js` is
where determinism, sourcemap exclusion, the credential scan, and the
baked-endpoint audit live.

**The entrypoint writes `security.json` on first run.** Not a convenience: the
backend's default policy has `devOpen: true`, and BAK-003's interlock refuses
any non-loopback bind while that is set — so an unprovisioned first run would
greet the operator with a hard error about a file they have never heard of.
Writing the locked policy first makes the interlock a backstop instead of the
onboarding experience. An existing `security.json` is never modified.

## Verification

`npm test` in `packages/nodegx-backend` covers the assets statically
(`tests/deploy-assets.test.ts`) and the credential lifecycle these assets depend
on (`tests/deploy-credential-stability.test.ts`). Container-level behaviour —
build, up, rollback, persistence, the interlock — is not in CI; the runs that
were performed are recorded in
[WF-003-NOTES.md](../../../dev-docs/tasks/phase-19-cloud-workflows/WF-003-NOTES.md).
