/**
 * CN-015 — the hop that carries a kit's load failure to the editor.
 *
 * ## Why this hop needs its own test
 *
 * A kit whose `index.js` throws, fails to parse or 404s **never reaches this
 * runtime**. `registerModule` is not called for it, nothing lands in the node
 * register, and so there is nothing here that any later inspection can find.
 * The fact exists in exactly one place — the record the page made while it was
 * loading — and this is the one hop that carries it onward.
 *
 * 🔴 **The consequence of dropping it is not a missing warning, it is a wrong
 * one.** With no failure reported, the editor's kits list falls through to
 * *"Installed. Reload the preview to load its nodes"* — telling the author to
 * do the single thing that cannot help, about a kit that is broken. That is why
 * this is asserted at the hop rather than trusted.
 *
 * ⚠️ The *capture* itself (does a `throw` in a classic script actually produce
 * an event, and is it attributable to the right kit) is not testable here and
 * is not claimed here: it is a browser behaviour, and it was measured in
 * Chromium against `@nodegx/module-inject`'s real output. This suite covers
 * only what this package owns — that what the host hands over is what the
 * editor receives, and that a healthy project's payload is untouched.
 */

import NoodlRuntime = require('../noodl-runtime');

type Payload = {
  projectsettings?: unknown;
  modulefailures?: Array<{ module: string; reason: string; message: string }>;
};

const FAILURE = {
  module: 'Throwing Kit',
  reason: 'threw',
  message: 'Uncaught ReferenceError: undefinedFunctionCall is not defined'
};

function runtime() {
  return new NoodlRuntime({
    type: 'browser',
    platform: {
      requestUpdate: () => undefined,
      getCurrentTime: () => 0,
      objectToString: (o: unknown) => JSON.stringify(o)
    }
  });
}

function payloadOf(rt: ReturnType<typeof runtime>): Payload {
  return JSON.parse(rt.getNodeLibrary());
}

describe('CN-015 — module load failures on the wire', () => {
  it('carries a failure the host handed it into the node library payload', () => {
    const rt = runtime();
    rt.setModuleFailures([FAILURE]);

    const payload = payloadOf(rt);
    expect(payload.modulefailures).toEqual([FAILURE]);
  });

  it('names the kit and says what the browser said, verbatim', () => {
    // 🔴 The message is passed through, not summarised. "A kit failed to load"
    // without the browser's own words sends the author back to devtools, which
    // is the tool AC1 exists so they do not have to open.
    const rt = runtime();
    rt.setModuleFailures([FAILURE]);

    const [carried] = payloadOf(rt).modulefailures!;
    expect(carried.module).toBe('Throwing Kit');
    expect(carried.message).toContain('undefinedFunctionCall is not defined');
  });

  it('omits the field entirely for a healthy project, rather than sending an empty list', () => {
    // ⚠️ Deliberate, and load-bearing twice over: `sendNodeLibrary` suppresses a
    // resend when the serialised payload is unchanged, and the recorded-payload
    // fixtures other suites grade against were captured before this feature.
    // An `[]` would perturb both for every project in existence.
    const rt = runtime();
    expect('modulefailures' in payloadOf(rt)).toBe(false);

    rt.setModuleFailures([]);
    expect('modulefailures' in payloadOf(rt)).toBe(false);
  });

  it('forgets failures when the host reports none, so a fixed kit stops being accused', () => {
    const rt = runtime();
    rt.setModuleFailures([FAILURE]);
    expect(payloadOf(rt).modulefailures).toHaveLength(1);

    rt.setModuleFailures(undefined);
    expect('modulefailures' in payloadOf(rt)).toBe(false);
  });

  it('leaves the rest of the payload alone', () => {
    // The stamp must be additive. `projectsettings` is the neighbouring stamp
    // and the closest thing to a canary for one clobbering the other.
    const rt = runtime();
    const before = payloadOf(rt);
    rt.setModuleFailures([FAILURE]);
    const after = payloadOf(rt);

    delete after.modulefailures;
    expect(after).toEqual(before);
  });
});
