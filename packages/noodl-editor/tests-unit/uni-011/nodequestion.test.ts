/**
 * UNI-011 AC2 — the composed question.
 *
 * > the composer opens prefilled with type, warning, version and OS; the graph excerpt is **off
 * > until enabled**, and what it will send is **shown before it sends**.
 *
 * Four claims, and they fail in different directions, so each is graded separately:
 *
 * 1. The prefill is **complete** — a question missing the version is a question that costs a
 *    round trip, which is the whole thing this feature exists to remove.
 * 2. The excerpt is **absent unless asked for**, and the default lives in the composer rather
 *    than in a component's state.
 * 3. The free text is **redacted** — a warning is our sentence with the user's content
 *    interpolated into it, and the title especially, because a title is the field that reaches
 *    search results and notification mail where nobody re-reads it.
 * 4. Nothing else gets in. Graded with the same closed sweep the excerpt spec uses, over a
 *    fixture whose every field is a distinct marker.
 */

import { LibraryPorts, buildGraphExcerpt } from '../../src/editor/src/models/community/nodeexcerpt';
import { MAX_WARNING_CHARS, composeNodeQuestion } from '../../src/editor/src/models/community/nodequestion';
import { describeSharablePorts, portShareKey } from '../../src/editor/src/models/community/portshare';

const LIBRARY: LibraryPorts = new Map<string, ReadonlySet<string>>([
  ['REST', new Set(['fetch', 'success', 'resource'])],
  ['Object', new Set(['stored'])]
]);

const ENVIRONMENT = { appVersion: '0.1.7', packaged: true, platform: 'darwin', arch: 'arm64', release: '24.5.0' };

/** Strings from the project or the machine. None may reach a public forum. */
const PRIVATE = {
  component: '/Acme Legal Client Portal',
  clientPath: '/Users/richard/Clients/Acme Legal/rates-2026.xlsx',
  apiKey: 'sk-ant-api03-h0st1leK3yD0N0tPub1ishThisEver00',
  email: 'partner@acme-legal.co.uk',
  port: 'clientMatterRef'
};

const PATHS = { homeDir: '/Users/richard', projectDir: '/Users/richard/Projects/Acme Legal Portal' };

function excerpt() {
  return buildGraphExcerpt(
    'focus',
    [
      { id: 'focus', typename: 'REST' },
      { id: 'cmp', typename: PRIVATE.component }
    ],
    [{ fromId: 'focus', fromProperty: 'success', toId: 'cmp', toProperty: PRIVATE.port }],
    { library: LIBRARY }
  );
}

describe('UNI-011 AC2 — the prefill carries what AC2 names', () => {
  const question = composeNodeQuestion({
    focus: { typename: 'REST' },
    library: LIBRARY,
    warning: 'The resource could not be reached.',
    environment: ENVIRONMENT,
    question: 'Why does this keep failing on the second call?'
  });

  it('names the node type', () => expect(question.body).toContain('`REST`'));
  it('quotes the warning', () => expect(question.body).toContain('The resource could not be reached.'));
  it('states the NodeGX version', () => expect(question.body).toContain('0.1.7'));
  it('states the OS, arch and release', () => expect(question.body).toContain('darwin arm64 (24.5.0)'));
  it("leads with the user's own words", () =>
    expect(question.body.startsWith('Why does this keep failing on the second call?')).toBe(true));

  it('marks a source build as one, because a question from dev means something different', () => {
    const fromSource = composeNodeQuestion({
      focus: { typename: 'REST' },
      library: LIBRARY,
      environment: { ...ENVIRONMENT, packaged: false }
    });
    expect(fromSource.body).toContain('0.1.7 (from source)');
  });

  it('titles the thread from the warning, prefixed with the node type', () => {
    expect(question.title).toBe('REST node: The resource could not be reached.');
  });

  it('falls back to a title that is still about the node when there is no warning', () => {
    const untroubled = composeNodeQuestion({ focus: { typename: 'REST' }, library: LIBRARY, environment: ENVIRONMENT });
    expect(untroubled.title).toBe('Help with a REST node');
  });
});

describe('UNI-011 AC2 — the graph excerpt is off until enabled', () => {
  const base = { focus: { typename: 'REST' }, library: LIBRARY, environment: ENVIRONMENT, excerpt: excerpt() };

  it('is absent when nothing was said about it', () => {
    const question = composeNodeQuestion(base);
    expect(question.includesExcerpt).toBe(false);
    expect(question.body).not.toContain('Graph excerpt');
  });

  it('is absent when it was explicitly declined', () => {
    expect(composeNodeQuestion({ ...base, includeExcerpt: false }).includesExcerpt).toBe(false);
  });

  /**
   * 🔴 The known-firing half. Without it, every assertion above is equally satisfied by a
   * composer that cannot include an excerpt at all — and a switch that is always off is
   * indistinguishable from a switch that does nothing.
   */
  it('APPEARS when it is enabled — so the two assertions above mean something', () => {
    const question = composeNodeQuestion({ ...base, includeExcerpt: true });
    expect(question.includesExcerpt).toBe(true);
    expect(question.body).toContain('Graph excerpt');
    expect(question.body).toContain('n1: REST');
  });

  it('reports false when it was enabled but there was nothing to include', () => {
    const question = composeNodeQuestion({ ...base, excerpt: null, includeExcerpt: true });
    expect(question.includesExcerpt).toBe(false);
    expect(question.body).not.toContain('Graph excerpt');
  });

  /**
   * "What it will send is shown before it sends" is only checkable if there is one artefact. The
   * flag and the body are produced together, so a caller that renders `body` and posts `body`
   * cannot show one thing and send another — and this is the assertion that would fail if a
   * later edit gave the preview its own formatter.
   */
  it('the flag and the body agree, because there is one of each', () => {
    for (const includeExcerpt of [true, false]) {
      const question = composeNodeQuestion({ ...base, includeExcerpt });
      expect(question.body.includes('Graph excerpt')).toBe(question.includesExcerpt);
    }
  });
});

describe('UNI-011 AC2 — nothing private reaches the body', () => {
  const question = composeNodeQuestion({
    focus: { typename: PRIVATE.component },
    library: LIBRARY,
    warning: `Failed to load ${PRIVATE.clientPath} using key ${PRIVATE.apiKey} for ${PRIVATE.email}`,
    environment: ENVIRONMENT,
    excerpt: excerpt(),
    includeExcerpt: true,
    question: 'This has stopped working since I upgraded.',
    paths: PATHS
  });

  it('carries no project or machine string, in the body or the title', () => {
    const published = `${question.title}\n${question.body}`;
    for (const [name, value] of Object.entries(PRIVATE)) {
      expect(published.includes(value) ? `${name} LEAKED` : name).toBe(name);
    }
  });

  /** Assert what survived: a composer returning `''` passes every absence check above. */
  it('and still composed a real question', () => {
    expect(question.body).toContain('This has stopped working since I upgraded.');
    expect(question.body).toContain('0.1.7');
    expect(question.body).toContain('Graph excerpt');
    expect(question.nodeType).toBe('<component>');
  });

  it('describes an unpublishable node type in prose rather than leaving a gap', () => {
    expect(question.body).toContain('a component from my own project');
    expect(question.title.startsWith('this node: ')).toBe(true);
  });

  /**
   * The title goes through the redactor, not merely the body.
   *
   * ⚠️ Asserted as a property rather than pinned to an exact string, and the reason is worth
   * recording: the real output here is `this node: Failed to load ~/...] for [redacted-email]`.
   * ALPHA-007's home-path rule is greedy across spaces and swallowed ` using key [redacted` along
   * with the path — its own header calls that trade explicitly (*"a trailing unpunctuated word …
   * is swallowed with the path. Losing a word of prose is the right side of that trade"*), and it
   * errs towards **over**-redaction, so it is untidy rather than unsafe. Pinning the exact string
   * would make this spec a test of `redact.ts`, which has its own, and would fail on any future
   * tightening of a rule that is allowed to change.
   */
  it('redacts the title, which is the field nobody re-reads', () => {
    expect(question.title).toContain('[redacted-email]');
    expect(question.title).not.toContain(PRIVATE.email);
  });

  /**
   * 🔴 The ordering trap, pinned. `WarningsModel` joins messages with `<br>`, so markup has to be
   * stripped — but the redactor *emits* `<path>` and `<url>`, so stripping afterwards would
   * delete the markers that say a secret was removed, leaving a sentence that reads as though
   * nothing was there. Both halves are asserted, because either one alone passes with the passes
   * in the wrong order.
   */
  it('strips markup BEFORE redacting, so the redactor’s own markers survive', () => {
    const mixed = composeNodeQuestion({
      focus: { typename: 'REST' },
      library: LIBRARY,
      warning: `<b>Broken</b><br>could not open ${PRIVATE.clientPath}`,
      environment: ENVIRONMENT,
      paths: PATHS
    });

    expect(mixed.body).not.toContain('<b>');
    expect(mixed.body).not.toContain(PRIVATE.clientPath);
    // The marker is still there, which is what a reader needs in order to ask about it.
    expect(mixed.body).toContain('~/...');
    expect(mixed.body).toContain('Broken');
  });

  it('caps a warning that is really a log', () => {
    const flood = composeNodeQuestion({
      focus: { typename: 'REST' },
      library: LIBRARY,
      warning: 'x'.repeat(MAX_WARNING_CHARS * 3),
      environment: ENVIRONMENT
    });
    expect(flood.body).toContain('…');
    expect(flood.body.length).toBeLessThan(MAX_WARNING_CHARS + 400);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// UNI-011 AC3 — the attachment reaches the same one string
// ───────────────────────────────────────────────────────────────────────────────

/**
 * AC3's payload is an attachment to AC2's post, so it must arrive through the same composition —
 * or AC2's guarantee that *"what it will send is shown before it sends"* holds for part of the
 * body only. `portshare.test.ts` grades the disclosure rule; these grade the join.
 */
describe('UNI-011 AC3 — the attachment is part of the question, not beside it', () => {
  /**
   * 🔴 **Deliberately a string the redactor does not touch**, and the control run is what forced
   * it. This marker was `PRIVATE.component` — `/Acme Legal Client Portal` — which is path-shaped,
   * so `redact` rewrites it to `<path>` on its own. The "an unticked row is published nowhere"
   * spec below therefore **passed with the consent set ignored entirely**: it was asserting the
   * redactor's work and reading it as the toggle's.
   *
   * *A spec whose absence is already guaranteed by a different mechanism cannot detect the removal
   * of the mechanism it names* — the shape UNI-010's slices 4 and 5 each found in their own
   * controls. No slash, no scheme, no credential: the only thing keeping this out of the body is
   * the tick.
   */
  const UNTICKED_MARKER = 'Acme Legal quarterly retainer';

  const ROWS = describeSharablePorts(
    [
      { port: 'visible', direction: 'input', value: 'true', declared: true },
      { port: 'text', direction: 'input', value: `"${UNTICKED_MARKER}"`, declared: true }
    ],
    PATHS
  );

  function withAttachment(shared: string[], capture: { width: number; height: number; bytes: number } | null = null) {
    return composeNodeQuestion({
      focus: { typename: 'REST' },
      library: LIBRARY,
      environment: ENVIRONMENT,
      attachment: { capture, ports: ROWS, shared: new Set(shared) },
      paths: PATHS
    });
  }

  it('adds nothing to the body when no row is ticked and there is no capture', () => {
    const bare = composeNodeQuestion({ focus: { typename: 'REST' }, library: LIBRARY, environment: ENVIRONMENT });
    const empty = withAttachment([]);

    expect(empty.body).toBe(bare.body);
    expect(empty.attached).toEqual({ capture: false, ports: 0 });
  });

  it('reports what it attached rather than leaving a caller to infer it', () => {
    const one = withAttachment([portShareKey('visible', 'input')], { width: 800, height: 600, bytes: 40_960 });

    expect(one.attached).toEqual({ capture: true, ports: 1 });
    expect(one.body).toContain('visible (input) = true');
    expect(one.body).toContain('800 × 600');
  });

  /**
   * 🔴 The default is `false` for the excerpt and the *empty set* for the attachment, and neither
   * is established by the dialog. An attachment that arrived with a row ticked publishes it; one
   * that arrived with none publishes nothing. There is no second switch that could disagree.
   */
  it('publishes an unticked row nowhere, even though the row is in the attachment', () => {
    const one = withAttachment([portShareKey('visible', 'input')]);

    expect(one.body).not.toContain(UNTICKED_MARKER);
    expect(one.body).toContain('visible');
  });

  /**
   * ⚠️ The values are redacted once, in `describeSharablePorts`. If the composer ran the redactor
   * again over its own output, `~/...` would be re-scanned and the sentinel damaged — the same
   * class of ordering mistake the markup strip above pins, in the other direction.
   */
  it('does not re-redact a value that is already redacted', () => {
    const pathRows = describeSharablePorts(
      [{ port: 'src', direction: 'input', value: `"${PRIVATE.clientPath}"`, declared: true }],
      PATHS
    );
    const question = composeNodeQuestion({
      focus: { typename: 'REST' },
      library: LIBRARY,
      environment: ENVIRONMENT,
      attachment: { capture: null, ports: pathRows, shared: new Set([pathRows[0].key]) },
      paths: PATHS
    });

    expect(question.body).toContain(pathRows[0].value);
    expect(question.body).not.toContain(PRIVATE.clientPath);
  });
});
