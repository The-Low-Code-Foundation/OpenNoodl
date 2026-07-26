import { useThemeTokens } from '@noodl-hooks/useThemeTokens';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import ReactJson from '@microlink/react-json-view';

import { ProjectModel } from '@noodl-models/projectmodel';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { ToastLayer } from '../../ToastLayer/ToastLayer';
import css from './InspectPopup.module.scss';

/* ----------------------------------------------------------------------------
 * JSON syntax colours (UIX-012)
 *
 * `react-json-view` takes a base16 object of literal colours — it cannot read
 * `var()` — so this used to be a hand-written dark palette that the light theme
 * had no way to reach: strings at `#f7c967` on the light `bg-4` (`#e2e8ef`) are
 * ~1.6:1, and `NaN`/`undefined` at `#eaeaea` were invisible. The values now
 * come from the `--theme-color-syntax-*` tokens UIX-008 already defined for
 * both themes (used by the CodeMirror theme), resolved to literals through the
 * shared `useThemeTokens` hook so a pinned inspector re-themes in place.
 *
 * Contrast note: those tokens are documented as AA on `bg-1`/`bg-2`, and this
 * popup sits on `bg-4`. Every syntax value used below still clears AA there in
 * both themes; the one that did not — `syntax-meta` (`#6e7781`, ~3.5:1 on the
 * light `bg-4`) for `undefined`/ellipsis — is swapped for `fg-default`.
 *
 * The fallbacks are the dark-theme token values, for headless/no-CSS contexts.
 * ------------------------------------------------------------------------- */
const JSON_THEME_TOKENS = {
  /** Popup surface (ReactJson's own background is forced transparent). */
  surface: { css: '--theme-color-bg-4', fallback: '#2c3540' },
  surfaceRaised: { css: '--theme-color-bg-5', fallback: '#37424f' },
  border: { css: '--theme-color-border-default', fallback: '#232a33' },
  /** Object/array keys and braces. */
  key: { css: '--theme-color-fg-highlight', fallback: '#eef2f6' },
  /** `undefined`, the collapsed-node ellipsis. */
  muted: { css: '--theme-color-fg-default', fallback: '#a6b0bb' },
  /** Object size counters (currently hidden) and thin borders. */
  shy: { css: '--theme-color-fg-muted', fallback: '#6b7682' },
  string: { css: '--theme-color-syntax-string', fallback: '#ce9178' },
  number: { css: '--theme-color-syntax-number', fallback: '#b5cea8' },
  /** `true`/`false`/`null` — keywords, as in the code editor. */
  keyword: { css: '--theme-color-syntax-keyword', fallback: '#569cd6' },
  /** Array indices. */
  property: { css: '--theme-color-syntax-property', fallback: '#9cdcfe' },
  /** Dates and functions. */
  callable: { css: '--theme-color-syntax-function', fallback: '#dcdcaa' },
  /** `NaN` — a value that is wrong, so the invalid colour. */
  invalid: { css: '--theme-color-syntax-invalid', fallback: '#f44747' }
};

/**
 * base16 slot → JSON token, per react-json-view's `createStylingFromTheme`
 * (verified against the installed build, not assumed):
 *   base00 background · base01 raised chrome · base02 value background +
 *   object border · base04 objectSize + border · base05 undefined ·
 *   base07 keyColor + braceColor · base08 NaN · base09 string + ellipsis ·
 *   base0A null + regexp · base0B float · base0C arrayKeyColor ·
 *   base0D date/function/expandedIcon/copyToClipboardCheck ·
 *   base0E boolean/collapsedIcon/editIcon · base0F integer/copyToClipboard.
 */
function base16FromTokens(t: Record<keyof typeof JSON_THEME_TOKENS, string>) {
  return {
    base00: t.surface,
    base01: t.surfaceRaised,
    base02: t.border,
    base03: t.shy,
    base04: t.shy,
    base05: t.muted,
    base06: t.key,
    base07: t.key,
    base08: t.invalid,
    base09: t.string,
    base0A: t.keyword,
    base0B: t.number,
    base0C: t.property,
    base0D: t.callable,
    base0E: t.keyword,
    base0F: t.number
  };
}

type ValueType = 'text' | 'value' | 'image' | 'color';
type DebugObjectType = { type: ValueType; value: any };

type DebugValueType = string | DebugObjectType | [DebugObjectType];

type InspectPopupProps = {
  debugValue: DebugValueType;
  onPinClicked: () => void;
  pinned: boolean;
};

export function InspectPopup({ debugValue, onPinClicked, pinned }: InspectPopupProps) {
  if (debugValue === undefined) {
    return null;
  }

  if (typeof debugValue === 'string') {
    debugValue = { type: 'value', value: debugValue };
  }

  if (!Array.isArray(debugValue)) {
    debugValue = [debugValue];
  }

  const hasValuesToShow = debugValue.some((v) => v.value !== undefined);
  if (!hasValuesToShow) {
    return null;
  }

  return (
    <div className={css.Root}>
      <button onClick={onPinClicked} className={classNames(css.PinButton, pinned && css['is-pinned'])}>
        <Icon icon={pinned ? IconName.PinFill : IconName.Pin} />
      </button>

      <div className={css.ValueContainer}>
        {debugValue.map((value: DebugObjectType, i: number) => {
          if (value.type === 'image') {
            return <ImageInspector source={value.value} key={i} />;
          } else if (value.type === 'color') {
            return <ColorInspector color={value.value} key={i} />;
          } else {
            return typeof value.value === 'object' && value.value !== null ? (
              <ObjectInspector value={value.value} key={i} />
            ) : (
              <ValueInspector value={value.value} key={i} />
            );
          }
        })}
      </div>
    </div>
  );
}

function ObjectInspector({ value }: { value: Record<string, unknown> | unknown[] }) {
  const tokens = useThemeTokens(JSON_THEME_TOKENS);
  const theme = useMemo(() => base16FromTokens(tokens), [tokens]);

  return (
    <>
      {Array.isArray(value) ? <ValueInspector value={'Count: ' + value.length} /> : null}
      <ReactJson
        src={value}
        theme={theme}
        enableClipboard={() => {
          ToastLayer.showInteraction('Copied');
        }}
        style={{ backgroundColor: 'transparent' }}
        name={false}
        indentWidth={2}
        displayObjectSize={false}
        displayDataTypes={false}
        quotesOnKeys={false}
        collapsed={1}
      />
    </>
  );
}

function ValueInspector({ value }) {
  return <div className={css.ValueInspector}>{String(value)}</div>;
}

function ColorInspector({ color }) {
  const c = ProjectModel.instance.resolveColor(color);

  return (
    <div className={css.ValueInspector} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ backgroundColor: c, width: '20px', height: '20px' }} />
      {color}
    </div>
  );
}

function ImageInspector({ source }: { source: string }) {
  let src: string;

  if (source.startsWith('http')) {
    src = source;
  } else {
    const protocol = process.env.ssl ? 'https' : 'http';
    const port = process.env.NOODLPORT || 8574;
    src = `${protocol}://localhost:${port}/${source}`;
  }

  return (
    <div className={css.ValueInspector}>
      <img src={src} />
    </div>
  );
}
