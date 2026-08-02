/**
 * LIB-006: user-code patterns, adapted from the migration scanner.
 *
 * The React 18→19 removal set already exists and is already curated —
 * `models/migration/ProjectScanner`'s `LEGACY_PATTERNS`, with a comment
 * explaining precisely which APIs are in and which are deliberately out.
 * Restating those regexes here would give the project two lists that drift.
 * This adapts them to the shape `assess()` injects.
 *
 * This file is the reason the pattern list is *injected* rather than imported by
 * the assessment core: `ProjectScanner` pulls `@noodl/platform`'s filesystem,
 * and the core has to stay loadable without it.
 *
 * The user-code pass stops here on purpose. Detecting arbitrary removed-API use
 * inside user JavaScript is a static-analysis project, and the committed
 * inventory puts it out of scope — the report says plainly that user code was
 * not analysed beyond this delta.
 *
 * @module noodl-editor/utils/import-engine/legacy/codePatterns
 */

import { LEGACY_PATTERNS } from '../../../models/migration/ProjectScanner';
import type { LegacyCodePattern } from './assess';

/** The React 18→19 removal set, as `assess()` wants it. */
export function reactRemovalPatterns(): LegacyCodePattern[] {
  return LEGACY_PATTERNS.map((pattern) => ({
    name: pattern.name,
    description: pattern.description,
    test(code: string) {
      // A fresh RegExp per call: the shared literals carry no `g` flag today,
      // but `lastIndex` on a shared global regex is exactly the kind of
      // action-at-a-distance that makes a scanner miss every other match.
      return new RegExp(pattern.regex.source, pattern.regex.flags.replace('g', '')).test(code);
    }
  }));
}
