/**
 * HTTP Node
 *
 * A modern, declarative HTTP node that makes API integration accessible to
 * no-coders while remaining powerful for developers. This replaces the
 * script-based REST node for most use cases.
 *
 * Features:
 * - URL with path parameter detection (/users/{userId})
 * - Visual headers, query params, and body configuration
 * - Authentication presets (Bearer, Basic, API Key)
 * - Response mapping with JSONPath
 * - cURL import support
 * - Pagination strategies
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

// Note: This file uses CommonJS module format to match the noodl-runtime pattern

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken,
  RuntimeDiscoveredPort
} from '@noodl/types';

import { outcomeOutputs, reportOutcomes } from '../../../outcome';

/**
 * ERG-001 — the failure codes, namespaced by node type and treated as an interface.
 *
 * ⚠️ **This node raised nothing at all before.** Every failure ended on the `error` string,
 * which an author can only poll and which no deployed app's `On App Error` ever saw. The
 * contract requires a `Failure` to be "always accompanied by a reason on the NDA-004 error
 * channel", and routing the signal through `reportOutcome` is what puts it there.
 */
const HTTP_ERROR_CODES = {
  noUrl: 'http/no-url',
  status: 'http/error-status',
  timeout: 'http/timeout',
  network: 'http/network-error'
};

/**
 * Extract value from object using JSONPath-like syntax
 * Supports: $.data.users, $.items[0].name, $.meta.pagination.total
 *
 * @param {object} obj - The object to extract from
 * @param {string} path - JSONPath expression starting with $
 * @returns {*} The extracted value or undefined
 */
function extractByPath(obj: unknown, path: string): unknown {
  if (!path || !path.startsWith('$')) return undefined;
  if (obj === undefined || obj === null) return undefined;

  const parts = path.substring(2).split('.').filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;

    // Handle array access: items[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const nested = (current as Record<string, unknown>)[arrayMatch[1]] as unknown[] | undefined;
      current = nested?.[parseInt(arrayMatch[2])];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * The empty-value contract for an HTTP request parameter
 * (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined` abstains — no value was supplied,
 * so the parameter is omitted, exactly as if the port had never been wired. `null` is an
 * explicit clear, but a URL path segment, a query string, an HTTP header and a
 * form/URL-encoded field all have no way to *represent* `null` itself (unlike a JSON body,
 * which has a native `null` — see `buildBody`'s `json` branch, the one site that does not use
 * this helper) — so for those five sites "clear it" and "omit it" are the same outcome, and
 * `null` is omitted too.
 *
 * This is the one shared guard `httpnode.ts` used to carry six independently-written copies
 * of, three of them narrower than the other three (`buildBody`'s `json` branch checked only
 * `undefined`, which turned out to be correct by accident rather than by agreement — see its
 * own comment).
 */
function hasHttpParamValue(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/**
 * Configure authentication headers/params based on preset type
 */
/** What one preset contributes to the outgoing request. */
interface AuthContribution {
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

/**
 * The values the `auth-…` dynamic inputs write, keyed *with* their prefix stripped by the
 * port names themselves (`auth-authToken` → `authToken`). Every one of these ports is
 * declared `type: 'string'` in `updatePorts`, which is why the two call sites narrow the
 * node's `Record<string, unknown>` to this on the way in.
 */
interface AuthInputs {
  authToken?: string;
  authUsername?: string;
  authPassword?: string;
  authApiKeyName?: string;
  authApiKeyValue?: string;
  authApiKeyLocation?: 'header' | 'query';
}

const authConfigurators: Record<string, (inputs: AuthInputs) => AuthContribution> = {
  none: () => ({}),

  bearer: (inputs) => ({
    headers: inputs.authToken ? { Authorization: `Bearer ${inputs.authToken}` } : {}
  }),

  basic: (inputs): AuthContribution => {
    if (!inputs.authUsername || !inputs.authPassword) return {};
    const encoded =
      typeof btoa !== 'undefined'
        ? btoa(inputs.authUsername + ':' + inputs.authPassword)
        : Buffer.from(inputs.authUsername + ':' + inputs.authPassword).toString('base64');
    return {
      headers: { Authorization: `Basic ${encoded}` }
    };
  },

  apiKey: (inputs): AuthContribution => {
    if (!inputs.authApiKeyName || !inputs.authApiKeyValue) return {};
    if (inputs.authApiKeyLocation === 'query') {
      return { queryParams: { [inputs.authApiKeyName]: inputs.authApiKeyValue } };
    }
    return { headers: { [inputs.authApiKeyName]: inputs.authApiKeyValue } };
  }
};

/**
 * `this` inside the HTTP Request node.
 *
 * Almost every port is dynamic, including `url`, `fetch` and `cancel` — `updatePorts`
 * re-publishes the *whole* set on each relevant parameter change, because the shape of the
 * node depends on its own configuration: the method decides whether there is a body, the
 * body type decides what kind, the auth preset decides which credentials, and the URL's
 * `{placeholders}` become path-parameter inputs.
 *
 * The three static `inputs` are declared as well as published dynamically. That is
 * deliberate: the static declaration is what gives them setters, the dynamic one is what
 * makes the editor draw them.
 */
interface HttpNodeInstance extends NodeInstance {
  _internal: {
    inputValues: Record<string, unknown>;
    outputValues: Record<string, unknown>;
    headers: string;
    queryParams: string;
    bodyFields: string;
    responseMapping: string;
    inspectData: Record<string, unknown> | null;
    url?: string;
    method?: string;
    bodyType?: string;
    authType?: string;
    timeout?: number;
    response?: unknown;
    statusCode?: number;
    responseHeaders?: Record<string, string>;
    error?: string;
    lastRequestUrl?: string;
    hasScheduledFetch?: boolean;
    abortController?: AbortController | null;
    /**
     * ERG-001 — `Fetch` pulses no `doFetch` call has taken ownership of yet.
     *
     * ⚠️ **Drained into a local the promise closure captures, never read from here after the
     * request starts.** Requests genuinely overlap on this node — `hasScheduledFetch` is
     * cleared at the top of `doFetch`, so a second `Fetch` while one is in flight starts a
     * second request — and a token left on `_internal` would be settled by whichever response
     * happened to land first. The array is for `scheduleFetch`'s same-pass guard, which must
     * coalesce the *work* without coalescing the *outcomes*.
     */
    pendingFetchOutcomes: OutcomeToken[];
  };
  _storeInputValue(name: string, value: unknown): void;
  getOutputValue(name: string): unknown;
  scheduleFetch(): void;
  cancelFetch(token: OutcomeToken): void;
  buildUrl(): string;
  buildHeaders(): Record<string, string>;
  buildBody(): BodyInit | undefined;
  processResponse(response: Response, responseBody: unknown): void;
  doFetch(): void;
  setHeaders(value: unknown): void;
  setQueryParams(value: unknown): void;
  setBodyType(value: unknown): void;
  setBodyFields(value: unknown): void;
  setResponseMapping(value: unknown): void;
  setAuthType(value: unknown): void;
  setMethod(value: unknown): void;
  setTimeout(value: unknown): void;
}

const HttpNode: NodeDefinitionOptions = {
  name: 'net.noodl.HTTP',
  displayNodeName: 'HTTP Request',
  docs: 'https://docs.noodl.net/nodes/data/http-request',
  category: 'Data',
  color: 'data',
  searchTags: ['http', 'request', 'fetch', 'api', 'rest', 'curl'],

  initialize: function (this: HttpNodeInstance) {
    this._internal.inputValues = {};
    this._internal.outputValues = {};
    this._internal.headers = '';
    this._internal.queryParams = '';
    this._internal.bodyFields = '';
    this._internal.responseMapping = '';
    this._internal.inspectData = null;
    this._internal.pendingFetchOutcomes = [];
  },

  getInspectInfo(this: HttpNodeInstance): InspectInfo {
    if (!this._internal.inspectData) {
      return { type: 'text', value: '[Not executed yet]' };
    }
    return { type: 'value', value: this._internal.inspectData };
  },

  inputs: {
    // Static inputs - these don't need to trigger port regeneration
    url: {
      type: 'string',
      displayName: 'URL',
      group: 'Request',
      default: '',
      description:
        'Address the request is sent to; any {name} in it becomes a Path Parameter input, and leaving it blank fails the request rather than sending one',
      set: function (this: HttpNodeInstance, value: unknown) {
        this._internal.url = value as string;
      }
    },
    fetch: {
      type: 'signal',
      displayName: 'Fetch',
      group: 'Actions',
      description: 'Sends the request using the values currently on the inputs',
      valueChangedToTrue: function (this: HttpNodeInstance) {
        this._internal.pendingFetchOutcomes.push(this.beginOutcome());
        this.scheduleFetch();
      }
    },
    cancel: {
      type: 'signal',
      displayName: 'Cancel',
      group: 'Actions',
      description:
        'Abandons a request that is still in flight, which answers on Canceled rather than Failure; reports Unchanged when there is nothing to cancel',
      valueChangedToTrue: function (this: HttpNodeInstance) {
        // Minted here and settled synchronously inside `cancelFetch`, which is not scheduled —
        // one pulse is one call, so there is nothing to batch.
        this.cancelFetch(this.beginOutcome());
      }
    }
    // Note: method, timeout, and config ports are now dynamic (in updatePorts)
  },

  outputs: {
    response: {
      type: '*',
      displayName: 'Response',
      group: 'Response',
      description:
        'Body the server sent, parsed as JSON when it said so and as text otherwise; it keeps the previous body when a request never reached the server',
      getter: function (this: HttpNodeInstance) {
        return this._internal.response;
      }
    },
    statusCode: {
      type: 'number',
      displayName: 'Status Code',
      group: 'Response',
      description:
        'HTTP status the server answered with; it keeps the previous status when a request timed out or never reached the server',
      getter: function (this: HttpNodeInstance) {
        return this._internal.statusCode;
      }
    },
    responseHeaders: {
      type: 'object',
      displayName: 'Response Headers',
      group: 'Response',
      description: 'Every header the server returned, keyed by lower-cased header name',
      getter: function (this: HttpNodeInstance) {
        return this._internal.responseHeaders;
      }
    },
    /**
     * Kept, and deliberately not folded into the outcome ports.
     *
     * `Canceled` says *why* a request ended without an answer, which the outcome cannot: an
     * abandoned request reports `Unchanged` — nothing arrived, and `Response` and `Status Code`
     * still hold what they held — and so would a `Cancel` with nothing in flight. This is the
     * port that tells those apart, and it fires before the outcome so a graph reading it
     * already has it when the pulse lands.
     */
    canceled: {
      type: 'signal',
      displayName: 'Canceled',
      group: 'Events',
      description: 'Fires only when Cancel abandoned a request in flight; a timeout answers on Failure instead'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'What went wrong with the last request, in one sentence; unchanged when a request succeeds',
      getter: function (this: HttpNodeInstance) {
        return this._internal.error;
      }
    },

    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001. Two actions, `Fetch` and `Cancel`, share one port set.
    //
    // ⚠️ **`success` was renamed to `done`.** It was a pure invocation outcome — the 2xx branch
    // of `doFetch` is its only sender — so keeping it beside `Done` would have been two names
    // for one thing. `failure` keeps its name, because it already carried the contract's
    // meaning exactly.
    //
    // ⚠️ **The reserved-name sweep (FINDINGS SR-ix) is clean here by construction, not by
    // luck.** This node mints dynamic outputs from an author's Response Mapping, and
    // `registerOutputIfNeeded` prefixes every one of them with `out-`. A mapping an author
    // names "completed" becomes `out-completed`, so it cannot collide with these ports however
    // the author spells it.
    ...outcomeOutputs({
      done: 'Fires once the server has answered with a 2xx status and Response is up to date',
      unchanged:
        'Fires when nothing was fetched and nothing changed: a Cancel that abandoned a request ' +
        'in flight, or a Cancel with no request to abandon. Canceled tells those two apart',
      failure:
        'Fires when the request could not be completed — no URL, a network error, a timeout, ' +
        'an unparseable body, or a non-2xx status — after the reason has been put on Error'
    })
  },

  prototypeExtensions: {
    // Store values for dynamic inputs only - static inputs (including signals)
    // use the base Node.prototype.setInputValue which calls input.set()
    _storeInputValue: function (this: HttpNodeInstance, name: string, value: unknown) {
      this._internal.inputValues[name] = value;
    },

    getOutputValue: function (this: HttpNodeInstance, name: string) {
      return this._internal.outputValues[name];
    },

    registerOutputIfNeeded: function (this: HttpNodeInstance, name: string) {
      if (this.hasOutput(name)) return;

      if (name.startsWith('out-')) {
        this.registerOutput(name, {
          getter: this.getOutputValue.bind(this, name)
        });
      }
    },

    registerInputIfNeeded: function (this: HttpNodeInstance, name: string) {
      if (this.hasInput(name)) return;

      // Configuration inputs - these set internal state
      const configSetters: Record<string, (value: unknown) => void> = {
        method: this.setMethod.bind(this),
        timeout: this.setTimeout.bind(this),
        headers: this.setHeaders.bind(this),
        queryParams: this.setQueryParams.bind(this),
        bodyType: this.setBodyType.bind(this),
        bodyFields: this.setBodyFields.bind(this),
        authType: this.setAuthType.bind(this),
        responseMapping: this.setResponseMapping.bind(this)
      };

      if (configSetters[name]) {
        return this.registerInput(name, {
          set: configSetters[name]
        });
      }

      // Dynamic inputs for path params, headers, query params, body fields, auth, mapping paths
      // These use _storeInputValue to just store values (no signal trigger needed)
      const dynamicPrefixes = ['path-', 'header-', 'query-', 'body-', 'auth-', 'mapping-path-'];

      for (const prefix of dynamicPrefixes) {
        if (name.startsWith(prefix)) {
          return this.registerInput(name, {
            set: this._storeInputValue.bind(this, name)
          });
        }
      }
    },

    scheduleFetch: function (this: HttpNodeInstance) {
      if (this._internal.hasScheduledFetch) {
        return;
      }
      this._internal.hasScheduledFetch = true;
      this.scheduleAfterInputsHaveUpdated(this.doFetch.bind(this));
    },

    /**
     * ERG-001 — `Cancel` is this node's second action port and owed its own outcome.
     *
     * ⚠️ **The `if` used to have no `else`, and that was a dead chain**: a `Cancel` pulsed when
     * nothing was in flight did nothing, said nothing, and left an author's "when the cancel
     * has been handled, re-enable the button" chain hanging exactly when there was nothing to
     * cancel. `Unchanged` is what that branch means.
     *
     * The abort itself is `Done` and is reported straight away — this method is synchronous
     * and the abort has happened by the time it returns. The *request's* own invocation is a
     * different one and settles later, in `doFetch`'s `catch`, as `Unchanged` beside `Canceled`.
     * Two `Completed`s for one cancelled request is two action ports invoked, not a duplicate.
     */
    cancelFetch: function (this: HttpNodeInstance, token: OutcomeToken) {
      if (this._internal.abortController) {
        this._internal.abortController.abort();
        this._internal.abortController = null;
        this.reportOutcome(token, 'done');
        return;
      }

      this.reportOutcome(token, 'unchanged');
    },

    buildUrl: function (this: HttpNodeInstance) {
      let url = this._internal.url || '';

      // Replace path parameters: /users/{userId} → /users/123
      const pathParams = url.match(/\{([A-Za-z0-9_]+)\}/g) || [];
      for (const param of pathParams) {
        const name = param.replace(/[{}]/g, '');
        const value = this._internal.inputValues['path-' + name];
        if (hasHttpParamValue(value)) {
          url = url.replace(param, encodeURIComponent(String(value)));
        }
      }

      // Add query parameters
      const queryParams: Record<string, unknown> = {};

      // From visual config (stringlist format)
      if (this._internal.queryParams) {
        const queryList = this._internal.queryParams
          .split(',')
          .map((q) => q.trim())
          .filter(Boolean);
        for (const qp of queryList) {
          const value = this._internal.inputValues['query-' + qp];
          // `value !== ''` is pre-existing and orthogonal to the empty-value contract — an
          // author-typed empty string omits a query param the same way it always has.
          if (hasHttpParamValue(value) && value !== '') {
            queryParams[qp] = value;
          }
        }
      }

      // From auth (API Key in query)
      const authType = this._internal.authType;
      if (authType && authConfigurators[authType]) {
        const authConfig = authConfigurators[authType](this._internal.inputValues as AuthInputs);
        if (authConfig.queryParams) {
          Object.assign(queryParams, authConfig.queryParams);
        }
      }

      // Append query string
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }

      return url;
    },

    buildHeaders: function (this: HttpNodeInstance) {
      const headers: Record<string, string> = {};

      // From visual config (stringlist format)
      if (this._internal.headers) {
        const headerList = this._internal.headers
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean);
        for (const h of headerList) {
          const value = this._internal.inputValues['header-' + h];
          if (hasHttpParamValue(value)) {
            headers[h] = String(value);
          }
        }
      }

      // From auth
      const authType = this._internal.authType;
      if (authType && authConfigurators[authType]) {
        const authConfig = authConfigurators[authType](this._internal.inputValues as AuthInputs);
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers);
        }
      }

      return headers;
    },

    buildBody: function (this: HttpNodeInstance): BodyInit | undefined {
      const method = this._internal.method || 'GET';
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return undefined;
      }

      const bodyType = this._internal.bodyType || 'json';
      const bodyFieldsStr = this._internal.bodyFields || '';

      // Parse stringlist format
      const bodyFields = bodyFieldsStr
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      if (bodyType === 'json') {
        const body: Record<string, unknown> = {};
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field];
          // Deliberately not `hasHttpParamValue`: JSON has a native `null`, so this is the
          // one site where "clear it" and "omit it" are different outcomes. `undefined`
          // still abstains (the field is left out of the body entirely); `null` is kept and
          // reaches `JSON.stringify` as JSON `null`.
          if (value !== undefined) {
            body[field] = value;
          }
        }
        return Object.keys(body).length > 0 ? JSON.stringify(body) : undefined;
      } else if (bodyType === 'form') {
        const formData = new FormData();
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field];
          // `FormData` has no `null` — appending one would coerce to the four-character
          // string "null" — so, like the path/query/header sites, `null` is omitted here.
          if (hasHttpParamValue(value)) {
            formData.append(field, value as string);
          }
        }
        return formData;
      } else if (bodyType === 'urlencoded') {
        const params = new URLSearchParams();
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field];
          // Same reasoning as the form branch above: `URLSearchParams` has no `null` either.
          if (hasHttpParamValue(value)) {
            params.append(field, String(value));
          }
        }
        return params.toString();
      } else if (bodyType === 'raw') {
        return this._internal.inputValues['body-raw'] as BodyInit;
      }

      return undefined;
    },

    processResponse: function (this: HttpNodeInstance, response: Response, responseBody: unknown) {
      // Store raw response
      this._internal.response = responseBody;
      this._internal.statusCode = response.status;

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      this._internal.responseHeaders = responseHeaders;

      // Process response mappings
      // Output names are in responseMapping (comma-separated)
      // Path for each output is in inputValues['mapping-path-{name}']
      const mappingStr = this._internal.responseMapping || '';
      const outputNames = mappingStr
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

      for (const name of outputNames) {
        // Get the path from the corresponding input port
        const path = (this._internal.inputValues['mapping-path-' + name] as string) || '$';

        const outputName = 'out-' + name;
        const value = extractByPath(responseBody, path);

        this.registerOutputIfNeeded(outputName);
        this._internal.outputValues[outputName] = value;
        this.flagOutputDirty(outputName);
      }

      // Flag standard outputs
      this.flagOutputDirty('response');
      this.flagOutputDirty('statusCode');
      this.flagOutputDirty('responseHeaders');

      // Update inspect data
      this._internal.inspectData = {
        url: this._internal.lastRequestUrl,
        method: this._internal.method,
        status: response.status,
        response: responseBody
      };
    },

    doFetch: function (this: HttpNodeInstance) {
      this._internal.hasScheduledFetch = false;

      // ⚠️ Drained into a local the closures below capture. Requests on this node overlap —
      // `hasScheduledFetch` is cleared on the line above, so a second `Fetch` while one is in
      // flight starts a second request — and reading `_internal` from a `.then` would settle
      // whichever invocation's tokens happened to be sitting there when the response landed.
      const tokens = this._internal.pendingFetchOutcomes;
      this._internal.pendingFetchOutcomes = [];

      const url = this.buildUrl();
      const method = this._internal.method || 'GET';
      const headers = this.buildHeaders();
      const body = this.buildBody();
      const timeout = this._internal.timeout || 30000;

      // Store for inspect
      this._internal.lastRequestUrl = url;

      // Validate URL
      if (!url) {
        this._internal.error = 'URL is required';
        this.flagOutputDirty('error');
        reportOutcomes(this, tokens, 'failure', {
          code: HTTP_ERROR_CODES.noUrl,
          message: 'URL is required, so no request could be sent'
        });
        return;
      }

      // Set up abort controller for timeout and cancel
      const abortController = new AbortController();
      this._internal.abortController = abortController;

      /**
       * NDA-012 (Data) — which of the two aborts this was.
       *
       * `AbortController` gives the `catch` one `AbortError` for both the author's `Cancel`
       * and this node's own timeout, and the handler used to answer `canceled` for both.
       * **Measured against a local `node:http` server: a request that exceeded `Timeout (ms)`
       * fired `Canceled`, left `Error` `undefined`, and raised nothing** — so the node's own
       * documented failure mode was reported on the one port an author only wires when they
       * asked for the abort themselves, with no diagnosis anywhere.
       *
       * Per-invocation rather than on `_internal`, so overlapping requests cannot answer for
       * each other.
       */
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, timeout);

      // Set Content-Type for JSON body if not already set
      const bodyType = this._internal.bodyType || 'json';
      if (body && bodyType === 'json' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      } else if (body && bodyType === 'urlencoded' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      // Perform fetch
      fetch(url, {
        method: method,
        headers: headers,
        body: body,
        signal: abortController.signal
      })
        .then((response) => {
          clearTimeout(timeoutId);
          this._internal.abortController = null;

          // Parse response based on content type
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return response.json().then((json) => ({ response, body: json }));
          } else {
            return response.text().then((text) => ({ response, body: text }));
          }
        })
        .then(({ response, body }) => {
          this.processResponse(response, body);

          // Send the outcome based on status. `processResponse` above has already flagged
          // every value output, so the pulse lands on a node an author can read.
          if (response.ok) {
            reportOutcomes(this, tokens, 'done');
          } else {
            this._internal.error = `HTTP ${response.status}: ${response.statusText}`;
            this.flagOutputDirty('error');
            reportOutcomes(this, tokens, 'failure', {
              code: HTTP_ERROR_CODES.status,
              message: `The server answered ${response.status} ${response.statusText}`,
              detail: { url: this._internal.lastRequestUrl, status: response.status }
            });
          }
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          this._internal.abortController = null;

          if (error.name === 'AbortError' && !timedOut) {
            // The author pressed Cancel. Nothing went wrong, so nothing is reported.
            //
            // ⚠️ ERG-001 — the *invocation* is `Unchanged`, not `Failure` and not `Done`. An
            // abort the author asked for is the graph doing what it was told, so folding it
            // into `Failure` is the collapse Rule 1 exists to stop; and nothing changed —
            // `Response` and `Status Code` still hold exactly what they held, as the pinned
            // row below records. `Canceled` above is what names the cause.
            this.sendSignalOnOutput('canceled');
            reportOutcomes(this, tokens, 'unchanged');
          } else {
            // A timeout is a failure with a cause worth naming — the number that produced it
            // is the one the author can change, so the message states it (FAILURE-CONTRACT).
            this._internal.error = timedOut
              ? `Request timed out after ${timeout} ms`
              : error.message || 'Network error';
            this.flagOutputDirty('error');
            reportOutcomes(this, tokens, 'failure', {
              code: timedOut ? HTTP_ERROR_CODES.timeout : HTTP_ERROR_CODES.network,
              message: this._internal.error,
              detail: { url: this._internal.lastRequestUrl, timeout: timedOut ? timeout : undefined }
            });
          }

          this._internal.inspectData = {
            url: this._internal.lastRequestUrl,
            method: method,
            error: this._internal.error
          };
        });
    },

    // Configuration setters called from setup function
    setHeaders: function (this: HttpNodeInstance, value: unknown) {
      this._internal.headers = (value as string) || '';
    },

    setQueryParams: function (this: HttpNodeInstance, value: unknown) {
      this._internal.queryParams = (value as string) || '';
    },

    setBodyType: function (this: HttpNodeInstance, value: unknown) {
      this._internal.bodyType = value as string;
    },

    setBodyFields: function (this: HttpNodeInstance, value: unknown) {
      this._internal.bodyFields = (value as string) || '';
    },

    setResponseMapping: function (this: HttpNodeInstance, value: unknown) {
      this._internal.responseMapping = (value as string) || '';
    },

    setAuthType: function (this: HttpNodeInstance, value: unknown) {
      this._internal.authType = value as string;
    },

    setMethod: function (this: HttpNodeInstance, value: unknown) {
      this._internal.method = (value as string) || 'GET';
    },

    setTimeout: function (this: HttpNodeInstance, value: unknown) {
      this._internal.timeout = (value as number) || 30000;
    }
  }
};

/**
 * Update dynamic ports based on node configuration
 */
function updatePorts(nodeId: string, parameters: Record<string, unknown>, editorConnection: EditorConnectionLike) {
  const ports: RuntimeDiscoveredPort[] = [];

  // Parse URL for path parameters: /users/{userId} → userId port
  if (parameters.url) {
    const pathParams = (parameters.url as string).match(/\{([A-Za-z0-9_]+)\}/g) || [];
    const uniqueParams = [...new Set(pathParams.map((p) => p.replace(/[{}]/g, '')))];

    for (const name of uniqueParams) {
      ports.push({
        name: 'path-' + name,
        displayName: name,
        type: 'string',
        plug: 'input',
        group: 'Path Parameters',
        description:
          'undefined or null leaves the {' +
          name +
          '} placeholder in the URL literally, unreplaced — a path segment cannot be empty.'
      });
    }
  }

  // Headers configuration - comma-separated list
  ports.push({
    name: 'headers',
    displayName: 'Headers',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Headers',
    description: 'Names the request headers to send; each name listed here gets its own value input'
  });

  // Generate input ports for each header
  if (parameters.headers) {
    const headerList = (parameters.headers as string)
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    for (const header of headerList) {
      ports.push({
        name: 'header-' + header,
        displayName: header,
        type: 'string',
        plug: 'input',
        group: 'Headers',
        description: 'undefined or null omits this header — an HTTP header has no way to carry null.'
      });
    }
  }

  // Query parameters configuration - comma-separated list
  ports.push({
    name: 'queryParams',
    displayName: 'Query Parameters',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Query Parameters',
    description: 'Names the query-string parameters to append to the URL; each name listed here gets its own value input'
  });

  // Generate input ports for each query param
  if (parameters.queryParams) {
    const queryList = (parameters.queryParams as string)
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);
    for (const param of queryList) {
      ports.push({
        name: 'query-' + param,
        displayName: param,
        type: 'string',
        plug: 'input',
        group: 'Query Parameters',
        description:
          "undefined, null or '' omits this query parameter — a query string has no way to carry null."
      });
    }
  }

  // Method selector as dynamic port (so we can track parameter changes properly)
  ports.push({
    name: 'method',
    displayName: 'Method',
    type: {
      name: 'enum',
      enums: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'PATCH', value: 'PATCH' },
        { label: 'DELETE', value: 'DELETE' },
        { label: 'HEAD', value: 'HEAD' },
        { label: 'OPTIONS', value: 'OPTIONS' }
      ],
      allowEditOnly: true
    },
    default: 'GET',
    plug: 'input',
    group: 'Request',
    description: 'HTTP verb the request is sent with; GET, HEAD and OPTIONS send no body and hide the Body group'
  });

  // Body type selector (only shown for POST/PUT/PATCH)
  const method = (parameters.method as string) || 'GET';
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    ports.push({
      name: 'bodyType',
      displayName: 'Body Type',
      type: {
        name: 'enum',
        enums: [
          { label: 'JSON', value: 'json' },
          { label: 'Form Data', value: 'form' },
          { label: 'URL Encoded', value: 'urlencoded' },
          { label: 'Raw', value: 'raw' }
        ],
        allowEditOnly: true
      },
      default: 'json',
      plug: 'input',
      group: 'Body',
      description:
        'How the body is encoded, which decides both the Content-Type sent and whether a null field value is kept or omitted'
    });

    // Body fields configuration - comma-separated list
    const bodyType = parameters.bodyType || 'json';
    if (bodyType === 'json' || bodyType === 'form' || bodyType === 'urlencoded') {
      ports.push({
        name: 'bodyFields',
        displayName: 'Body Fields',
        type: { name: 'stringlist', allowEditOnly: true },
        plug: 'input',
        group: 'Body',
        description: 'Names the fields to put in the request body; each name listed here gets its own value and type input'
      });

      // Type options for body fields
      const _types = [
        { label: 'String', value: 'string' },
        { label: 'Number', value: 'number' },
        { label: 'Boolean', value: 'boolean' },
        { label: 'Array', value: 'array' },
        { label: 'Object', value: 'object' },
        { label: 'Any', value: '*' }
      ];

      // Generate type selector and value input ports for each body field
      if (parameters.bodyFields) {
        const fieldList = (parameters.bodyFields as string)
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
        for (const field of fieldList) {
          // Get the selected type for this field (default to string)
          const fieldType = (parameters['body-type-' + field] as string) || 'string';

          // Type selector for this field
          ports.push({
            name: 'body-type-' + field,
            displayName: field + ' Type',
            type: {
              name: 'enum',
              enums: _types,
              allowEditOnly: true
            },
            default: 'string',
            plug: 'input',
            group: 'Body',
            description: 'Type the matching value input accepts and is sent as'
          });

          // Value input for this field (type matches selected type)
          ports.push({
            name: 'body-' + field,
            displayName: field,
            type: fieldType,
            plug: 'input',
            group: 'Body',
            // Empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): undefined
            // always abstains and omits the field. What null does depends on the body's
            // encoding — JSON has a native null, so it is kept and sent; Form Data and
            // URL Encoded have no way to represent null, so it is omitted like undefined.
            description:
              bodyType === 'json'
                ? 'undefined omits this field from the JSON body. null is kept and sent as JSON null.'
                : 'undefined or null omits this field — this encoding has no way to carry null.'
          });
        }
      }
    } else if (bodyType === 'raw') {
      // Raw body - use code editor with JSON syntax
      ports.push({
        name: 'body-raw',
        displayName: 'Body',
        type: { name: 'string', allowEditOnly: true, codeeditor: 'json' },
        plug: 'input',
        group: 'Body',
        description: 'Body sent verbatim, with no encoding applied and no Content-Type added for you'
      });
    }
  }

  // Authentication
  ports.push({
    name: 'authType',
    displayName: 'Authentication',
    type: {
      name: 'enum',
      enums: [
        { label: 'None', value: 'none' },
        { label: 'Bearer Token', value: 'bearer' },
        { label: 'Basic Auth', value: 'basic' },
        { label: 'API Key', value: 'apiKey' }
      ],
      allowEditOnly: true
    },
    default: 'none',
    plug: 'input',
    group: 'Authentication',
    description: 'Credential scheme to apply, which decides which credential inputs appear below'
  });

  // Auth-specific inputs
  const authType = parameters.authType || 'none';
  if (authType === 'bearer') {
    ports.push({
      name: 'auth-authToken',
      displayName: 'Token',
      type: 'string',
      plug: 'input',
      group: 'Authentication',
      description: 'Token sent as "Authorization: Bearer …"; leave blank and no Authorization header is sent at all'
    });
  } else if (authType === 'basic') {
    ports.push({
      name: 'auth-authUsername',
      displayName: 'Username',
      type: 'string',
      plug: 'input',
      group: 'Authentication',
      description: 'Half of the Basic credential; no Authorization header is sent unless both this and Password are set'
    });
    ports.push({
      name: 'auth-authPassword',
      displayName: 'Password',
      type: 'string',
      plug: 'input',
      group: 'Authentication',
      description: 'Half of the Basic credential; no Authorization header is sent unless both this and Username are set'
    });
  } else if (authType === 'apiKey') {
    ports.push({
      name: 'auth-authApiKeyName',
      displayName: 'Key Name',
      type: 'string',
      plug: 'input',
      group: 'Authentication',
      description: 'Header or query-parameter name the key is sent under; nothing is sent unless Key Value is set too'
    });
    ports.push({
      name: 'auth-authApiKeyValue',
      displayName: 'Key Value',
      type: 'string',
      plug: 'input',
      group: 'Authentication',
      description: 'The key itself; nothing is sent unless Key Name is set too'
    });
    ports.push({
      name: 'auth-authApiKeyLocation',
      displayName: 'Add To',
      type: {
        name: 'enum',
        enums: [
          { label: 'Header', value: 'header' },
          { label: 'Query Parameter', value: 'query' }
        ]
      },
      default: 'header',
      plug: 'input',
      group: 'Authentication',
      description: 'Whether the API key travels as a request header or as a query-string parameter'
    });
  }

  // Timeout setting
  ports.push({
    name: 'timeout',
    displayName: 'Timeout (ms)',
    type: 'number',
    default: 30000,
    plug: 'input',
    group: 'Request',
    description:
      'Time before the request is abandoned, in milliseconds; abandoning it fires Failure, not Canceled, and 0 or blank means 30000'
  });

  // Response mapping - add output names, then specify JSONPath for each
  // User adds output names like: userId, userName, totalCount
  // For each name, we generate a "Path" input and an output port
  ports.push({
    name: 'responseMapping',
    displayName: 'Output Fields',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Response Mapping',
    description: 'Names the values to pull out of the response; each name listed here gets a Path input and an output port'
  });

  // Signal inputs - MUST be in dynamic ports for editor to show them
  ports.push({
    name: 'fetch',
    displayName: 'Fetch',
    type: 'signal',
    plug: 'input',
    group: 'Actions',
    description: 'Sends the request using the values currently on the inputs'
  });

  ports.push({
    name: 'cancel',
    displayName: 'Cancel',
    type: 'signal',
    plug: 'input',
    group: 'Actions',
    description: 'Abandons a request that is still in flight, which answers on Canceled rather than Failure'
  });

  // URL input - also needs to be in dynamic ports
  ports.push({
    name: 'url',
    displayName: 'URL',
    type: 'string',
    plug: 'input',
    group: 'Request',
    description:
      'Address the request is sent to; any {name} in it becomes a Path Parameter input, and leaving it blank fails the request rather than sending one'
  });

  // Generate path input ports and output ports for each response mapping
  if (parameters.responseMapping && typeof parameters.responseMapping === 'string') {
    const outputNames = (parameters.responseMapping as string)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    for (const name of outputNames) {
      // Path input port for specifying JSONPath (e.g., $.data.id)
      ports.push({
        name: 'mapping-path-' + name,
        displayName: name + ' Path',
        type: 'string',
        default: '$',
        plug: 'input',
        group: 'Response Mapping',
        description:
          'Where to read this value from in the response, as $.a.b or $.items[0].c; $ is the whole body, and a path that matches nothing yields no value'
      });

      // Output port for the extracted value
      ports.push({
        name: 'out-' + name,
        displayName: name,
        type: '*',
        plug: 'output',
        group: 'Response',
        description: 'Value read out of the response at ' + name + ' Path, refreshed on every answer'
      });
    }
  }

  // Standard outputs
  ports.push({
    name: 'response',
    displayName: 'Response',
    type: '*',
    plug: 'output',
    group: 'Response',
    description:
      'Body the server sent, parsed as JSON when it said so and as text otherwise; it keeps the previous body when a request never reached the server'
  });

  ports.push({
    name: 'statusCode',
    displayName: 'Status Code',
    type: 'number',
    plug: 'output',
    group: 'Response',
    description:
      'HTTP status the server answered with; it keeps the previous status when a request timed out or never reached the server'
  });

  ports.push({
    name: 'responseHeaders',
    displayName: 'Response Headers',
    type: 'object',
    plug: 'output',
    group: 'Response',
    description: 'Every header the server returned, keyed by lower-cased header name'
  });

  ports.push({
    name: 'success',
    displayName: 'Success',
    type: 'signal',
    plug: 'output',
    group: 'Events',
    description: 'Fires once the server has answered with a 2xx status and Response is up to date'
  });

  ports.push({
    name: 'failure',
    displayName: 'Failure',
    type: 'signal',
    plug: 'output',
    group: 'Events',
    description:
      'Fires when the request could not be completed — no URL, a network error, a timeout, an unparseable body, or a non-2xx status — after the reason has been put on Error'
  });

  ports.push({
    name: 'canceled',
    displayName: 'Canceled',
    type: 'signal',
    plug: 'output',
    group: 'Events',
    description: 'Fires only when Cancel abandoned a request in flight; a timeout answers on Failure instead'
  });

  ports.push({
    name: 'error',
    displayName: 'Error',
    type: 'string',
    plug: 'output',
    group: 'Events',
    description: 'What went wrong with the last request, in one sentence; unchanged when a request succeeds'
  });

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const HttpNodeModule: NodeModule = {
  node: HttpNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(node.id, node.parameters || {}, context.editorConnection);

      node.on('parameterUpdated', function (event: { name: string }) {
        // Update ports when configuration changes
        if (
          event.name === 'url' ||
          event.name === 'method' ||
          event.name === 'headers' ||
          event.name === 'queryParams' ||
          event.name === 'bodyType' ||
          event.name === 'bodyFields' ||
          event.name === 'authType' ||
          event.name === 'responseMapping' ||
          event.name.startsWith('body-type-') // Body field type changes
        ) {
          updatePorts(node.id, node.parameters, context.editorConnection);
        }
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.net.noodl.HTTP', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('net.noodl.HTTP')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = HttpNodeModule;
