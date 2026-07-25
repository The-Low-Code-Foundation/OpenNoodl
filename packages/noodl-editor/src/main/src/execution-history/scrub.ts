/**
 * Redact secrets before request metadata reaches the execution-history store.
 *
 * WF-004 moved the implementation next to the store it protects —
 * `noodl-viewer-cloud/src/execution-history/scrub.ts` — because the standalone
 * backend service logs executions in its own process and must scrub with the
 * same rules. This module stays as the editor-side import path (and keeps the
 * WF-006 tests anchored where they were written).
 */

export {
  scrubHeaders,
  scrubValue,
  scrubRequestForLogging,
  type ScrubbedRequestSummary
} from '@noodl-viewer-cloud/execution-history';
