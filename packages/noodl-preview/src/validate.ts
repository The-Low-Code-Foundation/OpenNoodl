/**
 * SUB-006 validation gate.
 *
 * An external writer — an agent, a script — necessarily produces invalid
 * intermediate states: a node written before the connection that feeds it, a
 * component saved with a typo'd port. Rendering those gives a blank or
 * half-broken page, which reads as "the preview is broken" rather than "the
 * edit isn't finished". So every snapshot is validated first and only clean
 * ones reach the exporter; the rest become an overlay (see client.ts).
 *
 * Only *errors* gate. Warnings (chiefly unknown node types, which real projects
 * legitimately have from modules the catalog cannot enumerate) are passed
 * through to the browser for display but never block a render — blocking on
 * them would make the harness unusable on real projects.
 *
 * @module noodl-preview/validate
 */

import { SemanticValidator, fromLegacyProject } from '../../noodl-editor/src/editor/src/validation';
import type { LegacyProjectLike } from '../../noodl-editor/src/editor/src/validation';

/** A diagnostic flattened to what the browser overlay needs. */
export interface PreviewDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  component: string;
  nodeId?: string;
  nodeType?: string;
  nodeLabel?: string;
  port?: string;
  suggestion?: string;
}

export interface PreviewReport {
  diagnostics: PreviewDiagnostic[];
  summary: { errors: number; warnings: number };
}

const validator = new SemanticValidator();

/**
 * Validates the reconstructed legacy project. Takes the in-memory object rather
 * than re-reading the directory so the preview validates exactly the bytes it
 * is about to render — no chance of the two passes seeing different snapshots
 * of a directory an agent is actively writing.
 */
export function validateLegacyProject(legacy: LegacyProjectLike): PreviewReport {
  const report = validator.validate(fromLegacyProject(legacy));

  const diagnostics: PreviewDiagnostic[] = report.diagnostics.map((d) => ({
    severity: d.severity,
    code: d.code,
    message: d.message,
    component: d.location.component,
    nodeId: d.location.nodeId,
    nodeType: d.location.nodeType,
    nodeLabel: d.location.nodeLabel,
    port: d.location.port,
    suggestion: d.suggestion
  }));

  return {
    diagnostics,
    summary: { errors: report.summary.errors, warnings: report.summary.warnings }
  };
}
