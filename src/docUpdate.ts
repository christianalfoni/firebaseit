import {
  arrayRemove,
  arrayUnion,
  increment,
  type DocumentData,
} from "firebase/firestore";
import type { DocumentSchema } from "./schema";
import isEqual from "lodash.isequal";

export interface DiffResult<T> {
  added: T[];
  removed: T[];
}

/**
 * Compute which items were added to or removed from oldArr → newArr,
 * using deep equality (so objects/arrays are compared by value, not by reference).
 */
export function diffDeep<T>(oldArr: T[], newArr: T[]): DiffResult<T> {
  const added: T[] = newArr.filter((n) => !oldArr.some((o) => isEqual(o, n)));
  const removed: T[] = oldArr.filter((o) => !newArr.some((n) => isEqual(o, n)));
  return { added, removed };
}

export function createDocUpdate(doc: DocumentData, data: any) {
  const dataUpdates: any = {};

  for (const [key, value] of Object.entries(data)) {
    const path = key.split(".");
    if (typeof value === "number") {
      const currentValue = path.reduce(
        (aggr, key) => aggr[key],
        doc
      ) as unknown as number;

      dataUpdates[key] = increment(currentValue + value);
    } else if (Array.isArray(value)) {
      const diff = diffDeep(doc[key], value);

      if (diff.added.length) {
        dataUpdates[key] = arrayUnion(...diff.added);
      } else if (diff.removed.length) {
        dataUpdates[key] = arrayRemove(...diff.removed);
      }
    } else {
      dataUpdates[key] = value;
    }
  }

  return dataUpdates;
}
