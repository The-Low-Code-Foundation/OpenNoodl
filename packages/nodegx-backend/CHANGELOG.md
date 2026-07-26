# Changelog — @noodl/nodegx-backend

## Unreleased

### WF-003 — One deploy target: Docker Compose self-hosting

- **Deploy target**: Docker Compose on a machine you control, chosen against the
  task's criteria (SQLite-on-a-filesystem rules out ephemeral managed platforms;
  the education wedge's data-residency constraint is a hard exclusion, not a
  preference; no account and no card for a beginner). Reasoning recorded in
  `dev-docs/tasks/phase-19-cloud-workflows/WF-003-NOTES.md`.
- **One origin**: nginx serves the exported app and forwards the backend's route
  families on a single published port; the backend publishes none. A NodeGX app
  has its backend endpoint baked in at export time with no post-deploy override,
  so fewer distinct URLs means fewer ways that value is wrong — and CORS,
  firewall rules and TLS collapse to one of each. BAK-005's dashboard is served
  at `/_admin` on the same origin (its client calls absolute root paths, so the
  backend must be at the origin root).
- **Deterministic artifact**: `scripts/package-deploy.js` stages backend bundle +
  app + a `MANIFEST.json` of every file's sha256; the build id is the artifact's
  own content digest (verified stable across runs), which is what makes a
  rollback target a name. Sourcemaps are excluded from the artifact.
- **No credentials in artifacts, verified**: the packager scans every byte for
  credential values (keys, JWTs, serialised admin tokens, connection strings)
  and machine-local files (`secrets.json`, `.env`, `*.db`, `*.pem`) and **fails
  the build** on a hit. Tested against planted secrets and against the real
  bundle's vocabulary.
- **Baked-endpoint audit**: reads `metadata.cloudservices` out of the app bundle
  and refuses to package an endpoint that is not the declared `--site-url` —
  the silent, late deploy failure (app renders, never loads data, works on the
  developer's machine) turned into a build error.
- **Deploy interlock preserved and made survivable**: `entrypoint.sh` writes a
  `devOpen: false` policy on first run only, because the shipped default is
  `devOpen: true` and BAK-003's interlock would otherwise make every fresh
  container's first experience a hard refusal. An existing policy is never
  modified; a promoted dev directory gets an explanation naming that cause. No
  escape hatch — the refusal was confirmed in a container (exit 1).
- **Tested rollback**: images tagged by build id, outgoing tag recorded before
  the new one takes over, refusal to roll back to images not on the machine, and
  reversible (roll-forward is the same command). Exercised for real: deploy →
  redeploy → rollback → roll-forward, with data intact throughout.
- **Fix — the admin credential of a deployed backend rotated on every restart.**
  `resolveOptions()` minted an `authToken` on any non-loopback bind (a WF-004-era
  net); `SecurityState` reads a non-null token as an operator's choice and wrote
  it over the stored one, so the dashboard's credential changed on every reboot
  and the first-run "here is where to find it" message never printed. The mint is
  gone; `SecurityState` is the sole owner. Pinned by
  `tests/deploy-credential-stability.test.ts`.
- **Docs**: user-facing runbook at `docs/runtime/SELF-HOSTING.md` (happy path,
  configuration, credentials, TLS, rollback, troubleshooting, reserved paths),
  ending with an honest pointer to Phase 18 code export as the general answer for
  other hosting — noted as a roadmap item, because it is 0/5 and not started.
- **Reuse**: no second backup/restore or promotion path (BAK-007's is referenced
  from the rollback docs, not reimplemented), no second secrets convention (the
  `_FILE` env indirection feeds the existing `--token`/SecretsStore path), no new
  runtime dependency, and no new route or abstraction in the service itself —
  `HttpServer.ts` is untouched.

### BAK-007 — Backups, export/import & dev→prod promotion

- **Backup**: consistent whole-backend archive (`.ngxbackup.tar.gz`) = DB
  snapshot + files + workflows + diffable config + a hashed manifest, written
  atomically (temp + rename). Snapshot mechanism is the `node:sqlite` online
  backup API when available, `VACUUM INTO` as the documented fallback (verified
  at runtime; recorded in the manifest). Retention (keep-last-N + keep-daily +
  keep-weekly). CLI `backup`, admin `POST/GET /admin/backups`,
  `PUT /admin/backups/config`, and **scheduled backups riding WF-005's
  CronScheduler** (one scheduler, two consumers — no second cron loop).
- **Restore**: CLI `restore` + `POST /admin/backups/restore` — manifest/hash
  verification, engine-compatibility check, a forced pre-restore safety snapshot,
  then swap, then an `integrity_check`. Demonstrated by a **CI round-trip test**
  (live-written backend → backup → restore to a clean dir → row-identical) plus a
  snapshot-under-concurrent-writes consistency test (no torn records).
- **Export/import per collection**: lossless JSON and flat CSV; import is
  create-or-upsert by objectId (idempotent), transactional per collection, with a
  dry-run preview, typed coercion, and a rejects report. CLI `export`/`import`,
  admin `GET /admin/export/:collection`, `POST /admin/import/:collection`.
- **Promotion (schema, not data)**: `schema diff`/`apply` (CLI + admin
  `/admin/schema/diff`·`/apply`) — additive changes (tables, columns,
  permissions, triggers, templates) apply automatically; destructive changes are
  refused without `--allow-destructive` and force a pre-apply backup. Data is
  never clobbered.
- **Loud failure (RUN-004)**: every backup/restore/export/import/promotion run
  emits an execution record through the shared WF-006 ExecutionHistory; a failed
  backup is a failed record + a `backups.json` failure status, never a stale
  timestamp.
- **MCP**: read tools `list_backend_backups`, `export_backend_collection`,
  `diff_backend_schema`; write tools `run_backend_backup`,
  `set_backend_backup_policy`, `import_backend_collection`, `apply_backend_schema`,
  `restore_backend`.
- **Docs**: operator runbook at `docs/BACKUP-RESTORE.md` (backup strategy,
  off-box guidance, restore runbook, promotion workflow, laptop→VPS).
- **Reuse**: no second scheduler (WF-005 `CronScheduler`), no second secrets
  module (backups need none in v1 — S3 destination + a `backups` secrets
  namespace are recorded follow-ons pending BAK-006), no second execution-record
  path (the WF-006 substrate via `ExecutionHistory`).
