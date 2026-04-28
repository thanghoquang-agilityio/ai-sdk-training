import type { StorageAccessor } from "@/types/storage";

function makeStorageAccessor(getStorage: () => Storage): StorageAccessor {
  return {
    read(key: string): string | null {
      if (typeof window === "undefined") return null;
      try {
        return getStorage().getItem(key);
      } catch {
        return null;
      }
    },
    write(key: string, value: string | null) {
      if (typeof window === "undefined") return;
      try {
        if (value !== null) {
          getStorage().setItem(key, value);
        } else {
          getStorage().removeItem(key);
        }
      } catch {
        // Ignore storage failures.
      }
    },
  };
}

export const local = makeStorageAccessor(() => window.localStorage);
export const session = makeStorageAccessor(() => window.sessionStorage);
