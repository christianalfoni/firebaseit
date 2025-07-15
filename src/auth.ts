import type { FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  GithubAuthProvider,
  type UserCredential,
  type User as FirebaseUser,
  linkWithRedirect,
  linkWithPopup,
  getRedirectResult,
  getAdditionalUserInfo,
  AdditionalUserInfo,
  OAuthCredential,
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

export type AuthState<T extends AuthOptions> = {
  signUp: {
    info: AdditionalUserInfo;
    credential: OAuthCredential;
  } | null;
} & (
  | {
      isPending: false;
      error: null;
      user: null;
    }
  | {
      isPending: true;
      error: null;
      user: null;
    }
  | {
      isPending: false;
      error: Error;
      user: null;
    }
  | {
      isPending: false;
      error: null;
      user: T["allowAnonymous"] extends true
        ? User | AuthenticatedUser
        : AuthenticatedUser | null;
    }
);

export type Auth<T extends AuthOptions> = {
  useAuth(): AuthState<T> & {
    suspend(): T["allowAnonymous"] extends true ? User : AuthenticatedUser;
    signIn(provider: OAuthProvider): void;
    signOut(): void;
    signedUp(): void;
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

  function getSignUp(userCredentials: UserCredential) {
    if (!userCredentials.providerId) {
      throw new Error("No providerId in user credentials");
    }
    const credential = userCredentials.providerId.includes("github")
      ? GithubAuthProvider.credentialFromResult(userCredentials)
      : GoogleAuthProvider.credentialFromResult(userCredentials);
    const info = getAdditionalUserInfo(userCredentials);

    if (!credential || !info) {
      throw new Error(
        "No credential or additional user info found in user credentials"
      );
    }

    return {
      info,
      credential,
    };
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

  let isSigningIn = false;
  const authStateChangeSubscriptions = new Set<(state: AuthState<T>) => void>();

  function notifyAuthStateSubscribers(state: AuthState<T>) {
    authStateChangeSubscriptions.forEach((callback) => {
      callback(state);
    });
  }

  onAuthStateChanged(auth, async (user) => {
    redirectResult.then((redirectUserCredentials) => {
      if (isSigningIn) {
        return;
      }

      notifyAuthStateSubscribers({
        isPending: false,
        error: null,
        user: setUser(user) as any,
        signUp: redirectUserCredentials
          ? getSignUp(redirectUserCredentials)
          : null,
      });
    });
  });

  return {
    // @ts-ignore
    useAuth() {
      const [state, setState] = useState<AuthState<T>>(
        userPromise.status === "pending"
          ? {
              isPending: true,
              error: null,
              user: null,
              signUp: null,
            }
          : userPromise.status === "fulfilled"
          ? {
              isPending: false,
              error: null,
              user: userPromise.value as any,
              signUp: null,
            }
          : {
              isPending: false,
              error: userPromise.reason,
              user: null,
              signUp: null,
            }
      );

      useEffect(() => {
        authStateChangeSubscriptions.add(setState);
        return () => {
          authStateChangeSubscriptions.delete(setState);
        };
      }, [setState]);

      // @ts-ignore
      return {
        ...state,
        signedUp() {
          setState((prev) => ({
            ...prev,
            signUp: null,
          }));
        },
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

          notifyAuthStateSubscribers({
            isPending: true,
            error: null,
            user: null,
            signUp: null,
          });

          const onLinkSuccess = (userCredential: UserCredential) => {
            notifyAuthStateSubscribers({
              isPending: false,
              error: null,
              user: setUser(userCredential.user) as any,
              signUp: userCredential ? getSignUp(userCredential) : null,
            });
          };

          const onLinkError = (error: Error) => {
            notifyAuthStateSubscribers({
              isPending: false,
              error,
              user: null,
              signUp: null,
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
          notifyAuthStateSubscribers({
            isPending: true,
            error: null,
            user: null,
            signUp: null,
          });

          isSigningIn = true;

          const onSignInSuccess = (userCredential: UserCredential) => {
            notifyAuthStateSubscribers({
              isPending: false,
              error: null,
              user: setUser(userCredential.user) as any,
              signUp: userCredential ? getSignUp(userCredential) : null,
            });

            isSigningIn = false;
          };

          const onSignInError = (error: Error) => {
            notifyAuthStateSubscribers({
              isPending: false,
              error,
              user: null,
              signUp: null,
            });
          };

          const providerInstance = providerInitialisers[provider]();

          if (isMobileUserAgent()) {
            signInWithRedirect(auth, providerInstance).catch(onSignInError);
          } else {
            signInWithPopup(auth, providerInstance)
              .then(onSignInSuccess)
              .catch(onSignInError);
          }
        },
      };
    },
  };
}
