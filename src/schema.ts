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
export type fromServerObject<T extends ObjectSchemaProperties> =
  // all the required schema-keys stay required
  {
    [K in RequiredKeys<T>]: ReturnType<T[K]["fromServer"]>;
  } & { [K in OptionalKeys<T>]?: ReturnType<T[K]["fromServer"]> }; // all the optional schema-keys become optional (and return undefined if missing)

// 4) build the final mapped output type
export type toServerObject<T extends ObjectSchemaProperties> =
  // all the required schema-keys stay required
  {
    [K in RequiredKeys<T>]: ReturnType<T[K]["toServer"]>;
  } & { [K in OptionalKeys<T>]?: ReturnType<T[K]["toServer"]> }; // all the optional schema-keys become optional (and return undefined if missing)

export type Id = string;

export type Uid = string;

export type Schema = Record<string, CollectionSchema<any>>;

type ConstantSchema<S extends string> = {
  type: "constant";
  value: S;
  fromServer: (val: unknown) => S;
  toServer: (val: S) => string;
};

export type OptionalSchema<S> = {
  type: "optional";
  schema: S;
  fromServer: (val: unknown) => SchemaType<S> | undefined;
  toServer: (val: SchemaType<S> | undefined) => unknown;
};

export type EnumSchema<S extends ArraySchemaValues[]> = {
  type: "enum";
  items: S;
  fromServer: (val: unknown) => SchemaType<S[number]>;
  toServer: (val: SchemaType<S[number]>) => unknown;
};

export type UidSchema = {
  type: "uid";
  fromServer: (val: unknown) => Uid;
  toServer: (val: unknown) => Uid;
};

export type UnknownSchema = {
  type: "unknown";
  fromServer: (val: unknown) => unknown;
  toServer: (val: unknown) => unknown;
};

export type VoidSchema = {
  type: "void";
  fromServer: (val: unknown) => undefined;
  toServer: (val: unknown) => undefined;
};

export type StringSchema = {
  type: "string";
  fromServer: (val: unknown) => string;
  toServer: (val: unknown) => string;
};

export type DateSchema = {
  type: "date";
  fromServer: (val: unknown) => Date;
  toServer: (val: unknown) => Timestamp | FieldValue;
};

export type NumberSchema = {
  type: "number";
  fromServer: (val: unknown) => number;
  toServer: (val: unknown) => number;
};

export type BooleanSchema = {
  type: "boolean";
  fromServer: (val: unknown) => boolean;
  toServer: (val: unknown) => boolean;
};

export type ArraySchema<T extends ArraySchemaValues> = {
  type: "array";
  item: T;
  fromServer: (val: unknown) => ReturnType<T["fromServer"]>[];
  toServer: (val: unknown[]) => ReturnType<T["toServer"]>[];
};

export type NullSchema = {
  type: "null";
  fromServer: (val: unknown) => null;
  toServer: (val: unknown) => null;
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
  | ArraySchema<any>
  | NullSchema
  | ObjectSchema<any>
  | DateSchema
  | UidSchema
  | OptionalSchema<any>
  | EnumSchema<any>
  | ConstantSchema<any>
  | UnknownSchema;

export type ObjectSchemaProperties = Record<string, ObjectSchemaValues>;

export type ObjectSchema<T extends ObjectSchemaProperties> = {
  type: "object";
  fromServer: (val: unknown) => fromServerObject<T>;
  toServer: (val: unknown) => toServerObject<T>;
  properties: T;
};

// 1) your existing SchemaType<> helper
type SchemaType<S> = S extends DateSchema
  ? Date
  : S extends VoidSchema
  ? void
  : S extends UnknownSchema
  ? unknown
  : S extends StringSchema
  ? string
  : S extends NumberSchema
  ? number
  : S extends BooleanSchema
  ? boolean
  : S extends NullSchema
  ? null
  : S extends ArraySchema<any>
  ? SchemaType<S["item"]>[]
  : S extends ObjectSchema<any>
  ? ReturnType<S["fromServer"]>
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
  T["fromServer"]
> & { id: Id };

export type DocumentSchema<
  T extends ObjectSchema<any>,
  C extends Record<string, CollectionSchema<any>> = {}
> = {
  type: "document";
  fromServer: (val: unknown) => ReturnType<T["fromServer"]> & { id: Id };
  toServer: (
    val: ReturnType<T["fromServer"]> & { id: Id }
  ) => ReturnType<T["toServer"]>;
  properties: T;
  collections: C;
};

export type CollectionSchema<T extends DocumentSchema<any, any>> = {
  type: "collection";
  fromServer: (val: unknown) => Array<ReturnType<T["fromServer"]>>;
  toServer: (
    val: Array<ReturnType<T["fromServer"]>>
  ) => Array<ReturnType<T["toServer"]>>;
  document: T;
};

export type FunctionSchema<
  Req extends ObjectSchema<any> | VoidSchema,
  Res extends ObjectSchema<any> | ArraySchema<any>
> = {
  type: "function";
  request: Req;
  response: Res;
  toServer: (val: unknown) => ReturnType<Req["toServer"]>;
  fromServer: (val: unknown) => ReturnType<Res["fromServer"]>;
};

export const s = {
  constant: <S extends string>(value: S): ConstantSchema<S> => ({
    type: "constant",
    value,
    fromServer: (val: unknown) => {
      if (val !== value) {
        throw new Error(`Expected constant value \"${value}\", got \"${val}\"`);
      }
      return value;
    },
    toServer: (val: S) => {
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
    fromServer: (val: unknown) => {
      if (val === undefined || val === null) {
        return undefined;
      }
      return inner.fromServer(val) as SchemaType<S>;
    },
    toServer: (val: SchemaType<S> | undefined) => {
      if (val === undefined) {
        // Firestore will simply omit fields set to undefined
        return undefined;
      }
      return inner.toServer(val as any);
    },
  }),
  enum: <S extends ArraySchemaValues[]>(...items: S): EnumSchema<S> => ({
    type: "enum",
    items,
    fromServer: (val: unknown) => {
      for (const item of items) {
        try {
          return item.fromServer(val) as SchemaType<S[number]>;
        } catch {
          // try next
        }
      }
      throw new Error(`Value "${val}" does not match any enum variant`);
    },
    toServer: (val: SchemaType<S[number]>) => {
      // find the schema that accepts this value
      for (const item of items) {
        try {
          // @ts-ignore
          return item.toServer(val);
        } catch {
          // no-op, try next
        }
      }
      throw new Error(`Value "${val}" does not match any enum variant`);
    },
  }),
  date: (): DateSchema => ({
    type: "date",
    fromServer: (val) => {
      if (!(val instanceof Timestamp)) {
        throw new Error("Value is not a timestamp");
      }

      return val.toDate();
    },
    toServer: (val) => {
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
    fromServer: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
    toServer: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
  }),
  void: (): VoidSchema => ({
    type: "void",
    fromServer: (val) => {
      if (val !== undefined) {
        throw new Error("Value is not undefined");
      }

      return val;
    },
    toServer: (val) => {
      if (typeof val !== "undefined") {
        throw new Error("Value is not undefined");
      }

      return val;
    },
  }),
  string: (): StringSchema => ({
    type: "string",
    fromServer: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
    toServer: (val) => {
      if (typeof val !== "string") {
        throw new Error("Value is not a string");
      }

      return val;
    },
  }),
  boolean: (): BooleanSchema => ({
    type: "boolean",
    fromServer: (val) => {
      if (typeof val !== "boolean") {
        throw new Error("Value is not a boolean");
      }

      return val;
    },
    toServer: (val) => {
      if (typeof val !== "boolean") {
        throw new Error("Value is not a boolean");
      }

      return val;
    },
  }),
  number: (): NumberSchema => ({
    type: "number",
    fromServer: (val) => {
      if (typeof val !== "number") {
        throw new Error("Value is not a number");
      }

      return val;
    },
    toServer: (val) => {
      if (typeof val !== "number") {
        throw new Error("Value is not a number");
      }

      return val;
    },
  }),
  array: <T extends ArraySchemaValues>(item: T): ArraySchema<T> => ({
    type: "array",
    item,
    fromServer: (val) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not an array");
      }

      return val.map((itemVal) => item.fromServer(itemVal)) as ReturnType<
        T["fromServer"]
      >[];
    },
    toServer: (val) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not an array");
      }

      return val.map((itemVal) => item.toServer(itemVal)) as ReturnType<
        T["toServer"]
      >[];
    },
  }),
  null: (): NullSchema => ({
    type: "null",
    fromServer: (val) => {
      if (val !== null) {
        throw new Error("Value is not null");
      }

      return val;
    },
    toServer: (val) => {
      if (val !== null) {
        throw new Error("Value is not null");
      }

      return val;
    },
  }),
  unknown: (): UnknownSchema => ({
    type: "unknown",
    fromServer: (val) => {
      return val;
    },
    toServer: (val) => {
      return val;
    },
  }),
  object: <T extends ObjectSchemaProperties>(
    properties: T
  ): ObjectSchema<T> => ({
    type: "object",
    fromServer: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.fromServer(val[key]);
      }

      return obj as {
        [K in keyof T]: ReturnType<T[K]["fromServer"]>;
      };
    },
    toServer: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.toServer(val[key]);
      }

      return obj as {
        [K in keyof T]: ReturnType<T[K]["toServer"]>;
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
    fromServer: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      if (!("id" in val) || typeof val.id !== "string") {
        throw new Error("Value is not a document, no id present");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.fromServer(val[key]);
      }

      return obj as { id: Id } & ReturnType<ObjectSchema<T>["fromServer"]>;
    },
    toServer: (val: any) => {
      if (val === null || typeof val !== "object" || Array.isArray(val)) {
        throw new Error("Value is not an object");
      }

      if (!("id" in val) || typeof val.id !== "string") {
        throw new Error("Value is not a document, no id present");
      }

      const obj: any = {};

      for (const [key, schema] of Object.entries(properties)) {
        obj[key] = schema.toServer(val[key]);
      }

      return obj as { id: Id } & ReturnType<ObjectSchema<T>["toServer"]>;
    },
    properties: s.object(properties),
    collections,
  }),
  collection: <T extends DocumentSchema<any>>(
    document: T
  ): CollectionSchema<T> => ({
    type: "collection",
    fromServer: (val: unknown) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not a collection");
      }

      return val.map((item) => document.fromServer(item)) as Array<
        ReturnType<T["fromServer"]>
      >;
    },
    toServer: (val) => {
      if (!Array.isArray(val)) {
        throw new Error("Value is not a collection");
      }

      return val.map((item) => document.toServer(item)) as Array<
        ReturnType<T["toServer"]>
      >;
    },
    document,
  }),
  function: <
    ReqProps extends ObjectSchema<any> | VoidSchema,
    ResProps extends ObjectSchema<any> | ArraySchema<any>
  >(
    request: ReqProps,
    response: ResProps
  ): FunctionSchema<ReqProps, ResProps> => ({
    type: "function",
    request,
    response,
    toServer: (payload) => request.toServer(payload) as any,
    fromServer: (res) => response.fromServer(res) as any,
  }),
};
