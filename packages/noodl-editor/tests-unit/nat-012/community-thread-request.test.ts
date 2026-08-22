/**
 * NAT-012 AC4 — asking about a node ends in the editor, not in a sentence.
 *
 * The dialog posts a question and used to say *"Answers will appear on the Bench"* — the one
 * project-relevant verb D6 leaves in the editor, finishing with nowhere to click. This grades the
 * seam that replaced it.
 *
 * ⚠️ The models are mocked because this module's job is **ordering**: what happens when the panel
 * that listens does not exist yet. `provenance/provenanceRequest.test.ts` is the precedent, and
 * the bug it pins is the one this file exists to keep out of a second feature.
 *
 * @module noodl-editor/tests-unit/nat-012/community-thread-request
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const emitted: Array<{ event: string; payload: unknown }> = [];
const switched: string[] = [];

// `virtual`, because this runner has no `@noodl-models` alias — see the provenance spec.
jest.mock(
  '@noodl-models/sidebar',
  () => ({ SidebarModel: { instance: { switch: (id: string) => switched.push(id) } } }),
  { virtual: true }
);

jest.mock('../../src/shared/utils/EventDispatcher', () => ({
  EventDispatcher: {
    instance: {
      emit: (event: string, payload: unknown) => emitted.push({ event, payload })
    }
  }
}));

import {
  COMMUNITY_THREAD_EVENT,
  clearPendingCommunityThread,
  requestCommunityThread,
  takePendingCommunityThread
} from '../../src/editor/src/utils/community/communityThreadRequest';

const EDITOR = join(__dirname, '../../src/editor/src');
const read = (rel: string) => readFileSync(join(EDITOR, rel), 'utf8');

beforeEach(() => {
  emitted.length = 0;
  switched.length = 0;
  takePendingCommunityThread();
});

describe('requestCommunityThread', () => {
  test('emits the thread id and switches the rail to the community panel', () => {
    requestCommunityThread('t-42');

    expect(emitted).toEqual([{ event: COMMUNITY_THREAD_EVENT, payload: 't-42' }]);
    expect(switched).toEqual(['community']);
  });

  test('🔴 a panel that mounts AFTERWARDS still gets it — the first-question case', () => {
    // Nothing is listening: the dialog is reached from a canvas right-click, so somebody asking
    // their first question has never opened the Community panel and `SidePanel` has never built
    // it. An emit on its own fires into nothing and the reader has to ask twice.
    requestCommunityThread('t-42');

    expect(takePendingCommunityThread()).toBe('t-42');
  });

  test('and only once — a later remount does not reopen a thread already navigated away from', () => {
    requestCommunityThread('t-42');
    takePendingCommunityThread();

    expect(takePendingCommunityThread()).toBeUndefined();
  });

  test('a live listener clears the stash, so a delivered request is not also replayed', () => {
    requestCommunityThread('t-42');
    clearPendingCommunityThread();

    expect(takePendingCommunityThread()).toBeUndefined();
  });

  test('🔴 CONTROL: the stash holds the LAST request, not the first', () => {
    // Two questions asked in a row: the thread the reader just posted is the one they meant.
    requestCommunityThread('t-1');
    requestCommunityThread('t-2');

    expect(takePendingCommunityThread()).toBe('t-2');
  });
});

describe('🔴 both ends of the seam are wired — a request nobody claims is a dead end with extra steps', () => {
  test('CONTROL: both files were read', () => {
    expect(read('hooks/useCommunityThread.ts').length).toBeGreaterThan(2000);
    expect(read('views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx').length).toBeGreaterThan(2000);
  });

  test('the thread hook listens AND claims the stash', () => {
    const hook = read('hooks/useCommunityThread.ts');
    expect(hook).toContain('COMMUNITY_THREAD_EVENT');
    expect(hook).toContain('takePendingCommunityThread()');
    // ⚠️ Both halves, because they catch different cases: the listener catches a request made
    // while the panel is open, the take catches one made before it existed.
    expect(hook).toContain('clearPendingCommunityThread()');
  });

  test('🔴 the dialog opens the thread it just created, and closes behind itself', () => {
    const dialog = read('views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx');
    expect(dialog).toContain('requestCommunityThread(postState.threadId)');
    // A modal left standing over the answer it just opened is the same dead end with one more
    // step, so the button closes it.
    expect(dialog).toMatch(/requestCommunityThread\(postState\.threadId\);\s*\n\s*onClose\(\);/);
  });

  test('⚠️ and the posted state no longer ends at a sentence with nowhere to click', () => {
    const dialog = read('views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx');
    // The old copy, in the branch that is now a button. ⚠️ Asserted on the JSX rather than on the
    // whole file: the phrase is quoted in this task's own notes, and a checker that cannot tell a
    // prohibition from a violation reports the file that documents the rule.
    expect(dialog).not.toContain("'Posted. Answers will appear on the Bench.'");
    expect(dialog).toContain('Open the thread');
  });
});
