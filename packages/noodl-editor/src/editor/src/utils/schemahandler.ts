import { matchEndpointToManaged } from '@noodl-models/BackendServices/backendList';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices } from '@noodl-models/projectmodel.editor';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { getIpc } from './ipc';
import { decideSchemaCache, type SchemaFetchOutcome } from './schemaCachePolicy';

/**
 * WF-007: this used to cross-reference the deleted CloudServicePanel's stored
 * external Parse environments (`CloudService.instance.backend`) to find a
 * master key for a project's configured endpoint, then hit that Parse
 * server's master-key-gated `/schemas`, `/config`, and `/serverInfo` — a
 * schema-introspection admin surface feeding the DB-collection picker and
 * AiAssistant's `DatabaseSchemaExtractor`.
 *
 * That surface is retired along with the rest of the Parse management
 * framework (BACKEND-GAP-ASSESSMENT §3.4: "no master-key admin surface,
 * ever") — the relocated Backend Services endpoint config never stores a
 * master key, so there is nothing left to authenticate schema introspection
 * with.
 *
 * ## AAQ-002 — and that left the built-in backend with no schema at all
 *
 * Richard's finding #7: a Create Record node authored against a freshly
 * provisioned backend reported *"'prop-age' 'prop-bio' … those ports don't
 * exist"*. The task filed it as a **timing** problem — provision creates the
 * tables, something else introspects later, the agent's parameters land in
 * between — and that turned out to be wrong in a way worth writing down.
 *
 * `prop-<field>` ports come from `resolveSchemaPortContext`, which reads a
 * backend's normalised schema from `backendServices` and, for a Parse-wire
 * backend, falls back to the project's `dbCollections` metadata. The project's
 * built-in backend is bound through `cloudservices`, so it has no
 * `backendServices` entry and the synthetic endpoint entry the runtime builds
 * for it (`endpointBackendEntry`) carries no schema. That leaves `dbCollections`
 * — which the `_fetch` below **set to `undefined` unconditionally**, on every
 * `window-focused` and every `cloudServicesChanged`.
 *
 * So there was no trigger to be late: nothing ever wrote that cache, and this
 * module cleared it twice a minute. Those ports could not exist, at any point,
 * for any built-in backend.
 *
 * What is restored here is narrow and needs no key: a backend **this editor
 * runs** is reachable over the same IPC the Data Browser uses, so when the
 * project's endpoint resolves to one of the managed processes its schema is
 * fetched and cached in the shape the runtime's port generator already reads
 * (`{ tables: [...] }` normalises through `collectionsFromParseClasses`). A
 * foreign Parse server still yields nothing, for the WF-007 reason above — we
 * have nothing to authenticate with and must not pretend otherwise.
 *
 * The provision path needs no separate write: `setCloudServices` raises
 * `cloudServicesChanged`, which is one of this handler's two triggers, so the
 * cache fills the moment the binding lands.
 *
 * ## FH-018 — the `configSchema` field is gone, not moved
 *
 * A third field used to sit here, `configSchema`, written to the project's
 * `dbConfigSchema` metadata on every `_store()`. Nothing ever **assigned** it —
 * the Parse Dashboard page that did went with WF-007 — so the metadata was
 * always `undefined` and the Config node it fed could never offer a key. The
 * node has since been deleted outright (front-end config that holds secrets is
 * unsafe by construction), and with it the last reader of that metadata.
 */
export default class SchemaHandler {
  public static instance: SchemaHandler | undefined;

  public haveCloudServices: boolean;
  public dbCollections: TSFixme[];
  public systemCollections: TSFixme[];
  public parseServerVersion: string;

  /** Held so `dispose()` can unsubscribe the IPC listener the constructor added. */
  private _onBackendStatusChanged?: (event: unknown, ...args: never[]) => void;

  /**
   * DEF-035 — `backend:statusChanged`, and the first fetch nobody was asking for.
   *
   * Two triggers used to exist, `window-focused` and `Model.cloudServicesChanged`,
   * and between them they left the cache a function of when the human alt-tabbed.
   * P77 s17 measured the shape of that: a project's unhealthy-node census moved
   * **19 → 4 on its own, with no edit**, between 14:18:32 and 14:22:57 — a later
   * focus event arriving after the backend had finished starting. An export taken
   * in that window is a different build from one taken outside it.
   *
   * `BackendManager` already broadcasts `backend:statusChanged` on
   * create/start/stop/delete and on an unexpected exit (WFA-005), and nothing here
   * was listening. Now the cache fills the moment the backend is up, rather than
   * the moment somebody clicks the window.
   *
   * The constructor also fetches once. `EditorPage` builds this on project open,
   * and opening a project from the picker never leaves the window — so there was
   * no focus event to wait for, and the first export of a session read whatever
   * the last session happened to leave on disk.
   */
  constructor() {
    EventDispatcher.instance.on(
      ['window-focused', 'Model.cloudServicesChanged'],
      () => {
        if (ProjectModel.instance) {
          void this._fetch();
        }
      },
      this
    );

    const ipc = getIpc();
    if (ipc) {
      this._onBackendStatusChanged = () => {
        if (ProjectModel.instance) {
          void this._fetch();
        }
      };
      ipc.on('backend:statusChanged', this._onBackendStatusChanged);
    }

    if (ProjectModel.instance) {
      void this._fetch();
    }
  }

  dispose() {
    EventDispatcher.instance.off(this);

    if (this._onBackendStatusChanged) {
      getIpc()?.removeListener('backend:statusChanged', this._onBackendStatusChanged);
      this._onBackendStatusChanged = undefined;
    }
  }

  /**
   * DEF-035 — nothing is cleared over an answer we did not get.
   *
   * The fields are no longer reset before the attempt. Resetting them was the
   * wipe: every "could not ask" outcome fell through to `_store()`'s else branch,
   * which writes `dbCollections = undefined`, and `setMetaData` schedules a
   * project save — so a stopped backend and a focus event were between them
   * enough to delete a project's `prop-*` ports from disk.
   * {@link decideSchemaCache} is where the three outcomes are told apart.
   */
  async _fetch(): Promise<void> {
    let outcome: SchemaFetchOutcome;

    try {
      outcome = await fetchBuiltInSchema();
    } catch (error) {
      // A backend that is stopped, mid-restart, or answering badly. We could not
      // look — which is not the same as looking and finding nothing — so the
      // cache stands. Never fatal: this runs on window focus.
      console.warn('[SchemaHandler] Could not read the built-in backend schema:', error);
      outcome = { status: 'unavailable', reason: String(error) };
    }

    const decision = decideSchemaCache(outcome);
    if (!decision.write) {
      return;
    }

    // Every table, system ones included: `collectionsFromParseClasses` marks
    // `isSystem` off the leading underscore, so splitting them here would only
    // be a second place to get that rule wrong.
    this.dbCollections = decision.value.dbCollections;
    this.systemCollections = decision.value.systemCollections;
    this.haveCloudServices = decision.value.haveCloudServices;

    this._store();
  }

  _store() {
    if (ProjectModel.instance) {
      if (this.haveCloudServices) {
        ProjectModel.instance.setMetaData('dbCollections', this.dbCollections);
        ProjectModel.instance.setMetaData('systemCollections', this.systemCollections);

        const versionNumbers = this.parseServerVersion?.split('.');
        if (versionNumbers && versionNumbers.length > 0) {
          // Let's only save the major version number,
          // since this will be used to determine which verison of the API to use.
          ProjectModel.instance.setMetaData('dbVersionMajor', versionNumbers[0]);
        } else {
          ProjectModel.instance.setMetaData('dbVersionMajor', undefined);
        }
      } else {
        ProjectModel.instance.setMetaData('dbCollections', undefined);
        ProjectModel.instance.setMetaData('systemCollections', undefined);
        ProjectModel.instance.setMetaData('dbVersionMajor', undefined);
      }
    }
  }
}

/** One running local backend, as `backend:list` + `backend:status` describe it. */
interface LocalBackendHandle {
  id: string;
  port: number;
}

/**
 * One attempt to read the built-in backend's schema, as an outcome with a reason.
 *
 * DEF-035 — this used to return `unknown[] | undefined`, and its own docblock said
 * the caller distinguished "there is nothing to cache" from "the cache is empty".
 * It could not: both arrived as `undefined`, and `_store()` wiped on `undefined`.
 * Three outcomes are the fix, and which branch each case takes is the decision —
 * see {@link SchemaFetchOutcome} for what the caller does with each.
 *
 * ⚠️ **"No managed backend matches this endpoint" is `unavailable`, not
 * `not-applicable`.** At editor start `backend:list` can answer before
 * `BackendManager` has registered the project's own backend, and that window is
 * exactly the one P77 s17 watched a project heal itself across. Clearing there
 * would delete the ports of a project whose backend is thirty seconds from ready.
 */
async function fetchBuiltInSchema(): Promise<SchemaFetchOutcome> {
  const project = ProjectModel.instance;
  if (!project) return { status: 'unavailable', reason: 'no project is open' };

  const cloud = getCloudServices(project);
  // Genuinely nothing to describe: no endpoint at all, or a Parse server somebody
  // else runs, which needs a master key we deliberately do not store — see the
  // module note. Both clear the cache, because keeping one would attribute another
  // project's classes to this one.
  if (!cloud?.endpoint) return { status: 'not-applicable', reason: 'the project has no backend endpoint' };
  if (cloud.type && cloud.type !== 'nodegx') {
    return { status: 'not-applicable', reason: `the endpoint is a ${cloud.type} server we hold no key for` };
  }

  const ipc = getIpc();
  if (!ipc) return { status: 'unavailable', reason: 'no ipcRenderer in this window' };

  const list = ((await ipc.invoke('backend:list')) as LocalBackendHandle[] | undefined) ?? [];
  const match = matchEndpointToManaged(cloud, list);
  if (!match) return { status: 'unavailable', reason: 'no managed backend matches the endpoint yet' };

  const status = (await ipc.invoke('backend:status', match.id)) as { running?: boolean } | undefined;
  if (!status?.running) return { status: 'unavailable', reason: `backend ${match.id} is not running` };

  const schema = (await ipc.invoke('backend:getSchema', match.id)) as { tables?: unknown[] } | undefined;
  if (!Array.isArray(schema?.tables)) {
    return { status: 'unavailable', reason: `backend ${match.id} returned no readable table list` };
  }

  // An empty array here is an answer, not a failure: a backend with no tables is a
  // fact the Data Browser and the AI review both have to be able to state.
  return { status: 'schema', tables: schema.tables };
}
