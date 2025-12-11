import * as admin from "firebase-admin";

const hasBeenInitialized = admin.apps.length > 0;

if (!hasBeenInitialized) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. " +
        "Please add it to your .env.local file and Vercel environment variables."
      );
    }

    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    console.log(
      `Firebase Admin SDK initialized successfully. Project ID: ${serviceAccount.project_id}`
    );
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization error:", {
      message: error.message,
      hasServiceAccountKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      serviceAccountKeyLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
    });
    // Re-throw the error so the app knows initialization failed
    throw error;
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminSDK = admin;

// Helper function to get Firebase Admin instances
export async function getFirebaseAdmin() {
  return {
    db: adminDb,
    auth: adminAuth,
    admin: adminSDK,
  };
}