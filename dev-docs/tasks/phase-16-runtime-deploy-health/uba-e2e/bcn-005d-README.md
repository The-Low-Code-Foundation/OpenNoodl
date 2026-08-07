# BCN-005 schema sync (worker D) — the harnesses

Written for the editor's half of BCN-005: giving the authoritative relation parsers a
caller, and re-auditing the other three schema parsers against live servers.

| File | What it does |
|---|---|
| `bcn-005d-schema-capture.mjs` | Captures the **raw** schema payloads every editor parser is fed, from all four live servers, into `*.json` beside itself. The test fixtures in `noodl-editor/tests/models/BYOBRelationSync.test.ts` are trimmed-but-unedited slices of these. |
| `bcn-005d-schema-sync-driver.mjs` | Drives the editor's **own** sync functions (bundled with esbuild) against the live rig: 31 checks with four negative controls. |
| `bcn-005d-mutate.sh` | Breaks the implementation eleven ways, rebuilds and re-drives the driver each time. |

Both drivers import an esbuild bundle of
`noodl-editor/src/editor/src/models/BackendServices/schemaParsers.ts` at
`parsers2.mjs`, and of `publishSafe.ts` at `publishsafe.mjs`, in the directory they are
run from. `bcn-005d-mutate.sh` builds them; to run the driver alone:

```bash
npx esbuild packages/noodl-editor/src/editor/src/models/BackendServices/schemaParsers.ts \
  --bundle --format=esm --platform=node --outfile=<dir>/parsers2.mjs
npx esbuild packages/noodl-editor/src/editor/src/models/BackendServices/publishSafe.ts \
  --bundle --format=esm --platform=node --outfile=<dir>/publishsafe.mjs
cd <dir> && node bcn-005d-schema-sync-driver.mjs
```

⚠️ **The Parse server is mounted at `/parse`**, not the root — `GET /schemas` on :8092 is
a 404 HTML page.

⚠️ **The rig is shared.** Do not assert an exact collection or row count; another
worker's fixture will change it and the failure will look like a defect in this code. The
`?perPage=5` truncation check asserts `totalItems > 5` for exactly that reason.

Findings: [`BCN-005-NOTES-SCHEMASYNC.md`](../../phase-34-one-backend-contract/BCN-005-NOTES-SCHEMASYNC.md).
