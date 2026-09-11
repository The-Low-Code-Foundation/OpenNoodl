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
  PERMITTED_DESIGN_LICENCES,
  SHIPPED_AVATAR_STYLES,
  avatarCreditFor,
  avatarFileName,
  avatarLicenceViolations,
  avatarSeed,
  avatarSlug,
  parseAvatarCredits,
  renderAvatarSvg,
  requiresAttribution,
  upsertAvatarCredits
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
  const styleWithLicence = (name?: string, creator?: string): AvatarStyle => ({
    meta: { title: 't', creator, ...(name ? { license: { name } } : {}) },
    create: () => undefined
  });

  it('permits CC0 and CC BY, and CC BY only with a named artist', () => {
    expect(
      avatarLicenceViolations([
        { id: 'thumbs', style: styleWithLicence('CC0 1.0') },
        { id: 'adventurer', style: styleWithLicence('CC BY 4.0', 'Lisa Wischofsky') }
      ])
    ).toEqual([]);
  });

  /**
   * 🔴 The known-firing half, and it has two arms now. A gate that only ever sees the passing
   * population proves nothing about the failing one, and both failing shapes are concrete:
   * `bottts` declares no licence text at all, and a CC BY style with no artist cannot be complied
   * with — a credits file with a blank in it reads as an attribution and is not one.
   */
  it('names a style with no licence, and a CC BY style with nobody to credit', () => {
    expect(
      avatarLicenceViolations([
        { id: 'thumbs', style: styleWithLicence('CC0 1.0') },
        { id: 'bottts', style: styleWithLicence(undefined) },
        { id: 'anonymous', style: styleWithLicence('CC BY 4.0', undefined) }
      ])
    ).toEqual([
      { id: 'bottts', licence: '(none declared)', reason: 'not a permitted artwork licence' },
      { id: 'anonymous', licence: 'CC BY 4.0', reason: 'attribution required but no creator is declared' }
    ]);
  });

  it('knows which licences oblige a credit', () => {
    expect(requiresAttribution('CC BY 4.0')).toBe(true);
    expect(requiresAttribution('CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)')).toBe(true);
    expect(requiresAttribution('CC0 1.0')).toBe(false);
    expect(requiresAttribution(undefined)).toBe(false);
  });

  /**
   * 🔴 THE GATE THAT MATTERS, and it reads the installed packages rather than this repo's own list.
   *
   * `avatarstyles.ts` cannot be imported here — DiceBear is ESM and this runner is CommonJS — so
   * the artefact is read off disk instead: every shipped style's own LICENSE file, which is what
   * actually ships. A style whose artwork licence is neither CC0 nor CC BY reddens this at the
   * moment it is added, rather than at the moment somebody is asked to indemnify it.
   */
  it('every style this build installs carries a permitted artwork licence on disk', () => {
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

      if (!PERMITTED_DESIGN_LICENCES.some((permitted) => licence.startsWith(permitted))) {
        offenders.push({ id, licence });
      }
    });

    expect(offenders).toEqual([]);
  });

  /**
   * 🔴 The other half of the same artefact read: a CC BY package must name somebody on disk, or the
   * credit written into a learner's project would have a hole in it.
   */
  it('every CC BY style names an artist on disk', () => {
    const modules = path.resolve(__dirname, '../../../..', 'node_modules', '@dicebear');
    const missing: string[] = [];
    let ccByCount = 0;

    SHIPPED_AVATAR_STYLES.forEach(({ id }) => {
      const design = fs.readFileSync(path.join(modules, id, 'LICENSE'), 'utf8').split('# Code')[0];
      if (!/^License:\s*CC BY 4\.0/m.test(design)) return;
      ccByCount++;
      if (!/^Designer:\s*\S/m.test(design)) missing.push(id);
    });

    // ⚠️ Cardinality asserted: `missing` is empty both when every CC BY style names an artist and
    // when the loop found no CC BY styles at all. Only one of those is the claim.
    expect(ccByCount).toBe(7);
    expect(missing).toEqual([]);
  });

  it('ships sixteen styles and leads with the creatures', () => {
    expect(SHIPPED_AVATAR_STYLES).toHaveLength(16);
    expect(SHIPPED_AVATAR_STYLES[0].id).toBe('thumbs');
    // Every id is distinct — the record in `avatarstyles.ts` is keyed by these.
    expect(new Set(SHIPPED_AVATAR_STYLES.map((s) => s.id)).size).toBe(16);
  });

  /**
   * ⚠️ `bottts` and `avataaars` are excluded by Richard's 2026-09-05 ruling because their terms are
   * a sentence on a web page rather than a licence. Named here so that adding one is a deliberate
   * act with a red test in front of it, rather than a plausible-looking one-line addition.
   */
  it('does not ship the two styles whose terms are a web page', () => {
    const ids = SHIPPED_AVATAR_STYLES.map((s) => s.id);
    expect(ids).not.toContain('bottts');
    expect(ids).not.toContain('avataaars');
  });
});

describe('SYL-003 — the credit that travels with the picture', () => {
  const ccBy = {
    title: 'Adventurer',
    creator: 'Lisa Wischofsky',
    license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
  };

  it('writes no credit for a public-domain style', () => {
    expect(
      avatarCreditFor('assets/n-thumbs.svg', 'Creatures', {
        title: 'Thumbs',
        creator: 'DiceBear',
        license: { name: 'CC0 1.0' }
      })
    ).toBeUndefined();
  });

  it('credits the artist for a CC BY style', () => {
    expect(avatarCreditFor('assets/n-adventurer.svg', 'Adventurers', ccBy)).toEqual({
      fileName: 'assets/n-adventurer.svg',
      styleName: 'Adventurers',
      creator: 'Lisa Wischofsky',
      licence: 'CC BY 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by/4.0/'
    });
  });

  it('round-trips through the file it writes', () => {
    const credit = avatarCreditFor('assets/n-adventurer.svg', 'Adventurers', ccBy);
    const file = upsertAvatarCredits('', credit);

    expect(file).toContain('Lisa Wischofsky');
    expect(file).toContain('assets/n-adventurer.svg');
    expect(parseAvatarCredits(file)).toEqual([credit]);
  });

  /**
   * 🔴 Picking the same avatar twice is ordinary. A credits file that grew a duplicate row each
   * time is the first thing an author would delete — taking the attribution with it.
   */
  it('is idempotent on the file name, and keeps other rows', () => {
    const first = avatarCreditFor('assets/a-adventurer.svg', 'Adventurers', ccBy);
    const second = avatarCreditFor('assets/b-croodles.svg', 'Doodles', {
      title: 'Croodles',
      creator: 'vijay verma',
      license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
    });

    let file = upsertAvatarCredits('', first);
    file = upsertAvatarCredits(file, second);
    file = upsertAvatarCredits(file, first);

    const rows = parseAvatarCredits(file);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.fileName)).toEqual(['assets/a-adventurer.svg', 'assets/b-croodles.svg']);
  });

  it('does not read its own header or divider back as a credit', () => {
    expect(parseAvatarCredits(upsertAvatarCredits('', avatarCreditFor('assets/x-micah.svg', 'Portraits', ccBy)))).toHaveLength(1);
    expect(parseAvatarCredits('')).toEqual([]);
    expect(parseAvatarCredits('# Image credits\n\nJust prose, no table.')).toEqual([]);
  });

  it('survives prose a person added around the table', () => {
    const credit = avatarCreditFor('assets/n-adventurer.svg', 'Adventurers', ccBy);
    const edited = 'Some note from the author.\n\n' + upsertAvatarCredits('', credit) + '\nA closing note.\n';

    expect(parseAvatarCredits(edited)).toEqual([credit]);
  });
});
