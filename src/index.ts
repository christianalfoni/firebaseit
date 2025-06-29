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
import { createPayment } from "./payment";
import { getFunctions } from "firebase/functions";
import { createFiles } from "./files";

export { s } from "./schema";

export function createFirebase<S extends Collections, A extends AuthOptions>({
  schema,
  config,
  offline: enableLocalPersistence = true,
  auth,
}: StoreOptions<S, A>): FirebaseStore<S, A> {
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
  const functions = getFunctions(app, "europe-west2");
  const files = createFiles(app);

  return {
    store,
    files,
    useTransaction: createUseTransaction(firestore, schema),
    auth: storeAuth,
    payment: createPayment(firestore, functions, storeAuth),
  } as any;
}
