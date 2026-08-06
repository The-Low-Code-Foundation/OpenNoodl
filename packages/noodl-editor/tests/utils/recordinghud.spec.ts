/**
 * HUD-001 — what the recording overlay says.
 *
 * The overlay is React over the canvas and this suite is jasmine in Electron with nothing that
 * renders React, so the split is the same one `ProvenancePanel` has against `walkEngine`: the
 * decisions that can be wrong are pure functions and the component only positions the results.
 *
 * What is asserted is the sentence a placeholder would otherwise have swallowed — a recording
 * that has captured nothing yet has to say so, because on an untouched canvas it is otherwise
 * indistinguishable from a HUD that silently failed to mount.
 */

import { canvasNote, headerSummary } from '@noodl-utils/provenance/recordingHud';

describe('recordingHud — the live counter', () => {
  it('counts events app-wide, and gets the singular right', () => {
    expect(headerSummary(0)).toBe('0 events');
    expect(headerSummary(1)).toBe('1 event');
    expect(headerSummary(47)).toBe('47 events');
  });
});

describe('recordingHud — a count of zero is a result', () => {
  it('says nothing at all while idle', () => {
    expect(canvasNote({ recording: false, eventCount: 0 })).toBeUndefined();
  });

  it('answers a live zero rather than showing a placeholder', () => {
    const note = canvasNote({ recording: true, eventCount: 0 });
    expect(note).toContain('Nothing has fired yet');
  });

  it('stops explaining once something has fired', () => {
    expect(canvasNote({ recording: true, eventCount: 3 })).toBeUndefined();
  });
});
