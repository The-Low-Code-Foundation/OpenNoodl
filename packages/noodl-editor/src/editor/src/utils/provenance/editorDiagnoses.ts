import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';

import type { DiagnosisLookup } from './annotateWarnings';

/**
 * The editor's answer to *"what is currently wrong with the nodes in this component?"*, in the
 * shape {@link annotateWarnings} wants.
 *
 * All the model glue lives here so the annotator itself stays pure and unit-testable. It is the
 * same split as `walkEngine` / `ProvenancePanel`, for the same reason.
 *
 * The store is already populated on a **cold** editor: `WarningsModel` holds what the running
 * preview has reported, and reporting does not need a trace, a recording or the panel to be
 * open. That is why layer 3, like layer 1, needs nothing to have fired.
 */
export const editorDiagnoses: DiagnosisLookup = (componentName) => {
  const project = ProjectModel.instance;
  if (!project) return [];

  const component = project.getComponentWithName(componentName);
  if (!component) return [];

  const found: Array<{ nodeId: string; message: string }> = [];

  WarningsModel.instance.forEachWarningInComponent(
    component,
    (entry) => {
      // Connection-scoped and component-wide warnings have no `ref.node`. They are real, and
      // they are not node-local *diagnoses* — attaching one to a row would blame whichever node
      // the walk happened to reach the wire through.
      const node = entry && entry.ref && entry.ref.node;
      const message = entry && entry.warning && entry.warning.message;
      if (!node || !node.id || !message) return;

      found.push({ nodeId: node.id, message });
    },
    undefined
  );

  return found;
};
