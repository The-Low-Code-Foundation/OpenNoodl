// We need to import this so it's available in NoodlRuntime.Services

//import WebSocket from 'ws';
import { NoodlRequest, NoodlResponse } from './bridge';
import { registerNodes } from './nodes';
import NoodlRuntime from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import NodeScope from '@noodl/runtime/src/nodescope';
import './noodl-js-api';

require('./services/userservice');

export class CloudRunner {
  private runtime: NoodlRuntime;

  constructor(options: {
    webSocketClass?: any;
    enableDebugInspectors?: boolean;
    connectToEditor?: boolean;
    editorAddress?: string;
  }) {
    this.runtime = new NoodlRuntime({
      type: 'cloud',
      platform: {
        requestUpdate: (f: any) => setImmediate(f),
        getCurrentTime: () => new Date().getTime(),
        objectToString: (o: any) => JSON.stringify(o, null, 2),
        webSocketClass: options.webSocketClass,
        isRunningLocally: () => options.connectToEditor
      },
      componentFilter: (c) => c.name.startsWith('/#__cloud__/'),
      dontCreateRootComponent: true
    });

    registerNodes(this.runtime);

    this.runtime.setDebugInspectorsEnabled(options.enableDebugInspectors);

    if (options.connectToEditor && options.editorAddress) {
      this.runtime.connectToEditor(options.editorAddress);
    }
  }

  public async load(exportData: any, projectSettings?: any) {
    await this.runtime.setData(exportData);

    if (projectSettings) this.runtime.setProjectSettings(projectSettings);
  }

  public async run(functionName: string, request: NoodlRequest): Promise<NoodlResponse> {
    return new Promise<NoodlResponse>((resolve, reject) => {
      const requestId = Math.random().toString(26).slice(2);

      const requestScope = new NodeScope(this.runtime.context);
      requestScope.modelScope = new Model.Scope();

      this.runtime.context
        .createComponentInstanceNode('/#__cloud__/' + functionName, requestId + '-' + functionName, requestScope)
        .then((functionComponent) => {
          // Look for the first request node (should only be one)
          const requestNode = functionComponent.nodeScope.getNodesWithType('noodl.cloud.request')[0];
          if (requestNode) {
            // Look for all response nodes
            let hasResponded = false;
            const responseNodes = functionComponent.nodeScope.getNodesWithTypeRecursive('noodl.cloud.response');
            responseNodes.forEach((resp) => {
              // NDA-004 §3: the callback reports whether it actually delivered.
              //
              // `hasResponded` lives here, in the per-request closure, and it has to: two
              // different Response nodes both firing is the ordinary shape of the defect, so
              // no single node can know locally that the request is already answered. Before
              // this, the second send was swallowed here without a trace — the node had no
              // outputs at all, so "responded" and "silently discarded" were indistinguishable
              // from the graph. Returning the verdict lets the node own the report, which is
              // where the provenance is (Failure Contract).
              // Asked *before* delivery, because delivering destroys the asker: the teardown
              // below runs synchronously inside the callback, so the node cannot report
              // anything after it returns.
              resp._internal._requestIsOpen = () => !hasResponded;

              resp._internal._sendResponseCallback = (resp) => {
                if (hasResponded) return false;
                hasResponded = true;

                //the functionComponent is "manually" created outside of a scope, so call the delete function directly
                functionComponent._onNodeDeleted();
                requestScope.reset(); //this deletes any remaining nodes, although there shouldn't be any at this point

                //clean upp all models
                requestScope.modelScope.reset();

                resolve(resp);
                return true;
              };
            });

            setImmediate(() => {
              try {
                requestNode.sendRequest(request).catch(reject);
              } catch (e) {
                reject(e);
              }
            });
          } else {
            reject(Error('Could not find request node for function'));
          }
        })
        .catch((e) => {
          // Failed creating component
          reject(e);
        });
    });
  }
}
