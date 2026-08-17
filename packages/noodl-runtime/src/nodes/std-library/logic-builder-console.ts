'use strict';

/**
 * The `console` a block program sees (FIX-004 redaction ruling, option **(b)**).
 *
 * ## The leak this closes, as it was measured
 *
 * `net.noodl.Log` — the *node* — is levelled, carries the request id, lands in the execution
 * record, and is redacted **by key and by value** (CWF-013, `log.ts`, `cloud-log-node.test.ts`).
 * A `noodl_log` **block** compiled to a bare `console.log` and had none of that. FIX-004's drive
 * measured it against a control that fetched the same secret through the same `Secret` node and
 * merely declined to log it:
 *
 *  - control — `console.log('SECRETLEN:' + String(Inputs["secret"]).length)` → no secret, and
 *    `SECRETLEN:29` present, so the wire was live.
 *  - treatment — `console.log(Inputs["secret"])` → **the secret, in the clear, on stdout.**
 *
 * ## ⚠️ Why this shadows `console` instead of changing the generator
 *
 * The ruling's words were *"route the block's generator at `console.log` through the same scrubbed
 * sink"*, which reads as an instruction to emit something other than `console.log`. That was
 * rejected, and the reason is the population rather than the mechanism: **`generatedCode` is a
 * string saved in every existing project**, and every one of those strings already says
 * `console.log`. A new emission would fix programs saved from now on and leave every program
 * already on disk leaking until somebody happened to reopen it and nudge a block.
 *
 * Handing the compiled function a `console` **parameter** fixes both populations at once, because
 * a parameter shadows the global inside a `new Function` body. It also leaves the editor↔runtime
 * contract alone: `noodl_log` still generates `console.log(value);`, which is what
 * `noodl-editor/tests-unit/fix-004/blocks.spec.ts` and
 * `nodegx-backend/tests/cloud-logic-builder-log.test.ts` pin, and those assertions stay true
 * instead of being rewritten to match a new build.
 *
 * ## The browser gets the real console, untouched
 *
 * {@link createBlockConsole} returns the **actual global `console`** when there is no sink, rather
 * than a shim that forwards to it. There is no sink in the browser, so a browser block program's
 * `console.log` is the same call it has always been — no wrapper, no stringification, no
 * behavioural difference to regress, and objects still land in devtools as inspectable objects
 * rather than as text. The `Log` node chooses between its two destinations exactly this way
 * (`log.ts:166-179`) and this module is deliberately the same shape.
 *
 * ## ⚠️ What routing through the sink changes, and it is not nothing
 *
 * On the cloud a block's line stops being a bare stdout write and becomes a `function.log` event:
 * levelled, timestamped, carrying `requestId` and the node id, scrubbed, and recorded as a step in
 * the execution history. That is the point — FIX-004's drive noted the block's probe *"appears in
 * NO JSON line: no timestamp, no level, no `requestId`, no `event`"*. Two consequences follow that
 * a later session should not read as bugs:
 *
 *  - block lines now count against `MAX_LOG_LINES_PER_RUN`, the same cap a `Log` node in a loop
 *    hits, and the cap announces itself once before going quiet.
 *  - they leave by the structured logger's door (`ops/logger.ts` calls `process.stdout.write`
 *    directly) rather than by `console.log`. ⚠️ **A suite that spies only `console.log` will read
 *    that as silence**, which is the same instrument trap `cloud-logic-builder-log.test.ts`
 *    already documents from the other direction — it spies the union of both doors for this reason.
 *
 * ## What this does NOT catch
 *
 * Exactly what the `Log` node does not catch, and for the same reason: the sink can only recognise
 * values **the backend itself provisioned** (`ops/log-scrub.ts`). A credential minted inside a
 * Function node, typed into a parameter, or arriving in a request body has never been seen by the
 * backend and cannot be recognised. Nothing in this module holds a secret, reads one, or can be
 * asked for one — it hands strings to a sink that does its own scrubbing.
 *
 * @module noodl-runtime/nodes/std-library/logic-builder-console
 */

import type { RuntimeLogEntry, RuntimeLogLevel } from '../../runcontext';

/** What {@link createBlockConsole} needs of a run: the one method the `Log` node uses too. */
export type BlockLogSink = (entry: RuntimeLogEntry) => void;

/**
 * Which `RuntimeLogLevel` each console method becomes.
 *
 * `log` and `info` both mean `info` — that is what they mean in every logger — and the block
 * generator only ever emits `log`. The other three are here because a `console` that answers
 * `log` and throws on `warn` would be a worse object than the global it replaces.
 */
const LEVEL_OF: Record<string, RuntimeLogLevel> = {
  log: 'info',
  info: 'info',
  debug: 'debug',
  warn: 'warn',
  error: 'error'
};

/**
 * One console argument as text.
 *
 * ⚠️ Objects are folded into the message string rather than passed as the entry's `data`, and the
 * reason is which redaction pass covers which field. The sink value-scrubs `message` and key-
 * redacts `data`; `redact()` is key-based and *says* it cannot see a secret under an innocent name.
 * A console argument has no name — it is positional — so there is no key to redact it under, and
 * the field that gets the value-based pass is the honest place to put it. Folding to text means one
 * field and one pass that covers every argument.
 */
export function describeArgument(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';

  if (typeof value === 'object') {
    try {
      // A cycle, a BigInt or a throwing `toJSON` all end up at `String(value)` rather than taking
      // down the log line — and a log line that crashes the run it was describing is the worst
      // possible failure mode for a diagnostic.
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch {
      try {
        return String(value);
      } catch {
        // `String()` itself throws on an object with a hostile `toString`.
        return '[unprintable]';
      }
    }
  }

  return String(value);
}

/** `console.log(a, b)` prints `a b`, so the folded message joins on a space too. */
function messageOf(args: unknown[]): string {
  return args.map(describeArgument).join(' ');
}

/**
 * Best-effort copy of the real console, so a method this module does not route still works.
 *
 * Every function is bound to the real console: Node's console methods reach internal state through
 * `this`, so a plain copy called with the shim as receiver is not safe. If an environment enumerates
 * nothing here the five routed methods are still defined below, which is the guarantee that matters
 * — `console.log` is the only method the block generator emits.
 */
function inheritRealConsole(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const real = console as unknown as Record<string, unknown>;

  for (const key in real) {
    const value = real[key];
    out[key] = typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  }

  return out;
}

/**
 * The `console` to hand a block program.
 *
 * @param sink  the run's log sink (`NodeScope.runContext.log`), or nothing in the browser
 * @param nodeId the Logic Builder node, so a line traces back to a place on a canvas
 * @returns the global `console` when there is no sink — see the module note — otherwise a console
 *          whose levelled methods write to `sink` and whose other methods delegate.
 */
export function createBlockConsole(sink: BlockLogSink | undefined, nodeId?: string): Console {
  // No sink is the browser, and the browser keeps the console it already had. Returning the real
  // object rather than a forwarding shim is what makes "no behavioural change off the cloud" a
  // property of the code instead of a claim about it.
  if (typeof sink !== 'function') return console;

  const routed = inheritRealConsole();

  for (const method of Object.keys(LEVEL_OF)) {
    const level = LEVEL_OF[method];

    routed[method] = function (...args: unknown[]): void {
      sink({ level, message: messageOf(args), nodeId });
    };
  }

  return routed as unknown as Console;
}
