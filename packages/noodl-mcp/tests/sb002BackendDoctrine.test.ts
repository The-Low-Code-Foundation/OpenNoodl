/**
 * SB-002 — the backend has a vocabulary too.
 *
 * The shipped prefab library composes cloud components three levels deep; until
 * phase 76 nothing taught the idiom, and the frontend doctrine actively misled
 * on cloud graphs ("a component's interface is a Component Inputs node" — true
 * for a cloud helper, false for a cloud function). The doctrine rides
 * `get_project_info` beside `authoringDoctrine` because the surface budget gate
 * measures `instructions` and a result field rides free (`toolDisclosure`
 * stays the gate that proves the surface did not grow).
 *
 * Asserted over real stdio, not against the source module — the claim under
 * test is that an external agent RECEIVES the text, and `rejectionExamples`'
 * traps spec records why: a paragraph can be added to a source file and never
 * leave the process.
 */
import * as fs from 'fs';

import { BACKEND_DOCTRINE_MD } from '../src/editor-deps';

import { call, connect, copyFixture } from './helpers';

describe('SB-002 — the backend doctrine reaches the agent', () => {
  it('rides get_project_info read-write, verbatim from the shared module, and not read-only', async () => {
    const dir = copyFixture();

    const rw = await connect(dir, true);
    const info = await call<{ backendDoctrine?: string }>(rw, 'get_project_info');
    // Verbatim: one substrate, two clients — no second dialect.
    expect(info.data.backendDoctrine).toBe(BACKEND_DOCTRINE_MD);
    await rw.close();

    const ro = await connect(dir, false);
    const roInfo = await call<{ backendDoctrine?: string }>(ro, 'get_project_info');
    expect(roInfo.data.backendDoctrine).toBeUndefined();
    await ro.close();

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('carries the claims the rest of the phase measured', () => {
    // The correction to the frontend doctrine — the single most important line.
    expect(BACKEND_DOCTRINE_MD).toContain('NOT a Component Inputs node');
    // Function vs helper, and the boundary SB-003 built.
    expect(BACKEND_DOCTRINE_MD).toContain('noodl.cloud.request');
    expect(BACKEND_DOCTRINE_MD).toContain('not an endpoint');
    expect(BACKEND_DOCTRINE_MD).toContain('404');
    // The runtime rule SB-001 gates.
    expect(BACKEND_DOCTRINE_MD).toContain('#__cloud__/');
    expect(BACKEND_DOCTRINE_MD).toContain('wrong-runtime-node');
    // The composition idiom and its credential shape.
    expect(BACKEND_DOCTRINE_MD).toContain('noodl.cloud.secret');
    // The step-auth trap (a step calls in process, with no session).
    expect(BACKEND_DOCTRINE_MD).toContain('Allow Unauthenticated');
    // The one-sentence model.
    expect(BACKEND_DOCTRINE_MD).toContain('A workflow orchestrates; a cloud function computes');
  });

  it('carries the five rules SB-004 §7 and SB-013 measured on a deployed graph', () => {
    // Each of these was green through BOTH authoring doors and broken once
    // deployed, so nothing but this text stands between an agent and shipping
    // one. Asserted claim by claim rather than on the heading, because a
    // heading survives a rewrite that drops the rule under it.

    // The shared cause — no editor connection out there.
    expect(BACKEND_DOCTRINE_MD).toContain('isRunningLocally()');

    // 1. Undeclared signal ports are dead (a 30s timeout, not an error).
    expect(BACKEND_DOCTRINE_MD).toContain('"name": "out-ok", "plug": "output", "type": "signal"');
    expect(BACKEND_DOCTRINE_MD).toContain('30-second timeout');

    // 2. A signal does not promise the values beside it arrived.
    expect(BACKEND_DOCTRINE_MD).toContain('A signal is not a promise');
    expect(BACKEND_DOCTRINE_MD).toContain('=== undefined');
    expect(BACKEND_DOCTRINE_MD).toContain('runOnValueChange');

    // 3. A query fetches once, unfiltered, at graph-build time — and the fix's
    //    precondition is a filter PORT, not a filter (SB-006's third query
    //    shape), so the counter-rule has to travel with the rule.
    expect(BACKEND_DOCTRINE_MD).toContain('fetches once, unfiltered');
    expect(BACKEND_DOCTRINE_MD).toContain('"runOnChange-collectionName": false');
    expect(BACKEND_DOCTRINE_MD).toContain('a filter PORT, not a filter');
    // …and the other end of it, SB-008 F21: boxes on AND a `storageFetch` wire
    // runs everything downstream twice. Both halves or neither — s8 shipped the
    // rule without this half, and s10 is what that omission cost.
    expect(BACKEND_DOCTRINE_MD).toContain('do not do both');
    expect(BACKEND_DOCTRINE_MD).toContain('twice');

    // 4. `points to` widens instead of failing; the String fallback is named.
    expect(BACKEND_DOCTRINE_MD).toContain('points to');
    expect(BACKEND_DOCTRINE_MD).toContain('widens instead of failing');
    expect(BACKEND_DOCTRINE_MD).toContain('plain id String');

    // 5. 🔴 SB-013. `Run` is additive, so a wired trigger is not the only one,
    //    and `isEmpty` is one value for two opposite facts. Both halves are
    //    asserted because the pair is the defect: either alone is harmless, and
    //    a text carrying one of them teaches a fix that does not hold.
    // ⚠️ Fragments that do not span a line break: this text is hard-wrapped, so
    // a phrase chosen across one asserts the wrapping rather than the claim.
    expect(BACKEND_DOCTRINE_MD).toContain('does not stop a code node running on its own');
    expect(BACKEND_DOCTRINE_MD).toContain('from "not yet"');
    expect(BACKEND_DOCTRINE_MD).toContain('if (Inputs.rows === undefined) return;');
    expect(BACKEND_DOCTRINE_MD).toContain('"runOnChange-in-expected": false');
    // The consequence, in the words that say why it is not a tidiness rule.
    expect(BACKEND_DOCTRINE_MD).toContain('put a second, unrelated caller into the');
  });

  it('🔴 SB-016 — carries the asymmetry a graph cannot author its way out of', () => {
    // The reason this is doctrine and not a footnote: `Allow Unauthenticated`
    // has two values and a privileged endpoint needs a third, so an agent that
    // does not know this will author a `publishPage` that is correct in every
    // other respect and callable by anybody who signs up. SB-015's drive
    // measured exactly that happening.
    // ⚠️ Fragments chosen not to span a line break — this text is hard-wrapped.

    // The asymmetry itself: one gate has a defaults tier and the other does not.
    expect(BACKEND_DOCTRINE_MD).toContain('there is no defaults');
    expect(BACKEND_DOCTRINE_MD).toContain('fails shut');

    // What `authenticated` actually means, in the words that stop it reading as
    // a privilege boundary.
    expect(BACKEND_DOCTRINE_MD).toContain('any account that can sign up');

    // Why the gate is the whole boundary.
    expect(BACKEND_DOCTRINE_MD).toContain('runs as');
    expect(BACKEND_DOCTRINE_MD).toContain('there is nothing');

    // The fix, as something an agent can paste rather than as advice.
    expect(BACKEND_DOCTRINE_MD).toContain('"call": "role:admin"');
    expect(BACKEND_DOCTRINE_MD).toContain('nodegx.security.json');

    // And the half a loopback build will never show you.
    expect(BACKEND_DOCTRINE_MD).toContain('A loopback backend does not');
  });
});
