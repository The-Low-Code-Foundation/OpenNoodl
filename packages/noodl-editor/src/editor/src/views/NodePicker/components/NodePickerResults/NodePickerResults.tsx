import React, { CSSProperties } from 'react';

import { NodePickerCard } from '../NodePickerCard';
import { PickerGroup, PickerItem } from '../../NodePicker.search';
import css from './NodePickerResults.module.scss';

export interface NodePickerResultsProps {
  groups: PickerGroup[];
  cursorKey: string | null;
  /** Grid width; the keyboard cursor moves by this many cards on `↑↓`. */
  columns: number;

  onHover: (item: PickerItem) => void;
  onLeave: () => void;
  onSelect: (item: PickerItem) => void;
}

/**
 * The results grid (UIX-013).
 *
 * Browsing groups by sub-category, searching groups by category with the
 * best-ranked group first — either way every group is open. There is no
 * expanded/collapsed state left to render, which is the point.
 */
export function NodePickerResults({
  groups,
  cursorKey,
  columns,
  onHover,
  onLeave,
  onSelect
}: NodePickerResultsProps) {
  return (
    <div className={css['Root']}>
      {groups.map((group) => (
        <section key={group.key} className={css['Group']}>
          <div className={css['GroupHead']}>
            <h3 className={css['GroupTitle']}>{group.title}</h3>
            <span className={css['GroupCount']}>{group.items.length}</span>
            <span className={css['GroupRule']} />
          </div>

          <div className={css['Grid']} style={{ '--picker-columns': columns } as CSSProperties}>
            {group.items.map((item) => (
              <NodePickerCard
                key={item.key}
                item={item}
                isCursored={item.key === cursorKey}
                onHover={onHover}
                onLeave={onLeave}
                onClick={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
