/**
 * BEN-003 — The outputs read-out: the other half of "see what it does".
 *
 * A card that renders beautifully and never fires its `onClick` looks identical
 * to one that works. The inputs rail made the component configurable; this is
 * the half that says whether configuring it did anything.
 *
 * It also changes what the bench can cover at all. `buildBenchExport`
 * deliberately does not refuse a component with no visual root — and until
 * there was somewhere to show what came out, mounting one produced an empty
 * stage and no information. A logic-only component is previewable for the first
 * time in this product's history because of this file.
 *
 * ## Two shapes, because outputs are two things
 *
 * A **value** output has a current value, so it gets a row that is always there
 * and flashes when it moves. A **signal** output is an event with no state, so
 * it gets an append-only log. Showing a signal as a value would mean rendering
 * the `true` that carries the pulse, which says nothing about the thing that
 * happened.
 *
 * @module noodl-editor/views/VisualCanvas/BenchOutputsRail
 */

import classNames from 'classnames';
import React, { useEffect, useRef } from 'react';

import type { BenchInterface } from '@noodl-models/AiAssistant/authoring';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { benchTypeLabel } from './benchInputs';
import {
  NOTHING_EMITTED_HINT,
  NO_OUTPUTS_HINT,
  benchRelativeTime,
  benchValueText,
  splitBenchOutputs,
  type BenchEmission,
  type BenchValueState
} from './benchOutputs';
import css from './BenchOutputsRail.module.scss';

export interface BenchOutputsRailProps {
  iface?: BenchInterface;
  values: Record<string, BenchValueState>;
  log: BenchEmission[];
  /** The runtime clock every log row is relative to. */
  origin: number;
  /** False while the trace has not been armed — the read-out cannot see anything yet. */
  armed: boolean;
  onClear: () => void;
}

function BenchValueRow({ port, state }: { port: { name: string; type: unknown }; state?: BenchValueState }) {
  /**
   * The flash is keyed on `seq`, not on the value.
   *
   * A counter going 10 → 10 (reset, then stepped back) is a real emission that
   * changes no text, and a read-out that showed nothing for it would be exactly
   * the "mechanism with no consequence" this phase keeps finding. `seq` moves
   * for every emission; the rendered value does not.
   */
  const previousSeq = useRef<number | undefined>(state?.seq);
  const changed = state !== undefined && previousSeq.current !== undefined && state.seq > previousSeq.current;
  useEffect(() => {
    previousSeq.current = state?.seq;
  }, [state?.seq]);

  return (
    <div className={css.ValueRow} data-test={`bench-output-${port.name}`}>
      <span className={css.Name} title={port.name}>
        {port.name}
      </span>
      <span className={css.Type}>{benchTypeLabel(port as never)}</span>
      <span
        // `key` on the changing half restarts the animation: React reuses the
        // element otherwise and a second identical change would not re-run it.
        key={state?.seq ?? 'none'}
        className={classNames(css.Value, changed && css['is-changed'])}
        data-test={`bench-output-value-${port.name}`}
      >
        {benchValueText(state?.value)}
      </span>
    </div>
  );
}

export function BenchOutputsRail({ iface, values, log, origin, armed, onClear }: BenchOutputsRailProps) {
  const outputs = iface?.outputs ?? [];
  const { values: valuePorts, signals: signalPorts } = splitBenchOutputs(outputs);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Newest last, so the interesting end is the bottom. Jumping there is right
    // for a log you are watching live; it is the one place in this surface
    // where the user is not the one deciding what to look at.
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [log.length]);

  return (
    <div className={css.Root} data-test="bench-outputs-rail">
      <div className={css.Header}>
        <Text textType={TextType.Secondary}>Outputs</Text>
        <div className={css.HeaderActions}>
          <button
            type="button"
            className={classNames(css.Clear, log.length === 0 && css['is-hidden'])}
            onClick={onClear}
            data-test="bench-outputs-clear"
          >
            Clear
          </button>
        </div>
      </div>

      <div className={css.Scroll} ref={scrollRef}>
        {outputs.length === 0 ? (
          <div className={css.Empty} data-test="bench-outputs-empty">
            <Text>{NO_OUTPUTS_HINT}</Text>
            <Text textType={TextType.Shy}>
              Add a <code>Component Outputs</code> node, and plug its ports “input”, to publish one.
            </Text>
          </div>
        ) : (
          <>
            {valuePorts.length > 0 && (
              <>
                <div className={css.SectionName}>
                  <Text textType={TextType.Shy}>Values</Text>
                </div>
                {valuePorts.map((port) => (
                  <BenchValueRow key={port.name} port={port} state={values[port.name]} />
                ))}
              </>
            )}

            {signalPorts.length > 0 && (
              <div className={css.SectionName}>
                <Text textType={TextType.Shy}>
                  {signalPorts.length === 1 ? '1 signal' : `${signalPorts.length} signals`}
                </Text>
              </div>
            )}

            {log.map((emission) => (
              <div className={css.LogRow} key={emission.seq} data-test={`bench-output-signal-${emission.name}`}>
                <span className={css.LogTime}>{benchRelativeTime(emission.t, origin)}</span>
                <span className={css.LogName}>{emission.name}</span>
              </div>
            ))}

            {log.length === 0 && (
              <div className={css.Empty} data-test="bench-outputs-nothing-yet">
                <Text textType={TextType.Shy}>
                  {armed
                    ? NOTHING_EMITTED_HINT
                    : 'Waiting for the bench to connect — nothing can be read until it does.'}
                </Text>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
