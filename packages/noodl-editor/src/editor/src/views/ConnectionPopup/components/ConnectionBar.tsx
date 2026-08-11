import { nodeColorNameForModel, useNodeColorScheme } from '@noodl-hooks/useNodeColorScheme';
import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { KeyCode } from '@noodl-constants/KeyCode';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import {
  isPortConnectable,
  omitHiddenPorts,
  PORT_CONDITION_FILTER_MODES,
  type PortLike
} from '@noodl-models/nodelibrary/portConnectivity';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import css from '../ConnectionPopup.module.scss';
import { redirectOffer, TIMING_INTENT_ANSWER } from '../portCopy';
import {
  asRefusalReason,
  DEFAULT_GROUP_PRIORITY,
  isConfidentRedirect,
  orderGroups,
  OTHER_GROUP,
  rankAlternatives
} from '../refusalPlan';
import { answersTimingIntent } from '../searchIntent';
import { PortGroup } from './PortGroup';
import { RefusedPorts } from './RefusedPorts';

function _getPorts(type, model /* NodeGraphNode */) {
  // Annotated so `omitHiddenPorts`'s `T` has something to infer from. Left bare,
  // inference falls back to the generic's own constraint and every row narrows to
  // `{ name: string }`, which loses `group`, `displayName`, `tab`, `type` and `plug`.
  const declared: PortLike[] = type === 'from' ? model.getPorts('output') : model.getPorts('input');
  const models = [];

  /*
   * SPR-003 §1 (F82): both the predicate and the filter scope now come from
   * `portConnectivity`, which is the *only* place either is written down. This
   * function and `PortsTab.buildRows` were the two lists that disagreed —
   * a port marked `allowEditOnly` was missing here and unqualified there.
   *
   * `omitHiddenPorts` also returns a copy, where this used to `splice` the
   * array `getPorts()` handed back.
   */
  const hidden = NodeLibrary.instance.applyPortConditionsFilterForNode(model, PORT_CONDITION_FILTER_MODES);
  const ports = omitHiddenPorts(declared, hidden);

  for (const i in ports) {
    const p = ports[i];

    if (isPortConnectable(p)) {
      models.push({
        name: p.name,
        group: p.group,
        displayName: (p.displayName || p.name) + (p.tab && p.tab.label ? '(' + p.tab.label + ')' : ''), // Show the tab label in the connection editor
        annotatedName: NodeLibrary.instance.getAnnotatedPortName(model, p),
        type: p.type,
        // SIG-001: resolved once, here, because `refusalPlan` ranks on it and is
        // deliberately import-free — it takes the type *name* as data rather
        // than reaching for the library singleton to compute it.
        typeName: NodeLibrary.nameForPortType(p.type),
        plug: p.plug,
        section: type,
        parent: model
      });
    }
  }

  return models;
}

export function ConnectionBar(props: TSFixme) {
  const ports = _getPorts(props.type, props.model);
  const [selectedPort, setSelectedPort] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const searchRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const portAmount = useRef(0);

  /*
   * ⚠️ The search is cleared when the box loses focus, on a 200ms timer, and that
   * timer used to race the very click that was supposed to pick a port.
   *
   * `mousedown` on a port row blurs the input (rows are not focusable, so focus
   * falls to the body) and arms the reset. Hold the button for longer than 200ms
   * — a careful aim at a 22px row does it — and the reset lands *mid-gesture*:
   * the filter drops, every port comes back, the list re-lays-out under the
   * pointer, and `mouseup` happens over a different row. A `click` is dispatched
   * to the nearest common ancestor of the two, which is a wrapper with no
   * handler, so nothing is selected and the only visible effect is the search
   * having emptied itself. Exactly the "it treated my click as a click on empty
   * space" report.
   *
   * Two things stop it, and both are wanted on their own terms:
   *
   *  - the results area cancels the default of `mousedown`, so the search box
   *    never loses focus to the list and the reset is never armed. Keyboard
   *    navigation also survives a mouse click now, where before the first click
   *    left the arrow keys driving an unfocused field.
   *  - picking a port clears the search itself. That is the behaviour the timer
   *    was written for — a fresh box for the next connection — stated directly
   *    instead of arrived at by racing.
   */
  const searchResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function cancelSearchReset() {
    if (searchResetTimer.current === undefined) return;
    clearTimeout(searchResetTimer.current);
    searchResetTimer.current = undefined;
  }

  // Both popups stay mounted between connections, so a pending reset outliving
  // this render would clear a term typed after it was armed.
  useEffect(() => cancelSearchReset, []);

  const disabled = props.type === 'to' && (props.fromNode === undefined || props.sourcePort === undefined);
  // UIX-012: theme-derived (light + dark), re-resolved when the theme flips.
  const colors = useNodeColorScheme(nodeColorNameForModel(props.model));

  function focusSearch() {
    if (searchRef?.current && props.isActive) {
      searchRef.current.focus();
    }
  }

  useEffect(() => {
    focusSearch();
  }, [searchRef.current, props.isActive]);

  useEffect(() => {
    const eventGroup = {};

    EventDispatcher.instance.on(
      'Model.connectionAdded',
      () => {
        setSelectedPort(undefined);
      },
      eventGroup
    );

    return () => EventDispatcher.instance.off(eventGroup);
  });

  function moveCursor(amt) {
    if (!props.isActive) return;
    setCursorPosition((current) => {
      let newPos = current + amt;

      if (newPos < 0) newPos = 0;
      if (newPos > portAmount.current) newPos = portAmount.current;

      return newPos;
    });
  }

  function handleEnter() {
    if (!cursorPosition) return;
    if (!props.isActive) return;
    onPortClicked(flatPorts[cursorPosition - 1]);
    setCursorPosition(0);
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      switch (event.keyCode) {
        case KeyCode.Down:
          moveCursor(1);
          break;

        case KeyCode.Up:
          moveCursor(-1);
          break;

        case KeyCode.Enter:
          handleEnter();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cursorPosition, props.isActive]);

  // Update port state
  const sourcePort =
    props.type === 'to' && props.fromNode !== undefined && props.sourcePort !== undefined
      ? props.fromNode.getPort(props.sourcePort)
      : undefined;
  const sourceTypeName = sourcePort !== undefined ? NodeLibrary.nameForPortType(sourcePort.type) : undefined;
  /*
   * ⚠️ The *display* name, not `props.sourcePort`.
   *
   * A TextInput's string output is named `onTextChanged` and shown as **Text**.
   * Driven, the offer read "onTextChanged is already live" about a row the
   * builder had just clicked labelled "Text" — naming a port by an identifier
   * they have never seen, in the one sentence whose job is to be recognised.
   */
  const sourceDisplayName =
    sourcePort !== undefined ? sourcePort.displayName || sourcePort.name || props.sourcePort : undefined;

  if (sourcePort !== undefined) {
    ports.forEach((p) => {
      const status = props.model.owner.getConnectionStatus({
        sourceNode: props.fromNode,
        sourcePort: props.sourcePort,
        targetNode: props.model,
        targetPort: p.name
      });

      p.disabled = !status.connectable;
      p.message = status.message;
      // SIG-001: `getConnectionStatus` now attributes its refusals. Anything it
      // refuses without saying why is `'other'`, which `refusalPlan` reads as
      // "do not name a category" rather than guessing one.
      p.reason = status.connectable ? undefined : asRefusalReason(status.reason);

      // Make sure signals only can connect to input signals
      if (sourceTypeName === 'signal' && p.typeName !== '*' && p.typeName !== 'signal') {
        p.disabled = true;
        p.reason = 'signal-rule';
        p.message = 'Can only connect signal output to signal input';
      }
    });
  }

  /*
   * SIG-001 — group ports, and stop deleting the refused ones.
   *
   * This loop used to open `if (p.disabled) return;`, seven lines after the
   * block above wrote a full explanatory sentence into `p.message`. Both halves
   * of the refusal UI were built — `PortItem` renders `message` as a tooltip and
   * has a `'disabled'` state, `ConnectionPopup.module.scss` styles it — and they
   * had never met, because the only list that constructs a `PortItem` dropped
   * every port that would have used them.
   *
   * The cost of that `return` is that a refusal reads as an absence, and an
   * absence is unattributable: "the editor is protecting me from a category
   * error" and "this tool cannot do that" look identical. Both users this phase
   * is named for concluded the second.
   */
  const groups = [];

  ports.forEach((p) => {
    if (searchTerm) {
      if (p.displayName.toLowerCase().indexOf(searchTerm.toLowerCase()) === -1) return;
    }

    const name = p.group ? p.group : OTHER_GROUP;
    let g = groups.find((_g) => _g.name === name);
    if (!g) {
      g = { name: name, ports: [], refusedPorts: [] };
      groups.push(g);
    }

    // Refused ports are collected separately rather than interleaved: they
    // collapse behind one summary row, so a node with forty of them does not
    // bury the four that work (SIG-001 §2).
    if (p.disabled) g.refusedPorts.push(p);
    else g.ports.push(p);
  });

  // Move important groups to top
  const declaredGroupPriority: string[] =
    props.model.type.connectionPanel !== undefined && props.model.type.connectionPanel.groupPriority !== undefined
      ? props.model.type.connectionPanel.groupPriority
      : [...DEFAULT_GROUP_PRIORITY];

  /*
   * SIG-003 §3. This was three separate passes — reverse the priority list,
   * float each entry to the top one at a time, then splice `Other` to the end —
   * and between them there was no rule at all for a group the list did not name.
   * `orderGroups` is one comparator with the three tiers written down, and the
   * middle one (alphabetical) is the tier that did not previously exist.
   */
  const orderedGroups = orderGroups(groups, declaredGroupPriority);
  groups.length = 0;
  groups.push(...orderedGroups);

  // Keyboard navigation stays over the ports that can actually be connected:
  // arrowing onto a row whose only behaviour is to redirect you elsewhere would
  // make Enter mean two different things.
  const flatPorts = [];
  groups.forEach((g) => flatPorts.push(...g.ports));
  portAmount.current = flatPorts.length;

  const onPortClicked = (p) => {
    if (p.disabled) return;

    // The next connection starts from an empty box — said here rather than left
    // to the blur timer, which used to say it in the middle of this gesture.
    cancelSearchReset();
    setSearchTerm('');
    setCursorPosition(0);

    setSelectedPort(p.name);
    props.onPortSelected(p.name);
  };

  /*
   * SIG-001 §5 — offer the wire they meant.
   *
   * Ranked over the whole node, not over the filtered list: the alternative to a
   * refused signal input is a value input, and a builder who typed a search term
   * that matched neither should still be told which port to reach for.
   */
  /*
   * ⚠️ `usePortAsLabel` is the port the canvas paints as the node's label, and it
   * is the only place the library says which port a node is *about*. Without it
   * this ranking answers `Variant` for a String dragged at a Button — correct by
   * the stated rule (exact type, then group priority) and wrong to every human,
   * because `groupPriority` is a display order. `nodeDoubleClickAction.focusPort`
   * is the same claim made by a node that does not use it as its label.
   */
  const primaryPortName =
    props.model.type.usePortAsLabel ||
    (props.model.type.nodeDoubleClickAction && props.model.type.nodeDoubleClickAction.focusPort);

  const alternatives = sourceTypeName
    ? rankAlternatives(sourceTypeName, ports, declaredGroupPriority, primaryPortName)
    : [];

  /*
   * ⚠️ The click connects only when the offer *said* it would.
   *
   * The first build connected on `alternatives.length === 1` and scrolled
   * otherwise, while the copy promised a connection in both cases. Driven on a
   * TextInput — 90-odd connectable inputs — clicking "connect it to Label
   * instead" drew no wire. `isConfidentRedirect` is now the single condition
   * behind both the verb and the behaviour, so they cannot disagree again.
   */
  const confidentRedirect = sourceTypeName
    ? isConfidentRedirect(sourceTypeName, alternatives, primaryPortName)
    : false;

  const onRefusalClicked = () => {
    if (!confidentRedirect) return; // The offer is advisory, and says so.
    onPortClicked(alternatives[0]);
  };

  /*
   * ⚠️ SIG-001's grey wall, second form.
   *
   * A group whose ports are *all* refused has nothing to say beyond "and these
   * too". Driven with a signal output at a Text Input, every one of the node's
   * nineteen value groups was in that state, and the popup rendered nineteen
   * copies of "N value inputs · a signal is a moment, not a value" above the four
   * signal inputs that actually work. That is the wall the acceptance forbids,
   * rebuilt out of summary rows.
   *
   * So: a group keeps its own refused line only while it still has something
   * connectable in it — where the line is local context. Everything else folds
   * into one block at the end.
   */
  const mixedGroups = groups.filter((g) => g.ports.length > 0);
  const foldedRefusedPorts = groups.filter((g) => g.ports.length === 0).flatMap((g) => g.refusedPorts);

  const hasGroups = mixedGroups.length > 0 || foldedRefusedPorts.length > 0;

  /*
   * SIG-001 §3+§5 — the reason and the offer, once, where the eye lands first.
   *
   * Said once per *node* rather than once per group: a signal output dragged at
   * a Button refuses every value input it has, spread across ten headings, and
   * ten copies of "connect it to Label instead" is not ten times as helpful.
   *
   * It reads without hovering, which is the point — the sentence explaining this
   * refusal has existed in `p.message` all along, and it has only ever been
   * reachable by resting on a greyed row for a full second, on a list that never
   * rendered a greyed row.
   */
  const refusedCount = groups.reduce((total, g) => total + g.refusedPorts.length, 0);
  const offer =
    refusedCount > 0 && sourceTypeName !== undefined
      ? redirectOffer(sourceDisplayName, sourceTypeName, alternatives, confidentRedirect)
      : undefined;

  /*
   * SIG-002 §2 — the empty search that *is* the complaint.
   *
   * "I wanted to set the button label and there was no Set" is typed into this
   * box as `set`, `trigger` or `update`, and answered until now with "Can't find
   * any inputs". ⚠️ Only for the terms that mean it: an empty search for `xyzzy`
   * gets the ordinary empty state, because a tool that answers a question you
   * did not ask is noise the second time and distrust by the fifth.
   */
  const timingIntent = props.type === 'to' && answersTimingIntent(searchTerm, ports);

  /*
   * ⚠️ "Nothing matched" and a list of refused matches are contradictory, and
   * before SIG-001 they could not co-occur because refused ports were deleted.
   * They can now: search `do` on a Button mid-drag from a String and every match
   * is a signal input. The rows below say what happened; this line would say the
   * opposite of them.
   */
  const showsEmptyState = flatPorts.length === 0 && refusedCount === 0;
  const emptyMessage = !showsEmptyState
    ? undefined
    : searchTerm
      ? props.type === 'from'
        ? "Can't find any outputs"
        : "Can't find any inputs"
      : props.type === 'from'
        ? 'This node has no outputs'
        : 'This node has no inputs';

  return (
    <div
      style={{
        backgroundColor: colors.base,
        borderBottom: `1px solid ${colors.base}`,
        // @ts-expect-error CSS Variable
        '--local--port-hover-color': colors.baseHighlighted
      }}
      className={classNames([css.bar, disabled && css.disabled])}
    >
      <div
        className={css.searchContainer}
        style={{ borderBottom: `1px solid ${colors.base}`, backgroundColor: colors.header }}
        key="searchinput"
      >
        <Icon icon={IconName.Search} size={IconSize.Tiny} UNSAFE_className={css.searchIcon} />
        <input
          type="text"
          placeholder="Search"
          className={css.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            cancelSearchReset();
            setCursorPosition(0);
          }}
          onBlur={() => {
            cancelSearchReset();
            searchResetTimer.current = setTimeout(() => setSearchTerm(''), 200);
          }}
          ref={searchRef}
        />
      </div>

      {/*
        ⚠️ `preventDefault` on `mousedown`, so pressing a row does not move focus
        out of the search box. Without it the blur timer above is armed by the
        press and can fire before the release, re-filling the list under the
        pointer — see the note on `searchResetTimer`. It is on the results
        wrapper rather than the whole bar because the search box itself needs the
        default (caret placement, drag-select).
      */}
      <div onMouseDown={(e) => e.preventDefault()}>
        {/* Beside whatever the search did return, not instead of it: on a Button,
            `set` matches three shadow-offset ports, and a list of those is not an
            answer to "where is the Set?" — it just looks like one. */}
        {timingIntent ? (
          <div
            className={classNames(css.noPortsMessage, css.noPortsAnswer)}
            dangerouslySetInnerHTML={{ __html: TIMING_INTENT_ANSWER }}
          />
        ) : null}

        {emptyMessage !== undefined ? (
          <div className={css.noPortsMessage} dangerouslySetInnerHTML={{ __html: emptyMessage }} />
        ) : null}

        {offer ? (
          <div
            className={classNames(css.refusedOffer, offer.actionable && css.actionable)}
            onClick={offer.actionable ? onRefusalClicked : undefined}
            dangerouslySetInnerHTML={{ __html: offer.text }}
          />
        ) : null}

        {hasGroups ? (
          <div>
            {mixedGroups.map((g) => (
              <PortGroup
                key={g.name}
                colors={colors}
                expanded={true}
                onItemClicked={onPortClicked}
                onRefusalClicked={onRefusalClicked}
                canRedirect={Boolean(offer && offer.actionable)}
                group={g}
                selectedPort={selectedPort}
                highlightedPort={cursorPosition && flatPorts[cursorPosition - 1]?.name}
              />
            ))}

            <RefusedPorts
              ports={foldedRefusedPorts}
              colors={colors}
              canRedirect={Boolean(offer && offer.actionable)}
              onRefusalClicked={onRefusalClicked}
              showGroupNames
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
