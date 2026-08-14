/**
 * BEN-004 — The bench stage: one component, on a surface that is visibly a bench.
 *
 * This is the second mode of the *one* preview surface (R1). It is not a panel,
 * it is not a document, and it is not a route — it renders in the same box the
 * app preview renders in, and the app preview is still alive behind it (R3,
 * owned by `VisualCanvas`).
 *
 * ## What makes it unmistakable (R2)
 *
 * The app preview is a checkerboarded canvas with the viewer filling it. The
 * bench is a flat stage, a different colour, with the component inset at a
 * width you chose and a visible frame edge around it. That difference is
 * readable across the room and it survives a screenshot with the window title
 * cropped out, which is the acceptance criterion. A badge would not.
 *
 * ## What it deliberately does not do
 *
 * It does not wrap the component in a Group sized to the frame. The frame is
 * the size of the *surface* — this webview element — because `sizeMode`
 * silently voids `width`/`height` and an unsized absolute Group fills its
 * parent (phase-55 F7), so a graph-level wrapper that gets either wrong makes a
 * correct component look broken inside the tool built to say whether it is. See
 * register B3; `buildBenchExport` carries `frame`/`stretch` through for exactly
 * this surface to apply, and applying it here means the width is *measurable*
 * in the rendered document rather than inferred from a parameter.
 *
 * ⚠️ `frame` and `stretch` are **not** passed to `buildBenchExport`. They never
 * reach the export JSON — they are echoed on its result for a caller that wants
 * one object — and making them build inputs would put a reload on the frame
 * control: a changed export makes the runtime call `location.reload()` and
 * destroys every bit of state the user just clicked into. Resizing a frame must
 * not do that.
 *
 * @module noodl-editor/views/VisualCanvas/ComponentBench
 */

import { useThrottle } from '@noodl-hooks/useThrottleState';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  benchComponent,
  benchInstanceUsage,
  benchInterfaceFor,
  buildBenchExport,
  type AgentSampleData,
  type BenchExport,
  type BenchInterface
} from '@noodl-models/AiAssistant/authoring';
import { ProjectModel } from '@noodl-models/projectmodel';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { useTrackBounds } from '@noodl-core-ui/hooks/useTrackBounds';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import { SandboxDataEditor } from '../documents/AuthoringPreviewDocument/SandboxDataEditor';
import { SandboxToolbar, SANDBOX_PARTITION, SANDBOX_WEBVIEW_ATTRIBUTES, useSandboxViewer } from '../SandboxSurface';
import { benchParameterContent, benchSignalContents } from './benchInputs';
import { BenchInputsRail } from './BenchInputsRail';
import { BenchOutputsRail } from './BenchOutputsRail';
import { BenchScenarioBar } from './BenchScenarioBar';
import {
  BENCH_SCENARIOS_KEY,
  applyBenchScenario,
  benchScenarioApplyNotice,
  benchScenarioFrame,
  benchScenarioFrom,
  benchScenarioIsModified,
  benchScenarioStore,
  moveBenchScenario,
  readBenchScenarios,
  removeBenchScenario,
  renameBenchScenario,
  uniqueBenchScenarioName,
  upsertBenchScenario,
  type BenchScenario
} from './benchScenarios';
import css from './ComponentBench.module.scss';
import { DEFAULT_BENCH_FRAME, resolveBenchWidth, type BenchFrame } from './previewScope';
import { useBenchOutputs } from './useBenchOutputs';

export interface ComponentBenchProps {
  /** Legacy name of the component to mount. */
  target: string;
  frame: BenchFrame;
  /**
   * Set the frame — the *only* caller is a scenario being applied (BEN-005).
   *
   * The frame's own control lives in the chrome strip above this surface and
   * writes the same state directly; this exists because a scenario records the
   * width it was saved at, and "renders correctly at 320" is part of what a
   * scenario claims. Optional so the bench still mounts without it.
   */
  onFrameChange?: (frame: BenchFrame) => void;
  /**
   * The frame's **measured** box, reported up for the strip's read-out.
   *
   * Measured rather than echoed back, because the stage has padding and a frame
   * can be wider than the stage — so the number the user typed is not
   * necessarily the number the component got, and the read-out that says
   * otherwise is the defect this whole phase is about.
   */
  onFrameMeasured?: (size: { width: number; height: number } | undefined) => void;
}

export function ComponentBench({ target, frame, onFrameChange, onFrameMeasured }: ComponentBenchProps) {
  const [useSampleData, setUseSampleData] = useState(true);
  /** POL-008: signed in by default — see `SandboxPreview` for the whole reason. */
  const [signedIn, setSignedIn] = useState(true);
  /** BEN-006: the records the user typed. Preview state, never project state (R5). */
  const [userData, setUserData] = useState<AgentSampleData | undefined>(undefined);
  const [dataOpen, setDataOpen] = useState(false);
  const [result, setResult] = useState<BenchExport | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  /**
   * BEN-002 — the values the user has set on the mounted component's inputs.
   *
   * Preview state, never project state (R5), like everything else on this
   * surface. An absent key means *unset*, which is not the same as set to
   * nothing: the harness then falls back to the port's derived default, exactly
   * as a page that left the port unwired would.
   */
  const [inputs, setInputs] = useState<Record<string, unknown>>({});

  /**
   * The export is a snapshot of the project taken when it was built, so an edit
   * to the mounted component does not reach the bench on its own.
   *
   * It rebuilds on the topbar's existing Refresh instead of on a new signal of
   * its own: R1 says one preview surface, and a surface with a second refresh
   * button that means something slightly different is the confusion this phase
   * is about.
   *
   * ⚠️ **"The export" is the part that needs a Refresh — not the component.**
   * The bench sends *its own* parameter updates to *its own* client (B2), which
   * is the opposite direction and does not follow the project's stream. But the
   * running bench still *receives* that stream like any other viewer, because
   * its export contains the component being edited — so editing the mounted
   * component in the graph reaches it without a Refresh, and `liveInterface`
   * below keeps the rail in step with it. What a Refresh is still for is
   * everything the export froze that no delta describes: a component the
   * closure did not reach, a changed dataset, a new global style.
   */
  useEffect(() => {
    const eventGroup = {};
    EventDispatcher.instance.on('viewer-refresh', () => setRevision((n) => n + 1), eventGroup);
    return () => EventDispatcher.instance.off(eventGroup);
  }, []);

  /**
   * ⚠️ **The export must not be rebuilt when an input changes**, which is why
   * this is a ref and not a dependency.
   *
   * A changed export makes the runtime call `location.reload()`. Rebuilding per
   * keystroke would flash the preview on every letter and throw away the open
   * dropdown, the hover state, the half-filled form — the state someone opened
   * the bench to look at. Values reach the running component as targeted
   * `modelUpdate`s instead (B2). The ref still carries them into the *next*
   * rebuild, whenever one happens for an honest reason, so a Refresh or a data
   * change does not silently blank the rail's work.
   */
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  // A different component has a different interface, so the previous one's
  // values are not merely stale, they name ports that do not exist. Declared
  // before the build effect so the clear lands first on a target change.
  useEffect(() => {
    inputsRef.current = {};
    setInputs({});
  }, [target]);

  useEffect(() => {
    if (!ProjectModel.instance) {
      setResult(undefined);
      return;
    }
    setResult(
      buildBenchExport({
        project: ProjectModel.instance,
        target,
        inputs: inputsRef.current,
        userData,
        useSampleData,
        signedIn
      })
    );
  }, [target, userData, useSampleData, signedIn, revision]);

  /**
   * The mounted component's interface, kept current while its graph is edited.
   *
   * The point of the bench is to change the component and watch what happens,
   * and until this existed the *rail* was the one thing that could not: it was
   * built once with the export, so a port added to the `Component Inputs` node
   * did not appear until a Refresh, while the running preview had already been
   * told about it. The graph edit reaches the runtime on the editor's ordinary
   * broadcast `modelUpdate` stream — the bench's export contains the component
   * being edited, so it applies the delta like any other viewer.
   *
   * ⚠️ **Re-derived, never rebuilt.** Rebuilding the export would reload the
   * window and throw away exactly the state someone is mid-way through
   * inspecting; `benchInterfaceFor` is one `getPorts()` call and reloads
   * nothing.
   *
   * ⚠️ **The identity is held stable when nothing changed**, and that is
   * load-bearing rather than an optimisation. `Model.parametersChanged` fires
   * on every keystroke anywhere in the editor, and each row's draft state is
   * reset by an effect keyed on `port` — so handing the rail a fresh object per
   * event would wipe whatever the user was typing into it from a property edit
   * three panels away.
   */
  const [liveInterface, setLiveInterface] = useState<BenchInterface | undefined>(undefined);

  const refreshInterface = useCallback(() => {
    const next = ProjectModel.instance ? benchInterfaceFor(ProjectModel.instance, target) : undefined;
    setLiveInterface((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }, [target]);

  useEffect(() => {
    refreshInterface();
  }, [refreshInterface, revision]);

  useEffect(() => {
    const eventGroup = {};
    // Everything `getPorts()` reads: the declared ports themselves, and the
    // connections and parameters it derives type and default from.
    EventDispatcher.instance.on(
      [
        'Model.portAdded',
        'Model.portRemoved',
        'Model.nodePortRenamed',
        'Model.instancePortsChanged',
        'Model.connectionAdded',
        'Model.connectionRemoved',
        'Model.connectionPortChanged',
        'Model.nodeAdded',
        'Model.nodeRemoved',
        'Model.parametersChanged'
      ],
      refreshInterface,
      eventGroup
    );
    return () => EventDispatcher.instance.off(eventGroup);
  }, [refreshInterface]);

  /**
   * The export's interface is the fallback for one render only — the effect
   * above has not run yet on the very first commit, and an empty rail that
   * fills in a frame later reads as a component with no inputs.
   */
  const iface = liveInterface ?? result?.interface;

  /**
   * Bumped only by a Reset that cannot be expressed as a value. See
   * {@link resetInput} and `useSandboxViewer`'s `remountKey`.
   */
  const [remountKey, setRemountKey] = useState(0);

  const viewer = useSandboxViewer({ json: result?.json, useSampleData, signedIn, remountKey });
  const clientId = viewer.clientId;

  /**
   * BEN-003 — what the component emits, read off a trace armed on this client
   * alone. Unmounting the bench disarms it, which is also how "polling stops
   * when the bench is not the active mode" is satisfied: `VisualCanvas` renders
   * this component only in bench mode.
   */
  const outputs = useBenchOutputs({ clientId, target, outputs: iface?.outputs });

  /** One input changed. Sent to this client only; nothing is rebuilt. */
  const applyInput = useCallback(
    (name: string, value: unknown) => {
      setInputs((previous) => ({ ...previous, [name]: value }));
      ViewerConnection.instance.sendModelUpdateToClient(clientId, benchParameterContent(name, value));
      // The read-out is a pull, so an interaction pulls. Without this the user
      // waits out an interval to see the consequence of their own click, which
      // on an occluded window (B10) can be a very long interval indeed.
      outputs.pullNow();
    },
    [clientId, outputs]
  );

  /**
   * Put the rail into a *given* set of values — the one path Reset, Reset all
   * and a scenario switch all go through.
   *
   * They are one operation and were three before BEN-005: "make the mounted
   * component hold exactly these inputs and nothing else". Reset is that with
   * one name removed, Reset all is that with none left, and selecting a scenario
   * is that with a saved set. Keeping them separate would mean the warning below
   * — which cost two shipped-and-inert implementations — had to be remembered
   * again at a third call site.
   *
   * ⚠️ **Deleting the parameter does not put the old value back, and the first
   * implementation of Reset assumed it did.**
   *
   * Sending `parameterValue: undefined` is mechanically exactly right: the key
   * is dropped by `JSON.stringify`, the runtime's `setParameter` deletes the
   * parameter, and `_onNodeModelParameterUpdated` takes its reset-to-default
   * branch. That branch ends at
   * `context.getDefaultValueForInput(this.model.type, name)` — and the type here
   * is a **component**, whose input ports are declared by the user with no
   * default at all. So it queues `undefined`, nothing is restored, and the
   * component keeps the last value it was handed.
   *
   * Measured live, 2026-08-08: after Reset the rail was empty and correct while
   * the rendered component still showed every value that had been set — text,
   * colour, alignment and visibility all unchanged. The mechanism worked and
   * had no consequence, which is the whole reason this phase drives things.
   *
   * So clearing a name uses whichever of the two honest routes applies:
   *
   * - the port has a **derived default** — send it. That is the value the
   *   harness would have given the port at mount (`benchParameters`), so it is
   *   the same state, and it costs no reload. This is the common case: an input
   *   wired to a real port inherits that port's own default, because the
   *   editor's `getParameter` falls back to it;
   * - it has none — **remount the window**. Rebuilding the export is *not*
   *   enough and the second attempt at this shipped believing it was: a value
   *   set through a targeted update never entered the export, so the rebuild
   *   produces identical bytes, `_exportToClient` drops it, and the runtime
   *   keeps the value. Measured live: Reset all cleared the rail and changed
   *   nothing on screen. Only the `src` reloads.
   */
  const applyValueSet = useCallback(
    (next: Record<string, unknown>) => {
      const previous = inputsRef.current;
      inputsRef.current = next;
      setInputs(next);

      let remount = false;

      // Names the new set does not carry have to go back to their default, and
      // deleting the parameter is not how (see above).
      for (const name of Object.keys(previous)) {
        if (Object.prototype.hasOwnProperty.call(next, name)) continue;
        const port = iface?.inputs.find((candidate) => candidate.name === name);
        if (port && port.default !== undefined) {
          ViewerConnection.instance.sendModelUpdateToClient(clientId, benchParameterContent(name, port.default));
        } else {
          remount = true;
        }
      }

      // Only what actually moved. Re-sending an unchanged value would set the
      // input again on every scenario switch, which is a render the user did
      // not cause and — on a component that reacts to being set — a visible one.
      for (const [name, value] of Object.entries(next)) {
        const unchanged =
          Object.prototype.hasOwnProperty.call(previous, name) &&
          JSON.stringify(previous[name]) === JSON.stringify(value);
        if (unchanged) continue;
        ViewerConnection.instance.sendModelUpdateToClient(clientId, benchParameterContent(name, value));
      }

      if (remount) {
        /**
         * ⚠️ **Both, and it has to be both.**
         *
         * `remountKey` reloads the window, which is the only thing that clears
         * a value the runtime was handed by a targeted update. But a reload
         * re-imports whatever export the client is *given*, and that export was
         * built from an older input set — so on its own it would restore the
         * values it was built with rather than the ones being applied. Bumping
         * `revision` rebuilds it from `inputsRef.current`, which is already
         * `next`, so the window comes back holding exactly the new set.
         *
         * Rebuilding alone is not enough either, and that is BEN-002's shipped
         * defect: an export whose bytes did not change is dropped by
         * `_exportToClient` and nothing reaches the runtime at all.
         */
        setRevision((n) => n + 1);
        setRemountKey((n) => n + 1);
      }

      outputs.pullNow();
    },
    [clientId, iface, outputs]
  );

  const resetInput = useCallback(
    (name: string) => {
      const next = { ...inputsRef.current };
      delete next[name];
      applyValueSet(next);
    },
    [applyValueSet]
  );

  /** Every set input at once, each by whichever of the two routes applies. */
  const resetInputs = useCallback(() => applyValueSet({}), [applyValueSet]);

  /** A pulse is two updates; see `benchSignalContents` for why one is not enough. */
  const sendSignal = useCallback(
    (name: string) => {
      for (const content of benchSignalContents(name)) {
        ViewerConnection.instance.sendModelUpdateToClient(clientId, content);
      }
      outputs.pullNow();
    },
    [clientId, outputs]
  );

  /**
   * BEN-005 — the saved input sets, and the one exception to R5.
   *
   * They live in the *component's* metadata rather than in this state, so this
   * is a mirror of what is on disk and never the source of truth: a version
   * control revert, an MCP write or a second editor window all change the
   * component underneath, and a bar rendered from a snapshot taken when the
   * bench opened would offer to overwrite a scenario that no longer exists.
   */
  const [scenarios, setScenarios] = useState<BenchScenario[]>([]);
  /** The scenario the bench is showing, by name. Absent means "not on one". */
  const [activeScenario, setActiveScenario] = useState<string | undefined>(undefined);
  /** What the last scenario action had to say — a skipped input, or a refused value. */
  const [scenarioNotice, setScenarioNotice] = useState<string | undefined>(undefined);

  const readScenarios = useCallback(() => {
    const component = ProjectModel.instance ? benchComponent(ProjectModel.instance, target) : undefined;
    setScenarios(readBenchScenarios(component?.getMetaData(BENCH_SCENARIOS_KEY)));
  }, [target]);

  /**
   * ⚠️ **Clearing the selection is keyed on the target and nothing else.**
   *
   * Folding it into the re-read below — which is keyed on `revision` too — would
   * mean a Refresh, a dataset change, or the export rebuild that
   * {@link applyValueSet} does when it has to remount, each silently dropped the
   * scenario the user was looking at. The last of those is the sharp one:
   * *applying* a scenario would deselect it.
   */
  useEffect(() => {
    setActiveScenario(undefined);
    setScenarioNotice(undefined);
  }, [target]);

  useEffect(() => {
    readScenarios();
  }, [readScenarios, revision]);

  useEffect(() => {
    const eventGroup = {};
    // Every component's metadata, because the event carries the key and the data
    // and not the component that raised it. Re-reading one component's metadata
    // is cheap; being wrong about what is saved is not.
    EventDispatcher.instance.on('ComponentModel.metadataChanged', readScenarios, eventGroup);
    return () => EventDispatcher.instance.off(eventGroup);
  }, [readScenarios]);

  /**
   * ⚠️ **The only write in this surface.** R5 is that nothing on the bench
   * reaches `project.json` without an explicit save, and this is the explicit
   * save — reached from Save, Save as…, Rename, the reorder items and Delete,
   * every one of them a thing a user pressed on purpose.
   *
   * It needs no scheduling of its own: `ComponentModel.setMetaData` raises
   * `Model.metadataChanged`, which is a member of `projectSaveTriggers`
   * (`projectmodel.ts`), so the 1s autosave arms and the write lands. Nothing
   * else here goes near it — typing does not save, selecting does not save,
   * changing the frame does not save, and closing the bench does not save.
   */
  const persistScenarios = useCallback(
    (next: BenchScenario[]) => {
      const component = ProjectModel.instance ? benchComponent(ProjectModel.instance, target) : undefined;
      if (!component) return;

      component.setMetaData(BENCH_SCENARIOS_KEY, benchScenarioStore(next));
      setScenarios(next);
    },
    [target]
  );

  const selectScenario = useCallback(
    (name: string) => {
      const scenario = scenarios.find((candidate) => candidate.name === name);
      if (!scenario) return;

      const { inputs: next, missing } = applyBenchScenario(scenario, iface);
      setActiveScenario(name);
      setScenarioNotice(benchScenarioApplyNotice(missing));
      applyValueSet(next);
      // The width is part of the state a scenario claims, so applying one
      // applies it — through the surface that owns the frame, because the strip
      // above has to agree with the stage about how wide it is.
      onFrameChange?.(benchScenarioFrame(scenario, frame));
    },
    [applyValueSet, frame, iface, onFrameChange, scenarios]
  );

  /** Overwrite the selected scenario with what is on the bench now. */
  const saveScenario = useCallback(() => {
    if (!activeScenario) return;

    const draft = benchScenarioFrom(activeScenario, inputsRef.current, frame);
    if (!draft.scenario) {
      setScenarioNotice(draft.error);
      return;
    }

    setScenarioNotice(undefined);
    persistScenarios(upsertBenchScenario(scenarios, draft.scenario));
  }, [activeScenario, frame, persistScenarios, scenarios]);

  const saveScenarioAs = useCallback(
    (name: string) => {
      const unique = uniqueBenchScenarioName(
        scenarios.map((scenario) => scenario.name),
        name
      );
      const draft = benchScenarioFrom(unique, inputsRef.current, frame);
      if (!draft.scenario) {
        setScenarioNotice(draft.error);
        return;
      }

      setScenarioNotice(undefined);
      setActiveScenario(unique);
      persistScenarios(upsertBenchScenario(scenarios, draft.scenario));
    },
    [frame, persistScenarios, scenarios]
  );

  const renameScenario = useCallback(
    (from: string, to: string) => {
      const next = renameBenchScenario(scenarios, from, to);
      // Unchanged means the name was taken or empty; saying so beats a button
      // that silently does nothing.
      if (next === scenarios) {
        setScenarioNotice(`Could not rename to “${to.trim()}” — that name is already taken.`);
        return;
      }

      setScenarioNotice(undefined);
      if (activeScenario === from) setActiveScenario(to.trim());
      persistScenarios(next);
    },
    [activeScenario, persistScenarios, scenarios]
  );

  const moveScenario = useCallback(
    (name: string, delta: number) => persistScenarios(moveBenchScenario(scenarios, name, delta)),
    [persistScenarios, scenarios]
  );

  /**
   * FIX-012 — the way back to "no scenario".
   *
   * The none-state was in the model from the start (`activeScenario` is
   * `undefined` on open and on a target change) and there was no gesture that
   * reached it: once you selected a scenario you were on one until you deleted
   * it. Nothing new has to be built to clear the bench — `applyValueSet({})` is
   * already exactly "clear everything", by whichever of the two routes each
   * input needs — so this is the gesture, not a mechanism.
   *
   * The frame goes back to the default for the same reason selecting a scenario
   * applies its frame: the width is part of the state a scenario claims, so
   * leaving one has to give it back. Persisting nothing, per R5 — this is a
   * *selection*, and selecting has never written to `project.json`.
   *
   * Deliberately not what Delete does: Delete throws away the saved name and
   * keeps what is on screen (see {@link deleteScenario}). This throws away the
   * values. Both are wanted, which is why they are two gestures.
   */
  const clearScenario = useCallback(() => {
    setActiveScenario(undefined);
    setScenarioNotice(undefined);
    applyValueSet({});
    onFrameChange?.(DEFAULT_BENCH_FRAME);
  }, [applyValueSet, onFrameChange]);

  /**
   * FIX-012 — the same defect from the other end.
   *
   * The rail's **Reset all** cleared every value and left `activeScenario` set,
   * so the chip went on reading `test ●` over a bench whose values were gone —
   * claiming you were on a scenario you were no longer on. Clearing the values
   * *is* leaving the scenario, so the two now agree.
   *
   * The frame is left alone, and that is the difference from
   * {@link clearScenario}: this is a control over the inputs rail, and the frame
   * is not an input.
   */
  const resetInputsAndScenario = useCallback(() => {
    setActiveScenario(undefined);
    setScenarioNotice(undefined);
    resetInputs();
  }, [resetInputs]);

  /**
   * Deleting the scenario does not clear the bench.
   *
   * What is on screen is what someone is looking at; throwing away the saved
   * *name* for it is not a request to throw away the state itself, and a Delete
   * that blanked the preview would be one nobody pressed twice.
   */
  const deleteScenario = useCallback(
    (name: string) => {
      if (activeScenario === name) setActiveScenario(undefined);
      setScenarioNotice(undefined);
      persistScenarios(removeBenchScenario(scenarios, name));
    },
    [activeScenario, persistScenarios, scenarios]
  );

  const selectedScenario = scenarios.find((scenario) => scenario.name === activeScenario);
  const scenarioModified = selectedScenario ? benchScenarioIsModified(selectedScenario, inputs, frame) : false;

  // Only ever read by the empty state, and only worth walking the project for
  // when the mounted component or the project itself has changed.
  const usage = useMemo(
    () => (ProjectModel.instance ? benchInstanceUsage(ProjectModel.instance, target) : undefined),
    [target, revision]
  );

  const width = resolveBenchWidth(frame);

  const frameRef = useRef(null);
  const frameBounds = useThrottle(useTrackBounds(frameRef), 100);
  useEffect(() => {
    onFrameMeasured?.(frameBounds ? { width: frameBounds.width, height: frameBounds.height } : undefined);
  }, [frameBounds, onFrameMeasured]);
  useEffect(() => () => onFrameMeasured?.(undefined), [onFrameMeasured]);

  return (
    <div className={css.Root} data-test="component-bench">
      <SandboxToolbar
        summary={result?.summary}
        notice={result?.notice}
        useSampleData={useSampleData}
        onUseSampleDataChange={setUseSampleData}
        signedIn={signedIn}
        onSignedInChange={setSignedIn}
        hasDataset={Boolean(result?.dataset)}
        dataOpen={dataOpen}
        onDataOpenChange={setDataOpen}
      />

      {useSampleData && dataOpen && result?.dataset && (
        <SandboxDataEditor
          dataset={result.dataset}
          userData={userData}
          onApply={setUserData}
          onClose={() => setDataOpen(false)}
        />
      )}

      {/*
        ⚠️ The frame is rendered **unconditionally**, and that is load-bearing
        rather than tidy. `useTrackBounds` calls `observer.observe(ref.current)`
        with no null guard, so a ref attached to a conditionally-rendered element
        throws on the first layout and takes the whole preview surface's React
        tree down with it — the editor loses its preview panel entirely, which is
        exactly what happened the first time this was driven. Nothing in a spec
        could have caught it; it needed a running editor.

        Keeping it mounted is also the better behaviour: you see the frame you
        asked for even while there is nothing to draw in it.
      */}
      <div className={css.Body}>
        <div className={css.Stage}>
          <div ref={frameRef} className={css.Frame} style={{ width: width === null ? '100%' : `${width}px` }}>
            {result?.json ? (
              <webview
                className={css.Webview}
                ref={viewer.attachWebview}
                // `partition` is a real `<webview>` attribute — it is what keeps the
                // bench's fake session out of the live preview's — and the React DOM
                // rule has no way to know that.
                // eslint-disable-next-line react/no-unknown-property
                partition={SANDBOX_PARTITION}
                src={viewer.src}
                {...SANDBOX_WEBVIEW_ATTRIBUTES}
              />
            ) : (
              <div className={css.Empty}>
                <Text textType={TextType.Secondary}>{result?.unrenderable ?? 'Building the bench…'}</Text>
              </div>
            )}
          </div>
        </div>

        {/* Beside the stage, not above it: you change a value to watch the
            component change, so both have to be on screen at once. The outputs
            read-out is under the inputs in the same column for the same reason
            — set something, see what comes out, without either scrolling away. */}
        <div className={css.Rail}>
          {/* Above the rail, because it is a control over the rail: it sets
              every row at once and it is the only thing on this surface that
              writes anything down. */}
          <BenchScenarioBar
            scenarios={scenarios}
            current={activeScenario}
            modified={scenarioModified}
            notice={scenarioNotice}
            onSelect={selectScenario}
            onClear={clearScenario}
            onSave={saveScenario}
            onSaveAs={saveScenarioAs}
            onRename={renameScenario}
            onMove={moveScenario}
            onDelete={deleteScenario}
          />
          <BenchInputsRail
            iface={iface}
            usage={usage}
            values={inputs}
            onChange={applyInput}
            onReset={resetInput}
            onSignal={sendSignal}
            onResetAll={resetInputsAndScenario}
          />
          <BenchOutputsRail
            iface={iface}
            values={outputs.values}
            log={outputs.log}
            origin={outputs.origin}
            armed={outputs.armed}
            onClear={outputs.clearLog}
          />
        </div>
      </div>
    </div>
  );
}
