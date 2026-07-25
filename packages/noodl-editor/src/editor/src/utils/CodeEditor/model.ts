import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { uniq } from 'underscore';

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { EditorModel } from '@noodl-utils/CodeEditor/model/editorModel';
import { TypescriptModule } from '@noodl-utils/CodeEditor/typescript/helper';
import { registerOrUpdate_JavaScriptFunction } from '@noodl-utils/CodeEditor/typescript/nodes/JavaScriptFunction';
import { GetOrCreateViewerModel } from '@noodl-utils/CodeEditor/typescript/viewer';
import { GetOrCreateViewerCloudModel } from '@noodl-utils/CodeEditor/typescript/viewer-cloud';
import { GetOrCreateViewerReactModel } from '@noodl-utils/CodeEditor/typescript/viewer-react';
import { getNodeGraphNodeRuntimeType } from '@noodl-utils/NodeGraph';

import { codeEditorTypeToLanguageId } from './mappings';

export interface createModelOptions {
  type: string;
  value: string;
  codeeditor: string;
}

/**
 * Create the Monaco Model, with better typings etc
 *
 * NOTE (DEBT-011, 2026-07-25): this used to also serve `codeeditor: 'json'` ports
 * (as Monaco plaintext) and generic `type: 'array'` ports (as a bare Monaco
 * 'typescript' model with no extra typings). Both now go straight to the
 * CodeMirror JavaScriptEditor from CodeEditorType.ts and never reach this
 * function. The DbCollection2/Expression/Javascript2 per-node intellisense
 * modules were deleted for the same reason: this function's only remaining
 * caller (AiChat.tsx's inline Function-node editor) always passes
 * `codeeditor: 'javascript'` for a `JavaScriptFunction` node. If that
 * changes, or a `.d.ts`-driven CodeMirror intellisense is built (see
 * dev-docs/future-projects/typed-intellisense-revival.md), this function -
 * and the rest of the Monaco-based editor infra it depends on - should be
 * revisited.
 */
export function createModel(options: createModelOptions, node: NodeGraphNode): EditorModel {
  const modules: TypescriptModule[] = [];

  if (['javascript', 'typescript'].includes(options.codeeditor)) {
    const runtimeType = getNodeGraphNodeRuntimeType(node);

    if (node.typename !== 'Expression') {
      modules.push(GetOrCreateViewerModel());
    }

    const defaultLibs: string[] = [];

    switch (runtimeType) {
      case RuntimeType.Browser:
        modules.push(GetOrCreateViewerReactModel());
        break;

      case RuntimeType.Cloud:
        modules.push(GetOrCreateViewerCloudModel());
        break;
    }

    switch (node.typename) {
      case 'JavaScriptFunction':
        modules.push(registerOrUpdate_JavaScriptFunction(node, runtimeType));
        break;

      default:
        switch (runtimeType) {
          case RuntimeType.Browser:
            defaultLibs.push('dom', 'es2020');
            break;

          case RuntimeType.Cloud:
            defaultLibs.push('es2020');
            break;
        }
        break;
    }

    // Get a list of all the available libs
    // this is removing all the DOM typings
    const lib = uniq([...defaultLibs, ...modules.flatMap((x) => x.libs)]);

    const compilerOptions: monaco.languages.typescript.CompilerOptions = {
      target: monaco.languages.typescript.ScriptTarget.ES5,
      lib,
      allowNonTsExtensions: true,
      allowJs: true,
      noImplicitAny: false
    };

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });
  }

  const languageId = codeEditorTypeToLanguageId(options.codeeditor);
  const model = monaco.editor.createModel(options.value, languageId);

  return new EditorModel(model, modules);
}
