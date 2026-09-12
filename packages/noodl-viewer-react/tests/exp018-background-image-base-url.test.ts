/**
 * EXP-018 — a project-relative background picture survives a deploy served from a sub-path.
 *
 * Measured 2026-09-11 on the live `nodegx.io/templates/business-landing-page/`, deployed with
 * `nodegx deploy --base-url /templates/business-landing-page/`:
 *
 * | channel | stored value | resolved to | result |
 * |---|---|---|---|
 * | `<img src>` (Image node) | `noodl_modules/…/work-machine-shop.webp` | `…/templates/business-landing-page/noodl_modules/…` | loaded |
 * | this port (`backgroundImage`) | the same string | `https://nodegx.io/noodl_modules/…` | **404, hero blank** |
 *
 * 🔴 **The cause is two different names for the base URL, and only one of them is ever set.**
 * A deploy publishes its base as `Noodl.Env['BaseUrl']`. `Image.tsx`, `Video.tsx`, `fontloader.ts`
 * and `router.tsx` each read that name and apply it by hand. This port went through
 * `resolveMediaSource` → `noodl-runtime`'s `getAbsoluteUrl`, which reads `Noodl.baseUrl` — a
 * lowercase sibling that nothing in the deploy writes, so it fell back to `'/'` and produced a
 * domain-root URL. `getAbsoluteUrl`'s own comment says so: `//this just assumes the base url is
 * '/' always`.
 *
 * 🔴 **Why the fix is in the port and not in `resolveMediaSource`, which is where it looks like it
 * belongs.** `Image.tsx:56` applies the base itself, guarded on `src.startsWith('/')`. A base URL
 * is itself a path beginning with `/`, so an already-based URL still satisfies that guard: move
 * this logic one level down into the shared helper and Image prepends the base a SECOND time,
 * turning `/templates/x/a.webp` into `/templates/x/templates/x/a.webp`. That mutant is armed below
 * (`the shared helper must NOT apply the base`) and it is the reason this file exists rather than a
 * three-line change in `media-source.ts`.
 *
 * Every arm drives the REAL port definition and the REAL `_updateBackgroundLayers`, and asserts the
 * CSS string a browser would receive — not `internal.backgroundImageUrl`, which is an intermediate
 * nobody renders. An arm that read the internal field would pass with the layer composition broken.
 *
 * The mutant ledger:
 *  - drop the base-application block entirely            → "under a sub-path" reddens (the defect).
 *  - apply the base without the `startsWith('/')` guard  → "an absolute http(s) URL" reddens.
 *  - apply the base to a `data:` URI                     → "a data URI" reddens.
 *  - drop the `Noodl.Env` presence guard                 → "no Env at all" throws.
 *  - move the logic into `resolveMediaSource`            → "the shared helper" reddens.
 *  - apply the base twice / on an already-based URL      → "already carries the base" reddens.
 *  - resolve an empty port to a string                   → "an empty port" reddens (NDA-012 G1).
 */

/* eslint-env jest */

import sharedPorts from '../src/node-shared-port-definitions';
import { resolveMediaSource } from '../src/nodes/visual/media-source';

const BASE = '/templates/business-landing-page/';
const PICTURE = 'noodl_modules/starter-imagery/work-machine-shop.webp';

declare const globalThis: Record<string, unknown>;

/** The node a Group presents to these ports: the two style sinks and its own `_internal`. */
function makeHost(methods: Record<string, unknown>) {
  return {
    _internal: {} as Record<string, unknown>,
    styles: null as Record<string, unknown> | null,
    removed: [] as string[],
    setStyle(style: Record<string, unknown>) {
      this.styles = { ...(this.styles || {}), ...style };
    },
    removeStyle(names: string[]) {
      this.removed.push(...names);
      this.styles = null;
    },
    ...methods
  };
}

/**
 * One write to the port, driven through the real definition.
 *
 * `addBackgroundInputs` is what every visual node calls, so the `set` reached here is the shipped
 * one; `definition.methods._updateBackgroundLayers` is likewise the shipped composer, bound to the
 * host so the layer string is built exactly as it is at runtime.
 */
function writeBackgroundImage(value: unknown, baseUrl?: string): string | undefined {
  const definition: any = { methods: {} };
  sharedPorts.addBackgroundInputs(definition);

  const host: any = makeHost({
    _updateBackgroundLayers: definition.methods._updateBackgroundLayers
  });

  const previous = globalThis.Noodl;
  globalThis.Noodl = baseUrl === undefined ? { Env: {} } : { Env: { BaseUrl: baseUrl } };
  try {
    definition.inputs.backgroundImage.set.call(host, value);
  } finally {
    globalThis.Noodl = previous;
  }

  return host.styles?.backgroundImage as string | undefined;
}

/** The URL inside `url("…")`, or null when no picture layer was emitted. */
function pictureUrl(css: string | undefined): string | null {
  if (!css) return null;
  const m = /url\("([^"]*)"\)/.exec(css);
  return m ? m[1] : null;
}

describe('EXP-018 — backgroundImage under a deploy base URL', () => {
  it('resolves a project-relative picture under the sub-path the site is served from', () => {
    // The defect, in one line: without the fix this is '/noodl_modules/…' and 404s.
    expect(pictureUrl(writeBackgroundImage(PICTURE, BASE))).toBe(`${BASE}${PICTURE}`);
  });

  it('leaves the picture at the domain root when no base URL was published', () => {
    // A site deployed at a domain root is the common case and must not gain a prefix.
    expect(pictureUrl(writeBackgroundImage(PICTURE))).toBe(`/${PICTURE}`);
  });

  it('does not prepend the base to a URL that already carries it', () => {
    // Arms the double-application mutant from the header. Re-writing the port with the value it
    // already resolved to — a re-render, a wire firing twice — must be a fixed point.
    const once = pictureUrl(writeBackgroundImage(PICTURE, BASE))!;
    expect(pictureUrl(writeBackgroundImage(once, BASE))).toBe(once);
  });

  it('leaves an absolute http(s) URL untouched', () => {
    const remote = 'https://images.example.com/hero.webp';
    expect(pictureUrl(writeBackgroundImage(remote, BASE))).toBe(remote);
  });

  it('leaves a data URI untouched', () => {
    const inline = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    expect(pictureUrl(writeBackgroundImage(inline, BASE))).toBe(inline);
  });

  it('emits no picture layer for an empty port, and clears the style', () => {
    // NDA-012 (Visual) G1: null/undefined/'' are ordinary arrivals, not "fetch this".
    for (const empty of [null, undefined, '']) {
      expect(pictureUrl(writeBackgroundImage(empty, BASE))).toBeNull();
    }
  });

  it('does not throw when the runtime published no Env at all', () => {
    // `Noodl.Env` is present in every shipped viewer, but a throw inside a port's `set` takes the
    // whole node down, so the guard is asserted rather than assumed.
    const definition: any = { methods: {} };
    sharedPorts.addBackgroundInputs(definition);
    const host: any = makeHost({ _updateBackgroundLayers: definition.methods._updateBackgroundLayers });

    const previous = globalThis.Noodl;
    globalThis.Noodl = {};
    try {
      expect(() => definition.inputs.backgroundImage.set.call(host, PICTURE)).not.toThrow();
    } finally {
      globalThis.Noodl = previous;
    }
  });

  it('the shared helper must NOT apply the base — Image applies it itself and would double it', () => {
    // 🔴 This is the constraint that decides WHERE the fix lives. If a later change moves the
    // base-application into `resolveMediaSource`, this arm reddens — and `Image.tsx:56`, whose
    // `startsWith('/')` guard an already-based URL still satisfies, would silently produce
    // `/templates/x/templates/x/…`.
    const previous = globalThis.Noodl;
    globalThis.Noodl = { Env: { BaseUrl: BASE }, baseUrl: undefined };
    try {
      expect(resolveMediaSource(PICTURE)).toBe(`/${PICTURE}`);
    } finally {
      globalThis.Noodl = previous;
    }
  });

  it('composes the picture under a gradient scrim rather than replacing it', () => {
    // The hero is the two ports together; a fix that wrote `backgroundImage` directly would drop
    // the gradient, which is the failure `_updateBackgroundLayers` exists to prevent.
    const definition: any = { methods: {} };
    sharedPorts.addBackgroundInputs(definition);
    const host: any = makeHost({ _updateBackgroundLayers: definition.methods._updateBackgroundLayers });

    const previous = globalThis.Noodl;
    globalThis.Noodl = { Env: { BaseUrl: BASE } };
    try {
      definition.inputs.backgroundGradient.set.call(host, 'linear-gradient(#0003, #000c)');
      definition.inputs.backgroundImage.set.call(host, PICTURE);
    } finally {
      globalThis.Noodl = previous;
    }

    expect(host.styles.backgroundImage).toBe(
      `linear-gradient(#0003, #000c), url("${BASE}${PICTURE}")`
    );
    expect(host.styles.backgroundRepeat).toBe('no-repeat');
  });
});
