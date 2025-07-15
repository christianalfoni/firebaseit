import { getApps, initializeApp } from "firebase/app";
import {
  collection,
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { createCollection } from "./collection";

import { createRetrieverCache } from "./retrieverCache";
import type {
  FirebaseStore,
  Collections,
  StoreOptions,
  AuthOptions,
} from "./types";
import { createUseTransaction } from "./useTransaction";
import { createAuth } from "./auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { createFiles } from "./files";
import { FunctionSchema } from "./schema";

export { s } from "./schema";

export function createFirebase<
  S extends Collections,
  A extends AuthOptions,
  F extends Record<string, FunctionSchema<any, any>>
>({
  schema,
  config,
  offline: enableLocalPersistence = true,
  auth,
  functions,
}: StoreOptions<S, A, F>): FirebaseStore<S, A, F> {
  let app = getApps()[0];
  let firestore: Firestore;

  if (app) {
    firestore = getFirestore(app);
  } else {
    app = initializeApp(config);
    firestore = initializeFirestore(app, {
      localCache: enableLocalPersistence
        ? persistentLocalCache({
            tabManager: persistentSingleTabManager(undefined),
          })
        : undefined,
    });
  }

  const retrieverCache = createRetrieverCache();
  const store: any = {
    collections: {},
  };

  for (const [key, value] of Object.entries(schema)) {
    store.collections[key] = createCollection(
      retrieverCache,
      value,
      collection(firestore, key)
    );
  }

  const storeAuth = createAuth(app, auth);
  const firebaseFunctions = getFunctions(app, "europe-west2");
  const files = createFiles(app);

  const evaluatedFunctions: any = {};

  for (const [key, value] of Object.entries(functions || {})) {
    evaluatedFunctions[key] = (payload: any) => {
      const callable = httpsCallable(firebaseFunctions, key);
      return callable(value.toServer(payload)).then((result) =>
        value.fromServer(result.data)
      );
    };
  }

  return {
    store,
    files,
    useTransaction: createUseTransaction(firestore, schema),
    auth: storeAuth,
    functions: evaluatedFunctions,
  } as any;
}
