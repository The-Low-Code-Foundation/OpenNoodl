import React from 'react';

import { AVATAR_VARIATIONS, avatarSeed, requiresAttribution } from '@noodl-utils/avatargenerator';
import { generateAvatar, installedAvatarStyles } from '@noodl-utils/avatarstyles';

import Tooltip from '../../../reactcomponents/tooltip';

// Styles — the search header and the popout chrome are the icon picker's, deliberately: this is the
// interaction Richard pointed at ("search by keyword and select one") and it already ships.
require('../../../styles/propertyeditor/iconpicker.css');

/** How long typing settles before the grid is rebuilt. */
const TYPING_SETTLE_MS = 180;

export interface AvatarChoice {
  styleId: string;
  seed: string;
  variation: number;
  svg: string;
}

export interface AvatarPickerProps {
  /** Prefills the keyword — the node's label, so the common case needs no typing at all. */
  initialKeyword?: string;
  onAvatarSelected: (choice: AvatarChoice) => void;
}

/** An SVG string as something an `<img>` can take, which is also how it will be used once saved. */
function svgToDataUri(svg: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/**
 * SYL-003 — keyword to creature, in the property panel.
 *
 * 🔴 **The empty state is not the icon picker's.** There, "no results" means the glyph does not
 * exist and the author has hit the edge of a shipped set; here every string is valid and the only
 * empty case is *nothing typed yet*, which is an invitation rather than a limit. Copying the icon
 * picker's dead end along with its interaction was the trap SYL-003 named, so the two states this
 * draws are "type something" and a grid — never "no results".
 */
export function AvatarPicker({ initialKeyword, onAvatarSelected }: AvatarPickerProps) {
  const [typed, setTyped] = React.useState(initialKeyword ?? '');
  const [keyword, setKeyword] = React.useState(initialKeyword ?? '');

  // Nine styles times four variations is thirty-six renders, so they are not run per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setKeyword(typed), TYPING_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const trimmed = keyword.trim();

  const rows = React.useMemo(() => {
    if (!trimmed) return [];

    return installedAvatarStyles().map((style) => ({
      id: style.id,
      name: style.name,
      // Shown beside the style name when the licence obliges it, so the author can see what
      // picking this one commits their project to BEFORE they pick it.
      credit: requiresAttribution(style.style?.meta?.license?.name)
        ? `${style.style.meta.creator} · ${style.style.meta.license?.name}`
        : undefined,
      avatars: Array.from({ length: AVATAR_VARIATIONS }, (_unused, variation) => {
        const seed = avatarSeed(trimmed, variation);
        return { variation, seed, svg: generateAvatar(style.id, seed) };
      }).filter((avatar) => Boolean(avatar.svg))
    }));
  }, [trimmed]);

  return (
    <div
      className="iconpicker-bg"
      style={{
        width: '470px',
        height: '370px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="iconpicker-header">
        <span className="iconpicker-label">Avatar picker</span>
      </div>

      <div
        className="iconpicker-search-header"
        style={{ display: 'flex', paddingRight: '5px', paddingTop: '5px', paddingBottom: '3px' }}
      >
        <div style={{ flexGrow: 0, width: '35px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <i style={{ verticalAlign: 'middle', margin: '0 auto' }} className="fa fa-search search-icon" />
        </div>
        <input
          className="iconpicker-search-input"
          data-test="avatar-picker-keyword"
          autoFocus
          placeholder="Name your creature — Nibbles, Bramble, Otto…"
          value={typed}
          style={{ width: '100%', height: '26px' }}
          onChange={(ev) => setTyped(ev.target.value)}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} data-test="avatar-picker-results">
        {trimmed === '' ? (
          <div className="iconpicker-empty">
            Type a name and every style below draws that creature. The same word always gives the same
            creature, so it stays theirs.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="iconpicker-iconset-header" style={{ marginTop: '2px', marginBottom: '2px' }}>
                <span className="iconpicker-label">{row.name}</span>
                {row.credit && <span className="avatarpicker-credit">{row.credit}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', paddingLeft: '12px', paddingBottom: '8px' }}>
                {row.avatars.map((avatar) => (
                  <span
                    key={row.id + '/' + avatar.variation}
                    className="avatarpicker-tile"
                    data-test={`avatar-${row.id}-${avatar.variation}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      onAvatarSelected({
                        styleId: row.id,
                        seed: avatar.seed,
                        variation: avatar.variation,
                        svg: avatar.svg as string
                      })
                    }
                  >
                    <Tooltip text={avatar.seed}>
                      <img
                        src={svgToDataUri(avatar.svg as string)}
                        alt={`${row.name} avatar for ${avatar.seed}`}
                        width={44}
                        height={44}
                        style={{ display: 'block' }}
                      />
                    </Tooltip>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="iconpicker-footer">
        Drawn on this machine — nothing is fetched, and the picture is saved into your project&rsquo;s{' '}
        <code>assets/</code> folder, so it keeps working with no network. Styles showing an artist are
        CC BY 4.0: picking one records the credit in <code>assets/IMAGE-CREDITS.md</code>, which needs to
        stay with anything you publish. The rest are public domain.
      </div>
    </div>
  );
}

export default AvatarPicker;
