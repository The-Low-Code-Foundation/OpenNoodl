'use strict';

import type { ModelModule } from '@noodl/types';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance, RelationPropertyInstance } from './crud-mixins';

import ModelImport = require('../../../model');
import { reportOutcomes } from '../../../outcome';
import DbModelCRUDBase = require('./dbmodelcrudbase');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside Add Record Relation. */
interface AddRelationInstance extends DbCrudBaseInstance, DbModelIdInstance, RelationPropertyInstance {
  _internal: DbCrudBaseInstance['_internal'] & DbModelIdInstance['_internal'] & RelationPropertyInstance['_internal'];
  /** NDA-004 §2: returns the first missing input, or `undefined` when the node can act. */
  validateInputs(): string | undefined;
  /** The target record's class, or `undefined` when nothing has loaded that record. */
  targetCollection(): string | undefined;
  scheduleAddRelation(): void;
}

const AddDbModelRelationNodeDefinition: DbCrudNodeModule = {
  node: {
    name: 'AddDbModelRelation',
    docs: 'https://docs.noodl.net/nodes/data/cloud-data/add-record-relation',
    displayNodeName: 'Add Record Relation',
    usePortAsLabel: 'collectionName',
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        description: 'Adds the record named by Target Record Id to the chosen Relation on the record named by Id',
        valueChangedToTrue: function (this: AddRelationInstance) {
          this.scheduleAddRelation();
        }
      }
    },
    // ERG-001 §4: declared once in `dbmodelcrudbase.addBaseInfo` for the whole family.
    outputs: {},
    methods: {
      /**
       * The first thing missing, or `undefined` when the node is ready to act.
       *
       * NDA-004 §2 — this used to `return` immediately without an `editorConnection`, so
       * outside the editor it validated *nothing*, and the caller then hit two bare `return`s.
       * A deployed Add Record Relation with an unset property therefore did nothing at all and
       * said nothing at all. It still writes the same editor warning it always did; what is
       * new is that it also hands the verdict back, so the caller can fail properly.
       */
      validateInputs: function (this: AddRelationInstance): string | undefined {
        let problem: string | undefined;

        if (this._internal.collectionId === undefined) {
          problem = 'No class specified';
        } else if (this._internal.relationProperty === undefined) {
          problem = 'No relation property specified';
        } else if (this._internal.targetModelId === undefined) {
          problem = 'No target record Id (the record to add a relation to) specified';
        } else if (this._internal.model === undefined) {
          problem = 'No record Id specified (the record that should get the relation)';
        } else if (this.targetCollection() === undefined) {
          /**
           * NDA-012 (Data) — the check that stops this node corrupting the class schema.
           *
           * `targetCollection` is read off `Model.get(targetModelId)`, and `Model.get` mints a
           * record on read (`model.ts:232`). So an id that arrived from a URL parameter, a text
           * input or a Function node — rather than from a Query Records result — resolves to a
           * record nothing has ever loaded, whose `_class` is `undefined`. The three checks above
           * all pass, because the id itself is perfectly valid.
           *
           * Measured against a real Parse Server rather than reasoned about: the wire sends a
           * Pointer with no `className`, Parse answers `107 Could not add field`, **and still
           * writes the field into the class schema as `Relation<undefined>`**. Every later, correct
           * write to that relation then fails with `111 schema mismatch ... expected
           * Relation<undefined> but got Relation<Target>`. The relation name is burned for the life
           * of the class, and it is the *failing* attempt that burns it — so the author fixes their
           * graph and it still never works.
           *
           * Refusing before the request is what makes that unreachable. Resolving the class by
           * fetching the target first would also work and is the more helpful behaviour, but it
           * adds a round trip on every relation write and is a design decision rather than a
           * repair; it is filed rather than taken here.
           */
          problem =
            `The target record "${this._internal.targetModelId}" has not been loaded, so its class is unknown. ` +
            'Connect the Id from a Query Records / Record node rather than from a raw string, or the relation ' +
            'cannot be written.';
        }

        if (this.context.editorConnection) {
          if (problem) {
            this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'add-relation', {
              message: problem
            });
          } else {
            this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'add-relation');
          }
        }

        return problem;
      },
      /**
       * One reader of the target record's class, so the validation and the request cannot
       * disagree about what is going on the wire.
       */
      targetCollection: function (this: AddRelationInstance): string | undefined {
        const targetModelId = this._internal.targetModelId;
        if (targetModelId === undefined) return undefined;
        return (this.nodeScope.modelScope || Model).get(targetModelId)._class;
      },
      scheduleAddRelation: function (this: AddRelationInstance) {
        const _this = this;
        const internal = this._internal;

        // ERG-001 §4. Unlike the three CRUD verbs there is no pre-flight check here — the
        // whole verdict is `validateInputs`, inside the deferral — so the token goes straight
        // into the batch.
        this.pendingOutcomes('AddRelation').push(this.beginOutcome());

        this.scheduleOnce('StorageAddRelation', function () {
          const tokens = _this.takeOutcomes('AddRelation');

          // One exit for every "cannot act" case, replacing two silent `return`s that between
          // them covered the same conditions `validateInputs` already knew about.
          const problem = _this.validateInputs();
          if (problem !== undefined) {
            _this.setError(problem, tokens);
            return;
          }

          const model = internal.model;
          const targetModelId = internal.targetModelId;

          // BCN-004 step 5: the store the `Backend` input names. This node shares
          // `addBaseInfo` with the Record family, so it gets the picker port; resolving it
          // here is what keeps the port honest.
          //
          // BCN-005 made this work on the three REST backends too. Where it cannot —
          // a relation the synced schema does not describe, because relation metadata
          // is admin-only on all three — the adapter refuses with a sentence naming
          // the field and the fix, and it lands on `setError` below.
          const cloudstore = _this.cloudStore(tokens);
          if (!cloudstore) return;

          cloudstore.addRelation({
            collection: internal.collectionId,
            objectId: model.getId(),
            key: internal.relationProperty,
            targetObjectId: targetModelId,
            // BCN-005 renamed this on the contract: `targetCollection` is the neutral
            // name, matching `collection` two lines up, and `targetClass` stays a
            // deprecated alias for `Noodl.Records`'s public `targetClassName`.
            //
            // `validateInputs` has already refused the `undefined` case, so this is the one
            // reader that cannot send a class-less pointer — see `targetCollection`.
            targetCollection: _this.targetCollection(),
            success: function (response: Record<string, unknown>) {
              for (const _key in response) {
                model.set(_key, response[_key]);
              }

              // Successfully added relation
              reportOutcomes(_this, tokens, 'done');
            },
            error: function (err: string) {
              _this.setError(err || 'Failed to add relation.', tokens);
            }
          });
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(AddDbModelRelationNodeDefinition, {
  includeRelations: true,
  done: 'Fires once the relation has been written and the record has been refreshed from the response'
});
DbModelCRUDBase.addModelId(AddDbModelRelationNodeDefinition);
DbModelCRUDBase.addRelationProperty(AddDbModelRelationNodeDefinition);

export = AddDbModelRelationNodeDefinition;
