import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { prettyLanguage } from '@noodl-utils/CodeEditor/mappings';
import { TypescriptModule } from '@noodl-utils/CodeEditor/typescript/helper';

export class EditorModel {
  private _editor: monaco.editor.IStandaloneCodeEditor;

  constructor(public readonly model: monaco.editor.ITextModel, public readonly modules: TypescriptModule[] = []) {}

  public attachEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    if (this._editor) throw new Error('Editor is already attached to editor model.');
    this._editor = editor;
  }

  public getValue(): string {
    return this.model.getValue();
  }

  public getPrettyLanguageName() {
    return prettyLanguage(this.model.getLanguageId());
  }

  public dispose() {
    this.model?.dispose();
    this.modules.forEach((model) => {
      model.dispose();
    });
  }
}
