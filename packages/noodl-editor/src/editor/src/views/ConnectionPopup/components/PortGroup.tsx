import classNames from 'classnames';
import React from 'react';

import css from '../ConnectionPopup.module.scss';
import { PortItem } from './PortItem';
import { RefusedPorts } from './RefusedPorts';

export function PortGroup(props: TSFixme) {
  // comments in this component is to remove the group folding.
  // delete the commented code if no-one misses the foldability
  //const [expanded, setExpanded] = useState(props.expanded);

  const colors = props.colors;

  /*
   * SIG-001 §2 — this group's refused ports, closed by default.
   *
   * A beginner has to see that the category *exists* and was ruled out; they do
   * not have to read forty grey lines to learn it. One line, expandable.
   *
   * ⚠️ Only groups that still have something connectable get one of these. A
   * group where *everything* was refused is folded into a single block at the
   * end of the list by `ConnectionBar` — see `RefusedPorts` for the 19-identical-
   * summaries defect that forced the split.
   *
   * ⚠️ The *offer* ("connect it to Label instead") is deliberately not here
   * either. It is a fact about the node, not about this group, and rendering it
   * per group repeats it once per heading.
   */
  return (
    <div>
      <div
        style={{ backgroundColor: colors.header, borderBottom: `1px solid ${colors.base}` }}
        className={classNames(css.listElementGroup, css.enabled)}
        //onClick={() => !allPortsDisabled && setExpanded(!expanded)}
      >
        <div className={css.groupLabel}>{props.group.name}</div>
        {/* <div>
          <i className={`fa ${expanded ? 'fa-caret-up' : 'fa-caret-down'}`} />
        </div> */}
      </div>
      {props.group.ports.map((p) => (
        <PortItem
          key={p.name}
          colors={colors}
          onClick={() => props.onItemClicked(p)}
          isSelected={props.selectedPort === p.name || p.name === props.highlightedPort}
          port={p}
        />
      ))}

      <RefusedPorts
        ports={props.group.refusedPorts || []}
        colors={colors}
        canRedirect={props.canRedirect}
        onRefusalClicked={props.onRefusalClicked}
      />
    </div>
  );
}
