/**
 * SYL-003 — the rules behind "type a word, get your creature".
 *
 * The library itself is graded next door in `avataroffline.test.ts`, which runs the real thing in a
 * child process. What is here is everything this repo decided: the seeds, the names on disk, and
 * the licence rule, all of which are reachable from a plain-Node runner because
 * `avatargenerator.ts` deliberately imports nothing.
 */
import fs from 'fs';
import path from 'path';

import {
  AVATAR_VARIATIONS,
  AvatarStyle,
  REQUIRED_DESIGN_LICENCE,
  SHIPPED_AVATAR_STYLES,
  avatarFileName,
  avatarLicenceViolations,
  avatarSeed,
  avatarSlug,
  renderAvatarSvg
} from '../../src/editor/src/utils/avatargenerator';

describe('SYL-003 — seeds', () => {
  /**
   * 🔴 The property the whole idea rests on. Richard's ask was a picture the learner *chose*; a
   * generator only delivers that if the same word keeps giving the same creature, so this is not a
   * hash-stability nicety — it is the difference between "your creature" and a shuffle.
   */
  it('gives the bare keyword as the first seed, so a word always draws the same creature', () => {
    expect(avatarSeed('Nibbles', 0)).toBe('Nibbles');
    expect(avatarSeed('  Nibbles  ', 0)).toBe('Nibbles');
  });

  it('numbers the alternatives from two, and they are stable across reopenings', () => {
    expect(avatarSeed('Nibbles', 1)).toBe('Nibbles 2');
    expect(avatarSeed('Nibbles', 3)).toBe('Nibbles 4');
    // Same call, same answer — an author who liked the third one can close the popout and find it.
    expect(avatarSeed('Nibbles', 2)).toBe(avatarSeed('Nibbles', 2));
  });

  it('offers four per style', () => {
    expect(AVATAR_VARIATIONS).toBe(4);
  });
});

describe('SYL-003 — names on disk', () => {
  it('slugifies to something a web server and the asset walk agree about', () => {
    expect(avatarSlug('Nibbles')).toBe('nibbles');
    expect(avatarSlug('Nibbles the 2nd!')).toBe('nibbles-the-2nd');
    expect(avatarSlug('  spaced  out  ')).toBe('spaced-out');
  });

  /**
   * A keyword in a script this repo has never seen must not become an empty file name. The whole
   * string collapsing to nothing is the case, and it has to land somewhere rather than on `.svg`.
   */
  it('never yields an empty stem', () => {
    expect(avatarSlug('日本語')).toBe('avatar');
    expect(avatarSlug('!!!')).toBe('avatar');
    expect(avatarSlug('')).toBe('avatar');
    expect(avatarFileName('!!!', 'thumbs')).toBe('avatar-thumbs.svg');
  });

  it('puts the seed and the style in the name, so two choices never contend for one', () => {
    expect(avatarFileName('Nibbles', 'thumbs')).toBe('nibbles-thumbs.svg');
    expect(avatarFileName('Nibbles', 'pixel-art')).toBe('nibbles-pixel-art.svg');
    // The variation is carried IN the seed, which is why the file name takes a seed and not a keyword.
    expect(avatarFileName(avatarSeed('Nibbles', 2), 'pixel-art')).toBe('nibbles-3-pixel-art.svg');
    const names = new Set([
      avatarFileName(avatarSeed('Nibbles', 0), 'thumbs'),
      avatarFileName(avatarSeed('Nibbles', 1), 'thumbs'),
      avatarFileName(avatarSeed('Nibbles', 0), 'lorelei')
    ]);
    expect(names.size).toBe(3);
  });
});

describe('SYL-003 — rendering', () => {
  it('asks the library for the seed and the size, and returns what it produced', () => {
    const calls: Array<{ seed: string; size?: number }> = [];
    const fake = (_style: AvatarStyle, options: { seed: string; size?: number }) => {
      calls.push({ seed: options.seed, size: options.size });
      return { toString: () => '<svg>drawn</svg>' };
    };
    const style = { meta: { title: 'Fake' }, create: () => undefined };

    expect(renderAvatarSvg(fake, style, 'Nibbles', 96)).toBe('<svg>drawn</svg>');
    expect(calls).toEqual([{ seed: 'Nibbles', size: 96 }]);
  });
});

describe('SYL-003 — the licence rule', () => {
  const styleWithLicence = (name?: string): AvatarStyle => ({
    meta: name ? { title: 't', license: { name } } : { title: 't' },
    create: () => undefined
  });

  it('passes a set that is entirely CC0', () => {
    expect(
      avatarLicenceViolations([
        { id: 'thumbs', style: styleWithLicence(REQUIRED_DESIGN_LICENCE) },
        { id: 'rings', style: styleWithLicence(REQUIRED_DESIGN_LICENCE) }
      ])
    ).toEqual([]);
  });

  /**
   * 🔴 The known-firing half. A gate that only ever sees the passing population proves nothing
   * about what it would do with the failing one, and the failing one here is concrete: `adventurer`
   * and `fun-emoji` are CC BY 4.0 and `bottts` carries no licence text at all.
   */
  it('names a CC BY style and one that declares nothing', () => {
    expect(
      avatarLicenceViolations([
        { id: 'thumbs', style: styleWithLicence(REQUIRED_DESIGN_LICENCE) },
        { id: 'fun-emoji', style: styleWithLicence('CC BY 4.0') },
        { id: 'bottts', style: styleWithLicence(undefined) }
      ])
    ).toEqual([
      { id: 'fun-emoji', licence: 'CC BY 4.0' },
      { id: 'bottts', licence: '(none declared)' }
    ]);
  });

  /**
   * 🔴 THE GATE THAT MATTERS, and it reads the installed packages rather than this repo's own list.
   *
   * `avatarstyles.ts` cannot be imported here — DiceBear is ESM and this runner is CommonJS — so
   * the artefact is read off disk instead: every shipped style's own LICENSE file, which is what
   * actually ships. Adding a tenth style whose artwork is CC BY reddens this at the moment it is
   * added, rather than at the moment somebody is asked to indemnify it.
   */
  it('every style this build actually installs is CC0 on disk', () => {
    const modules = path.resolve(__dirname, '../../../..', 'node_modules', '@dicebear');
    const offenders: Array<{ id: string; licence: string }> = [];

    SHIPPED_AVATAR_STYLES.forEach(({ id }) => {
      const licencePath = path.join(modules, id, 'LICENSE');
      expect(fs.existsSync(licencePath)).toBe(true);

      // The "# Design" half is the artwork; the "# Code" half below it is MIT for every package
      // and is not the half that obliges anything.
      const design = fs.readFileSync(licencePath, 'utf8').split('# Code')[0];
      const declared = /^License:\s*(.+)$/m.exec(design);
      const licence = declared ? declared[1].trim() : '(none declared)';

      if (!licence.startsWith(REQUIRED_DESIGN_LICENCE)) offenders.push({ id, licence });
    });

    expect(offenders).toEqual([]);
  });

  it('ships nine styles and leads with the creatures', () => {
    expect(SHIPPED_AVATAR_STYLES).toHaveLength(9);
    expect(SHIPPED_AVATAR_STYLES[0].id).toBe('thumbs');
    // Every id is distinct — the record in `avatarstyles.ts` is keyed by these.
    expect(new Set(SHIPPED_AVATAR_STYLES.map((s) => s.id)).size).toBe(9);
  });
});
