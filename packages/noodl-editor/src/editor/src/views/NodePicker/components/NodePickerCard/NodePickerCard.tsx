import classNames from 'classnames';
import React, { useEffect, useRef } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { nodeIconName } from '../../NodePicker.icons';
import { PickerItem } from '../../NodePicker.search';
import css from './NodePickerCard.module.scss';

export interface NodePickerCardProps {
  item: PickerItem;
  /** The keyboard cursor is on this card. */
  isCursored?: boolean;

  onHover: (item: PickerItem) => void;
  onLeave: () => void;
  onClick: (item: PickerItem) => void;
}

/**
 * One node in the results grid (UIX-013).
 *
 * The card that replaces the saturated dark-navy block: a neutral surface with
 * a category-tinted glyph, which is what makes it legible on the light theme.
 * The tint is a CSS variable (`--cat`, see `styles/_tints.scss`), so a theme
 * flip re-colours it without a re-render.
 */
export function NodePickerCard({ item, isCursored, onHover, onLeave, onClick }: NodePickerCardProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // `nearest` rather than `center`: the cursor should stay put when it is
    // already on screen, otherwise every arrow press re-centres the whole grid.
    if (isCursored) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [isCursored]);

  const iconName = item.kind === 'action' ? IconName.Chat : nodeIconName(item.name);

  return (
    <button
      ref={ref}
      type="button"
      className={classNames(css['Root'], css[`Root--tint-${item.tint}`], isCursored && css['is-cursored'])}
      onMouseEnter={() => onHover(item)}
      onMouseLeave={onLeave}
      onClick={(event) => {
        event.stopPropagation();
        onClick(item);
      }}
      title={item.label}
      data-test={`node-picker-card-${item.name}`}
    >
      <span className={css['Glyph']}>
        {iconName ? <Icon icon={iconName} /> : <span className={css['GlyphLetter']}>{initialOf(item.label)}</span>}
      </span>

      <span className={css['Text']}>
        <span className={css['Name']}>{highlight(item)}</span>
        <span className={css['Meta']}>{item.meta}</span>
      </span>

      <span className={css['Enter']}>⏎</span>
    </button>
  );
}

/** Fallback glyph for the ~90% of node types with no icon of their own. */
function initialOf(label: string) {
  return (label.trim()[0] || '?').toUpperCase();
}

/** Mark the matched range of the name, so a result never looks arbitrary. */
function highlight(item: PickerItem) {
  if (!item.highlight) return item.label;

  const [start, end] = item.highlight;

  return (
    <>
      {item.label.slice(0, start)}
      <mark className={css['Mark']}>{item.label.slice(start, end)}</mark>
      {item.label.slice(end)}
    </>
  );
}
