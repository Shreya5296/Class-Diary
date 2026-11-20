/**
 * profileImageStorage.ts
 * Browser-local IndexedDB persistence for user profile avatars.
 * Does not transmit data to backend or Google Apps Script.
 * Preserves avatar across sessions on this browser device.
 */

const DB_NAME = 'smd_user_profile_db';
const DB_VERSION = 1;
const STORE_NAME = 'profile_images';
const AVATAR_KEY = 'user_avatar';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

let memoryFallback: string | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function getStoredProfileImage(): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AVATAR_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(memoryFallback);
    });
  } catch {
    return memoryFallback;
  }
}

export async function saveStoredProfileImage(dataUrl: string): Promise<void> {
  memoryFallback = dataUrl;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, AVATAR_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to save image in IndexedDB'));
    });
  } catch {
    // Stored in memory fallback
  }
}

export async function deleteStoredProfileImage(): Promise<void> {
  memoryFallback = null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(AVATAR_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to delete image from IndexedDB'));
    });
  } catch {
    // Memory fallback cleared
  }
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'Please select a valid image file (PNG, JPG, or WebP).' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { valid: false, error: 'File size exceeds 5 MB limit. Please choose a smaller image.' };
  }
  return { valid: true };
}
