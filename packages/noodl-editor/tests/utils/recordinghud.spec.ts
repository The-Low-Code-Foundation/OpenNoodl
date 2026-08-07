/**
 * HUD-001 / HUD-002 — what the recording overlay decides.
 *
 * The overlay is React over the canvas and this suite is jasmine in Electron with nothing that
 * renders React, so the split is the same one `ProvenancePanel` has against `walkEngine`: the
 * decisions that can be wrong are pure functions and the component only positions the results.
 *
 * What is asserted is the fold, the fade, and the three sentences that exist so an empty canvas
 * never reads as a HUD that failed to mount.
 */

import {
  BADGE_FADE_MS,
  EMPTY_BADGE_STATE,
  badgeOpacity,
  canvasNote,
  foldEvents,
  headerSummary,
  offCanvas,
  recordingSummary,
  visibleBadges
} from '@noodl-utils/provenance/recordingHud';
import type { TraceEventLike } from '@noodl-utils/provenance/walkEngine';

function event(seq: number, from: string, to: string, t = seq): TraceEventLike {
  return {
    seq,
    t,
    cause: 0,
    from: { node: from, port: 'out' },
    to: { node: to, port: 'in' },
    value: 'signal',
    kind: 'signal'
  };
}

/** A run of `count` events on the same edge — a button clicked over and over. */
function burst(count: number, from: string, to: string, startSeq = 1): TraceEventLike[] {
  const out: TraceEventLike[] = [];
  for (let i = 0; i < count; i++) out.push(event(startSeq + i, from, to));
  return out;
}

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

  it('stops explaining once something has fired here', () => {
    expect(canvasNote({ recording: true, eventCount: 3, onCanvasBadges: 2 })).toBeUndefined();
  });
});

describe('recordingHud — the fold from trace events to badges', () => {
  it('badges both ends of every edge that fired', () => {
    const state = foldEvents(EMPTY_BADGE_STATE, [event(1, 'button', 'counter')], 1000);

    expect(Object.keys(state.nodes).sort()).toEqual(['button', 'counter']);
    expect(state.total).toBe(1);
  });

  it('an edge that fired 40 times is ONE badge reading 40×', () => {
    const state = foldEvents(EMPTY_BADGE_STATE, burst(40, 'button', 'counter'), 1000);
    const badges = visibleBadges(state, 1000);

    expect(badges.length).toBe(2);
    expect(badges.every((badge) => badge.count === 40)).toBe(true);
  });

  it('folds only the delta, and returns the same state when a poll brought nothing new', () => {
    const events = burst(3, 'button', 'counter');
    const first = foldEvents(EMPTY_BADGE_STATE, events, 1000);

    // The session hands over its whole accumulated buffer on every poll, not just the new part.
    expect(foldEvents(first, events, 2000)).toBe(first);

    events.push(event(4, 'button', 'counter'));
    const third = foldEvents(first, events, 3000);
    expect(third.total).toBe(4);
    expect(third.nodes['counter'].touches).toBe(4);
    // The fold stamps the EDITOR's clock, never the event's `t` — `t` is `performance.now()`
    // in the browser viewer, milliseconds since the preview page loaded.
    expect(third.nodes['counter'].seenAt).toBe(3000);
  });

  it('an emptied buffer is a reset, not "no news"', () => {
    const state = foldEvents(EMPTY_BADGE_STATE, burst(3, 'button', 'counter'), 1000);

    // `TraceSession.start()` and `clear()` both empty the array. Keeping the old badges would
    // draw the previous recording over the new one.
    expect(foldEvents(state, [], 2000)).toBe(EMPTY_BADGE_STATE);
  });

  it('a renumbered buffer means the preview reloaded — it resets rather than discarding it all', () => {
    const state = foldEvents(EMPTY_BADGE_STATE, burst(5, 'button', 'counter'), 1000);
    expect(state.lastSeq).toBe(5);

    // A reloaded page builds a fresh TraceBuffer numbering from 1 again. Treating that as
    // "already seen" would silently drop every event of the new session.
    const after = foldEvents(state, burst(2, 'link', 'page'), 2000);
    expect(after.total).toBe(2);
    expect(Object.keys(after.nodes).sort()).toEqual(['link', 'page']);
  });
});

describe('recordingHud — the fade', () => {
  it('drops a badge once nothing has touched its node for the fade window', () => {
    const state = foldEvents(EMPTY_BADGE_STATE, [event(1, 'button', 'counter')], 1000);

    expect(visibleBadges(state, 1000 + BADGE_FADE_MS - 1).length).toBe(2);
    expect(visibleBadges(state, 1000 + BADGE_FADE_MS).length).toBe(0);
  });

  it('a node that fires again is fresh again', () => {
    let state = foldEvents(EMPTY_BADGE_STATE, [event(1, 'button', 'counter')], 1000);
    state = foldEvents(state, [event(1, 'button', 'counter'), event(2, 'button', 'counter')], 1000 + BADGE_FADE_MS - 1);

    expect(visibleBadges(state, 1000 + BADGE_FADE_MS).length).toBe(2);
  });

  it('orders badges by seq and never by t', () => {
    // Delivery in the runtime is queued, not a call stack (OBS-001): many events share a
    // millisecond and `t` is display-only, so ordering by it shuffles the causal story into
    // arrival noise. Here `t` says the opposite of `seq`.
    const state = foldEvents(EMPTY_BADGE_STATE, [event(1, 'first', 'a', 900), event(2, 'second', 'b', 100)], 1000);

    const ids = visibleBadges(state, 1000).map((badge) => badge.nodeId);
    expect(ids.slice(0, 2).sort()).toEqual(['b', 'second']);
    expect(ids.slice(2).sort()).toEqual(['a', 'first']);
  });

  it('caps how many badges are painted, keeping the newest', () => {
    const events: TraceEventLike[] = [];
    for (let i = 1; i <= 10; i++) events.push(event(i, `from${i}`, `to${i}`));
    const state = foldEvents(EMPTY_BADGE_STATE, events, 1000);

    const badges = visibleBadges(state, 1000, { limit: 4 });
    expect(badges.length).toBe(4);
    expect(badges.map((badge) => badge.lastSeq)).toEqual([10, 10, 9, 9]);
    expect(badges.map((badge) => badge.nodeId).sort()).toEqual(['from10', 'from9', 'to10', 'to9']);
  });

  it('holds full opacity before it fades, and never goes negative', () => {
    expect(badgeOpacity(0)).toBe(1);
    expect(badgeOpacity(BADGE_FADE_MS * 0.5)).toBe(1);
    expect(badgeOpacity(BADGE_FADE_MS)).toBe(0);
    expect(badgeOpacity(BADGE_FADE_MS * 2)).toBe(0);

    const middle = badgeOpacity(BADGE_FADE_MS * 0.83);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
  });
});

describe('recordingHud — being honest about what is off canvas', () => {
  const onlyHome = (nodeId: string) => nodeId.startsWith('home');
  const componentOf = (nodeId: string) => (nodeId.startsWith('home') ? '/Home' : '/Checkout');

  it('counts every event exactly once, attributed to the node that received it', () => {
    const state = foldEvents(
      EMPTY_BADGE_STATE,
      [...burst(3, 'homeButton', 'checkoutCounter'), ...burst(2, 'checkoutA', 'checkoutB', 10)],
      1000
    );

    const off = offCanvas(state, onlyHome, componentOf);

    // 3 delivered to checkoutCounter + 2 delivered to checkoutB. `homeButton` is on canvas and
    // `checkoutA` only ever emitted, so neither adds to the event count — which is what stops
    // an edge's two ends being counted as two events.
    expect(off.events).toBe(5);
    expect(off.nodes).toBe(3);
    expect(off.components).toEqual(['/Checkout']);
  });

  it('names the components while there are few enough, and stays quiet when there are not', () => {
    const state = foldEvents(
      EMPTY_BADGE_STATE,
      [event(1, 'a', 'b'), event(2, 'c', 'd'), event(3, 'e', 'f'), event(4, 'g', 'h')],
      1000
    );
    const nowhere = () => false;

    expect(offCanvas(state, nowhere, (nodeId) => `/Component-${nodeId}`, { maxNamed: 3 }).components).toEqual([]);
    expect(offCanvas(state, nowhere, () => '/One', { maxNamed: 3 }).components).toEqual(['/One']);
  });

  it('says nothing extra when the whole recording is on this canvas', () => {
    const state = foldEvents(EMPTY_BADGE_STATE, burst(3, 'homeA', 'homeB'), 1000);
    const off = offCanvas(state, onlyHome, componentOf);

    expect(off.events).toBe(0);
    expect(headerSummary(3, off)).toBe('3 events');
  });

  it('spells out the app-wide count beside what is elsewhere', () => {
    const off = { nodes: 4, events: 12, components: [] as string[] };
    expect(headerSummary(47, off)).toBe('47 events · 12 on other components');
    expect(headerSummary(47, { ...off, components: ['/Checkout'] })).toBe('47 events · 12 on /Checkout');
  });
});

describe('recordingHud — an empty canvas must not read as a broken overlay', () => {
  it('says where it IS happening when the canvas shows another component', () => {
    const note = canvasNote({
      recording: true,
      eventCount: 40,
      onCanvasBadges: 0,
      off: { nodes: 6, events: 40, components: ['/Checkout'] }
    });
    expect(note).toContain('/Checkout');
  });

  it('says so without naming names when there are too many components to name', () => {
    const note = canvasNote({
      recording: true,
      eventCount: 40,
      onCanvasBadges: 0,
      off: { nodes: 6, events: 40, components: [] }
    });
    expect(note).toContain('elsewhere in the app');
  });

  it('is silent once there is something on this canvas to look at', () => {
    expect(
      canvasNote({
        recording: true,
        eventCount: 40,
        onCanvasBadges: 3,
        off: { nodes: 2, events: 8, components: ['/Checkout'] }
      })
    ).toBeUndefined();
  });
});

describe('recordingHud — the receipt a finished recording leaves (F91)', () => {
  it('states the count and offers the door', () => {
    const summary = recordingSummary({ events: 137, interactions: 6 });
    expect(summary.text).toBe('Recorded 137 events · 6 interactions');
    expect(summary.hasResults).toBe(true);
  });

  it('gets both singulars right', () => {
    expect(recordingSummary({ events: 1, interactions: 1 }).text).toBe('Recorded 1 event · 1 interaction');
  });

  it('a recording that captured nothing is a result, and gets no door', () => {
    const summary = recordingSummary({ events: 0, interactions: 0 });
    expect(summary.text).toContain('Recorded nothing');
    expect(summary.hasResults).toBe(false);
  });

  // The ring wrapped past the causes. There is still a trace worth walking, so the door stays —
  // `hasResults` is keyed on events and never on roots.
  it('still opens when the roots have been evicted but events remain', () => {
    const summary = recordingSummary({ events: 250000, interactions: 0 });
    expect(summary.text).toBe('Recorded 250000 events');
    expect(summary.hasResults).toBe(true);
  });

  it('never claims a negative recording', () => {
    expect(recordingSummary({ events: -1, interactions: -1 }).hasResults).toBe(false);
  });
});
