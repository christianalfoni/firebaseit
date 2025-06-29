import type { FirebaseApp } from "firebase/app";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  list,
  uploadBytesResumable,
  type UploadTask,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { use, useEffect, useRef, useState } from "react";
import {
  createFulfilledPromise,
  createPendingPromise,
  type SuspensePromise,
} from "./retrieverCache";

function base64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length)
      .fill(0)
      .map((_, i) => slice.charCodeAt(i));
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: "image/png" });
}

export function createFiles(app: FirebaseApp) {
  const storage = getStorage(app);
  const urlCache: Record<string, Record<string, SuspensePromise<string>>> = {};
  const listCache: Record<
    string,
    SuspensePromise<{ name: string; path: string }[]>
  > = {};

  function getDirAndName(path: string) {
    return {
      dir: path.split("/").slice(0, -1).join("/"),
      name: path.split("/").pop() || "",
    };
  }

  return {
    useUrl(path: string) {
      const { dir, name } = getDirAndName(path);

      const dirCache = urlCache[dir] || (urlCache[dir] = {});

      if (name in dirCache) {
        return use(dirCache[name]);
      }

      const storageRef = ref(storage, path);
      dirCache[name] = createPendingPromise(
        getDownloadURL(storageRef).then((url) => {
          createFulfilledPromise(dirCache[name], url);

          return url;
        })
      );

      return dirCache[name];
    },
    useList(path: string) {
      const storageRef = ref(storage, path);

      if (path in listCache) {
        return use(listCache[path]);
      }

      listCache[path] = createPendingPromise(
        list(storageRef).then((list) => {
          return createFulfilledPromise(
            listCache[path],
            list.items.map((item) => ({
              name: item.name,
              path: item.fullPath,
            }))
          );
        })
      );

      return use(listCache[path]);
    },
    useRemove() {
      const isMountedRef = useRef(false);

      useEffect(() => {
        isMountedRef.current = true;

        return () => {
          isMountedRef.current = false;
        };
      }, []);

      const [state, setState] = useState({
        isPending: false,
        error: null as Error | null,
      });

      return {
        ...state,
        remove(path: string) {
          const storageRef = ref(storage, path);

          setState({
            isPending: true,
            error: null,
          });

          const { dir, name } = getDirAndName(path);

          deleteObject(storageRef)
            .then(() => {
              return listCache[dir];
            })
            .then((list) => {
              const updatedList = list.filter((item) => item.name !== name);
              createFulfilledPromise(listCache[dir], updatedList);

              if (!isMountedRef.current) {
                return;
              }

              setState({
                isPending: false,
                error: null,
              });
            })
            .catch((error) => {
              if (!isMountedRef.current) {
                return;
              }

              setState({
                isPending: false,
                error,
              });
            });
        },
      };
    },
    useUpload() {
      const isMountedRef = useRef(false);

      useEffect(() => {
        isMountedRef.current = true;

        return () => {
          isMountedRef.current = false;
        };
      }, []);

      const [state, setState] = useState({
        url: null as string | null,
        isPending: false,
        error: null as Error | null,
        progress: 0,
      });

      return {
        ...state,
        upload(path: string, file: File | string | Blob) {
          const storageRef = ref(storage, path);

          if (typeof file === "string") {
            file = base64ToBlob(file);
          }

          setState({
            url: null,
            isPending: true,
            error: null,
            progress: 0,
          });

          const task: UploadTask = uploadBytesResumable(storageRef, file);

          task.on(
            "state_changed",
            (snapshot: UploadTaskSnapshot) => {
              const { dir, name } = getDirAndName(path);
              const listPromise = listCache[dir] || Promise.resolve([]);

              listPromise.then((list) => {
                list.push({ name, path });
                createFulfilledPromise(listCache[dir], list);

                if (!isMountedRef.current) {
                  return;
                }

                const percent =
                  (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setState({
                  progress: percent,
                  isPending: true,
                  error: null,
                  url: null,
                });
              });
            },
            (error) => {
              if (!isMountedRef.current) {
                return;
              }

              setState({
                error,
                isPending: false,
                url: null,
                progress: 0,
              });
            },
            async () => {
              try {
                const url = await getDownloadURL(task.snapshot.ref);

                if (!isMountedRef.current) {
                  return;
                }

                setState({
                  url,
                  isPending: false,
                  error: null,
                  progress: 0,
                });
              } catch (e) {
                if (!isMountedRef.current) {
                  return;
                }

                setState({
                  error: e as Error,
                  isPending: false,
                  url: null,
                  progress: 0,
                });
              }
            }
          );
        },
      };
    },
  };
}
