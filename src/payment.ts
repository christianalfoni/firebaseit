import {
  addDoc,
  collection,
  getDoc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import { s, type Id } from "./schema";
import {
  createFulfilledPromise,
  createPendingPromise,
  createRejectedPromise,
  createRetrieverCache,
  type SuspensePromise,
} from "./retrieverCache";
import { createCollection } from "./collection";
import type { Auth, User } from "./auth";
import { useState } from "react";
import { httpsCallable, type Functions } from "firebase/functions";

const priceSchema = s.document({
  foo: s.string(),
});
const pricesSchema = s.collection(priceSchema);

const productSchema = s.document(
  {},
  {
    prices: pricesSchema,
  }
);
const productsSchema = s.collection(productSchema);

const checkoutSessionSchema = s.document({
  mode: s.constant("subscription"),
  customer: s.string(),
  price: s.string(),
  success_url: s.string(),
  cancel_url: s.string(),
});

const checkoutSessionsSchema = s.collection(checkoutSessionSchema);

const subscriptionSchema = s.document({
  status: s.enum(s.constant("active"), s.constant("canceled")),
});
const subscriptionsSchema = s.collection(subscriptionSchema);

const customerSchema = s.document(
  {
    stripeId: s.string(),
    email: s.string(),
    stripeLink: s.string(),
  },
  {
    subscriptions: subscriptionsSchema,
    checkout_sessions: checkoutSessionsSchema,
  }
);
const customersSchema = s.collection(customerSchema);

export function createPayment(
  firestore: Firestore,
  functions: Functions,
  auth: Auth<any>
) {
  const functionRef = httpsCallable<
    { returnUrl: string; locale: string },
    { url: string }
  >(functions, "ext-firestore-stripe-payments-createPortalLink");

  const retrieverCache = createRetrieverCache();
  const collections = {
    customers: createCollection(
      retrieverCache,
      customersSchema,
      collection(firestore, "customers")
    ),
    products: createCollection(
      retrieverCache,
      productsSchema,
      collection(firestore, "products")
    ),
  };

  let portalLinkPromise: SuspensePromise<string>;

  function ensureUser(user: User | null) {
    if (!user) {
      throw new Error("You can not subscribe without signing in");
    }

    if (user.isAnonymous) {
      throw new Error("You can not subscribe as an anonymous user");
    }

    return user;
  }

  return {
    useSubscriptions() {
      const user = auth.useUser();

      const data = ensureUser(user.data);

      return collections.customers
        .document(data.uid)
        .collections.subscriptions.use((q) =>
          q.where("status", "==", "active")
        );
    },
    usePortalUrl() {
      if (!portalLinkPromise) {
        portalLinkPromise = createPendingPromise(
          functionRef({
            returnUrl: window.location.origin,
            locale: "auto", // Optional, defaults to "auto"
          }).then(
            (data) => {
              createFulfilledPromise(portalLinkPromise, data.data.url);

              setState({
                isPending: false,
                error: null,
                data: data.data.url,
              });

              return data.data.url;
            },
            (error) => {
              createRejectedPromise(portalLinkPromise, error);

              setState({
                isPending: false,
                error,
                data: null,
              });

              throw error;
            }
          )
        );
      }

      const [state, setState] = useState({
        isPending: portalLinkPromise.status === "pending",
        error:
          portalLinkPromise.status === "rejected"
            ? portalLinkPromise.reason
            : null,
        data:
          portalLinkPromise.status === "fulfilled"
            ? portalLinkPromise.value
            : null,
      });

      return {
        ...state,
        suspend() {
          if (portalLinkPromise.status === "pending") {
            throw portalLinkPromise;
          }

          if (portalLinkPromise.status === "rejected") {
            throw portalLinkPromise.reason;
          }

          if (portalLinkPromise.status === "fulfilled") {
            return portalLinkPromise.value;
          }

          throw new Error("Unexpected portal link promise state");
        },
        refresh() {
          setState({
            isPending: true,
            error: null,
            data: null,
          });

          functionRef({
            returnUrl: window.location.origin,
            locale: "auto",
          })
            .then((data) => {
              setState({
                isPending: false,
                error: null,
                data: data.data.url,
              });
            })
            .catch((error) => {
              setState({
                isPending: false,
                error,
                data: null,
              });
            });
        },
      };
    },
    useProducts() {
      return collections.products.use();
    },
    usePrices(productId: Id) {
      return collections.products.document(productId).collections.prices.use();
    },
    useSubscribe() {
      const user = auth.useUser();
      const userData = ensureUser(user.data);

      const [state, setState] = useState({
        isPending: false,
        error: null as Error | null,
      });

      return {
        ...state,
        subscribe(priceId: Id) {
          if (!user.data) {
            throw new Error("No user is signed in");
          }

          setState({ isPending: true, error: null });

          getDoc(collections.customers.document(userData.uid).ref)
            .then((customer) => {
              const customerData = customer.data();

              if (!customerData || !customerData.stripeId) {
                throw new Error("Customer does not exist or has no Stripe ID");
              }

              return addDoc(
                collections.customers.document(userData.uid).collections
                  .checkout_sessions.ref,
                {
                  mode: "subscription",
                  customer: customerData.stripeId,
                  price: priceId,
                  success_url: window.location.origin,
                  cancel_url: window.location.origin,
                }
              ).then((docRef) => {
                onSnapshot(docRef, (snap) => {
                  const { error, url } = snap.data() as {
                    error: Error | null;
                    url: string | null;
                  };

                  if (error) {
                    setState({ isPending: false, error });
                  }
                  if (url) {
                    window.location.assign(url);
                  }
                });
              });
            })
            .catch((error) => {
              setState({ isPending: false, error });
            });
        },
      };
    },
  };
}
