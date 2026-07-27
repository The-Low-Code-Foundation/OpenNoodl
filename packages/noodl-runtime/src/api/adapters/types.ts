/**
 * CloudStore Adapter Type Definitions
 *
 * This file was a wall of `@typedef` JSDoc that exported `{}` — the types existed only as
 * comments and nothing could reference them. They are real declarations now, and the
 * sibling adapter modules import them rather than restating the same shapes.
 *
 * The callback style throughout (`success`/`error` on an options object rather than a
 * Promise) is not an accident: an adapter must be a drop-in replacement for the original
 * `CloudStore` class, whose whole surface is shaped this way, and the standard-library
 * nodes call it directly.
 *
 * @module adapters/types
 */

export type ColumnType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'Object'
  | 'Array'
  | 'Pointer'
  | 'Relation'
  | 'GeoPoint'
  | 'File';

export interface ColumnDefinition {
  /** Column name */
  name: string;
  /** Data type */
  type: ColumnType;
  /** Whether field is required */
  required?: boolean;
  /** For Pointer/Relation types, the target collection */
  targetClass?: string;
  /** Default value for the column */
  defaultValue?: unknown;
}

export interface TableSchema {
  /** Table/Collection name */
  name: string;
  /** Column definitions */
  columns: ColumnDefinition[];
}

/** One record as it crosses the adapter boundary. Always carries at least its id. */
export interface AdapterRecord {
  objectId?: string;
  [field: string]: unknown;
}

/**
 * The two callbacks every adapter operation takes.
 *
 * `error` receives a message, not an `Error` — the same convention §15's `UserService` note
 * recorded, and for the same reason: the backend's `{ error, code }` is unwrapped before it
 * reaches the caller.
 */
interface AdapterCallbacks<TSuccess> {
  success: TSuccess;
  error: (err?: string) => void;
}

/** A Parse-style query filter. Deliberately open — `QueryBuilder` is what interprets it. */
export type WhereClause = Record<string, unknown>;

export interface QueryOptions extends AdapterCallbacks<(results: AdapterRecord[], count?: number) => void> {
  collection: string;
  where?: WhereClause;
  /** Max records to return */
  limit?: number;
  /** Records to skip */
  skip?: number;
  /** Relations to include */
  include?: string | string[];
  /** Fields to select */
  select?: string | string[];
  /** Sort order */
  sort?: string | string[];
  /** Include count in response */
  count?: boolean;
}

export interface FetchOptions extends AdapterCallbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: string;
  include?: string | string[];
}

/** An access-control list, in the shape BAK-003's model uses. */
export type Acl = Record<string, unknown>;

export interface CreateOptions extends AdapterCallbacks<(record: AdapterRecord) => void> {
  collection: string;
  data: Record<string, unknown>;
  acl?: Acl;
}

export interface SaveOptions extends AdapterCallbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: string;
  data: Record<string, unknown>;
  acl?: Acl;
}

export interface DeleteOptions extends AdapterCallbacks<() => void> {
  collection: string;
  objectId: string;
}

export interface CountOptions extends AdapterCallbacks<(count: number) => void> {
  collection: string;
  where?: WhereClause;
}

export interface AggregateOptions extends AdapterCallbacks<(result: Record<string, unknown>) => void> {
  collection: string;
  where?: WhereClause;
  /** Grouping configuration */
  group: Record<string, unknown>;
  limit?: number;
  skip?: number;
}

export interface RelationOptions extends AdapterCallbacks<(record: AdapterRecord) => void> {
  /** Source collection */
  collection: string;
  /** Source record ID */
  objectId: string;
  /** Relation field name */
  key: string;
  targetObjectId: string;
  targetClass: string;
}

export interface IncrementOptions extends AdapterCallbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: string;
  /** Properties to increment, keyed by name, valued by amount */
  properties: Record<string, number>;
}

export interface DistinctOptions extends AdapterCallbacks<(values: unknown[]) => void> {
  collection: string;
  /** Property to get distinct values for */
  property: string;
  where?: WhereClause;
}

export interface CloudStoreEvent {
  type: 'create' | 'save' | 'delete' | 'fetch';
  objectId?: string;
  object?: AdapterRecord;
  collection: string;
}

export type EventHandler = (event: CloudStoreEvent) => void;

/**
 * CloudStore Adapter Interface
 *
 * All adapters must implement these methods with the same signatures as the original
 * `CloudStore` class.
 */
export interface CloudStoreAdapter {
  query(options: QueryOptions): void;
  fetch(options: FetchOptions): void;
  create(options: CreateOptions): void;
  save(options: SaveOptions): void;
  delete(options: DeleteOptions): void;
  count(options: CountOptions): void;
  aggregate(options: AggregateOptions): void;
  distinct(options: DistinctOptions): void;
  increment(options: IncrementOptions): void;
  addRelation(options: RelationOptions): void;
  removeRelation(options: RelationOptions): void;
  on(event: string, handler: EventHandler, context?: Record<string, unknown>): void;
  off(event: string, handler?: EventHandler, context?: Record<string, unknown>): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
