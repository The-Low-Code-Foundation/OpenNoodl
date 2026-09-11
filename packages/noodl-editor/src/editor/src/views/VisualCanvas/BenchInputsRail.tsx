/**
 * BEN-002 — The inputs rail: the half of the bench that makes it a bench.
 *
 * BEN-001 gave a mounted component a parent so its inputs *could* be set.
 * Nothing set them. `ProductCard` mounted on the first drive of BEN-004 and
 * rendered an almost-empty box, which is the phase's own dead-placeholder
 * failure arriving inside the tool built to expose it. This is the surface that
 * feeds it.
 *
 * ## Every value here is preview state (R5)
 *
 * Nothing in this file calls `setMetaData`, dirties the project, or survives
 * closing the bench. That is the same rule `signedIn` and BEN-006's records
 * already follow: what someone wanted to *look at* is not a fact about their
 * project. If it should survive, it survives as a scenario — one explicit save,
 * one storage mechanism, not two (BEN-005).
 *
 * ## Why a keystroke does not rebuild the export
 *
 * A changed export makes the runtime call `location.reload()`. Typing "Hello"
 * into a title would flash the preview five times and throw away the open
 * dropdown, the hover, the half-filled form — the very state someone opened the
 * bench to inspect. So a value change is sent as a **targeted `modelUpdate`**
 * instead (register B2, `ViewerConnection.sendModelUpdateToClient`), which is
 * the same message an ordinary property edit uses to reach the live preview
 * without a reload, addressed to this one client so the app preview never sees
 * a component it does not have.
 *
 * @module noodl-editor/views/VisualCanvas/BenchInputsRail
 */

import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';

import type { BenchInstanceUsage, BenchInterface, BenchPort } from '@noodl-models/AiAssistant/authoring';
import { StyleTokensModel } from '@noodl-models/StyleTokensModel';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { ToggleSwitch } from '@noodl-core-ui/components/inputs/ToggleSwitch';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import {
  UNTYPED_HINT,
  benchControlKind,
  benchEnumOptions,
  benchInputGroups,
  benchTypeLabel,
  coerceBenchValue,
  type BenchControlKind,
  type BenchEnumOption
} from './benchInputs';
import css from './BenchInputsRail.module.scss';

export interface BenchInputsRailProps {
  /** The component's declared interface, as `buildBenchExport` already derived it. */
  iface?: BenchInterface;
  /** How the rest of the project uses this component — the empty state's evidence. */
  usage?: BenchInstanceUsage;
  /** Values the user has set. Absent key = unset, so the port keeps its default. */
  values: Record<string, unknown>;
  /** One input changed. */
  onChange: (name: string, value: unknown) => void;
  /**
   * One input back to its default.
   *
   * Separate from `onChange(name, undefined)` because unsetting is not a value:
   * the runtime will not restore anything when a parameter is merely deleted
   * (see `ComponentBench.resetInput`), so the surface has to decide between
   * sending the derived default and remounting. The rail does not know which.
   */
  onReset: (name: string) => void;
  /** A signal input's button was pressed. */
  onSignal: (name: string) => void;
  /** Every input back to its default. */
  onResetAll: () => void;
}

/**
 * The colour tokens, as options.
 *
 * ⚠️ The value is `var(--token)` and **never** a raw hex. The design-token rule
 * holds inside the bench for the same reason it holds everywhere else, and this
 * is a surface someone would otherwise reach for a hex in — a bench is where you
 * try things. Offering only tokens is what stops the trying from becoming the
 * shipping.
 *
 * There is no singleton to read them from: `StyleTokensModel` is constructed per
 * consumer and they stay in sync through `ProjectModel.metadataChanged`, which
 * is the pattern `ElementStyleSectionHost` already follows.
 */
function useColorOptions() {
  const [tokenModel] = useState(() => new StyleTokensModel());
  useEffect(() => () => tokenModel.dispose(), [tokenModel]);

  return useMemo(
    () =>
      tokenModel.getTokensByGroup('Colors').map((token) => ({
        label: token.name.replace(/^--/, ''),
        value: `var(${token.name})`
      })),
    [tokenModel]
  );
}

interface BenchInputRowProps {
  port: BenchPort;
  value: unknown;
  colors: BenchEnumOption[];
  onChange: (value: unknown) => void;
  onSignal: () => void;
  onReset: () => void;
}

function BenchInputRow({ port, value, colors, onChange, onSignal, onReset }: BenchInputRowProps) {
  const kind = benchControlKind(port);
  const isSet = value !== undefined;

  /**
   * The text-shaped controls hold a draft and commit on blur or Enter, never
   * per keystroke. Two reasons, and both are load-bearing: a JSON editor is
   * invalid for most of the time you are typing into it, and a number field
   * would see `3` on the way to `320`. It is also what the frame-width control
   * already does, so the two fields in this surface behave the same way.
   */
  const [draft, setDraft] = useState(() => textFor(value));
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(textFor(value));
    setError(undefined);
    // `port` is stable for the life of a row; the value is what moves (a reset,
    // or a rebuild that re-derived the defaults).
  }, [value, port]);

  function commit(raw: string) {
    const result = coerceBenchValue(kind, raw);
    setError(result.error);
    if (result.error) return;
    onChange(result.value);
  }

  return (
    <div className={css.Row} data-test={`bench-input-${port.name}`}>
      <div className={css.RowHead}>
        <label className={css.Name} title={port.name}>
          {port.name}
        </label>
        <span className={classNames(css.Type, kind === 'untyped' && css['is-untyped'])} data-test="bench-input-type">
          {benchTypeLabel(port)}
        </span>
        <button
          type="button"
          className={classNames(css.Reset, !isSet && css['is-hidden'])}
          title="Back to the default"
          aria-label={`Reset ${port.name}`}
          onClick={onReset}
          data-test={`bench-input-reset-${port.name}`}
        >
          <Icon icon={IconName.Refresh} size={IconSize.Tiny} />
        </button>
      </div>

      <div className={css.Control}>{control()}</div>

      {kind === 'untyped' && (
        <div className={css.Hint}>
          <Text textType={TextType.Shy}>{UNTYPED_HINT}</Text>
        </div>
      )}
      {error && (
        <div className={css.Error} data-test={`bench-input-error-${port.name}`}>
          <Text textType={TextType.Danger}>{error}</Text>
        </div>
      )}
    </div>
  );

  function control() {
    switch (kind) {
      case 'signal':
        // The input half of "see how it works": a component whose only input is
        // a signal has, until now, had no way to be triggered in isolation.
        return (
          <button
            type="button"
            className={css.SignalButton}
            onClick={onSignal}
            data-test={`bench-input-signal-${port.name}`}
          >
            <Icon icon={IconName.PlayCircle} size={IconSize.Small} />
            <span>Send {port.name}</span>
          </button>
        );

      case 'boolean':
        return (
          <ToggleSwitch
            isChecked={Boolean(value)}
            onChange={(event) => onChange(coerceBenchValue('boolean', event.target.checked).value)}
          />
        );

      case 'enum': {
        const options = benchEnumOptions(port);
        if (options.length === 0) return textControl('text');
        return (
          <Select
            options={options}
            value={value === undefined ? undefined : String(value)}
            placeholder="Default"
            isOptionsPushingSiblings
            onChange={(next) => onChange(next)}
            testId={`bench-input-select-${port.name}`}
          />
        );
      }

      case 'color': {
        if (colors.length === 0) return textControl('text');
        return (
          <Select
            options={colors}
            value={value === undefined ? undefined : String(value)}
            placeholder="Default"
            isOptionsPushingSiblings
            onChange={(next) => onChange(next)}
            testId={`bench-input-color-${port.name}`}
          />
        );
      }

      default:
        return textControl(kind);
    }
  }

  function textControl(current: BenchControlKind) {
    return (
      <TextInput
        value={draft}
        placeholder={placeholderFor(current, port)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onEnter={() => commit(draft)}
        testId={`bench-input-field-${port.name}`}
      />
    );
  }
}

/** What a value looks like in a text field. Objects and arrays as JSON, everything else plain. */
function textFor(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * The placeholder is the **derived default**, when there is one.
 *
 * So an empty field is never ambiguous: it shows you what the component will
 * actually get, greyed, rather than the word "Default" standing in for a value
 * you would have to go and look up.
 */
function placeholderFor(kind: BenchControlKind, port: BenchPort): string {
  if (port.default !== undefined) return textFor(port.default);
  return kind === 'json' ? '{ }' : 'Default';
}

/**
 * The empty state, which is the most important thing in this file.
 *
 * A component with no declared inputs is either genuinely not configurable or —
 * far more often on a real project — has its interface declared backwards
 * (LAS-001): every port on its `Component Inputs` node plugged `input`, which
 * publishes them as component *outputs*. `ProductCard` in the shipped example
 * project is exactly this, with eleven of them.
 *
 * Both cases show an empty rail. Only one of them is a bug, and the difference
 * is visible right here: the names the component publishes the wrong way round,
 * and the count of places already passing parameters into a component that
 * cannot receive them.
 */
function BenchInputsEmpty({ iface, usage }: { iface?: BenchInterface; usage?: BenchInstanceUsage }) {
  const backwards = iface?.backwards ?? [];

  return (
    <div className={css.Empty} data-test="bench-inputs-empty">
      {backwards.length > 0 ? (
        <>
          <Text textType={TextType.Danger}>
            {backwards.length === 1
              ? 'This component’s one input is declared backwards.'
              : `This component’s ${backwards.length} inputs are declared backwards.`}
          </Text>
          <Text textType={TextType.Shy}>
            {backwards.join(', ')} — declared on a <code>Component Inputs</code> node with plug “input”, which publishes
            them as component <strong>outputs</strong>. Nothing can pass them in. Re-plug them as “output” and they
            appear here.
          </Text>
        </>
      ) : (
        <>
          <Text>This component declares no inputs.</Text>
          <Text textType={TextType.Shy}>
            Add a <code>Component Inputs</code> node to make it configurable.
          </Text>
        </>
      )}

      {usage && usage.withParameters > 0 && (
        <div className={css.Usage} data-test="bench-inputs-usage">
          <Text textType={TextType.Shy}>
            {usage.withParameters === 1
              ? '1 place in this project already passes parameters to it'
              : `${usage.withParameters} places in this project already pass parameters to it`}
            {usage.parameterNames.length > 0 ? `: ${usage.parameterNames.join(', ')}.` : '.'} Those values are going
            nowhere.
          </Text>
        </div>
      )}
    </div>
  );
}

export function BenchInputsRail({ iface, usage, values, onChange, onReset, onSignal, onResetAll }: BenchInputsRailProps) {
  const inputs = iface?.inputs ?? [];
  const groups = useMemo(() => benchInputGroups(inputs), [inputs]);
  const colors = useColorOptions();
  const setCount = Object.keys(values).length;

  return (
    <div className={css.Root} data-test="bench-inputs-rail">
      <div className={css.Header}>
        <Text textType={TextType.Secondary}>Inputs</Text>
        <button
          type="button"
          className={classNames(css.ResetAll, setCount === 0 && css['is-hidden'])}
          onClick={onResetAll}
          data-test="bench-inputs-reset-all"
        >
          Reset all
        </button>
      </div>

      <div className={css.Scroll}>
        {inputs.length === 0 ? (
          <BenchInputsEmpty iface={iface} usage={usage} />
        ) : (
          groups.map((group) => (
            <div key={group.name || '__ungrouped'} className={css.Group}>
              {group.name && (
                <div className={css.GroupName} data-test={`bench-input-group-${group.name}`}>
                  <Text textType={TextType.Shy}>{group.name}</Text>
                </div>
              )}
              {group.inputs.map((port) => (
                <BenchInputRow
                  key={port.name}
                  port={port}
                  value={values[port.name]}
                  colors={colors}
                  onChange={(next) => onChange(port.name, next)}
                  onSignal={() => onSignal(port.name)}
                  onReset={() => onReset(port.name)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
