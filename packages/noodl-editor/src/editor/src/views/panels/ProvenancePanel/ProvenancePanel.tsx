import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { NodeGraphContextTmp } from '../../../contexts/NodeGraphContext/NodeGraphContext';
import { LIVE_POLL_MS, TraceSession } from '../../../utils/provenance/TraceSession';
import { annotateWarnings } from '../../../utils/provenance/annotateWarnings';
import { editorDiagnoses } from '../../../utils/provenance/editorDiagnoses';
import {
  clearPendingProvenanceWalk,
  takePendingProvenanceWalk
} from '../../../utils/provenance/provenanceRequest';
import {
  EdgeRef,
  RootEvent,
  WalkFoundation,
  WalkResult,
  WalkRow,
  backwardWalk,
  buildIndex,
  describeFoundation,
  describeNode,
  explainTerminus,
  forwardWalk,
  labelFor,
  portsToResolve,
  rootEvents,
  valueKey
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
 *  - **layer 3, diagnosis** — node-local invariant warnings (OBS-003). Needs nothing at all:
 *    `WarningsModel` already holds every diagnosis the running preview has reported, so a walk
 *    on a cold editor still carries them. Filled by `annotateWarnings`, outside the pure engine.
 */
export function ProvenancePanel() {
  const session = TraceSession.instance;

  const [target, setTarget] = useState<EdgeRef | undefined>(undefined);
  const [focusedRoot, setFocusedRoot] = useState<RootEvent | undefined>(undefined);
  /**
   * The expanded row, held as a **port key** rather than as the `WalkRow` object.
   *
   * ⚠️ Rows are rebuilt from scratch on every Refresh and every trace event, and a causal hop's
   * `id` carries the event `seq`, so it changes with them. Holding the object kept a row whose
   * values had already gone stale — the detail said `0` while the row above it said `1` — and
   * holding the id silently collapsed the expansion on every refresh. `node|port|direction` is
   * the one identity that survives a rewalk, and it is unique within a walk: the structural
   * expansion is keyed by exactly this and refuses to visit a port twice.
   */
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [recording, setRecording] = useState(session.recording);
  const [revision, setRevision] = useState(0);
  /** Bumped on `warningsChanged`, so layer 3 re-annotates without rebuilding the index. */
  const [warningsRevision, setWarningsRevision] = useState(0);
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

  // Diagnoses arrive on their own schedule — a node reports one the moment its input changes,
  // which is not a topology change, an event or a port value. Without this the panel would show
  // whatever was live when the walk was built and would silently go stale, including after the
  // author has *fixed* the thing the row is accusing them of.
  useEffect(() => {
    const group = {};
    WarningsModel.instance.on('warningsChanged', () => setWarningsRevision((r) => r + 1), group);
    return () => {
      WarningsModel.instance.off(group);
    };
  }, []);

  // ⚠️ `hasTrace`, not `recording`. Pressing **Stop** does not un-record what was recorded, and
  // passing `recording` here meant it did: every ✕ in the walk reverted to `·` the instant the
  // recording finished, i.e. exactly when the user turns back to read it. See `TraceSession`.
  const index = useMemo(
    () => buildIndex(session.topology, session.traceEvents, session.portValues, { recording: session.hasTrace }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, revision, recording]
  );

  /**
   * Pull the topology, then the current value of every port the walk could show.
   *
   * Two round trips rather than one per row: `portsToResolve` computes the whole set from the
   * topology before anything is rendered, so a ten-row walk costs one request.
   */
  const load = useCallback(
    async (next: EdgeRef, options?: { quiet?: boolean; skipEvents?: boolean }) => {
      const say = (message?: string) => {
        if (!options?.quiet) setStatus(message);
      };

      say('Reading the graph…');
      await session.refreshTopology();
      // `skipEvents` is for the walk-refresh timer below: the session polls the buffer itself
      // now, so pulling it here as well would be two requests a tick for the same bytes.
      if (session.recording && !options?.skipEvents) await session.refreshEvents();

      const scratch = buildIndex(session.topology, session.traceEvents, session.portValues, {
        recording: session.hasTrace
      });
      const ports = portsToResolve(scratch, next);
      say(`Reading ${ports.length} port${ports.length === 1 ? '' : 's'}…`);
      await session.resolvePortValues(ports);

      say(undefined);
      bump();
    },
    [session, bump]
  );

  /**
   * Keep the *walk* current while a recording is running — the topology and the per-row current
   * values. The events themselves are pulled by `TraceSession`'s own timer.
   *
   * ⚠️ **A walk on screen when Record is pressed turns every row into `✕ never fired`, and it
   * stays that way through the interaction it was recording.** Nothing has fired *yet*, so the
   * glyphs are momentarily true — and then the user reproduces the bug, watches the app do the
   * thing, and the panel still says the chain never fired. Reported from a live run: *"the
   * repeater shows everything with an X. If you click refresh, it shows the two items with green
   * ticks correctly."* A debugger that has to be told to look is one whose ✕ cannot be believed,
   * and `the ✓/✕ boundary is the bug` is the entire claim of this panel.
   *
   * ⚠️ **The event pull used to live here, gated on this same `target`, and that was FH-011.**
   * A walk had to be on screen for anything to read the runtime's buffer at all, so the flow
   * the feature was specified for — Record, click the app, Stop — pulled nothing, ever, and
   * showed an empty panel. The timer that keeps the *recording* alive belongs to the session
   * (and now is: no panel needs to be open, or even constructed, for a recording to fill).
   * This one is only about the rows this panel is currently drawing.
   */
  useEffect(() => {
    if (!recording || !target) return;

    let inFlight = false;
    const timer = setInterval(() => {
      // A tick can outlive its interval: every pull has a 2s deadline, and a preview that has
      // gone away takes all of it. Overlapping loads would queue requests faster than they
      // resolve and each one rebuilds the index.
      if (inFlight) return;
      inFlight = true;
      void load(target, { quiet: true, skipEvents: true }).finally(() => {
        inFlight = false;
      });
    }, LIVE_POLL_MS);

    return () => clearInterval(timer);
  }, [recording, target, load]);

  // The entry point. Both right-click surfaces go through `requestProvenanceWalk`; nothing else
  // drives the panel, so there is no selection listener to race with.
  //
  // ⚠️ **The request that arrives before this effect runs is the one that matters.** A right-click
  // has to switch the sidebar to get here, and the panel does not mount until it does — so the
  // very first "Why is this empty?" of a session fired into no listener at all and opened the
  // panel on its own placeholder. `takePendingProvenanceWalk` claims it on mount; the listener
  // clears it so a live request is never also replayed.
  useEffect(() => {
    const group = {};
    const start = (ref: EdgeRef) => {
      setFocusedRoot(undefined);
      setSelectedKey(undefined);
      setTarget(ref);
      void load(ref);
    };

    EventDispatcher.instance.on(
      'provenance:walk',
      (ref: EdgeRef) => {
        clearPendingProvenanceWalk();
        start(ref);
      },
      group
    );

    const pending = takePendingProvenanceWalk();
    if (pending) start(pending);

    return () => EventDispatcher.instance.off(group);
  }, [load]);

  const walk: WalkResult | undefined = useMemo(() => {
    // ⚠️ `previewRunning` is not decoration. The engine holds a topology and never a connection,
    // so without this a walk over the graph a since-closed preview reported reads exactly like a
    // walk over a live one — same rows, same values, all frozen. Only the editor knows.
    const result = focusedRoot
      ? forwardWalk(index, focusedRoot.event)
      : target
        ? backwardWalk(index, target, { previewRunning: session.isPreviewRunning })
        : undefined;
    // Layer 3, after the engine and never inside it — `walkEngine` stays import-free so it can
    // be bundled into `nodegx-observe` unchanged, and it cannot reach the editor's models.
    if (result) annotateWarnings(index.topology, result, editorDiagnoses);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, target, focusedRoot, warningsRevision]);

  const roots = useMemo(() => (session.traceEvents.length ? rootEvents(index) : []), [index, session.traceEvents.length]);

  /**
   * The editor's own label for the node that was asked about.
   *
   * ⚠️ Only the editor can supply this, and only in the one state where it matters. The engine
   * names nodes from the runtime dictionary, and `node-absent` means the dictionary has no
   * entry — so `labelFor` falls back to the raw id, which is what made `Node: filterCollection`
   * and `Node id: filterCollection` the sole, unexplained tell of a walk that could not run.
   * The project has the label whether or not the runtime instantiated the node.
   */
  const targetLabel = useMemo(() => {
    if (!target) return undefined;
    try {
      return ProjectModel.instance?.findNodeWithId(target.node)?.label || undefined;
    } catch (e) {
      return undefined;
    }
  }, [target, revision]);

  // States A and B are not results, so their row tree is not one either — a single row under a
  // sentence saying the walk could not run reads as "and here is what it found".
  const blocked = walk ? isBlocked(walk.foundation) : false;

  /**
   * ⚠️ **There is no Record button here any more — HUD-001 / TALK-003 Q1.**
   *
   * Record is a canvas control now, and the product split is the reason: this panel answers
   * questions about wiring, the HUD watches the app run. Arming a recorder from inside a
   * question-answering panel was the thing that made Record feel vestigial, and it had a
   * mechanical cost too — `SidePanel` does not *construct* a panel until it is first opened,
   * so the recorder's only surface did not exist for a user who had never opened this one.
   *
   * What stays is Refresh: it is the manual pull, and FH-011 made it rarely needed rather than
   * useless. `recording` is still read here — the walk on screen has to keep up with a
   * recording somebody armed on the canvas — it is simply no longer armed from here.
   */
  const handleRefresh = useCallback(async () => {
    setStatus('Pulling events…');
    await session.refreshEvents();
    if (target) await load(target);
    setStatus(undefined);
    bump();
  }, [session, target, load, bump]);

  /**
   * Reveal — "just go here, look at this".
   *
   * Following glowing connectors across hundreds of nodes in separate components is hopeless,
   * so the walk *names* the failing node and this jumps to it.
   *
   * ⚠️ **This is not what a click on a row does, and used to be.** Revealing selects the node,
   * and selecting a node switches the sidebar to the property editor — so every click on a row
   * replaced the panel with the property panel before the row's detail could be read. Layer 3,
   * the whole of OBS-003, lives in that detail: the difference between a walk that says *"it
   * stopped here"* and one that says *"it stopped here, **and this is why**"*. It was
   * unreachable by the only gesture anyone tries.
   *
   * Both actions are wanted — Richard asked for the jump explicitly — so they are two gestures:
   * click expands, the arrow jumps.
   */
  const reveal = useCallback((row: WalkRow) => {
    const node = ProjectModel.instance?.findNodeWithId(row.ref.node);
    if (!node) return;
    const component = node.owner?.owner;
    if (!component || !NodeGraphContextTmp.switchToComponent) return;
    NodeGraphContextTmp.switchToComponent(component, { node, pushHistory: true });
  }, []);

  // Toggling rather than setting: the row is a disclosure, and a disclosure that cannot be
  // closed leaves the detail of whatever was last clicked wedged into the middle of the list.
  const handleRowClick = useCallback((row: WalkRow) => {
    const key = valueKey(row.ref, row.direction);
    setSelectedKey((current) => (current === key ? undefined : key));
  }, []);

  return (
    <BasePanel title="Provenance" isFill hasContentScroll={false}>
      <div className={css.Root}>
        <div className={css.Toolbar}>
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

        {!target && !focusedRoot && (
          <EmptyState
            roots={roots}
            index={index}
            onPick={setFocusedRoot}
            recording={recording}
            eventCount={session.traceEvents.length}
          />
        )}

        {walk && (
          <>
            <WalkSummary walk={walk} index={index} targetLabel={targetLabel} />
            {!blocked && (
              <div className={css.Rows}>
                <RowTree
                  row={walk.root}
                  index={index}
                  boundary={new Set(walk.boundary.map((b) => b.id))}
                  selectedKey={selectedKey}
                  onClick={handleRowClick}
                  onReveal={reveal}
                />
              </div>
            )}
          </>
        )}
      </div>
    </BasePanel>
  );
}

/**
 * Whether the walk's rows describe the user's graph at all — POL-010.
 *
 * `port-unwired` is deliberately *not* blocked: the root row is the port that was asked about,
 * and showing it beside "nothing feeds it" is the answer. The other two have nothing truthful
 * to render.
 */
function isBlocked(foundation: WalkFoundation): boolean {
  return foundation.kind === 'no-graph' || foundation.kind === 'node-absent';
}

/**
 * The one-line answer, above the rows.
 *
 * Stated in words rather than left for the user to infer from glyphs, because "the ✓/✕ boundary
 * is the bug" is only true if the user does not have to find the boundary.
 *
 * ⚠️ **The foundation is checked before anything else, and it has to be.** The `!hasTrace`
 * branch below is correct about the trace and blind to everything else, so on a cold editor it
 * swallowed all four of POL-010's states into one sentence — measured live before the fix: four
 * states, two sentences, and the two differed only by a row count. A summary that is true of
 * the walk and false about the graph is the failure this whole panel exists to avoid.
 */
function WalkSummary({
  walk,
  index,
  targetLabel
}: {
  walk: WalkResult;
  index: ReturnType<typeof buildIndex>;
  targetLabel?: string;
}) {
  const boundary = walk.boundary[0];
  const foundation = describeFoundation(index, walk.foundation, { nodeLabel: targetLabel });

  let message: string;
  if (foundation && isBlocked(walk.foundation)) {
    // States A and B. There is no walk to summarise, and saying so *is* the summary.
    message = foundation;
  } else if (foundation && !index.hasTrace) {
    // State C on a cold editor. "No recording" is true here too, but "nothing is wired to this
    // port" is what the user came to find out, and no recording will ever reveal it.
    message = foundation;
  } else if (!index.hasTrace) {
    // ⚠️ Do not say "every hop carried a value" here. With no recording, no hop has a firing
    // status at all — every row is `unknown` — and claiming they all carried something is a
    // confident wrong answer of exactly the kind that got the last panel retired. Observed
    // live: this branch fired on a cold editor and asserted the opposite of what it knew.
    message = 'No recording. Showing each hop\u2019s current value; press Record to see which one never fired.';
  } else if (!boundary) {
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
      {/* ⚠️ Not printed when the walk was blocked. "1 row · declared wires" under a sentence
          saying the walk could not run is the exact contradiction this task is about — and it
          was the *only* difference between three of the four states before the fix. */}
      {!isBlocked(walk.foundation) && (
        <Text textType={TextType.Shy}>
          {walk.rowCount} row{walk.rowCount === 1 ? '' : 's'} ·{' '}
          {walk.mode === 'causal' ? 'cause chain' : 'declared wires'}
        </Text>
      )}
    </div>
  );
}

/**
 * How far a row of a given depth is inset, in pixels.
 *
 * ⚠️ **Capped, because the walk's depth is unbounded and the panel's width is not.** The indent
 * used to be `depth × 14` with no ceiling, and the walk's own depth limit is 24 — so a long
 * chain marched 336px to the right inside a ~280px panel and pushed the timestamps of the
 * deepest rows, the ones nearest the cause, off the edge where they could not be scrolled to.
 * Observed on a six-hop demo, which is not a long chain.
 *
 * The information lost is small and the causal mode loses none at all: a cause chain is linear
 * by construction, so every row past the cap sits under exactly one parent and the nesting says
 * nothing the row order does not.
 */
const INDENT_STEP = 10;
const INDENT_MAX_DEPTH = 6;

function indentFor(depth: number): number {
  return Math.min(depth, INDENT_MAX_DEPTH) * INDENT_STEP;
}

function RowTree({
  row,
  index,
  boundary,
  selectedKey,
  onClick,
  onReveal
}: {
  row: WalkRow;
  index: ReturnType<typeof buildIndex>;
  boundary: Set<string>;
  selectedKey?: string;
  onClick(row: WalkRow): void;
  onReveal(row: WalkRow): void;
}) {
  const info = describeNode(index, row.ref.node);
  const isBoundary = boundary.has(row.id);
  const isSelected = selectedKey === valueKey(row.ref, row.direction);

  const glyph = row.status === 'fired' ? '✓' : row.status === 'never-fired' ? '✕' : '·';
  const glyphClass =
    row.status === 'fired' ? css.StatusFired : row.status === 'never-fired' ? css.StatusNever : css.StatusUnknown;

  return (
    <>
      <div
        className={classNames(css.Row, isBoundary && css.RowBoundary, isSelected && css.RowSelected)}
        style={{ paddingLeft: 10 + indentFor(row.depth) }}
        onClick={() => onClick(row)}
        role="button"
        tabIndex={0}
        title={isSelected ? 'Hide details' : 'Show details'}
      >
        <span className={classNames(css.Status, glyphClass)}>{glyph}</span>
        {/* Both of these ellipsise — the row holds a whole hop in one line and the panel is
            narrow — so each carries its own text as a tooltip. The full value is in the detail
            below; the label's is not anywhere else. */}
        <span className={css.Label} title={labelFor(index, row.ref)}>
          {labelFor(index, row.ref)}
        </span>
        {info.component && <span className={css.Component}>{info.component}</span>}
        <span className={css.Value} title={row.event?.value ?? row.currentValue ?? ''}>
          {row.event?.value ?? row.currentValue ?? ''}
        </span>
        {/* ⚠️ The list used to give no hint that a row carried a diagnosis — layer 3 only
            appeared once a row was clicked, so the one row with an answer on it looked exactly
            like the five without. Named as an open question when the demo was written; this is
            the answer. */}
        {row.warnings.length > 0 && (
          <span className={css.Warned} title={row.warnings.join('\n')}>
            ⚠
          </span>
        )}
        <span className={css.Meta}>{metaFor(row)}</span>
        <span
          className={css.Reveal}
          role="button"
          tabIndex={0}
          title="Show this node on the canvas"
          onClick={(e) => {
            // Without this the row's own handler also runs and the detail toggles on the way
            // out — the panel is about to be replaced by the property editor, so the user would
            // come back to a row expanded (or collapsed) by a click they aimed elsewhere.
            e.stopPropagation();
            onReveal(row);
          }}
        >
          ↗
        </span>
      </div>
      {isSelected && <RowDetail row={row} index={index} depth={row.depth} />}
      {row.truncated === 'cycle' && (
        <div className={css.Note} style={{ paddingLeft: 24 + indentFor(row.depth) }}>
          ↺ loops back
        </div>
      )}
      {row.truncated === 'depth' && (
        <div className={css.Note} style={{ paddingLeft: 24 + indentFor(row.depth) }}>
          … more upstream not shown
        </div>
      )}
      {row.children.map((child) => (
        <RowTree
          key={child.id}
          row={child}
          index={index}
          boundary={boundary}
          selectedKey={selectedKey}
          onClick={onClick}
          onReveal={onReveal}
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

/**
 * The expanded row.
 *
 * Rendered **under the row it belongs to**, not in a fixed pane at the foot of the panel. The
 * fixed pane was the shape that survived while a click also jumped to the node: with the detail
 * far from the row, and the row selection invisible by the time you looked, it read as a
 * separate readout rather than as this row's answer.
 */
function RowDetail({ row, index, depth }: { row: WalkRow; index: ReturnType<typeof buildIndex>; depth: number }) {
  const info = describeNode(index, row.ref.node);
  return (
    <div className={css.Detail} style={{ marginLeft: 10 + indentFor(depth) }}>
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
        <div key={i} className={css.DetailWarning}>
          ⚠ {warning}
        </div>
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
  onPick,
  recording,
  eventCount
}: {
  roots: RootEvent[];
  index: ReturnType<typeof buildIndex>;
  onPick(root: RootEvent): void;
  recording: boolean;
  eventCount: number;
}) {
  return (
    <div className={css.Empty}>
      {/* ⚠️ **A count of zero is a result, and it has to look like one.** While a recording is
          armed this panel showed the same two lines of instructions it shows on a cold editor,
          so "recording, nothing has fired yet" and "not recording at all" were the same
          screen — and the user reading it had just pressed Record and clicked their app. The
          count is pulled every 1.5s whether or not anything is on screen (FH-011), so it is a
          live number, and a live zero is the honest answer to "did my click do anything?". */}
      {recording && (
        <>
          <Text>
            Recording — {eventCount} event{eventCount === 1 ? '' : 's'} so far
          </Text>
          {eventCount === 0 && (
            <Text textType={TextType.Shy}>
              Nothing has fired yet. Use the app in the preview; this updates about once a second.
            </Text>
          )}
        </>
      )}
      {/* ⚠️ **This sentence has to say WHERE Record is.** It used to say "press Record" while
          the button was six pixels above it; HUD-001 moved that button onto the canvas, and a
          user reading the old sentence inside this panel would look for a control that is no
          longer there — which is worse than no instruction at all. */}
      {!recording && (
        <>
          <Text textType={TextType.Shy}>
            Right-click a port on the canvas and choose <b>Why is this empty?</b> to walk backwards from it.
          </Text>
          <Text textType={TextType.Shy}>
            Current values work with a preview running and nothing recorded. To see which hop never fired, press{' '}
            <b>Record</b> on the canvas — the pill at the bottom of the node graph — reproduce the problem, then walk.
          </Text>
        </>
      )}
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
