/**
 * COM-004 AC4 — `og:type` and `twitter:card` accept only their legal values.
 *
 * ## What this grades, and why it is not a tautology
 *
 * Before COM-004 both ports were plain `string`, so `og:type: "artical"` was accepted by every gate
 * the product has. Measured, on the catalog as it stood:
 *
 *     og:type = "artical" (typo)            -> accepted
 *     twitter:card = "big" (illegal)        -> accepted
 *
 * and after:
 *
 *     og:type = "artical" (typo)            -> REJECTED  invalid-parameter-value
 *     og:type = "article" (legal)           -> accepted
 *     twitter:card = "big" (illegal)        -> REJECTED  invalid-parameter-value
 *     twitter:card = "summary_large_image"  -> accepted
 *
 * 🔴 **The failure this prevents is a silent one.** An unrecognised `og:type` is not an error
 * anywhere in the chain — no console line, no crawler complaint. The scraper falls back to its
 * default and the author gets a share preview that is subtly not the one they asked for, with
 * nothing anywhere saying why.
 *
 * ⚠️ **The value lists are not ours.** They come from the Open Graph protocol and X/Twitter's card
 * documentation, by way of the community's own `SEO Meta Tag setter`, which constrained both with
 * `States` nodes years before this node offered anything but free text. This spec asserts the sets
 * VERBATIM rather than by count, so that widening one is a deliberate edit here and not a silent
 * drift — the same reason `spacingLiteral.test.ts` derives its table from the token file.
 */

import { META_TAGS } from '../src/components/navigation/Page/Page';

type EnumType = { name: string; enums: { label: string; value: string }[] };

function portType(key: string) {
  const tag = META_TAGS.find((t) => t.key === key);
  if (!tag) throw new Error(`No meta tag declared for "${key}" — the port was renamed or removed.`);
  return tag.type;
}

describe('COM-004 AC4 — the two closed-set meta tags', () => {
  it('og:type offers exactly the Open Graph types, and nothing else', () => {
    const type = portType('og:type') as EnumType;
    expect(type).toBeDefined();
    expect(type.name).toBe('enum');
    expect(type.enums.map((e) => e.value)).toEqual([
      'website',
      'article',
      'book',
      'profile',
      'video.movie',
      'video.episode',
      'video.tv_show',
      'video.other',
      'music.song',
      'music.album',
      'music.playlist',
      'music.radio_station'
    ]);
  });

  it('twitter:card offers exactly the four card shapes', () => {
    const type = portType('twitter:card') as EnumType;
    expect(type).toBeDefined();
    expect(type.name).toBe('enum');
    expect(type.enums.map((e) => e.value)).toEqual(['summary', 'summary_large_image', 'app', 'player']);
  });

  it('every option is its own label, so the editor shows the value that is written', () => {
    // A label that differs from its value is how an author picks "Article" and the tag reads
    // something else. The validator's own hint says as much: "not the label, not a synonym".
    for (const key of ['og:type', 'twitter:card']) {
      for (const option of (portType(key) as EnumType).enums) {
        expect(option.label).toBe(option.value);
      }
    }
  });

  it('leaves the free-text tags alone — only the closed sets are constrained', () => {
    // ⚠️ The counterpart to the two assertions above. A rule that turned every meta tag into an
    // enum would pass those and be badly wrong: `og:title` is prose and must stay a string.
    const constrained = META_TAGS.filter((t) => typeof t.type === 'object' && (t.type as EnumType).name === 'enum');
    expect(constrained.map((t) => t.key).sort()).toEqual(['og:type', 'twitter:card']);
  });

  it('og:type is connectable, not editor-only — a CMS drives it from data', () => {
    // Locking it to the editor would take away the case that most needs it: `article` for a post
    // and `website` for a landing page, chosen per record rather than per page component.
    for (const key of ['og:type', 'twitter:card']) {
      expect((portType(key) as EnumType & { allowEditOnly?: boolean }).allowEditOnly).toBeUndefined();
    }
  });
});
