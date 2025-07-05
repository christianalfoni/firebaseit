# firebaseit

A React firebase framework to build monetizable apps

## Prerequesites

- Create a Firebase project (Staging)
- Create a Stripe account (Test Mode)
- Add Firestore, Storage, Auth and the Stripe Extension
- Configure the Stripe extension
- Create an app using Vite
- Initialize the Firebase project with the Firebase CLI (Optionally add functions and/or hosting)

## Get started

### Build a schema of your store

```ts
import { s } from "firebaseit";

const TodoDocument = s.document({
  description: s.string(),
  completed: s.boolean(),
});

const TodosCollection = s.collection(TodoDocument);

export const schema = {
  todos: TodosCollection,
};
```

### Build a schema for your functions

```ts
import { s } from "firebaseit";

export const functions = {
  createTodo: s.functions(
    s.object({
      title: s.string(),
    }),
    s.object({
      id: s.uid(),
    })
  ),
};
```

### Configure your firebase instance

```ts
import { createFirebase } from "firebaseit";
import { schema } from "./schema";

export const fb = createFirebase({
  auth: {
    allowAnonymous: true,
  },
  schema,
  config: {
    // Your Firebase config
  },
});
```

## Collections

### Consume all documents

```tsx
function MyComponent() {
  const todos = fb.collections.todos.use();
  todos.data;
  todos.isFetching;
  todos.error;
  const data = todos.suspend();
}
```

### Query specific documents

```tsx
function MyComponent() {
  const todos = fb.collections.todos.use((q) =>
    q.where("completed", "==", true)
  );
}
```

### Collection operators

```tsx
function MyComponent() {
  const operations = fb.collections.todos.useOperations();
  operations.add;
  operations.set;
  operations.update;
  operations.remove;
  operations.operations[id]?.isPending;
}
```

## Documents

### Consume document

```tsx
function MyComponent() {
  const todo = fb.collections.todos.document("some-id").use();
  todo.data;
  todo.isFetching;
  todo.error;
  const data = todo.suspend();
}
```

### Document operations

```tsx
function MyComponent() {
  const operations = fb.collections.todos.document("some-id").useOperations();
  operations.set;
  operations.update;
  operations.remove;
  operations.isPending;
  operations.error;
}
```

## Files (Storage)

### Upload

```tsx
function MyComponent() {
  const { upload, url, isPending, error, progress } = fb.storage.useUpload();
}
```

### Get url

```tsx
function MyComponent() {
  const url = fb.storage.getUrl("path/file").use();
  url.data;
  url.isFetching;
  url.error;
  const data = url.suspend();
}
```

### Get list

```tsx
function MyComponent() {
  const list = fb.storage.getList("path").use();
  list.data;
  list.isFetching;
  list.error;
  const data = list.suspend();
}
```

### Remove

```tsx
function MyComponent() {
  const { remove, pendingFiles, errors } = fb.storage.useRemove();
}
```

## Using auth

### Current user

Depending on allowing anonymous user, this can be `null`.

```tsx
function MyComponent() {
  const user = fb.auth.useUser();
  user.data;
  user.isFetching;
  user.error;
  const data = user.suspend();
}
```

### Sign in

Pass provider to `signIn`, automatically decides redirect or popup based on environment. It also automatically links the anonymous account if active.

```tsx
function MyComponent() {
  const { signIn, user, isPending, error } = fb.auth.useSignIn();
}
```

## Using payment

### Get products

```tsx
function MyComponent() {
  const products = fb.payment.useProducts();
  products.data;
  products.isFetching;
  products.error;
  const data = products.suspend();
}
```

### Get product prices

```tsx
function MyComponent() {
  const prices = fb.payment.usePrices("product-id");
  prices.data;
  prices.isFetching;
  prices.error;
  const data = prices.suspend();
}
```

### Subscribe

```tsx
function MyComponent() {
  const { subscribe, isPending, error } = fb.payment.useSubscribe("price-id");
}
```

### Stripe Portal url

```tsx
function MyComponent() {
  const url = fb.payment.usePortalUrl();
  url.data;
  url.isFetching;
  url.error;
  const data = url.suspend();
}
```

### Subscription data

```tsx
function MyComponent() {
  const subscription = fb.payment.useSubscription();
}
```

## Schemas

```ts
import { s } from "firebaseit";

s.string();
s.number();
s.void();
s.unknown();
s.boolean();
s.constant("foo");
s.enum(s.constant("foo"), s.constant("bar"));
s.
```
