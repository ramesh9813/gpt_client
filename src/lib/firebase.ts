import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingKeys.length === 0;

if (missingKeys.length) {
  console.warn(`Missing Firebase config values: ${missingKeys.join(", ")}. Google sign-in is disabled.`);
}

// Never throw at import time: without config (no .env) initializeApp would
// throw `auth/invalid-api-key` and blank the whole app because Login imports
// this module eagerly via App.tsx. Lazy-init only when actually needed.
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let provider: InstanceType<typeof GoogleAuthProvider> | null = null;

const ensureFirebase = (): {
  auth: ReturnType<typeof getAuth>;
  provider: InstanceType<typeof GoogleAuthProvider>;
} => {
  if (!isFirebaseConfigured) {
    throw new Error(
      `Google sign-in is not configured (missing: ${missingKeys.join(", ")}). ` +
        `Add VITE_FIREBASE_* vars to gpt_client/.env.`
    );
  }
  if (!app || !auth || !provider) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
  }
  return { auth, provider };
};

export const signInWithGoogle = async () => {
  const { auth: a, provider: p } = ensureFirebase();
  const result = await signInWithPopup(a, p);
  return result.user;
};
