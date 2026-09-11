/* NodeGX Intl Format module — hand-authored (LBR-009 module expansion).
   Four locale-aware formatting nodes over the browser's built-in Intl.* APIs:
   Relative Time (Intl.RelativeTimeFormat), Format Number (Intl.NumberFormat),
   Format List (Intl.ListFormat) and Pluralize (Intl.PluralRules).
   No dependencies, no network, no API keys — everything runs client-side.
   Every input is guarded: an unconnected input never throws, it just yields
   an empty string on the output. Locale defaults to navigator.language. */

// ── Noodl node-definition SDK shim ───────────────────────────────────────────
/* Noodl node-definition SDK shim — verbatim from @noodl/noodl-sdk as shipped inside the
   custom-html and chart-js library modules. The viewer HTML prelude only provides
   Noodl.defineModule (it pushes modules into window.__noodl_modules); this installs
   Noodl.defineNode / defineReactNode / defineCollectionNode / defineModelNode so a
   hand-authored module can declare nodes without a webpack/SDK build step. */
(function () {
  if (typeof Noodl === "undefined" || typeof Noodl.defineNode === "function") return;
  function n(t){return(n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var o={purple:"component",green:"data",default:"default",grey:"default"};Noodl.defineNode=function(t){var e={};for(var r in e.name=t.name,e.displayNodeName=t.displayName,e.usePortAsLabel=t.useInputAsLabel,e.color=o[t.color||"default"],e.category=t.category||"Modules",e.getInspectInfo=t.getInspectInfo,e.docs=t.docs,e.initialize=function(){this.inputs={};var e=this.outputs={},n=this;this.setOutputs=function(t){for(var o in t)e[o]=t[o],n.flagOutputDirty(o)},this.clearWarnings=function(){this.context.editorConnection&&this.nodeScope&&this.nodeScope.componentOwner&&this.context.editorConnection.clearWarnings(this.nodeScope.componentOwner.name,this.id)}.bind(this),this.sendWarning=function(t,e){this.context.editorConnection&&this.nodeScope&&this.nodeScope.componentOwner&&this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name,this.id,t,{message:e})}.bind(this),"function"==typeof t.initialize&&t.initialize.apply(this)},e.inputs={},e.outputs={},t.inputs)e.inputs[r]={type:"object"===n(t.inputs[r])?t.inputs[r].type:t.inputs[r],displayName:"object"===n(t.inputs[r])?t.inputs[r].displayName:void 0,group:"object"===n(t.inputs[r])?t.inputs[r].group:void 0,default:"object"===n(t.inputs[r])?t.inputs[r].default:void 0,set:function(){var e=r;return function(n){this.inputs[e]=n,t.changed&&"function"==typeof t.changed[e]&&t.changed[e].apply(this,[n])}}()};for(var r in t.signals)e.inputs[r]={type:"signal",displayName:"object"===n(t.signals[r])?t.signals[r].displayName:void 0,group:"object"===n(t.signals[r])?t.signals[r].group:void 0,valueChangedToTrue:function(){var e=r;return function(){var o=this,r="object"===n(t.signals[e])?t.signals[e].signal:t.signals[e];"function"==typeof r&&this.scheduleAfterInputsHaveUpdated((function(){r.apply(o)}))}}()};for(var r in t.outputs)"signal"===t.outputs[r]?e.outputs[r]={type:"signal"}:e.outputs[r]={type:"object"===n(t.outputs[r])?t.outputs[r].type:t.outputs[r],displayName:"object"===n(t.outputs[r])?t.outputs[r].displayName:void 0,group:"object"===n(t.outputs[r])?t.outputs[r].group:void 0,getter:function(){var t=r;return function(){return this.outputs[t]}}()};for(var r in e.methods=e.prototypeExtensions={},t.methods)e.prototypeExtensions[r]=t.methods[r];return e.methods.onNodeDeleted&&(e.methods._onNodeDeleted=function(){this.__proto__.__proto__._onNodeDeleted.call(this),e.methods.onNodeDeleted.value.call(this)}),{node:e,setup:t.setup}},Noodl.defineCollectionNode=function(t){var e={name:t.name,category:t.category,color:"data",inputs:t.inputs,outputs:Object.assign({Items:"array","Fetch Started":"signal","Fetch Completed":"signal"},t.outputs||{}),signals:Object.assign({Fetch:function(){var e=this;this.sendSignalOnOutput("Fetch Started");var n=t.fetch.call(this,(function(){e.sendSignalOnOutput("Fetch Completed")}));this.setOutputs({Items:n})}},t.signals||{})};return Noodl.defineNode(e)},Noodl.defineModelNode=function(t){var e={name:t.name,category:t.category,color:"data",inputs:{Id:"string"},outputs:{Fetched:"signal"},changed:{Id:function(t){var e=this;this._object&&this._changeListener&&this._object.off("change",this._changeListener),this._object=Noodl.Object.get(t),this._changeListener=function(t,n){var o={};o[t]=n,e.setOutputs(o)},this._object.on("change",this._changeListener),this.setOutputs(this._object.data),this.sendSignalOnOutput("Fetched")}},initialize:function(){}};for(var n in t.properties)e.inputs[n]=t.properties[n],e.outputs[n]=t.properties[n],e.changed[n]=function(){var t=n;return function(e){this._object&&this._object.set(t,e)}}();return Noodl.defineNode(e)},Noodl.defineReactNode=function(t){var e=Noodl.defineNode(t);return e.node.getReactComponent=t.getReactComponent,e.node.inputProps=t.inputProps,e.node.inputCss=t.inputCss,e.node.outputProps=t.outputProps,e.node.setup=t.setup,e.node.frame=t.frame,e.node}
})();

/* ── Intl Format nodes ────────────────────────────────────────────────────────
 *
 * Follows the qr-code module pattern: the SDK shim above installs
 * Noodl.defineNode, and Noodl.defineModule (provided by the viewer prelude)
 * registers the nodes. Each node recomputes on any input change and publishes
 * a single string output, "Formatted".
 */
(function () {
  if (typeof Noodl === 'undefined' || typeof Noodl.defineNode !== 'function') return;

  // ── shared helpers (all guard undefined; none of them throw) ──────────────

  function resolveLocale(locale) {
    if (typeof locale === 'string' && locale.trim().length > 0) return locale.trim();
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
    return 'en';
  }

  // Accepts a Date, an epoch-milliseconds number, a numeric string, or a
  // date string. Returns a valid Date or null — never throws.
  function toDate(value) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
      if (!isFinite(value)) return null;
      var dn = new Date(value);
      return isNaN(dn.getTime()) ? null : dn;
    }
    if (typeof value === 'string') {
      var s = value.trim();
      if (!s) return null;
      var ds = /^-?\d+$/.test(s) ? new Date(Number(s)) : new Date(s);
      return isNaN(ds.getTime()) ? null : ds;
    }
    return null;
  }

  var REL_UNITS = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ];

  function formatRelative(date, locale, style, numeric) {
    var diffSec = (date.getTime() - Date.now()) / 1000;
    var absSec = Math.abs(diffSec);
    var unit = 'second';
    var amount = Math.round(diffSec);
    for (var i = 0; i < REL_UNITS.length; i++) {
      if (absSec >= REL_UNITS[i][1]) {
        unit = REL_UNITS[i][0];
        amount = Math.round(diffSec / REL_UNITS[i][1]);
        break;
      }
    }
    try {
      var rtf = new Intl.RelativeTimeFormat(resolveLocale(locale), {
        style: style || 'long',
        numeric: numeric || 'auto'
      });
      return rtf.format(amount, unit);
    } catch (e) {
      // Intl.RelativeTimeFormat missing or a bad locale tag — degrade, don't throw.
      return amount + ' ' + unit + (Math.abs(amount) === 1 ? '' : 's') + (diffSec < 0 ? ' ago' : '');
    }
  }

  function clampDigits(value) {
    if (value === undefined || value === null || value === '') return undefined;
    var n = Number(value);
    if (!isFinite(n)) return undefined;
    return Math.max(0, Math.min(20, Math.floor(n)));
  }

  function formatNumberValue(value, locale, style, currency, minDecimals, maxDecimals, useGrouping) {
    if (value === undefined || value === null || value === '') return '';
    var num = Number(value);
    if (!isFinite(num)) return '';
    var opts = { style: style || 'decimal' };
    if (opts.style === 'currency') {
      opts.currency =
        typeof currency === 'string' && currency.trim().length > 0 ? currency.trim().toUpperCase() : 'USD';
    }
    var minD = clampDigits(minDecimals);
    var maxD = clampDigits(maxDecimals);
    if (minD !== undefined) opts.minimumFractionDigits = minD;
    if (maxD !== undefined) opts.maximumFractionDigits = minD !== undefined ? Math.max(minD, maxD) : maxD;
    if (useGrouping === false) opts.useGrouping = false;
    try {
      return new Intl.NumberFormat(resolveLocale(locale), opts).format(num);
    } catch (e) {
      // Bad currency code or locale tag — fall back to plain decimal formatting.
      try {
        return new Intl.NumberFormat(resolveLocale(locale)).format(num);
      } catch (e2) {
        return String(num);
      }
    }
  }

  // Accepts an array, a Noodl collection-ish object with an `items` array,
  // or a comma-separated string. Returns an array of strings or null.
  function toItemsArray(items) {
    var source = null;
    if (items === undefined || items === null) return null;
    if (Array.isArray(items)) {
      source = items;
    } else if (typeof items === 'string') {
      if (!items.trim()) return null;
      source = items.split(',');
    } else if (typeof items === 'object' && Array.isArray(items.items)) {
      source = items.items;
    }
    if (!source) return null;
    var out = [];
    for (var i = 0; i < source.length; i++) {
      var v = source[i];
      if (v === undefined || v === null) continue;
      var s = String(v).trim();
      if (s.length > 0) out.push(s);
    }
    return out.length > 0 ? out : null;
  }

  function formatListValue(items, locale, type, style) {
    var arr = toItemsArray(items);
    if (!arr) return '';
    try {
      var lf = new Intl.ListFormat(resolveLocale(locale), {
        type: type || 'conjunction',
        style: style || 'long'
      });
      return lf.format(arr);
    } catch (e) {
      // Intl.ListFormat missing or a bad locale tag.
      return arr.join(', ');
    }
  }

  function pluralCategory(n, locale) {
    try {
      return new Intl.PluralRules(resolveLocale(locale)).select(n);
    } catch (e) {
      return n === 1 ? 'one' : 'other';
    }
  }

  // ── Relative Time ──────────────────────────────────────────────────────────

  var relativeTimeNode = Noodl.defineNode({
    name: 'nodegx.intl.relativeTime',
    displayName: 'Relative Time',
    category: 'Intl Format',
    color: 'green',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat',
    initialize: function () {
      this._intlTimer = null;
    },
    inputs: {
      Value: {
        type: '*',
        displayName: 'Date',
        group: 'General'
      },
      Locale: {
        type: 'string',
        displayName: 'Locale',
        group: 'Formatting'
      },
      Style: {
        type: {
          name: 'enum',
          enums: [
            { label: 'Long', value: 'long' },
            { label: 'Short', value: 'short' },
            { label: 'Narrow', value: 'narrow' }
          ]
        },
        displayName: 'Style',
        group: 'Formatting',
        default: 'long'
      },
      Numeric: {
        type: {
          name: 'enum',
          enums: [
            { label: 'Auto ("yesterday")', value: 'auto' },
            { label: 'Always ("1 day ago")', value: 'always' }
          ]
        },
        displayName: 'Numeric',
        group: 'Formatting',
        default: 'auto'
      },
      'Refresh Interval': {
        type: 'number',
        displayName: 'Refresh Interval (s)',
        group: 'General',
        default: 0
      }
    },
    outputs: {
      Formatted: {
        type: 'string',
        displayName: 'Formatted',
        group: 'General'
      },
      Updated: 'signal'
    },
    changed: {
      Value: function () {
        this._intlUpdate();
      },
      Locale: function () {
        this._intlUpdate();
      },
      Style: function () {
        this._intlUpdate();
      },
      Numeric: function () {
        this._intlUpdate();
      },
      'Refresh Interval': function () {
        this._intlUpdate();
      }
    },
    methods: {
      _intlUpdate: function () {
        var self = this;
        if (this._intlTimer) {
          clearInterval(this._intlTimer);
          this._intlTimer = null;
        }
        var date = toDate(this.inputs['Value']);
        if (!date) {
          this.setOutputs({ Formatted: '' });
          return;
        }
        var render = function () {
          self.setOutputs({
            Formatted: formatRelative(date, self.inputs['Locale'], self.inputs['Style'], self.inputs['Numeric'])
          });
          self.sendSignalOnOutput('Updated');
        };
        render();
        var refresh = Number(this.inputs['Refresh Interval']);
        if (isFinite(refresh) && refresh > 0) {
          this._intlTimer = setInterval(render, Math.max(1, refresh) * 1000);
        }
      },
      // The shim's delete hook expects a property descriptor here ({ value: fn }).
      onNodeDeleted: {
        value: function () {
          if (this._intlTimer) {
            clearInterval(this._intlTimer);
            this._intlTimer = null;
          }
        }
      }
    }
  });

  // ── Format Number ──────────────────────────────────────────────────────────

  var formatNumberNode = Noodl.defineNode({
    name: 'nodegx.intl.formatNumber',
    displayName: 'Format Number',
    category: 'Intl Format',
    color: 'green',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat',
    inputs: {
      Value: {
        type: 'number',
        displayName: 'Value',
        group: 'General'
      },
      Locale: {
        type: 'string',
        displayName: 'Locale',
        group: 'Formatting'
      },
      Style: {
        type: {
          name: 'enum',
          enums: [
            { label: 'Decimal', value: 'decimal' },
            { label: 'Currency', value: 'currency' },
            { label: 'Percent', value: 'percent' }
          ]
        },
        displayName: 'Style',
        group: 'Formatting',
        default: 'decimal'
      },
      Currency: {
        type: 'string',
        displayName: 'Currency Code',
        group: 'Formatting',
        default: 'USD'
      },
      'Minimum Decimals': {
        type: 'number',
        displayName: 'Minimum Decimals',
        group: 'Formatting'
      },
      'Maximum Decimals': {
        type: 'number',
        displayName: 'Maximum Decimals',
        group: 'Formatting'
      },
      'Use Grouping': {
        type: 'boolean',
        displayName: 'Use Grouping',
        group: 'Formatting',
        default: true
      }
    },
    outputs: {
      Formatted: {
        type: 'string',
        displayName: 'Formatted',
        group: 'General'
      }
    },
    changed: {
      Value: function () {
        this._intlUpdate();
      },
      Locale: function () {
        this._intlUpdate();
      },
      Style: function () {
        this._intlUpdate();
      },
      Currency: function () {
        this._intlUpdate();
      },
      'Minimum Decimals': function () {
        this._intlUpdate();
      },
      'Maximum Decimals': function () {
        this._intlUpdate();
      },
      'Use Grouping': function () {
        this._intlUpdate();
      }
    },
    methods: {
      _intlUpdate: function () {
        this.setOutputs({
          Formatted: formatNumberValue(
            this.inputs['Value'],
            this.inputs['Locale'],
            this.inputs['Style'],
            this.inputs['Currency'],
            this.inputs['Minimum Decimals'],
            this.inputs['Maximum Decimals'],
            this.inputs['Use Grouping']
          )
        });
      }
    }
  });

  // ── Format List ────────────────────────────────────────────────────────────

  var formatListNode = Noodl.defineNode({
    name: 'nodegx.intl.formatList',
    displayName: 'Format List',
    category: 'Intl Format',
    color: 'green',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat',
    inputs: {
      Items: {
        type: '*',
        displayName: 'Items',
        group: 'General'
      },
      Locale: {
        type: 'string',
        displayName: 'Locale',
        group: 'Formatting'
      },
      Type: {
        type: {
          name: 'enum',
          enums: [
            { label: 'Conjunction ("A, B and C")', value: 'conjunction' },
            { label: 'Disjunction ("A, B or C")', value: 'disjunction' }
          ]
        },
        displayName: 'Type',
        group: 'Formatting',
        default: 'conjunction'
      },
      Style: {
        type: {
          name: 'enum',
          enums: [
            { label: 'Long', value: 'long' },
            { label: 'Short', value: 'short' },
            { label: 'Narrow', value: 'narrow' }
          ]
        },
        displayName: 'Style',
        group: 'Formatting',
        default: 'long'
      }
    },
    outputs: {
      Formatted: {
        type: 'string',
        displayName: 'Formatted',
        group: 'General'
      }
    },
    changed: {
      Items: function () {
        this._intlUpdate();
      },
      Locale: function () {
        this._intlUpdate();
      },
      Type: function () {
        this._intlUpdate();
      },
      Style: function () {
        this._intlUpdate();
      }
    },
    methods: {
      _intlUpdate: function () {
        this.setOutputs({
          Formatted: formatListValue(
            this.inputs['Items'],
            this.inputs['Locale'],
            this.inputs['Type'],
            this.inputs['Style']
          )
        });
      }
    }
  });

  // ── Pluralize ──────────────────────────────────────────────────────────────

  var pluralizeNode = Noodl.defineNode({
    name: 'nodegx.intl.pluralize',
    displayName: 'Pluralize',
    category: 'Intl Format',
    color: 'green',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules',
    inputs: {
      Count: {
        type: 'number',
        displayName: 'Count',
        group: 'General'
      },
      One: {
        type: 'string',
        displayName: 'Singular (one)',
        group: 'General'
      },
      Other: {
        type: 'string',
        displayName: 'Plural (other)',
        group: 'General'
      },
      Locale: {
        type: 'string',
        displayName: 'Locale',
        group: 'Formatting'
      },
      'Include Count': {
        type: 'boolean',
        displayName: 'Include Count',
        group: 'Formatting',
        default: true
      }
    },
    outputs: {
      Formatted: {
        type: 'string',
        displayName: 'Formatted',
        group: 'General'
      },
      Category: {
        type: 'string',
        displayName: 'Plural Category',
        group: 'General'
      }
    },
    changed: {
      Count: function () {
        this._intlUpdate();
      },
      One: function () {
        this._intlUpdate();
      },
      Other: function () {
        this._intlUpdate();
      },
      Locale: function () {
        this._intlUpdate();
      },
      'Include Count': function () {
        this._intlUpdate();
      }
    },
    methods: {
      _intlUpdate: function () {
        var count = this.inputs['Count'];
        if (count === undefined || count === null || count === '') {
          this.setOutputs({ Formatted: '', Category: '' });
          return;
        }
        var n = Number(count);
        if (!isFinite(n)) {
          this.setOutputs({ Formatted: '', Category: '' });
          return;
        }
        var locale = this.inputs['Locale'];
        var category = pluralCategory(n, locale);
        var one = typeof this.inputs['One'] === 'string' ? this.inputs['One'].trim() : '';
        var other = typeof this.inputs['Other'] === 'string' ? this.inputs['Other'].trim() : '';
        // 'one' takes the singular form; every other CLDR category (zero, two,
        // few, many, other) takes the plural form. Fall back across the pair so
        // a single provided form still renders.
        var form = category === 'one' ? one || other : other || one;
        var includeCount = this.inputs['Include Count'] !== false;
        var formatted;
        if (includeCount) {
          var countText = formatNumberValue(n, locale, 'decimal');
          formatted = form ? countText + ' ' + form : countText;
        } else {
          formatted = form;
        }
        this.setOutputs({ Formatted: formatted, Category: category });
      }
    }
  });

  Noodl.defineModule({
    nodes: [relativeTimeNode, formatNumberNode, formatListNode, pluralizeNode],
    setup: function () {}
  });
})();
