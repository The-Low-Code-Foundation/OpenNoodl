'use strict';

import { createConfigAPI } from './api/config';
import { SeoApi } from './api/seo';

export default function createNoodlAPI(noodlRuntime) {
  // Support SSR
  const global = typeof window !== 'undefined' ? window : globalThis;

  global.Noodl.getProjectSettings = noodlRuntime.getProjectSettings.bind(noodlRuntime);
  global.Noodl.getMetaData = noodlRuntime.getMetaData.bind(noodlRuntime);

  global.Noodl.Collection = global.Noodl.Array = require('@noodl/runtime/src/collection');
  global.Noodl.Model = global.Noodl.Object = require('@noodl/runtime/src/model');
  global.Noodl.Variables = global.Noodl.Object.get('--ndl--global-variables');
  global.Noodl.Events = global.Noodl.eventEmitter = noodlRuntime.context.eventSenderEmitter;
  global.Noodl.Records = require('@noodl/runtime/src/api/records')();
  global.Noodl.Users = require('./api/users');
  global.Noodl.CloudFunctions = require('./api/cloudfunctions');
  global.Noodl.Navigation = require('./api/navigation');
  global.Noodl.Navigation._noodlRuntime = noodlRuntime;
  global.Noodl.Files = require('./api/files');
  // Idempotent on purpose: server-side rendering calls createNoodlAPI twice per
  // request — once from ssrSetupRuntime (before the runtime mounts and the
  // router populates SEO) and again from the Viewer constructor during
  // renderToString. A plain `new SeoApi()` in the second call would discard the
  // title/meta the runtime just buffered, so the served <head> would keep the
  // template defaults. Reuse an existing instance; the SSR server resets it per
  // request (static/ssr/index.js) so state never bleeds between pages. On the
  // client this is created once and its buffer is unused (the getters read the
  // live document), so preserving it is harmless there.
  global.Noodl.SEO = global.Noodl.SEO || new SeoApi();
  global.Noodl.Config = createConfigAPI(global.Noodl.getMetaData);
  if (!global.Noodl.Env) {
    global.Noodl.Env = {};
  }

  global.Noodl.Arrays = new Proxy(global.Noodl.Array, {
    get(target, prop, receiver) {
      return Noodl.Array.get(prop);
    },
    set(obj, prop, value) {
      if (!Array.isArray(value)) {
        throw new Error('Cannot assign non array value to array with id ' + prop);
      }
      Noodl.Array.get(prop).set(value);
    }
  });

  global.Noodl.Objects = new Proxy(global.Noodl.Object, {
    get(target, prop, receiver) {
      return Noodl.Object.get(prop);
    },
    set(obj, prop, value) {
      Noodl.Object.get(prop).setAll(value);
    }
  });
}
