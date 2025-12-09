// src/actions/pos-actions.ts
"use server";

import type {
  PosConnectionConfig,
  SyncResult,
} from "@/services/pos-integration/pos-adapter.interface";
import type { Invoice, Product, Supplier } from "@/services/types";
import {
  getPosAdapter,
  getAvailablePosSystems as getSystems,
} from "@/services/pos-integration/integration-manager";
import {
  finalizeSaveProductsService,
  updateInvoicePaymentStatusService,
} from "@/services/backend";

// --- Server Action to Test Connection ---
export async function testConnectionAction(
  config: PosConnectionConfig
): Promise<{ success: boolean; message: string }> {
  try {
    if (!config.systemId) {
      throw new Error("POS system ID is missing from the configuration.");
    }
    const adapter = getPosAdapter(config.systemId, config);
    return await adapter.testConnection();
  } catch (error: any) {
    console.error(`[Action] Error in testConnectionAction:`, error);
    return { success: false, message: error.message || "Unknown error" };
  }
}

// --- Server Action to Create or Update a Product ---
export async function upsertPosProductAction(
  config: PosConnectionConfig,
  appProduct: Partial<Product> & { userId: string }
): Promise<{
  success: boolean;
  message: string;
  externalId?: string | null;
}> {
  try {
    if (!config.systemId) {
      throw new Error("POS system ID is missing from the configuration.");
    }
    const adapter = getPosAdapter(config.systemId, config);
    if (!adapter.upsertProduct) {
      throw new Error(
        `The '${adapter.systemName}' adapter does not support creating or updating products.`
      );
    }
    const result = await adapter.upsertProduct(appProduct);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[upsertPosProductAction] Error upserting product:`, error);
    return { success: false, message, externalId: null };
  }
}

// --- Server Action to Deactivate a Product ---
export async function deactivatePosProductAction(
  config: PosConnectionConfig,
  appProduct: Product
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!config.systemId) {
      throw new Error("POS system ID is missing from the configuration.");
    }
    const adapter = getPosAdapter(config.systemId, config);
    if (!adapter.upsertProduct) {
      throw new Error(
        `The '${adapter.systemName}' adapter does not support deactivating products.`
      );
    }
    // Deactivation is an update with isActive set to false
    const productToDeactivate = { ...appProduct, isActive: false };
    const result = await adapter.upsertProduct(productToDeactivate);
    return {
      success: result.success,
      message: result.message,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POS Action - deactivateProduct]", error);
    return {
      success: false,
      message:
        message || "An unknown error occurred while deactivating the product.",
    };
  }
}

// --- Server Action to Sync Products (Fetch from POS) ---
export async function syncPosProductsAction(
  config: PosConnectionConfig
): Promise<SyncResult> {
  if (!config.systemId) {
    throw new Error("POS system ID is missing from the configuration.");
  }
  const adapter = getPosAdapter(config.systemId, config);
  return adapter.syncProducts(config);
}

// --- Server Action to Create a Document/Expense ---
export async function createPosExpenseAction(
  config: PosConnectionConfig,
  document: Invoice
): Promise<{
  success: boolean;
  message: string;
  externalId?: string;
}> {
  try {
    if (!config.systemId) {
      throw new Error("POS system ID is missing from the configuration.");
    }
    const adapter = getPosAdapter(config.systemId, config);
    if (!adapter.createTaxInvoice) {
      throw new Error(
        `The '${adapter.systemName}' adapter does not support creating expenses.`
      );
    }
    // The adapter's 'createTaxInvoice' method handles both supplier and expense creation.
    const result = await adapter.createTaxInvoice(document);
    return {
      success: true,
      message: `Expense created successfully in ${adapter.systemName}.`,
      externalId: result.externalId,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[POS Action] Error syncing expense for document ${document.id}:`,
      error
    );
    return {
      success: false,
      message: message,
    };
  }
}

// --- Server Action to Create or Update a Supplier ---
export async function upsertPosSupplierAction(
  config: PosConnectionConfig,
  supplier: Supplier
): Promise<{
  success: boolean;
  message: string;
  externalId?: string | null;
}> {
  try {
    if (!config.systemId) {
      throw new Error("POS system ID is missing from the configuration.");
    }
    console.log(
      "[upsertPosSupplierAction] Received supplier object for POS sync:",
      JSON.stringify(supplier, null, 2)
    );
    const adapter = getPosAdapter(config.systemId, config);
    if (!adapter.upsertSupplier) {
      throw new Error(
        `The '${adapter.systemName}' adapter does not support creating or updating suppliers.`
      );
    }
    const result = await adapter.upsertSupplier(supplier);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[upsertPosSupplierAction] Error upserting supplier:`, error);
    return { success: false, message, externalId: null };
  }
}

/**
 * Initiates a sales data sync from the specified POS system.
 * It retrieves an adapter for the given system and calls its syncSales method.
 *
 * @param {PosConnectionConfig} config - The configuration required to connect to the POS system.
 * @returns {Promise<SyncResult>} A promise that resolves with the result of the sync operation.
 */
export async function syncPosSalesAction(
  config: PosConnectionConfig
): Promise<SyncResult> {
  if (!config.systemId) {
    throw new Error("POS system ID is missing from the configuration.");
  }
  const adapter = getPosAdapter(config.systemId, config);
  return adapter.syncSales(config);
}

/**
 * Retrieves the list of available POS systems that can be configured.
 * This is a server action that safely wraps a server-only function.
 */
export async function getAvailablePosSystemsAction() {
  try {
    const systems = getSystems();
    return { success: true, systems };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      "[getAvailablePosSystemsAction] Failed to get available POS systems:",
      error
    );
    return { success: false, error: message, systems: [] };
  }
}

export async function saveSyncedProductsAction(
  data: {
    products: Partial<Product>[];
    originalFileName: string;
    docType: "deliveryNote" | "invoice" | "invoiceReceipt" | "receipt";
    existingDocumentId: string | null;
    invoiceNumber: string | null;
    supplierName: string | null;
    totalAmount: number | null;
    paymentDueDate: Date | string | null;
    invoiceDate: Date | string | null;
    paymentMethod: string | null;
    originalImagePreviewUri: string | null;
    compressedImageForFinalRecordUri: string | null;
    rawScanResultJson: string | null;
    paymentTerms: string | null;
    osekMorshe: string | null;
  },
  userId: string
): Promise<{
  finalInvoiceRecord: Invoice;
  savedOrUpdatedProducts: Product[];
}> {
  return finalizeSaveProductsService({ ...data, userId });
}

export async function linkReceiptToInvoiceAction(data: {
  invoiceId: string;
  userId: string;
  receiptDataUri: string;
  receiptFileName: string; // This might be useful for creating a file name if needed later
}): Promise<{ success: boolean; message: string }> {
  const { invoiceId, userId, receiptDataUri } = data;
  try {
    if (!invoiceId || !userId || !receiptDataUri) {
      throw new Error("Missing required data to link receipt.");
    }

    // Call the service to update the invoice status and add the receipt image
    await updateInvoicePaymentStatusService(
      invoiceId,
      "paid", // Set status to 'paid'
      userId,
      receiptDataUri // Pass the image URI
    );

    return { success: true, message: "Receipt linked successfully." };
  } catch (error: any) {
    console.error(`[Action] Error in linkReceiptToInvoiceAction:`, error);
    return {
      success: false,
      message: error.message || "Failed to link receipt.",
    };
  }
}
