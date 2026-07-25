import { scrubHeaders, scrubRequestForLogging, scrubValue } from '../../src/main/src/execution-history/scrub';

describe('scrubHeaders', () => {
  it('redacts known-sensitive header names case-insensitively', () => {
    const out = scrubHeaders({
      Authorization: 'Bearer secret-token',
      COOKIE: 'session=abc',
      'x-api-key': 'k-123',
      'content-type': 'application/json'
    });

    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.COOKIE).toBe('[REDACTED]');
    expect(out['x-api-key']).toBe('[REDACTED]');
    expect(out['content-type']).toBe('application/json');
  });

  it('handles missing headers', () => {
    expect(scrubHeaders(undefined)).toEqual({});
    expect(scrubHeaders(null)).toEqual({});
  });
});

describe('scrubValue', () => {
  it('redacts keys that look like secrets, recursively', () => {
    const out = scrubValue({
      username: 'alice',
      password: 'hunter2',
      nested: { apiKey: 'abc', ok: 1 },
      list: [{ token: 'xyz' }, { fine: true }]
    }) as Record<string, unknown>;

    expect(out.username).toBe('alice');
    expect(out.password).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect(((out.list as Record<string, unknown>[])[0]).token).toBe('[REDACTED]');
    expect(((out.list as Record<string, unknown>[])[1]).fine).toBe(true);
  });

  it('passes primitives through unchanged', () => {
    expect(scrubValue('hello')).toBe('hello');
    expect(scrubValue(42)).toBe(42);
    expect(scrubValue(null)).toBeNull();
    expect(scrubValue(undefined)).toBeUndefined();
  });
});

describe('scrubRequestForLogging', () => {
  it('scrubs headers and body, and reports body size', () => {
    const body = JSON.stringify({ email: 'a@b.com', password: 'secret' });
    const summary = scrubRequestForLogging({
      body,
      headers: { authorization: 'Bearer xyz', 'content-type': 'application/json' }
    });

    expect(summary.headers.authorization).toBe('[REDACTED]');
    expect(summary.headers['content-type']).toBe('application/json');
    expect(summary.bodySize).toBe(body.length);
    expect((summary.body as Record<string, unknown>).email).toBe('a@b.com');
    expect((summary.body as Record<string, unknown>).password).toBe('[REDACTED]');
  });

  it('handles an unparsable body without throwing', () => {
    const summary = scrubRequestForLogging({ body: 'not json', headers: {} });
    expect(summary.body).toBe('[unparsable body]');
    expect(summary.bodySize).toBe('not json'.length);
  });

  it('handles a missing body', () => {
    const summary = scrubRequestForLogging({ headers: {} });
    expect(summary.bodySize).toBe(0);
    expect(summary.body).toBeUndefined();
  });
});
