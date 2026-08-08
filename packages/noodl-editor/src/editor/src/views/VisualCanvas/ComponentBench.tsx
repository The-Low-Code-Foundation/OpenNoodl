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
  benchInstanceUsage,
  buildBenchExport,
  type AgentSampleData,
  type BenchExport
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
import css from './ComponentBench.module.scss';
import { resolveBenchWidth, type BenchFrame } from './previewScope';

export interface ComponentBenchProps {
  /** Legacy name of the component to mount. */
  target: string;
  frame: BenchFrame;
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

export function ComponentBench({ target, frame, onFrameMeasured }: ComponentBenchProps) {
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
   * ⚠️ **This is still true after BEN-002 decided B2.** The bench now sends
   * *its own* parameter updates to *its own* client, which is the opposite
   * direction: it does not follow the project's `modelUpdate` stream. Editing
   * the mounted component in the graph still needs a Refresh. Whether it should
   * is a separate question, and a bigger one — the harness would have to
   * survive its target's interface changing underneath it.
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

  const viewer = useSandboxViewer({ json: result?.json, useSampleData, signedIn });
  const clientId = viewer.clientId;

  /**
   * One input changed. `undefined` unsets it — `JSON.stringify` drops the key,
   * the runtime's `setParameter` deletes the parameter, and the node falls back
   * to its default. That is what Reset is.
   */
  const applyInput = useCallback(
    (name: string, value: unknown) => {
      setInputs((previous) => {
        const next = { ...previous };
        if (value === undefined) delete next[name];
        else next[name] = value;
        return next;
      });
      ViewerConnection.instance.sendModelUpdateToClient(clientId, benchParameterContent(name, value));
    },
    [clientId]
  );

  const resetInputs = useCallback(() => {
    const names = Object.keys(inputsRef.current);
    setInputs({});
    for (const name of names) {
      ViewerConnection.instance.sendModelUpdateToClient(clientId, benchParameterContent(name, undefined));
    }
  }, [clientId]);

  /** A pulse is two updates; see `benchSignalContents` for why one is not enough. */
  const sendSignal = useCallback(
    (name: string) => {
      for (const content of benchSignalContents(name)) {
        ViewerConnection.instance.sendModelUpdateToClient(clientId, content);
      }
    },
    [clientId]
  );

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
            component change, so both have to be on screen at once. */}
        <BenchInputsRail
          iface={result?.interface}
          usage={usage}
          values={inputs}
          onChange={applyInput}
          onSignal={sendSignal}
          onResetAll={resetInputs}
        />
      </div>
    </div>
  );
}
