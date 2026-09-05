/**
 * SYL-003 — the one file that names the `@dicebear` packages.
 *
 * 🔴 **Nothing in `tests-unit` can import this, and that is the point.** DiceBear ships ESM only,
 * this repo's plain-Node runner is CommonJS, and a `require()` of it throws
 * `Cannot use import statement outside a module` — which fails a suite *to run* rather than
 * failing a test, so a single stray import here would take out every unrelated spec in the
 * directory. Keeping the imports in one leaf that only webpack loads means the rules worth grading
 * live in `avatargenerator.ts`, where a plain-Node test can reach them.
 *
 * The offline claim is graded in `tests-unit/syl-003/avataroffline.test.ts`, which runs the real
 * library in a child process with the network primitives poisoned rather than reading this file.
 *
 * @module noodl-editor/utils/avatarstyles
 */
import { createAvatar } from '@dicebear/core';
import * as glass from '@dicebear/glass';
import * as identicon from '@dicebear/identicon';
import * as lorelei from '@dicebear/lorelei';
import * as notionists from '@dicebear/notionists';
import * as openPeeps from '@dicebear/open-peeps';
import * as pixelArt from '@dicebear/pixel-art';
import * as rings from '@dicebear/rings';
import * as shapes from '@dicebear/shapes';
import * as thumbs from '@dicebear/thumbs';

import { AvatarStyle, CreateAvatar, SHIPPED_AVATAR_STYLES, renderAvatarSvg } from './avatargenerator';

/** Keyed by the ids in {@link SHIPPED_AVATAR_STYLES}; the two lists are checked against each other below. */
const STYLE_MODULES: Record<string, AvatarStyle> = {
  thumbs: thumbs as AvatarStyle,
  'open-peeps': openPeeps as AvatarStyle,
  lorelei: lorelei as AvatarStyle,
  notionists: notionists as AvatarStyle,
  'pixel-art': pixelArt as AvatarStyle,
  shapes: shapes as AvatarStyle,
  rings: rings as AvatarStyle,
  identicon: identicon as AvatarStyle,
  glass: glass as AvatarStyle
};

/** Every shipped style paired with its module — the argument `avatarLicenceViolations` grades. */
export function installedAvatarStyles(): Array<{ id: string; name: string; style: AvatarStyle }> {
  return SHIPPED_AVATAR_STYLES.filter((entry) => STYLE_MODULES[entry.id]).map((entry) => ({
    id: entry.id,
    name: entry.name,
    style: STYLE_MODULES[entry.id]
  }));
}

/** Render one avatar, by style id. Returns undefined for an id this build does not carry. */
export function generateAvatar(styleId: string, seed: string, size?: number): string | undefined {
  const style = STYLE_MODULES[styleId];
  if (!style) return undefined;

  return renderAvatarSvg(createAvatar as CreateAvatar, style, seed, size);
}
