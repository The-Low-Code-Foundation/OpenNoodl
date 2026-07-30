'use strict';

import type { NodeContextLike, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * The load terminator, whose `onload` tells the node every earlier script is in.
 *
 * `onreadystatechange` is the IE-era half of the pair and is not on `lib.dom`'s
 * `HTMLScriptElement`, so the element is widened where it is assigned.
 */
type LegacyScriptElement = HTMLScriptElement & {
  onreadystatechange: ((this: LegacyScriptElement) => void) | null;
  readyState?: string;
};

/** `this` inside the Script Downloader node. */
interface ScriptDownloaderNodeInstance extends NodeInstance {
  _internal: {
    loaded: boolean;
    /** One entry per numbered `input N` port, indexed by that number. */
    scripts: string[];
    loadedScripts: Record<string, unknown>;
    startLoad: boolean;
    loadStarted?: boolean;
    updateScriptsScheduled?: boolean;
  };
  removeLoadTerminator(): void;
  scheduleUpdateScripts(): void;
  updateScripts(): void;
}

const ScriptDownloadDefinition: NodeDefinitionOptions = {
  name: 'Script Downloader',
  docs: 'https://docs.noodl.net/nodes/javascript/script-downloader',
  shortDesc: 'Script Downloader allows you load external Javascript libraries. ',
  category: 'Javascript',
  color: 'javascript',
  deprecated: true,
  // Injects <script> tags into document.head from its input setters, which run
  // at graph load — server-side that would throw.
  ssr: { compat: 'client-only', note: 'Scripts are injected into the browser DOM; they load after hydration.' },
  initialize: function (this: ScriptDownloaderNodeInstance) {
    const internal = this._internal;
    internal.loaded = false;
    internal.scripts = [];
    internal.loadedScripts = {};
    internal.startLoad = true;
  },
  inputs: {
    startLoad: {
      type: 'boolean',
      default: true,
      displayName: 'Load on start',
      description: 'Whether the scripts are fetched as soon as the node appears, rather than waiting for Load',
      group: 'General',
      set: function (this: ScriptDownloaderNodeInstance, value: boolean) {
        this._internal.startLoad = value;
      }
    },
    load: {
      displayName: 'Load',
      description: 'Fetches every script that is not already in the page',
      group: 'Actions',
      valueChangedToTrue: function (this: ScriptDownloaderNodeInstance) {
        this.scheduleUpdateScripts();
      }
    }
  },
  outputs: {
    loaded: {
      type: 'signal',
      displayName: 'Loaded',
      description: 'Fires once every script has finished loading; a script that fails to load reports nothing and this never fires'
    }
  },
  numberedInputs: {
    input: {
      displayPrefix: 'Script',
      group: 'External scripts',
      type: 'string',
      index: 3008,
      createSetter: function (index: number) {
        return function (this: ScriptDownloaderNodeInstance, value: unknown) {
          this._internal.scripts[index] = String(value);

          if (!this._internal.loadStarted) {
            this._internal.loadStarted = true;
            this.scheduleAfterInputsHaveUpdated(function (this: ScriptDownloaderNodeInstance) {
              this._internal.loadStarted = false;

              if (!this._internal.startLoad) {
                return;
              }

              this.updateScripts();
            });
          }
        };
      }
    }
  },
  methods: {
    removeLoadTerminator: function (this: ScriptDownloaderNodeInstance) {
      const terminatorId = 'sentinel_' + this.id;
      const elem = document.getElementById(terminatorId);
      if (elem && elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    },
    scheduleUpdateScripts: function (this: ScriptDownloaderNodeInstance) {
      const _this = this;

      if (!this._internal.updateScriptsScheduled) {
        this._internal.updateScriptsScheduled = true;
        this.scheduleAfterInputsHaveUpdated(function () {
          _this._internal.updateScriptsScheduled = false;

          _this.updateScripts();
        });
      }
    },
    updateScripts: function (this: ScriptDownloaderNodeInstance) {
      const terminatorId = 'sentinel_' + this.id;

      this.removeLoadTerminator();
      let scripts = this._internal.scripts;
      scripts = scripts.filter(function (script) {
        return script !== '';
      });

      const scriptElements = document.head.getElementsByTagName('script');
      const scriptsInHead: Record<string, HTMLScriptElement> = {};
      for (let i = 0; i < scriptElements.length; i++) {
        const element = scriptElements[i];
        if (element.src !== undefined && element.src !== '') {
          scriptsInHead[element.src] = element;
        }
      }

      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i].trim();

        if (!this._internal.loadedScripts.hasOwnProperty(script)) {
          if (scriptsInHead.hasOwnProperty(script)) {
            continue;
          }

          const scriptObj = document.createElement('script');
          scriptObj.src = script;
          scriptObj.async = false;
          document.head.appendChild(scriptObj);
        }
      }

      const self = this;
      const onLoadedScript = document.createElement('script') as LegacyScriptElement;
      onLoadedScript.onload = onLoadedScript.onreadystatechange = function (this: LegacyScriptElement) {
        if (!this.readyState || this.readyState === 'loaded' || this.readyState === 'complete') {
          self._internal.loaded = true;
          self.sendSignalOnOutput('loaded');
          self.removeLoadTerminator();
        }
      };

      // Since all scripts are downloaded synchronously, this will be loaded last and
      // signals that the others are done loading.
      onLoadedScript.id = terminatorId;
      onLoadedScript.src = 'load_terminator.js';
      onLoadedScript.async = false;
      document.head.appendChild(onLoadedScript);
    }
  }
};

const ScriptDownloadModule: NodeModule = {
  node: ScriptDownloadDefinition,
  // Does nothing but return: the body is a guard with no work behind it. Left as
  // it stands — deleting a registered `setup` is a behaviour change, not a typing one.
  setup: function (context: NodeContextLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
  }
};

export default ScriptDownloadModule;
