import type { FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
  type User as FirebaseUser,
  linkWithCredential,
  EmailAuthProvider,
  linkWithRedirect,
  linkWithPopup,
} from "firebase/auth";
import type { AuthOptions } from "./types";
import { use, useEffect, useRef, useState } from "react";
import {
  createFulfilledPromise,
  createPendingPromise,
  type SuspensePromise,
} from "./retrieverCache";
import type { Uid } from "./schema";

function isMobileUserAgent(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

const LOCAL_STORAGE_KEY = "simple-firebase-auth-user";

export type AuthenticatedUser = {
  uid: Uid;
  isAnonymous: false;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  provider: Provider;
};

export type AnonymousUser = {
  uid: Uid;
  isAnonymous: true;
};

export type User = AuthenticatedUser | AnonymousUser;

export type Provider = "google";

export type Auth<T extends AuthOptions> = {
  useSignIn(): {
    signIn(provider: Provider | { email: string; password: string }): void;
    isPending: boolean;
    error: Error | null;
    user: User | null;
  };
  useUser(): (
    | {
        isFetching: false;
        error: null;
        data: null;
      }
    | {
        isFetching: true;
        error: null;
        data: null;
      }
    | {
        isFetching: false;
        error: Error;
        data: null;
      }
    | {
        isFetching: false;
        error: null;
        data: T["allowAnonymous"] extends true
          ? User | AuthenticatedUser
          : AuthenticatedUser | null;
      }
  ) & {
    suspend(): T["allowAnonymous"] extends true ? User : AuthenticatedUser;
  };
};

/**
TODO:
- Configure persistence. Defaults to browser local storage.
 */
export function createAuth<T extends AuthOptions>(
  app: FirebaseApp,
  options?: T
): Auth<T> {
  const auth = getAuth(app);

  const providerInitialisers = {
    google() {
      const provider = new GoogleAuthProvider();

      options?.providers?.google?.scopes?.forEach((scope) => {
        provider.addScope(scope);
      });

      if (options?.providers?.google?.parameters) {
        provider.setCustomParameters(options.providers?.google?.parameters);
      }

      return provider;
    },
  } as const;

  function getUserDetails(user: FirebaseUser | null): User | null {
    if (!user) {
      return null;
    }

    if (user.isAnonymous) {
      return {
        uid: user.uid,
        isAnonymous: true,
      };
    }

    if (!user.email) {
      throw new Error("Can not authenticate user without email");
    }

    return {
      uid: user.uid,
      isAnonymous: false,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      provider: user.providerId as Provider,
    };
  }

  function setUser(firebaseUser: FirebaseUser | null) {
    const user = getUserDetails(firebaseUser);

    createFulfilledPromise(userPromise, user);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));

    return user;
  }

  const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY)
    ? JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)!)
    : null;

  let userPromise = (
    cachedUser
      ? createFulfilledPromise(Promise.resolve(cachedUser), cachedUser)
      : createPendingPromise(
          new Promise<User | null>((resolve) => {
            const dispose = onAuthStateChanged(auth, (user) => {
              dispose();

              if (options?.allowAnonymous && !user) {
                signInAnonymously(auth).then((userCredential) => {
                  setUser(userCredential.user);
                });

                return;
              }

              resolve(setUser(user));
            });
          })
        )
  ) as SuspensePromise<User | null>;

  return {
    useSignIn() {
      const isMountedRef = useRef(false);
      const [state, setState] = useState({
        isPending: false,
        error: null as Error | null,
        user: null as User | null,
      });

      useEffect(() => {
        isMountedRef.current = true;

        return () => {
          isMountedRef.current = false;
        };
      }, []);

      return {
        ...state,
        link(provider: Provider | { email: string; password: string }) {
          if (!auth.currentUser) {
            throw new Error("No user to link to");
          }
          setState({
            isPending: true,
            error: null,
            user: null,
          });

          const onLinkSuccess = (userCredential: UserCredential) => {
            if (!isMountedRef.current) {
              return;
            }

            setState({
              isPending: false,
              error: null,
              user: setUser(userCredential.user),
            });
          };

          const onLinkError = (error: Error) => {
            if (!isMountedRef.current) {
              return;
            }

            setState({
              isPending: false,
              error,
              user: null,
            });
          };

          if (typeof provider !== "string") {
            const credential = EmailAuthProvider.credential(
              provider.email,
              provider.password
            );
            linkWithCredential(auth.currentUser, credential)
              .then(onLinkSuccess)
              .catch(onLinkError);
            return;
          }

          const providerInstance = providerInitialisers[provider]();

          if (isMobileUserAgent()) {
            linkWithRedirect(auth.currentUser, providerInstance)
              .then(onLinkSuccess)
              .catch(onLinkError);
          } else {
            linkWithPopup(auth.currentUser, providerInstance)
              .then(onLinkSuccess)
              .catch(onLinkError);
          }
        },
        signIn(provider: Provider | { email: string; password: string }) {
          setState({
            isPending: true,
            error: null,
            user: null,
          });

          const onSignInSuccess = (userCredential: UserCredential) => {
            if (!isMountedRef.current) {
              return;
            }

            setState({
              isPending: false,
              error: null,
              user: setUser(userCredential.user),
            });
          };

          const onSignInError = (error: Error) => {
            if (!isMountedRef.current) {
              return;
            }

            setState({
              isPending: false,
              error,
              user: null,
            });
          };

          if (typeof provider !== "string") {
            signInWithEmailAndPassword(auth, provider.email, provider.password)
              .then(onSignInSuccess)
              .catch(onSignInError);
            return;
          }

          const providerInstance = providerInitialisers[provider]();

          if (isMobileUserAgent()) {
            signInWithRedirect(auth, providerInstance)
              .then(onSignInSuccess)
              .catch(onSignInError);
          } else {
            signInWithPopup(auth, providerInstance)
              .then(onSignInSuccess)
              .catch(onSignInError);
          }
        },
      };
    },
    // @ts-ignore
    useUser() {
      const [state, setState] = useState(
        userPromise.status === "pending"
          ? {
              isFetching: true,
              error: null,
              data: null,
            }
          : userPromise.status === "fulfilled"
          ? {
              isFetching: false,
              error: null,
              data: userPromise.value,
            }
          : {
              isFetching: false,
              error: userPromise.reason,
              data: null,
            }
      );

      useEffect(
        () =>
          onAuthStateChanged(auth, async (user) => {
            setState({
              isFetching: false,
              error: null,
              data: setUser(user),
            });
          }),
        []
      );

      // @ts-ignore
      return {
        ...state,
        suspend() {
          if (userPromise.status === "pending") {
            throw userPromise;
          }

          if (userPromise.status === "rejected") {
            throw userPromise.reason;
          }

          if (userPromise.status === "fulfilled") {
            return userPromise.value;
          }

          throw new Error("Unexpected user promise state");
        },
      };
    },
  };
}
