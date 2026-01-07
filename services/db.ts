import { DealSession } from '../types';
import { DEFAULT_BENCHMARK_PROFILES } from '../constants';

const DB_NAME = 'CreditInsightDB';
const STORE_NAME = 'sessions';
const DB_VERSION = 2;
const API_URL = '/api/db';

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
 * Syncs the current IndexedDB state to the server file.
 */
const syncToServer = async (): Promise<void> => {
  try {
    const json = await exportDatabase();
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json
    });
  } catch (err) {
    // Ignore errors (e.g. if running in a build without the server middleware)
    console.warn("Failed to sync to server:", err);
  }
};

/**
 * Syncs from server file to IndexedDB.
 */
const syncFromServer = async (): Promise<void> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) return;
    const json = await response.text();
    if (json && json !== '[]') {
       // We use importDatabase to merge/overwrite local state with server state
       await importDatabase(json, false); // false = don't sync back to server to avoid loop
    }
  } catch (err) {
    console.warn("Failed to sync from server:", err);
  }
};

/**
 * Helper to migrate legacy session data structure to new schema
 */
const migrateSessionData = (session: any): DealSession => {
  const defaultProfileId = DEFAULT_BENCHMARK_PROFILES[0].id;
  
  // Migrate benchmarkResults from Array to Record if needed
  let migratedBenchmarks = session.benchmarkResults;
  if (Array.isArray(session.benchmarkResults)) {
    migratedBenchmarks = { [defaultProfileId]: session.benchmarkResults };
  } else if (!session.benchmarkResults) {
    migratedBenchmarks = {};
  }

  return {
    ...session,
    lastModified: new Date(session.lastModified),
    chatHistory: (session.chatHistory || []).map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    })),
    benchmarkResults: migratedBenchmarks
  };
};

/**
 * Get all deal sessions from the database.
 * Now attempts to fetch from server first to ensure freshness.
 */
export const getAllSessions = async (): Promise<DealSession[]> => {
  // Try to get latest from server first
  await syncFromServer();

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const sessions = request.result.map(migrateSessionData);
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
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(session);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  
  // Sync to server after local save
  await syncToServer();
};

/**
 * Delete a deal session by ID.
 */
export const deleteSessionById = async (id: string): Promise<void> => {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Sync to server after local delete
  await syncToServer();
};

/**
 * Exports the entire database to a JSON string.
 */
export const exportDatabase = async (): Promise<string> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
       const sessions = request.result.map(migrateSessionData);
       resolve(JSON.stringify(sessions, null, 2));
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Imports a JSON string into the database, merging with existing data.
 * @param jsonString The JSON content
 * @param shouldSyncToServer Whether to push this new state to server (default true)
 */
export const importDatabase = async (jsonString: string, shouldSyncToServer = true): Promise<void> => {
  try {
    const rawSessions = JSON.parse(jsonString);
    if (!Array.isArray(rawSessions)) throw new Error("Invalid backup file format");

    const db = await openDB();
    
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      rawSessions.forEach((s: any) => {
        const session = migrateSessionData(s);
        
        if (session.webFinancials) {
            session.webFinancials.lastUpdated = new Date(session.webFinancials.lastUpdated);
        }
        
        store.put(session);
      });
    });

    if (shouldSyncToServer) {
      await syncToServer();
    }
  } catch (e) {
    console.error("Import failed", e);
    throw e;
  }
};