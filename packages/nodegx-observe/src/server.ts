/**
 * OBS-004 — the observe server's tools.
 *
 * This is tier 3 of phase 36, and it is deliberately last. **An agent is only as good as the
 * tools underneath it.** An LLM over a raw graph dump guesses; an LLM over a provenance walk
 * with node-authored diagnoses reports facts. Everything here is a thin wrapper around
 * OBS-002's walk engine and OBS-001's trace — no reasoning lives in this file, and none
 * should.
 *
 * ⚠️ **The walk engine is imported, not reimplemented.** `walkEngine.ts` was written with zero
 * imports precisely so it could run here, with no renderer and no Electron around it. If a
 * behaviour needs changing, it changes there and both consumers get it.
 *
 * ## Formatting is part of the tool
 *
 * The reply text is not a debug dump — it is the whole product for this consumer. Two rules
 * carried over from OBS-002's live pass, both of which it got wrong the first time:
 *
 *  1. **Never state more than is known.** With no recording, every hop's status is `unknown`,
 *     and a summary that says "every hop carried a value" is a confident wrong answer. The
 *     panel that OBS-002 replaced was retired for exactly this.
 *  2. **A run that captured nothing is an answer.** Record, reproduce, nothing fires — that is
 *     the most informative outcome there is, and reporting it as "no trace" hides it.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  backwardWalk,
  buildIndex,
  describeFoundation,
  explainTerminus,
  forEachRow,
  forwardWalk,
  labelFor,
  portsToResolve,
  rootEvents,
  valueKey
} from '../../noodl-editor/src/editor/src/utils/provenance/walkEngine';
import type { PortValues, WalkResult, WalkRow } from '../../noodl-editor/src/editor/src/utils/provenance/walkEngine';
import { RelayClient } from './relayClient';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PKG_VERSION: string = require('../package.json').version;

/** Every tool answers as text; the caller is a language model, not a parser. */
function text(body: string) {
  return { content: [{ type: 'text' as const, text: body }] };
}

/**
 * Render a walk as an indented tree.
 *
 * The status glyph is the answer: the ✓/✕ frontier *is* the bug, so it has to be the most
 * scannable thing on the line. `?` is not a synonym for ✕ and is rendered differently on
 * purpose — see rule 1 in the module note.
 */
function renderWalk(index: ReturnType<typeof buildIndex>, result: WalkResult): string {
  const lines: string[] = [];
  const glyph = (row: WalkRow) =>
    row.status === 'fired' ? '✓' : row.status === 'never-fired' ? '✕' : '?';

  forEachRow(result.root, (row) => {
    const indent = '  '.repeat(row.depth);
    const parts = [`${indent}${glyph(row)} ${labelFor(index, row.ref)} [${row.ref.node}]`];
    if (row.fireCount > 1) parts.push(`fired ${row.fireCount}×`);
    else if (row.status === 'fired') parts.push('fired');
    else if (row.status === 'never-fired') parts.push('never fired');
    if (row.currentValue !== undefined) parts.push(`now = ${row.currentValue}`);
    for (const warning of row.warnings) parts.push(`⚠ ${warning}`);
    if (row.truncated === 'cycle') parts.push('(feedback loop — stopped here)');
    if (row.truncated === 'depth') parts.push('(truncated)');
    lines.push(parts.join('  ·  '));
  });
  return lines.join('\n');
}

/** Attach OBS-003's node-local diagnoses to the rows they belong to. */
function annotateWarnings(client: RelayClient, result: WalkResult): void {
  if (!client.warnings.size) return;
  const byNode = new Map<string, string[]>();
  for (const warning of Array.from(client.warnings.values())) {
    const list = byNode.get(warning.nodeId) || [];
    list.push(warning.message);
    byNode.set(warning.nodeId, list);
  }
  forEachRow(result.root, (row) => {
    const found = byNode.get(row.ref.node);
    if (found) row.warnings = found;
  });
}

export function createObserveServer(client: RelayClient): McpServer {
  const server = new McpServer(
    { name: 'nodegx-observe', version: PKG_VERSION },
    {
      instructions:
        'Observes and drives a RUNNING NodeGX app over the editor\'s local relay. It needs no ' +
        'access to the project on disk and works on any project format, because the running ' +
        'runtime supplies both the names and the connection topology.\n\n' +
        'The loop this is built for: start_trace → click (or ask the user to reproduce) → ' +
        'why_is_this_empty on the port that stayed empty. The walk computes where the data ' +
        'stopped from the graph and the trace; do not ask the user to search a log.\n\n' +
        'A node id is the address for everything here. Get them from list_nodes, from a walk, ' +
        'or from get_warnings.\n\n' +
        'There is only one running app, and the trace switch is global: start_trace also ' +
        'starts (and clears) the trace the editor\'s own Provenance panel is showing.'
    }
  );

  /** Topology + trace + values, rebuilt per call because the app is moving. */
  async function index(portValues: PortValues = {}) {
    if (!client.topology) await client.fetchTopology();
    return buildIndex(client.topology!, client.events, portValues, { recording: client.recording });
  }

  server.registerTool(
    'start_trace',
    {
      title: 'Start recording',
      description:
        'Turn on the running app\'s per-edge trace. Every value and signal crossing every wire ' +
        'is captured until stop_trace. Do this BEFORE reproducing the problem. If the user is ' +
        'already recording in the editor, this joins their trace rather than replacing it — ' +
        'you will see everything from this point on, and they keep everything they had.',
      inputSchema: {}
    },
    async () => {
      await client.resolveClientId();
      await client.setTraceEnabled(true);
      return text('Recording. Reproduce the problem — click something, or ask the user to — then call why_is_this_empty or where_did_this_go.');
    }
  );

  server.registerTool(
    'stop_trace',
    {
      title: 'Stop recording',
      description:
        'Stop capturing, for this server only. The buffer is kept, so the walks still work ' +
        'afterwards — and if the user is recording in the editor, their recording carries on.',
      inputSchema: {}
    },
    async () => {
      await client.setTraceEnabled(false);
      await client.fetchEvents().catch(() => undefined);
      return text(`Stopped. ${client.events.length} event(s) captured.`);
    }
  );

  server.registerTool(
    'list_nodes',
    {
      title: 'List the running app\'s nodes',
      description:
        'Every node in the running app with its id, editor label, type and component — the ' +
        'address book for every other tool. Filter with a substring to keep it short.',
      inputSchema: {
        filter: z.string().optional().describe('Case-insensitive substring matched against name, type or component.'),
        limit: z.number().int().positive().optional().describe('Default 100.')
      }
    },
    async ({ filter, limit }) => {
      const topology = await client.fetchTopology();
      const needle = (filter || '').toLowerCase();
      const rows = Object.keys(topology.nodes)
        .map((id) => ({ id, ...topology.nodes[id] }))
        .filter(
          (n) =>
            !needle ||
            n.name.toLowerCase().includes(needle) ||
            n.type.toLowerCase().includes(needle) ||
            n.component.toLowerCase().includes(needle)
        );
      const shown = rows.slice(0, limit ?? 100);
      const body = shown.map((n) => `${n.id}  ${n.name}  (${n.type})  in ${n.component}`).join('\n');
      // ⚠️ Say what was dropped. A truncated list that looks complete is how a caller
      // concludes a node does not exist.
      const note = shown.length < rows.length ? `\n\n… ${rows.length - shown.length} more not shown; narrow with "filter".` : '';
      return text(rows.length ? body + note : 'No nodes matched. Is the preview running?');
    }
  );

  server.registerTool(
    'why_is_this_empty',
    {
      title: 'Walk backwards from a port',
      description:
        'THE tool for "I clicked X and nothing appeared in Y". Walks backwards from a port ' +
        'through the connections that feed it and reports where the data stopped — computed ' +
        'from the graph and the trace, not searched. ' +
        'Works with no recording at all (it then reports each hop\'s CURRENT value, which ' +
        'answers "why is this label X?"), and gets sharper with one. ' +
        'Bounded by topology, so an app with 400 unrelated nodes firing still answers in a ' +
        'handful of rows.',
      inputSchema: {
        nodeId: z.string().describe('The node whose input looks wrong. From list_nodes or a warning.'),
        port: z.string().describe('The input port name, e.g. "Items", "Text", "Value".')
      }
    },
    async ({ nodeId, port }) => {
      const target = { node: nodeId, port };
      const shallow = await index();

      // One batched round trip for every value the walk could show, rather than one per row.
      const wanted = portsToResolve(shallow, target);
      const values = await client.fetchPortValues(wanted).catch(() => []);
      const portValues: PortValues = {};
      for (const entry of values) {
        // An absent port is left out entirely rather than stored as undefined, so a row can
        // tell "the runtime says this port is gone" from "not asked yet".
        if (entry.exists) portValues[valueKey(entry, entry.direction)] = entry.value ?? 'undefined';
      }

      const full = await index(portValues);
      const result = backwardWalk(full, target);
      annotateWarnings(client, result);

      // POL-010. An agent handed "1 row" draws the same wrong conclusion a person does, and has
      // less to check it against — it cannot see the canvas with the wire drawn on it. When the
      // walk could not run, say so first and instead of the row count, not after it.
      const foundation = describeFoundation(full, result.foundation);
      if (foundation && result.foundation.kind !== 'port-unwired') {
        return text(
          `Cannot walk back from ${nodeId}.${port}: ${foundation}\n\n` +
            'The topology comes from the running preview, so it holds only what the runtime has ' +
            'instantiated. Use list_nodes to see what is currently reachable.'
        );
      }

      const header = [
        foundation ? `${foundation}\n` : '',
        `Walk back from ${labelFor(full, target)} — ${result.mode} mode, ${result.rowCount} row(s).`,
        client.recording
          ? client.events.length
            ? `Trace: ${client.events.length} event(s) recorded.`
            : // ⚠️ The case OBS-002 got wrong live. Recording with nothing captured is the
              // most informative outcome there is, not an absence of information.
              'Trace: recording, and NOTHING fired anywhere in the app. Every ✕ below is certain.'
          : 'No recording — every status is unknown, and only the "now =" values are known. Call start_trace and reproduce for a causal answer.'
      ].join(' ');

      const boundary = result.boundary.length
        ? '\n\nThis is where it stopped:\n' +
          result.boundary.map((row) => `  • ${labelFor(full, row.ref)} [${row.ref.node}] did not emit`).join('\n')
        : client.recording
          ? '\n\nNo ✕/✓ boundary: nothing upstream failed to emit.'
          : '';

      return text(header + '\n\n' + renderWalk(full, result) + boundary);
    }
  );

  server.registerTool(
    'list_root_events',
    {
      title: 'List the interactions in the trace',
      description:
        'The events with no cause — actual interactions, timers, boot. Short by construction: ' +
        'a click is ONE root with a cascade of descendants. Use it to pick something to pass ' +
        'to where_did_this_go.',
      inputSchema: {}
    },
    async () => {
      await client.fetchEvents().catch(() => undefined);
      const full = await index();
      const roots = rootEvents(full);
      if (!roots.length) {
        return text(
          client.recording
            ? 'Recording, and nothing has fired. Reproduce the problem — click something, or use click.'
            : 'Nothing recorded. Call start_trace first.'
        );
      }
      return text(
        roots
          .map(
            (r) =>
              `seq ${r.event.seq}  ${labelFor(full, r.event.from)} → ${labelFor(full, r.event.to)}  ` +
              `(${r.size} event(s) downstream)  value = ${r.event.value}`
          )
          .join('\n')
      );
    }
  );

  server.registerTool(
    'where_did_this_go',
    {
      title: 'Walk forwards from one event',
      description:
        'Everything downstream of one root event, as a tree — the filter that matters. One ' +
        'click collapses the whole app\'s firehose to that chain, with no scanning. The ' +
        'leaves are where the cascade stopped, and each is explained against the topology.',
      inputSchema: {
        seq: z.number().int().describe('An event sequence number, from list_root_events.')
      }
    },
    async ({ seq }) => {
      const full = await index();
      const event = full.bySeq.get(seq);
      if (!event) return text(`No event with seq ${seq} is in the buffer. Call list_root_events for what is.`);

      const result = forwardWalk(full, event);
      annotateWarnings(client, result);

      const termini = result.boundary
        .map((row) => explainTerminus(full, row))
        .filter(Boolean)
        .map((line) => '  • ' + line);

      return text(
        `Forward from seq ${seq} — ${result.rowCount} row(s).\n\n` +
          renderWalk(full, result) +
          (termini.length ? '\n\nThe cascade stopped here:\n' + termini.join('\n') : '')
      );
    }
  );

  server.registerTool(
    'get_port_value',
    {
      title: 'Read a port\'s value right now',
      description:
        'The CURRENT value of a port, read from the port itself — so it works on an app that ' +
        'booted with debugging off and has fired nothing. An input with no declared default ' +
        'reads undefined even when the node behaves as if initialised; that is the honest ' +
        'answer, not a gap.',
      inputSchema: {
        nodeId: z.string(),
        port: z.string(),
        direction: z.enum(['input', 'output']).optional().describe('Default "input".')
      }
    },
    async ({ nodeId, port, direction }) => {
      const values = await client.fetchPortValues([{ node: nodeId, port, direction: direction ?? 'input' }]);
      if (!values.length) return text('The preview did not answer.');
      const entry = values[0];
      // ⚠️ A node's input and output may share a name (`Variable` has both a `Value` in and a
      // `Value` out), which is why direction is part of the request rather than inferred.
      return text(
        entry.exists
          ? `${nodeId}.${port} (${entry.direction}) = ${entry.value ?? 'undefined'}`
          : `${nodeId} has no ${direction ?? 'input'} port named "${port}".`
      );
    }
  );

  server.registerTool(
    'get_warnings',
    {
      title: 'What the app is complaining about',
      description:
        'Node-local problems the running app reported about itself — the same set that draws ' +
        'the danger ring and files Problems entries in the editor. These are facts from the ' +
        'nodes, not inferences.',
      inputSchema: {}
    },
    async () => {
      if (!client.warnings.size) {
        return text(
          'No warnings. ⚠️ Warnings are pushed when they occur, so this only covers what has ' +
            'happened since this server connected — reproduce the problem and ask again.'
        );
      }
      const topology = client.topology;
      return text(
        Array.from(client.warnings.values())
          .map((w) => {
            const info = topology && topology.nodes[w.nodeId];
            const name = info ? `${info.name} (${info.type})` : w.nodeId;
            return `${name} [${w.nodeId}] in ${w.componentName}\n  ${w.message}`;
          })
          .join('\n\n')
      );
    }
  );

  server.registerTool(
    'click',
    {
      title: 'Click something in the running app',
      description:
        'Dispatch a click at a node, addressed by node id — no coordinates, no screenshot. ' +
        'This is what makes a debugging loop possible: start_trace, click, then walk. ' +
        'A node inside a Repeater exists once per row and the reply says how many matched; ' +
        'pass "index" to choose. ⚠️ These are DOM events, so event.isTrusted is false — ' +
        'NodeGX\'s own nodes do not care, a third-party component might.',
      inputSchema: {
        nodeId: z.string().optional().describe('Preferred. From list_nodes or a walk.'),
        selector: z.string().optional().describe('A CSS selector, for markup no node owns.'),
        index: z.number().int().nonnegative().optional().describe('Which instance, when several matched.')
      }
    },
    async ({ nodeId, selector, index: which }) => {
      const result = await client.injectInput({ nodeId, selector, index: which, action: 'click' });
      return text((result.ok ? 'OK. ' : 'Did not click. ') + (result.message || '') + `\n(matched ${result.matched})`);
    }
  );

  server.registerTool(
    'set_text',
    {
      title: 'Type into an input in the running app',
      description:
        'Set the text of an input or textarea so that React sees the change and the node\'s ' +
        'outputs fire. Addressed by node id, like click.',
      inputSchema: {
        value: z.string(),
        nodeId: z.string().optional(),
        selector: z.string().optional(),
        index: z.number().int().nonnegative().optional()
      }
    },
    async ({ value, nodeId, selector, index: which }) => {
      const result = await client.injectInput({ nodeId, selector, index: which, action: 'setText', value });
      return text((result.ok ? 'OK. ' : 'Did not set it. ') + (result.message || '') + `\n(matched ${result.matched})`);
    }
  );

  return server;
}
