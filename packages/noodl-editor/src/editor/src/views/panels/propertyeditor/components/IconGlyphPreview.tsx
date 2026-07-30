import React from 'react';
import { filesystem } from '@noodl/platform';

import type { IconSetDescriptor, IconSetValue } from '../../../../../../shared/utils/iconsets';
import { isSpriteIconValue } from '../../../../../../shared/utils/iconsets';

/**
 * The editor's counterpart to the viewer's `IconGlyph` — NDA-007 §3.
 *
 * One component, so the picker cell and the property-panel thumbnail cannot disagree about what a
 * value looks like. §1's lesson, applied on this side of the fence: the font splat was written six
 * times in the viewer, and it was written twice more here (`iconpicker.jsx` and `IconInput.tsx`),
 * each independently font-shaped.
 *
 * Size and colour follow the same rule the viewer's renderer uses, deliberately, so the picker is a
 * true preview: the wrapper carries `fontSize` and `color`, and an SVG glyph inherits both by
 * sizing at `1em` and filling with `currentColor`.
 *
 * ## Why the editor and the viewer do not share one renderer
 *
 * They cannot: `noodl-editor` does not depend on `noodl-viewer-react` (the viewer is a *built
 * artefact* the editor loads, not a source dependency), and the two documents need different URL
 * resolution and different sanitisation. See {@link ensureSpriteSheet} — this is not the six-copies
 * mistake repeated, it is two boundaries with genuinely different capabilities, and the shared part
 * (which kind a value is, and what value a glyph makes) is in `shared/utils/iconsets.ts`.
 */
export function IconGlyphPreview({
  value,
  size,
  className
}: {
  value: IconSetValue | undefined;
  size: number;
  className?: string;
}) {
  const style: React.CSSProperties = { fontSize: size, display: 'inline-block', lineHeight: 1 };

  if (isSpriteIconValue(value)) {
    return (
      <span className={className} style={style}>
        <svg style={SVG_STYLE} focusable="false" aria-hidden="true">
          <use href={'#' + spriteSymbolDomId(value.url, value.symbolId)} />
        </svg>
      </span>
    );
  }

  const font = value as { class?: string; code?: string; codeAsClass?: boolean } | undefined;
  const classes = font
    ? font.codeAsClass
      ? [className, font.class, font.code].filter(Boolean).join(' ')
      : [className, font.class].filter(Boolean).join(' ')
    : className;

  return (
    <span className={classes} style={style}>
      {font && !font.codeAsClass ? font.code : ''}
    </span>
  );
}

const SVG_STYLE: React.CSSProperties = {
  width: '1em',
  height: '1em',
  fill: 'currentColor',
  display: 'block'
};

/**
 * The id a sprite symbol gets once inlined into the editor document.
 *
 * Derived from the sheet URL and the symbol id rather than from the module name, because the
 * *thumbnail* renders from a stored parameter — which carries only `{ url, symbolId }` — and it has
 * to reach the same symbol the picker installed. Namespaced by URL so two sets that both ship a
 * `home` symbol do not collide in the one document they now share.
 */
export function spriteSymbolDomId(url: string, symbolId: string): string {
  return 'ndl-sprite-' + slug(url) + '-' + slug(symbolId);
}

function slug(value: string): string {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function resolveModuleAsset(path: string, projectDirectory: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return filesystem.join(projectDirectory, path);
}

const installedStylesheets = new Set<string>();
const installedSprites = new Set<string>();

/**
 * Put a font set's stylesheets into the editor document, once.
 *
 * Unchanged behaviour from the pre-NDA-007 picker, with the id scheme kept (`ndl-iconset-styles-…`)
 * so a set already installed by an older session is not installed twice. Only font sets get here;
 * a sprite set has no stylesheet, and requiring one is the current model's core defect.
 */
export function ensureFontStylesheets(set: IconSetDescriptor, projectDirectory: string): void {
  set.stylesheets.forEach((sheet, idx) => {
    const id = 'ndl-iconset-styles-' + idx + '-' + set.moduleName;
    if (installedStylesheets.has(id) || document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.href = resolveModuleAsset(sheet, projectDirectory);
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    installedStylesheets.add(id);
  });
}

/**
 * Inline a sprite sheet into the editor document, once, so `<use href="#…">` can reach it.
 *
 * **An external `<use href="file:///…#id">` does not work and fails silently.** The editor document
 * is a `file://` page, Chromium treats external `use` references as cross-origin unless the
 * document and the sheet share an origin, and a blocked reference renders *nothing* — a picker full
 * of blank cells with no error. Serving the sheet over the preview's web server does not help; that
 * is a different origin again. Inlining is the only path that works from this document, and it is
 * also how sprite sheets are conventionally used.
 *
 * The app has no equivalent problem, which is worth stating because it is why §2 turned out small:
 * the viewer document and the sheet are both served from the project origin, so the viewer renders
 * `<use href="noodl_modules/…/sprite.svg#home">` directly and nothing is injected anywhere.
 *
 * ## Sanitisation
 *
 * Parsed and scrubbed with `DOMParser`, **not** with the viewer's regex. That is not a second copy
 * of one thing: the viewer's scrub is regex-based because it must run under SSR and under
 * `testEnvironment: node`, where there is no parser; here there is one, and this document is the
 * privileged one, so it gets the stricter tool. A module can already ship `main: index.js` and have
 * it executed, so a module's own sprite sheet is not the trust boundary this defends — it is
 * defence in depth against a sheet that arrived with an imported library.
 *
 * Symbol ids are namespaced on the way in; see {@link spriteSymbolDomId}.
 */
export async function ensureSpriteSheet(set: IconSetDescriptor, projectDirectory: string): Promise<void> {
  const url = set.spriteUrl;
  if (!url) return;

  const containerId = 'ndl-iconset-sprite-' + slug(url);
  if (installedSprites.has(containerId) || document.getElementById(containerId)) return;
  // Claimed before the first await: two icon pickers opening in the same frame would otherwise
  // both read an empty document and both append the sheet.
  installedSprites.add(containerId);

  let text: string;
  try {
    text = await filesystem.readFile(resolveModuleAsset(url, projectDirectory));
  } catch (error) {
    installedSprites.delete(containerId);
    // eslint-disable-next-line no-console
    console.warn(`[iconsets] sprite sheet "${url}" could not be read — its glyphs will not render`, error);
    return;
  }

  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = parsed.documentElement;
  if (!root || root.nodeName === 'parsererror' || parsed.getElementsByTagName('parsererror').length > 0) {
    installedSprites.delete(containerId);
    // eslint-disable-next-line no-console
    console.warn(`[iconsets] sprite sheet "${url}" is not parseable SVG — its glyphs will not render`);
    return;
  }

  scrubSvgTree(root);

  // Namespace every symbol so two sheets can both define `home`.
  const symbols = root.getElementsByTagName('symbol');
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const id = symbol.getAttribute('id');
    if (id) symbol.setAttribute('id', spriteSymbolDomId(url, id));
  }

  const container = document.createElement('div');
  container.id = containerId;
  // Hidden, but not `display: none` — a `<use>` reference into a `display: none` subtree still
  // resolves, while `hidden`/zero-size keeps it out of layout without any doubt about that.
  container.setAttribute(
    'style',
    'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none'
  );
  container.appendChild(document.importNode(root, true));
  document.body.appendChild(container);
}

/**
 * Remove everything executable or externally-referencing from a parsed SVG tree.
 *
 * Same policy as the viewer's `sanitizeInlineIconSvg`, expressed against a real tree: elements that
 * can run code, every `on*` handler, and any `href` that is not a same-document fragment.
 */
function scrubSvgTree(root: Element): void {
  const forbidden = ['script', 'foreignObject', 'iframe', 'style'];
  forbidden.forEach((tag) => {
    const nodes = root.getElementsByTagName(tag);
    // Live NodeList — remove from the end.
    for (let i = nodes.length - 1; i >= 0; i--) nodes[i].parentNode?.removeChild(nodes[i]);
  });

  const walk = (element: Element) => {
    for (let i = element.attributes.length - 1; i >= 0; i--) {
      const attribute = element.attributes[i];
      const name = attribute.name.toLowerCase();

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if ((name === 'href' || name === 'xlink:href') && !attribute.value.trim().startsWith('#')) {
        element.removeAttribute(attribute.name);
      }
    }

    for (let i = 0; i < element.children.length; i++) walk(element.children[i]);
  };

  walk(root);
}
