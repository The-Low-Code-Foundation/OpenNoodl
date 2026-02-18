/**
 * ExecutionTimeline
 *
 * Fixed-position scrubber bar at the bottom of the canvas overlay.
 * Allows stepping through execution steps one at a time.
 * Not affected by canvas pan/zoom — rendered outside the transform container.
 */

import React from 'react';

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import styles from './ExecutionTimeline.module.scss';

export interface ExecutionTimelineProps {
  steps: ExecutionStep[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

/**
 * ExecutionTimeline component
 *
 * Shows: Prev button | range scrubber | step dots | step counter | Next button
 * Step dots are colour-coded by status and highlight the active step.
 */
export function ExecutionTimeline({ steps, currentIndex, onIndexChange }: ExecutionTimelineProps) {
  if (steps.length === 0) return null;

  const maxIndex = steps.length - 1;

  return (
    <div className={styles.timeline}>
      <button
        className={styles.navButton}
        disabled={currentIndex <= 0}
        onClick={() => onIndexChange(currentIndex - 1)}
        aria-label="Previous step"
      >
        Prev
      </button>

      <input
        className={styles.scrubber}
        type="range"
        min={0}
        max={maxIndex}
        value={currentIndex}
        onChange={(e) => onIndexChange(Number(e.target.value))}
        aria-label="Step scrubber"
      />

      {/* Step dots — only show up to 30 to avoid overflow */}
      {steps.length <= 30 && (
        <div className={styles.stepDots}>
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={styles.stepDot}
              data-status={step.status}
              data-active={String(i === currentIndex)}
              onClick={() => onIndexChange(i)}
              title={`Step ${i + 1}: ${step.nodeName || step.nodeType} (${step.status})`}
            />
          ))}
        </div>
      )}

      <span className={styles.counter}>
        Step {currentIndex + 1} / {steps.length}
      </span>

      <button
        className={styles.navButton}
        disabled={currentIndex >= maxIndex}
        onClick={() => onIndexChange(currentIndex + 1)}
        aria-label="Next step"
      >
        Next
      </button>
    </div>
  );
}
