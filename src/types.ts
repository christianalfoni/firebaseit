import { AuthCredential, OAuthCredential } from "firebase/auth";
import type { Auth } from "./auth";
import type { Collection } from "./collection";
import type { createPayment } from "./payment";
import type {
  CollectionSchema,
  FunctionSchema,
  Uid,
  VoidSchema,
} from "./schema";
import type { UseTransaction } from "./useTransaction";

export type Collections = Record<string, CollectionSchema<any>>;

export type FirebaseStore<
  S extends Collections,
  A extends AuthOptions,
  F extends Record<string, FunctionSchema<any, any>> = {}
> = {
  store: {
    collections: {
      [K in keyof S]: Collection<S[K]["document"]>;
    };
    useTransaction(): UseTransaction<S>;
  };
  auth: Auth<A>;
  payment: ReturnType<typeof createPayment>;
  functions: {
    [K in keyof F]: F[K]["request"] extends VoidSchema
      ? () => Promise<ReturnType<F[K]["fromServer"]>>
      : (
          payload: ReturnType<F[K]["toServer"]>
        ) => Promise<ReturnType<F[K]["fromServer"]>>;
  };
};

export type OAuthProvider = "google" | "github";

export type AuthOptions = {
  allowAnonymous?: boolean;
  // not implemented yet
  app?: string;
  persistence?: "local" | "session";
  providers?: {
    google?: {
      scopes?: string[];
      parameters?: Record<string, string>;
    };
    github?: {
      scopes?: string[];
      parameters?: Record<string, string>;
    };
  };
};

export type StoreOptions<
  S extends Collections,
  A extends AuthOptions,
  F extends Record<string, FunctionSchema<any, any>>
> = {
  schema: S;
  config: any;
  auth?: A;
  offline?: boolean;
  functions?: F;
};
