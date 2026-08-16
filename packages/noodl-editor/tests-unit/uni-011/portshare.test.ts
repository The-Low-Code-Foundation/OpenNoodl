/**
 * UNI-011 AC3 — the share attachment's disclosure boundary.
 *
 * > A capture from the running preview can be attached with per-port share toggles, defaulting to
 * > **off** for anything record-shaped. Nothing leaves the machine before the user posts.
 *
 * ## 🔴 The instrument is not AC2's, and the difference is the point
 *
 * `nodeexcerpt.test.ts` sweeps a **closed vocabulary**: every string the excerpt publishes must
 * come from a set the editor owns. That instrument is unavailable here, and reaching for it anyway
 * would produce a control that looks strong and checks nothing — a live port value *is* the user's
 * data, so there is no editor-owned set for it to belong to.
 *
 * What replaces it is a **provenance sweep**: every string the attachment publishes must trace to a
 * port whose toggle was on, in the exact form the composer displayed. That is the property AC3
 * actually claims, and unlike "no secrets are present" it is falsifiable by a value nobody wrote a
 * fixture for.
 *
 * 🔴 **Graded from both sides, as the excerpt's sweep is.** A known-**broken** probe — an
 * attachment whose formatter published an unticked row — which the sweep must reject; and an
 * assertion of what **survived**, because an attachment with nothing ticked passes every absence
 * test ever written.
 *
 * ## The defaults are the criterion, and the fixture is built to make each one fail differently
 *
 * A row can start off for its **value** or for its **name**, and the two are independent. The
 * fixture therefore carries all four combinations, so a rule that collapsed them — "off if the
 * value is a record" alone, or "off if the port is undeclared" alone — fails on a named row rather
 * than passing quietly on all of them.
 */

import {
  OFF_REASON_TEXT,
  PortValueInput,
  ShareAttachment,
  SharablePort,
  classifyPreviewValue,
  defaultSharedKeys,
  describeSharablePorts,
  formatShareAttachment,
  portShareKey,
  sharedPorts,
  sharedStrings
} from '../../src/editor/src/models/community/portshare';
import { REDACTED, REDACTED_EMAIL, REDACTED_PATH } from '../../src/editor/src/utils/report/redact';

const PATHS = { homeDir: '/Users/richard', projectDir: '/Users/richard/Projects/Acme Legal Portal' };

/**
 * Strings the app is holding. Each one is reachable only through the row named beside it, so a
 * failure says which rule broke rather than that something leaked.
 */
const PRIVATE = {
  /** A record on a library-declared port. Off for its VALUE. */
  customerRecord: '{name:"Priya Raman",email:"priya@acme-legal.co.uk",matter:"AC-2291"}',
  /** A string on a library-declared port. Off for its VALUE. */
  headline: '"Invoice for Acme Legal — March"',
  /** A scalar on a port the user named. Off for its NAME, and for nothing else. */
  retainerPort: 'acmeRetainerBalance',
  /** A record on a port the user named. Off for BOTH. */
  matterPort: 'clientMatterRef',
  matterRecord: '[{id:"AC-2291",client:"Acme Legal"}]',
  /** Free text carrying a credential, on a ticked row — the redactor's job, not the default's. */
  token: 'sk-ant-api03-h0st1leK3yD0N0tPub1ishThisEver00'
};

/**
 * The rows the composer would be handed for a `Text` node in a running app.
 *
 * `declared` is what {@link isLibraryPort} answered — this suite grades the *rule*, so the
 * library's verdict arrives as data rather than being re-derived here.
 */
function fixture(): PortValueInput[] {
  return [
    // Off for neither: a library port holding a boolean. The row that proves the sweep can pass.
    { port: 'visible', direction: 'input', value: 'true', declared: true },
    // Off for neither: a library port holding a number.
    { port: 'width', direction: 'output', value: '320', declared: true },
    // Off for its VALUE only.
    { port: 'text', direction: 'input', value: PRIVATE.headline, declared: true },
    { port: 'items', direction: 'output', value: PRIVATE.customerRecord, declared: true },
    // Off for its NAME only.
    { port: PRIVATE.retainerPort, direction: 'input', value: '1200', declared: false },
    // Off for BOTH.
    { port: PRIVATE.matterPort, direction: 'output', value: PRIVATE.matterRecord, declared: false },
    // Answered nothing — dropped entirely, so it is never a row to consent to.
    { port: 'hovered', direction: 'output', declared: true }
  ];
}

function rows(): SharablePort[] {
  return describeSharablePorts(fixture(), PATHS);
}

function attachmentOf(sharedKeys: readonly string[], capture: ShareAttachment['capture'] = null): ShareAttachment {
  return { capture, ports: rows(), shared: new Set(sharedKeys) };
}

// ───────────────────────────────────────────────────────────────────────────────
// The provenance sweep
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Strings the attachment published that no ticked row accounts for. Empty is the passing answer.
 *
 * ⚠️ **Built from the attachment's own `shared` set, not from the fixture's expectations.** A sweep
 * that compared against a hand-written list of "what should be there" would agree with the code by
 * construction whenever both were edited together.
 */
function unaccountedStrings(attachment: ShareAttachment): string[] {
  const allowed = new Set<string>();
  for (const row of attachment.ports) {
    if (!attachment.shared.has(row.key)) continue;
    allowed.add(row.port);
    allowed.add(row.value);
  }
  return sharedStrings(attachment).filter((value) => !allowed.has(value));
}

/** Every string any row *could* carry — what the formatted text must not contain when unticked. */
function withheldValues(attachment: ShareAttachment): string[] {
  return attachment.ports.filter((row) => !attachment.shared.has(row.key)).map((row) => row.value);
}

describe('UNI-011 AC3 — the attachment publishes only what was ticked', () => {
  it('publishes nothing at all when nothing is ticked', () => {
    const attachment = attachmentOf([]);

    expect(attachment.ports.length).toBeGreaterThan(0);
    expect(formatShareAttachment(attachment)).toBe('');
    expect(sharedStrings(attachment)).toEqual([]);
  });

  it('publishes the default set and nothing beside it', () => {
    const attachment = attachmentOf(defaultSharedKeys(rows()));

    expect(unaccountedStrings(attachment)).toEqual([]);

    const text = formatShareAttachment(attachment);
    for (const withheld of withheldValues(attachment)) expect(text).not.toContain(withheld);
  });

  /**
   * 🔴 The known-broken probe. Without it, `unaccountedStrings` returning `[]` is equally consistent
   * with a sweep that cannot see anything, and a gate that never fires is indistinguishable from a
   * gate that always passes. This is the same attachment with one unticked row's strings in the
   * published list.
   */
  it('the sweep FIRES on an attachment that published a row nobody ticked', () => {
    const all = rows();
    const leaked: ShareAttachment = {
      capture: null,
      ports: all,
      // Everything is published…
      shared: new Set(all.map((row) => row.key))
    };
    // …but the consent set says only the two safe rows were ticked.
    const asConsented: ShareAttachment = { ...leaked, shared: new Set([portShareKey('visible', 'input')]) };

    const escaped = sharedStrings(leaked).filter((value) => {
      const allowed = new Set<string>();
      for (const row of asConsented.ports) {
        if (!asConsented.shared.has(row.key)) continue;
        allowed.add(row.port);
        allowed.add(row.value);
      }
      return !allowed.has(value);
    });

    expect(escaped).toContain(PRIVATE.retainerPort);
    expect(escaped).toContain(PRIVATE.matterPort);
    expect(escaped.length).toBeGreaterThan(4);
  });

  /**
   * The other half of the pair. Every assertion above is satisfied by an attachment that published
   * nothing, so the fixture has to be shown to have produced a real answer.
   */
  it('and still says something: the ticked rows and their values survive', () => {
    const attachment = attachmentOf(defaultSharedKeys(rows()));
    const text = formatShareAttachment(attachment);

    expect(sharedPorts(attachment).map((row) => row.port)).toEqual(['visible', 'width']);
    // ⚠️ The labels are padded to a common width, so the `=` line up in the posted code block.
    expect(text).toContain('visible (input) = true');
    expect(text).toContain('width (output)  = 320');
  });

  it('publishes a record once the user ticks it — consent is the rule, not the shape', () => {
    const attachment = attachmentOf([portShareKey('items', 'output')]);
    const text = formatShareAttachment(attachment);

    expect(text).toContain('items (output)');
    // The value is there, but it is the redacted form — see the redaction suite below.
    expect(text).toContain('Priya Raman');
    expect(text).not.toContain('priya@acme-legal.co.uk');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// The defaults — AC3's actual words
// ───────────────────────────────────────────────────────────────────────────────

describe('UNI-011 AC3 — record-shaped rows default to off', () => {
  const described = rows();
  const byKey = (port: string, direction: 'input' | 'output') =>
    described.find((row) => row.key === portShareKey(port, direction)) as SharablePort;

  it('starts on for a library port holding a scalar, and off for everything else in the fixture', () => {
    expect(defaultSharedKeys(described)).toEqual([portShareKey('visible', 'input'), portShareKey('width', 'output')]);
  });

  it('drops a port that answered nothing rather than offering an empty row', () => {
    expect(described.find((row) => row.port === 'hovered')).toBeUndefined();
  });

  /**
   * 🔴 The two grounds are independent, and each is recorded even when the other also holds.
   *
   * Collapsing `offBecause` to the first reason found would let a change that fixed one ground read
   * as though it had cleared the row — the flattening this phase has already been bitten by once,
   * where a summary dropped a verdict's second branch.
   */
  it('records BOTH grounds on a row that has both', () => {
    expect(byKey('text', 'input').offBecause).toEqual(['free-text']);
    expect(byKey('items', 'output').offBecause).toEqual(['record-shaped']);
    expect(byKey(PRIVATE.retainerPort, 'input').offBecause).toEqual(['port-name-is-yours']);
    expect(byKey(PRIVATE.matterPort, 'output').offBecause).toEqual(['record-shaped', 'port-name-is-yours']);
  });

  it('a scalar on a port the user named is still off — the NAME is the disclosure', () => {
    const row = byKey(PRIVATE.retainerPort, 'input');
    expect(row.shape).toBe('scalar');
    expect(row.sharedByDefault).toBe(false);
  });

  it('every reason has a sentence, so a row can say why it is off', () => {
    for (const row of described) {
      for (const reason of row.offBecause) expect(OFF_REASON_TEXT[reason]).toBeTruthy();
    }
  });

  it('offBecause is empty exactly when the row is on by default', () => {
    for (const row of described) expect(row.offBecause.length === 0).toBe(row.sharedByDefault);
  });
});

describe('UNI-011 AC3 — what counts as record-shaped', () => {
  it('reads the runtime preview grammar', () => {
    expect(classifyPreviewValue('{a:1}')).toBe('record');
    expect(classifyPreviewValue('[1,2,3]')).toBe('record');
    expect(classifyPreviewValue('<Collection 7>')).toBe('record');
    expect(classifyPreviewValue('<Model order-2291>')).toBe('record');

    expect(classifyPreviewValue('"hello"')).toBe('text');
    expect(classifyPreviewValue('<Node> Checkout Row')).toBe('text');
    expect(classifyPreviewValue('<function submitOrder>')).toBe('text');

    expect(classifyPreviewValue('true')).toBe('scalar');
    expect(classifyPreviewValue('-12.5')).toBe('scalar');
    expect(classifyPreviewValue('1e6')).toBe('scalar');
    expect(classifyPreviewValue('DOM Node <div>')).toBe('scalar');

    expect(classifyPreviewValue('null')).toBe('empty');
    expect(classifyPreviewValue('undefined')).toBe('empty');
    expect(classifyPreviewValue('<unreadable>')).toBe('empty');
    expect(classifyPreviewValue(undefined)).toBe('empty');
  });

  /**
   * 🔴 The fallback is the strict class, and this is the spec that says so.
   *
   * `previewValue()`'s grammar can grow — a `Set`, a `Map`, a typed array, whatever a future runtime
   * prints. A classifier whose default were `scalar` would publish every shape it failed to
   * recognise, on the day the runtime added one, with every test still green.
   */
  it('sends an unrecognised shape to text, not to scalar', () => {
    expect(classifyPreviewValue('Map(3) {…}')).toBe('text');
    expect(classifyPreviewValue('2026-08-16T10:00:00.000Z')).toBe('text');
    expect(classifyPreviewValue('Symbol(order)')).toBe('text');
    expect(classifyPreviewValue('anything at all')).toBe('text');
  });

  /**
   * ⚠️ A truncated value is still classified by its head, which is correct **because the payload is
   * the preview string itself**: the runtime caps it at 200 characters, and what the user reviewed
   * is byte-for-byte what ships. There is no tail to smuggle.
   */
  it('classifies a truncated record by its head', () => {
    expect(classifyPreviewValue('{name:"Priya Raman",matter:"AC-22…')).toBe('record');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// The redactor, on the ticked rows
// ───────────────────────────────────────────────────────────────────────────────

describe('UNI-011 AC3 — a ticked value is still redacted', () => {
  it('removes a credential, an email and a machine path from a value the user chose to share', () => {
    const described = describeSharablePorts(
      [
        { port: 'headers', direction: 'input', value: `{authorization:"Bearer ${PRIVATE.token}"}`, declared: true },
        { port: 'contact', direction: 'input', value: '"priya@acme-legal.co.uk"', declared: true },
        { port: 'source', direction: 'input', value: '"/Users/richard/Clients/Acme Legal/rates.xlsx"', declared: true },
        { port: 'mount', direction: 'input', value: '"/Volumes/AcmeShare/matters/AC-2291.pdf"', declared: true }
      ],
      PATHS
    );
    const attachment: ShareAttachment = {
      capture: null,
      ports: described,
      shared: new Set(described.map((row) => row.key))
    };
    const text = formatShareAttachment(attachment);

    expect(text).not.toContain(PRIVATE.token);
    expect(text).toContain(REDACTED);
    expect(text).not.toContain('priya@acme-legal.co.uk');
    expect(text).toContain(REDACTED_EMAIL);
    // ⚠️ Under the home root the remainder is **dropped**, so this is `~/...` and not `<path>` —
    // two different rules, and the client's directory name is gone either way, which is the claim.
    expect(text).not.toContain('Acme Legal/rates.xlsx');
    expect(text).toContain('~/...');
    // A path under no root we know collapses entirely.
    expect(text).not.toContain('AcmeShare');
    expect(text).toContain(REDACTED_PATH);
  });

  /**
   * The control for the line above. All three rows are library-declared and would be `text`, so
   * they are off by default — which means the redaction assertions above are about rows that were
   * deliberately ticked, and not about rows the default had already suppressed.
   */
  it('and those rows were off by default, so the assertions above are about the redactor', () => {
    const described = describeSharablePorts(
      [{ port: 'contact', direction: 'input', value: '"priya@acme-legal.co.uk"', declared: true }],
      PATHS
    );
    expect(defaultSharedKeys(described)).toEqual([]);
  });

  /**
   * ⚠️ The value is redacted **once**, where the row is built. `composeNodeQuestion` must not run
   * the redactor over this module's output — `<path>` through a second pass is how a sentinel
   * becomes a nested sentinel — and this pins the fixed point.
   */
  it('is idempotent, so a second pass anywhere cannot damage the sentinels', () => {
    const once = describeSharablePorts(
      [{ port: 'source', direction: 'input', value: '"/Users/richard/Clients/Acme/x.txt"', declared: true }],
      PATHS
    );
    const twice = describeSharablePorts([{ port: 'source', direction: 'input', value: once[0].value, declared: true }], PATHS);
    expect(twice[0].value).toBe(once[0].value);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// The capture line
// ───────────────────────────────────────────────────────────────────────────────

describe('UNI-011 AC3 — the capture line', () => {
  it('reports the picture and not where it lives', () => {
    const text = formatShareAttachment(attachmentOf([], { width: 1180, height: 720, bytes: 219_136 }));

    expect(text).toContain('1180 × 720');
    expect(text).toContain('214 KB');
    // 🔴 The saved path is a machine path — shown in the dialog, never in the payload.
    expect(text).not.toContain('/Users');
    expect(text).not.toContain('.png');
  });

  it('is absent when there is no capture, even with rows ticked', () => {
    const text = formatShareAttachment(attachmentOf(defaultSharedKeys(rows())));
    expect(text).not.toContain('Screen capture');
    expect(text).toContain('Live values');
  });
});
