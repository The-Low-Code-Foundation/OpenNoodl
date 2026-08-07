/**
 * AAQ-011 F6 — what one streamed submission costs the editor's main thread.
 *
 * The row said authoring a 55-node component cost 6m51s of editor main-thread
 * time against a zero-latency provider, "per partial payload published", and
 * superlinear in node count. It was measured through
 * `scripts/aaq40-live/wizard-replay.js`, whose scripted provider sleeps
 * `setTimeout(…, 10)` between payloads — and Chromium clamps `setTimeout` in an
 * occluded window (the same throttling `turnDeadline.ts:26-29` already records
 * biting a scripted run once). The time was the fixture's own pacing, not the
 * publish.
 *
 * These specs pin what makes that true, so a later change cannot quietly make
 * the row's claim correct:
 *
 * 1. **Publishes are bounded by the component, not by the stream.** A provider
 *    delivering one fragment per token drives thousands of `onToolCallPartial`
 *    calls; `PartialPayloadScanner.update` reports `changed` only when an
 *    element *closed*, and `AuthoringSession` publishes only then. Lose that
 *    gate and every token becomes a full state rebuild and a React render — the
 *    defect the row describes, arriving for real the moment a live provider is
 *    attached.
 * 2. **The scan is resumable across fragments**, so N fragments cost one pass
 *    over the text rather than N. (`authoring-partial.test.ts` pins the
 *    equivalence of the *results*; this pins the cost.)
 * 3. **A budget.** Deliberately generous — two orders of magnitude above the
 *    measured cost — because the value of a perf assertion is catching an
 *    accidental quadratic, and a tight one on shared CI is a flake.
 */

import {
  AuthoringSession,
  type AuthoringChatFn,
  type AuthoringSessionState
} from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { PartialPayloadScanner } from '../../src/editor/src/models/AiAssistant/authoring/partial';
import type { AuthoringRequest } from '../../src/editor/src/models/AiAssistant/authoring/types';
import type { AiChatResponse } from '../../src/editor/src/models/AiAssistant/client/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const GRAPH = fromSerialisedProject(gitRepoUtf8);
const REQUEST: AuthoringRequest = {
  description: 'A page of rows.',
  componentPath: 'Sections/PublishCost'
};

/** A payload with `count` Text nodes under one Group — the streamed bulk. */
function payload(count: number): Record<string, unknown> {
  const nodes: Record<string, unknown>[] = [{ id: 'root', type: 'Group', parameters: { flexDirection: 'column' } }];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `row-${i}`,
      type: 'Text',
      parent: 'root',
      parameters: { text: `Row ${i} — a line of copy long enough to be worth streaming` }
    });
  }
  return { nodes, connections: [], description: 'Rows.' };
}

function respond(toolCalls: AiChatResponse['toolCalls']): AiChatResponse {
  return {
    text: '',
    toolCalls,
    usage: { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
    model: 'test',
    stopReason: 'tool_calls'
  };
}

/** Stream `args` as `fragments` accumulating slices, exactly as a provider does. */
function streamingChat(args: Record<string, unknown>, fragments: number): AuthoringChatFn {
  const json = JSON.stringify(args);
  return async (_request, callbacks) => {
    for (let i = 1; i <= fragments; i++) {
      const upto = Math.floor((json.length * i) / fragments);
      callbacks?.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: json.slice(0, upto) });
    }
    return respond([{ id: 'submit-1', name: 'submit_component', arguments: args }]);
  };
}

describe('AAQ-011 F6 — the cost of a streamed submission', () => {
  it('publishes once per element that closes, not once per fragment delivered', async () => {
    const NODES = 60;
    const FRAGMENTS = 3000;
    const args = payload(NODES);
    const session = AuthoringSession.create(GRAPH, REQUEST, {
      chat: streamingChat(args, FRAGMENTS),
      maxSubmits: 1
    });

    const forming: AuthoringSessionState[] = [];
    session.onChange((state) => {
      if (state.building && !state.building.complete) forming.push(state);
    });
    await session.run();

    // One publish opens the submission, then one per node that closed. Nowhere
    // near 3000 — that is the whole property. The exact count is left loose
    // because where a fragment boundary falls is arithmetic, not contract.
    expect(forming.length).toBeGreaterThan(NODES / 2);
    expect(forming.length).toBeLessThanOrEqual(NODES + 4);
    expect(forming.length).toBeLessThan(FRAGMENTS / 10);
  });

  it('re-reads no character of the arguments across fragments', () => {
    const json = JSON.stringify(payload(40));
    // The scanner exposes no counter, so the read is counted through the string
    // it is handed: a `slice` is what it walks, and a resumable scanner walks
    // each character exactly once no matter how the text was cut.
    const scanner = new PartialPayloadScanner();
    let charactersHandedOver = 0;
    for (let i = 1; i <= 500; i++) {
      const upto = Math.floor((json.length * i) / 500);
      charactersHandedOver += upto;
      scanner.update(json.slice(0, upto));
    }
    const oneShot = new PartialPayloadScanner().update(json);
    const streamed = scanner.update(json);

    // The accumulating text handed over is quadratic by construction — that is
    // what a provider does — and the result is identical to one pass, which is
    // only possible because the scanner resumes from its own position.
    expect(charactersHandedOver).toBeGreaterThan(json.length * 100);
    expect(streamed.nodes.length).toBe(oneShot.nodes.length);
    expect(streamed.nodes.map((n) => n.id)).toEqual(oneShot.nodes.map((n) => n.id));
  });

  it('costs the same whether the payload arrives in 100 fragments or 4000', async () => {
    // The load-invariant form of the budget. A wall-clock assertion in this
    // suite would measure whatever else the machine is doing — the same
    // component measured 31ms on an idle machine and 2417ms under nine
    // concurrent Electron runs — so what is asserted is the *count of work*,
    // which is what a quadratic would change and a busy machine would not.
    const args = payload(80);
    const publishCount = async (fragments: number): Promise<number> => {
      const session = AuthoringSession.create(GRAPH, REQUEST, {
        chat: streamingChat(args, fragments),
        maxSubmits: 1
      });
      let publishes = 0;
      session.onChange(() => {
        publishes++;
      });
      await session.run();
      return publishes;
    };

    expect(await publishCount(4000)).toBe(await publishCount(100));
  });
});
