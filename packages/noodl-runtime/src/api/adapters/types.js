/**
 * CloudStore Adapter Type Definitions
 *
 * @module adapters/types
 */

/**
 * @typedef {'String' | 'Number' | 'Boolean' | 'Date' | 'Object' | 'Array' | 'Pointer' | 'Relation' | 'GeoPoint' | 'File'} ColumnType
 */

/**
 * @typedef {Object} ColumnDefinition
 * @property {string} name - Column name
 * @property {ColumnType} type - Data type
 * @property {boolean} [required] - Whether field is required
 * @property {string} [targetClass] - For Pointer/Relation types, the target collection
 * @property {*} [defaultValue] - Default value for the column
 */

/**
 * @typedef {Object} TableSchema
 * @property {string} name - Table/Collection name
 * @property {ColumnDefinition[]} columns - Column definitions
 */

/**
 * @typedef {Object} QueryOptions
 * @property {string} collection - Collection name
 * @property {Object} [where] - Query filter (Parse-style)
 * @property {number} [limit] - Max records to return
 * @property {number} [skip] - Records to skip
 * @property {string|string[]} [include] - Relations to include
 * @property {string|string[]} [select] - Fields to select
 * @property {string|string[]} [sort] - Sort order
 * @property {boolean} [count] - Include count in response
 * @property {function(Object[], number=): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} FetchOptions
 * @property {string} collection - Collection name
 * @property {string} objectId - Record ID
 * @property {string|string[]} [include] - Relations to include
 * @property {function(Object): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} CreateOptions
 * @property {string} collection - Collection name
 * @property {Object} data - Record data
 * @property {Object} [acl] - Access control list
 * @property {function(Object): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} SaveOptions
 * @property {string} collection - Collection name
 * @property {string} objectId - Record ID
 * @property {Object} data - Record data
 * @property {Object} [acl] - Access control list
 * @property {function(Object): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} DeleteOptions
 * @property {string} collection - Collection name
 * @property {string} objectId - Record ID
 * @property {function(): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} CountOptions
 * @property {string} collection - Collection name
 * @property {Object} [where] - Query filter
 * @property {function(number): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} AggregateOptions
 * @property {string} collection - Collection name
 * @property {Object} [where] - Query filter
 * @property {Object} group - Grouping configuration
 * @property {number} [limit] - Max results
 * @property {number} [skip] - Results to skip
 * @property {function(Object): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} RelationOptions
 * @property {string} collection - Source collection
 * @property {string} objectId - Source record ID
 * @property {string} key - Relation field name
 * @property {string} targetObjectId - Target record ID
 * @property {string} targetClass - Target collection name
 * @property {function(Object): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} IncrementOptions
 * @property {string} collection - Collection name
 * @property {string} objectId - Record ID
 * @property {Object<string, number>} properties - Properties to increment with amounts
 * @property {function(Object): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} DistinctOptions
 * @property {string} collection - Collection name
 * @property {string} property - Property to get distinct values for
 * @property {Object} [where] - Query filter
 * @property {function(Array): void} success - Success callback
 * @property {function(string=): void} error - Error callback
 */

/**
 * @typedef {Object} CloudStoreEvent
 * @property {'create' | 'save' | 'delete' | 'fetch'} type - Event type
 * @property {string} [objectId] - Record ID
 * @property {Object} [object] - Record data
 * @property {string} collection - Collection name
 */

/**
 * @typedef {function(CloudStoreEvent): void} EventHandler
 */

/**
 * CloudStore Adapter Interface
 *
 * All adapters must implement these methods with the same signatures
 * as the original CloudStore class.
 *
 * @interface CloudStoreAdapter
 */

/**
 * @typedef {Object} CloudStoreAdapter
 * @property {function(QueryOptions): void} query - Query records
 * @property {function(FetchOptions): void} fetch - Fetch single record
 * @property {function(CreateOptions): void} create - Create new record
 * @property {function(SaveOptions): void} save - Update existing record
 * @property {function(DeleteOptions): void} delete - Delete record
 * @property {function(CountOptions): void} count - Count records
 * @property {function(AggregateOptions): void} aggregate - Aggregate records
 * @property {function(DistinctOptions): void} distinct - Get distinct values
 * @property {function(IncrementOptions): void} increment - Increment properties
 * @property {function(RelationOptions): void} addRelation - Add relation
 * @property {function(RelationOptions): void} removeRelation - Remove relation
 * @property {function(string, EventHandler, Object=): void} on - Subscribe to events
 * @property {function(string, EventHandler=, Object=): void} off - Unsubscribe from events
 * @property {function(): Promise<void>} connect - Connect to data store
 * @property {function(): Promise<void>} disconnect - Disconnect from data store
 */

module.exports = {};
