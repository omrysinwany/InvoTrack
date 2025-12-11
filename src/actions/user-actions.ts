"use server";

import { adminDb, adminSDK } from "@/lib/firebase-admin";
import type { User } from "@/services/types";
import { USERS_COLLECTION } from "@/services/backend";

/**
 * Saves or updates a user document in Firestore using Firebase Admin SDK.
 * This runs on the server and works reliably on Vercel.
 */
export async function saveUserToFirestoreAction(userData: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): Promise<User> {
  try {
    // Check if Admin SDK is initialized
    if (!adminDb) {
      console.error("[saveUserToFirestoreAction] Admin DB not initialized");
      throw new Error("Firebase Admin DB not initialized");
    }

    const userRef = adminDb.collection(USERS_COLLECTION).doc(userData.uid);

    const data: any = {
      email: userData.email || undefined,
      username: userData.displayName || undefined,
      lastLoginAt: adminSDK.firestore.FieldValue.serverTimestamp(),
    };
    // Check if user document exists
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // New user - add createdAt timestamp
      data.createdAt = adminSDK.firestore.FieldValue.serverTimestamp();
    }

    // Save or update the user document
    await userRef.set(data, { merge: true });

    // Fetch the final document
    const finalUserDoc = await userRef.get();
    const finalData = finalUserDoc.data();

    // Convert Admin SDK timestamps to plain objects for Client Components
    const serializableData: any = {};
    if (finalData) {
      Object.keys(finalData).forEach((key) => {
        const value = finalData[key];
        // Convert Firestore Timestamps to ISO strings
        if (value && typeof value === 'object' && '_seconds' in value) {
          serializableData[key] = new Date(value._seconds * 1000).toISOString();
        } else {
          serializableData[key] = value;
        }
      });
    }

    return {
      id: finalUserDoc.id,
      ...serializableData,
    } as User;
  } catch (error: any) {
    console.error("[saveUserToFirestoreAction] Error saving user:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    // Re-throw with more context
    throw new Error(`Failed to save user to Firestore: ${error?.message || error}`);
  }
}
