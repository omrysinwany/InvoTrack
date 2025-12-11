// src/lib/firebase.ts
import {
  initializeApp,
  getApps,
  getApp,
  FirebaseApp,
  FirebaseOptions,
} from "firebase/app";
// Use Firestore Lite for Vercel compatibility (no offline persistence)
import {
  getFirestore,
  Firestore,
} from "firebase/firestore/lite";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let functions: Functions;

// Check if the app is already initialized
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully via firebase.ts.");
  } catch (error) {
    console.error("Error initializing Firebase app:", error);
    // In a server environment, this might throw. We can try to get the existing app.
    if (getApps().length) {
      app = getApp();
    } else {
      // Re-throw the error if initialization truly fails
      throw error;
    }
  }
} else {
  app = getApp();
  console.log("Firebase app already initialized. Getting instance.");
}

const auth = getAuth(app);

// Initialize Firestore Lite - works on Vercel without offline persistence
const db: Firestore = getFirestore(app);
console.log("Firestore Lite initialized successfully for Vercel.");

const storage = getStorage(app);

// It's better to specify the region for functions if you know it
try {
  functions = getFunctions(app, "europe-west1"); // Example region, change if needed
} catch (error) {
  console.warn(
    "Could not initialize Firebase Functions (this may be expected on the client-side).",
    error
  );
  // Assign a dummy or null object if functions are not critical on the client
  functions = {} as Functions;
}

export { app, auth, db, storage, functions };
export { GoogleAuthProvider };
