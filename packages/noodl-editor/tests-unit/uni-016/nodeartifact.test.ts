/**
 * UNI-016 — the structured payload, and the two claims that can actually fail.
 *
 * 🔴 **THIS FILE CARRIES AC2's LOAD-BEARING ASSERTION, and the platform's cannot.**
 *
 * AC2 is *"a withheld port is visible as withheld, and its name and value appear nowhere."*
 * The platform asserts that against a served page — and over there the withheld name **was
 * never in the request**, so no implementation of that route could emit it. The assertion is
 * true by construction, which means it cannot fail, which means it is not evidence.
 *
 * Here the withheld port **is present in the input**: it is a row the composer offered, with a
 * real name and a real value, that the user left unticked. Dropping it is a thing this code
 * has to *do*, and the spec fails if it stops doing it. That is the difference between an
 * absence check on the right population and one on the wrong one.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE SECOND CLAIM: THE PAYLOAD IS SUBORDINATE TO THE PROSE, NOT PARALLEL TO IT.
 *
 * `nodequestion.ts` states its rule three times over: *"there is one string, and it is both
 * shown and sent"*, because *"two paths that agree today are the arrangement that stops
 * agreeing."* A structured payload is inescapably a second path — so the test is not that the
 * two agree today, which any pair of fixtures can be made to show. It is that the payload's
 * published strings are **exactly** `sharedStrings(attachment)` plus the environment: the same
 * enumeration UNI-011 AC3 already grades the prose against. One vocabulary, two consumers, and
 * a divergence in either fails here.
 *
 * ⚠️ Graded from both sides, as `portshare.test.ts` is: a known-BROKEN probe the sweep must
 * reject, and an assertion of what SURVIVED — because a builder that published nothing at all
 * passes every absence test ever written.
 */

import {
  artifactStrings,
  buildNodeArtifacts,
  type NodeExcerptPayload,
  type CapturePayload
} from '../../src/editor/src/models/community/nodeartifact';
import { QuestionEnvironment } from '../../src/editor/src/models/community/nodequestion';
import {
  ShareAttachment,
  SharablePort,
  formatShareAttachment,
  portShareKey,
  sharedStrings
} from '../../src/editor/src/models/community/portshare';

const ENVIRONMENT: QuestionEnvironment = {
  appVersion: '0.1.7',
  packaged: true,
  platform: 'darwin',
  arch: 'arm64',
  release: '24.5.0'
};

/**
 * The strings the project is holding. Each is reachable through exactly one row, so a failure
 * names the rule that broke rather than reporting that something leaked.
 */
const WITHHELD_NAME = 'clientMatterRef';
const WITHHELD_VALUE = '"ACME-1183-INVOICE"';
const SHARED_NAME = 'Items';
const SHARED_VALUE = '4 items';

function row(port: string, direction: 'input' | 'output', value: string, sharedByDefault: boolean): SharablePort {
  return {
    key: portShareKey(port, direction),
    port,
    direction,
    value,
    shape: 'text',
    sharedByDefault,
    offBecause: sharedByDefault ? [] : ['port-name-is-yours']
  };
}

/** One ticked row, one unticked row the user could have ticked, and a capture. */
function attachmentWithOneWithheld(withCapture = false): ShareAttachment {
  const shared = row(SHARED_NAME, 'input', SHARED_VALUE, true);
  const withheld = row(WITHHELD_NAME, 'input', WITHHELD_VALUE, false);
  return {
    capture: withCapture ? { width: 1280, height: 800, bytes: 204_800 } : null,
    ports: [shared, withheld],
    shared: new Set([shared.key])
  };
}

describe('AC2 — a withheld port’s name and value are nowhere in the payload', () => {
  it('drops the unticked row entirely, and counts it by direction only', () => {
    const attachments = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment: attachmentWithOneWithheld()
    });

    /**
     * 🔴 `artifactStrings`, NOT `JSON.stringify`, AND THE FIRST DRAFT OF THIS FILE GOT IT
     * WRONG IN THE DANGEROUS DIRECTION.
     *
     * `WITHHELD_VALUE` contains literal double quotes, because a text preview value does —
     * `previewValue()` renders `"Invoice for Acme"` with them. Serialise the payload and JSON
     * escapes them to `\"`, so `expect(serialised).not.toContain('"ACME-1183-INVOICE"')`
     * **passes whether or not the value is in there**. The absence assertion was worthless and
     * looked identical to a real one; the control below — which asserts the same string is
     * PRESENT once the row is ticked — is the only thing that said so.
     *
     * The enumeration compares the values as values, so an encoding cannot hide one.
     */
    const published = artifactStrings(attachments);

    // THE KNOWN-FIRING CONTROL, ASSERTED FIRST. A builder that published an empty payload —
    // or threw and returned nothing — satisfies both absence assertions below completely.
    expect(published).toContain(SHARED_NAME);
    expect(published).toContain(SHARED_VALUE);

    // The claim. The withheld row was in the INPUT; dropping it is work this code does.
    expect(published).not.toContain(WITHHELD_NAME);
    expect(published).not.toContain(WITHHELD_VALUE);

    // Visible as withheld: the direction and the count, never the name. UNI-016's scope calls
    // an invisible redaction "a hole" rather than privacy.
    const payload = attachments[0].payload as unknown as NodeExcerptPayload;
    expect(payload.withheldPorts).toEqual([{ direction: 'input' }]);
    expect(payload.ports).toHaveLength(1);
  });

  it('a withheld port publishes DIRECTION and nothing else — the object has one key', () => {
    const attachments = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment: attachmentWithOneWithheld()
    });
    const payload = attachments[0].payload as unknown as NodeExcerptPayload;
    // A field added to `WithheldPort` later — a shape, a key, an "offBecause" — would be a
    // channel back to the row that was withheld, and it would arrive silently.
    expect(Object.keys(payload.withheldPorts[0])).toEqual(['direction']);
  });

  it('control — ticking the same row publishes it, so the drop is the tick and not the fixture', () => {
    const attachment = attachmentWithOneWithheld();
    const everything: ShareAttachment = {
      ...attachment,
      shared: new Set(attachment.ports.map((port) => port.key))
    };
    const attachments = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment: everything
    });

    const published = artifactStrings(attachments);
    expect(published).toContain(WITHHELD_NAME);
    expect(published).toContain(WITHHELD_VALUE);
    expect((attachments[0].payload as unknown as NodeExcerptPayload).withheldPorts).toEqual([]);
  });
});

describe('the payload is subordinate to the prose', () => {
  it('publishes exactly sharedStrings plus the environment — no more', () => {
    const attachment = attachmentWithOneWithheld(true);
    const attachments = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment
    });

    const published = new Set(artifactStrings(attachments));
    // Everything the PROSE is allowed to publish, by UNI-011 AC3's own enumeration.
    const fromPorts = new Set(sharedStrings(attachment));
    // Plus the three the artifact adds, all of them the editor's own facts about itself.
    const environmentStrings = new Set(['For Each', '0.1.7', 'darwin arm64 (24.5.0)']);

    for (const value of published) {
      // ⚠️ jest's `expect` takes no message argument (that is vitest). The failing VALUE has
      // to be inside the assertion or the report says only `false !== true`.
      expect({ value, traced: fromPorts.has(value) || environmentStrings.has(value) }).toEqual({
        value,
        traced: true
      });
    }
    // And the other direction — every ticked string survived. Without this the sweep passes on
    // a builder that publishes nothing.
    for (const value of fromPorts) {
      expect({ value, survived: published.has(value) }).toEqual({ value, survived: true });
    }
  });

  it('KNOWN-BROKEN PROBE — a payload built from every row instead of the ticked ones is rejected', () => {
    const attachment = attachmentWithOneWithheld();
    // What the sweep must catch: the mistake of reading `attachment.ports` rather than calling
    // `sharedPorts`, which is a one-word edit inside `nodeartifact.ts` and looks correct.
    const broken = [
      {
        kind: 'node_excerpt' as const,
        payload: {
          nodeType: 'For Each',
          appVersion: '0.1.7',
          os: 'darwin arm64 (24.5.0)',
          ports: attachment.ports.map((port) => ({
            name: port.port,
            direction: port.direction,
            value: port.value
          })),
          withheldPorts: []
        }
      }
    ];

    const fromPorts = new Set(sharedStrings(attachment));
    const environmentStrings = new Set(['For Each', '0.1.7', 'darwin arm64 (24.5.0)']);
    const offending = artifactStrings(broken).filter(
      (value) => !fromPorts.has(value) && !environmentStrings.has(value)
    );

    // 🔴 The probe must be caught, and caught on the WITHHELD row specifically — a sweep that
    // rejected it for some other reason would grade a different defect.
    expect(offending).toContain(WITHHELD_NAME);
    expect(offending).toContain(WITHHELD_VALUE);
  });

  it('the OS and version strings read identically to the body’s own lines', () => {
    const attachment = attachmentWithOneWithheld();
    const payload = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment
    })[0].payload as unknown as NodeExcerptPayload;

    // ⚠️ `composeNodeQuestion` formats these privately. Asserting the exact strings here is
    // what makes a change to either formatter show up as a disagreement rather than as two
    // slightly different facts on one screen.
    expect(payload.os).toBe('darwin arm64 (24.5.0)');
    expect(payload.appVersion).toBe('0.1.7');
  });

  it('a source build says so, in the payload as well as in the prose', () => {
    const payload = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: { ...ENVIRONMENT, packaged: false },
      attachment: null
    })[0].payload as unknown as NodeExcerptPayload;
    expect(payload.appVersion).toBe('0.1.7 (from source)');
  });

  it('the ticked values are byte-identical to the ones the prose renders', () => {
    const attachment = attachmentWithOneWithheld();
    const prose = formatShareAttachment(attachment);
    const payload = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment
    })[0].payload as unknown as NodeExcerptPayload;

    for (const port of payload.ports) {
      expect(prose).toContain(port.name);
      if (port.value !== null) expect(prose).toContain(port.value);
    }
  });
});

describe('the shape the platform requires', () => {
  it('always sends a node_excerpt, even when nothing was ticked', () => {
    const attachments = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment: null
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0].kind).toBe('node_excerpt');

    // 0009's `attachment_kind_has_its_fields`: a `node_excerpt` must carry `nodeType` and
    // `ports`. An empty array is a present key; an absent one is a refused insert, and it
    // would abort the whole question with it.
    const payload = attachments[0].payload as unknown as NodeExcerptPayload;
    expect(payload.nodeType).toBe('For Each');
    expect(Array.isArray(payload.ports)).toBe(true);
  });

  it('adds a capture attachment with dimensions, and no image and no path', () => {
    const attachments = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment: attachmentWithOneWithheld(true)
    });
    expect(attachments.map((a) => a.kind)).toEqual(['node_excerpt', 'capture']);

    const capture = attachments[1].payload as unknown as CapturePayload;
    expect(capture).toMatchObject({ width: 1280, height: 800, bytes: 204_800 });
    // 🔴 Blob storage is owned by no task. What must NOT appear is a data URI or a file path:
    // the path names the machine and usually the project, and `saveCaptureNextTo`'s return
    // value is shown in the dialog and published nowhere.
    const keys = Object.keys(capture);
    for (const forbidden of ['data', 'path', 'url', 'image', 'file']) {
      expect({ forbidden, keys }).toEqual({ forbidden, keys: expect.not.arrayContaining([forbidden]) });
    }
  });

  it('no capture attachment when the user untick­ed it', () => {
    const attachments = buildNodeArtifacts({
      nodeType: 'For Each',
      environment: ENVIRONMENT,
      attachment: attachmentWithOneWithheld(false)
    });
    expect(attachments.map((a) => a.kind)).toEqual(['node_excerpt']);
  });

  it('never emits a graph_fragment — that kind means “pullable”, and this is not', () => {
    // 🔴 UNI-018's hazard: `graph_fragment` is the kind an answer carries so a reader can pull
    // it INTO their editor and run it, and a `Function` node's `functionScript` is executable
    // JavaScript on the puller's machine. UNI-011's excerpt is bucketed types and wiring — not
    // executable, not reconstructible — and filing it under that kind would hand UNI-018 a
    // population it cannot honour.
    const attachments = buildNodeArtifacts({
      nodeType: '<component>',
      environment: ENVIRONMENT,
      attachment: attachmentWithOneWithheld(true)
    });
    expect(attachments.map((a) => a.kind)).not.toContain('graph_fragment');
  });

  it('publishes the bucketed type verbatim — a sentinel is a legitimate nodeType', () => {
    const payload = buildNodeArtifacts({
      nodeType: '<component>',
      environment: ENVIRONMENT,
      attachment: null
    })[0].payload as unknown as NodeExcerptPayload;
    // ⚠️ `<component>` reaching the facet column is CORRECT: it says "a component from their
    // own project", which is exactly what a reader filtering the Bench should see, and it is
    // what the composer put in the body two inches away.
    expect(payload.nodeType).toBe('<component>');
  });
});
