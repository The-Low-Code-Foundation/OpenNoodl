/**
 * UNI-011 AC2 — the join between the canvas and the composer.
 *
 * Everything impure happens here and at the moment of the click: the library table, the
 * environment, the graph walk and the warning are all read now, so the dialog receives plain
 * data and the composition stays gradeable in `tests-unit/`.
 *
 * ⚠️ **Read at click time, deliberately.** The Explain entry two lines above this one in
 * `NodeContextMenu` carries the same note for a harder reason — opening a panel switches the
 * sidebar, which deselects every node — and the general form holds here: a menu handler is the
 * last moment at which "the node the user right-clicked" is unambiguous.
 *
 * @module views/DialogLayer/components/AskAboutNodeDialog/openAskAboutNodeDialog
 */

import React from 'react';

import { DialogLayerModel } from '@noodl-models/DialogLayerModel';

import { buildGraphExcerpt } from '@noodl-models/community/nodeexcerpt';
import { graphInputs, libraryPorts, questionEnvironment } from '@noodl-models/community/nodequestioncontext';
import { machinePaths } from '@noodl-utils/report/collect';
import { AskAboutNodeDialog } from './AskAboutNodeDialog';

/** Stable, so a second right-click reuses the composer rather than stacking a second one. */
const DIALOG_ID = 'uni-011-ask-about-node';

export interface AskAboutNodeRequest {
  /** The node's id in its graph — used to centre the excerpt, never published. */
  nodeId: string;
  typename?: string;
  /** The graph the node lives in. Duck-typed; only `connections` and `forEachNode` are read. */
  graph: unknown;
  /** What the node is complaining about, if anything. */
  warning?: string | null;
}

export function openAskAboutNodeDialog(request: AskAboutNodeRequest): void {
  const library = libraryPorts();
  const { nodes, connections } = graphInputs(request.graph as never);
  const excerpt = buildGraphExcerpt(request.nodeId, nodes, connections, { library });

  DialogLayerModel.instance.showDialog(
    (close) =>
      React.createElement(AskAboutNodeDialog, {
        focus: { typename: request.typename },
        library,
        warning: request.warning ?? null,
        environment: questionEnvironment(),
        excerpt,
        // The same machine directories ALPHA-007's reporter uses, so a path in a warning is
        // rewritten by the rules that were written for exactly that job.
        paths: machinePaths(),
        onClose: close
      }),
    { id: DIALOG_ID }
  );
}
