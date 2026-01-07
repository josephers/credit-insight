import { DealSession } from '../types';

const DB_NAME = 'CreditInsightDB';
const STORE_NAME = 'sessions';
const DB_VERSION = 2;

/**
 * Open the IndexedDB database.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Database error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Get all deal sessions from the database.
 */
export const getAllSessions = async (): Promise<DealSession[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // IndexedDB stores Dates as objects, but sometimes they need re-instantiation
      const sessions = request.result.map(session => ({
        ...session,
        lastModified: new Date(session.lastModified),
        chatHistory: session.chatHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
      // Sort by last modified descending
      sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
      resolve(sessions);
    };

    request.onerror = () => reject(request.error);
  });
};

/**
 * Save or update a deal session.
 */
export const saveSession = async (session: DealSession): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(session);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete a deal session by ID.
 */
export const deleteSessionById = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Exports the entire database to a JSON string.
 */
export const exportDatabase = async (): Promise<string> => {
  const sessions = await getAllSessions();
  return JSON.stringify(sessions, null, 2);
};

/**
 * Imports a JSON string into the database, merging with existing data.
 */
export const importDatabase = async (jsonString: string): Promise<void> => {
  try {
    const sessions = JSON.parse(jsonString);
    if (!Array.isArray(sessions)) throw new Error("Invalid backup file format");

    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      sessions.forEach((s: any) => {
        // Rehydrate Dates from JSON strings
        const session = { ...s };
        session.lastModified = new Date(session.lastModified);
        
        if (session.chatHistory) {
            session.chatHistory = session.chatHistory.map((c: any) => ({
                ...c,
                timestamp: new Date(c.timestamp)
            }));
        }
        
        if (session.webFinancials) {
            session.webFinancials.lastUpdated = new Date(session.webFinancials.lastUpdated);
        }
        
        store.put(session);
      });
    });
  } catch (e) {
    console.error("Import failed", e);
    throw e;
  }
};