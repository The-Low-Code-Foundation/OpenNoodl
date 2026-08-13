/**
 * The preview surface — one surface, two modes (BEN-004).
 *
 * Mode `app` is the live preview this file has always been: the project's own
 * viewer, filling a checkerboarded canvas. Mode `bench` mounts a single
 * component in isolation with its inputs settable (BEN-001), on a stage that is
 * visibly a bench.
 *
 * The four anti-disorientation rules from the phase README are load-bearing
 * here, not decoration:
 *
 * - **R1** one preview surface, two modes. This component. There is no second
 *   preview panel anywhere in the editor, and there must not be one — two live
 *   previews in two panels is the arrangement that guarantees a builder does
 *   not know which of them is the app.
 * - **R2** the bench never renders full-bleed. See `ComponentBench.module.scss`.
 * - **R3** the app preview is *not torn down* when you switch. Both stages are
 *   absolutely positioned siblings and the inactive one is hidden with
 *   `visibility`, so the app webview keeps running with its route, its scroll
 *   position and its half-filled form intact, and its layout box keeps a real
 *   size — which matters, because `CanvasView.updateViewportSize` computes
 *   zoom-to-fit from `getBoundingClientRect()` and a `display: none` ancestor
 *   would hand it a zero and a zero-width preview to come back to.
 *   ⚠️ Hiding, never closing: closing a webview CDP target white-screens the
 *   editor (POL-012).
 * - **R4** one always-present way back, in the same place in both modes. The
 *   scope chip is the leftmost control of the strip in both.
 */

import { useThrottle } from '@noodl-hooks/useThrottleState';
import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { Keybindings } from '@noodl-constants/Keybindings';

import { ProjectModel } from '@noodl-models/projectmodel';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { useTrackBounds } from '@noodl-core-ui/hooks/useTrackBounds';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { BENCH_MOUNT_EVENT, clearPendingBenchMount, takePendingBenchMount } from './benchRequest';
import { ComponentBench } from './ComponentBench';
import { BenchFrameControl, PreviewScopeControl } from './PreviewChrome';
import {
  APP_SCOPE,
  DEFAULT_BENCH_FRAME,
  benchSizeLabel,
  benchTargetLabel,
  type BenchFrame,
  type PreviewScope
} from './previewScope';
import css from './VisualCanvas.module.scss';

export interface VisualCanvasProps {
  onWebView: (webview: Electron.WebviewTag) => void;
  deviceName?: string;
  zoom: number;
  /** DES-001 — design mode is on, i.e. the app's own clicks are being swallowed. */
  designMode?: boolean;
  onExitDesignMode?: () => void;
  /** The last element clicked in design mode. `seq` re-fires the toast for a repeat click. */
  designSelection?: { label: string; seq: number };
}

export function VisualCanvas({
  onWebView,
  deviceName,
  zoom,
  designMode,
  onExitDesignMode,
  designSelection
}: VisualCanvasProps) {
  const webviewRef = useRef<Electron.WebviewTag>(null);
  const containerRef = useRef(null);

  const webviewBounds = useThrottle(useTrackBounds(webviewRef), 100);
  const containerBounds = useThrottle(useTrackBounds(containerRef), 100);

  const [crashed, setCrashed] = useState(false);
  const [style, setStyle] = useState({});
  const [showViewportSize, setShowViewportSize] = useState(false);

  /**
   * Which of the two modes is showing, and the frame the bench renders into.
   *
   * Both are **preview state, never project state** (R5) and neither is
   * persisted: reopening a project into a component bench, with no memory of
   * having asked for one, is the disorientation this phase is about.
   */
  const [scope, setScope] = useState<PreviewScope>(APP_SCOPE);
  const [frame, setFrame] = useState<BenchFrame>(DEFAULT_BENCH_FRAME);
  /** The bench frame's measured box — see `ComponentBench`'s `onFrameMeasured`. */
  const [benchMeasured, setBenchMeasured] = useState<{ width: number; height: number } | undefined>(undefined);
  const isBench = scope.mode === 'bench';

  /**
   * DES-001 — design mode said on the surface it applies to.
   *
   * The only cue used to be the segmented control in the top bar, two panels
   * away from the pointer, so people clicked a button, got nothing (the
   * inspector eats the event in the capture phase) and read it as broken. The
   * frame is the standing answer, the toast is the answer to a specific click.
   *
   * Scoped to `!isBench` deliberately: the bench has its own accent strip for
   * its own claim, and two accent claims on one surface is two answers to
   * "what am I looking at".
   */
  const showDesignChrome = Boolean(designMode) && !isBench;
  const [selectionToast, setSelectionToast] = useState<string | null>(null);

  useEffect(() => {
    if (!showDesignChrome || !designSelection) {
      setSelectionToast(null);
      return;
    }

    setSelectionToast(designSelection.label);
    const timeout = setTimeout(() => setSelectionToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [showDesignChrome, designSelection?.seq, designSelection?.label]);

  /**
   * BEN-004 §6 — the entry the feature will actually be used through:
   * components panel → right-click → "Preview in isolation". The panel is a
   * different React root, so the existing global bus carries it.
   *
   * The claim on mount is the other half: a request made while the preview was
   * detached fires before this surface exists, so `benchRequest` parks it and
   * this picks it up once `EditorDocument` has re-attached.
   */
  useEffect(() => {
    const eventGroup = {};
    EventDispatcher.instance.on(
      BENCH_MOUNT_EVENT,
      (args: { target?: string }) => {
        if (!args?.target) return;
        // Handled live, so nothing is left parked for the next mount.
        clearPendingBenchMount();
        setScope({ mode: 'bench', target: args.target });
      },
      eventGroup
    );

    const parked = takePendingBenchMount();
    if (parked) setScope({ mode: 'bench', target: parked });

    return () => EventDispatcher.instance.off(eventGroup);
  }, []);

  useEffect(() => {
    onWebView(webviewRef.current);

    if (webviewRef.current) {
      webviewRef.current.addEventListener('crashed', () => {
        setCrashed(true);
      });
    }
  }, [webviewRef]);

  function restart() {
    if (webviewRef.current) {
      setCrashed(false);
      onWebView(webviewRef.current);
    }
  }

  useEffect(() => {
    if (!webviewBounds || !containerBounds) {
      return;
    }

    if (webviewBounds.width > containerBounds.width && webviewBounds.height > containerBounds.height) {
      setStyle({});
    } else if (webviewBounds.width > containerBounds.width) {
      setStyle({ flexDirection: 'row', alignItems: 'center' });
    } else if (webviewBounds.height > containerBounds.height) {
      setStyle({ flexDirection: 'column', alignItems: 'center' });
    } else {
      setStyle({ alignItems: 'center', justifyContent: 'center' });
    }
  }, [webviewBounds, containerBounds]);

  useEffect(() => {
    if (!webviewBounds) {
      return;
    }

    setShowViewportSize(true);

    const timeout = setTimeout(() => {
      setShowViewportSize(false);
    }, 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, [containerBounds, webviewBounds]);

  return (
    <div className={css.Background} data-preview-mode={scope.mode}>
      {/* R1/R4: the scope control is the leftmost thing in the strip, and the
          strip is in the same place in both modes. It is how you get into the
          bench and it is the only way out — a second "exit" affordance would be
          a second answer to the same question. */}
      <div
        className={classNames(css.Chrome, isBench && css['is-bench'], showDesignChrome && css['is-design'])}
        data-test="preview-chrome"
      >
        <PreviewScopeControl
          scope={scope}
          onScopeChange={setScope}
          getComponents={() => ProjectModel.instance?.getComponents() ?? []}
        />

        {showDesignChrome && (
          <div className={css.DesignBanner} data-test="design-mode-banner">
            <Icon icon={IconName.Pencil} size={IconSize.Small} UNSAFE_className={css.DesignBannerIcon} />
            <span className={css.DesignBannerText}>
              <strong>Design mode</strong>
              <span>&nbsp;— click an element to edit it. The app is not running.</span>
            </span>
            {/* The way out, on the surface the confusion happens on — the top
                bar's toggle is the same switch, two panels away. */}
            <button className={css.DesignBannerExit} onClick={onExitDesignMode} data-test="design-mode-exit">
              <Icon icon={IconName.PlayCircle} size={IconSize.Small} />
              <span>Preview</span>
              <span className={css.DesignBannerKey}>{Keybindings.TOGGLE_PREVIEW_MODE.label}</span>
            </button>
          </div>
        )}

        {isBench && (
          <>
            {/* R2's persistent strip: what is mounted, and that it is isolated.
                Said in words as well as drawn, because the words are what a
                user repeats when they file a bug about it. */}
            <div className={css.BenchCaption} data-test="bench-caption">
              <strong>{benchTargetLabel(scope.target)}</strong>
              <span>&nbsp;— isolated component, not the app</span>
            </div>
            <BenchFrameControl frame={frame} onFrameChange={setFrame} />
            <div className={css.BenchSize} data-test="bench-size">
              {benchSizeLabel(frame, benchMeasured)}
            </div>
          </>
        )}
      </div>

      <div className={classNames(css.Stages, showDesignChrome && css['is-design'])}>
        {/* PAR-003: size tag per mock — `1280 × 800 · 100%`, mono, top-right.
            Lives inside the stage so it floats over the preview rather than
            over the chrome strip above it. */}
        {showViewportSize && !isBench && webviewBounds && (
          <div className={css.ViewportInfo}>{`${deviceName ? deviceName + ' · ' : ''}${Math.floor(
            webviewBounds.width
          )} × ${Math.floor(webviewBounds.height)} · ${Math.floor(zoom * 100)}%`}</div>
        )}

        {/*
          R3 — hidden, never unmounted. `visibility: hidden` keeps the element's
          layout box, so the route, the scroll position and the half-filled form
          all survive a round trip *and* the zoom-to-fit arithmetic keeps
          measuring a real rectangle.
        */}
        <div
          className={classNames(css.WebviewContainer, isBench && css['is-hidden'])}
          style={style}
          ref={containerRef}
          data-test="app-preview"
        >
          <webview
            className={css.Webview}
            ref={webviewRef}
            // @ts-expect-error. Typings think this is a boolean. It's not, html attributes are strings.
            disablewebsecurity="true"
            webpreferences="allowRunningInsecureContent, enableRemoteModule"
          />
        </div>

        {/* `onFrameChange` has exactly one caller — a scenario carrying the
            width it was saved at (BEN-005). The frame lives here rather than in
            the bench because the chrome strip's control writes it too, and the
            two have to be the same number. */}
        {isBench && (
          <ComponentBench
            target={scope.target}
            frame={frame}
            onFrameChange={setFrame}
            onFrameMeasured={setBenchMeasured}
          />
        )}

        {/* Answers the click at the pointer. `pointer-events: none` — it sits
            over the app, and a design-mode click that lands on the explanation
            of design mode instead of on the element under it would be its own
            small betrayal. */}
        {selectionToast && (
          <div className={css.DesignToast} data-test="design-mode-toast">
            <strong>Selected {selectionToast}</strong>
            <span>Editing it in the property panel. Switch to Preview to click it for real.</span>
          </div>
        )}
      </div>

      {Boolean(crashed) && (
        <div className={css.Crashed}>
          <div className={css.CrashedContent}>
            <Label size={LabelSize.Big} hasBottomSpacing>
              Aw, Snap!
            </Label>
            <Text>Something went wrong while displaying this web page.</Text>
            <Box hasTopSpacing>
              <PrimaryButton size={PrimaryButtonSize.Small} label="Try again." onClick={restart} />
            </Box>
          </div>
        </div>
      )}
    </div>
  );
}
