import { CustomPropertyAnimation, useCustomPropertyValue } from '@noodl-hooks/useCustomPropertyValue';
import classNames from 'classnames';
import React, { ReactNode, useEffect, useState } from 'react';

import { NodeType } from '@noodl-constants/NodeType';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Collapsible } from '@noodl-core-ui/components/layout/Collapsible';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize, TitleVariant } from '@noodl-core-ui/components/typography/Title';

import css from './NodePickerCategory.module.scss';

interface NodePickerCategoryProps {
  title: string;
  description: string;
  type?: NodeType | NodeColor;
  children: ReactNode;

  isKeyboardCursored?: boolean;
  isCollapsed?: boolean;

  /** Header click. Must dispatch to the picker's reducer — see below. */
  onToggleCollapsed?: () => void;

  disableTransition?: boolean;
}

export default function NodePickerCategory({
  title,
  description,
  children,
  type = NodeType.Visual,

  isKeyboardCursored,
  isCollapsed,

  onToggleCollapsed,

  disableTransition
}: NodePickerCategoryProps) {
  const transitionSpeed = useCustomPropertyValue(CustomPropertyAnimation.SpeedQuick);
  const descriptionEasingFunction = useCustomPropertyValue(CustomPropertyAnimation.EasingEqual);
  const [isHighlightedState, setIsHighlightedState] = useState(isKeyboardCursored);

  // UIX-012: `isCollapsed` is now read straight from the prop — it used to be
  // mirrored into local state that only the header click wrote to, so a click
  // silently desynced this component from `cursorState.allCategories` and the
  // programmatic expand-on-search could no longer move it. The reducer owns
  // collapsed state; this component only reports the click.
  const isCollapsedState = isCollapsed;

  useEffect(() => {
    setIsHighlightedState(isKeyboardCursored);
  }, [isKeyboardCursored]);

  function addHighlight() {
    setIsHighlightedState(true);
  }

  function removeHighlight() {
    setIsHighlightedState(false);
  }

  return (
    <section
      className={classNames(
        css['Root'],
        css[`Root--is-theme-${type}`],
        isHighlightedState && css['Root--is-highlighted']
      )}
      onMouseEnter={addHighlight}
      onMouseLeave={removeHighlight}
    >
      <header
        className={classNames([css['Header'], css[`Header--is-theme-${type}`]])}
        onClick={() => onToggleCollapsed && onToggleCollapsed()}
      >
        <Title variant={TitleVariant.Highlighted} size={TitleSize.Medium}>
          {title}
        </Title>

        <Collapsible
          isCollapsed={!isCollapsedState}
          transitionMs={transitionSpeed * 0.5}
          disableTransition={disableTransition}
          easingFunction={descriptionEasingFunction}
        >
          <Text textType={TextType.Default} size={TextSize.Medium}>
            {description}
          </Text>
        </Collapsible>

        <Icon
          icon={IconName.CaretRight}
          size={IconSize.Small}
          UNSAFE_className={classNames([
            css['Arrow'],
            isCollapsedState ? css['Arrow--is-collapsed'] : css['Arrow--is-not-collapsed']
          ])}
        />
      </header>

      <Collapsible isCollapsed={isCollapsedState} transitionMs={transitionSpeed} disableTransition={disableTransition}>
        <div>{children}</div>
      </Collapsible>
    </section>
  );
}
