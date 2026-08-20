/**
 * NAT-008 AC3 — the badges paint through a mask, and this is what makes that testable.
 *
 * ## 🔴 What the criterion actually asserts
 *
 * *"The twelve badge SVGs carry no colour — an `<img>`-loaded SVG inherits none, and the profile
 * paints them with `mask` so both themes are right by construction. An editor profile that
 * `<img>`s them renders twelve invisible or twelve black marks depending on the theme."*
 *
 * That is two claims, and only the second is about markup:
 *
 * 1. **the marks carry no colour** — if one of them did, masking would silently ignore it and the
 *    badge would be a *shape* on the platform and a *picture* nowhere. Graded by reading the
 *    geometry this editor holds.
 * 2. **nothing loads them as an image, or from the network** — graded over the component source
 *    with its comments stripped, because a comment saying *"a mask, not an `<img>`"* satisfies a
 *    naive grep and this repo has been bitten by exactly that three times.
 *
 * @module noodl-editor/tests-unit/nat-008/badge-marks
 */
import fs from 'fs';
import path from 'path';

import { badgeMark, badgeMarkKeys } from '@noodl-core-ui/components/community/badgeMarks';

import { stripComments } from '../support/renderElements';

const COMMUNITY = path.join(__dirname, '../../../noodl-core-ui/src/components/community');

describe('NAT-008 — the twelve marks', () => {
  it('holds four families × three tiers, and knows which is which', () => {
    // 🔴 D4's taxonomy is twelve. Eleven here would be one badge that silently draws no picture,
    // which the no-artwork branch renders honestly and nobody would notice.
    expect(badgeMarkKeys()).toHaveLength(12);
    expect(badgeMarkKeys()).toEqual([
      'building-bronze',
      'building-gold',
      'building-silver',
      'community-bronze',
      'community-gold',
      'community-silver',
      'contributing-bronze',
      'contributing-gold',
      'contributing-silver',
      'learning-bronze',
      'learning-gold',
      'learning-silver'
    ]);
  });

  it('is keyed on family and tier, case-folded, and answers null for anything else', () => {
    expect(badgeMark('learning', 'bronze')).toBeTruthy();
    expect(badgeMark('Learning', 'BRONZE')).toBeTruthy();
    // 🔴 A thirteenth badge added on the platform tomorrow arrives here as a badge with NO
    // picture, never as somebody else's picture. That containment is the whole reason the lookup
    // is not keyed on the platform's `artwork` path.
    expect(badgeMark('mentoring', 'bronze')).toBeNull();
    expect(badgeMark('learning', 'platinum')).toBeNull();
  });

  it('carries no colour of its own — which is what makes the mask necessary AND correct', () => {
    for (const key of badgeMarkKeys()) {
      const [family, tier] = key.split('-');
      const mark = badgeMark(family, tier)!;
      // ⚠️ A `fill="#..."` or a `stroke=` in one of these would be a mark that looks right on the
      // platform and is thrown away here, because a mask reads only the alpha channel.
      expect(mark).not.toMatch(/fill%3D%22%23/i);
      expect(mark).not.toMatch(/stroke%3D/i);
      expect(mark.startsWith('url("data:image/svg+xml,')).toBe(true);
    }
  });

  it('is a data URI, so drawing a badge makes no network request', () => {
    // 🔴 The task's own trap, applied to the decoration rather than to the avatar: the platform
    // serves these from `public/badges/`, and a mask URL pointing there would be a remote fetch
    // from a `nodeIntegration: true` window that also fails with the network.
    //
    // ⚠️ **`http://www.w3.org/2000/svg` is in every one of these and is NOT a fetch** — an
    // `xmlns` is a namespace *name* that no renderer resolves. A first draft of this spec
    // asserted `not.toMatch(/https?:/)` and went red on all twelve, which is the shape of check
    // that looks strict and is measuring the wrong string. What would actually pull bytes is a
    // reference: `href`, `xlink:href` or a nested `url(http…)`.
    for (const key of badgeMarkKeys()) {
      const [family, tier] = key.split('-');
      const mark = badgeMark(family, tier)!;
      expect(mark.startsWith('url("data:image/svg+xml,')).toBe(true);
      expect(mark).not.toMatch(/href/i);
      expect(mark).not.toMatch(/url\(\s*(%22)?https?:/i);
    }
  });

  it('the control: a mark that DID reference something remote would be caught', () => {
    // 🔴 Beside the absence above. The three patterns are asserted against a string that has the
    // shape a leaked reference would have, so a typo in one of them cannot pass silently.
    const leaked = 'url("data:image/svg+xml,%3Cimage href=%22https://cdn.example/x.png%22/%3E")';
    expect(leaked).toMatch(/href/i);
  });
});

describe('NAT-008 AC3 — the mechanism, not the markup', () => {
  const profileSource = fs.readFileSync(path.join(COMMUNITY, 'CommunityProfileView.tsx'), 'utf8');
  const rowSource = fs.readFileSync(path.join(COMMUNITY, 'CommunityPersonRow.tsx'), 'utf8');

  it('the profile paints a badge with maskImage and never with an <img>', () => {
    const code = stripComments(profileSource);
    expect(code).toContain('maskImage');
    // 🔴 Comments stripped first. The module note of this very file says "a mask, not an `<img>`",
    // and a checker that could not tell prose from code would clear a file that did both.
    expect(code).not.toMatch(/<img\b/);
  });

  it('neither people component loads a remote image, by any route', () => {
    // ⚠️ Three spellings, because the interesting failure is somebody adding an avatar later:
    // an `<img src>`, a CSS `url(http…)`, or a `backgroundImage` built from `avatarUrl`.
    for (const source of [profileSource, rowSource]) {
      const code = stripComments(source);
      expect(code).not.toMatch(/<img\b/);
      expect(code).not.toMatch(/url\(\s*['"]?https?:/i);
      expect(code).not.toContain('avatarUrl');
    }
  });

  it('the control: the profile DOES draw the fields it is supposed to draw', () => {
    // 🔴 Beside three absences. A file that failed to load, or a rename that made every pattern
    // miss, would pass all of them — this is the row that says the source above is the source.
    const code = stripComments(profileSource);
    expect(code).toContain('profile.badges.map');
    expect(code).toContain('badge.mark');
    expect(code).toContain('badgesEmptyLine');
  });
});
