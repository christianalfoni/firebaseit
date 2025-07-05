import {
  collection,
  deleteDoc,
  DocumentReference,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type {
  CollectionSchema,
  DocumentData,
  DocumentSchema,
  Id,
  DocumentDataUpdates,
  ObjectSchema,
} from "./schema";
import type { RetrieverCache } from "./retrieverCache";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createCollection, type Collection } from "./collection";
import { createDocUpdate } from "./docUpdate";

export class DocumentAddError<T extends DocumentSchema<any>> extends Error {
  operation = "add";
  id: Id;
  data: Omit<DocumentData<T["properties"]>, "id">;
  constructor(
    id: Id,
    data: Omit<DocumentData<T["properties"]>, "id">,
    message: string
  ) {
    super(message);
    this.name = "DocumentAddError";
    this.id = id;
    this.data = data;
  }
}

export class DocumentSetError<T extends DocumentSchema<any>> extends Error {
  operation = "set";
  id: Id;
  data: Omit<DocumentData<T["properties"]>, "id">;
  constructor(
    id: Id,
    data: Omit<DocumentData<T["properties"]>, "id">,
    message: string
  ) {
    super(message);
    this.name = "DocumentSetError";
    this.id = id;
    this.data = data;
  }
}

export class DocumentUpdateError<S extends ObjectSchema<any>> extends Error {
  operation = "update";
  id: Id;
  data: DocumentDataUpdates<S>;

  constructor(id: Id, data: DocumentDataUpdates<S>, message: string) {
    super(message);
    this.name = "DocumentUpdateError";
    Object.setPrototypeOf(this, DocumentUpdateError.prototype);
    this.id = id;
    this.data = data;
  }
}

export class DocumentDeleteError extends Error {
  operation = "delete";
  id: Id;
  constructor(id: Id, message: string) {
    super(message);
    this.name = "DocumentDeleteError";
    this.id = id;
  }
}

export class DocumentTransactionError extends Error {
  operation = "transaction";
  id: Id;
  constructor(id: Id, message: string) {
    super(message);
    this.name = "DocumentTransactionError";
    this.id = id;
  }
}

export type DocumentOperationError<T extends DocumentSchema<any>> =
  | DocumentAddError<T>
  | DocumentSetError<T>
  | DocumentUpdateError<T["properties"]>
  | DocumentDeleteError;

//
// ─── 1. UNPACK A CollectionSchema INTO ITS INNER DocumentSchema ───
//
type UnpackCollectionSchema<CS> = CS extends CollectionSchema<infer DS>
  ? DS
  : never;

//
// ─── 2. MAP OVER T["collections"] TO PRODUCE Collection<DS> ───
//
type DocumentCollections<T extends DocumentSchema<any, any>> = {
  [K in keyof T["collections"]]: Collection<
    UnpackCollectionSchema<T["collections"][K]>
  >;
};

//
// ─── 3. UPDATE YOUR Document<> TYPE TO USE THAT MAPPED TYPE ───
//
export type Document<T extends DocumentSchema<any, any>> = {
  ref: DocumentReference;
  collections: DocumentCollections<T>;
  set(data: Omit<DocumentData<T["properties"]>, "id">): Promise<void>;
  update(data: DocumentDataUpdates<T["properties"]>): Promise<void>;
  remove(): Promise<void>;
  useOperations(): (
    | {
        error: DocumentOperationError<T>;
        isPending: false;
      }
    | {
        error: null;
        isPending: true;
      }
    | {
        error: null;
        isPending: false;
      }
  ) & {
    set(data: Omit<DocumentData<T["properties"]>, "id">): Promise<void>;
    update(data: DocumentDataUpdates<T["properties"]>): Promise<void>;
    remove(): Promise<void>;
  };
  use(): (
    | {
        data: DocumentData<T["properties"]>;
        isFetching: false;
        error: null;
      }
    | {
        data: null;
        isFetching: true;
        error: null;
      }
    | {
        data: null;
        isFetching: false;
        error: Error;
      }
  ) & {
    suspend(): DocumentData<T["properties"]>;
  };
};

export function createDocument<T extends DocumentSchema<any, any>>(
  retrieverCache: RetrieverCache,
  schema: T,
  ref: DocumentReference
): Document<T> {
  const retriever = retrieverCache.create({
    type: "document",
    ref,
  });

  const collections: T["collections"] = {};

  for (const [key, collectionSchema] of Object.entries(schema.collections)) {
    collections[key] = createCollection(
      retrieverCache,
      collectionSchema as CollectionSchema<DocumentSchema<any>>,
      collection(ref, key)
    );
  }

  return {
    get ref() {
      return ref;
    },
    collections,
    async set(data) {
      await setDoc(ref, data);
    },
    async update(data) {
      const documentData = retrieverCache.getDocumentData(ref.id);
      if (!documentData) {
        throw new DocumentUpdateError(
          ref.id,
          {},
          `Document ${ref.path} has not been fetched yet`
        );
      }
      await updateDoc(ref, createDocUpdate(documentData, data));
    },
    async remove() {
      await deleteDoc(ref);
    },
    get() {
      return retriever.get();
    },
    // @ts-ignore
    useOperations() {
      const isMountedRef = useRef(false);

      useEffect(() => {
        isMountedRef.current = true;

        return () => {
          isMountedRef.current = false;
        };
      }, []);

      const [state, setState] = useState({
        isPending: false,
        error: null as DocumentOperationError<T> | null,
      });

      return {
        ...state,
        async set(data) {
          setState({ isPending: true, error: null });
          setDoc(ref, data).then(
            () => setState({ isPending: false, error: null }),
            (error) =>
              setState({
                isPending: false,
                error: new DocumentAddError(
                  ref.id,
                  data,
                  `Could not set document ${ref.path}: ${error.message}`
                ),
              })
          );
        },
        async update(data) {
          setState({ isPending: true, error: null });
          const documentData = retrieverCache.getDocumentData(ref.id);
          if (!documentData) {
            throw new DocumentUpdateError(
              ref.id,
              {},
              `Document ${ref.path} has not been fetched yet`
            );
          }
          updateDoc(ref, createDocUpdate(documentData, data)).then(
            () => setState({ isPending: false, error: null }),
            (error) =>
              setState({
                isPending: false,
                error: new DocumentUpdateError(
                  ref.id,
                  data,
                  `Could not update document ${ref.path}: ${error.message}`
                ),
              })
          );
        },
        async remove() {
          setState({ isPending: true, error: null });
          deleteDoc(ref).then(
            () => setState({ isPending: false, error: null }),
            (error) =>
              setState({
                isPending: false,
                error: new DocumentDeleteError(
                  ref.id,
                  `Could not delete document ${ref.path}: ${error.message}`
                ),
              })
          );
        },
      };
    },
    // @ts-ignore
    use() {
      const promise = retriever.get();

      const data = useSyncExternalStore(
        retriever.subscribe,
        retriever.getSnapshot
      );

      return {
        isFetching: promise.status === "pending",
        error: promise.status === "rejected" ? promise.reason : null,
        data,
        suspend() {
          if (promise.status === "pending") {
            throw promise;
          }

          if (promise.status === "rejected") {
            throw promise.reason;
          }

          return promise.value;
        },
      };
    },
  };
}
