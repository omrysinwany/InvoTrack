/**
 * @fileOverview Implementation for the Hashavshevet POS/ERP system adapter.
 * Leverages server actions for API communication.
 */

import type {
  IPosSystemAdapter,
  PosConnectionConfig,
  SyncResult,
} from "../pos-adapter.interface";
import type { Product, Supplier } from "../../types";
import {
  syncPosProductsAction,
  syncPosSalesAction,
} from "@/actions/pos-actions";

export class HashavshevetAdapter implements IPosSystemAdapter {
  public readonly systemId = "hashavshevet";
  readonly systemName = "Hashavshevet (חשבשבת)";

  // --- Connection Test ---
  async testConnection(): Promise<{ success: boolean; message: string }> {
    // Placeholder implementation
    return Promise.resolve({ success: true, message: "Connection successful" });
  }

  // --- Product Sync ---
  async syncProducts(config: PosConnectionConfig): Promise<SyncResult> {
    console.log(
      `[HashavshevetAdapter] Starting product sync via server action...`
    );
    try {
      const result = await syncPosProductsAction(config);
      console.log(
        `[HashavshevetAdapter] Product sync result from server action:`,
        result
      );
      return result;
    } catch (error: any) {
      console.error(
        "[HashavshevetAdapter] Error calling product sync server action:",
        error
      );
      return {
        success: false,
        message: `Product sync failed: ${error.message || "Unknown error"}`,
      };
    }
  }

  // --- Sales Sync ---
  async syncSales(config: PosConnectionConfig): Promise<SyncResult> {
    console.log(
      `[HashavshevetAdapter] Starting sales sync via server action...`
    );
    try {
      const result = await syncPosSalesAction(config);
      console.log(
        `[HashavshevetAdapter] Sales sync result from server action:`,
        result
      );
      return result;
    } catch (error: any) {
      console.error(
        "[HashavshevetAdapter] Error calling sales sync server action:",
        error
      );
      return {
        success: false,
        message: `Sales sync failed: ${error.message || "Unknown error"}`,
      };
    }
  }

  // --- Suppliers Sync ---
  async syncSuppliers(config: PosConnectionConfig): Promise<SyncResult> {
    console.log(
      `[HashavshevetAdapter] Starting suppliers sync via server action...`
    );
    try {
      const result = await syncPosProductsAction(config);
      console.log(
        `[HashavshevetAdapter] Suppliers sync result from server action:`,
        result
      );
      return result;
    } catch (error: any) {
      console.error(
        "[HashavshevetAdapter] Error calling suppliers sync server action:",
        error
      );
      return {
        success: false,
        message: `Suppliers sync failed: ${error.message || "Unknown error"}`,
      };
    }
  }

  // --- Documents Sync ---
  async syncDocuments(config: PosConnectionConfig): Promise<SyncResult> {
    console.log(
      `[HashavshevetAdapter] Starting documents sync via server action...`
    );
    try {
      const result = await syncPosProductsAction(config);
      console.log(
        `[HashavshevetAdapter] Documents sync result from server action:`,
        result
      );
      return result;
    } catch (error: any) {
      console.error(
        "[HashavshevetAdapter] Error calling documents sync server action:",
        error
      );
      return {
        success: false,
        message: `Documents sync failed: ${error.message || "Unknown error"}`,
      };
    }
  }

  // Method is required by the interface but not yet implemented for Hashavshevet
  async upsertProduct(product: Product): Promise<{
    success: boolean;
    message: string;
    externalId?: string | null;
  }> {
    throw new Error("Method 'upsertProduct' not implemented for Hashavshevet.");
  }

  // Method is required by the interface but not yet implemented for Hashavshevet
  async upsertSupplier(supplier: Supplier): Promise<{
    success: boolean;
    message: string;
    externalId?: string | null;
  }> {
    throw new Error(
      "Method 'upsertSupplier' not implemented for Hashavshevet."
    );
  }
}
