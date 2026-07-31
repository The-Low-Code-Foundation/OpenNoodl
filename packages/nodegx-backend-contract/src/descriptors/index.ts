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
import type { BackendDescriptor } from '../capabilities';
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

export {
  customDescriptor,
  directusDescriptor,
  nodegxDescriptor,
  parseDescriptor,
  pocketbaseDescriptor,
  supabaseDescriptor
};
