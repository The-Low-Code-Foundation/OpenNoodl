/**
 * AAQ-011 F6 — what does one partial payload cost, and how does it grow?
 *
 * The register's row says authoring a 55-node component took **6m51s of editor
 * main-thread time against a zero-latency provider**, that the cost is *per
 * partial payload published* rather than in `PartialPayloadScanner`, and that
 * it is superlinear in node count. This is the driver for that claim: a real
 * `AuthoringSession` (real context builder, real scanner, real validation gate)
 * driven by a scripted provider that streams a synthetic component of N nodes
 * as C partial payloads, with the wall clock taken **around each callback the
 * provider makes**, so the cost lands on the stage that spent it.
 *
 * Four stages are timed separately, because "publish is slow" and "the scan is
 * slow" and "the gate is slow" are three different fixes:
 *
 *   partial   every `onToolCallPartial` — the scan, `building`, and every
 *             listener the publish reaches. This is the row's suspect.
 *   scan      `PartialPayloadScanner.update` alone, re-run over the same
 *             fragments on a fresh scanner, so it can be subtracted.
 *   text      every `onText` — the prose publish path, same listeners.
 *   submit    everything after the last callback: `buildCandidate`, the
 *             validation gate, the style lint.
 *
 * The listener chain is the editor's, minus React: `AuthoringSession` →
 * `PlanRun` → a `PlanSessionStore`-shaped subscriber that re-snapshots the
 * session on every publish (`PlanSessionStore.followRun`). That is the whole of
 * what the editor hangs off a publish apart from the panel's own re-render, and
 * a harness that omitted it would measure a chain the product does not have.
 *
 * Build + run, from the repo root:
 *
 *   node packages/noodl-editor/scripts/aaq011-perf/build.mjs
 *   node packages/noodl-editor/scripts/aaq011-perf/dist/aaq011-harness.cjs
 *
 * Flags:
 *   --nodes=9,25,55,100,200   node counts to sweep (default 9,25,55,100)
 *   --chunks=1,8              partial payloads per submission (default 1,8)
 *   --repeat=1                runs per cell, best-of reported
 *   --json                    machine-readable output as well as the table
 *
 * @module scripts/aaq011-perf/harness
 */

import type { AuthoringChatFn } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { PartialPayloadScanner } from '../../src/editor/src/models/AiAssistant/authoring/partial';
import { PlanRun } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { snapshotSession } from '../../src/editor/src/models/AiAssistant/authoring/planSessionSnapshot';
import type { PlanSession } from '../../src/editor/src/models/AiAssistant/authoring/PlanSessionStore';
import type { SubmittedNode } from '../../src/editor/src/models/AiAssistant/authoring/types';
import type { AiChatResponse, AiStreamCallbacks } from '../../src/editor/src/models/AiAssistant/client/types';
import type { ConnectionV2 } from '../../src/editor/src/schemas';

// ── Arguments ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`Unrecognised argument: ${arg} (flags are --name=value)`);
    args[match[1]] = match[2] ?? 'true';
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const NODE_COUNTS = (args.nodes ?? '9,25,55,100').split(',').map((n) => Number(n.trim()));
const CHUNK_COUNTS = (args.chunks ?? '1,8').split(',').map((n) => Number(n.trim()));
const REPEAT = Number(args.repeat ?? '1');

// ── The synthetic component ──────────────────────────────────────────────────

/**
 * N nodes in the shape the 6m51s fixture has — `aaq40-live/fixtures.js`'s
 * `Pages/Puppies` is a `Page` root, one page-level `Group`, then section Groups
 * with Text leaves under them (1 Page, 15 Groups, 39 Texts, 1 RouterNavigate).
 * Parameters are present because they are what a payload's bulk is.
 *
 * Deliberately valid: a candidate the gate rejects spends the run in repair
 * rounds and measures a different thing. `PageWithoutPageNode` is a *blocking*
 * warning for authored output (AAQ-011 F7), so a `/Pages/…` candidate without a
 * `Page` root never reaches the publish path being measured at all.
 */
function buildComponent(nodeCount: number): { nodes: SubmittedNode[]; connections: ConnectionV2[] } {
  const nodes: SubmittedNode[] = [
    { id: 'page', type: 'Page', label: 'Synthetic', parameters: { title: 'Synthetic', urlPath: 'synthetic' } },
    {
      id: 'root',
      type: 'Group',
      label: 'Page body',
      parent: 'page',
      parameters: {
        sizeMode: 'contentHeight',
        width: { value: 100, unit: '%' },
        backgroundColor: '#F6F8FA',
        paddingTop: { value: 48, unit: 'px' }
      }
    }
  ];
  const connections: ConnectionV2[] = [];
  const textIds: string[] = [];
  let section = 'root';
  for (let i = 2; i < nodeCount; i++) {
    if (i % 6 === 2) {
      section = `section-${i}`;
      nodes.push({
        id: section,
        type: 'Group',
        label: `Section ${i}`,
        parent: 'root',
        parameters: {
          sizeMode: 'contentHeight',
          width: { value: 100, unit: '%' },
          backgroundColor: '#FFFFFF',
          marginBottom: { value: 16, unit: 'px' }
        }
      });
      continue;
    }
    const id = `node-${i}`;
    nodes.push({
      id,
      type: 'Text',
      label: `Text ${i}`,
      parent: section,
      parameters: {
        text: `Row ${i} — a line of copy long enough to be worth streaming`,
        fontSize: { value: 16, unit: 'px' },
        color: '#1B1D21'
      }
    });
    textIds.push(id);
  }
  // Wired after the fact, off the ids that exist: a connection to a node the
  // loop skipped (an index that landed on a section) is a `dangling-connection`
  // error, and a rejected candidate measures repair rounds, not publishes.
  for (let i = 2; i < textIds.length; i += 4) {
    connections.push({ fromId: textIds[i - 1], fromProperty: 'text', toId: textIds[i], toProperty: 'text' });
  }
  return { nodes, connections };
}

// ── Timing ───────────────────────────────────────────────────────────────────

const now = (): number => Number(process.hrtime.bigint()) / 1e6;

interface Timings {
  totalMs: number;
  partialMs: number;
  partialCalls: number;
  textMs: number;
  textCalls: number;
  scanOnlyMs: number;
  submitMs: number;
  publishes: number;
  status: string;
  /** The gate's first complaints, when the synthetic candidate was rejected. */
  rejected: string[];
  nodes: number;
  chunks: number;
}

/**
 * The scripted provider. Streams prose in six fragments and the submission's
 * arguments in `chunks` accumulating fragments, exactly as
 * `scripts/aaq40-live/wizard-replay.js` does — that is the driver the 6m51s
 * number came from, and a harness that streamed differently would not be
 * measuring the same thing.
 *
 * Synchronous: the point is main-thread cost, and an `await` between fragments
 * only adds wall clock nobody is billed for.
 */
function scriptedChat(
  argsText: string,
  toolArguments: Record<string, unknown>,
  chunks: number,
  clock: { partialMs: number; partialCalls: number; textMs: number; textCalls: number }
): AuthoringChatFn {
  const prose = 'Building the component now — one Group per section, Text for the copy.';
  return async (_request, callbacks?: AiStreamCallbacks): Promise<AiChatResponse> => {
    for (let i = 0; i < 6; i++) {
      const upto = Math.floor((prose.length * (i + 1)) / 6);
      const t0 = now();
      callbacks?.onText?.(prose.slice(0, upto));
      clock.textMs += now() - t0;
      clock.textCalls++;
    }
    for (let i = 0; i < chunks; i++) {
      const upto = Math.floor((argsText.length * (i + 1)) / chunks);
      const t0 = now();
      callbacks?.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: argsText.slice(0, upto) });
      clock.partialMs += now() - t0;
      clock.partialCalls++;
    }
    const call = { id: 'scripted-1', name: 'submit_component', arguments: toolArguments };
    callbacks?.onToolCall?.(call);
    callbacks?.onEnd?.();
    return {
      text: prose,
      toolCalls: [call],
      usage: { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
      model: 'scripted',
      stopReason: 'tool_calls'
    };
  };
}

/** `PartialPayloadScanner.update` alone over the same fragments — the subtraction. */
function scanOnly(argsText: string, chunks: number): number {
  const scanner = new PartialPayloadScanner();
  const t0 = now();
  for (let i = 0; i < chunks; i++) {
    scanner.update(argsText.slice(0, Math.floor((argsText.length * (i + 1)) / chunks)));
  }
  return now() - t0;
}

/**
 * One cell of the sweep, through the product's own listener chain.
 *
 * `PlanRun` is the caller the 6m51s came from (the plan fan-out, not the
 * single-component panel), and the third subscriber re-snapshots the session on
 * every publish because `PlanSessionStore.followRun` does exactly that.
 */
async function measure(nodeCount: number, chunks: number): Promise<Timings> {
  const { nodes, connections } = buildComponent(nodeCount);
  const toolArguments = { nodes, connections, description: 'A synthetic page.' };
  const argsText = JSON.stringify(toolArguments);
  const clock = { partialMs: 0, partialCalls: 0, textMs: 0, textCalls: 0 };

  const plan: AuthoringPlan = {
    request: 'Build the page.',
    operations: [{ id: 'op-1', kind: 'create', target: 'Pages/Synthetic', intent: 'Build the synthetic page.' }]
  };

  let publishes = 0;
  const run = new PlanRun({ components: [] }, plan, {
    session: {
      chat: scriptedChat(argsText, toolArguments, chunks, clock),
      maxSubmits: 1,
      maxTurns: 2,
      // The measurement is of the publish path, not of the provider; a stall
      // deadline would only wrap the scripted function in a timer.
      stallMs: 0
    }
  });

  // The panel's subscriber (state only) and the store's (re-snapshot on every
  // publish) — the two things the editor hangs off a `PlanRun` publish.
  const session: PlanSession = {
    description: '',
    plan,
    note: null,
    excluded: new Set(),
    applied: null,
    applyFailure: null,
    run,
    origin: null,
    announcementDismissed: false
  };
  run.onChange(() => {
    publishes++;
  });
  run.onChange(() => {
    snapshotSession(session, '2026-08-06T00:00:00.000Z');
  });

  const t0 = now();
  const state = await run.run();
  const totalMs = now() - t0;

  const operation = state.operations[0];
  const rejected = (operation.session?.activities ?? []).flatMap((activity) =>
    activity.kind === 'submit' && !activity.ok ? activity.errorLines.slice(0, 3) : []
  );
  return {
    rejected,
    totalMs,
    partialMs: clock.partialMs,
    partialCalls: clock.partialCalls,
    textMs: clock.textMs,
    textCalls: clock.textCalls,
    scanOnlyMs: scanOnly(argsText, chunks),
    submitMs: totalMs - clock.partialMs - clock.textMs,
    publishes,
    status: operation.status + (operation.error ? ` (${operation.error.slice(0, 60)})` : ''),
    nodes: nodeCount,
    chunks
  };
}

// ── Report ───────────────────────────────────────────────────────────────────

function pad(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

async function main(): Promise<void> {
  const rows: Timings[] = [];
  for (const nodeCount of NODE_COUNTS) {
    for (const chunks of CHUNK_COUNTS) {
      let best: Timings | undefined;
      for (let i = 0; i < REPEAT; i++) {
        const result = await measure(nodeCount, chunks);
        if (!best || result.totalMs < best.totalMs) best = result;
      }
      rows.push(best!);
      const r = best!;
      console.log(
        `${pad(String(r.nodes), 5)} nodes ${pad(String(r.chunks), 3)} chunks  ` +
          `total ${pad(r.totalMs.toFixed(1), 9)}ms  ` +
          `partials ${pad(r.partialMs.toFixed(1), 9)}ms (${r.partialCalls} calls, ` +
          `${(r.partialMs / Math.max(1, r.partialCalls)).toFixed(1)}ms each)  ` +
          `scan-only ${pad(r.scanOnlyMs.toFixed(2), 7)}ms  ` +
          `text ${pad(r.textMs.toFixed(1), 7)}ms  ` +
          `submit ${pad(r.submitMs.toFixed(1), 9)}ms  ` +
          `${r.publishes} publishes  ${r.status}`
      );
      for (const line of r.rejected) console.log(`      ! ${line}`);
    }
  }
  if (args.json) console.log(JSON.stringify(rows, null, 1));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
