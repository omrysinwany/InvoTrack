import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserSettings } from "./types";

const USERS_COLLECTION = "users";
const USER_SETTINGS_SUBCOLLECTION = "settings";

const getUserSettingsDocRef = (userId: string) => {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!userId) {
    throw new Error("User ID is required to access user settings.");
  }
  return doc(
    db,
    USERS_COLLECTION,
    userId,
    USER_SETTINGS_SUBCOLLECTION,
    "userProfile"
  );
};

export async function getUserSettingsService(
  userId: string
): Promise<UserSettings> {
  const settingsRef = getUserSettingsDocRef(userId);
  const docSnap = await getDoc(settingsRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserSettings;
  }
  return {} as UserSettings; // Return empty object if no settings found
}

export async function saveUserSettingsService(
  settings: Partial<Omit<UserSettings, "userId">>,
  userId: string
): Promise<void> {
  const settingsRef = getUserSettingsDocRef(userId);
  await setDoc(settingsRef, settings, { merge: true });
}
