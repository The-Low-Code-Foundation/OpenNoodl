'use strict';

const Model = require('@noodl/runtime/src/model');
const NoodlRuntime = require('@noodl/runtime');
const JavascriptNodeParser = require('@noodl/runtime/src/javascriptnodeparser');

//Cloud functions override some of the JavascriptNodeParser functions

//Override getComponentScopeForNode so the 'Component' API lives exactly as long as its request.
//
//DEF-023 (phase 78 D35): this used to return ONE module-level object — so `Component` state
//survived the request that filled it and was shared between every script, every function and
//every CONCURRENT request in the process. A graph that guarded itself on a Component flag
//returned early on the previous request's flag, fired no outcome, and hung to the 30s 504.
//
//Keyed on the component-owner INSTANCE, not its id: ids repeat across requests, but each
//request instantiates a fresh graph, so a WeakMap on the instance gives scripts in one
//component instance a shared scope (the browser contract, and the only reason `Component`
//is useful) while a new request starts clean. Entries die with the request's graph, which
//is the leak the old single-object override existed to stop.
const componentScopes = new WeakMap();
JavascriptNodeParser.getComponentScopeForNode = function (node) {
  const owner = node && node.nodeScope && node.nodeScope.componentOwner;
  const key = owner || node;
  if (!key || typeof key !== 'object') return {};
  let scope = componentScopes.get(key);
  if (scope === undefined) {
    scope = {};
    componentScopes.set(key, scope);
  }
  return scope;
};

//override the Noodl API so it uses a model scope
JavascriptNodeParser.createNoodlAPI = function (modelScope) {
  return {
    getProjectSettings: NoodlRuntime.instance.getProjectSettings.bind(NoodlRuntime.instance),
    getMetaData: NoodlRuntime.instance.getMetaData.bind(NoodlRuntime.instance),
    Object: modelScope || Model,
    Variables: (modelScope || Model).get('--ndl--global-variables'),
    Records: require('@noodl/runtime/src/api/records')(modelScope),
    Users: require('./api/users')(modelScope),
    //   CloudFunctions: require('./api/cloudfunctions'),
    Files: require('./api/files'),
    Objects: new Proxy(modelScope || Model, {
      get(target, prop, receiver) {
        return (modelScope || Model).get(prop);
      },
      set(obj, prop, value) {
        (modelScope || Model).get(prop).setAll(value);
      }
    })
  };
};
