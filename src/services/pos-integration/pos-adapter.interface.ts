/**
 * @fileOverview Defines the interface for Point of Sale (POS) system adapters.
 * This ensures a consistent structure for integrating different POS systems.
 */

import type {
  Invoice,
  Product as AppProductType,
  Supplier,
} from "@/services/types";
import type { CaspitCredentials } from "./caspit/types";
import type { HashavshevetCredentials } from "./hashavshevet/types";

/**
 * Represents the configuration settings required to connect to a specific POS system.
 * This is a "discriminated union" based on systemId, ensuring that the `credentials`
 * object matches the selected system.
 */
export interface PosConnectionConfig {
  systemId?: string;
  credentials?: {
    [key: string]: string | undefined;
  };
}

/**
 * Represents the result of a synchronization operation.
 */
export interface SyncResult {
  success: boolean;
  message: string;
  itemsSynced?: number;
  errors?: any[];
  products?: Product[]; // Optional: Include products fetched during sync
  data?: any; // Generic data payload
}

/**
 * Represents a product structure compatible with InvoTrack.
 * Adapters should map their native product format to this structure.
 */
export interface Product {
  id?: string;
  catalogNumber?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  salePrice?: number | null; // Allow null for salePrice
  lineTotal: number;
}

/**
 * Interface defining the common methods that any POS system adapter must implement.
 */
export interface IPosSystemAdapter {
  /**
   * A unique identifier for the POS system (e.g., 'caspit', 'retalix').
   */
  readonly systemId: string;

  /**
   * A user-friendly name for the POS system (e.g., 'Caspit', 'Retalix').
   */
  readonly systemName: string;

  /**
   * Tests the connection to the POS system using the credentials the adapter was initialized with.
   * @returns A promise that resolves to a simple success/fail object.
   */
  testConnection(): Promise<{ success: boolean; message: string }>;

  /**
   * Synchronizes product data from the POS system to InvoTrack.
   * (Or potentially two-way sync in the future).
   * This method should fetch data and return it, not save it directly.
   * @param config - The connection configuration.
   * @returns A promise resolving to a SyncResult object, potentially including the fetched products.
   */
  syncProducts(config: PosConnectionConfig): Promise<SyncResult>;

  /**
   * Synchronizes sales data from the POS system to InvoTrack.
   * This could involve creating corresponding records or updating inventory based on sales.
   * @param config - The connection configuration.
   * @returns A promise resolving to a SyncResult object.
   */
  syncSales(config: PosConnectionConfig): Promise<SyncResult>;

  /**
   * Synchronizes suppliers data from the POS system to InvoTrack.
   * @param config - The connection configuration.
   * @returns A promise resolving to a SyncResult object.
   */
  syncSuppliers(config: PosConnectionConfig): Promise<SyncResult>;

  /**
   * Synchronizes documents data from the POS system to InvoTrack.
   * @param config - The connection configuration.
   * @returns A promise resolving to a SyncResult object.
   */
  syncDocuments(config: PosConnectionConfig): Promise<SyncResult>;

  /**
   * Creates or updates a single product in the POS system.
   * @param appProduct - The product data from our application.
   * @returns An object containing the result of the operation and the external ID.
   */
  upsertProduct(
    appProduct: Partial<Product>
  ): Promise<{ success: boolean; message: string; externalId?: string | null }>;

  /**
   * Creates or updates a supplier in the POS system.
   * @param supplier The application's internal supplier object.
   * @returns An object containing the result of the operation and the external ID of the created/updated supplier.
   */
  upsertSupplier(
    supplier: Supplier
  ): Promise<{ success: boolean; message: string; externalId?: string | null }>;

  /**
   * Creates a tax invoice (or equivalent document) in the POS system from an app Invoice.
   * This method should handle the entire logic, including ensuring the supplier exists.
   * @param invoice The application's internal Invoice object.
   * @returns A promise resolving to an object containing the external ID of the created document.
   */
  createTaxInvoice?(invoice: Invoice): Promise<{ externalId: string }>;

  // Add other potential methods as needed:
  // syncCustomers?(config: PosConnectionConfig): Promise<SyncResult>;
  // getSettingsSchema?(): any; // Optional: Return a schema for required settings fields
}

export interface PosSystemDefinition {
  id: string;
  name: string;
  configFields: {
    key: string;
    labelKey: string;
    type: string;
    tooltipKey?: string;
  }[];
}
