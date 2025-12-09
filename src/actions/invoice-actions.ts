"use server";

import { adminDb as db } from "@/lib/firebase-admin";
import type { Invoice } from "@/services/types";
import { USERS_COLLECTION, DOCUMENTS_SUBCOLLECTION } from "@/services/backend";

/**
 * Fetches all unpaid invoices for a specific supplier for the current user.
 * @param supplierId The ID of the supplier to fetch invoices for.
 * @param userId The ID of the currently authenticated user.
 * @returns A promise that resolves to an array of unpaid invoices.
 */
export async function getUnpaidInvoicesBySupplier(
  supplierId: string,
  userId: string | undefined
): Promise<Invoice[]> {
  if (!userId) {
    throw new Error("User not authenticated");
  }

  if (!supplierId) {
    console.warn("getUnpaidInvoicesBySupplier called without supplierId");
    return [];
  }

  try {
    const documentsRef = db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .collection(DOCUMENTS_SUBCOLLECTION);

    const q = documentsRef
      .where("supplierId", "==", supplierId)
      .where("paymentStatus", "==", "unpaid")
      .where("documentType", "==", "invoice"); // Ensure we only get invoices

    const querySnapshot = await q.get();
    const invoices: Invoice[] = [];
    querySnapshot.forEach((doc) => {
      // Note: Firestore data is untyped, so we cast it.
      // Consider using data converters for more type safety.
      invoices.push({ id: doc.id, ...doc.data() } as Invoice);
    });

    return invoices;
  } catch (error) {
    console.error(
      `[SERVER_ACTION_ERROR] getUnpaidInvoicesBySupplier(${supplierId}):`,
      error
    );
    throw new Error("Failed to fetch unpaid invoices.");
  }
}

/**
 * Fetches all unlinked delivery notes for a specific supplier.
 * An unlinked delivery note is one that has not yet been associated with an invoice.
 * @param supplierId The ID of the supplier.
 * @param userId The ID of the authenticated user.
 * @returns A promise that resolves to an array of Invoice documents of type 'deliveryNote'.
 */
export async function getUnlinkedDeliveryNotesBySupplier(
  supplierId: string,
  userId: string | undefined
): Promise<Invoice[]> {
  if (!userId) {
    throw new Error("User not authenticated");
  }
  if (!supplierId) {
    console.warn(
      "getUnlinkedDeliveryNotesBySupplier called without supplierId"
    );
    return [];
  }

  try {
    const documentsRef = db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .collection(DOCUMENTS_SUBCOLLECTION);

    const q = documentsRef
      .where("supplierId", "==", supplierId)
      .where("documentType", "==", "deliveryNote")
      .where("linkedToInvoiceId", "==", null);

    const querySnapshot = await q.get();
    const deliveryNotes: Invoice[] = [];
    querySnapshot.forEach((doc) => {
      deliveryNotes.push({ id: doc.id, ...doc.data() } as Invoice);
    });

    return deliveryNotes;
  } catch (error) {
    console.error(
      `[SERVER_ACTION_ERROR] getUnlinkedDeliveryNotesBySupplier(${supplierId}):`,
      error
    );
    throw new Error("Failed to fetch unlinked delivery notes.");
  }
}
