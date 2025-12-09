/**
 * @fileoverview Defines TypeScript types for all Caspit API interactions.
 * These types are based on official documentation, inferred models, and existing code.
 */

/**
 * A generic wrapper for paginated API responses from Caspit.
 */
export interface CaspitResponse<T> {
  CurrentPage: number;
  TotalCount: number;
  TotalPages: number;
  PrevPageUrl: string | null;
  NextPageUrl: string | null;
  Results: T[];
}

/**
 * Represents a contact (specifically a supplier) in Caspit.
 * Aligned with the model for POST /api/v1/Contacts.
 */
export interface CaspitContact {
  // --- Core Info ---
  ContactId?: string; // **Crucial for Idempotency**. External ID from our system.
  BusinessName: string; // The main business/company name.
  OsekMorshe: string; // **Required**. Tax ID.

  // --- Contact Person & Details ---
  Name?: string; // **Changed**: This is now for the contact person.
  ContactPerson?: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Website?: string;

  // --- Address ---
  Address?: string; // Main address line
  City?: string;
  PostalCode?: string; // Corresponds to 'Zip'
  Country?: string;
}

/**
 * The payload for creating or updating a Product in Caspit.
 * Based on the model for POST/PUT /api/v1/Products.
 */
export interface CaspitProductPayload {
  ProductId?: string | null;
  Name: string;
  Description?: string | null;
  CatalogNumber?: string | null;
  PurchasePrice?: number | null;
  SalePrice1?: number | null;
  QtyInStock?: number | null;
  Barcode?: string | null;
  Status?: boolean | null; // e.g., true for active, false for inactive
}

/**
 * The payload required to create a new expense document.
 * Based on the inferred model for POST /api/v1/Expenses.
 */
export interface CaspitExpensePayload {
  ExpenseId: string; // **Crucial for Idempotency**.
  ContactId: string; // **The Link**. The ContactId of the supplier.
  BusinessName: string; // The main business/company name.
  Date: string; // ISO 8601 format (YYYY-MM-DD).
  Reference?: string; // The supplier's original invoice number.
  Description?: string;

  // --- Financials ---
  Amount: number; // Total amount including VAT.
  VatRate: number; // VAT percentage (e.g., 17.0).

  // --- Classification & Control ---
  TrxCodeNumber?: number; // Accounting classification code.
  Flag?: number; // For custom logic (e.g., 0 for standard).
  AllocationNumber?: string; // Tax authority allocation number.

  // --- Attachment ---
  ImageFile?: string; // Base64 encoded string.
  ImageFileName?: string; // Original filename.
}

/**
 * Represents a full Caspit Expense object as returned by the API.
 */
export interface CaspitExpense extends CaspitExpensePayload {
  Status?: number; // 0 = Temporary, 2 = Permanent.
  DateCreated?: string;
  LinkToPdf?: string;
  ViewUrl?: string;
  Payments?: CaspitExpensePayment[];
}

/**
 * Represents a single payment applied to a Caspit Expense document.
 */
export interface CaspitExpensePayment {
  ExpensePaymentId?: number;
  Date: string; // YYYY-MM-DD format
  Amount: number;
  PaymentType: number; // e.g., 1 for Credit Card, 3 for Cash
  Reference?: string;
}

/**
 * Defines the specific credentials required to connect to the Caspit API.
 * The names align with the parameters used in the token request.
 */
export interface CaspitCredentials {
  user?: string;
  pwd?: string;
  osekMorshe?: string;
}
