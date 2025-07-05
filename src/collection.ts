import type {
  CollectionSchema,
  DocumentData,
  DocumentDataUpdates,
  DocumentSchema,
  Id,
} from "./schema";
import {
  createDocument,
  DocumentAddError,
  DocumentDeleteError,
  DocumentSetError,
  DocumentUpdateError,
  type Document,
} from "./document";
import {
  CollectionReference,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import type { RetrieverCache, SuspensePromise } from "./retrieverCache";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createQueryApi, QueryApi } from "./queryApi";
import { type DocumentOperationError } from "./document";
import { createDocUpdate } from "./docUpdate";

type Operations<T extends DocumentSchema<any>> = Record<
  Id,
  | { isPending: true; error: null }
  | { isPending: false; error: DocumentOperationError<T> }
>;

export type Collection<T extends DocumentSchema<any>> = {
  ref: CollectionReference;
  document(id: Id): Document<T>;
  add(data: Omit<DocumentData<T["properties"]>, "id">): Promise<Id>;
  set(id: Id, data: Omit<DocumentData<T["properties"]>, "id">): Promise<void>;
  update(id: Id, data: DocumentDataUpdates<T["properties"]>): Promise<void>;
  remove(id: Id): Promise<void>;
  useOperations(): {
    operations: Operations<T>;
    add(data: Omit<DocumentData<T["properties"]>, "id">): Promise<Id>;
    set(id: Id, data: Omit<DocumentData<T["properties"]>, "id">): Promise<void>;
    update(id: Id, data: DocumentDataUpdates<T["properties"]>): Promise<void>;
    remove(id: Id): Promise<void>;
  };
  use(
    query?: (
      q: QueryApi<DocumentDataUpdates<T["properties"]>>
    ) => QueryApi<DocumentDataUpdates<T["properties"]>>
  ): (
    | {
        data: null;
        isFetching: true;
        error: null;
      }
    | {
        data: DocumentData<T["properties"]>[];
        isFetching: false;
        error: null;
      }
    | {
        data: null;
        isFetching: false;
        error: Error;
      }
  ) & {
    suspend(): DocumentData<T["properties"]>[];
  };
};

export function createCollection<T extends DocumentSchema<any, any>>(
  retrieverCache: RetrieverCache,
  schema: CollectionSchema<T>,
  ref: CollectionReference
): Collection<T> {
  const retriever = retrieverCache.create({
    type: "collection",
    ref,
  });

  const documentsCache: Record<Id, Document<T>> = {};

  return {
    get ref() {
      return ref;
    },
    async add(data) {
      const docRef = doc(ref);

      await setDoc(docRef, data);

      return docRef.id;
    },
    async set(id, data) {
      const docRef = doc(ref, id);

      await setDoc(docRef, data);
    },
    async update(id, data) {
      const documentData = retrieverCache.getDocumentData(id);

      if (!documentData) {
        throw new Error(`Document with id ${id} does not exist.`);
      }
      const docRef = doc(ref, id);
      await updateDoc(docRef, data);
    },
    async remove(id) {
      const docRef = doc(ref, id);
      await deleteDoc(docRef);
    },
    document(id) {
      return (
        documentsCache[id] ||
        (documentsCache[id] = createDocument(
          retrieverCache,
          schema.document,
          doc(ref, id)
        ))
      );
    },
    useOperations() {
      const isMountedRef = useRef(false);
      const [operations, setOperations] = useState<Operations<T>>({});

      useEffect(() => {
        isMountedRef.current = true;

        return () => {
          isMountedRef.current = false;
        };
      }, []);

      function setPending(id: Id) {
        if (!isMountedRef.current) {
          return;
        }

        setOperations((prev) => ({
          ...prev,
          [id]: { isPending: true, error: null },
        }));
      }

      function setError(id: Id, error: DocumentOperationError<T>) {
        if (!isMountedRef.current) {
          return;
        }

        setOperations((prev) => ({
          ...prev,
          [id]: { isPending: false, error },
        }));
      }

      function unsetOperation(id: Id) {
        if (!isMountedRef.current) {
          return;
        }

        setOperations((prev) => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
      }

      return {
        operations,
        async add(data) {
          const docRef = doc(ref);
          setPending(docRef.id);
          await setDoc(docRef, data).then(
            () => unsetOperation(docRef.id),
            (error) =>
              setError(
                docRef.id,
                new DocumentAddError(
                  docRef.id,
                  data,
                  `Could not add document to collection ${ref.path}: ${error.message}`
                )
              )
          );

          return docRef.id;
        },
        async set(id, data) {
          const docRef = doc(ref, id);
          setPending(id);
          setDoc(docRef, data).then(
            () => unsetOperation(id),
            (error) =>
              setError(
                id,
                new DocumentSetError(
                  id,
                  data,
                  `Could not set document ${docRef.path}: ${error.message}`
                )
              )
          );
        },
        async update(id, data) {
          const docRef = doc(ref, id);
          const documentData = retrieverCache.getDocumentData(id);

          if (!documentData) {
            setError(
              id,
              new DocumentUpdateError(
                id,
                data,
                `Document ${docRef.path} has not been fetched yet`
              )
            );
            return;
          }

          setPending(id);
          updateDoc(docRef, createDocUpdate(documentData, data)).then(
            () => unsetOperation(id),
            (error) =>
              setError(
                id,
                new DocumentUpdateError(
                  id,
                  data,
                  `Could not update document ${docRef.path}: ${error.message}`
                )
              )
          );
        },
        async remove(id) {
          const docRef = doc(ref, id);
          setPending(id);
          deleteDoc(docRef).then(
            () => unsetOperation(id),
            (error) =>
              setError(
                id,
                new DocumentDeleteError(
                  id,
                  `Could not delete document ${docRef.path}: ${error.message}`
                )
              )
          );
        },
      };
    },
    use(query) {
      let promise: SuspensePromise<DocumentData<T["properties"]>[]>;
      let useRetriever = retriever;

      if (query) {
        const queryApi = createQueryApi<DocumentDataUpdates<T["properties"]>>();
        const q = query(queryApi);

        useRetriever = retrieverCache.create({
          type: "query",
          ref: q.get(ref),
        });

        promise = useRetriever.get();
      } else {
        promise = useRetriever.get();
      }

      const data = useSyncExternalStore(
        useRetriever.subscribe,
        useRetriever.getSnapshot
      );

      return {
        data,
        isFetching: promise.status === "pending",
        error: promise.status === "rejected" ? promise.reason : null,
        suspend() {
          if (promise.status === "pending") {
            throw promise;
          }

          if (promise.status === "rejected") {
            throw promise.reason;
          }

          return promise.value;
        },
      } as ReturnType<Collection<T>["use"]>;
    },
  };
}
