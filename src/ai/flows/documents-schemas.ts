// src/ai/flows/documents-schemas.ts
// This file defines Zod schemas and their TypeScript types for document scanning.
// It does not need to be a server module itself, as it's imported by server modules (flows).
import { z } from "genkit";

// Input schema for the AI flow for documents
export const ScanDocumentInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "A photo of an invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  userId: z
    .string()
    .optional()
    .describe("The ID of the user performing the scan."),
});
export type ScanDocumentInput = z.infer<typeof ScanDocumentInputSchema>;

// Schema for the raw product data expected from the AI prompt
// All fields are optional because we can't guarantee the AI will find them.
export const ExtractedProductSchema = z.object({
  name: z.string().optional().describe("The name/description of the product."),
  shortName: z
    .string()
    .optional()
    .describe("A short, concise name for the product."),
  catalogNumber: z
    .string()
    .optional()
    .describe("The product's catalog number."),
  barcode: z
    .string()
    .optional()
    .describe(
      "The barcode (EAN/UPC) of the product. Do not guess or use other reference numbers like 'Asmachta' or 'אסמכתא'."
    ),
  referenceNumber: z
    .string()
    .optional()
    .describe(
      "An additional reference number for the line item, often labeled 'Asmachta', 'Asmachta 2', or 'Reference'."
    ),
  quantity: z
    .number()
    .optional()
    .describe("The quantity of the product (individual units)."),
  unitPrice: z
    .number()
    .optional()
    .describe("The extracted purchase price (unit price)."),
  totalPrice: z.number().optional().describe("The line total for the product."),
});

// Schema for the final, processed product data that the application will use.
// Here, some fields are made mandatory.
export const FinalProductSchema = z.object({
  name: z.string().describe("The name or description of the product."),
  shortName: z
    .string()
    .optional()
    .describe("A short, concise name for the product."),
  catalogNumber: z
    .string()
    .optional()
    .describe("The product's catalog number (מק'ט), if available."),
  barcode: z
    .string()
    .optional()
    .describe(
      "The barcode (EAN/UPC) of the product. Do not guess or use other reference numbers like 'Asmachta' or 'אסמכתא'."
    ),
  referenceNumber: z
    .string()
    .optional()
    .describe(
      "An additional reference number for the line item, often labeled 'Asmachta', 'Asmachta 2', or 'Reference'."
    ),
  quantity: z.number().describe("The quantity of the product purchased."),
  unitPrice: z
    .number()
    .describe(
      "The calculated or provided unit price (purchase price) for a single unit of the product."
    ),
  totalPrice: z
    .number()
    .describe("The total price for this line item (quantity * unitPrice)."),
});
export type Product = z.infer<typeof FinalProductSchema>;

// Define the possible types of documents we can scan.
export const DocumentTypeSchema = z.enum([
  "invoice", // חשבונית
  "receipt", // קבלה
  "invoice_receipt", // חשבונית קבלה
  "delivery_note", // תעודת משלוח
  "credit_invoice", // חשבונית זיכוי
  "other", // מסמך אחר
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

// Schema for the raw output from the AI prompt (using camelCase and nested details)
export const DocumentPromptOutputSchema = z.object({
  documentType: DocumentTypeSchema.optional().describe(
    "The type of the document (e.g., 'invoice', 'receipt')."
  ),
  invoiceDetails: z
    .object({
      supplierName: z
        .string()
        .optional()
        .describe("The supplier's name identified on the document."),
      osekMorshe: z
        .string()
        .optional()
        .describe(
          "The supplier's tax identification number (Osek Morshe / ח.פ. / ע.מ.)."
        ),
      invoiceNumber: z
        .string()
        .optional()
        .describe("The invoice number found on the document."),
      totalAmount: z
        .number()
        .optional()
        .describe(
          "The final total amount stated on the invoice document. Extract ONLY the numerical value."
        ),
      invoiceDate: z
        .string()
        .optional()
        .describe(
          "The date appearing on the invoice document (e.g., 'YYYY-MM-DD')."
        ),
      paymentMethod: z
        .string()
        .optional()
        .describe(
          "The method of payment indicated on the invoice (e.g., 'Cash', 'Credit Card')."
        ),
    })
    .optional()
    .describe(
      "Overall details extracted from the invoice document, not specific to any single product line."
    ),
  products: z
    .array(ExtractedProductSchema)
    .describe(
      "An array of all the products or line items listed on the invoice."
    ),
});

// Final output schema for the document scanning flow (using camelCase)
export const ScanDocumentOutputSchema = z.object({
  documentType: DocumentTypeSchema.optional().nullable(),
  supplierId: z
    .string()
    .optional()
    .nullable()
    .describe("The ID of the matched supplier from the database."),
  supplierName: z.string().optional().nullable(),
  osekMorshe: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  totalAmount: z.number().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  products: z.array(FinalProductSchema).optional().nullable(),
  error: z
    .string()
    .optional()
    .describe("An error message if the scan or processing failed."),
  originalImagePreviewUri: z.string().optional().nullable(),
  compressedImageForFinalRecordUri: z.string().optional().nullable(),
});
export type ScanDocumentOutput = z.infer<typeof ScanDocumentOutputSchema>;
