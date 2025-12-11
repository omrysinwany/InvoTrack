// Use Firestore Lite for Vercel compatibility
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  DocumentSnapshot,
  FieldValue,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Query,
  QuerySnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  increment,
  GeoPoint,
  arrayUnion,
  arrayRemove,
  DocumentReference,
  CollectionReference,
} from "firebase/firestore/lite";
import { db } from "@/lib/firebase";
import {
  upsertPosProductAction,
  deactivatePosProductAction,
  upsertPosSupplierAction,
  createPosExpenseAction,
} from "@/actions/pos-actions";
import type { PosConnectionConfig } from "./pos-integration/pos-adapter.interface";
import { parseISO, isValid } from "date-fns";
import type {
  Product,
  PriceCheckResult,
  ProductPriceDiscrepancy,
  Supplier,
  UserSettings,
  User,
  Invoice,
  OtherExpense,
  ExpenseCategory,
  AccountantSettings,
} from "./types";
import type { PosIntegrationRef } from "./types";

// =================================================================
// COLLECTION AND SUBCOLLECTION NAMES
// =================================================================
export const USERS_COLLECTION = "users";
export const INVENTORY_SUBCOLLECTION = "inventoryProducts";
export const DOCUMENTS_SUBCOLLECTION = "documents";
export const SUPPLIERS_SUBCOLLECTION = "suppliers";
export const OTHER_EXPENSES_SUBCOLLECTION = "otherExpenses";
export const EXPENSE_CATEGORIES_SUBCOLLECTION = "expenseCategories";
export const USER_SETTINGS_SUBCOLLECTION = "settings";
// Constants for temporary scan data management
export const TEMP_DATA_KEY_PREFIX = "temp-scan-result-";
export const MAX_SCAN_RESULTS_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_INVOICE_HISTORY_ITEMS = 10;
const TEMP_DATA_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// =================================================================
// SUBCOLLECTION HELPERS
// =================================================================

const getUserSubcollectionRef = (userId: string, collectionName: string) => {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!userId) throw new Error("User ID is required to access subcollections.");
  return collection(db, USERS_COLLECTION, userId, collectionName);
};

const getUserSubcollectionDocRef = (
  userId: string,
  collectionName: string,
  docId: string
) => {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!userId || !docId) {
    throw new Error(
      "User ID and Document ID are required to access a subcollection document."
    );
  }
  return doc(db, USERS_COLLECTION, userId, collectionName, docId);
};

// =================================================================
// SERVICE FUNCTIONS
// =================================================================

const convertToTimestampIfValid = (
  dateVal: any
): Timestamp | null | FieldValue => {
  if (!dateVal) return null;
  if (dateVal instanceof Date && isValid(dateVal)) {
    return Timestamp.fromDate(dateVal);
  }
  if (dateVal instanceof Timestamp) {
    return dateVal;
  }
  if (typeof dateVal === "string") {
    // Handle DD/MM/YYYY format which is common in some locales
    const dmyParts = dateVal.split("/");
    if (dmyParts.length === 3) {
      const day = parseInt(dmyParts[0], 10);
      const month = parseInt(dmyParts[1], 10);
      const year = parseInt(dmyParts[2], 10);
      // Note: month is 0-indexed in JavaScript Date constructor
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1000) {
        const parsedDmy = new Date(Date.UTC(year, month - 1, day));
        if (isValid(parsedDmy)) {
          return Timestamp.fromDate(parsedDmy);
        }
      }
    }

    // Fallback to ISO parsing
    const parsedIso = parseISO(dateVal);
    if (isValid(parsedIso)) {
      return Timestamp.fromDate(parsedIso);
    }
  }
  if (
    typeof dateVal === "object" &&
    dateVal !== null &&
    "isEqual" in dateVal &&
    typeof dateVal.isEqual === "function"
  ) {
    // This checks for FieldValue like serverTimestamp()
    return dateVal as FieldValue;
  }
  console.warn(
    `[convertToTimestampIfValid] Could not convert date value:`,
    dateVal
  );
  return null;
};

// Define a type for the data being passed to the service
interface FinalizeInvoiceData {
  products: Partial<Product>[];
  originalFileName: string;
  docType: "deliveryNote" | "invoice" | "invoiceReceipt" | "receipt";
  userId: string;
  existingDocumentId: string | null;
  invoiceNumber: string | null;
  supplierName: string | null;
  totalAmount: number | null;
  paymentDueDate: Date | Timestamp | string | null;
  invoiceDate: Date | Timestamp | string | null;
  paymentMethod: string | null;
  originalImagePreviewUri: string | null;
  compressedImageForFinalRecordUri: string | null;
  rawScanResultJson: string | null;
  paymentTerms: string | null;
  osekMorshe: string | null;
}

export const checkProductPricesBeforeSaveService = async (
  productsToCheck: Product[],
  userId: string
): Promise<PriceCheckResult> => {
  const inventoryRef = getUserSubcollectionRef(userId, INVENTORY_SUBCOLLECTION);
  const priceDiscrepancies: ProductPriceDiscrepancy[] = [];
  const productsToSaveDirectly: Product[] = [];

  const catalogNumbers = productsToCheck
    .map((p) => p.catalogNumber)
    .filter((cn): cn is string => !!cn);
  const barcodes = productsToCheck
    .map((p) => p.barcode)
    .filter((b): b is string => !!b);

  if (catalogNumbers.length === 0 && barcodes.length === 0) {
    return { productsToSaveDirectly: productsToCheck, priceDiscrepancies: [] };
  }

  const existingProductsMap = new Map<string, Product>();

  // Helper to add product to map
  const addProductToMap = (product: Product) => {
    if (
      product.catalogNumber &&
      !existingProductsMap.has(product.catalogNumber)
    ) {
      existingProductsMap.set(product.catalogNumber, product);
    }
    if (product.barcode && !existingProductsMap.has(product.barcode)) {
      existingProductsMap.set(product.barcode, product);
    }
  };

  const fetchInChunks = async (
    field: "catalogNumber" | "barcode",
    values: string[]
  ) => {
    for (let i = 0; i < values.length; i += 10) {
      const chunk = values.slice(i, i + 10);
      const q = query(inventoryRef, where(field, "in", chunk));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        addProductToMap(doc.data() as Product);
      });
    }
  };

  if (catalogNumbers.length > 0) {
    await fetchInChunks("catalogNumber", catalogNumbers);
  }
  if (barcodes.length > 0) {
    await fetchInChunks("barcode", barcodes);
  }

  for (const product of productsToCheck) {
    const existingProduct =
      (product.catalogNumber &&
        existingProductsMap.get(product.catalogNumber)) ||
      (product.barcode && existingProductsMap.get(product.barcode));

    if (existingProduct) {
      const existingUnitPrice = Number(existingProduct.unitPrice) || 0;
      const newUnitPrice = Number(product.unitPrice) || 0;

      if (Math.abs(existingUnitPrice - newUnitPrice) > 0.001) {
        priceDiscrepancies.push({
          ...product,
          id: existingProduct.id,
          existingUnitPrice: existingUnitPrice,
          newUnitPrice: newUnitPrice,
        });
      } else {
        productsToSaveDirectly.push({
          ...product,
          id: existingProduct.id,
        });
      }
    } else {
      productsToSaveDirectly.push(product);
    }
  }

  return { productsToSaveDirectly, priceDiscrepancies };
};

export const finalizeSaveProductsService = async (
  data: FinalizeInvoiceData
): Promise<{
  finalInvoiceRecord: Invoice;
  savedOrUpdatedProducts: Product[];
}> => {
  const {
    products,
    originalFileName,
    docType,
    userId,
    existingDocumentId,
    invoiceNumber,
    supplierName,
    totalAmount,
    paymentDueDate,
    invoiceDate,
    paymentMethod,
    originalImagePreviewUri,
    compressedImageForFinalRecordUri,
    rawScanResultJson,
    paymentTerms,
    osekMorshe,
  } = data;

  console.log(
    "[Backend finalizeSaveProductsService] Starting final save. User:",
    userId,
    "Doc Type:",
    docType,
    "Total Amount:",
    totalAmount,
    "Payment Due Date:",
    paymentDueDate,
    "Invoice Date:",
    invoiceDate,
    "Payment Method:",
    paymentMethod,
    "Original Image Preview URI:",
    originalImagePreviewUri,
    "Compressed Image for Final Record URI:",
    compressedImageForFinalRecordUri,
    "Raw Scan Result JSON:",
    rawScanResultJson,
    "Payment Terms:",
    paymentTerms,
    "Osek Morshe:",
    osekMorshe
  );

  const firestoreDb = db;
  if (!firestoreDb) throw new Error("Firestore (db) is not initialized.");
  if (!userId) throw new Error("User ID is missing.");
  if (!supplierName) throw new Error("Supplier name is required.");

  let finalInvoiceRecord!: Invoice;
  const savedOrUpdatedProducts: Product[] = [];
  let finalSupplierId!: string;

  try {
    // --- Start of Critical Operations ---
    await runTransaction(firestoreDb, async (transaction) => {
      // --- ALL READS MUST BE AT THE START OF THE TRANSACTION ---
      let pendingDocData: Partial<Invoice> = {};
      if (existingDocumentId) {
        const existingDocRef = getUserSubcollectionDocRef(
          userId,
          DOCUMENTS_SUBCOLLECTION,
          existingDocumentId
        );
        const docSnap = await transaction.get(existingDocRef);
        if (docSnap.exists()) {
          pendingDocData = docSnap.data();
        }
      }

      const supplierQuery = query(
        getUserSubcollectionRef(userId, SUPPLIERS_SUBCOLLECTION),
        where("name", "==", supplierName),
        limit(1)
      );
      const supplierQuerySnapshot = await getDocs(supplierQuery);
      const existingSupplierDoc = supplierQuerySnapshot.docs[0];

      let supplierDocInTransaction;
      if (existingSupplierDoc) {
        supplierDocInTransaction = await transaction.get(
          existingSupplierDoc.ref
        );
        if (!supplierDocInTransaction.exists()) {
          throw new Error(
            "Supplier was deleted between the initial query and the transaction start."
          );
        }
      }
      // --- END OF READS ---

      const inventoryCollectionRef = getUserSubcollectionRef(
        userId,
        INVENTORY_SUBCOLLECTION
      );
      let supplierRef: DocumentReference;

      if (existingSupplierDoc && supplierDocInTransaction) {
        supplierRef = existingSupplierDoc.ref;
        finalSupplierId = existingSupplierDoc.id;
        const supplierData = supplierDocInTransaction.data();
        transaction.update(supplierRef, {
          totalSpent: (supplierData.totalSpent || 0) + (totalAmount || 0),
          invoiceCount: (supplierData.invoiceCount || 0) + 1,
          lastActivityDate: serverTimestamp(),
        });
      } else {
        supplierRef = doc(
          getUserSubcollectionRef(userId, SUPPLIERS_SUBCOLLECTION)
        );
        finalSupplierId = supplierRef.id;
        transaction.set(supplierRef, {
          id: finalSupplierId,
          userId,
          name: supplierName,
          totalSpent: totalAmount || 0,
          invoiceCount: 1,
          createdAt: serverTimestamp(),
          lastActivityDate: serverTimestamp(),
          paymentTerms: paymentTerms || null,
          osekMorshe: osekMorshe || null,
          posRefs: {},
        });
      }

      for (const product of products) {
        let productRef: DocumentReference;
        const { _originalId, ...productData } = product as any;

        if (_originalId && !_originalId.startsWith("prod-temp-")) {
          productRef = getUserSubcollectionDocRef(
            userId,
            INVENTORY_SUBCOLLECTION,
            _originalId
          );
          transaction.update(productRef, {
            ...productData,
            lastUpdated: serverTimestamp(),
            isActive: true,
          });
          savedOrUpdatedProducts.push({
            ...(productData as Partial<Product>),
            id: _originalId,
            userId,
          } as Product);
        } else {
          productRef = doc(inventoryCollectionRef);
          const newProductData = {
            ...productData,
            id: productRef.id,
            userId,
            lastUpdated: serverTimestamp(),
            isActive: true,
          };
          transaction.set(productRef, newProductData);
          const { lastUpdated, ...newProductForInvoice } = newProductData;
          savedOrUpdatedProducts.push(newProductForInvoice as Product);
        }
      }

      const finalInvoiceRef = existingDocumentId
        ? getUserSubcollectionDocRef(
            userId,
            DOCUMENTS_SUBCOLLECTION,
            existingDocumentId
          )
        : doc(getUserSubcollectionRef(userId, DOCUMENTS_SUBCOLLECTION));

      const invoiceData: Invoice = {
        // Carry over from pending document and add all required fields
        fileType: pendingDocData.fileType || "unknown",
        fileSize: pendingDocData.fileSize || 0,
        imageUri: pendingDocData.imageUri || null,
        compressedImageUri: pendingDocData.compressedImageUri || null,
        uploadTime:
          pendingDocData.uploadTime || (serverTimestamp() as Timestamp),
        id: finalInvoiceRef.id,
        userId,
        originalFileName,
        generatedFileName: `${supplierName}_${invoiceNumber || "N_A"}`,
        status: "completed",
        documentType: docType,
        supplierName: supplierName,
        supplierId: finalSupplierId,
        invoiceNumber: invoiceNumber || null,
        date: convertToTimestampIfValid(invoiceDate),
        totalAmount: totalAmount ?? 0,
        paymentMethod: paymentMethod || null,
        dueDate: convertToTimestampIfValid(paymentDueDate),
        paymentStatus:
          docType === "receipt" || docType === "invoiceReceipt"
            ? "paid"
            : "unpaid",
        products: savedOrUpdatedProducts,
        isArchived: false,
        syncedPos: null,
        originalImagePreviewUri: pendingDocData.originalImagePreviewUri || null,
        compressedImageForFinalRecordUri:
          pendingDocData.compressedImageForFinalRecordUri || null,
        linkedDeliveryNoteIds: [],
        linkedInvoiceId: null,
        paymentTerms: paymentTerms || null,
        osekMorshe: osekMorshe || null,
        rawScanResultJson: rawScanResultJson || null,
        errorMessage: null,
        paymentReceiptImageUri: null,
        taxAmount: null,
        subtotalAmount: null,
      };

      transaction.set(finalInvoiceRef, invoiceData, { merge: true });
      finalInvoiceRecord = invoiceData;
    });
    // --- End of Critical Operations ---

    // --- Start of Non-Critical POS Sync ---
    try {
      const userSettings = await getUserSettingsService(userId);

      if (userSettings.posConfig) {
        const config = userSettings.posConfig;

        const supplierDocRef = getUserSubcollectionDocRef(
          userId,
          SUPPLIERS_SUBCOLLECTION,
          finalSupplierId
        );
        const invoiceDocRef = getUserSubcollectionDocRef(
          userId,
          DOCUMENTS_SUBCOLLECTION,
          finalInvoiceRecord.id
        );
        const supplierDoc = await getDoc(supplierDocRef);

        if (supplierDoc.exists()) {
          const supplierData = supplierDoc.data() as Supplier;
          supplierData.osekMorshe = osekMorshe;
          let posSupplierId: string | undefined;
          if (config.systemId) {
            posSupplierId = supplierData.posRefs?.[config.systemId]?.externalId;
          }

          if (!posSupplierId) {
            const contactResult = await upsertPosSupplierAction(
              config,
              JSON.parse(JSON.stringify(supplierData))
            );
            if (contactResult.success && contactResult.externalId) {
              posSupplierId = contactResult.externalId;
              await updateDoc(supplierDocRef, {
                [`posRefs.${config.systemId}`]: {
                  systemId: config.systemId,
                  externalId: posSupplierId,
                  lastSync: new Date().toISOString(),
                },
              });
            } else {
              throw new Error(
                `POS supplier sync failed: ${contactResult.message}`
              );
            }
          }

          if (posSupplierId) {
            for (const product of savedOrUpdatedProducts) {
              const pResult = await upsertPosProductAction(config, {
                ...product,
                userId,
              });
              if (pResult.success && pResult.externalId && product.id) {
                await updateDoc(
                  getUserSubcollectionDocRef(
                    userId,
                    INVENTORY_SUBCOLLECTION,
                    product.id
                  ),
                  {
                    [`posRefs.${config.systemId}`]: {
                      systemId: config.systemId,
                      externalId: pResult.externalId,
                      lastSync: new Date().toISOString(),
                    },
                  }
                );
              }
            }

            if (
              docType === "invoice" ||
              docType === "invoiceReceipt" ||
              docType === "receipt"
            ) {
              const expenseResult = await createPosExpenseAction(
                config,
                JSON.parse(JSON.stringify(finalInvoiceRecord))
              );
              if (expenseResult.success && expenseResult.externalId) {
                await updateDoc(invoiceDocRef, {
                  isSyncedToPos: true,
                  "syncStatus.status": "success",
                  "syncStatus.lastSync": new Date().toISOString(),
                  "syncStatus.error": null,
                  [`posRefs.${config.systemId}`]: {
                    systemId: config.systemId,
                    externalId: expenseResult.externalId,
                    lastSync: new Date().toISOString(),
                  },
                });
              } else {
                throw new Error(
                  `POS expense creation failed: ${expenseResult.message}`
                );
              }
            } else {
              await updateDoc(invoiceDocRef, {
                isSyncedToPos: true,
                "syncStatus.status": "success",
                "syncStatus.lastSync": new Date().toISOString(),
                "syncStatus.error": null,
              });
            }
          }
        }
      }
    } catch (posError: any) {
      console.error("[Backend] Non-blocking error during POS sync:", posError);
      if (finalInvoiceRecord?.id) {
        await updateDoc(
          getUserSubcollectionDocRef(
            userId,
            DOCUMENTS_SUBCOLLECTION,
            finalInvoiceRecord.id
          ),
          {
            isSyncedToPos: false,
            "syncStatus.status": "error",
            "syncStatus.error": `POS Sync Failed: ${posError.message}`,
          }
        );
      }
    }
    // --- End of Non-Critical POS Sync ---

    return { finalInvoiceRecord, savedOrUpdatedProducts };
  } catch (error) {
    console.error(
      "[Backend finalizeSaveProductsService] Critical Error:",
      error
    );
    throw error;
  }
};

export const syncProductsWithPosService = async (
  products: Product[],
  userId: string
): Promise<void> => {
  const userSettings = await getUserSettingsService(userId);

  if (userSettings.posConfig) {
    const config = userSettings.posConfig;

    for (const product of products) {
      try {
        await upsertPosProductAction(config, { ...product, userId });
      } catch (error) {
        console.error(
          `Failed to sync product ${product.id} with ${config.systemId}:`,
          error
        );
      }
    }
  } else {
    console.log("POS not configured, skipping sync.");
  }
};

export async function getUserSettingsService(
  userId: string
): Promise<UserSettings> {
  const settingsRef = getUserSubcollectionDocRef(
    userId,
    USER_SETTINGS_SUBCOLLECTION,
    "userProfile"
  );
  const docSnap = await getDoc(settingsRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserSettings;
  }
  return {} as UserSettings; // Return empty object if no settings found
}

export async function saveUserSettingsService(
  settings: Partial<Omit<UserSettings, "userId">>,
  userId: string
): Promise<void> {
  const settingsRef = getUserSubcollectionDocRef(
    userId,
    USER_SETTINGS_SUBCOLLECTION,
    "userProfile"
  );
  await setDoc(settingsRef, settings, { merge: true });
}

export async function getProductsService(
  userId: string,
  options: { includeInactive?: boolean } = {}
): Promise<Product[]> {
  let q: Query = getUserSubcollectionRef(userId, INVENTORY_SUBCOLLECTION);
  if (!options.includeInactive) {
    q = query(q, where("isActive", "==", true));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Product);
}

export async function getProductByIdService(
  productId: string,
  userId: string
): Promise<Product | null> {
  const productRef = getUserSubcollectionDocRef(
    userId,
    INVENTORY_SUBCOLLECTION,
    productId
  );
  const docSnap = await getDoc(productRef);
  return docSnap.exists() ? (docSnap.data() as Product) : null;
}

export async function updateProductService(
  productId: string,
  productData: Partial<Product>,
  userId: string
): Promise<void> {
  if (!db || !userId) throw new Error("DB not initialized or User ID missing.");

  const productRef = getUserSubcollectionDocRef(
    userId,
    INVENTORY_SUBCOLLECTION,
    productId
  );

  const dataToUpdate = {
    ...productData,
    lastUpdated: serverTimestamp(),
  };

  try {
    const productDoc = await getDoc(productRef);
    if (!productDoc.exists()) {
      throw new Error("Product not found for update.");
    }
    const productBeforeUpdate = {
      id: productDoc.id,
      userId,
      ...productDoc.data(),
    } as Product;

    await updateDoc(productRef, dataToUpdate);
    console.log(`[Backend] Product ${productId} updated in Firestore.`);

    const userSettings = await getUserSettingsService(userId);
    if (userSettings.posConfig) {
      const systemId = userSettings.posConfig.systemId;
      if (systemId) {
        const externalId = productBeforeUpdate.posRefs?.[systemId]?.externalId;

        console.log(
          `[Backend updateProductService] Attempting to update product in ${systemId}. External ID: ${
            externalId || "N/A"
          }`
        );
        const updatedProductForPos: Product = {
          ...productBeforeUpdate,
          ...dataToUpdate,
        } as Product;

        try {
          const config = userSettings.posConfig;
          const posResult = await upsertPosProductAction(
            config,
            updatedProductForPos
          );
          if (posResult.success) {
            console.log(
              `[Backend updateProductService] Successfully updated product ${productId} in ${systemId}.`
            );
          } else {
            console.error(
              `[Backend updateProductService] Failed to update product ${productId} in ${systemId}: ${posResult.message}`
            );
          }
        } catch (posError: any) {
          console.error(
            `[Backend updateProductService] Critical error during ${systemId} update for product ${productId}: `,
            posError.message
          );
        }
      }
    }
  } catch (error) {
    console.error(`[Backend] Error updating product ${productId}:`, error);
    throw error;
  }
}

export async function deleteProductService(
  productId: string,
  userId: string
): Promise<void> {
  const productRef = getUserSubcollectionDocRef(
    userId,
    INVENTORY_SUBCOLLECTION,
    productId
  );

  let productToDeactivate: Product | null = null;

  try {
    const productDoc = await getDoc(productRef);
    if (!productDoc.exists()) {
      throw new Error("Product not found for deactivation.");
    }
    productToDeactivate = {
      id: productDoc.id,
      userId,
      ...productDoc.data(),
    } as Product;

    await updateDoc(productRef, {
      isActive: false,
      lastUpdated: serverTimestamp(),
    });
    console.log(
      `[Backend] Product ${productId} marked as inactive in Firestore.`
    );

    const userSettings = await getUserSettingsService(userId);
    if (userSettings.posConfig && productToDeactivate) {
      try {
        const systemId = userSettings.posConfig.systemId;
        if (systemId) {
          const externalId =
            productToDeactivate.posRefs?.[systemId]?.externalId;

          console.log(
            `[Backend deleteProductService] Attempting to deactivate product in ${systemId}. External ID: ${
              externalId || "N/A"
            }`
          );
          const config = userSettings.posConfig;
          const posResult = await deactivatePosProductAction(
            config,
            productToDeactivate
          );
          if (posResult.success) {
            console.log(
              `[Backend deleteProductService] Product ${productId} also marked as inactive in ${systemId}.`
            );
          } else {
            console.error(
              `[Backend deleteProductService] Failed to mark product ${productId} as inactive in ${systemId}: ${posResult.message}`
            );
          }
        }
      } catch (posError: any) {
        console.error(
          `[Backend deleteProductService] Critical error during POS deactivation for product ${productId}: `,
          posError.message
        );
      }
    }
  } catch (error) {
    console.error(`[Backend] Error deactivating product ${productId}:`, error);
    throw error;
  }
}

export async function reactivateProductService(
  productId: string,
  userId: string
): Promise<void> {
  const productRef = getUserSubcollectionDocRef(
    userId,
    INVENTORY_SUBCOLLECTION,
    productId
  );
  await updateDoc(productRef, {
    isActive: true,
    lastUpdated: serverTimestamp(),
  });
}

export async function clearInventoryService(userId: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const inventoryRef = getUserSubcollectionRef(userId, INVENTORY_SUBCOLLECTION);
  const snapshot = await getDocs(inventoryRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

export function getStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}

export function clearTemporaryScanData(tempId: string, userId: string) {
  const key = getStorageKey(`${TEMP_DATA_KEY_PREFIX}${tempId}`, userId);
  localStorage.removeItem(key);
}

export function clearOldTemporaryScanData(
  force = false,
  currentUserId?: string
) {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(TEMP_DATA_KEY_PREFIX)) {
      if (force && currentUserId && key.endsWith(currentUserId)) {
        localStorage.removeItem(key);
        return;
      }
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const { timestamp } = JSON.parse(stored);
          if (Date.now() - timestamp > TEMP_DATA_EXPIRATION_MS) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
  });
}

export async function getInvoicesService(userId: string): Promise<Invoice[]> {
  const invoicesRef = getUserSubcollectionRef(userId, DOCUMENTS_SUBCOLLECTION);
  const q = query(invoicesRef, orderBy("date", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Invoice)
  );
}

export async function getInvoicesByStatusService(
  userId: string,
  status: "unpaid" | "paid" | "pending" | "processing" | "error",
  supplierId?: string
): Promise<Invoice[]> {
  const invoicesRef = getUserSubcollectionRef(userId, DOCUMENTS_SUBCOLLECTION);
  let q;

  const statusConditions = where("status", "==", status);

  if (supplierId) {
    q = query(
      invoicesRef,
      statusConditions,
      where("supplierId", "==", supplierId),
      orderBy("date", "desc")
    );
  } else {
    q = query(invoicesRef, statusConditions, orderBy("date", "desc"));
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Invoice)
  );
}

export async function updateInvoiceService(
  invoiceId: string,
  invoiceData: Partial<Invoice>,
  userId: string
): Promise<Invoice> {
  const invoiceRef = getUserSubcollectionDocRef(
    userId,
    DOCUMENTS_SUBCOLLECTION,
    invoiceId
  );
  await updateDoc(invoiceRef, invoiceData);
  const updatedDoc = await getDoc(invoiceRef);
  return updatedDoc.data() as Invoice;
}

export async function deleteInvoiceService(
  invoiceId: string,
  userId: string
): Promise<void> {
  const invoiceRef = getUserSubcollectionDocRef(
    userId,
    DOCUMENTS_SUBCOLLECTION,
    invoiceId
  );
  await deleteDoc(invoiceRef);
}

export async function updateInvoicePaymentStatusService(
  invoiceId: string,
  paymentStatus: Invoice["paymentStatus"],
  userId: string,
  paymentReceiptImageUri?: string | null
): Promise<void> {
  const invoiceRef = getUserSubcollectionDocRef(
    userId,
    DOCUMENTS_SUBCOLLECTION,
    invoiceId
  );
  const updateData: Partial<Invoice> = { paymentStatus };

  if (paymentStatus === "paid") {
    if (paymentReceiptImageUri !== undefined) {
      updateData.paymentReceiptImageUri = paymentReceiptImageUri;
    }
  } else {
    updateData.paymentReceiptImageUri = null;
  }
  await updateDoc(invoiceRef, updateData);
}

export const archiveDocumentService = async (
  docId: string,
  userId: string
): Promise<void> => {
  const docRef = getUserSubcollectionDocRef(
    userId,
    DOCUMENTS_SUBCOLLECTION,
    docId
  );
  await updateDoc(docRef, {
    isArchived: true,
    lastUpdated: serverTimestamp(),
  });
};

export async function getSuppliersService(userId: string): Promise<Supplier[]> {
  if (!db) throw new Error("Firestore not initialized");
  const suppliersRef = getUserSubcollectionRef(userId, SUPPLIERS_SUBCOLLECTION);
  const q = query(suppliersRef, orderBy("name"));
  const snapshot = await getDocs(q);
  const suppliers: Supplier[] = [];
  snapshot.docs.forEach((doc) => {
    suppliers.push({ id: doc.id, ...doc.data() } as Supplier);
  });
  return suppliers;
}

export async function getSupplierByIdService(
  supplierId: string,
  userId: string
): Promise<Supplier | null> {
  if (!supplierId || !userId) return null;
  const supplierRef = getUserSubcollectionDocRef(
    userId,
    SUPPLIERS_SUBCOLLECTION,
    supplierId
  );
  const docSnap = await getDoc(supplierRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Supplier;
  }
  return null;
}

export async function getSupplierByOsekMorsheService(
  osekMorshe: string,
  userId: string
): Promise<Supplier | null> {
  if (!osekMorshe) {
    return null;
  }
  const suppliersRef = getUserSubcollectionRef(userId, SUPPLIERS_SUBCOLLECTION);
  const q = query(
    suppliersRef,
    where("osekMorshe", "==", osekMorshe),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const supplierDoc = querySnapshot.docs[0];
  return { id: supplierDoc.id, ...supplierDoc.data() } as Supplier;
}

export async function createSupplierAndSyncWithPosService(
  supplierData: Partial<Omit<Supplier, "id">>,
  userId: string
): Promise<Supplier> {
  // Use a transaction to ensure atomicity
  const newSupplierRef = doc(getUserSubcollectionRef(userId, "suppliers"));

  // Ensure essential data is present before creating
  if (!supplierData.name) {
    throw new Error("Supplier name is required to create a new supplier.");
  }

  const newSupplierData = {
    ...supplierData,
    name: supplierData.name!,
    osekMorshe: supplierData.osekMorshe,
    userId: userId,
    createdAt: serverTimestamp(),
    lastActivityDate: serverTimestamp(),
    posRefs: {},
  };
  const finalSupplierObject: Supplier = {
    ...newSupplierData,
    id: newSupplierRef.id,
    createdAt: new Date().toISOString(), // Use ISO string for immediate use
    lastActivityDate: new Date().toISOString(),
  };

  // Sync with POS system
  try {
    const userSettings = await getUserSettingsService(userId);

    if (userSettings.posConfig) {
      const config = userSettings.posConfig;

      const result = await upsertPosSupplierAction(
        config,
        JSON.parse(JSON.stringify(finalSupplierObject))
      );
      if (result.success && result.externalId) {
        if (!finalSupplierObject.id) {
          throw new Error("Failed to get ID for the newly created supplier.");
        }
        const supplierRef = getUserSubcollectionDocRef(
          userId,
          SUPPLIERS_SUBCOLLECTION,
          finalSupplierObject.id
        );
        const posRefData = {
          systemId: config.systemId,
          externalId: result.externalId,
          lastSync: new Date().toISOString(),
        };
        await updateDoc(supplierRef, {
          [`posRefs.${config.systemId}`]: posRefData,
        });

        const updatedSupplier = { ...finalSupplierObject };
        if (!updatedSupplier.posRefs) {
          updatedSupplier.posRefs = {};
        }
        if (config.systemId) {
          updatedSupplier.posRefs[config.systemId] = posRefData as any;
        }
        return updatedSupplier;
      } else {
        console.error(
          `Failed to sync new supplier with ${config.systemId}:`,
          result.message
        );
      }
    }
  } catch (posError: any) {
    console.error("[Backend] Non-blocking error during POS sync:", posError);
    if (finalSupplierObject.id) {
      await updateDoc(
        getUserSubcollectionDocRef(
          userId,
          SUPPLIERS_SUBCOLLECTION,
          finalSupplierObject.id
        ),
        {
          isSyncedToPos: false,
          "syncStatus.status": "error",
          "syncStatus.error": `POS Sync Failed: ${posError.message}`,
        }
      );
    }
  }
  return finalSupplierObject;
}

export async function createSupplierService(
  supplierData: Partial<Omit<Supplier, "id">>,
  userId: string
): Promise<Supplier> {
  if (!supplierData.name) {
    throw new Error("Supplier name is required to create a new supplier.");
  }
  const suppliersRef = getUserSubcollectionRef(userId, "suppliers");
  // Check for existing supplier by name to prevent duplicates
  const q = query(
    suppliersRef,
    where("name", "==", supplierData.name),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    // If a supplier with the same name exists, throw an error
    // or return the existing one, depending on desired behavior.
    console.warn(
      `[createSupplierService] Attempted to create a supplier with a name that already exists: '${supplierData.name}'. Returning existing supplier.`
    );
    const existingSupplierDoc = querySnapshot.docs[0];
    return {
      id: existingSupplierDoc.id,
      ...existingSupplierDoc.data(),
    } as Supplier;
  }

  const newSupplierData = {
    ...supplierData,
    name: supplierData.name,
    osekMorshe: supplierData.osekMorshe,
    userId,
    createdAt: serverTimestamp(),
    lastActivityDate: serverTimestamp(),
    invoiceCount: 0,
    totalSpent: 0,
    posRefs: {},
  };

  const newDocRef = await addDoc(suppliersRef, newSupplierData);

  return { id: newDocRef.id, ...newSupplierData } as Supplier;
}

export async function updateSupplierService(
  supplierId: string,
  supplierData: Partial<Omit<Supplier, "id" | "userId">>,
  userId: string
): Promise<void> {
  const supplierRef = getUserSubcollectionDocRef(
    userId,
    SUPPLIERS_SUBCOLLECTION,
    supplierId
  );
  await updateDoc(supplierRef, supplierData);
}

export async function deleteSupplierService(
  supplierId: string,
  userId: string
): Promise<void> {
  const supplierRef = getUserSubcollectionDocRef(
    userId,
    SUPPLIERS_SUBCOLLECTION,
    supplierId
  );
  // Optional: Add logic to check for dependent documents before deleting
  await deleteDoc(supplierRef);
}

/**
 * Creates or updates a batch of products in the inventory.
 * Useful for saving products from a POS sync.
 * It checks for existence based on catalogNumber and then barcode.
 * @param products - An array of products to upsert.
 * @param userId - The ID of the user.
 * @returns The number of products successfully upserted.
 */
export async function batchUpsertProductsService(
  products: Product[],
  userId: string
): Promise<number> {
  if (!db) throw new Error("Firestore not initialized");
  const inventoryRef = getUserSubcollectionRef(userId, INVENTORY_SUBCOLLECTION);
  const existingProductsQuery = query(inventoryRef);
  const existingProductsSnapshot = await getDocs(existingProductsQuery);
  const existingProductsMap = new Map<string, Product>();

  existingProductsSnapshot.forEach((doc) => {
    const product = doc.data() as Product;
    if (product.catalogNumber) {
      existingProductsMap.set(product.catalogNumber, product);
    }
    if (product.barcode) {
      existingProductsMap.set(product.barcode, product);
    }
  });

  const batch = writeBatch(db);
  let upsertedCount = 0;

  for (const product of products) {
    const existingProduct =
      (product.catalogNumber &&
        existingProductsMap.get(product.catalogNumber)) ||
      (product.barcode && existingProductsMap.get(product.barcode));

    if (existingProduct && "id" in existingProduct) {
      // Update existing product
      const productRef = getUserSubcollectionDocRef(
        userId,
        INVENTORY_SUBCOLLECTION,
        existingProduct.id
      );
      batch.update(productRef, {
        ...product,
        lastUpdated: serverTimestamp(),
        isActive: true, // Ensure synced products are active
      });
      upsertedCount++;
    } else {
      // Create new product
      const newProductRef = doc(inventoryRef);
      batch.set(newProductRef, {
        ...product,
        id: newProductRef.id,
        userId: userId,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
        isActive: true,
      });
      upsertedCount++;
    }
  }

  await batch.commit();
  return upsertedCount;
}

// ... other service functions (OtherExpense, ExpenseCategory, etc.)
export async function getOtherExpensesService(
  userId: string
): Promise<OtherExpense[]> {
  if (!db) throw new Error("Firestore not initialized");
  const expensesRef = getUserSubcollectionRef(
    userId,
    OTHER_EXPENSES_SUBCOLLECTION
  );
  const q = query(expensesRef, orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as OtherExpense);
}

export async function updateOtherExpenseService(
  expenseId: string,
  expenseData: Partial<OtherExpense>,
  userId: string
): Promise<void> {
  const expenseRef = getUserSubcollectionDocRef(
    userId,
    OTHER_EXPENSES_SUBCOLLECTION,
    expenseId
  );
  await updateDoc(expenseRef, expenseData);
}

export async function getExpenseCategoriesService(
  userId: string
): Promise<ExpenseCategory[]> {
  if (!db) throw new Error("Firestore not initialized");
  const categoriesRef = getUserSubcollectionRef(
    userId,
    EXPENSE_CATEGORIES_SUBCOLLECTION
  );
  const q = query(categoriesRef, orderBy("name"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as ExpenseCategory);
}

export const saveUserToFirestore = async (
  user: Pick<
    import("firebase/auth").User,
    "uid" | "email" | "displayName" | "metadata"
  >
): Promise<User> => {
  if (!db) throw new Error("Firestore not initialized");
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const data: Partial<User> = {
    email: user.email,
    username: user.displayName,
    lastLoginAt: serverTimestamp(),
  };

  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    data.createdAt = serverTimestamp();
  }

  await setDoc(userRef, data, { merge: true });
  const finalUserDoc = await getDoc(userRef);
  return { id: finalUserDoc.id, ...finalUserDoc.data() } as User;
};

/**
 * Gets accountant settings for a user
 */
export async function getAccountantSettingsService(
  userId: string
): Promise<AccountantSettings> {
  const userSettings = await getUserSettingsService(userId);
  return userSettings.accountantSettings || {};
}

/**
 * Saves accountant settings for a user
 */
export async function saveAccountantSettingsService(
  accountantSettings: AccountantSettings,
  userId: string
): Promise<void> {
  await saveUserSettingsService(
    { accountantSettings },
    userId
  );
}
