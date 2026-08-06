'use strict';

/**
 * Log (CWF-013) — a line an author can write, in a place someone can read.
 *
 * ## The node is the easy half
 *
 * `console.log` inside a Function node already worked — it is Node's console, because the cloud
 * runtime runs in the backend's process. The defect CWF-013 names is *where it comes out*: three
 * log destinations exist in the codebase and the only one an author could reach was the bare
 * `console.log`, which is unstructured, carries no request id, has nothing to query it with, and
 * — the part that matters — passes through **no redaction at all**.
 *
 * ## One node, two destinations, no `if (cloud)`
 *
 * The task considered registering this cloud-only and rejected it: a browser app wants a log line
 * too. Two implementations behind one name would be a mistake, so instead the *runtime* chooses.
 * The cloud runner attaches a `log` sink to the run's `NodeScope.runContext`
 * (`src/runcontext.ts`); nothing does in the browser, so the browser falls through to the console.
 * The node contains one branch and no knowledge of which runtime it is in.
 *
 * ## ⚠️ What stops this node printing a secret
 *
 * Three layers, and it is worth being exact about which one catches what, because the obvious
 * answer is wrong:
 *
 *  1. **`Data` is key-redacted** by the backend sink, through the service's one `redact()` door.
 *     That catches `{ apiKey: … }`, `{ password: … }`, an Authorization header — anything whose
 *     NAME says it holds a credential.
 *  2. **`Message` is value-redacted** by the backend sink against the values the backend actually
 *     holds. Key-based redaction cannot touch free text — `redact()`'s own comment says so: *"a
 *     secret stored under an innocent name is not caught"* — and a `Log` node's message is the
 *     purest free text in the product. `Secret → Log` is a two-node graph an author will write on
 *     their first afternoon. So the sink knows the project's provisioned secret values and
 *     replaces them wherever they appear, in the message and in the data.
 *  3. **Nothing here logs the value on its own account.** No `getInspectInfo` on the value, no
 *     console line on a failure path.
 *
 * Layer 2 lives in the backend and not here on purpose: this module must never be able to see a
 * secret's value, and a browser bundle containing the list of the backend's secrets would be the
 * exact failure the Secret node is registered cloud-only to avoid.
 */

import type { InputPortDefinition, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';
import type { RuntimeLogEntry, RuntimeLogLevel } from '../../runcontext';

import { outcomeOutputs } from '../../outcome';

const LEVELS: RuntimeLogLevel[] = ['debug', 'info', 'warn', 'error'];

interface LogNodeInstance extends NodeInstance {
  _internal: {
    message?: string;
    level: RuntimeLogLevel;
    data?: unknown;
    value?: unknown;
  };
  _write(token?: unknown): void;
}

const LogNode: NodeDefinitionOptions = {
  name: 'net.noodl.Log',
  displayNodeName: 'Log',
  docs: 'https://docs.noodl.net/nodes/utilities/log',
  category: 'Utilities',
  color: 'default',
  /**
   * ⚠️ A declared `default` never runs its setter, so this line is the real default and the
   * `default: 'info'` on the port below is only what the property panel shows. The setter falls
   * back as well (`LEVELS.indexOf(value) === -1`), because a port cleared in the panel arrives as
   * `''` — the same shape as the `length || 32` bug that shipped 32 bytes for `Length: 0`.
   */
  initialize: function (this: LogNodeInstance) {
    this._internal.level = 'info';
  },
  inputs: {
    message: {
      type: 'string',
      displayName: 'Message',
      group: 'General',
      description:
        'The line to write. Free text, so keep credentials out of it by habit — the backend does ' +
        'scrub the values of its own stored secrets out of this before it is written, but that ' +
        'cannot cover a credential it never issued',
      set: function (this: LogNodeInstance, value: string) {
        this._internal.message = value;
      }
    },
    level: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Debug', value: 'debug' },
          { label: 'Info', value: 'info' },
          { label: 'Warning', value: 'warn' },
          { label: 'Error', value: 'error' }
        ]
      },
      displayName: 'Level',
      group: 'General',
      default: 'info',
      description:
        'How loud this line is. In a cloud function the backend drops anything below its ' +
        'configured level, so Debug lines cost nothing in production unless someone turns them on',
      set: function (this: LogNodeInstance, value: RuntimeLogLevel) {
        this._internal.level = LEVELS.indexOf(value) === -1 ? 'info' : value;
      }
    },
    data: {
      type: 'object',
      displayName: 'Data',
      group: 'General',
      description:
        'An optional object written alongside the message as structured fields. In a cloud ' +
        'function every property whose NAME says it holds a credential is redacted on the way out',
      set: function (this: LogNodeInstance, value: unknown) {
        this._internal.data = value;
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      group: 'General',
      description: 'Passed straight through to the Value output, so this node can sit inline on a wire',
      set: function (this: LogNodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    },
    log: {
      type: 'signal',
      displayName: 'Log',
      group: 'Actions',
      description: 'Writes the line. Nothing is written until this fires',
      valueChangedToTrue: function (this: LogNodeInstance) {
        this._write(this.beginOutcome());
      }
    } as InputPortDefinition
  },
  outputs: {
    value: {
      type: '*',
      displayName: 'Value',
      group: 'Value',
      description: 'Whatever arrived on the Value input, unchanged — this node never alters what passes through it',
      getter: function (this: LogNodeInstance) {
        return this._internal.value;
      }
    },
    // No `Failure`: a log line that could refuse would be a log line an author has to handle, and
    // there is no useful thing to do about one. No `Unchanged`: every Log writes.
    ...outcomeOutputs({ done: 'Fires once the line has been written' })
  },
  methods: {
    _write: function (this: LogNodeInstance, token?: unknown) {
      const internal = this._internal;
      // ⚠️ `|| 'info'` rather than trusting the field: several suites build a node as a bag of
      // bound methods and never call `initialize`, which is the shape that leaves an eagerly-set
      // field `undefined` exactly where the first invocation reads it (Send Email records this).
      const level: RuntimeLogLevel = internal.level || 'info';
      const message = internal.message === undefined || internal.message === null ? '' : String(internal.message);

      const entry: RuntimeLogEntry = { level, message, nodeId: this.id };
      if (internal.data !== undefined && internal.data !== null) entry.data = internal.data;

      const scope = this.nodeScope as { runContext?: { log?(e: RuntimeLogEntry): void } } | undefined;
      const sink = scope && scope.runContext && scope.runContext.log;

      if (sink) {
        sink(entry);
      } else {
        // The browser (and any runtime that attached no sink). `console.debug` exists in every
        // browser this product supports and in Node; the fallback chain is here so a stripped
        // console cannot turn a log line into a crash.
        // eslint-disable-next-line no-console
        const write = (console[level] || console.log || function () {}) as (...args: unknown[]) => void;
        if (entry.data !== undefined) write.call(console, message, entry.data);
        else write.call(console, message);
      }

      if (token) this.reportOutcome(token as never, 'done');
    }
  }
};

const LogNodeModule: NodeModule = { node: LogNode };

export = LogNodeModule;
