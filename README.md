# firebaseit

A type-safe React Firebase framework designed for building monetizable apps with minimal boilerplate.

## Why firebaseit?

🔥 **Type-safe by design** - Complete TypeScript support with runtime validation  
⚡ **Suspense-first** - Built for modern React patterns with automatic caching  
💰 **Monetization ready** - Built-in Stripe integration for subscriptions and payments  
🔄 **Real-time optimistic updates** - Instant UI updates with automatic rollback on failure  
📱 **Mobile-friendly** - Automatic popup/redirect handling for different devices  
🛠️ **Zero boilerplate** - Minimal setup with maximum functionality  

## Quick Start

### 1. Installation

```bash
npm install firebaseit
```

### 2. Set up Firebase Project

Create a Firebase project with these services:
- **Firestore** - Document database
- **Authentication** - User management
- **Storage** - File uploads
- **Functions** - Server-side logic
- **Stripe Extension** - Payment processing

### 3. Define your schema

```ts
import { s } from "firebaseit";

// Define document structure
const TodoDocument = s.document({
  description: s.string(),
  completed: s.boolean(),
  createdAt: s.date(),
  userId: s.uid(),
});

// Define collection with nested collections
const TodosCollection = s.collection(TodoDocument, {
  comments: s.collection(s.document({
    text: s.string(),
    authorId: s.uid(),
  }))
});

// Define your database schema
export const schema = {
  todos: TodosCollection,
  users: s.collection(s.document({
    name: s.string(),
    email: s.string(),
    avatar: s.optional(s.string()),
  }))
};
```

### 4. Initialize Firebase

```ts
import { createFirebase } from "firebaseit";
import { schema } from "./schema";

export const fb = createFirebase({
  auth: {
    allowAnonymous: true,
    providers: ['google', 'github']
  },
  schema,
  config: {
    apiKey: "your-api-key",
    authDomain: "your-auth-domain",
    projectId: "your-project-id",
    storageBucket: "your-storage-bucket",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  },
});
```

### 5. Use in your components

```tsx
import { fb } from "./firebase";

function TodoApp() {
  const todos = fb.collections.todos.use();
  const { add, update, remove } = fb.collections.todos.useOperations();
  
  return (
    <div>
      {todos.data?.map(todo => (
        <div key={todo.id}>
          <input 
            type="checkbox" 
            checked={todo.completed}
            onChange={() => update(todo.id, { completed: !todo.completed })}
          />
          {todo.description}
          <button onClick={() => remove(todo.id)}>Delete</button>
        </div>
      ))}
      <button onClick={() => add({ 
        description: "New todo", 
        completed: false,
        createdAt: new Date(),
        userId: fb.auth.useUser().data?.uid || ""
      })}>
        Add Todo
      </button>
    </div>
  );
}
```

## Core Features

### 🗄️ Collections

**Real-time data with automatic caching**

```tsx
function TodoList() {
  // Get all todos
  const todos = fb.collections.todos.use();
  
  // Query with filters
  const completedTodos = fb.collections.todos.use(q => 
    q.where("completed", "==", true)
     .orderBy("createdAt", "desc")
     .limit(10)
  );
  
  // Suspense support
  const todosData = fb.collections.todos.use().suspend();
  
  // Operations with optimistic updates
  const { add, update, remove, operations } = fb.collections.todos.useOperations();
  
  return (
    <div>
      {todos.data?.map(todo => (
        <div key={todo.id}>
          {todo.description}
          {operations[todo.id]?.isPending && <span>Updating...</span>}
        </div>
      ))}
    </div>
  );
}
```

### 📄 Documents

**Individual document management**

```tsx
function TodoDetail({ todoId }: { todoId: string }) {
  const todo = fb.collections.todos.document(todoId).use();
  const { update, remove, isPending } = fb.collections.todos.document(todoId).useOperations();
  
  if (todo.isFetching) return <div>Loading...</div>;
  if (todo.error) return <div>Error: {todo.error.message}</div>;
  
  return (
    <div>
      <h1>{todo.data?.description}</h1>
      <button 
        onClick={() => update({ completed: !todo.data?.completed })}
        disabled={isPending}
      >
        {todo.data?.completed ? 'Mark Incomplete' : 'Mark Complete'}
      </button>
    </div>
  );
}
```

### 🔐 Authentication

**Seamless user management with automatic account linking**

```tsx
function AuthComponent() {
  const user = fb.auth.useUser();
  const { signIn, signOut, isPending } = fb.auth.useSignIn();
  
  if (user.isFetching) return <div>Loading...</div>;
  
  if (!user.data) {
    return (
      <div>
        <button onClick={() => signIn('google')} disabled={isPending}>
          Sign in with Google
        </button>
        <button onClick={() => signIn('github')} disabled={isPending}>
          Sign in with GitHub
        </button>
      </div>
    );
  }
  
  return (
    <div>
      <p>Welcome, {user.data.displayName}!</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}
```

### 📁 File Storage

**Upload and manage files with progress tracking**

```tsx
function FileUpload() {
  const { upload, url, isPending, progress, error } = fb.storage.useUpload();
  const { remove } = fb.storage.useRemove();
  
  const handleFileUpload = async (file: File) => {
    const result = await upload(`uploads/${file.name}`, file);
    console.log('Uploaded to:', result.url);
  };
  
  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        disabled={isPending}
      />
      {isPending && <div>Upload progress: {progress}%</div>}
      {error && <div>Error: {error.message}</div>}
      {url && (
        <div>
          <img src={url} alt="Uploaded" />
          <button onClick={() => remove([url])}>Delete</button>
        </div>
      )}
    </div>
  );
}
```

### 💳 Payments & Subscriptions

**Built-in Stripe integration for monetization**

```tsx
function PaymentComponent() {
  const products = fb.payment.useProducts();
  const { subscribe, isPending } = fb.payment.useSubscribe();
  const subscription = fb.payment.useSubscription();
  const portalUrl = fb.payment.usePortalUrl();
  
  if (subscription.data?.status === 'active') {
    return (
      <div>
        <p>You have an active subscription!</p>
        <a href={portalUrl.data} target="_blank">
          Manage Subscription
        </a>
      </div>
    );
  }
  
  return (
    <div>
      <h2>Choose a Plan</h2>
      {products.data?.map(product => (
        <ProductCard 
          key={product.id} 
          product={product}
          onSubscribe={(priceId) => subscribe(priceId)}
          isPending={isPending}
        />
      ))}
    </div>
  );
}
```

## Advanced Features

### 🔄 Transactions

**Multi-document atomic operations**

```tsx
function TransferTodo() {
  const { execute, isPending } = fb.useTransaction();
  
  const transferTodo = async (todoId: string, fromUserId: string, toUserId: string) => {
    await execute(async (transaction) => {
      const todoRef = fb.collections.todos.document(todoId).ref;
      const fromUserRef = fb.collections.users.document(fromUserId).ref;
      const toUserRef = fb.collections.users.document(toUserId).ref;
      
      const todo = await transaction.get(todoRef);
      const fromUser = await transaction.get(fromUserRef);
      const toUser = await transaction.get(toUserRef);
      
      transaction.update(todoRef, { userId: toUserId });
      transaction.update(fromUserRef, { todoCount: fromUser.data().todoCount - 1 });
      transaction.update(toUserRef, { todoCount: toUser.data().todoCount + 1 });
    });
  };
  
  return (
    <button onClick={() => transferTodo("todo-1", "user-1", "user-2")} disabled={isPending}>
      Transfer Todo
    </button>
  );
}
```

### 🔧 Schema Types Reference

```ts
import { s } from "firebaseit";

// Primitive types
s.string()          // String values
s.number()          // Numeric values  
s.boolean()         // Boolean values
s.date()            // Date objects
s.void()            // Undefined values
s.null()            // Null values
s.unknown()         // Any value
s.uid()             // Firebase UID strings

// Composite types
s.array(s.string())                    // Array of strings
s.object({ name: s.string() })         // Object with typed properties
s.optional(s.string())                 // Optional string
s.enum(s.constant("a"), s.constant("b")) // Union of constants

// Firebase-specific
s.document({ field: s.string() })      // Document schema
s.collection(documentSchema)           // Collection schema
s.functions(inputSchema, outputSchema) // Cloud function schema

// Nested collections
s.collection(s.document({
  title: s.string()
}), {
  comments: s.collection(s.document({
    text: s.string(),
    authorId: s.uid()
  }))
})
```

## Setup Guide

### Firebase Configuration

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Firestore, Auth, Storage, and Functions

2. **Configure Authentication**
   - Enable Google and GitHub providers
   - Set up authorized domains

3. **Install Stripe Extension**
   ```bash
   firebase ext:install stripe/firestore-stripe-payments
   ```

4. **Configure Stripe**
   - Add your Stripe keys to Firebase config
   - Set up webhooks for subscription events

### Environment Variables

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## API Reference

### Collections

| Method | Description |
|--------|-------------|
| `use()` | Get real-time collection data |
| `use(query)` | Get filtered collection data |
| `useOperations()` | Get CRUD operations |
| `document(id)` | Get document reference |

### Documents

| Method | Description |
|--------|-------------|
| `use()` | Get real-time document data |
| `useOperations()` | Get document operations |
| `ref` | Get Firestore document reference |

### Authentication

| Method | Description |
|--------|-------------|
| `useUser()` | Get current user |
| `useSignIn()` | Sign in operations |
| `useSignOut()` | Sign out operation |

### Storage

| Method | Description |
|--------|-------------|
| `useUpload()` | Upload files |
| `getUrl(path).use()` | Get file URL |
| `getList(path).use()` | List files |
| `useRemove()` | Remove files |

### Payments

| Method | Description |
|--------|-------------|
| `useProducts()` | Get available products |
| `usePrices(productId)` | Get product prices |
| `useSubscribe()` | Subscribe to product |
| `useSubscription()` | Get user subscription |
| `usePortalUrl()` | Get Stripe portal URL |

## Best Practices

### Security Rules

**Firestore Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /todos/{todoId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

**Storage Rules**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Error Handling

```tsx
function TodoList() {
  const todos = fb.collections.todos.use();
  
  if (todos.error) {
    return <ErrorBoundary error={todos.error} />;
  }
  
  return (
    <div>
      {todos.data?.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}
```

## Troubleshooting

### Common Issues

**"Firebase app not initialized"**
- Ensure `createFirebase` is called before using any hooks
- Check that your Firebase config is correct

**"Permission denied"**
- Verify your Firestore security rules
- Ensure user is authenticated for protected operations

**"Stripe webhook failed"**
- Check webhook endpoint configuration
- Verify webhook signing secret

## Migration Guide

### From Firebase v8 to firebaseit

```tsx
// Before (Firebase v8)
const [todos, setTodos] = useState([]);
useEffect(() => {
  const unsubscribe = db.collection('todos').onSnapshot(snapshot => {
    setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return unsubscribe;
}, []);

// After (firebaseit)
const todos = fb.collections.todos.use();
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.