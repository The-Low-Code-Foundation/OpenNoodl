# BAK-006: File Storage v2 — Metadata, Transforms, S3 Driver

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-006 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 2 — parity |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | WF-004 (`/files` routes); BAK-003 (private-file access checks) |
| **Branch** | `task/bak-006-file-storage-v2` |
| **Recommended executor** | 🟢 **Sonnet 5** — storage-driver interface, transform endpoint, and validation are specified below; success is mechanically verifiable. |

## Objective

Grow WF-004's raw `/files` upload into real file handling: tracked metadata, validation and limits, private files under the permission model, on-the-fly image thumbnails with caching, and an optional S3-compatible storage driver for operators who want files off the VPS disk.

## Background

WF-004 ships `/files/<name>` upload/delete storing beside the data dir — enough to make the File type work, nothing more. Every real app immediately wants the next four things: *don't let anyone upload a 2 GB file*, *serve avatars as thumbnails, not originals*, *these files are private to their owner*, and — from self-hosters with small VPS disks — *put files in object storage*. All four are bounded, conventional work. Pocketbase's file handling (per-file rules, thumb sizes on request, S3 option) is the parity benchmark.

**The native-dependency trap, named up front:** image transforms want `sharp`, which is a native module — the exact species of dependency RUN-004 exists to atone for. The service runs on system Node (WF-004), where sharp's prebuilds are routine, so this is acceptable — but only under the loud-failure doctrine: sharp is an **optional** dependency; when it fails to load, uploads and originals work fine, transform requests return an explicit 501 with the reason, and the status surfaces in the panel/dashboard. No silent degradation, and absolutely no pure-JS fallback resizer quietly producing different bytes.

## Current State

- WF-004 (specced): `/files/<name>` upload/delete to local disk; Parse File type round-trips through the wire subset.
- No metadata table, no size/type limits, no transforms, no storage abstraction, no access control on reads.
- BAK-003 defines the permission vocabulary files will consume; BAK-007 will need to include files in backups (its concern — but the layout this task chooses must not make that hard).

## Desired State

- **Metadata**: a `_Files` system table — name, size, content type, hash, storage driver, owner, created — kept transactionally consistent with the blobs; orphan sweep job (via WF-005 schedule) for blobs without rows and rows without blobs, reporting loudly rather than auto-deleting by default.
- **Validation**: per-backend max file size and content-type allow/deny lists, enforced at upload with clear errors; content type sniffed, not trusted from the client; uploaded names sanitized; stored names collision-proofed (hash-based layout).
- **Access control**: public files (default, current behavior) and private files — read gated through BAK-003 (`owner`/ACL on the metadata row). Private reads happen via short-lived signed URLs minted by the service (decide TTL; record) so `<img src>` still works in apps.
- **Transforms**: `GET /files/<name>?thumb=WxH` (fit/crop modes; a small named-preset list per backend rather than arbitrary dimensions from the public internet — decide, record; arbitrary sizes admin-only) backed by sharp when available; results cached on disk beside the original with cache invalidation on file replace; correct `Cache-Control`/`ETag`.
- **Storage driver interface**: `put/get/delete/stream/stat` — implementations: local disk (default) and S3-compatible (endpoint/bucket/keys per backend config; works with MinIO for tests). Driver chosen per backend at creation; migration between drivers is a documented manual procedure in v1, not a button.
- **Client surface**: existing File nodes keep working untouched; upload node gains progress + error outputs if absent (verify); catalog entries updated; MCP can read/set the file config (limits, presets, driver).

## Scope

### In Scope
- [ ] `_Files` metadata + transactional consistency + orphan sweep (report-mode default)
- [ ] Size/type validation, sniffing, name hygiene, hash layout
- [ ] Private files via BAK-003 + signed URLs
- [ ] Thumb endpoint + presets + cache + headers; sharp-optional with loud 501 status
- [ ] Driver interface; local + S3-compatible drivers; MinIO-based driver conformance tests
- [ ] Panel/dashboard config section; MCP surface; catalog updates
- [ ] Layout documented for BAK-007's backup inclusion
- [ ] Docs: limits, private files, S3 setup, the sharp caveat

### Out of Scope
- Video/audio processing, PDF rendering, arbitrary transform pipelines
- CDN integration beyond correct cache headers
- Driver-to-driver migration tooling (documented manual procedure only)
- Resumable/multipart uploads (note if demanded; not v1)
- Per-file virus scanning

## Implementation Steps

1. **Driver interface + local driver refactor** of WF-004's routes; conformance test suite.
2. **Metadata + validation + hygiene** (the security-relevant half — before features).
3. **S3 driver** against MinIO in CI; live spot-check against one real S3-compatible service.
4. **Private files + signed URLs** on BAK-003's model.
5. **Transforms** with the sharp-optional posture and cache.
6. **Config surfaces + MCP + catalog; orphan sweep; docs.**

## Success Criteria

- [ ] Oversized/disallowed uploads rejected with actionable errors; a PNG renamed `.pdf` is stored as what it is
- [ ] Private file: owner reads via signed URL in an `<img>`; another user's fetch is denied; expired signature denied
- [ ] `?thumb=` serves a cached thumbnail with correct headers; with sharp absent, originals fine + explicit 501 + visible status
- [ ] Same app works unchanged on local and S3 drivers; conformance suite green on both
- [ ] Orphan sweep finds a planted orphan and reports it without deleting
- [ ] MCP exposes file config; docs verified cold

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| sharp reintroduces native-module pain | Optional-dependency posture + loud 501; service runs system Node where prebuilds are routine |
| Transform endpoint as DoS vector (arbitrary sizes) | Named presets public, arbitrary admin-only; cache; BAK-009 rate limits |
| Metadata and blobs drift | Transactional writes + the sweep; conformance tests include crash-between-steps cases |
| S3 driver correctness varies by provider | MinIO in CI + one real provider verified; conformance suite is the contract |
| Signed URLs leak via logs/referrer | Short TTL, path-scoped signatures; decide TTL consciously and record |

## References

- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — the `/files` baseline
- [BAK-003](./BAK-003-ACCESS-CONTROL.md) — the permission model private files consume
- [BAK-007](./BAK-007-BACKUPS-EXPORT-MIGRATIONS.md) — backup inclusion contract
- Pocketbase file handling — parity benchmark

## Checklist

- [ ] Driver interface + conformance suite; local + S3
- [ ] Metadata, validation, hygiene, orphan sweep
- [ ] Private files + signed URLs; transforms with sharp-optional posture
- [ ] Config + MCP + catalog; docs; CHANGELOG
