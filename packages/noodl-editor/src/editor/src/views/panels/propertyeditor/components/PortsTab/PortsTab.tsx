import React, { useEffect, useMemo, useState } from 'react';

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import {
  isPortConnectable,
  omitHiddenPorts,
  PORT_CONDITION_FILTER_MODES
} from '@noodl-models/nodelibrary/portConnectivity';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';

import { connectablePortTypes, TypecastRule } from '../../portTypes';
import { getPortConnections, PortConnectionRef } from '../../utils';
import css from './PortsTab.module.scss';

/**
 * FH-020 — the read-only port explorer.
 *
 * ## Why this reads the ports itself
 *
 * ⚠️ It must **not** use `Ports._getPorts()`, the natural-looking function next
 * door. That returns `getPorts('input')` filtered to ports that are not
 * `allowConnectionsOnly` *and* have a property-row view class — i.e. exactly the
 * set with property rows, which excludes every signal, every connection-only
 * port and all 100% of outputs. It is the set this tab exists to escape.
 *
 * The one filter that *is* applied is `applyPortConditionsFilterForNode`: a
 * `conditionalports/*` rule is a filter over statically declared ports (see
 * `dynamicPortRules.ts`), so a port whose condition is currently false is still
 * in `getPorts()` while not actually being on this node. Listing it would tell
 * an author about a port that is not there.
 *
 * ⚠️ SPR-003 §1 (F82) changed the *scope* of that call, and the change is not
 * cosmetic. It used to pass no modes — the property panel's scope, which also
 * applies `conditionalports/basic` rules — on the reasoning that the two tabs
 * should agree. They should, but about the right question: the panel is
 * choosing which property **rows** to draw, this tab is describing the node's
 * **ports**, and `NodeGraphModel.isConnectionValid` decides a port is not on the
 * node using `['extended']` alone. So this now passes
 * `PORT_CONDITION_FILTER_MODES`, the same constant the connection popup passes.
 *
 * ## Not every port can be wired
 *
 * A port whose declared type carries `allowEditOnly: true` is a **setting**: it
 * is real, it holds a value, it has a property row, and the canvas refuses to
 * connect it. 139 declarations across the runtime and the viewer say so, and
 * they cluster in the nodes a beginner meets first. Those rows stay — a beginner
 * needs to know `Treat Unchanged as` exists — but they carry a marker and lose
 * the "Accepts …" line, because both of those claim a wire is possible.
 * `isPortConnectable` is the shared predicate; see `portConnectivity.ts`.
 *
 * ## Read-only
 *
 * Nothing here writes a parameter, adds a connection, or marks the project
 * dirty. The only interaction is a chip that calls `editor.selectNode` — it
 * moves the canvas selection, which is a view state, and is the "take me to the
 * connected node" half of what was asked for.
 */

interface PortRow {
  key: string;
  displayName: string;
  group: string;
  typeName: string;
  typeLabel: string;
  isSignal: boolean;
  /** False for an `allowEditOnly` port: a setting the canvas will not wire. */
  isConnectable: boolean;
  description?: string;
  connections: PortConnectionRef[];
}

interface PortGroupRows {
  group: string;
  rows: PortRow[];
}

/** How many enum values are spelled out before the list is trimmed. */
const MAX_ENUM_VALUES = 8;

function typeLabelFor(type: TSFixme): string {
  const name = NodeLibrary.nameForPortType(type) || 'unknown';
  if (typeof type !== 'object' || type === null || name !== 'enum' || !Array.isArray(type.enums)) return name;

  // Spelled out the way `DocsPopup` does, trimmed because a font-weight enum is
  // longer than the row it sits in.
  const values = type.enums.map((e: TSFixme) => (typeof e === 'object' && e !== null ? e.label : e));
  const shown = values.slice(0, MAX_ENUM_VALUES).join(', ');
  return values.length > MAX_ENUM_VALUES ? `enum: ${shown}, …` : `enum: ${shown}`;
}

function buildRows(model: NodeGraphNode, direction: 'input' | 'output'): PortGroupRows[] {
  const hidden = NodeLibrary.instance.applyPortConditionsFilterForNode(model, PORT_CONDITION_FILTER_MODES);

  const groups: PortGroupRows[] = [];

  for (const port of omitHiddenPorts(model.getPorts(direction) as TSFixme[], hidden)) {
    const typeName = NodeLibrary.nameForPortType(port.type);
    const tabSuffix = port.tab && port.tab.label ? ` (${port.tab.label})` : '';

    const row: PortRow = {
      key: `${direction}-${port.name}`,
      displayName: (port.displayName || port.name) + tabSuffix,
      group: port.group || 'Other',
      typeName,
      typeLabel: typeLabelFor(port.type),
      isSignal: typeName === 'signal',
      isConnectable: isPortConnectable(port),
      description:
        typeof port.description === 'string' && port.description.trim() !== '' ? port.description : undefined,
      connections: getPortConnections(model, port.name, direction)
    };

    // Ports arrive sorted by their declared index, so first-seen group order is
    // the order the node declares — the same order the property panel shows.
    const existing = groups.find((g) => g.group === row.group);
    if (existing) existing.rows.push(row);
    else groups.push({ group: row.group, rows: [row] });
  }

  // "Other" is the fallback bucket, not a section anyone named. It goes last.
  const otherIndex = groups.findIndex((g) => g.group === 'Other');
  if (otherIndex !== -1) groups.push(groups.splice(otherIndex, 1)[0]);

  return groups;
}

/** The "what it accepts" annotation: a verb and the types, or nothing to say. */
function acceptsLineFor(typeName: string, direction: 'input' | 'output'): { verb: string; types: string } | undefined {
  const typecasts: readonly TypecastRule[] = (NodeLibrary.instance as TSFixme).library?.typecasts || [];
  const types = connectablePortTypes(typecasts, typeName, direction);

  const verb = direction === 'input' ? 'Accepts' : 'Connects to';
  if (types === undefined) return { verb, types: 'any type' };

  // Its own type is always first and is already on the row, so a one-element
  // list says nothing the type chip did not.
  if (types.length <= 1) return undefined;

  return { verb, types: types.join(', ') };
}

function ConnectionChip({ direction, connection }: { direction: 'input' | 'output'; connection: PortConnectionRef }) {
  return (
    <button type="button" className={css['Chip']} onClick={connection.navigate} title="Select this node on the canvas">
      <span className={css['ChipDirection']}>{direction === 'input' ? 'from' : 'to'}</span>
      <span className={css['ChipLabel']}>{connection.label}</span>
    </button>
  );
}

function PortRowView({ row, direction }: { row: PortRow; direction: 'input' | 'output' }) {
  // SPR-003 §1: "Accepts number, string" on a port no wire can reach is the
  // false half of the sentence, so an edit-only row does not get one.
  const accepts = row.isConnectable ? acceptsLineFor(row.typeName, direction) : undefined;

  return (
    <div className={css['Row']}>
      <div className={css['RowHead']}>
        {row.isSignal && (
          <span className={css['SignalIcon']}>
            {/* UIX-010: `IconSize` is inert, so the size is explicit — same as `PortItem.tsx`. */}
            <Icon icon={IconName.Lightning} UNSAFE_style={{ width: 13, height: 13 }} />
          </span>
        )}
        <span className={css['Name']}>{row.displayName}</span>
        <span className={css['Type']}>{row.typeLabel}</span>
      </div>

      {!row.isConnectable && (
        <p className={css['NotConnectable']}>
          <Icon icon={IconName.Setting} UNSAFE_style={{ width: 12, height: 12 }} />
          <span>Setting — set here, cannot be connected</span>
        </p>
      )}

      {Boolean(row.description) && <p className={css['Description']}>{row.description}</p>}
      {Boolean(accepts) && (
        <p className={css['Accepts']}>
          <span className={css['AcceptsLabel']}>{accepts.verb}</span> {accepts.types}
        </p>
      )}

      {/*
       * An edit-only port with no connections says nothing here: the marker
       * above has already said why, and "Nothing drives this yet" reads as an
       * invitation. If a legacy project *does* hold a wire to one, the chips
       * still show — that is the truth and the author needs to see it.
       */}
      {(row.connections.length > 0 || row.isConnectable) && (
        <div className={css['Connections']}>
          {row.connections.length > 0 ? (
            row.connections.map((connection, index) => (
              <ConnectionChip key={`${connection.label}-${index}`} direction={direction} connection={connection} />
            ))
          ) : (
            <span className={css['NoConnections']}>
              {direction === 'input' ? 'Nothing drives this yet' : 'Nothing reads this yet'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PortSection({
  title,
  direction,
  groups,
  emptyText
}: {
  title: string;
  direction: 'input' | 'output';
  groups: PortGroupRows[];
  emptyText: string;
}) {
  const count = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <section className={css['Section']}>
      <h2 className={css['SectionTitle']}>
        {title}
        <span className={css['SectionCount']}>{count}</span>
      </h2>

      {count === 0 && <p className={css['Empty']}>{emptyText}</p>}

      {groups.map((group) => (
        <React.Fragment key={group.group}>
          <h3 className={css['GroupTitle']}>{group.group}</h3>
          {group.rows.map((row) => (
            <PortRowView key={row.key} row={row} direction={direction} />
          ))}
        </React.Fragment>
      ))}
    </section>
  );
}

export interface PortsTabProps {
  model: NodeGraphNode;
}

export function PortsTab({ model }: PortsTabProps) {
  /*
   * The panel outlives any single edit, so the list has to follow the node.
   * `Ports.bindModel`'s set, plus two this tab needs and it does not:
   * `parametersChanged`, because a parameter is what flips a `conditionalports`
   * condition and this list is filtered by exactly that, and `portRearranged`,
   * because the rows are in declared order.
   */
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!model) return;

    const group = {};
    const bump = () => setRevision((r) => r + 1);

    model.on(
      [
        'instancePortsChanged',
        'parametersChanged',
        'portAdded',
        'portRemoved',
        'portRenamed',
        'portRearranged',
        'variantChanged',
        'variantUpdated'
      ],
      bump,
      group
    );

    /*
     * Graph-level, because every chip names a *different* node: a wire added or
     * cut anywhere, a node deleted out from under a chip, or a connection
     * re-pointed at another port all change what this list says. `labelChanged`
     * is deliberately absent — a node only raises it on itself, the graph never
     * forwards it, so subscribing here would be a listener that never fires.
     */
    const owner = model.owner;
    owner &&
      owner.on(
        ['connectionAdded', 'connectionRemoved', 'connectionUpdated', 'connectionPortChanged', 'nodeRemoved'],
        bump,
        group
      );

    return () => {
      model.off(group);
      owner && owner.off(group);
    };
  }, [model]);

  const inputs = useMemo(() => (model ? buildRows(model, 'input') : []), [model, revision]);
  const outputs = useMemo(() => (model ? buildRows(model, 'output') : []), [model, revision]);

  if (!model) return null;

  return (
    <ScrollArea>
      <div className={css['Root']}>
        <p className={css['Intro']}>
          Every port on this node, whether or not it has a property. Read-only — connect ports on the canvas.
        </p>

        <PortSection title="Inputs" direction="input" groups={inputs} emptyText="This node has no inputs." />
        <PortSection title="Outputs" direction="output" groups={outputs} emptyText="This node has no outputs." />
      </div>
    </ScrollArea>
  );
}
