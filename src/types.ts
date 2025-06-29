import type { Auth } from "./auth";
import type { Collection } from "./collection";
import type { createPayment } from "./payment";
import type { CollectionSchema } from "./schema";
import type { UseTransaction } from "./useTransaction";

export type Collections = Record<string, CollectionSchema<any>>;

export type FirebaseStore<S extends Collections, A extends AuthOptions> = {
  store: {
    collections: {
      [K in keyof S]: Collection<S[K]["document"]>;
    };
    useTransaction(): UseTransaction<S>;
  };
  auth: Auth<A>;
  payment: ReturnType<typeof createPayment>;
};

export type AuthOptions = {
  allowAnonymous?: boolean;
  // not implemented yet
  persistence?: "local" | "session";
  providers?: {
    google?: {
      scopes?: string[];
      parameters?: Record<string, string>;
    };
  };
};

export type StoreOptions<S extends Collections, A extends AuthOptions> = {
  schema: S;
  config: any;
  auth?: A;
  offline?: boolean;
};
