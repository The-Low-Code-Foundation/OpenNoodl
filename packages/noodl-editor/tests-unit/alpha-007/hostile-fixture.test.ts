/**
 * ALPHA-007 acceptance criterion 4.
 *
 * > Redaction is verified against a hostile fixture, not by intent: a project
 * > containing an API key in a node parameter, a backend endpoint, a component
 * > named after a client, and a path outside the project root produces a report
 * > containing none of them. **This criterion fails if it is argued rather than
 * > demonstrated.**
 *
 * So: build that project, compose a real report from it, and search everything
 * the report can put on a public issue — the URL, every decoded query value,
 * the parsed diagnostics object, and every file written into the bundle.
 *
 * Two disciplines make this a real test rather than a shape that always passes:
 *
 * 1. **Search the decoded, parsed output.** A raw-string scan of a URL misses
 *    a secret that survived percent-encoding (`%2Fsk-ant-…`) and would report
 *    clean. Every value is decoded and, where it is JSON, parsed, before it is
 *    searched.
 * 2. **Assert what survived.** A composer that returned an empty report would
 *    pass every "the secret is absent" assertion. So the same fixture is used to
 *    check the counts, the histogram and the reporter's own words came through.
 */

import { composeReport } from '../../src/editor/src/utils/report/compose';
import { TYPE_COMPONENT, TYPE_UNKNOWN } from '../../src/editor/src/utils/report/diagnostics';
import { ErrorTailEntry } from '../../src/editor/src/utils/report/errorTail';
import { FIELD } from '../../src/editor/src/utils/report/issueForm';

/** Every string that must not appear anywhere in the output. */
const SECRETS = {
  apiKey: 'sk-ant-api03-h0st1leK3yD0N0tPub1ishThisEver00',
  awsKey: 'AKIAIOSFODNN7EXAMPLE',
  endpoint: 'https://acme-legal-internal.example.com/parse',
  endpointHost: 'acme-legal-internal.example.com',
  clientComponent: '/Acme Legal Client Portal',
  clientName: 'Acme Legal',
  outsidePath: '/Volumes/ClientShare/Acme Legal/rates-2026.xlsx',
  outsideFolder: 'ClientShare',
  homePath: '/Users/richard/Clients/Acme Legal/notes.md',
  privateModule: 'com.acmelegal.internal.BillingWidget',
  password: 'hunter2-the-client-db-password',
  reporterEmail: 'partner@acme-legal.co.uk'
};

const HOME = '/Users/richard';
const PROJECT_DIR = '/Users/richard/Projects/Acme Legal Portal';
const APP_DIR = '/Applications/NodeGX.app/Contents/Resources/app';

/**
 * A project shaped like the real `ProjectModel` in the ways that matter:
 * components with names, a node tree with parameters, connections, and cloud
 * services metadata carrying an endpoint.
 */
function hostileProject() {
  const node = (typename: string, parameters: Record<string, unknown> = {}, children: unknown[] = []) => ({
    typename,
    parameters,
    children
  });

  return {
    name: SECRETS.clientName + ' Portal',
    getComponents: () => [
      {
        name: SECRETS.clientComponent,
        graph: {
          roots: [
            node('Group', { backgroundColor: '#fff' }, [
              node('Text', { text: `Welcome, ${SECRETS.clientName}` }),
              // The API key in a node parameter — the headline of criterion 4.
              node('REST', { resource: SECRETS.endpoint, apiKey: SECRETS.apiKey }),
              node('net.noodl.controls.textinput', { placeholder: SECRETS.password }),
              // A node type from the user's own private module.
              node(SECRETS.privateModule, { licence: SECRETS.awsKey }),
              // A component instance: its *type name* is a component path.
              node(SECRETS.clientComponent + '/Invoice Row', {})
            ])
          ],
          connections: [{ fromId: 'a', fromProperty: 'x', toId: 'b', toProperty: 'y' }]
        }
      },
      {
        name: '/Acme Legal Client Portal/Invoice Row',
        graph: {
          roots: [node('Text', { text: SECRETS.outsidePath })],
          connections: []
        }
      }
    ],
    getMetaData: (key: string) =>
      key === 'cloudservices'
        ? { instanceId: 'abc', endpoint: SECRETS.endpoint, appId: 'acme-legal-prod', type: 'parse' }
        : null
  };
}

/** The log tail a hostile session would produce. */
function hostileErrors(now: number): ErrorTailEntry[] {
  return [
    { at: now - 4000, level: 'error', text: `Failed to fetch ${SECRETS.endpoint}/classes/Matter?key=${SECRETS.apiKey}` },
    { at: now - 3000, level: 'error', text: `ENOENT: no such file, open '${SECRETS.outsidePath}'` },
    { at: now - 2500, level: 'warn', text: `could not read ${SECRETS.homePath}` },
    { at: now - 2000, level: 'error', text: `at render (${PROJECT_DIR}/components/Acme Legal Client Portal.json:8:1)` },
    { at: now - 1500, level: 'error', text: `sign-in rejected for ${SECRETS.reporterEmail}` },
    { at: now - 1000, level: 'error', text: `{"masterKey":"${SECRETS.password}","appId":"acme-legal-prod"}` },
    { at: now - 500, level: 'error', text: `Uncaught TypeError at (${APP_DIR}/src/editor/index.js:44:9)` }
  ];
}

const NOW = Date.parse('2026-08-03T12:00:00.000Z');

function compose() {
  return composeReport({
    reportId: 'r-20260803-120000-abcd',
    capturedAt: new Date(NOW).toISOString(),
    user: {
      whatHappened: 'The preview kept showing the old text after I edited the Text node.',
      surface: 'Preview (the live app inside the editor)',
      severity: 'serious',
      freshProject: 'No — only my existing project',
      steps: '1. Open the project\n2. Edit a Text node\n3. Look at the preview'
    },
    app: { version: '0.1.0', buildNumber: '12', packaged: true },
    os: { platform: 'darwin', arch: 'arm64', release: '25.5.0' },
    editor: { route: 'editor', document: 'component' },
    project: hostileProject(),
    projectFormat: 'v2',
    // The library resolved the stock types; the user's private module is not
    // among them, which is what forces it into the `<unknown>` bucket.
    knownTypes: new Set(['Group', 'Text', 'REST', 'net.noodl.controls.textinput']),
    ai: { configured: true, provider: 'anthropic' },
    errors: hostileErrors(NOW),
    paths: { homeDir: HOME, projectDir: PROJECT_DIR, appDir: APP_DIR },
    now: NOW
  });
}

/**
 * Everything the report can publish, decoded and parsed — not the raw URL.
 *
 * A percent-encoded secret is still a leak the moment a browser decodes it, and
 * searching the encoded string would miss it entirely. Where a value is JSON it
 * is parsed and re-serialised, so a search cannot be fooled by escaping either.
 */
function publishedStrings(report: ReturnType<typeof compose>): string[] {
  const url = new URL(report.url);
  const out: string[] = [url.pathname];

  url.searchParams.forEach((value, key) => {
    out.push(key);
    out.push(value);
    if (key === FIELD.diagnostics) {
      // Parses, or the fence is broken and Part B cannot read it.
      out.push(JSON.stringify(JSON.parse(value)));
    }
  });

  for (const name of Object.keys(report.bundle)) {
    out.push(name);
    out.push(report.bundle[name]);
  }

  out.push(JSON.stringify(report.diagnostics));
  return out;
}

describe('a hostile project produces a publishable report', () => {
  const report = compose();
  const published = publishedStrings(report);
  const haystack = published.join('\n');

  it.each(Object.entries(SECRETS))('does not publish the %s', (_name, secret) => {
    expect(haystack).not.toContain(secret);
  });

  it('does not publish the project directory or the user name in it', () => {
    expect(haystack).not.toContain(PROJECT_DIR);
    expect(haystack).not.toContain('Acme');
    expect(haystack).not.toContain('richard');
  });

  it('does not publish any node parameter value', () => {
    // Nothing in the fixture's parameters is named anywhere, at all.
    for (const value of ['#fff', 'Welcome,', 'acme-legal-prod', 'rates-2026']) {
      expect(haystack).not.toContain(value);
    }
  });

  it('does not publish a component name', () => {
    expect(haystack).not.toContain('Invoice Row');
    expect(haystack).not.toContain('Client Portal');
  });
});

describe('…and the report is still worth reading', () => {
  // The other half of criterion 4: an empty report passes every assertion
  // above. These are what stop this suite from greening on a broken composer.
  const report = compose();
  const diagnostics = report.diagnostics;

  it('carries the reporter’s own words unaltered', () => {
    expect(report.fields[FIELD.whatHappened]).toBe(
      'The preview kept showing the old text after I edited the Text node.'
    );
    expect(report.fields[FIELD.steps]).toContain('Edit a Text node');
  });

  it('carries the shape of the project', () => {
    expect(diagnostics.project).toMatchObject({
      open: true,
      format: 'v2',
      components: 2,
      nodes: 7,
      connections: 1,
      backendConfigured: true,
      backendType: 'parse'
    });
  });

  it('buckets a component instance and a private module, and names the stock types', () => {
    const types = diagnostics.project?.nodeTypes as Record<string, number>;
    expect(types.Text).toBe(2);
    expect(types.Group).toBe(1);
    expect(types.REST).toBe(1);
    expect(types[TYPE_COMPONENT]).toBe(1);
    expect(types[TYPE_UNKNOWN]).toBe(1);
    // The bucket names are constants, not the user's strings.
    expect(Object.keys(types).join(' ')).not.toContain('acmelegal');
  });

  it('says a backend is configured without saying which one it is', () => {
    expect(diagnostics.project?.backendConfigured).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain(SECRETS.endpointHost);
  });

  it('keeps the error tail useful: the app frame, the status, the shape', () => {
    const errors = report.fields[FIELD.errors] as string;
    expect(errors).toContain('Uncaught TypeError');
    expect(errors).toContain('<app>/src/editor/index.js:44:9');
    expect(errors).toContain('ENOENT');
    expect(errors).toContain('<project>/...');
    expect(errors).toContain('[redacted-email]');
    expect(diagnostics.errorCount).toBe(7);
  });

  it('records the severity as a slug Part B can label from', () => {
    expect(diagnostics.severity).toBe('serious');
    expect(report.fields[FIELD.severity]).toBe('Serious — there is a workaround, but it costs me');
  });

  it('writes both bundle files', () => {
    expect(Object.keys(report.bundle).sort()).toEqual(['diagnostics.json', 'report.md']);
    expect(JSON.parse(report.bundle['diagnostics.json']).schema).toBe(1);
    expect(report.bundle['report.md']).toContain('# NodeGX problem report r-20260803-120000-abcd');
  });
});
