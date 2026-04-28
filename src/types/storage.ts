export type StorageAccessor = {
  read: (key: string) => string | null;
  write: (key: string, value: string | null) => void;
};
