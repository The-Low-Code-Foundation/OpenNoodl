/**
 * Tests for SeoApi's server-side buffering and reset (RUN-002 slice 1).
 *
 * Server-side (`document` undefined) SeoApi buffers title/meta in memory; the
 * SSR server reads that buffer after render and injects it into <head>. Because
 * Noodl.SEO is a per-process singleton reused across requests, the SSR server
 * calls reset() before each page so state cannot bleed between requests — that
 * is what these tests pin down. testEnvironment is 'node', so `document` is
 * genuinely undefined here (the server condition).
 */
import { SeoApi } from '../src/api/seo';

describe('SeoApi (server-side buffering)', () => {
  it('runs in the server branch: document is undefined', () => {
    expect(typeof document).toBe('undefined');
  });

  it('buffers the title set via setTitle', () => {
    const seo = new SeoApi();
    seo.setTitle('Home');
    expect(seo.title).toBe('Home');
  });

  it('buffers meta set via setMeta', () => {
    const seo = new SeoApi();
    seo.setMeta('description', 'A page');
    seo.setMeta('og:title', 'OG');
    expect(seo.meta).toEqual({ description: 'A page', 'og:title': 'OG' });
    expect(seo.getMeta('description')).toBe('A page');
  });

  it('reset() clears both title and meta', () => {
    const seo = new SeoApi();
    seo.setTitle('Home');
    seo.setMeta('description', 'A page');

    seo.reset();

    expect(seo.title).toBe('');
    expect(seo.meta).toEqual({});
  });

  it('reset() lets a reused instance represent a fresh page (no bleed)', () => {
    // Simulates the SSR singleton serving page A then page B.
    const seo = new SeoApi();

    seo.setTitle('Page A');
    seo.setMeta('description', 'From A');
    expect(seo.title).toBe('Page A');

    // Server resets before rendering page B.
    seo.reset();
    seo.setTitle('Page B');

    expect(seo.title).toBe('Page B');
    // A's description must not survive into B.
    expect(seo.getMeta('description')).toBeUndefined();
  });

  it('clearMeta() clears meta but leaves the title', () => {
    const seo = new SeoApi();
    seo.setTitle('Keep');
    seo.setMeta('description', 'drop');

    seo.clearMeta();

    expect(seo.title).toBe('Keep');
    expect(seo.meta).toEqual({});
  });
});
