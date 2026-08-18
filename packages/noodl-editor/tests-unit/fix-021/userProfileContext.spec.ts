/**
 * FIX-021 slice B — the seam between the file and the bill.
 *
 * `userProfile.spec.ts` grades the format and `userProfilePrompt.spec.ts` grades
 * the placement, but neither runs the code that connects them: `ContextBuilder`
 * decides whether the profile is rendered at all and, crucially, **whether it is
 * charged**. The claim "a seeded file costs nothing" is only true end-to-end if
 * it produces no context-log entry either — a zero-char row in every turn's log,
 * on every project, forever, would be its own small version of the same tax.
 *
 * Constructing the builder here rather than in the jasmine bundle is deliberate:
 * it imports nothing that needs a renderer, so the seam is gradeable in seconds
 * instead of in a fifteen-minute Electron run.
 */

import { AuthoringContextBuilder } from '../../src/editor/src/models/AiAssistant/authoring/ContextBuilder';
import { PROFILE_CAP, PROFILE_TEMPLATE } from '../../src/editor/src/models/UserProfile/profileText';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';

const GRAPH: ExplainGraph = { components: [] };

function builder(userProfile?: string) {
  return new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, {}, [], undefined, [], userProfile);
}

const charged = (b: AuthoringContextBuilder) => b.log.filter((entry) => entry.source === 'user-profile');

describe('FIX-021 slice B — ContextBuilder.globalPreferences', () => {
  it('costs nothing at all for a user who has written nothing', () => {
    for (const source of [undefined, '', PROFILE_TEMPLATE]) {
      const b = builder(source);
      expect(b.globalPreferences()).toBeUndefined();
      // Not "charged zero" — not charged. A row per turn is still a row.
      expect(charged(b)).toEqual([]);
      expect(b.totalChars()).toBe(0);
    }
  });

  it('renders and charges what the user did write', () => {
    const b = builder('## How I like things built\nPrefer built-in nodes.');
    const handout = b.globalPreferences()!;
    expect(handout).toContain('Prefer built-in nodes.');
    // The known-firing half: without it, the row above would pass against a
    // method that always returned undefined and never charged anything.
    expect(charged(b)).toEqual([{ source: 'user-profile', chars: handout.length }]);
  });

  it('charges the capped length, not the length of the file', () => {
    const b = builder(`## Tone\n\n${'x'.repeat(PROFILE_CAP * 4)}`);
    const handout = b.globalPreferences()!;
    expect(handout.length).toBeLessThanOrEqual(PROFILE_CAP);
    expect(charged(b)[0].chars).toBe(handout.length);
  });

  it('behaves exactly as it did before FIX-021 when no profile is injected at all', () => {
    // The default matters: `AuthoringSession` passes the provider's snapshot,
    // and in the headless measurement bundle there is no provider.
    const b = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, {});
    expect(b.globalPreferences()).toBeUndefined();
    expect(b.log).toEqual([]);
  });
});
