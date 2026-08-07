import { matchEndpointToManaged } from '@noodl-models/BackendServices/backendList';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices } from '@noodl-models/projectmodel.editor';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { getIpc } from './ipc';

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
  }

  dispose() {
    EventDispatcher.instance.off(this);
  }

  async _fetch(): Promise<void> {
    this.dbCollections = [];
    this.systemCollections = [];
    this.haveCloudServices = false;

    try {
      const tables = await fetchBuiltInSchema();
      if (tables) {
        // Every table, system ones included: `collectionsFromParseClasses` marks
        // `isSystem` off the leading underscore, so splitting them here would
        // only be a second place to get that rule wrong.
        this.dbCollections = tables;
        this.haveCloudServices = true;
      }
    } catch (error) {
      // A backend that is stopped, mid-restart, or simply not ours. The cache
      // goes empty — which is the honest answer — and the ports disappear until
      // it is up again. Never fatal: this runs on window focus.
      console.warn('[SchemaHandler] Could not read the built-in backend schema:', error);
    }

    this._store();
  }

  _store() {
    if (ProjectModel.instance) {
      if (this.haveCloudServices) {
        ProjectModel.instance.setMetaData('dbCollections', this.dbCollections);
        ProjectModel.instance.setMetaData('systemCollections', this.systemCollections);

        const versionNumbers = this.parseServerVersion?.split(".")
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
 * The tables of the built-in backend this project points at, or `undefined`.
 *
 * `undefined` — never an empty array — for every "not applicable" case: no
 * project, no endpoint, an endpoint that is somebody else's server, a backend
 * that is not running, or no Electron around us (the Jasmine suite). The caller
 * distinguishes "there is nothing to cache" from "the cache is empty", because
 * the second wipes the ports of a project whose backend is merely asleep.
 */
async function fetchBuiltInSchema(): Promise<unknown[] | undefined> {
  const project = ProjectModel.instance;
  if (!project) return undefined;

  const cloud = getCloudServices(project);
  if (!cloud?.endpoint) return undefined;
  // Only ours. A Parse server somebody else runs needs a master key we
  // deliberately do not store — see the module note.
  if (cloud.type && cloud.type !== 'nodegx') return undefined;

  const ipc = getIpc();
  if (!ipc) return undefined;

  const list = ((await ipc.invoke('backend:list')) as LocalBackendHandle[] | undefined) ?? [];
  const match = matchEndpointToManaged(cloud, list);
  if (!match) return undefined;

  const status = (await ipc.invoke('backend:status', match.id)) as { running?: boolean } | undefined;
  if (!status?.running) return undefined;

  const schema = (await ipc.invoke('backend:getSchema', match.id)) as { tables?: unknown[] } | undefined;
  return Array.isArray(schema?.tables) ? schema.tables : undefined;
}
