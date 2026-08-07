/**
 * TagPill Component
 *
 * Displays a tag as a small colored pill/badge.
 * Used to show project tags in cards and lists.
 */

import React from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';

import { Tag } from '../../hooks/useProjectOrganization';
import css from './TagPill.module.scss';

export enum TagPillSize {
  Small = 'small',
  Medium = 'medium'
}

export interface TagPillProps {
  /** The tag data to display */
  tag: Tag;
  /** Size variant */
  size?: TagPillSize;
  /** Whether to show remove button */
  removable?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Callback when pill is clicked */
  onClick?: () => void;
  /** Custom className */
  className?: string;
}

/**
 * TagPill - Displays a tag as a colored pill badge
 *
 * @example
 * ```tsx
 * <TagPill
 *   tag={{ id: '1', name: 'Frontend', color: '#3B82F6' }}
 *   size={TagPillSize.Small}
 * />
 * ```
 */
export function TagPill({
  tag,
  size = TagPillSize.Medium,
  removable = false,
  onRemove,
  onClick,
  className
}: TagPillProps) {
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const handlePillClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      className={`${css.Root} ${css[`Size-${size}`]} ${onClick ? css.Clickable : ''} ${className || ''}`}
      style={{ backgroundColor: tag.color }}
      onClick={handlePillClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <Label size={size === TagPillSize.Small ? LabelSize.Small : LabelSize.Default} UNSAFE_className={css.Label}>
        {tag.name}
      </Label>

      {removable && (
        <button
          className={css.RemoveButton}
          onClick={handleRemoveClick}
          aria-label={`Remove ${tag.name} tag`}
          type="button"
        >
          <Icon icon={IconName.Close} size={size === TagPillSize.Small ? IconSize.Tiny : IconSize.Small} />
        </button>
      )}
    </div>
  );
}
