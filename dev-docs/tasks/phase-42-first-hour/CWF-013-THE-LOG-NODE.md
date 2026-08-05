# CWF-013 — A cloud function can log, and you cannot find the log

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 6, approved 2026-08-05.
**Status:** open, unowned. Small node, **real** question behind it.

## The node is the easy half

`console.log` in a Function node already works — it is Node's console, because the cloud runtime
runs in the backend's process (TALK-007 §3.1). So a Log node is a thin thing: a message input, a
level enum, a Log signal, pass-through of the value so it can sit inline on a wire.

The question that costs something is **where it comes out**, and there are already three answers in
the codebase:

1. **The structured logger** ([ops/logger.ts](../../../packages/nodegx-backend/src/ops/logger.ts)) —
   one JSON line per event on stdout, `ts`/`level`/`event` always first, **every field passed through
   `redact()` on the way out** so a caller cannot log a secret by accident. This is the backend's
   real log transport (journald / docker / the editor's supervisor).
2. **Execution history** (`noodl-viewer-cloud/src/execution-history`) — per-run records with steps,
   inputs, outputs and errors, with its own scrubber and retention policy.
3. **A bare `console.log`**, which goes to stdout *unstructured* and bypasses both.

Today a function author gets (3). That is the defect: the one path an author can reach is the one
with no redaction, no request id and no way to query it.

## Slices

### Slice 1 — decide the destination, and write it down

Recommendation: **the structured logger, with the request id attached**, and a copy into the
execution record for the run. Rationale: `redact()` is the reason — an author logging a whole
request body should not be able to leak a token, and only path (1) prevents that.

⚠️ The Send Email node is the precedent for a cloud node reaching a backend subsystem in-process
([service.ts:380-382](../../../packages/nodegx-backend/src/service.ts#L380)). Use that seam; do not
invent a second one.

### Slice 2 — the node

- Inputs: message, level (debug | info | warn | error), an optional data object, a Log signal.
- Pass-through output so it can sit on a wire without breaking the chain.
- ⚠️ **A declared `default` never runs its setter** — apply the `info` default in `initialize`.
- ⚠️ Register it **cloud-only**? No — a Log node is useful in the browser too, where it should map to
  the browser console. Same node, two implementations behind one name is a mistake; one node whose
  destination is chosen by the runtime is right.

### Slice 3 — where you read it back

Minimum honest answer, written on the node's page: which of the three destinations it went to, and
the command or panel that shows it. The admin dashboard already serves ops state
(`admin/AdminDashboardRoutes.ts`); execution history already has a panel. **If neither shows it, say
so in the docs rather than shipping a node whose output has no reader.**

## Done when

- A cloud function logs at each level; the lines appear in the structured log with the run's request
  id, and in the execution record.
- A logged object containing something `redact()` recognises comes out redacted — tested, not
  assumed.
- The node page names the reader.

## Traps

- ⚠️ **Volume.** A Log node inside a Run Tasks loop over 10,000 items writes 10,000 lines to stdout
  and into the execution record. Know what the retention policy does with that before shipping;
  execution history already has one, and it is the thing that will fill a disk.
- ⚠️ Logging is the easiest place to leak a secret. This task and
  [CWF-009](CWF-009-THE-SECRET-NODE.md) share that surface — do them in either order, but read the
  other's redaction note.
