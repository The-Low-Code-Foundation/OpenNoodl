/**
 * BAK-009: the suite spins up dozens of real HTTP servers, and each one now
 * emits a structured access line per request. Silencing the process-wide logger
 * here keeps test output readable WITHOUT any test having to know about
 * logging — and it exercises the env override (`NODEGX_LOG_LEVEL` beats
 * ops.json) that an operator uses on a live service.
 *
 * Tests that assert on log OUTPUT construct their own `Logger` with a capture
 * function, so they are unaffected by this.
 */
process.env.NODEGX_LOG_LEVEL = process.env.NODEGX_LOG_LEVEL || 'silent';
