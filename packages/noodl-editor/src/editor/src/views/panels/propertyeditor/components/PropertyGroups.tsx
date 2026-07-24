import classNames from 'classnames';
import React, { useLayoutEffect, useRef } from 'react';

export interface PropertyGroupModel {
  name: string;
  isExpanded: boolean;
  /** Row views belonging to the group — raw elements or jQuery-wrapped */
  els: TSFixme[];
}

export interface PropertyGroupsProps {
  groups: PropertyGroupModel[];
  /** When false the rows are rendered without group chrome (the single "Other" group case) */
  showHeaders: boolean;
}

/** Hosts row views built outside React, replacing whatever was there before. */
function RowHost({ els, className, style }: { els: TSFixme[]; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  // Layout effect so the rows are in place before paint — the property panel
  // measures them (popout anchoring, scroll restore) right after rendering.
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    els.forEach((el) => {
      el && container.appendChild(el);
    });
  }, [els]);

  return <div className={className} style={style} ref={ref} />;
}

/**
 * The property editor's group sections (legacy `group` template). Each group is
 * a label plus a container that hosts the group's row views.
 */
export function PropertyGroups({ groups, showHeaders }: PropertyGroupsProps) {
  if (!showHeaders) {
    return <RowHost els={groups[0] ? groups[0].els : []} />;
  }

  return (
    <>
      {groups.map((group) => (
        <div className="property-group" key={group.name}>
          <div style={{ display: 'inline-flex' }}>
            <div className="property-group-label" style={{ height: 30, position: 'relative', flexShrink: 1 }}>
              <label style={{ marginLeft: 10, lineHeight: '30px' }}>{group.name}</label>
            </div>
          </div>

          <RowHost
            els={group.els}
            className={classNames('properties', !group.isExpanded && 'hidden')}
            style={{ paddingBottom: 10 }}
          />
        </div>
      ))}
    </>
  );
}
