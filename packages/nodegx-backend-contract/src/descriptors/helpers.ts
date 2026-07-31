/**
 * Small constructors so a descriptor reads as a table rather than as a wall of
 * object literals. No logic beyond shaping.
 *
 * @module backend-contract/descriptors/helpers
 */

import type { Capability, CapabilityProbe } from '../capabilities';
import { FILTER_OPERATORS, type FilterOperator } from '../filter';

export const supported = (evidence?: string): Capability => ({ state: 'supported', evidence });

export const unsupported = (reason: string, evidence?: string): Capability => ({
  state: 'unsupported',
  reason,
  evidence
});

export const degraded = (reason: string, evidence?: string): Capability => ({
  state: 'degraded',
  reason,
  evidence
});

export const conditional = (reason: string, probe: CapabilityProbe, evidence?: string): Capability => ({
  state: 'conditional',
  reason,
  probe,
  evidence
});

/**
 * Fill in every filter operator from a default, then apply the interesting
 * ones by name.
 *
 * The default is almost always `supported` for the comparison operators and the
 * exceptions are what a reader cares about, so this keeps the exceptions
 * visible instead of burying them in thirty-one near-identical lines.
 */
export function filterTable(
  fallback: Capability,
  overrides: Partial<Record<FilterOperator, Capability>>
): Readonly<Record<FilterOperator, Capability>> {
  const table = {} as Record<FilterOperator, Capability>;
  for (const operator of FILTER_OPERATORS) {
    table[operator] = overrides[operator] ?? fallback;
  }
  return Object.freeze(table);
}
