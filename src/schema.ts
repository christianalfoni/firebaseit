import { FieldValue, serverTimestamp, Timestamp } from "firebase/firestore";

// 1) pick out exactly the keys that are Optionals
type OptionalKeys<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends OptionalSchema<any> ? K : never;
}[keyof T];

// 2) pick out the rest (the required ones)
type RequiredKeys<T extends Record<string, any>> = Exclude<
  keyof T,
  OptionalKeys<T>
>;

// 3) build the final mapped output type
type FromFirestoreObject<T extends ObjectSchemaProperties> =
  // all the required schema-keys stay required
  {
    [K in RequiredKeys<T>]: ReturnType<T[K]["fromFirestore"]>;
  } & { [K in OptionalKeys<T>]?: ReturnType<T[K]["fromFirestore"]> }; // all the optional schema-keys become optional (and return undefined if missing)

// 4) build the final mapped output type
type ToFirestoreObject<T extends ObjectSchemaProperties> =
  // all the required schema-keys stay required
  {
    [K in RequiredKeys<T>]: ReturnType<T[K]["toFirestore"]>;
  } & { [K in OptionalKeys<T>]?: ReturnType<T[K]["toFirestore"]> }; // all the optional schema-keys become optional (and return undefined if missing)

export type Id = string;

export type Uid = string;

export type Schema = Record<string, CollectionSchema<any>>;

type ConstantSchema<S extends string> = {
  type: "constant";
  value: S;
  fromFirestore: (val: unknown) => S;
  toFirestore: (val: S) => string;
};

export type OptionalSchema<S> = {
  type: "optional";
  schema: S;
  fromFirestore: (val: unknown) => SchemaType<S> | undefined;
  toFirestore: (val: SchemaType<S> | undefined) => unknown;
};

export type EnumSchema<S extends ArraySchemaValues[]> = {
  type: "enum";
  items: S;
  fromFirestore: (val: unknown) => SchemaType<S[number]>;
  toFirestore: (val: SchemaType<S[number]>) => unknown;
};

export type UidSchema = {
  type: "uid";
  fromFirestore: (val: unknown) => Uid;
  toFirestore: (val: unknown) => Uid;
};

export type StringSchema = {
  type: "string";
  fromFirestore: (val: unknown) => string;
  toFirestore: (val: unknown) => string;
};

export type DateSchema = {
  type: "date";
  fromFirestore: (val: unknown) => Date;
  toFirestore: (val: unknown) => Timestamp | FieldValue;
};

export type NumberSchema = {
  type: "number";
  fromFirestore: (val: unknown) => number;
  toFirestore: (val: unknown) => number;
};

export type BooleanSchema = {
  type: "boolean";
  fromFirestore: (val: unknown) => boolean;
  toFirestore: (val: unknown) => boolean;
};

export type ArraySchema = {
  type: "array";
  item: ArraySchemaValues;
  fromFirestore: (val: unknown) => unknown[];
  toFirestore: (val: unknown[]) => unknown[];
};

export type NullSchema = {
  type: "null";
  fromFirestore: (val: unknown) => null;
  toFirestore: (val: unknown) => null;
};

export type ArraySchemaValues =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | NullSchema
  | ObjectSchema<any>
  | UidSchema
  | ConstantSchema<any>;

export type ObjectSchemaValues =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | ArraySchema
  | NullSchema
  | ObjectSchema<any>
  | DateSchema
  | UidSchema
  | OptionalSchema<any>
  | EnumSchema<any>
  | ConstantSchema<any>;

export type ObjectSchemaProperties = Record<string, ObjectSchemaValues>;

export type ObjectSchema<T extends ObjectSchemaProperties> = {
  type: "object";
  fromFirestore: (val: unknown) => FromFirestoreObject<T>;
  toFirestore: (val: FromFirestoreObject<T>) => ToFirestoreObject<T>;
  properties: T;
};

// 1) your existing SchemaType<> helper
type SchemaType<S> = S extends StringSchema
  ? string
  : S extends NumberSchema
  ? number
  : S extends BooleanSchema
  ? boolean
  : S extends NullSchema
  ? null
  : S extends ArraySchema
  ? SchemaType<S["item"]>[]
  : S extends ObjectSchema<any>
  ? ReturnType<S["fromFirestore"]>
  : S extends OptionalSchema<infer U>
  ? SchemaType<U> | undefined
  : S extends EnumSchema<infer U>
  ? SchemaType<U[number]>
  : S extends ConstantSchema<infer U>
  ? U
  : never;

// 2) top‐level keys
type DirectUpdates<S extends ObjectSchema<any>> = {
  [K in keyof S["properties"]]: SchemaType<S["properties"][K]>;
};

// 3) one level down: “a.b”
type Nested1<S extends ObjectSchema<any>> = {
  [K in keyof S["properties"]]: S["properties"][K] extends ObjectSchema<
    infer Sub
  >
    ? {
        [P in keyof Sub as `${Extract<K, string>}.${Extract<
          P,
          string
        >}`]: SchemaType<Sub[P]>;
      }
    : {};
}[keyof S["properties"]];

// 4) two levels: “a.b.c”
type Nested2<S extends ObjectSchema<any>> = {
  [K1 in keyof S["properties"]]: S["properties"][K1] extends ObjectSchema<
    infer Sub1
  >
    ? {
        [K2 in keyof Sub1]: Sub1[K2] extends ObjectSchema<infer Sub2>
          ? {
              [P in keyof Sub2 as `${Extract<K1, string>}.${Extract<
                K2,
                string
              >}.${Extract<P, string>}`]: SchemaType<Sub2[P]>;
            }
          : {};
      }[keyof Sub1]
    : {};
}[keyof S["properties"]];

// 5) three levels: “a.b.c.d”
type Nested3<S extends ObjectSchema<any>> = {
  [K1 in keyof S["properties"]]: S["properties"][K1] extends ObjectSchema<
    infer Sub1
  >
    ? {
        [K2 in keyof Sub1]: Sub1[K2] extends ObjectSchema<infer Sub2>
          ? {
              [K3 in keyof Sub2]: Sub2[K3] extends ObjectSchema<infer Sub3>
                ? {
                    [P in keyof Sub3 as `${Extract<K1, string>}.${Extract<
                      K2,
                      string
                    >}.${Extract<K3, string>}.${Extract<
                      P,
                      string
                    >}`]: SchemaType<Sub3[P]>;
                  }
                : {};
            }[keyof Sub2]
          : {};
      }[keyof Sub1]
    : {};
}[keyof S["properties"]];

// 8) finally, stitch them all together
export type DocumentDataUpdates<S extends ObjectSchema<any>> = Partial<
  DirectUpdates<S> & Nested1<S> & Nested2<S> & Nested3<S>
>;

export type DocumentData<T extends ObjectSchema<any>> = ReturnType<
  T["fromFirestore"]
> & { id: Id };

export type DocumentSchema<
  T extends ObjectSchema<any>,
  C extends Record<string, CollectionSchema<any>> = {}
> = {
  type: "document";
  fromFirestore: (val: unknown) => ReturnType<T["fromFirestore"]> & { id: Id };
  toFirestore: (
    val: ReturnType<T["fromFirestore"]> & { id: Id }
  ) => ReturnType<T["toFirestore"]>;
  properties: T;
  collections: C;
};

export type CollectionSchema<T extends DocumentSchema<any, any>> = {
  type: "collection";
  fromFirestore: (val: unknown) => Array<ReturnType<T["fromFirestore"]>>;
  toFirestore: (
    val: Array<ReturnType<T["fromFirestore"]>>
  ) => Array<ReturnType<T["toFirestore"]>>;
  document: T;
};

export const s = {
  constant: <S extends string>(value: S): ConstantSchema<S> => ({
    type: "constant",
    value,
    fromFirestore: (val: unknown) => {
      if (val !== value) {
        throw new Error(`Expected constant value \"${value}\", got \"${val}\"`);
      }
      return value;
    },
    toFirestore: (val: S) => {
      if (val !== value) {
        throw new Error(`Expected constant value \"${value}\", got \"${val}\"`);
      }
      return val;
    },
  }),
  optional: <
    S extends
      | ArraySchemaValues
      | ObjectSchema<any>
      | StringSchema
      | NumberSchema
      | BooleanSchema
      | NullSchema
      | DateSchema
      | UidSchema
  >(
    inner: S
  ): OptionalSchema<S> => ({
    type: "optional",
    schema: inner,
    fromFirestore: (val: unknown) => {
      if (val === undefined || val === null) {
        return undefined;
      }
      return inner.fromFirestore(val) as SchemaType<S>;
    },
    toFirestore: (val: SchemaType<S> | undefined) => {
      if (val === undefined) {
        // Firestore will simply omit fields set to undefined
        return undefined;
      }
      return inner.toFirestore(val as any);
    },
  }),
  enum: <S extends ArraySchemaValues[]>(...items: S): EnumSchema<S> => ({
    type: "enum",
    items,
    fromFirestore: (val: unknown) => {
      for (const item of items) {
        try {
          return item.fromFirestore(val) as SchemaType<S[number]>;
        } catch {
          // try next
        }
      }
      throw new Error(`Value "${val}" does not match any enum variant`);
    },
    toFirestore: (val: SchemaType<S[number]>) => {
      // find the schema that accepts this value
      for (const item of items) {
        try {
          // @ts-ignore
          return item.toFirestore(val);
        } catch {
          // no-op, try next
        }
      }
      throw new Error(`Value "${val}" does not match any enum variant`);
    },
  }),
  date: (): DateSchema => ({
    type: "date",
    fromFirestore: (val) => {
      if (!(val instanceof Timestamp)) {
        throw new Error("Value is not a timestamp");
      }

      return val.toDate();
    },
    toFirestore: (val) => {
      if (!(val instanceof Date)) {
        throw new Error("Value is not a date");
      }

      // If created within the last second
      if (Date.now() - val.getTime() < 1000) {
        return serverTimestamp();
      }

      return Timestamp.fromDate(val);
    },
  }),
  uid: (): UidSchema => ({
    type: "uid",
    fromFirestore: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
    toFirestore: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
  }),
  string: (): StringSchema => ({
    type: "string",
    fromFirestore: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
    toFirestore: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
  }),
  boolean: (): BooleanSchema => ({
    type: "boolean",
    fromFirestore: (val) => {
      if (typeof val !== "boolean") {
        throw new Error("Value is not a boolean");
      }

      return val;
    },
    toFirestore: (val) => {
      if (typeof val !== "boolean") {
        throw new Error("Value is not a boolean");
      }

      return val;
    },
  }),
  array: (item: ArraySchemaValues): ArraySchema => ({
    type: "array",
    item,
    fromFirestore: (val) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not an array");
      }

      return val;
    },
    toFirestore: (val) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not an array");
      }

      return val;
    },
  }),
  null: (): NullSchema => ({
    type: "null",
    fromFirestore: (val) => {
      if (val !== null) {
        throw new Error("Value is not null");
      }

      return val;
    },
    toFirestore: (val) => {
      if (val !== null) {
        throw new Error("Value is not null");
      }

      return val;
    },
  }),
  object: <T extends ObjectSchemaProperties>(
    properties: T
  ): ObjectSchema<T> => ({
    type: "object",
    fromFirestore: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.fromFirestore(val[key]);
      }

      return obj as {
        [K in keyof T]: ReturnType<T[K]["fromFirestore"]>;
      };
    },
    toFirestore: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.toFirestore(val[key]);
      }

      return obj as {
        [K in keyof T]: ReturnType<T[K]["toFirestore"]>;
      };
    },
    properties,
  }),
  document: <
    T extends ObjectSchemaProperties,
    C extends Record<string, CollectionSchema<any>>
  >(
    properties: T,
    collections: C = {} as C
  ): DocumentSchema<ObjectSchema<T>, C> => ({
    type: "document",
    fromFirestore: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      if (!("id" in val) || typeof val.id !== "string") {
        throw new Error("Value is not a document, no id present");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.fromFirestore(val[key]);
      }

      return obj as { id: Id } & ReturnType<ObjectSchema<T>["fromFirestore"]>;
    },
    toFirestore: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      if (!("id" in val) || typeof val.id !== "string") {
        throw new Error("Value is not a document, no id present");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.toFirestore(val[key]);
      }

      return obj as { id: Id } & ReturnType<ObjectSchema<T>["toFirestore"]>;
    },
    properties: s.object(properties),
    collections,
  }),
  collection: <T extends DocumentSchema<any>>(
    document: T
  ): CollectionSchema<T> => ({
    type: "collection",
    fromFirestore: (val: unknown) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not a collection");
      }

      return val.map((item) => document.fromFirestore(item)) as Array<
        ReturnType<T["fromFirestore"]>
      >;
    },
    toFirestore: (val) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not a collection");
      }

      return val.map((item) => document.toFirestore(item)) as Array<
        ReturnType<T["toFirestore"]>
      >;
    },
    document,
  }),
};
