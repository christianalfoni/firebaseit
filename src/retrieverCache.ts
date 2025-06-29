import type { DocumentData, Id } from "./schema";
import {
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  getDoc,
  getDocs,
  onSnapshot,
  Query,
  queryEqual,
  QuerySnapshot,
} from "firebase/firestore";

export type Retriever = {
  get(): SuspensePromise<any>;
  subscribe(callback: (data: any) => void): () => void;
  getSnapshot(): any;
};

export type RetrieverCache = {
  create(
    retriever:
      | {
          type: "query";
          ref: Query;
        }
      | {
          type: "collection";
          ref: CollectionReference;
        }
      | {
          type: "document";
          ref: DocumentReference;
        }
  ): Retriever;
  getDocumentData(id: Id): DocumentData<any> | undefined;
  setDocumentData(id: Id, data: DocumentData<any>): void;
};

export function createRetrieverCache(): RetrieverCache {
  const dataCache: Record<Id, DocumentData<any>> = {};
  const cache: Record<string, Retriever> = {};
  const queryCache = new Map<Query, Retriever>();

  const getRetriever = (
    key: DocumentReference | CollectionReference | Query
  ) => {
    if (
      key instanceof DocumentReference ||
      key instanceof CollectionReference
    ) {
      return cache[key.path];
    }

    for (const [query, retriever] of queryCache) {
      if (queryEqual(query, key)) {
        return retriever;
      }
    }
  };

  const setRetriever = (
    key: DocumentReference | CollectionReference | Query,
    retriever: Retriever
  ) => {
    if (
      key instanceof DocumentReference ||
      key instanceof CollectionReference
    ) {
      cache[key.path] = retriever;
    } else {
      queryCache.set(key, retriever);
    }
  };

  return {
    create(retriever): Retriever {
      const existing = getRetriever(retriever.ref);

      if (existing) {
        return existing;
      }

      let snapshot: any;
      let snapshotPromise: any;

      const updateSnapshot = (updatedSnapshot: any) => {
        if (retriever.type === "collection" || retriever.type === "query") {
          const docs: any[] = snapshot || [];
          let hasChanged = false;

          (updatedSnapshot as QuerySnapshot).docChanges().forEach((change) => {
            hasChanged = true;

            if (change.type === "added") {
              const data = {
                ...change.doc.data(),
                id: change.doc.id,
              };
              docs.push(data);
              dataCache[data.id] = data;
            } else if (change.type === "modified") {
              const data = {
                ...change.doc.data(),
                id: change.doc.id,
              };
              docs.splice(
                docs.findIndex((doc) => doc.id === change.doc.id),
                1,
                data
              );
              dataCache[data.id] = data;
            } else if (change.type === "removed") {
              docs.splice(
                docs.findIndex((doc) => doc.id === change.doc.id),
                1
              );
              delete dataCache[change.doc.id];
            }
          });

          return hasChanged ? docs.slice() : docs;
        }

        return {
          ...(updatedSnapshot as DocumentSnapshot).data(),
          id: (updatedSnapshot as DocumentSnapshot).id,
        };
      };

      const instance = {
        get() {
          if (snapshotPromise) {
            return snapshotPromise;
          }

          snapshotPromise = (
            retriever.type === "collection" || retriever.type === "query"
              ? getDocs(retriever.ref)
              : getDoc(retriever.ref)
          )
            .then((docsSnapshot) => {
              if (
                docsSnapshot instanceof DocumentSnapshot &&
                !docsSnapshot.exists()
              ) {
                createFulfilledPromise(snapshotPromise, null);
                return null;
              }

              createFulfilledPromise(
                snapshotPromise,
                // We might subscribe first and get the data there
                snapshot || updateSnapshot(docsSnapshot as DocumentSnapshot)
              );
            })
            .catch((error) => {
              createRejectedPromise(snapshotPromise, error);
            });

          const pendingPromise = createPendingPromise(snapshotPromise);

          return pendingPromise;
        },
        getSnapshot() {
          return snapshot;
        },
        subscribe(callback: (data: any) => void) {
          let isInitialSnapshot = true;

          // TODO: Rather check the changes to keep immutable
          // To handle both cases generically we cast to any
          return onSnapshot(retriever.ref as any, (snapshotUpdate: any) => {
            if (snapshot && isInitialSnapshot) {
              isInitialSnapshot = false;
              return;
            }

            isInitialSnapshot = false;
            if (
              snapshotUpdate instanceof DocumentSnapshot &&
              !snapshotUpdate.exists()
            ) {
              snapshot = null;
              createFulfilledPromise(snapshotPromise, null);
              callback(null);
              return;
            }

            snapshot = updateSnapshot(snapshotUpdate);
            createFulfilledPromise(snapshotPromise, snapshot);
            callback(snapshot);
          });
        },
      };

      setRetriever(retriever.ref, instance);

      return instance;
    },
    getDocumentData(id: Id) {
      return dataCache[id];
    },
    setDocumentData(id: Id, data: DocumentData<any>) {
      dataCache[id] = data;
    },
  };
}

type PendingPromise<T> = Promise<T> & {
  status: "pending";
};

type FulfilledPromise<T> = Promise<T> & {
  status: "fulfilled";
  value: T;
};

type RejectedPromise<T> = Promise<T> & {
  status: "rejected";
  reason: Error;
};

export type SuspensePromise<T> =
  | PendingPromise<T>
  | FulfilledPromise<T>
  | RejectedPromise<T>;

export function createPendingPromise<T>(
  promise: Promise<T>
): PendingPromise<T> {
  return Object.assign(promise, {
    status: "pending" as const,
  });
}

export function createFulfilledPromise<T>(
  promise: Promise<T>,
  value: T
): FulfilledPromise<T> {
  return Object.assign(promise, {
    status: "fulfilled" as const,
    value,
  });
}

export function createRejectedPromise<T>(
  promise: Promise<T>,
  reason: Error
): RejectedPromise<T> {
  return Object.assign(promise, {
    status: "rejected" as const,
    reason,
  });
}
