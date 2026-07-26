# Changelog — @noodl/nodegx-backend

## Unreleased

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
