# BAK-007: Backups, Export/Import & Dev→Prod Promotion

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-007 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 1 — credibility |
| **Priority** | 🟠 High (a production database you cannot restore is a countdown, not a product) |
| **Difficulty** | 🟠 Medium |
| **Estimated Time** | ~2 weeks |
| **Prerequisites** | WF-004 (service + engine decision); WF-005 (scheduler); BAK-006's file layout if landed |
| **Branch** | `task/bak-007-backups-export-migrations` |
| **Recommended executor** | 🟠 **Opus 4.8** — restore semantics, consistency under WAL, and schema-diff edge cases are where optimism goes to die; every claim needs a demonstrated round-trip. |

## Objective

Make a NodeGX backend's data survivable and movable: consistent scheduled backups with retention and demonstrated restore; per-collection JSON/CSV export and import; a whole-backend archive that doubles as the migration path between machines; and a schema promotion story from a dev backend to a deployed one.

## Background

This is the least glamorous task in the phase and the one that separates products from demos. RUN-004's origin story — silent data loss — earns this track a special obligation to treat persistence with paranoia. Three user stories, one substrate:

1. *"The VPS died."* — scheduled consistent backups, off-box-able, restore documented and tested.
2. *"Get my data in / out."* — CSV/JSON per collection (spreadsheet-shaped import is also the classroom on-ramp: real datasets into lessons in minutes).
3. *"I built it locally; now put it on the server — again, after changes."* — first deploy is easy (copy everything); the *second* deploy is the real feature: schema changed in dev, prod has live data, promote schema without clobbering records.

SQLite makes the core mechanics a gift: the online backup API produces a consistent snapshot without stopping writes (verify availability against WF-004's engine choice — `better-sqlite3.backup()` exists; `node:sqlite`'s equivalent must be confirmed, and `VACUUM INTO` is the fallback), and one file plus the files dir plus config *is* the whole backend.

## Current State

- Nothing: no backup, no export beyond hand-copying `~/.noodl/backends/<id>/`, no import, no promotion story. Schema "migration" today is the adapter's additive auto-add-column behavior only.
- WF-005 (specced) provides the scheduler backups will ride; WF-003 owns deploy docs this task's restore/promotion docs slot into.
- LIB/import work (phase 21) covers *project* import — unrelated to data import here.

## Desired State

- **Backup**: `nodegx-backend backup` (CLI) + admin/API trigger + scheduled via WF-005 with retention (keep-last-N + optional keep-daily/weekly). A backup is one archive: consistent DB snapshot + files dir (BAK-006 layout) + backend config (schemas, triggers, permissions, templates) + a manifest (version, engine, timestamps, content hashes). Written atomically (temp + rename); destination is a local path by default, S3-compatible destination if BAK-006's driver landed. Status (last success/failure, next run) visible in panel/dashboard; failures are loud (execution records + status), never a quietly stale timestamp.
- **Restore**: `nodegx-backend restore <archive>` — service stopped or self-stopping, pre-restore safety snapshot of current state, manifest/hash verification, version compatibility check, then swap. Documented and **tested in CI**: back up a live-written backend, restore on a clean dir, byte-compare logical content.
- **Export/import per collection**: JSON (lossless: types, ACLs, pointers) and CSV (flat; pointers as ids; documented lossy caveats). Import: create-or-upsert by objectId (choose and record collision semantics), dry-run mode reporting what would happen, type coercion per schema with a rejects report — never half-import silently. Both available via CLI, admin routes, dashboard, and MCP.
- **Promotion (schema, not data)**: `nodegx-backend schema diff <source> <target>` → human-readable diff (add table/column/relation/index; destructive ops flagged) → `schema apply` executing additive changes automatically and destructive ones only behind an explicit `--allow-destructive` with a fresh pre-apply backup enforced. Permission/trigger/template config included in the diff (they are config — diffable by nature). The editor's deploy flow (WF-003) gains "promote schema" as a step; data stays put.
- **The whole-backend archive is the migration path**: laptop → VPS is backup + restore. Stated in docs as the blessed move.

## Scope

### In Scope
- [ ] Consistent snapshot mechanics vs. the chosen engine (verify API; `VACUUM INTO` fallback; WAL correctness)
- [ ] Archive format + manifest + atomic write + retention; scheduled via WF-005; status surfaces
- [ ] Restore CLI + safety snapshot + verification; CI round-trip test under concurrent writes
- [ ] JSON/CSV export/import with dry-run, upsert semantics, rejects report
- [ ] Schema diff/apply with destructive-op gating + enforced pre-apply backup
- [ ] Panel/dashboard sections; MCP surface (trigger/list backups, run exports, read diffs)
- [ ] Docs: backup strategy for operators (incl. off-box guidance), restore runbook, promotion workflow
- [ ] S3 backup destination if BAK-006 landed (else recorded follow-on)

### Out of Scope
- Point-in-time recovery / WAL shipping / incremental backups (snapshot-based v1; note as possible follow-on)
- Data merge/sync between live backends (promotion is schema-only by design — two-way data sync is a tarpit)
- Cross-engine restore (archives are engine-versioned; conversion is not claimed)
- Encrypted archives (document "encrypt the destination"; revisit on demand)

## Implementation Steps

1. **Verify snapshot mechanics** against the engine decision; record findings + fallback choice.
2. **Archive format + manifest**; backup CLI/API; atomicity + retention.
3. **Restore** + safety snapshot + CI round-trip under load — before scheduling, before UI.
4. **Scheduling via WF-005** + status surfaces.
5. **Export/import** with dry-run + rejects reporting.
6. **Schema diff/apply** + gates + WF-003 deploy-flow hook.
7. **Surfaces (panel/dashboard/MCP) + docs.**

## Success Criteria

- [ ] CI: backend under continuous writes → backup → restore to clean dir → logical content identical and consistent (no torn records)
- [ ] Scheduled backups run, rotate per retention, and a deliberate failure (unwritable destination) is loudly visible
- [ ] A 10k-row CSV imports with dry-run preview, typed coercion, and a rejects report; re-import upserts idempotently
- [ ] Dev backend with added table/column + changed permissions promotes onto a prod backend with live data; destructive change refuses without the flag and forces a backup first
- [ ] Laptop → clean VPS via backup/restore, following only the docs
- [ ] An agent can trigger a backup, list backups, and read a schema diff via MCP

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Engine's snapshot API gaps (esp. `node:sqlite`) | Step 1 verifies before anything builds on it; `VACUUM INTO` fallback recorded |
| Backup "works" but restore never tested until the emergency | The CI round-trip is the task's centerpiece criterion, not a stretch goal |
| Files/db/config captured non-atomically → torn archives | DB snapshot first, then files with manifest hashing; document the consistency window honestly |
| Schema apply corrupts prod | Additive-only default, destructive gated + forced backup, dry-run diff always shown |
| Import half-completes | Transactional per-collection import; rejects report; dry-run |

## References

- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — engine decision, data-dir layout
- [WF-005](../phase-19-cloud-workflows/WF-005-TRIGGERS.md) — the scheduler; [WF-003](../phase-19-cloud-workflows/WF-003-MANAGED-DEPLOY.md) — deploy flow the promotion step joins
- [BAK-006](./BAK-006-FILE-STORAGE-V2.md) — files layout + S3 destination
- SQLite Online Backup API / `VACUUM INTO` docs; [RUN-004](../phase-16-runtime-deploy-health/RUN-004-STABILIZE-LOCAL-BACKEND.md) — the paranoia mandate

## Checklist

- [ ] Snapshot mechanics verified + recorded
- [ ] Backup/restore + CI round-trip under load
- [ ] Scheduling, retention, loud status
- [ ] Export/import with dry-run + rejects
- [ ] Schema diff/apply + gates + deploy hook
- [ ] Panel/dashboard/MCP; runbook docs; CHANGELOG
