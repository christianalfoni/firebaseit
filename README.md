# firebaseit

A React Firebase framework with type-safe schema definitions, real-time data synchronization, and comprehensive state management.

## Prerequisites

- Create a Firebase project 
- Add Firestore, Storage, and Auth services
- Optionally add Cloud Functions
- Create a React app using Vite or your preferred bundler
- Initialize the Firebase project with the Firebase CLI

## Installation

```bash
npm install firebaseit
```

## Get Started

### 1. Build a schema for your store

```ts
import { s } from "firebaseit";

const TodoDocument = s.document({
  description: s.string(),
  completed: s.boolean(),
  createdAt: s.date(),
  tags: s.array(s.string()),
  priority: s.enum(s.constant("low"), s.constant("medium"), s.constant("high")),
  assignee: s.optional(s.object({
    name: s.string(),
    email: s.string(),
  })),
});

const TodosCollection = s.collection(TodoDocument);

export const schema = {
  todos: TodosCollection,
};
```

### 2. Build a schema for your functions (optional)

```ts
import { s } from "firebaseit";

export const functions = {
  createTodo: s.function(
    s.object({
      title: s.string(),
      priority: s.enum(s.constant("low"), s.constant("medium"), s.constant("high")),
    }),
    s.object({
      id: s.uid(),
      createdAt: s.date(),
    })
  ),
};
```

### 3. Configure your Firebase instance

```ts
import { createFirebase } from "firebaseit";
import { schema } from "./schema";
import { functions } from "./functions";

export const fb = createFirebase({
  auth: {
    allowAnonymous: true,
    providers: {
      google: {
        scopes: ["email", "profile"],
        customParameters: {},
      },
      github: {
        scopes: ["user:email"],
        customParameters: {},
      },
    },
  },
  schema,
  functions,
  config: {
    // Your Firebase config
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id",
  },
  // Optional: Configure offline persistence
  offline: true,
});
```

## Collections

### Consume all documents

```tsx
function MyComponent() {
  const todos = fb.collections.todos.use();
  
  // Access data states
  todos.data;        // Array of documents or null
  todos.isFetching;  // boolean
  todos.error;       // Error object or null
  
  // Use with React Suspense
  const data = todos.suspend();
}
```

### Query specific documents

```tsx
function MyComponent() {
  const completedTodos = fb.collections.todos.use((q) =>
    q.where("completed", "==", true)
     .orderBy("createdAt", "desc")
     .limit(10)
  );
  
  // Advanced querying
  const priorityTodos = fb.collections.todos.use((q) =>
    q.where("priority", "in", ["high", "medium"])
     .where("completed", "==", false)
     .orderBy("createdAt", "asc")
  );
}
```

### Collection operations

```tsx
function MyComponent() {
  const operations = fb.collections.todos.useOperations();
  
  // CRUD operations
  operations.add({
    description: "New todo",
    completed: false,
    createdAt: new Date(),
    tags: ["work"],
    priority: "medium",
  });
  
  operations.set("doc-id", {
    description: "Updated todo",
    completed: true,
    createdAt: new Date(),
    tags: ["personal"],
    priority: "low",
  });
  
  operations.update("doc-id", {
    completed: true,
    tags: ["work", "urgent"],
  });
  
  operations.remove("doc-id");
  
  // Track operation states
  operations.operations["doc-id"]?.isPending;
  operations.operations["doc-id"]?.error;
}
```

## Documents

### Consume document

```tsx
function MyComponent() {
  const todo = fb.collections.todos.document("some-id").use();
  
  todo.data;        // Document data or null
  todo.isFetching;  // boolean
  todo.error;       // Error object or null
  
  // Use with React Suspense
  const data = todo.suspend();
}
```

### Document operations

```tsx
function MyComponent() {
  const operations = fb.collections.todos.document("some-id").useOperations();
  
  operations.set({
    description: "Updated todo",
    completed: true,
    createdAt: new Date(),
    tags: ["personal"],
    priority: "low",
  });
  
  operations.update({
    completed: true,
    "assignee.name": "John Doe", // Nested field update
  });
  
  operations.remove();
  
  // Track operation state
  operations.isPending;
  operations.error;
}
```

### Subcollections

```tsx
function MyComponent() {
  const comments = fb.collections.todos
    .document("todo-id")
    .collection("comments")
    .use();
}
```

## Files (Storage)

### Upload files

```tsx
function MyComponent() {
  const { upload, url, isPending, error, progress } = fb.files.useUpload();
  
  const handleUpload = async (file: File) => {
    const downloadUrl = await upload("path/to/file.jpg", file);
    console.log("Upload complete:", downloadUrl);
  };
  
  // Upload supports File, Blob, or base64 string
  upload("path/image.jpg", file);
  upload("path/data.json", blob);
  upload("path/image.png", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...");
}
```

### Get download URL

```tsx
function MyComponent() {
  const url = fb.files.useUrl("path/file.jpg");
  
  url.data;        // Download URL string or null
  url.isFetching;  // boolean
  url.error;       // Error object or null
  
  // Use with React Suspense
  const downloadUrl = url.suspend();
}
```

### List files

```tsx
function MyComponent() {
  const list = fb.files.useList("path/to/directory");
  
  list.data;        // Array of file references or null
  list.isFetching;  // boolean
  list.error;       // Error object or null
  
  // Use with React Suspense
  const files = list.suspend();
}
```

### Remove files

```tsx
function MyComponent() {
  const { remove, pendingFiles, errors } = fb.files.useRemove();
  
  const handleRemove = async () => {
    await remove(["path/file1.jpg", "path/file2.png"]);
  };
  
  // Track pending operations
  pendingFiles; // Array of file paths being removed
  errors;       // Object with errors per file path
}
```

## Authentication

### Authentication state

```tsx
function MyComponent() {
  const auth = fb.auth.useAuth();
  
  // User data
  auth.user; // AuthenticatedUser | AnonymousUser | null
  
  // Authentication states
  auth.isSignedIn;      // boolean
  auth.isAnonymous;     // boolean
  auth.isSigningIn;     // boolean
  auth.isSigningOut;    // boolean
  auth.isLinking;       // boolean
  
  // Error states
  auth.signInError;     // Error object or null
  auth.signOutError;    // Error object or null
  auth.linkError;       // Error object or null
}
```

### Sign in with OAuth providers

```tsx
function MyComponent() {
  const auth = fb.auth.useAuth();
  
  const handleGoogleSignIn = () => {
    auth.signIn("google");
  };
  
  const handleGitHubSignIn = () => {
    auth.signIn("github");
  };
  
  // Automatically decides redirect vs popup based on mobile detection
  // Automatically links anonymous accounts if active
}
```

### User types

```ts
// Authenticated user
type AuthenticatedUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  provider: "google" | "github";
}

// Anonymous user
type AnonymousUser = {
  uid: string;
}
```

## Transactions

```tsx
function MyComponent() {
  const { executeTransaction, isPending, error } = fb.store.useTransaction();
  
  const handleBatchUpdate = async () => {
    await executeTransaction((tx) => {
      // Access all collections within transaction
      const todosRef = tx.collections.todos;
      
      // Transaction operations
      const todoData = await todosRef.document("todo-1").get();
      
      todosRef.document("todo-1").update({
        completed: true,
      });
      
      todosRef.document("todo-2").set({
        description: "New todo",
        completed: false,
        createdAt: new Date(),
        tags: [],
        priority: "medium",
      });
      
      todosRef.document("todo-3").delete();
    });
  };
}
```

## Cloud Functions

### Call functions

```tsx
function MyComponent() {
  const { call, isPending, error } = fb.functions.createTodo.use();
  
  const handleCreateTodo = async () => {
    const result = await call({
      title: "New todo from function",
      priority: "high",
    });
    
    console.log("Created todo:", result.id, result.createdAt);
  };
}
```

## Schema Types

### Basic types

```ts
import { s } from "firebaseit";

s.string();          // String type
s.number();          // Number type
s.boolean();         // Boolean type
s.date();            // Date type
s.uid();             // Firebase UID type
s.unknown();         // Any type
s.void();            // Void type
s.null();            // Null type
```

### Complex types

```ts
// Array of strings
s.array(s.string());

// Object with typed properties
s.object({
  name: s.string(),
  age: s.number(),
  active: s.boolean(),
});

// Optional properties
s.optional(s.string());

// Enum/Union types
s.enum(s.constant("small"), s.constant("medium"), s.constant("large"));

// Constant values
s.constant("ACTIVE");
```

### Document and collection schemas

```ts
// Document schema
const UserDocument = s.document({
  name: s.string(),
  email: s.string(),
  profile: s.object({
    bio: s.optional(s.string()),
    avatar: s.optional(s.string()),
  }),
  preferences: s.array(s.string()),
  role: s.enum(s.constant("admin"), s.constant("user")),
  createdAt: s.date(),
});

// Collection schema
const UsersCollection = s.collection(UserDocument);

// Function schema
const updateProfile = s.function(
  s.object({
    userId: s.uid(),
    updates: s.object({
      name: s.optional(s.string()),
      bio: s.optional(s.string()),
    }),
  }),
  s.object({
    success: s.boolean(),
    updatedAt: s.date(),
  })
);
```

## Advanced Features

### Nested field updates

```tsx
// Update nested object properties using dot notation
operations.update("doc-id", {
  "user.profile.name": "John Doe",
  "user.profile.bio": "Software developer",
  "settings.theme": "dark",
});
```

### Automatic increments and array operations

```tsx
// Numeric increments
operations.update("doc-id", {
  viewCount: 5, // Automatically converted to increment(5)
  likes: 1,     // Automatically converted to increment(1)
});

// Array operations
operations.update("doc-id", {
  tags: ["new", "updated"], // Automatically uses arrayUnion/arrayRemove
});
```

### Query operations

```tsx
// All supported query operations
const todos = fb.collections.todos.use((q) =>
  q.where("priority", "==", "high")
   .where("completed", "!=", true)
   .where("createdAt", ">", new Date("2023-01-01"))
   .where("tags", "array-contains", "urgent")
   .where("assignee.id", "in", ["user1", "user2"])
   .orderBy("createdAt", "desc")
   .limit(20)
   .startAfter(lastDoc)
);
```

### Offline support

```tsx
// Configure offline persistence
const fb = createFirebase({
  // ... other config
  offline: true, // Enable offline persistence
});
```

### Error handling

```tsx
// Comprehensive error handling
const todos = fb.collections.todos.use();

if (todos.error) {
  if (todos.error instanceof DocumentNotFoundError) {
    // Handle document not found
  } else if (todos.error instanceof PermissionDeniedError) {
    // Handle permission denied
  } else {
    // Handle other errors
  }
}
```

## Configuration Options

### Authentication configuration

```ts
const fb = createFirebase({
  auth: {
    allowAnonymous: true,
    providers: {
      google: {
        scopes: ["email", "profile"],
        customParameters: {
          prompt: "select_account",
        },
      },
      github: {
        scopes: ["user:email"],
        customParameters: {},
      },
    },
  },
  // ... other config
});
```

### Firebase configuration

```ts
const fb = createFirebase({
  config: {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id",
  },
  offline: true, // Enable offline persistence
  // ... other config
});
```

## Best Practices

1. **Define comprehensive schemas** - Use TypeScript's type inference for better developer experience
2. **Use transactions for batch operations** - Ensure data consistency across multiple documents
3. **Handle loading and error states** - Provide good user feedback during async operations
4. **Leverage React Suspense** - Use `.suspend()` for cleaner async component patterns
5. **Optimize queries** - Use appropriate indexes and query constraints
6. **Cache effectively** - The framework handles caching automatically, but be mindful of query complexity

## TypeScript Support

Firebaseit is built with TypeScript and provides full type safety:

- **Schema inference** - Types are automatically inferred from your schema definitions
- **Query type checking** - Field names and types are validated at compile time
- **Function signatures** - Input and output types are enforced for Cloud Functions
- **Error types** - Specific error classes for different operation failures
