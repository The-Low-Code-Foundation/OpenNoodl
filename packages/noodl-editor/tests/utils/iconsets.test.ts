/**
 * NDA-007 §2 — icon sets, from the registration path that already existed.
 *
 * The spec said "today there is no such declaration" of an icon set. There is: a module directory
 * whose `manifest.json` carries `type: 'iconset'`, scanned by the one scanner LIB-003 built. What
 * was missing is any way for a set to be something other than a font. These rows pin the widening
 * and, as importantly, pin the **font branch's output byte-for-byte** — criterion 2 is that an
 * existing project's icon parameters do not change shape, and the way that goes wrong is a
 * well-meaning `kind: 'font'` being added to the value.
 *
 * describe/it/expect come from Jasmine globals — the editor suite runs under the Electron/Jasmine
 * runner, and importing @jest/globals throws at module load.
 */
import * as path from 'path';

import { iconValueForGlyph, isSpriteIconValue, toIconSets } from '../../src/shared/utils/iconsets';
import { scanModuleManifests } from '../../src/shared/utils/projectmodules';

const FIXTURE = path.join(process.cwd(), 'tests/testfs/module-iconsets');

async function sets() {
  return toIconSets(await scanModuleManifests(FIXTURE));
}

describe('iconsets — reading sets out of the module manifests (NDA-007 §2)', () => {
  it('returns only modules declaring type: iconset', async () => {
    const found = await sets();

    expect(found.map((s) => s.moduleName).sort()).toEqual(['font-icons', 'sprite-broken', 'sprite-icons']);
  });

  it('defaults a set with no iconSource to a font, which is what every existing set is', async () => {
    const font = (await sets()).find((s) => s.moduleName === 'font-icons');

    expect(font.kind).toBe('font');
    expect(font.iconClass).toBe('fi');
    expect(font.codeAsClass).toBe(true);
    expect(font.icons).toEqual(['fi-home', 'fi-user']);
  });

  it('carries a font set stylesheets verbatim, http URL included', async () => {
    const font = (await sets()).find((s) => s.moduleName === 'font-icons');

    expect(font.stylesheets).toEqual(['assets/font-icons.css', 'https://cdn.example.com/font-icons.css']);
  });

  // The URL has to resolve in the preview *and* in a deploy, neither of which shares an origin or a
  // path prefix with the editor document — so it is project-relative, and the picker is the only
  // thing that resolves it any further.
  it('resolves a sprite path against the module directory, project-relative', async () => {
    const sprite = (await sets()).find((s) => s.moduleName === 'sprite-icons');

    expect(sprite.kind).toBe('sprite');
    expect(sprite.spriteUrl).toBe('noodl_modules/sprite-icons/assets/sprite.svg');
  });

  // Rejected rather than degraded to a font: there is no glyph to draw and no class to fall back
  // on, so keeping it would put a row of blank cells in the picker with no explanation.
  it('drops a sprite set with no sheet, loudly', async () => {
    const broken = (await sets()).find((s) => s.moduleName === 'sprite-broken');

    expect(broken.icons).toEqual([]);
    expect(broken.warnings.join(' ')).toContain("no 'sprite' path");
  });

  it('never leaves a set nameless', async () => {
    const found = await sets();

    expect(found.every((s) => typeof s.name === 'string' && s.name.length > 0)).toBe(true);
  });
});

describe('iconsets — the value a chosen glyph becomes (NDA-007 §3)', () => {
  // Criterion 2. The picker used to build this object literally, inline; `iconValueForGlyph` has to
  // produce the same three keys and **no `kind`**, or every existing icon parameter in every
  // project changes shape the first time it is re-picked.
  it('builds a font value with exactly the keys the picker used to emit', async () => {
    const font = (await sets()).find((s) => s.moduleName === 'font-icons');
    const value = iconValueForGlyph(font, 'fi-home');

    expect(Object.keys(value).sort()).toEqual(['class', 'code', 'codeAsClass']);
    expect(value).toEqual({ class: 'fi', code: 'fi-home', codeAsClass: true });
  });

  it('builds a self-describing sprite value', async () => {
    const sprite = (await sets()).find((s) => s.moduleName === 'sprite-icons');

    expect(iconValueForGlyph(sprite, 'home')).toEqual({
      kind: 'sprite',
      url: 'noodl_modules/sprite-icons/assets/sprite.svg',
      symbolId: 'home'
    });
  });

  // The thumbnail and the renderer both branch on this, and both get the value out of project JSON
  // where nothing has narrowed it. A `kind` string alone is not enough to act on.
  it('recognises a sprite value structurally and rejects a font one', async () => {
    const found = await sets();
    const sprite = iconValueForGlyph(
      found.find((s) => s.moduleName === 'sprite-icons'),
      'home'
    );
    const font = iconValueForGlyph(
      found.find((s) => s.moduleName === 'font-icons'),
      'fi-home'
    );

    expect(isSpriteIconValue(sprite)).toBe(true);
    expect(isSpriteIconValue(font)).toBe(false);
    expect(isSpriteIconValue({ kind: 'sprite' })).toBe(false);
    expect(isSpriteIconValue(undefined)).toBe(false);
  });
});
