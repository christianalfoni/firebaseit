/*
 * TypeScript utility for building Firestore queries with a chainable API
 * that infers field names and types from your DataType,
 * produces a Firestore Query by applying the actual SDK constraints,
 * and generates a stable query key for comparison.
 */

import {
  Query as FirestoreQuery,
  CollectionReference,
  QueryConstraint,
  query as firestoreQuery,
  where as firestoreWhere,
  limit as firestoreLimit,
  limitToLast as firestoreLimitToLast,
  orderBy as firestoreOrderBy,
  startAt as firestoreStartAt,
  startAfter as firestoreStartAfter,
  endAt as firestoreEndAt,
  endBefore as firestoreEndBefore,
} from "firebase/firestore";

type WhereFilterOp =
  | "<"
  | "<="
  | "=="
  | "!="
  | ">"
  | ">="
  | "array-contains"
  | "in"
  | "array-contains-any"
  | "not-in";

type OrderByDirection = "asc" | "desc";

/**
 * Chainable Query API for type-safe Firestore queries.
 * @template T - the Firestore document data type
 */
export class QueryApi<T> {
  private constraints: QueryConstraint[] = [];
  private descriptors: Array<[string, ...any[]]> = [];

  /**
   * Add a WHERE clause. Field must be a key of T and value matches its type.
   */
  where<K extends keyof T>(field: K, op: WhereFilterOp, value: T[K]): this {
    this.constraints.push(firestoreWhere(field as string, op, value as any));
    this.descriptors.push(["where", field as string, op, value]);
    return this;
  }

  /**
   * Add an ORDER BY clause.
   */
  orderBy<K extends keyof T>(field: K, dir: OrderByDirection = "asc"): this {
    this.constraints.push(firestoreOrderBy(field as string, dir));
    this.descriptors.push(["orderBy", field as string, dir]);
    return this;
  }

  /**
   * Add a LIMIT clause.
   */
  limit(count: number): this {
    this.constraints.push(firestoreLimit(count));
    this.descriptors.push(["limit", count]);
    return this;
  }

  /**
   * Add a LIMIT TO LAST clause.
   */
  limitToLast(count: number): this {
    this.constraints.push(firestoreLimitToLast(count));
    this.descriptors.push(["limitToLast", count]);
    return this;
  }

  /**
   * Add a START AT cursor.
   */
  startAt(...fieldValues: any[]): this {
    this.constraints.push(firestoreStartAt(...fieldValues));
    this.descriptors.push(["startAt", ...fieldValues]);
    return this;
  }

  /**
   * Add a START AFTER cursor.
   */
  startAfter(...fieldValues: any[]): this {
    this.constraints.push(firestoreStartAfter(...fieldValues));
    this.descriptors.push(["startAfter", ...fieldValues]);
    return this;
  }

  /**
   * Add an END AT cursor.
   */
  endAt(...fieldValues: any[]): this {
    this.constraints.push(firestoreEndAt(...fieldValues));
    this.descriptors.push(["endAt", ...fieldValues]);
    return this;
  }

  /**
   * Add an END BEFORE cursor.
   */
  endBefore(...fieldValues: any[]): this {
    this.constraints.push(firestoreEndBefore(...fieldValues));
    this.descriptors.push(["endBefore", ...fieldValues]);
    return this;
  }

  /**
   * Build and return a Firestore Query by applying the accumulated constraints
   * to the provided collection or existing query reference.
   * @param ref - a CollectionReference<T> or existing Query<T>
   */
  get(ref: CollectionReference | FirestoreQuery): FirestoreQuery {
    return firestoreQuery(ref, ...this.constraints);
  }

  /**
   * Returns a stable string key representing this query's structure,
   * suitable for comparison or caching.
   */
  get queryKey(): string {
    // JSON.stringify over descriptors yields a stable representation
    return JSON.stringify(this.descriptors);
  }
}

/**
 * Factory to create a new, empty QueryApi for a given DataType
 * @template T - the Firestore document data type
 */
export function createQueryApi<T>(): QueryApi<T> {
  return new QueryApi<T>();
}

// Example usage:
// interface Todo { completed: boolean; title: string; id: string; }
// const q1 = createQueryApi<Todo>()
//   .where('completed', '==', true)
//   .limit(20);
// const q2 = createQueryApi<Todo>()
//   .where('completed', '==', true)
//   .limit(20);
// q1.queryKey === q2.queryKey // true
// const todosQuery = q1.get(firestore.collection('todos'));
