/**
 * The six descriptors, and the lookup.
 *
 * **These are the checklist for the rest of phase 34.** Cells were written
 * `unsupported` unless there was evidence, and later tasks flip them on as they
 * land — BCN-005 owns most of the relation rows, BCN-006 the auth ones,
 * BCN-007 files, BCN-008 realtime. A cell that gets flipped without evidence in
 * its `evidence` field is the failure mode this table exists to prevent.
 *
 * @module backend-contract/descriptors
 */

import type { BackendType } from '../backends';
import {
  resolveGate,
  type BackendDescriptor,
  type CapabilityGate,
  type CapabilityKey,
  type GateOptions
} from '../capabilities';
import type { FilterOperator } from '../filter';
import { customDescriptor } from './custom';
import { directusDescriptor } from './directus';
import { nodegxDescriptor } from './nodegx';
import { parseDescriptor } from './parse';
import { pocketbaseDescriptor } from './pocketbase';
import { supabaseDescriptor } from './supabase';

export const BACKEND_DESCRIPTORS: Readonly<Record<BackendType, BackendDescriptor>> = Object.freeze({
  nodegx: nodegxDescriptor,
  parse: parseDescriptor,
  directus: directusDescriptor,
  supabase: supabaseDescriptor,
  pocketbase: pocketbaseDescriptor,
  custom: customDescriptor
});

export function descriptorFor(type: BackendType): BackendDescriptor {
  return BACKEND_DESCRIPTORS[type];
}

/**
 * One capability, resolved against one backend instance — BCN-010.
 *
 * **This is the function every user-facing gate goes through**, and there is
 * deliberately only one. Before BCN-010 the descriptor was consumed in exactly
 * two places, each with its own reading of what the four states mean: the filter
 * builder's `getOperatorsForType` treated `conditional` as "do not offer", and
 * `dataBrowserAvailability` folded `unsupported` and `conditional` together by
 * calling `isUsable`. Neither was wrong, and a third reading written by hand for
 * ports would have been the point at which they started to disagree.
 *
 * An unknown backend type — which a project can hold, since `type` comes out of
 * saved metadata — resolves to `supported`. That is the safe floor for the same
 * reason `getOperatorsForType` offers every operator when it has no table:
 * a gate that cannot look the backend up may fail to disable something, but it
 * must never disable something on no evidence and then explain it with a
 * sentence about a backend the user is not using.
 */
export function gateFor(
  type: BackendType | string | undefined,
  key: CapabilityKey,
  options?: GateOptions
): CapabilityGate {
  const descriptor = type ? BACKEND_DESCRIPTORS[type as BackendType] : undefined;
  if (!descriptor) {
    return { declared: 'supported', effective: 'supported', isUsable: true, isUnprobed: false };
  }
  return resolveGate(descriptor.capabilities[key], key, options);
}

/**
 * One filter operator, resolved the same way.
 *
 * Separate from {@link gateFor} only because the operator table is keyed by
 * `FilterOperator` rather than `CapabilityKey`; the resolution is identical, and
 * that is the point — BCN-003b's builder and BCN-010's ports now grey things out
 * by the same rule rather than by two similar ones.
 */
export function filterGateFor(
  type: BackendType | string | undefined,
  operator: FilterOperator,
  options?: GateOptions
): CapabilityGate {
  const descriptor = type ? BACKEND_DESCRIPTORS[type as BackendType] : undefined;
  if (!descriptor) {
    return { declared: 'supported', effective: 'supported', isUsable: true, isUnprobed: false };
  }
  // The operator table has no `CapabilityKey`, so nothing can be probed against
  // it — pass a key no probe result is ever stored under.
  return resolveGate(descriptor.filters[operator], `filter.${operator}` as unknown as CapabilityKey, options);
}

export {
  customDescriptor,
  directusDescriptor,
  nodegxDescriptor,
  parseDescriptor,
  pocketbaseDescriptor,
  supabaseDescriptor
};
