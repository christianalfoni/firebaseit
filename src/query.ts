import type { DocumentData, DocumentSchema } from "./schema";
import { type Query as FirestoreQuery, query } from "firebase/firestore";
import type { RetrieverCache } from "./retrieverCache";
import { use, useSyncExternalStore } from "react";

export type Query<T extends DocumentSchema<any>> = {
  use(): DocumentData<T["properties"]>[];
};

export function createQuery<T extends DocumentSchema<any>>(
  retrieverCache: RetrieverCache,
  ref: FirestoreQuery
): Query<T> {
  const retriever = retrieverCache.create({
    type: "query",
    ref,
  });

  return {
    use() {
      use(retriever.get());

      return useSyncExternalStore(retriever.subscribe, retriever.getSnapshot);
    },
  };
}
