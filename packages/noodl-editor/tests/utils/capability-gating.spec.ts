/**
 * BCN-010 — the editor half of the gate.
 *
 * The *policy* is tested in `@noodl/backend-contract`'s `gating.test.ts`, over
 * every cell of every descriptor. What is tested here is the thing that policy
 * cannot reach: whether a row on screen ends up disabled, and whether it can end
 * up disabled **without a sentence on it**, which is the one outcome this task
 * calls a build failure.
 */

import { decoratePortElement, GATED_PORT_CONTROL_CLASS } from '@noodl-utils/capability-gating/portDecoration';

import type { CapabilityGate } from '@noodl/backend-contract';

function control(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'the-real-control';
  el.textContent = 'a port row';
  return el;
}

const TARGET = { backendId: 'b1', type: 'directus' as const, url: 'http://x', name: 'Rig Directus' };

describe('capability gating — the property panel row', () => {
  it('leaves a supported port completely alone', () => {
    const el = control();
    const gate: CapabilityGate = { declared: 'supported', effective: 'supported', isUsable: true, isUnprobed: false };
    expect(decoratePortElement(el, gate, TARGET, 'realtime')).toBe(el);
  });

  it('disables an unsupported port AND puts the reason under it', () => {
    const gate: CapabilityGate = {
      declared: 'unsupported',
      effective: 'unsupported',
      isUsable: false,
      reason: 'Directus controls access with roles and permissions.',
      isUnprobed: false
    };

    const out = decoratePortElement(control(), gate, TARGET, 'accessControl') as HTMLElement;

    expect(out.querySelector('.the-real-control')).not.toBeNull();
    expect(out.querySelector(`.${GATED_PORT_CONTROL_CLASS}`)).not.toBeNull();
    expect(out.getAttribute('data-capability-state')).toBe('unsupported');

    const reason = out.querySelector('[data-test="capability-reason-accessControl"]') as HTMLElement;
    expect(reason).not.toBeNull();
    // Prefixed, because this reason does not name the backend itself — see
    // `gateSentence`. The unprefixed case is covered below.
    expect(reason.textContent).toBe('Rig Directus: Directus controls access with roles and permissions.');
  });

  it('annotates a degraded port WITHOUT disabling it — the operation still works', () => {
    const gate: CapabilityGate = {
      declared: 'degraded',
      effective: 'degraded',
      isUsable: true,
      reason: 'NodeGX reads the value and writes it back, so it is not atomic.',
      isUnprobed: false
    };

    const out = decoratePortElement(control(), gate, TARGET, 'increment') as HTMLElement;

    expect(out.querySelector(`.${GATED_PORT_CONTROL_CLASS}`)).toBeNull();
    expect(out.querySelector('[data-test="capability-reason-increment"]')).not.toBeNull();
  });

  it('⚠️ REFUSES to disable a port it cannot explain', () => {
    // The failure mode the whole task is built around, from the other side: a
    // dead control with no sentence is indistinguishable from a bug. If the
    // descriptor ever has a hole in it, the row stays usable and the console
    // carries the complaint.
    const gate = {
      declared: 'unsupported',
      effective: 'unsupported',
      isUsable: false,
      isUnprobed: false
    } as CapabilityGate;

    const el = control();
    expect(decoratePortElement(el, gate, TARGET, 'accessControl')).toBe(el);
  });

  it('escapes the reason rather than writing it as markup', () => {
    // A `custom` backend's descriptor is filled in by the user, so one of these
    // sentences is user input by design.
    const gate: CapabilityGate = {
      declared: 'unsupported',
      effective: 'unsupported',
      isUsable: false,
      reason: '<img src=x onerror="throw 1">',
      isUnprobed: false
    };

    const out = decoratePortElement(control(), gate, TARGET, 'p') as HTMLElement;
    const reason = out.querySelector('[data-test="capability-reason-p"]') as HTMLElement;
    expect(reason.querySelector('img')).toBeNull();
    expect(reason.textContent).toContain('<img');
  });

  it('names the backend only when the reason does not already', () => {
    const named: CapabilityGate = {
      declared: 'unsupported',
      effective: 'unsupported',
      isUsable: false,
      reason: 'Rig Directus has no magic-link login.',
      isUnprobed: false
    };
    const unnamed: CapabilityGate = { ...named, reason: 'Totals have to be switched on for your project.' };

    const a = decoratePortElement(control(), named, TARGET, 'a') as HTMLElement;
    const b = decoratePortElement(control(), unnamed, TARGET, 'b') as HTMLElement;

    expect(a.querySelector('[data-test="capability-reason-a"]').textContent).toBe(
      'Rig Directus has no magic-link login.'
    );
    expect(b.querySelector('[data-test="capability-reason-b"]').textContent).toBe(
      'Rig Directus: Totals have to be switched on for your project.'
    );
  });

  it('does nothing when there is no gate at all', () => {
    const el = control();
    expect(decoratePortElement(el, undefined, TARGET, 'p')).toBe(el);
  });
});
