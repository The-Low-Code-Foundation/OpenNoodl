import { UnsafeStyleProps } from '@noodl-core-ui/types/global';
import classNames from 'classnames';
import React from 'react';
import css from './Logo.module.scss';

export enum LogoVariant {
  Default = 'default',
  Inverted = 'inverted',
  Grayscale = 'grayscale'
}

export enum LogoSize {
  Small = 'small',
  Medium = 'medium',
  Large = 'large'
}

export interface LogoProps extends UnsafeStyleProps {
  variant?: LogoVariant;
  size?: LogoSize;

  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function Logo({
  variant = LogoVariant.Default,
  size = LogoSize.Medium,
  onClick,
  UNSAFE_className,
  UNSAFE_style
}: LogoProps) {
  return (
    <div
      className={classNames([
        css['Root'],
        css[`is-variant-${variant}`],
        css[`is-size-${size}`],
        UNSAFE_className
      ])}
      onClick={onClick}
      style={UNSAFE_style}
    >
      <Mark accented={variant === LogoVariant.Default} />
    </div>
  );
}

/**
 * The NodeGX mark: a node card whose output port wires to a second port —
 * the graph in miniature. Card + target port ride `currentColor`; the wire and
 * output dot take the accent (theme primary) in the Default variant so the mark
 * adapts to light/dark, and collapse to `currentColor` for mono variants.
 */
const Mark = React.memo(function Mark({ accented }: { accented: boolean }) {
  const accent = accented ? 'var(--theme-color-primary, currentColor)' : 'currentColor';
  return (
    <svg width="60" height="60" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5" y="6.5" width="16" height="13" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <path d="M19.5 13C24.5 13 23.5 23.5 28 23.5" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="19.5" cy="13" r="2.75" fill={accent} />
      <circle cx="27.75" cy="23.5" r="2.4" fill="currentColor" />
    </svg>
  );
});
