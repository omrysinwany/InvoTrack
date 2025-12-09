import type { Timestamp, FieldValue } from "firebase/firestore";
import type { PosConnectionConfig } from "./pos-integration/pos-adapter.interface";

// Note: For client-facing types, date fields that are Timestamps in Firestore
// should be represented as `string` (e.g., ISO string) because server actions
// will serialize them before sending to the client. The `FieldValue` type
// should only be used in server-side update/create operations, not in shared types.

export interface User {
  id: string;
  username?: string | null;
  email?: string | null;
  createdAt?: Timestamp | FieldValue;
  lastLoginAt?: Timestamp | FieldValue;
}

/**
 * A generic reference to an entity in an external Point of Sale system.
 * This allows any core object (Supplier, Product, etc.) to be linked
 * to one or more external systems without polluting its own structure.
 */
export interface PosIntegrationRef {
  systemId: string; // e.g., 'caspit', 'hashavshevet'
  externalId: string; // The ID of the entity in that external system
  lastSync?: string; // ISO date string of the last successful sync
}

/**
 * Represents a Product in our application's "pure" internal model.
 */
export interface Product {
  id: string; // Our internal Firestore ID
  userId: string;
  name: string;
  shortName?: string;
  description?: string;
  catalogNumber?: string;
  barcode?: string | null;
  unitPrice: number;
  salePrice?: number | null;
  quantity: number;
  lineTotal?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  imageUrl?: string;
  isActive?: boolean;

  // An object to store links to external systems, keyed by systemId for easy lookup.
  posRefs?: { [systemId: string]: PosIntegrationRef };
}

export interface EditableProduct extends Product {
  _originalId?: string;
}

/**
 * Represents a Supplier in our application's "pure" internal model.
 */
export interface Supplier {
  id?: string; // Our internal Firestore ID
  userId: string;
  name: string;
  osekMorshe?: string | null; // The supplier's official business/tax number (e.g., Osek Morshe)
  email?: string;
  phone?: string;
  mobile?: string;
  contactPersonName?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  paymentTerms?: string;
  bankDetails?: {
    bankId: string;
    branch: string;
    accountNumber: string;
  };
  invoiceComment?: string;
  totalSpent?: number;
  invoiceCount?: number;
  createdAt?: string | Timestamp | FieldValue;
  lastActivityDate?: string | Timestamp | FieldValue | null;
  // An object to store links to external systems.
  posRefs?: { [systemId: string]: PosIntegrationRef };
}

/**
 * Represents an Invoice in our application's "pure" internal model.
 */
export interface Invoice {
  id: string; // Our internal Firestore ID
  userId: string;
  originalFileName: string;
  generatedFileName: string;
  fileType: string;
  fileSize: number;
  imageUri: string | null;
  compressedImageUri: string | null;
  uploadTime: Timestamp;

  supplierId: string; // A reference to our internal Supplier ID
  supplierName: string;
  invoiceNumber: string | null; // The number on the supplier's document
  osekMorshe?: string | null; // The supplier's official business/tax number (e.g., Osek Morshe)
  date: string | Timestamp | FieldValue | null; // The date on the document, in YYYY-MM-DD format
  dueDate?: string | Timestamp | FieldValue | null; // The date the payment is due
  totalAmount: number;
  paymentMethod?: string | null;
  paymentTerms?: string | null;
  originalImagePreviewUri: string | null;
  compressedImageForFinalRecordUri: string | null;

  linkedInvoiceId?: string | null; // אם זו קבלה, למי היא שייכת?
  linkedDeliveryNoteIds?: string[]; // אם זו חשבונית, אילו תעודות היא סוגרת?
  linkedToInvoiceId?: string | null; // אם זו תעודת משלוח, לאיזו חשבונית קושרה?

  rawScanResultJson?: string | null;

  status: "pending" | "processing" | "completed" | "error" | "archived";
  paymentStatus:
    | "paid"
    | "unpaid"
    | "pending_payment"
    | "partially_paid"
    | "linked";
  documentType: "deliveryNote" | "invoice" | "invoiceReceipt" | "receipt";
  isArchived?: boolean;

  // A direct link to the single POS system this invoice was synced to.
  // An invoice, unlike a product, is usually a one-time transaction to one system.
  syncedPos?: PosIntegrationRef | null;
  errorMessage?: string | null;
  paymentReceiptImageUri?: string | null;

  // Products/line items associated with this invoice
  products?: Product[];
  taxAmount: number | null;
  subtotalAmount: number | null;
}

export interface AccountantSettings {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface KpiPreferences {
  visibleKpiIds: string[];
  kpiOrder: string[];
}

export interface QuickActionPreferences {
  visibleQuickActionIds: string[];
  quickActionOrder: string[];
}

export interface UserSettings {
  userId: string;
  reminderDaysBefore?: number | null;
  posSystemId?: string | null;
  posConfig?: PosConnectionConfig | null;
  accountantSettings?: AccountantSettings | null;
  monthlyBudget?: number | null;
  kpiPreferences?: KpiPreferences | null;
  quickActionPreferences?: QuickActionPreferences | null;
}

export interface OtherExpense {
  id: string;
  userId: string;
  description: string;
  amount: number;
  date: string | Timestamp;
  categoryId?: string | null;
  paymentDate?: string | Timestamp;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  userId: string;
}

export interface ProductPriceDiscrepancy extends Product {
  existingUnitPrice: number;
  newUnitPrice: number;
}

export interface PriceCheckResult {
  productsToSaveDirectly: Product[];
  priceDiscrepancies: ProductPriceDiscrepancy[];
}

export type DueDateOption =
  | "immediate"
  | "net30"
  | "net60"
  | "net90"
  | "eom"
  | "custom";

export type DialogFlowStep =
  | "idle"
  | "processing"
  | "supplier_payment_details"
  | "new_product_details"
  | "prompt_link_invoice"
  | "prompt_link_delivery_notes"
  | "ready_to_save"
  | "error_loading";

export interface ProductInputState {
  barcode: string;
  salePrice?: number;
  salePriceMethod: "manual" | "percentage";
  profitPercentage: string;
}

// Type for creating a new supplier
export interface SupplierDataForCreation {
  name: string;
  osekMorshe?: string | null;
  email?: string;
  phone?: string;
  mobile?: string;
  contactPersonName?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  paymentTerms?: string;
  bankDetails?: {
    bankId: string;
    branch: string;
    accountNumber: string;
  };
  invoiceComment?: string;
}

// Type alias for invoice history (used in reports and exports)
export type InvoiceHistoryItem = Invoice;

// Type alias for POS config (used in settings)
export type PosConfig = PosConnectionConfig;
