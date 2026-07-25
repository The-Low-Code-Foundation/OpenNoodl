import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';

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
 * with. This degrades to the same "no schema available" state the old code
 * already used whenever a project had no cloud service configured;
 * `DatabaseSchemaExtractor` already handles an empty `dbCollections`
 * gracefully.
 */
export default class SchemaHandler {
  public static instance: SchemaHandler | undefined;

  public haveCloudServices: boolean;
  public dbCollections: TSFixme[];
  public systemCollections: TSFixme[];
  public configSchema: TSFixme;
  public parseServerVersion: string;

  constructor() {
    EventDispatcher.instance.on(
      ['window-focused', 'Model.cloudServicesChanged'],
      () => {
        if (ProjectModel.instance) {
          this._fetch();
        }
      },
      this
    );
  }

  dispose() {
    EventDispatcher.instance.off(this);
  }

  _fetch() {
    return new Promise<void>((resolve) => {
      this.dbCollections = [];
      this.systemCollections = [];
      this.haveCloudServices = false;
      this._store();
      resolve();
    });
  }

  _store() {
    if (ProjectModel.instance) {
      if (this.haveCloudServices) {
        ProjectModel.instance.setMetaData('dbCollections', this.dbCollections);
        ProjectModel.instance.setMetaData('systemCollections', this.systemCollections);
        ProjectModel.instance.setMetaData('dbConfigSchema', this.configSchema);

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
        ProjectModel.instance.setMetaData('dbConfigSchema', undefined);
        ProjectModel.instance.setMetaData('dbVersionMajor', undefined);
      }
    }
  }
}
