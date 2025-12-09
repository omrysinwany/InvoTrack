// src/ai/flows/scan-document.ts
"use server";
/**
 * @fileOverview A flow to scan documents using Gemini and extract invoice-level information.
 *
 * - scanDocument - A function that handles the document scanning process.
 * - ScanDocumentInput - The input type for the scanDocument function.
 * - ScanDocumentOutput - The return type for the scanDocument function.
 */

import { ai } from "@/ai/ai-instance";
import { z } from "genkit";
import {
  ScanDocumentInputSchema,
  ScanDocumentOutputSchema,
  DocumentPromptOutputSchema,
  ScanDocumentInput,
  ScanDocumentOutput,
  FinalProductSchema,
} from "./documents-schemas";
import { getSupplierByOsekMorsheService } from "@/services/backend";
import { auth } from "@/lib/firebase"; // Assuming auth is exported from firebase config
import { adminDb } from "@/lib/firebase-admin";

export type { ScanDocumentInput, ScanDocumentOutput };

const prompt = ai.definePrompt({
  name: "scanDocumentPrompt",
  input: { schema: ScanDocumentInputSchema },
  output: { schema: DocumentPromptOutputSchema },
  prompt: `
    Analyze the document image provided. Your goal is to first classify the document type and then extract structured data with high accuracy. The document is in Hebrew.

    **Overall Instructions:**

    1.  **Classify Document Type:** First, determine the document type. Look for titles like 'חשבונית מס', 'קבלה', 'תעודת משלוח'. Classify it as one of: 'invoice', 'receipt', 'invoice_receipt', 'delivery_note', 'credit_invoice', or 'other'.
    2.  **Extract Data:** Based on the type, extract data into a valid JSON object with camelCase keys. The 'products' array and 'invoiceDetails' object are mandatory. If a section is empty, return an empty array or object.
    3.  **Numerical Values:** For ALL number fields ('quantity', 'unitPrice', 'totalPrice', 'totalAmount'), extract ONLY the numerical value. **DO NOT** include currency symbols (₪, $), commas, or any text. If a value is not found, use 0.
    4.  **Extract ALL Products:** Scrutinize the item table and extract EVERY SINGLE line item. Do not miss any.

    **Ironclad Rules for Product Data Extraction:**

    *   **NEVER** confuse the line item \`totalPrice\` with the document's final \`totalAmount\`. They are different.
    *   The \`quantity\` field MUST be the number of items. It is almost never a monetary value. Look for the column header 'כמות'.
    *   The \`unitPrice\` is the price for ONE unit. Look for the column header 'מחיר יח\\'' or 'מחיר ליחידה'.
    *   The \`totalPrice\` is the total for that specific line item (\`quantity\` * \`unitPrice\`). Look for the column header 'סה"כ שורה' or 'סה"כ'.

    **Detailed Field-Specific Guidance & Hebrew Keywords:**

    *   **\`documentType\`**: The classification from step 1.

    *   **\`invoiceDetails\` (Object):**
        *   **\`supplierName\`**: The vendor/store name. Usually at the top.
        *   **\`osekMorshe\`**: CRUCIAL. The supplier's Israeli Business Number. Look for 'ע.מ.', 'ח.פ.', 'עוסק מורשה', 'מס' עוסק'. It is usually a 9-digit number.
        *   **\`invoiceNumber\`**: The document's unique ID. Look for 'חשבונית מס מספר', 'מספר חשבונית', 'מספר אסמכתא'.
        *   **\`invoiceDate\`**: Document date. Look for 'תאריך'. Standardize to \`YYYY-MM-DD\`.
        *   **\`totalAmount\`**: The final total amount. Look for 'סה"כ', 'סך הכל', 'סה"כ לתשלום'. This is the final number.
        *   **\`paymentMethod\`**: Only if clearly stated. Look for 'מזומן' (Cash), 'אשראי' (Credit Card), 'צ\\'ק' (Check).

    *   **\`products\` (Array of Objects):** Follow the "Ironclad Rules" above.
        *   **\`name\`**: MANDATORY. The item description from under 'פריט' or 'תיאור'. If no name, use "פריט סרוק". DO NOT leave it empty.
        *   **\`shortName\`**: A very brief (max 3-4 words) summary of the name.
        *   **\`quantity\`**: The item count from under 'כמות'. If not found, provide 0.
        *   **\`unitPrice\`**: Price per item from under 'מחיר יח\\'', 'מחיר ליחידה'. If not found, provide 0.
        *   **\`totalPrice\`**: Total for the line from under 'סה"כ שורה'. If not found, provide 0.
        *   **\`catalogNumber\`**: SKU or item code from under 'מק"ט'. **IMPORTANT:** Do not use values from 'Reference 2' or 'אסמכתא 2' for this field. If not found, provide an empty string "".
        *   **\`barcode\`**: EAN or UPC number. Do not confuse it with 'מק"ט' (catalogNumber) or 'אסמכתא' (reference numbers).
        *   **\`referenceNumber\`**: Look for columns like 'אסמכתא 2' or 'Reference 2'. Extract the value if present, otherwise leave it empty.

    **Document-Type Specific Hints:**
    *   **'invoice' / 'invoice_receipt'**: Expect a full breakdown of products and totals.
    *   **'receipt'**: Might not have products. Focus on total amount and payment method. Return \`"products": []\` if none.
    *   **'delivery_note'**: Focus on the product list and total amount. Prices might be 0 or missing.

    Document Image: {{media url=invoiceDataUri}}
  `,
});

const scanDocumentFlow = ai.defineFlow(
  {
    name: "scanDocumentFlow",
    inputSchema: ScanDocumentInputSchema,
    outputSchema: ScanDocumentOutputSchema,
  },
  async (input) => {
    let rawOutputFromAI: z.infer<typeof DocumentPromptOutputSchema> | null =
      null;
    const maxRetries = 3;
    let currentRetry = 0;
    let delay = 1000; // Initial delay 1 second

    while (currentRetry < maxRetries) {
      try {
        console.log(
          `[scanDocumentFlow] Attempting AI call, try ${
            currentRetry + 1
          }. Input provided: ${!!input.invoiceDataUri}`
        );
        const { output } = await prompt(input);
        console.log(
          `[scanDocumentFlow] Raw output from AI (Attempt ${
            currentRetry + 1
          }):`,
          JSON.stringify(output, null, 2)
        );

        const validationResult = DocumentPromptOutputSchema.safeParse(output);

        if (!validationResult.success) {
          console.error(
            "[scanDocumentFlow] AI output validation failed.",
            "Received:",
            output,
            "Errors:",
            validationResult.error.flatten()
          );

          if (
            currentRetry < maxRetries - 1 &&
            (output === null || typeof output !== "object")
          ) {
            console.warn(
              `[scanDocumentFlow] AI returned null or non-object, retrying... (Attempt ${
                currentRetry + 1
              })`
            );
            currentRetry++;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
          // On final retry or for structured errors, fail and return error
          return {
            error: `AI output validation failed: ${validationResult.error
              .flatten()
              .formErrors.join(", ")}`,
            products: [],
          };
        }
        rawOutputFromAI = validationResult.data;
        break; // Success, exit retry loop
      } catch (promptError: any) {
        console.error(
          `[scanDocumentFlow] Error calling AI prompt (attempt ${
            currentRetry + 1
          }):`,
          promptError
        );
        const isServiceUnavailable =
          promptError.message?.includes("503") ||
          promptError.message?.toLowerCase().includes("service unavailable") ||
          promptError.message?.toLowerCase().includes("model is overloaded");
        const isRateLimit =
          promptError.message?.includes("429") ||
          promptError.message?.toLowerCase().includes("rate limit");

        if (
          (isServiceUnavailable || isRateLimit) &&
          currentRetry < maxRetries - 1
        ) {
          currentRetry++;
          console.warn(
            `[scanDocumentFlow] Retrying due to ${
              isServiceUnavailable ? "service unavailability" : "rate limiting"
            }. Waiting ${delay}ms.`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          // Non-retryable error or final retry failed
          let userErrorMessage = `AI Scan Error: ${
            promptError.message || "Unknown AI error"
          }`;
          if (isServiceUnavailable) {
            userErrorMessage =
              "The AI scanning service is temporarily unavailable due to high demand. Please try again in a few minutes.";
          }
          return { error: userErrorMessage, products: [] };
        }
      }
    }

    if (!rawOutputFromAI) {
      return {
        error:
          "AI processing failed after multiple retries. The AI service might be temporarily unavailable. Please try again later.",
        products: [],
      };
    }

    // Sanitize Osek Morshe before using it
    if (rawOutputFromAI.invoiceDetails?.osekMorshe) {
      rawOutputFromAI.invoiceDetails.osekMorshe =
        rawOutputFromAI.invoiceDetails.osekMorshe.replace(/-/g, "");
    }

    // Smart Linking: Find supplier by Osek Morshe
    let foundSupplierId: string | null = null;
    const details = rawOutputFromAI.invoiceDetails || {};
    const userId = input.userId; // Get user ID from input

    if (details.osekMorshe && userId) {
      try {
        console.log(
          `[scanDocumentFlow] Searching for supplier with Osek Morshe: ${details.osekMorshe} for user: ${userId}`
        );
        const supplierSnapshot = await adminDb
          .collection("users")
          .where("osekMorshe", "==", details.osekMorshe)
          .limit(1)
          .get();

        if (!supplierSnapshot.empty) {
          const supplierDoc = supplierSnapshot.docs[0];
          foundSupplierId = supplierDoc.id;
          console.log(
            `[scanDocumentFlow] Found existing supplier. ID: ${foundSupplierId}`
          );
          // If the AI-extracted name is generic, prefer the one from DB
          if (details.supplierName !== supplierDoc.data().name) {
            details.supplierName = supplierDoc.data().name;
          }
        } else {
          console.log(`[scanDocumentFlow] No existing supplier found.`);
        }
      } catch (e) {
        console.error("[scanDocumentFlow] Error searching for supplier:", e);
      }
    } else {
      console.log(
        "[scanDocumentFlow] Skipping supplier search: Osek Morshe or User ID is missing."
      );
    }

    // Post-processing: Clean and validate data from AI
    const cleanedProducts = (rawOutputFromAI.products || [])
      .map((product) => {
        const quantity = product.quantity ?? 1;
        let unitPrice = product.unitPrice ?? 0;
        let totalPrice = product.totalPrice ?? 0;

        // Smart price calculation
        if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
          totalPrice = unitPrice * quantity;
        } else if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
          unitPrice = totalPrice / quantity;
        }

        // Create the object according to the final schema
        const cleanedProduct: z.infer<typeof FinalProductSchema> = {
          name: product.name || "Scanned Item", // Provide a default name
          shortName: product.shortName,
          catalogNumber: product.catalogNumber,
          barcode: product.barcode,
          referenceNumber: (product as any).referenceNumber, // Add referenceNumber
          quantity,
          unitPrice,
          totalPrice,
        };
        return cleanedProduct;
      })
      .filter((p): p is z.infer<typeof FinalProductSchema> => {
        // Now, validate the cleaned product. This should pass for most items.
        const result = FinalProductSchema.safeParse(p);
        if (!result.success) {
          console.warn(
            `[scanDocumentFlow] A product was filtered out due to validation errors.`,
            "REASON:",
            result.error.flatten().fieldErrors,
            "ORIGINAL_PRODUCT_DATA:",
            p
          );
        }
        return result.success;
      });

    const finalOutput: ScanDocumentOutput = {
      documentType: rawOutputFromAI.documentType || "other",
      supplierId: foundSupplierId,
      supplierName: details.supplierName,
      osekMorshe: details.osekMorshe,
      invoiceNumber: details.invoiceNumber,
      totalAmount: details.totalAmount,
      invoiceDate: details.invoiceDate,
      paymentMethod: details.paymentMethod,
      products: cleanedProducts,
      error: undefined,
      originalImagePreviewUri: input.invoiceDataUri,
      compressedImageForFinalRecordUri: input.invoiceDataUri,
    };

    console.log(
      "[scanDocumentFlow] Successfully processed and cleaned document scan. Final Output:",
      finalOutput
    );
    return finalOutput;
  }
);

export async function scanDocument(
  input: ScanDocumentInput
): Promise<ScanDocumentOutput> {
  try {
    console.log(
      "[scanDocument Server Action] Received input:",
      input ? "Data URI present" : "No input"
    );
    if (!input || !input.invoiceDataUri) {
      console.error(
        "[scanDocument Server Action] Error: invoiceDataUri is missing in input."
      );
      return {
        error: "AI Scan Error: Missing invoice image data.",
        products: [],
      };
    }

    // Automatically add user ID to the input for the flow
    const flowInput: ScanDocumentInput = {
      ...input,
      userId: input.userId || auth.currentUser?.uid,
    };

    const result = await scanDocumentFlow(flowInput);

    console.log(
      "[scanDocument Server Action] Result from flow:",
      result
        ? result.error
          ? `Error: ${result.error}`
          : "Success"
        : "null/undefined result"
    );

    if (!result) {
      return { error: "AI Scan Error: Flow returned no result.", products: [] };
    }
    return result;
  } catch (error: any) {
    console.error(
      "[scanDocument Server Action] Unhandled error in scanDocument:",
      error
    );
    const errorMessage = error.message || "Unknown error";
    return {
      error: `AI Scan Error: Unhandled server error during document scan. ${errorMessage}`,
      products: [],
    };
  }
}
