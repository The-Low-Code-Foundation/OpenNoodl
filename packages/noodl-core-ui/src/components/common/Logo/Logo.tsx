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
 * The NodeGX mark: two ports joined by one wire — the connection itself, with the
 * boxes deleted. An homage to Noodl, and the whole product model in three elements.
 *
 * Authored in a 32-unit box occupying 25 x 22 units (bounding box 3.5..28.5 x
 * 5..27), which puts the mark at 78% of its own viewBox. Stroke 2.6 against ports
 * of r 3.2 holds a port-to-stroke ratio of 2.46 — that ratio is the mark's weight,
 * so scale both together if it ever needs to go lighter or heavier. The same
 * geometry is mapped to the 1024 canvas in noodl-editor/build/icon.svg.
 *
 * The input port rides `currentColor`; the wire and output port take the accent
 * (theme primary) in the Default variant so the mark adapts to light/dark, and
 * collapse to `currentColor` for the mono variants.
 */
const Mark = React.memo(function Mark({ accented }: { accented: boolean }) {
  const accent = accented ? 'var(--theme-color-primary, currentColor)' : 'currentColor';
  return (
    <svg width="60" height="60" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.7 8.2C19 8.2 13 23.8 25.3 23.8" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="6.7" cy="8.2" r="3.2" fill="currentColor" />
      <circle cx="25.3" cy="23.8" r="3.2" fill={accent} />
    </svg>
  );
});
