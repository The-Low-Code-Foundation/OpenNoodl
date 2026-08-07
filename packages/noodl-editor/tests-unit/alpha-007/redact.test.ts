/**
 * ALPHA-007 §3 — the redactor.
 *
 * Every test here asserts **two** things: that the secret is gone, and that
 * something harmless beside it survived.
 *
 * That is not padding. `redact = () => ''` passes any suite built only from
 * `not.toContain(secret)`, and so does any rule broad enough to be useless. A
 * redactor is only interesting at its boundary, so the boundary is what gets
 * asserted — the same reason a markup test asserts the parsed tag rather than
 * searching the string for angle brackets.
 */

import {
  REDACTED,
  REDACTED_EMAIL,
  REDACTED_PATH,
  REDACTED_URL,
  redact,
  redactCredentials,
  redactPaths
} from '../../src/editor/src/utils/report/redact';

describe('credential shapes', () => {
  const cases: [string, string][] = [
    ['anthropic', 'sk-ant-api03-AbCdEfGh1234567890IjKlMnOpQrStUvWxYz'],
    ['openai', 'sk-proj-0123456789abcdefghijklmnop'],
    ['github pat', 'ghp_1234567890abcdefghijklmnopqrstuvwx'],
    ['github fine-grained', 'github_pat_11ABCDEFG0abcdefghijklmnop'],
    ['google', 'AIzaSyA1234567890abcdefghijklmnopqrstuvw'],
    ['aws access key id', 'AKIAIOSFODNN7EXAMPLE'],
    ['slack', 'xoxb-123456789012-abcdefghijklmnop'],
    ['stripe', 'sk_live_0123456789abcdefghijkl'],
    ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r']
  ];

  it.each(cases)('removes a %s key but keeps the sentence around it', (_name, secret) => {
    const out = redactCredentials(`Request failed with ${secret} while saving`);
    expect(out).not.toContain(secret);
    expect(out).toContain(REDACTED);
    expect(out).toContain('Request failed with');
    expect(out).toContain('while saving');
  });

  it('keeps the scheme of an Authorization header', () => {
    const out = redactCredentials('Authorization: Bearer abcdef0123456789abcdef');
    expect(out).not.toContain('abcdef0123456789');
    expect(out).toBe(`Authorization: Bearer ${REDACTED}`);
  });

  it('keeps the name of a credential-bearing query parameter', () => {
    const out = redactCredentials('GET /1/classes/Notes?key=s3cr3tvalue&limit=10');
    expect(out).not.toContain('s3cr3tvalue');
    expect(out).toContain('key=' + REDACTED);
    // The non-credential parameter is what tells a maintainer what was called.
    expect(out).toContain('limit=10');
  });

  it('does not treat `monkey=` as a key', () => {
    expect(redactCredentials('?monkeys=3')).toBe('?monkeys=3');
  });

  it('redacts a keyed assignment in JSON without eating its neighbours', () => {
    const out = redactCredentials('{"status":404,"masterKey":"hunter2hunter2","limit":25}');
    expect(out).not.toContain('hunter2hunter2');
    expect(out).toContain('"status":404');
    expect(out).toContain('"limit":25');
  });

  it('also redacts an application id, which names someone else’s backend', () => {
    const out = redactCredentials('{"appId":"acme-legal-prod","limit":25}');
    expect(out).not.toContain('acme-legal-prod');
    expect(out).toContain('"limit":25');
  });

  it('leaves ordinary prose completely alone', () => {
    const prose = 'The Text node did not update after I typed into it, twice, in a row.';
    expect(redactCredentials(prose)).toBe(prose);
    expect(redact(prose)).toBe(prose);
  });
});

describe('paths', () => {
  const paths = {
    homeDir: '/Users/richard',
    projectDir: '/Users/richard/Projects/AcmeStore',
    appDir: '/Applications/NodeGX.app/Contents/Resources/app'
  };

  it('keeps app paths, because that is the part of a stack trace anyone reads', () => {
    const out = redactPaths(`at loadProject (${paths.appDir}/src/editor/index.js:12:3)`, paths);
    expect(out).toContain('<app>/src/editor/index.js:12:3');
    expect(out).not.toContain('/Applications/NodeGX.app');
    expect(out).toContain('at loadProject');
  });

  it('drops the remainder of a project path — in v2 the path is the component name', () => {
    const out = redactPaths(`ENOENT: ${paths.projectDir}/components/Client Dashboard.json`, paths);
    expect(out).toContain('<project>/...');
    expect(out).not.toContain('Client Dashboard');
    expect(out).not.toContain('AcmeStore');
    expect(out).toContain('ENOENT:');
  });

  it('drops the remainder of a home path, so a client folder name cannot ride along', () => {
    const out = redactPaths("reading '/Users/richard/Clients/Acme/rates.xlsx' failed", paths);
    expect(out).toContain('~/...');
    expect(out).not.toContain('Acme');
    expect(out).toContain('reading');
    expect(out).toContain('failed');
  });

  it('swallows a trailing unpunctuated word rather than leave half a path behind', () => {
    // The documented cost of matching greedily across spaces under a known
    // root. Without it, `~/Clients/Acme Legal/notes.md` matches only as far as
    // `Acme` and leaves ` Legal` in the text — a leak reassembled from the very
    // characters we were redacting. Losing a word of prose is the better half
    // of that trade, and this test exists so nobody "fixes" it by accident.
    expect(redactPaths('reading /Users/richard/Clients/Acme/rates.xlsx failed', paths)).toBe('reading ~/...');
    expect(redactPaths('reading /Users/richard/Clients/Acme Legal/notes.md', paths)).toBe('reading ~/...');
  });

  it('does not let one home directory claim a longer sibling', () => {
    // `/Users/richard` is a prefix of `/Users/richardosborne`. Without the
    // separator check this becomes `~osborne/...`, which is both wrong and a
    // leak of the real user name.
    const out = redactPaths('/Users/richardosborne/Desktop/notes.txt', paths);
    expect(out).toBe(REDACTED_PATH);
    expect(out).not.toContain('osborne');
  });

  it('collapses a path under no known root', () => {
    const out = redactPaths('opened /Volumes/ClientShare/Acme/brief.pdf', { homeDir: '/Users/richard' });
    expect(out).toBe(`opened ${REDACTED_PATH}`);
  });

  it('collapses a Windows path', () => {
    const out = redactPaths('cannot write C:\\Users\\Sam\\Clients\\Acme\\x.json', {});
    expect(out).not.toContain('Acme');
    expect(out).toBe(`cannot write ${REDACTED_PATH}`);
  });

  it('keeps a bare home directory as ~', () => {
    expect(redactPaths('cwd is /Users/richard', paths)).toBe('cwd is ~');
  });
});

describe('urls', () => {
  it('removes a third-party endpoint entirely', () => {
    const out = redactPaths('POST https://acme-internal.example.com/parse/classes/Orders failed', {});
    expect(out).not.toContain('acme-internal');
    expect(out).not.toContain('example.com');
    expect(out).toBe(`POST ${REDACTED_URL} failed`);
  });

  it('keeps a host we already name in the privacy policy, but not its path', () => {
    const out = redactPaths('GET https://api.anthropic.com/v1/messages/msg_0123 failed', {});
    expect(out).toContain('https://api.anthropic.com/...');
    expect(out).not.toContain('msg_0123');
    expect(out).toContain('failed');
  });

  it('keeps a localhost backend, port and all', () => {
    expect(redactPaths('http://localhost:8577/health', {})).toBe('http://localhost:8577/...');
  });

  it('strips credentials embedded in a URL before the host rule sees it', () => {
    const out = redact('https://api.example.com/v1?token=abc123def456ghi', {});
    expect(out).not.toContain('abc123def456ghi');
    expect(out).toBe(REDACTED_URL);
  });
});

describe('email addresses', () => {
  it('removes the address and keeps the message', () => {
    const out = redact('sign-in failed for someone@acme-legal.co.uk (401)');
    expect(out).not.toContain('acme-legal');
    expect(out).toContain(REDACTED_EMAIL);
    expect(out).toContain('sign-in failed for');
    expect(out).toContain('(401)');
  });
});

describe('the whole treatment', () => {
  it('is idempotent — running it twice changes nothing', () => {
    const paths = { homeDir: '/Users/richard', projectDir: '/Users/richard/Projects/Acme' };
    const input = 'sk-ant-api03-AbCdEfGh1234567890IjKl at /Users/richard/Projects/Acme/x.json';
    const once = redact(input, paths);
    expect(redact(once, paths)).toBe(once);
  });

  it('returns an empty string for empty input rather than throwing', () => {
    expect(redact('')).toBe('');
    expect(redact(undefined as unknown as string)).toBe('');
  });
});
