/**
 * TabBar - Modern horizontal tab navigation component
 *
 * A clean, accessible tab bar for switching between views.
 * Supports keyboard navigation, icons, and state persistence.
 *
 * @module noodl-core-ui/components/layout
 */

import classNames from 'classnames';
import React, { useEffect, useRef } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { UnsafeStyleProps } from '@noodl-core-ui/types/global';

import css from './TabBar.module.scss';

export interface TabBarItem {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  testId?: string;
}

export interface TabBarProps extends UnsafeStyleProps {
  items: TabBarItem[];
  activeItemId: string;
  onChange: (itemId: string) => void;
  /**
   * Size variant for the tab bar
   */
  size?: 'small' | 'medium' | 'large';
}

export function TabBar({
  items,
  activeItemId,
  onChange,
  size = 'medium',
  UNSAFE_className,
  UNSAFE_style
}: TabBarProps) {
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (event: React.KeyboardEvent, currentIndex: number) => {
    const enabledItems = items.filter((item) => !item.disabled);
    const currentEnabledIndex = enabledItems.findIndex((item) => item.id === items[currentIndex].id);

    let newIndex = currentEnabledIndex;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentEnabledIndex > 0 ? currentEnabledIndex - 1 : enabledItems.length - 1;
        break;
      case 'ArrowRight':
        event.preventDefault();
        newIndex = currentEnabledIndex < enabledItems.length - 1 ? currentEnabledIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = enabledItems.length - 1;
        break;
      default:
        return;
    }

    const newItem = enabledItems[newIndex];
    if (newItem) {
      onChange(newItem.id);
      tabRefs.current[newItem.id]?.focus();
    }
  };

  return (
    <div
      className={classNames(css['Root'], css[`is-size-${size}`], UNSAFE_className)}
      style={UNSAFE_style}
      role="tablist"
      aria-label="Main navigation"
    >
      {items.map((item, index) => {
        const isActive = item.id === activeItemId;
        const isDisabled = item.disabled;

        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[item.id] = el;
            }}
            className={classNames(css['Tab'], {
              [css['is-active']]: isActive,
              [css['is-disabled']]: isDisabled
            })}
            onClick={() => !isDisabled && onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={isDisabled}
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            data-test={item.testId}
          >
            {item.icon && (
              <span className={css['Tab-icon']}>
                <Icon icon={item.icon} />
              </span>
            )}
            <span className={css['Tab-label']}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
