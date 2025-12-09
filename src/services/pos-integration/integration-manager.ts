/**
 * @fileOverview Manages different POS system adapters.
 * This file acts as a factory for creating POS adapter instances.
 */

import type {
  IPosSystemAdapter,
  PosConnectionConfig,
  PosSystemDefinition,
} from "./pos-adapter.interface";

import { CaspitAdapter } from "./caspit";
import { HashavshevetAdapter } from "./hashavshevet";

/**
 * Creates and returns an instance of a POS adapter for a specific system.
 * This is the central "factory" for getting a configured adapter.
 * @param systemId The ID of the POS system (e.g., 'caspit').
 * @param credentials The connection configuration for that user.
 * @returns An instance of the requested adapter, configured and ready to use.
 * @throws If the systemId is not supported.
 */
export function getPosAdapter(
  systemId: string,
  credentials: PosConnectionConfig
): IPosSystemAdapter {
  switch (systemId) {
    case "caspit":
      return new CaspitAdapter(credentials);
    case "hashavshevet":
      return new HashavshevetAdapter();
    default:
      throw new Error(`POS adapter not found for system: ${systemId}`);
  }
}

/**
 * Gets the list of available POS systems for configuration.
 * @returns An array of objects containing systemId and systemName.
 */
export function getAvailablePosSystems(): {
  systemId: string;
  systemName: string;
}[] {
  // As we no longer create instances here, we provide a static list.
  const availableSystems: PosSystemDefinition[] = [
    {
      id: "caspit",
      name: "Caspit",
      configFields: [
        // Add your config fields here
      ],
    },
    {
      id: "hashavshevet",
      name: "Hashavshevet",
      configFields: [
        // Add your config fields here
      ],
    },
  ];
  return availableSystems.map((system) => ({
    systemId: system.id,
    systemName: system.name,
  }));
}

// NOTE: Functions like `testPosConnection` were removed from here.
// The manager's only job is to CREATE adapters.
// The calling code (in `/actions`) is now responsible for creating an adapter
// and then calling the `.testConnection()` method on the instance it receives.
