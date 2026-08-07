/**
 * ALPHA-003 §1 — the log format, against a hostile session.
 *
 * Acceptance criterion 5 says the log must contain "no project content, no
 * credentials, and no absolute path above the project root", verified by
 * inspection rather than by reasoning about the writer. The writer itself needs
 * a real `userData` directory and a real renderer, so the demonstrable half is
 * `debugLog.ts`: everything that reaches the file goes through `formatEntry`,
 * and these are the strings a real session actually produces.
 */

import {
  MAX_DATA_CHARS,
  MAX_MESSAGE_CHARS,
  formatEntry,
  logFileHeader,
  logFileName,
  stringifyData
} from '../../src/editor/src/utils/debugLog';

const AT = new Date('2026-08-06T12:34:56.789Z');

const PATHS = {
  homeDir: '/Users/rich',
  appDir: '/Applications/NodeGX.app/Contents/Resources/app'
};

function line(level: 'error' | 'warn' | 'info', message: string, data?: unknown) {
  return formatEntry({ level, message, data, at: AT, paths: PATHS });
}

describe('formatEntry', () => {
  it('stamps every entry, which the old file never did', () => {
    expect(line('error', 'boom')).toBe('2026-08-06T12:34:56.789Z  ERROR  boom\n');
  });

  it('pads the level so entries align without a parser', () => {
    expect(line('warn', 'x')).toContain('  WARN   x');
    expect(line('info', 'x')).toContain('  INFO   x');
  });

  it('always ends in exactly one newline', () => {
    expect(line('info', 'a')).toMatch(/[^\n]\n$/);
    expect(line('info', 'a', { b: 1 })).toMatch(/[^\n]\n$/);
  });

  it('keeps a new entry at column zero so a truncated tail is still parseable', () => {
    const rendered = line('error', 'Failed\n    at foo (x.js:1:1)', { dir: '/tmp/x' });
    const continuations = rendered.split('\n').slice(1).filter(Boolean);
    for (const cont of continuations) expect(cont.startsWith(' ')).toBe(true);
  });
});

describe('what must never reach the file', () => {
  it('redacts an API key logged by a failing provider call', () => {
    const rendered = line('error', 'POST failed', {
      apiKey: 'sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijk'
    });
    expect(rendered).not.toContain('sk-ant-api03');
    expect(rendered).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(rendered).toContain('[redacted]');
  });

  it('destroys the project path in the one call site that logs a directory listing', () => {
    // projectmodel.editor.ts: bugtracker.track('…readJSONFromDirectory failed',
    // { dir: projectdir, dirContent: FileSystem.instance.readDirectorySync(...) })
    const rendered = line('error', 'ProjectModel.fromDirectory readJSONFromDirectory failed', {
      dir: '/Users/rich/Clients/Acme Legal/Portal',
      dirContent: ['project.json', 'components/Acme Login.json']
    });
    expect(rendered).not.toContain('Acme');
    expect(rendered).not.toContain('/Users/rich');
  });

  it('keeps our own stack frames, which are the ones worth reading', () => {
    const rendered = line(
      'error',
      'TypeError: x is not a function\n    at f (/Applications/NodeGX.app/Contents/Resources/app/index.bundle.js:12:3)'
    );
    expect(rendered).toContain('<app>/index.bundle.js:12:3');
  });

  it('collapses a URL to an unknown host but keeps a host we ship against', () => {
    expect(line('warn', 'fetch https://acme-internal.example.com/api/v1/things?token=abc')).toContain('<url>');
    expect(line('warn', 'fetch https://api.github.com/repos/x/y')).toContain('https://api.github.com/...');
  });

  it('redacts an email address', () => {
    expect(line('error', 'login failed for rich@digitalbricks.io')).toContain('[redacted-email]');
  });

  it('redacts before clamping, so a cut cannot leave the front of a secret behind', () => {
    const secret = 'sk-' + 'B'.repeat(64);
    const rendered = line('error', 'x'.repeat(MAX_MESSAGE_CHARS - 10) + ' ' + secret);
    expect(rendered).not.toContain('sk-BBBB');
  });
});

describe('bounds', () => {
  it('clamps the message an order of magnitude below the old 10,000', () => {
    const rendered = line('error', 'y'.repeat(MAX_MESSAGE_CHARS * 3));
    expect(rendered.length).toBeLessThan(MAX_MESSAGE_CHARS + 200);
    expect(rendered).toContain('chars]');
  });

  it('clamps attached data harder than the message', () => {
    expect(MAX_DATA_CHARS).toBeLessThan(MAX_MESSAGE_CHARS);
    const rendered = line('error', 'boom', { blob: 'z'.repeat(MAX_DATA_CHARS * 5) });
    expect(rendered.length).toBeLessThan(MAX_MESSAGE_CHARS + MAX_DATA_CHARS + 200);
  });

  it('serialises attached data onto one line rather than pretty-printing it', () => {
    expect(stringifyData({ a: 1, b: { c: 2 } })).toBe('{"a":1,"b":{"c":2}}');
    expect(stringifyData({ a: 1 })).not.toContain('\n');
  });

  it('survives a circular object rather than throwing inside the logger', () => {
    const circular: Record<string, unknown> = { name: 'x' };
    circular.self = circular;
    expect(() => stringifyData(circular)).not.toThrow();
    expect(() => line('error', 'boom', circular)).not.toThrow();
  });

  it('renders nothing for absent data', () => {
    expect(stringifyData(undefined)).toBe('');
    expect(stringifyData(null)).toBe('');
    expect(line('info', 'step')).toBe(line('info', 'step', undefined));
  });
});

describe('the file itself', () => {
  it('names files so that lexical order is chronological order', () => {
    const names = [
      logFileName(new Date('2026-08-06T09:00:00Z')),
      logFileName(new Date('2026-01-02T23:00:00Z')),
      logFileName(new Date('2026-08-06T10:00:00Z'))
    ];
    expect([...names].sort()).toEqual([names[1], names[0], names[2]]);
  });

  it('produces a name with no character that needs quoting in a shell or a path', () => {
    expect(logFileName(AT)).toBe('log-2026-08-06T12-34-56Z.txt');
  });

  it('opens the file by saying what it is and that it stays on the machine', () => {
    const header = logFileHeader('0.1.0', AT);
    expect(header).toContain('0.1.0');
    expect(header).toContain('PRIVACY.md');
    expect(header.toLowerCase()).toContain('redacted');
    for (const l of header.split('\n')) expect(l === '' || l.startsWith('#')).toBe(true);
  });
});
