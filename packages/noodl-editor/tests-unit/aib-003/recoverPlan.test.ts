/**
 * AIB-003 slice 3 — the plan that was on disk the whole time.
 *
 * `pendingPlan.ts` has always said the plan is *also* written into
 * `docs/decisions/000-initial-scope.md` and is therefore "durable and readable
 * without this seam". The slow path was never built, so the destructive `take`
 * made the first consumption final — and the consumer was a component that
 * unmounted on a tab click. Close the launcher, or quit and reopen, and an
 * agreed plan was gone while sitting in a file the user could read.
 *
 * The round trip is asserted against the **real renderer**, not a hand-written
 * fixture, because the transcript is recovered by parsing the rendered form. A
 * fixture would let the two drift and the parser would keep passing.
 */

import { pathToLegacyName } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import {
  parseRecordedPlan,
  parseRecordedTranscript,
  recoverScopePlan
} from '../../src/editor/src/models/AiAssistant/scoping/recoverPlan';
import { emptyScope, renderScopeRecord, DOC_INITIAL_SCOPE } from '../../src/editor/src/models/AiAssistant/scoping/scope';
import type { ScopeTranscriptEntry } from '../../src/editor/src/models/AiAssistant/scoping/scope';

const PLAN: AuthoringPlan = {
  request: 'A chat app with signup, a chat list and a chat page',
  operations: [
    { id: 'op-1', kind: 'create', target: 'Pages/Sign Up', intent: 'Create an account.' },
    { id: 'op-2', kind: 'create', target: 'Pages/Chats', intent: 'List the conversations.' },
    { id: 'op-3', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'Record the page map.' }
  ]
};

const TRANSCRIPT: ScopeTranscriptEntry[] = [
  { role: 'user', text: 'I want a chat app.' },
  { role: 'assistant', text: 'Who signs in?\n\nAnd do chats have titles?' },
  { role: 'user', text: 'Anyone with an email. No titles — use the other person’s name.' }
];

/**
 * A rendered record. `withPlan: false` is spelled out rather than passed as
 * `undefined`, because a default parameter would swallow it and the test would
 * silently assert the opposite of what it says.
 */
function record({ withPlan = true }: { withPlan?: boolean } = {}): string {
  return renderScopeRecord({
    scope: { ...emptyScope(), request: 'A chat app' },
    transcript: TRANSCRIPT,
    ...(withPlan ? { plan: PLAN } : {}),
    at: '2026-08-03T00:00:00.000Z'
  });
}

describe('the plan survives a round trip through the decision record', () => {
  it('comes back operation for operation', () => {
    expect(parseRecordedPlan(record())).toEqual(PLAN);
  });

  it('is absent when the conversation produced no plan', () => {
    expect(parseRecordedPlan(record({ withPlan: false }))).toBeUndefined();
    expect(parseRecordedPlan('# Some other document\n\nNothing here.')).toBeUndefined();
  });

  it('degrades to no plan rather than throwing on a document someone has edited', () => {
    // This file is a document the user is invited to edit. A mangled block must
    // mean "nothing to offer", never a panel that fails to render.
    const mangled = record().replace('"operations"', '"operatio');
    expect(() => parseRecordedPlan(mangled)).not.toThrow();
    expect(parseRecordedPlan(mangled)).toBeUndefined();
  });

  it('ignores a JSON block the user pasted in themselves', () => {
    // The tag, not the ```json fence, is what identifies the plan — a record is
    // a document, and documents acquire code samples.
    const withSample = record({ withPlan: false }) + '\n\n```json\n{ "plan": { "request": "x", "operations": [] } }\n```\n';
    expect(parseRecordedPlan(withSample)).toBeUndefined();
  });

  it('rejects a plan whose operations are not operations', () => {
    const broken = record().replace('"kind": "create"', '"kind": "delete"');
    expect(parseRecordedPlan(broken)).toBeUndefined();
  });
});

describe('the conversation history that was never shown', () => {
  it('comes back turn for turn, including a multi-paragraph reply', () => {
    expect(parseRecordedTranscript(record())).toEqual(TRANSCRIPT);
  });

  it('is empty rather than wrong when the record has no transcript', () => {
    const noTranscript = renderScopeRecord({
      scope: emptyScope(),
      transcript: [],
      plan: PLAN,
      at: '2026-08-03T00:00:00.000Z'
    });
    expect(parseRecordedTranscript(noTranscript)).toEqual([]);
  });
});

describe('whether the recorded plan is still worth offering', () => {
  const readDoc = (relPath: string) => (relPath === DOC_INITIAL_SCOPE ? record() : undefined);

  it('offers it when the project has none of the components it proposes', async () => {
    const found = await recoverScopePlan({ readDoc, componentExists: () => false, toLegacyName: pathToLegacyName });
    expect(found!.plan.operations).toHaveLength(3);
    expect(found!.transcript).toHaveLength(3);
    expect(found!.recordPath).toBe(DOC_INITIAL_SCOPE);
  });

  it('stays quiet once every page it proposed exists — the plan was built', async () => {
    // The record is written once and never updated, deliberately: it is a
    // decision document, not a status file. So "is there anything left to do"
    // is asked of the project, not of a flag someone had to remember to set.
    const found = await recoverScopePlan({ readDoc, componentExists: () => true, toLegacyName: pathToLegacyName });
    expect(found).toBeUndefined();
  });

  it('still offers it when only some of the plan was built', async () => {
    const built = new Set(['/Pages/Sign Up']);
    const found = await recoverScopePlan({
      readDoc,
      componentExists: (name) => built.has(name),
      toLegacyName: pathToLegacyName
    });
    expect(found).toBeDefined();
  });

  it('offers nothing, and does not throw, when the docs cannot be read', async () => {
    const explodes = () => {
      throw new Error('no docs folder');
    };
    await expect(
      recoverScopePlan({ readDoc: explodes, componentExists: () => false, toLegacyName: pathToLegacyName })
    ).resolves.toBeUndefined();
  });
});
