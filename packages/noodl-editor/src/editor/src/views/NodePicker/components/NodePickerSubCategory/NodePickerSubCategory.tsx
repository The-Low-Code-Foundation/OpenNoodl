import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import React, { ReactNode } from 'react';
import css from './NodePickerSubCategory.module.scss';

interface NodePickerSubCategoryProps {
  title: string;
  children: ReactNode;
}

export default function NodePickerSubCategory({ title, children }: NodePickerSubCategoryProps) {
  return (
    <div>
      {title !== '' && (
        <div className={css['Title']}>
          <Text textType={TextType.Shy} size={TextSize.Small}>
            {title}
          </Text>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
