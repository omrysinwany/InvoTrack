// This file is no longer needed as the settings services are now called directly from the client.
// You can safely delete this file.

"use server";

import {
  getUserSettingsService,
  saveUserSettingsService,
} from "@/services/backend";
import type { UserSettings } from "@/services/types";

export const getUserSettingsAction = async (
  userId: string
): Promise<UserSettings> => {
  return await getUserSettingsService(userId);
};

export const saveUserSettingsAction = async (
  settings: Partial<Omit<UserSettings, "userId">>,
  userId: string
): Promise<void> => {
  await saveUserSettingsService(settings, userId);
};
