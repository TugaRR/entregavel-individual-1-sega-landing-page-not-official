import type { Firestore } from "firebase/firestore";

/**
 * Browser-only Firebase setup. Web config values are public identifiers
 * (security comes from Firestore rules) but are kept in env vars, not code.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const REQUIRED: Array<[keyof typeof config, string]> = [
  ["apiKey", "VITE_FIREBASE_API_KEY"],
  ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "VITE_FIREBASE_PROJECT_ID"],
  ["appId", "VITE_FIREBASE_APP_ID"],
];

export function missingFirebaseConfig(): string[] {
  return REQUIRED.filter(([k]) => !config[k]).map(([, name]) => name);
}

let dbPromise: Promise<Firestore> | null = null;

export function getDb(): Promise<Firestore> {
  const missing = missingFirebaseConfig();
  if (missing.length) {
    return Promise.reject(
      new Error(`Firebase is not configured. Missing: ${missing.join(", ")}`),
    );
  }
  dbPromise ??= (async () => {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getFirestore } = await import("firebase/firestore");
    const app = getApps()[0] ?? initializeApp(config);
    return getFirestore(app);
  })();
  return dbPromise;
}
