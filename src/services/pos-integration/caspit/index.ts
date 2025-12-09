/**
 * @fileOverview Implementation for the Caspit POS system adapter.
 * This adapter is responsible for all direct communication with the Caspit API.
 */

import {
  IPosSystemAdapter,
  PosConnectionConfig,
  Product as AppProduct,
  SyncResult,
} from "../pos-adapter.interface";
import {
  Invoice,
  Product as AppProductType,
  Supplier,
} from "../../../services/types";
import {
  CaspitContact,
  CaspitExpense,
  CaspitExpensePayload,
  CaspitResponse,
  CaspitProductPayload,
  CaspitCredentials,
} from "./types";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

const getFormattedDate = (): string => new Date().toISOString().split("T")[0];

// פונקציית עזר מרכזית לגישה לנתיב הנכון של הספקים ב-Firestore
const getUserSupplierDocRef = (userId: string, supplierId: string) => {
  if (!userId || !supplierId) {
    throw new Error(
      "User ID and Supplier ID are required to get a supplier reference."
    );
  }
  return adminDb
    .collection("users")
    .doc(userId)
    .collection("suppliers")
    .doc(supplierId);
};

export class CaspitAdapter implements IPosSystemAdapter {
  readonly systemId = "caspit";
  readonly systemName = "Caspit (כספית)";
  private apiEndpoint = "https://app.caspit.biz/api/v1";
  private token: string | null = null;
  private credentials: CaspitCredentials;

  constructor(config: PosConnectionConfig) {
    if (
      config.systemId !== "caspit" ||
      !config.credentials?.user ||
      !config.credentials.pwd ||
      !config.credentials.osekMorshe
    ) {
      throw new Error(
        "Caspit credentials are not complete or configuration is invalid."
      );
    }
    this.credentials = config.credentials as CaspitCredentials;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.token) return;
    try {
      const response = await fetch(`${this.apiEndpoint}/Token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          UserName: this.credentials.user,
          Password: this.credentials.pwd,
          OsekMorsheNumber: this.credentials.osekMorshe,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Caspit authentication failed: ${response.statusText} | ${errorText}`
        );
      }
      this.token = await response.json();
    } catch (error) {
      console.error("Error during Caspit authentication:", error);
      throw error;
    }
  }

  private getHeaders(): HeadersInit {
    if (!this.token) throw new Error("Authentication token is not available.");
    return { "Content-Type": "application/json", "Caspit-Token": this.token };
  }

  // <<< מתוקן! משתמש ב-BusinessName לפי התיעוד הרשמי
  private async _upsertCaspitContact(supplier: Supplier): Promise<string> {
    await this.ensureAuthenticated();
    if (!supplier.name || supplier.name.trim() === "")
      throw new Error("Supplier name is empty.");
    if (!supplier.osekMorshe)
      throw new Error(`Supplier ${supplier.name} is missing a Tax ID.`);

    const payload: any = {
      ContactId: supplier.id,
      BusinessName: supplier.name, // <<< השדה הנכון לפי התיעוד
      Name: supplier.contactPersonName || supplier.name,
      OsekMorshe: supplier.osekMorshe,
      ContactPerson: supplier.contactPersonName,
      Email: supplier.email,
      Phone: supplier.phone,
    };

    const response = await fetch(`${this.apiEndpoint}/Contacts`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        `Failed to upsert Caspit contact. Status: ${response.status}, Response: ${responseText}`
      );
    }

    const result = JSON.parse(responseText);
    const returnedId = result.Id || result.ContactId;
    if (!returnedId)
      throw new Error(
        "Caspit did not return a ContactId after upserting supplier."
      );

    return returnedId;
  }

  // <<< מתוקן! משתמש בנתיב הנכון לעדכון ה-posRefs
  private async _ensureSupplierExists(
    supplier: Supplier,
    userId: string
  ): Promise<string> {
    const existingCaspitId = supplier.posRefs?.caspit?.externalId;
    if (existingCaspitId) return existingCaspitId;

    const caspitContactId = await this._upsertCaspitContact(supplier);

    if (!supplier.id) {
      throw new Error(
        "Cannot update supplier POS reference: The supplier is missing an internal ID."
      );
    }
    const supplierDocRef = getUserSupplierDocRef(userId, supplier.id);
    await supplierDocRef.update({
      "posRefs.caspit": {
        systemId: "caspit",
        externalId: caspitContactId,
        lastSync: new Date().toISOString(),
      },
    });

    return caspitContactId;
  }

  // <<< מתוקן! הפונקציה המרכזית עם כל התיקונים
  async createTaxInvoice(invoice: Invoice): Promise<{ externalId: string }> {
    if (!invoice.userId)
      throw new Error("User ID is missing on the invoice object.");

    const supplierDocRef = getUserSupplierDocRef(
      invoice.userId,
      invoice.supplierId
    );
    const supplierSnap = await supplierDocRef.get();
    if (!supplierSnap.exists) {
      throw new Error(
        `Supplier with ID ${invoice.supplierId} not found in our database.`
      );
    }
    const supplier: Supplier = {
      id: supplierSnap.id,
      ...supplierSnap.data(),
    } as Supplier;

    const caspitContactId = await this._ensureSupplierExists(
      supplier,
      invoice.userId
    );

    // --- Start: לוגיקה פיננסית מהקוד הישן והעובד ---
    const totalAmount = invoice.totalAmount || 0;
    // הנחה של 17% מע"מ, ניתן להפוך את זה להגדרה בעתיד
    const VAT_RATE = 18.0;
    const totalNoVat = totalAmount / (1 + VAT_RATE / 100);
    const vatAmount = totalAmount - totalNoVat;
    // --- End: לוגיקה פיננסית ---

    const caspitExpensePayload: any = {
      // ExpenseId -> הוסר.
      Date:
        typeof invoice.date === "string"
          ? invoice.date.split("T")[0]
          : getFormattedDate(),

      // <<< שינוי קריטי: נשתמש ב-SupplierId כפי שהיה בקוד הישן >>>
      SupplierId: caspitContactId,

      Reference: invoice.invoiceNumber || "",
      Details: `Invoice from ${
        supplier.name
      }. Scanned via InvoTrack on ${getFormattedDate()}.`,

      // <<< שינוי קריטי: שליחת כל הנתונים הפיננסיים כמו בקוד הישן >>>
      Total: totalAmount,
      TotalNoVat: parseFloat(totalNoVat.toFixed(2)),
      Vat: parseFloat(vatAmount.toFixed(2)),
      VatRate: VAT_RATE,

      TrxCodeNumber: 3100,
      Flag: 0,
    };

    const result = await this.upsertDocument(caspitExpensePayload);
    return { externalId: result.ExpenseId || result.Id };
  }

  async upsertDocument(doc: CaspitExpensePayload): Promise<any> {
    await this.ensureAuthenticated();
    const response = await fetch(`${this.apiEndpoint}/Expenses`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(doc),
    });

    if (response.status !== 201 && response.status !== 200) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Failed to parse error response" }));
      console.error("Caspit upsert failed:", errorData);
      throw new Error(
        errorData.message || "Failed to upsert document in Caspit"
      );
    }
    return response.json();
  }

  // --- שאר הפונקציות בקובץ - ללא שינוי ---
  private _mapCaspitProductToAppProduct(caspitProduct: any): AppProduct | null {
    const externalId = caspitProduct.ProductId;
    const catalogNumber = caspitProduct.CatalogNumber || "";
    const description = caspitProduct.Name || caspitProduct.Description || "";
    if (!externalId && !catalogNumber && !description) return null;
    return {
      id: externalId,
      catalogNumber: catalogNumber || undefined,
      description: description,
      quantity: caspitProduct.QtyInStock ?? 0,
      unitPrice: caspitProduct.PurchasePrice ?? 0,
      salePrice: caspitProduct.SalePrice1 ?? undefined,
      lineTotal: 0,
    };
  }

  async getDocument(id: string): Promise<CaspitExpense> {
    await this.ensureAuthenticated();
    const response = await fetch(`${this.apiEndpoint}/Expenses/${id}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: `Failed to get document ${id}` }));
      throw new Error(
        errorData.message || `Failed to get document ${id} from Caspit`
      );
    }
    return response.json();
  }

  async upsertProduct(product: Partial<AppProductType>): Promise<{
    success: boolean;
    message: string;
    externalId?: string | null;
  }> {
    await this.ensureAuthenticated();
    const isUpdate = !!product.posRefs?.caspit?.externalId;
    const externalId = product.posRefs?.caspit?.externalId || product.id;
    if (!externalId)
      return {
        success: false,
        message: "Product must have an external or internal ID.",
      };

    const payload: CaspitProductPayload = {
      ProductId: externalId,
      Name: product.shortName || product.name || "Unnamed Product",
      Description: product.description,
      CatalogNumber: product.catalogNumber,
      PurchasePrice: product.unitPrice,
      SalePrice1: product.salePrice,
      QtyInStock: product.quantity,
      Barcode: product.barcode,
      Status: product.isActive ?? true,
    };

    try {
      const response = await fetch(`${this.apiEndpoint}/Products`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          `Caspit API request failed (${response.status}): ${responseText}`
        );
      }
      const responseData = JSON.parse(responseText);
      const returnedId =
        responseData?.ProductId || responseData?.Id || externalId;
      return {
        success: true,
        message: `Product ${isUpdate ? "updated" : "created"}.`,
        externalId: returnedId,
      };
    } catch (error: any) {
      console.error(`[CaspitAdapter - upsertProduct] Error: `, error);
      return {
        success: false,
        message: `Failed to upsert product in Caspit: ${error.message}`,
      };
    }
  }

  async upsertSupplier(supplier: Supplier): Promise<{
    success: boolean;
    message: string;
    externalId?: string | null;
  }> {
    await this.ensureAuthenticated();
    if (!supplier.osekMorshe)
      throw new Error(`Supplier ${supplier.name} is missing a Tax ID.`);

    const payload: any = {
      ContactId: supplier.posRefs?.caspit?.externalId || supplier.id,
      BusinessName: supplier.name,
      Name: supplier.contactPersonName,
      OsekMorshe: supplier.osekMorshe,
      ContactPerson: supplier.contactPersonName,
      Email: supplier.email,
      Phone: supplier.phone,
    };

    try {
      const response = await fetch(`${this.apiEndpoint}/Contacts`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to upsert Caspit contact. Response: ${errorText}`
        );
      }
      const result = await response.json();
      const returnedId = result.Id || result.ContactId;
      if (!returnedId) throw new Error("Caspit did not return a ContactId.");
      return {
        success: true,
        message: "Supplier synced successfully.",
        externalId: returnedId,
      };
    } catch (error: any) {
      console.error("[CaspitAdapter - upsertSupplier]", error);
      return { success: false, message: error.message || "Unknown error." };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureAuthenticated();
      return { success: true, message: "Caspit connection test successful." };
    } catch (error: any) {
      return {
        success: false,
        message: `Caspit connection test failed: ${error.message}`,
      };
    }
  }

  // Implement other interface methods as needed, returning a default or placeholder response
  async syncProducts(_config: PosConnectionConfig): Promise<SyncResult> {
    /* ... your existing implementation ... */ return {
      success: false,
      message: "Not implemented",
    };
  }
  async syncSales(_config: PosConnectionConfig): Promise<SyncResult> {
    return { success: false, message: "Not implemented" };
  }
  async syncSuppliers(_config: PosConnectionConfig): Promise<SyncResult> {
    return { success: false, message: "Not implemented" };
  }
  async syncDocuments(_config: PosConnectionConfig): Promise<SyncResult> {
    return { success: false, message: "Not implemented" };
  }
}
