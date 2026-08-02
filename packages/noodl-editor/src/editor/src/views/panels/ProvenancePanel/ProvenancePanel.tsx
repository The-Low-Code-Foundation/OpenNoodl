import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { NodeGraphContextTmp } from '../../../contexts/NodeGraphContext/NodeGraphContext';
import { TraceSession } from '../../../utils/provenance/TraceSession';
import {
  EdgeRef,
  RootEvent,
  WalkResult,
  WalkRow,
  backwardWalk,
  buildIndex,
  describeNode,
  explainTerminus,
  forwardWalk,
  labelFor,
  portsToResolve,
  rootEvents
} from '../../../utils/provenance/walkEngine';
import css from './ProvenancePanel.module.scss';

/**
 * OBS-002 — "Why is this empty?"
 *
 * The product of phase 36. The user always knows the **symptom** and never knows the middle;
 * this panel refuses to make them search the middle. Right-click a port, walk backwards through
 * the connections, annotate each hop with whatever is known. The ✓/✕ boundary is the bug.
 *
 * ⚠️ **This panel does not compute anything.** Every question it answers is answered by
 * `utils/provenance/walkEngine`, which is pure and unit-tested without Electron. That is a
 * direct response to how the retired Data Lineage panel failed: its tracer ran off canvas
 * selection and context-menu events, so half its bugs were "panel shows *No node selected*"
 * races that had nothing to do with lineage. Anything here that looks like analysis is a bug.
 *
 * The three annotation layers, and what each needs:
 *
 *  - **layer 1, provenance** — each hop's *current* value. Needs a preview running and nothing
 *    else. Works on a cold editor where nothing has fired, which is the whole reason this is
 *    not gated behind Record.
 *  - **layer 2, temporality** — fired / never fired / fired N times. Needs a recording.
 *  - **layer 3, diagnosis** — node-local invariant warnings. Arrives with OBS-003; the row
 *    shape already carries the field so the panel does not change shape underneath it.
 */
export function ProvenancePanel() {
  const session = TraceSession.instance;

  const [target, setTarget] = useState<EdgeRef | undefined>(undefined);
  const [focusedRoot, setFocusedRoot] = useState<RootEvent | undefined>(undefined);
  const [selected, setSelected] = useState<WalkRow | undefined>(undefined);
  const [recording, setRecording] = useState(session.recording);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<string | undefined>(undefined);

  // A counter rather than the arrays themselves: the session mutates in place and React would
  // not see a new reference, and copying a 250k-event buffer per render is exactly the cost
  // this whole design exists to avoid.
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    const group = {};
    session.on(['topologyChanged', 'eventsChanged', 'portValuesChanged'], bump, group);
    session.on('recordingChanged', () => setRecording(session.recording), group);
    return () => {
      session.off(group);
    };
  }, [session, bump]);

  const index = useMemo(
    () => buildIndex(session.topology, session.traceEvents, session.portValues),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, revision]
  );

  /**
   * Pull the topology, then the current value of every port the walk could show.
   *
   * Two round trips rather than one per row: `portsToResolve` computes the whole set from the
   * topology before anything is rendered, so a ten-row walk costs one request.
   */
  const load = useCallback(
    async (next: EdgeRef) => {
      setStatus('Reading the graph…');
      await session.refreshTopology();
      if (session.recording) await session.refreshEvents();

      const scratch = buildIndex(session.topology, session.traceEvents, session.portValues);
      const ports = portsToResolve(scratch, next);
      setStatus(`Reading ${ports.length} port${ports.length === 1 ? '' : 's'}…`);
      await session.resolvePortValues(ports);

      setStatus(undefined);
      bump();
    },
    [session, bump]
  );

  // The entry point. Both right-click surfaces emit this; nothing else drives the panel, so
  // there is no selection listener to race with.
  useEffect(() => {
    const group = {};
    EventDispatcher.instance.on(
      'provenance:walk',
      (ref: EdgeRef) => {
        setFocusedRoot(undefined);
        setSelected(undefined);
        setTarget(ref);
        void load(ref);
      },
      group
    );
    return () => EventDispatcher.instance.off(group);
  }, [load]);

  const walk: WalkResult | undefined = useMemo(() => {
    if (focusedRoot) return forwardWalk(index, focusedRoot.event);
    if (!target) return undefined;
    return backwardWalk(index, target);
  }, [index, target, focusedRoot]);

  const roots = useMemo(() => (session.traceEvents.length ? rootEvents(index) : []), [index, session.traceEvents.length]);

  const handleRecord = useCallback(() => {
    if (session.recording) {
      session.stop();
    } else {
      session.start();
      setSelected(undefined);
    }
  }, [session]);

  const handleRefresh = useCallback(async () => {
    setStatus('Pulling events…');
    await session.refreshEvents();
    if (target) await load(target);
    setStatus(undefined);
    bump();
  }, [session, target, load, bump]);

  /**
   * Click-to-reveal.
   *
   * "Just go here, look at this" is a click at the end, not a hunt — following glowing
   * connectors across hundreds of nodes in separate components is hopeless, so the walk
   * *names* the failing node and this jumps to it.
   */
  const reveal = useCallback((row: WalkRow) => {
    const node = ProjectModel.instance?.findNodeWithId(row.ref.node);
    if (!node) return;
    const component = node.owner?.owner;
    if (!component || !NodeGraphContextTmp.switchToComponent) return;
    NodeGraphContextTmp.switchToComponent(component, { node, pushHistory: true });
  }, []);

  const handleRowClick = useCallback(
    (row: WalkRow) => {
      setSelected(row);
      reveal(row);
    },
    [reveal]
  );

  return (
    <BasePanel title="Provenance" isFill hasContentScroll={false}>
      <div className={css.Root}>
        <div className={css.Toolbar}>
          <PrimaryButton
            label={recording ? 'Stop' : 'Record'}
            size={PrimaryButtonSize.Small}
            variant={recording ? PrimaryButtonVariant.Danger : PrimaryButtonVariant.Cta}
            onClick={handleRecord}
          />
          <PrimaryButton
            label="Refresh"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            isDisabled={!session.isPreviewRunning}
            onClick={handleRefresh}
          />
          {focusedRoot && (
            <PrimaryButton
              label="Back to walk"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={() => setFocusedRoot(undefined)}
            />
          )}
        </div>

        {status && (
          <div className={css.Summary}>
            <Text textType={TextType.Shy}>{status}</Text>
          </div>
        )}

        {!target && !focusedRoot && <EmptyState roots={roots} index={index} onPick={setFocusedRoot} />}

        {walk && (
          <>
            <WalkSummary walk={walk} index={index} />
            <div className={css.Rows}>
              <RowTree
                row={walk.root}
                index={index}
                boundary={new Set(walk.boundary.map((b) => b.id))}
                selectedId={selected?.id}
                onClick={handleRowClick}
              />
            </div>
            {selected && <RowDetail row={selected} index={index} />}
          </>
        )}
      </div>
    </BasePanel>
  );
}

/**
 * The one-line answer, above the rows.
 *
 * Stated in words rather than left for the user to infer from glyphs, because "the ✓/✕ boundary
 * is the bug" is only true if the user does not have to find the boundary.
 */
function WalkSummary({ walk, index }: { walk: WalkResult; index: ReturnType<typeof buildIndex> }) {
  const boundary = walk.boundary[0];

  let message: string;
  if (!boundary) {
    message =
      walk.mode === 'causal'
        ? `Traced back ${walk.rowCount - 1} hop${walk.rowCount === 2 ? '' : 's'} to a root event.`
        : 'Every hop upstream carried a value.';
  } else if (walk.mode === 'causal') {
    message = explainTerminus(index, boundary) ?? `${labelFor(index, boundary.ref)} is where the chain ends.`;
  } else if (boundary.children.length === 0) {
    message = `${labelFor(index, boundary.ref)} never fired, and nothing feeds it.`;
  } else {
    message = `${labelFor(index, boundary.ref)} was reached and emitted nothing.`;
  }

  return (
    <div className={css.Summary}>
      <Text>{message}</Text>
      <Text textType={TextType.Shy}>
        {walk.rowCount} row{walk.rowCount === 1 ? '' : 's'} · {walk.mode === 'causal' ? 'cause chain' : 'declared wires'}
      </Text>
    </div>
  );
}

function RowTree({
  row,
  index,
  boundary,
  selectedId,
  onClick
}: {
  row: WalkRow;
  index: ReturnType<typeof buildIndex>;
  boundary: Set<string>;
  selectedId?: string;
  onClick(row: WalkRow): void;
}) {
  const info = describeNode(index, row.ref.node);
  const isBoundary = boundary.has(row.id);

  const glyph = row.status === 'fired' ? '✓' : row.status === 'never-fired' ? '✕' : '·';
  const glyphClass =
    row.status === 'fired' ? css.StatusFired : row.status === 'never-fired' ? css.StatusNever : css.StatusUnknown;

  return (
    <>
      <div
        className={classNames(css.Row, isBoundary && css.RowBoundary, selectedId === row.id && css.RowSelected)}
        style={{ paddingLeft: 10 + row.depth * 14 }}
        onClick={() => onClick(row)}
        role="button"
        tabIndex={0}
      >
        <span className={classNames(css.Status, glyphClass)}>{glyph}</span>
        <span className={css.Label}>{labelFor(index, row.ref)}</span>
        {info.component && <span className={css.Component}>{info.component}</span>}
        <span className={css.Value}>{row.event?.value ?? row.currentValue ?? ''}</span>
        <span className={css.Meta}>{metaFor(row)}</span>
      </div>
      {row.truncated === 'cycle' && <div className={css.Note} style={{ paddingLeft: 24 + row.depth * 14 }}>↺ loops back</div>}
      {row.truncated === 'depth' && (
        <div className={css.Note} style={{ paddingLeft: 24 + row.depth * 14 }}>
          … more upstream not shown
        </div>
      )}
      {row.children.map((child) => (
        <RowTree
          key={child.id}
          row={child}
          index={index}
          boundary={boundary}
          selectedId={selectedId}
          onClick={onClick}
        />
      ))}
    </>
  );
}

/**
 * The right-hand column of a row.
 *
 * ⚠️ An edge that fired 100 times is **one row saying so**, not a hundred rows. That is the
 * single case that would otherwise reintroduce the wall of rows the shelved panel drowned in,
 * and a repeater over a collection produces it every time.
 */
function metaFor(row: WalkRow): string {
  if (row.status === 'never-fired') return 'never fired';
  if (row.status === 'unknown') return '';
  if (row.fireCount > 1) return `fired ${row.fireCount}× · ${timeOf(row)}`;
  return `fired · ${timeOf(row)}`;
}

function timeOf(row: WalkRow): string {
  if (!row.event) return '';
  const d = new Date(row.event.t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function RowDetail({ row, index }: { row: WalkRow; index: ReturnType<typeof buildIndex> }) {
  const info = describeNode(index, row.ref.node);
  return (
    <div className={css.Detail}>
      <Detail label="Node" value={info.name || info.type} />
      <Detail label="Type" value={info.type} />
      <Detail label="Component" value={info.component} />
      <Detail label="Port" value={`${row.ref.port} (${row.direction})`} />
      {/* The node id is here for one reason: it gives the user a handle to hand to an agent —
          "check node abc123 for me". That makes it part of the OBS-004 story, not decoration. */}
      <Detail label="Node id" value={row.ref.node} />
      <Detail label="Current" value={row.currentValue ?? '—'} />
      {row.event && <Detail label="Last value" value={row.event.value} />}
      {row.fireCount > 0 && <Detail label="Fired" value={`${row.fireCount}×`} />}
      {row.warnings.map((warning, i) => (
        <Detail key={i} label="⚠" value={warning} />
      ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className={css.DetailRow}>
      <span className={css.DetailKey}>{label}</span>
      <span className={css.DetailValue}>{value}</span>
    </div>
  );
}

/**
 * What the panel says before a walk is started.
 *
 * Doubles as the forward-walk surface: the root list is short by construction (a click makes
 * one root and a cascade of hundreds of descendants), so listing roots is what keeps this a
 * handful of rows rather than the firehose.
 */
function EmptyState({
  roots,
  index,
  onPick
}: {
  roots: RootEvent[];
  index: ReturnType<typeof buildIndex>;
  onPick(root: RootEvent): void;
}) {
  return (
    <div className={css.Empty}>
      <Text textType={TextType.Shy}>
        Right-click a port on the canvas and choose <b>Why is this empty?</b> to walk backwards from it.
      </Text>
      <Text textType={TextType.Shy}>
        Current values work with a preview running and nothing recorded. Press <b>Record</b>, reproduce the problem,
        then walk to see which hop never fired.
      </Text>
      {roots.length > 0 && (
        <>
          <Text>Recorded interactions</Text>
          {roots.slice(0, 20).map((root) => (
            <div key={root.event.seq} className={css.Row} onClick={() => onPick(root)} role="button" tabIndex={0}>
              <span className={classNames(css.Status, css.StatusFired)}>→</span>
              <span className={css.Label}>{labelFor(index, root.event.from)}</span>
              <span className={css.Meta}>
                {root.size} event{root.size === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
