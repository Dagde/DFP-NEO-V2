
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'fileRepositoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let db: IDBDatabase;

interface FileRecord {
    id: string;
    name: string;
    folderId: string;
    content: File;
}

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(true);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', request.error);
      reject(false);
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const addFile = (file: File, folderId: string, name: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const id = uuidv4();
        const fileRecord: FileRecord = { id, name, folderId, content: file };

        const request = store.add(fileRecord);

        request.onsuccess = () => {
            resolve(id);
        };

        request.onerror = () => {
            console.error('Error adding file:', request.error);
            reject(request.error);
        };
    });
};

export const getFile = (id: string): Promise<FileRecord | undefined> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Error getting file:', request.error);
            reject(request.error);
        };
    });
};

// Returns metadata only to avoid loading all file contents into memory
export const getAllFiles = (): Promise<{ id: string, name: string, folderId: string }[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        const files: { id: string, name: string, folderId: string }[] = [];

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const { id, name, folderId } = cursor.value;
                files.push({ id, name, folderId });
                cursor.continue();
            } else {
                resolve(files);
            }
        };

        request.onerror = () => {
            console.error('Error getting all files:', request.error);
            reject(request.error);
        };
    });
};

export const deleteFile = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting file:', request.error);
            reject(request.error);
        };
    });
};
