import {
  runTransaction,
  Transaction,
  type Firestore,
  doc,
} from "firebase/firestore";
import type { Collections } from "./types";
import type { Id } from "./schema";
import type { DocumentSchema, DocumentData } from "./schema";
import { useRef, useState } from "react";

type TransactionsDocument<T extends DocumentSchema<any>> = {
  get(): Promise<DocumentData<T["properties"]>>;
  update(data: Partial<Omit<DocumentData<T["properties"]>, "id">>): void;
  set(data: Omit<DocumentData<T["properties"]>, "id">): void;
  delete(): void;
};

type Transactions<T extends Collections> = {
  [K in keyof T]: {
    document(id: Id): TransactionsDocument<T[K]["document"]>;
  };
};

export type UseTransaction<T extends Collections> = {
  run: (callback: (transaction: Transactions<T>) => void) => void;
} & (
  | {
      isPending: false;
      error: null;
    }
  | {
      isPending: false;
      error: Error;
    }
  | {
      isPending: true;
      error: null;
    }
);

export function createUseTransaction<T extends Collections>(
  firestore: Firestore,
  collections: T
) {
  function createCollectionsTransactions(
    transaction: Transaction,
    collections: Collections
  ) {
    const transactions: Transactions<any> = {};

    for (const [key, collectionSchema] of Object.entries(collections)) {
      transactions[key] = {
        document(id: Id) {
          return {
            get() {
              return transaction.get(doc(firestore, key, id)).then((doc) => ({
                ...doc.data(),
                id: doc.id,
              }));
            },
            update(data: DocumentData<any>) {
              transaction.update(doc(firestore, key, id), data);
            },
            set(data: DocumentData<any>) {
              transaction.set(doc(firestore, key, id), data);
            },
            delete() {
              transaction.delete(doc(firestore, key, id));
            },
          };
        },
      };
    }

    return transactions;
  }

  return () => {
    const isMountedRef = useRef(false);
    const [state, setState] = useState({
      isPending: false,
      error: null,
    });

    return {
      run: (callback: (transaction: Transactions<T>) => Promise<void>) => {
        runTransaction(firestore, (transaction) => {
          return callback(
            createCollectionsTransactions(transaction, collections)
          );
        }).then(
          () => {
            if (!isMountedRef.current) {
              return;
            }
            setState({
              isPending: false,
              error: null,
            });
          },
          (error) => {
            if (!isMountedRef.current) {
              return;
            }
            setState({
              isPending: false,
              error,
            });
          }
        );
      },
      isPending: state.isPending,
      error: state.error,
    };
  };
}
