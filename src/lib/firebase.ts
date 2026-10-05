import type { FirebaseOptions } from "firebase/app";
import type { Firestore } from "firebase/firestore";

/**
 * Browser-only Firebase setup. Web config values are public identifiers
 * (security comes from Firestore rules) but are kept in env vars, not code.
 */
const env = import.meta.env;
const config: FirebaseOptions = {
  apiKey: env["VITE_FIREBASE_API_KEY"],
  authDomain: env["VITE_FIREBASE_AUTH_DOMAIN"],
  projectId: env["VITE_FIREBASE_PROJECT_ID"],
  storageBucket: env["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: env["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  appId: env["VITE_FIREBASE_APP_ID"],
};

const REQUIRED: Array<[keyof FirebaseOptions, string]> = [
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
