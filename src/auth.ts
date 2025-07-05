import type { FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GithubAuthProvider,
  type UserCredential,
  type User as FirebaseUser,
  linkWithCredential,
  EmailAuthProvider,
  linkWithRedirect,
  linkWithPopup,
  getRedirectResult,
} from "firebase/auth";
import type { AuthOptions, OAuthProvider } from "./types";
import { useEffect, useRef, useState } from "react";
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
  provider: OAuthProvider;
};

export type AnonymousUser = {
  uid: Uid;
  isAnonymous: true;
};

export type User = AuthenticatedUser | AnonymousUser;

export type Auth<T extends AuthOptions> = {
  useAuth(): (
    | {
        didSignUp: false;
        isPending: false;
        error: null;
        user: null;
      }
    | {
        didSignUp: false;
        isPending: true;
        error: null;
        user: null;
      }
    | {
        didSignUp: false;
        isPending: false;
        error: Error;
        user: null;
      }
    | {
        didSignUp: false;
        isPending: false;
        error: null;
        user: T["allowAnonymous"] extends true
          ? User | AuthenticatedUser
          : AuthenticatedUser | null;
      }
    | {
        didSignUp: true;
        isPending: false;
        error: null;
        user: T["allowAnonymous"] extends true
          ? User | AuthenticatedUser
          : AuthenticatedUser | null;
      }
  ) & {
    suspend(): T["allowAnonymous"] extends true ? User : AuthenticatedUser;
    signIn(provider: OAuthProvider): void;
    signOut(): void;
    link(provider: OAuthProvider): void;
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
    github() {
      const provider = new GithubAuthProvider();

      options?.providers?.github?.scopes?.forEach((scope: string) => {
        provider.addScope(scope);
      });

      if (options?.providers?.github?.parameters) {
        provider.setCustomParameters(options.providers?.github?.parameters);
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

    const provider = user.providerData[0];

    return {
      uid: user.uid,
      isAnonymous: false,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      provider: provider.providerId.includes("github") ? "github" : "google",
    };
  }

  function setUser(firebaseUser: FirebaseUser | null) {
    const user = getUserDetails(firebaseUser);

    createFulfilledPromise(userPromise, user);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));

    return user;
  }

  function didUserSignUp(firebaseUser: FirebaseUser | null): boolean {
    if (!firebaseUser) {
      return false;
    }

    const metadata = firebaseUser.metadata;

    if (!metadata || !metadata.creationTime || !metadata.lastSignInTime) {
      return false;
    }

    return metadata.creationTime === metadata.lastSignInTime;
  }

  const cachedUser = localStorage.getItem(LOCAL_STORAGE_KEY)
    ? JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)!)
    : null;

  const redirectResult = getRedirectResult(auth);

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
    // @ts-ignore
    useAuth() {
      const isMountedRef = useRef(false);

      useEffect(() => {
        isMountedRef.current = true;

        return () => {
          isMountedRef.current = false;
        };
      }, []);

      const [state, setState] = useState(
        userPromise.status === "pending"
          ? {
              isPending: true,
              error: null,
              user: null,
              didSignUp: false,
            }
          : userPromise.status === "fulfilled"
          ? {
              isPending: false,
              error: null,
              user: userPromise.value,
              didSignUp: false,
            }
          : {
              isPending: false,
              error: userPromise.reason,
              user: null,
              didSignUp: false,
            }
      );

      useEffect(
        () =>
          onAuthStateChanged(auth, async (user) => {
            if (!isMountedRef.current) {
              return;
            }

            redirectResult.then((redirectUserCredentials) => {
              setState((current) => {
                // Can happen on sign in as we set the user when signing in
                if (current.user && current.user.uid === user?.uid) {
                  return current;
                }

                return {
                  isPending: false,
                  error: null,
                  user: setUser(user),
                  didSignUp: didUserSignUp(user),
                };
              });
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
        link(provider: OAuthProvider) {
          if (!auth.currentUser) {
            throw new Error("No user to link to");
          }

          setState({
            isPending: true,
            error: null,
            user: null,
            didSignUp: false,
          });

          const onLinkSuccess = (userCredential: UserCredential) => {
            if (!isMountedRef.current) {
              return;
            }

            setState({
              isPending: false,
              error: null,
              user: setUser(userCredential.user),
              didSignUp: true,
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
              didSignUp: false,
            });
          };

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
        signIn(provider: OAuthProvider) {
          setState({
            isPending: true,
            error: null,
            user: null,
            didSignUp: false,
          });

          const onSignInError = (error: Error) => {
            if (!isMountedRef.current) {
              return;
            }

            setState({
              isPending: false,
              error,
              user: null,
              didSignUp: false,
            });
          };

          const providerInstance = providerInitialisers[provider]();

          if (isMobileUserAgent()) {
            signInWithRedirect(auth, providerInstance).catch(onSignInError);
          } else {
            signInWithPopup(auth, providerInstance).catch(onSignInError);
          }
        },
      };
    },
  };
}
