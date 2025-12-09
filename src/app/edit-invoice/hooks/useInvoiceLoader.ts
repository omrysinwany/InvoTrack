// src/app/edit-invoice/hooks/useInvoiceLoader.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";
import type { Invoice, Product, EditableProduct } from "@/services/types";
import {
  TEMP_DATA_KEY_PREFIX,
  getStorageKey,
  USERS_COLLECTION,
  DOCUMENTS_SUBCOLLECTION,
  clearTemporaryScanData,
} from "@/services/backend";
import type { ScanDocumentOutput } from "@/ai/flows/documents-schemas";
import { v4 as uuidv4 } from "uuid"; // Import uuid

interface UseInvoiceLoaderProps {
  // Props can be added here in the future
}

export interface UseInvoiceLoaderReturn {
  initialProducts: EditableProduct[];
  initialTaxDetails: Partial<Invoice>;
  originalFileName: string;
  displayedOriginalImageUrl: string | null;
  displayedCompressedImageUrl: string | null;
  isNewScan: boolean;
  isViewModeInitially: boolean;
  isLoading: boolean;
  dataError: string | null;
  scanProcessErrorFromLoad: string | null;
  initialTempInvoiceId: string | null;
  initialInvoiceIdParam: string | null;
  docType: "deliveryNote" | "invoice" | null;
  localStorageScanDataMissing: boolean;
  aiScannedSupplierNameFromStorage: string | undefined;
  aiScannedOsekMorsheFromStorage: string | undefined;
  initialScannedSupplierId: string | undefined;
  initialSelectedPaymentDueDate?: Date;
  cleanupTemporaryData: (tempId?: string) => void;
  initialDataLoaded: boolean;
}

export function useInvoiceLoader({}: UseInvoiceLoaderProps): UseInvoiceLoaderReturn {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const docType = useMemo(
    () => searchParams.get("docType") as "deliveryNote" | "invoice" | null,
    [searchParams]
  );
  const initialTempInvoiceId = useMemo(
    () => searchParams.get("tempInvoiceId"),
    [searchParams]
  );
  const initialInvoiceIdParam = useMemo(
    () => searchParams.get("invoiceId"),
    [searchParams]
  );
  const localStorageScanDataMissing = useMemo(
    () => searchParams.get("localStorageScanDataMissing") === "true",
    [searchParams]
  );
  const keyParamFromUrl = useMemo(
    () => searchParams.get("key"),
    [searchParams]
  );
  const urlOriginalFileName = useMemo(
    () => searchParams.get("originalFileName"),
    [searchParams]
  );

  const [initialProducts, setInitialProducts] = useState<EditableProduct[]>([]);
  const [initialTaxDetails, setInitialTaxDetails] = useState<Partial<Invoice>>(
    {}
  );
  const [originalFileName, setOriginalFileName] =
    useState<string>("Unknown Document");
  const [displayedOriginalImageUrl, setDisplayedOriginalImageUrl] = useState<
    string | null
  >(null);
  const [displayedCompressedImageUrl, setDisplayedCompressedImageUrl] =
    useState<string | null>(null);
  const [isNewScanState, setIsNewScanState] = useState(false);
  const [isViewModeInitially, setIsViewModeInitially] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [scanProcessErrorFromLoad, setScanProcessErrorFromLoad] = useState<
    string | null
  >(null);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [
    aiScannedSupplierNameFromStorage,
    setAiScannedSupplierNameFromStorage,
  ] = useState<string | undefined>(undefined);
  const [aiScannedOsekMorsheFromStorage, setAiScannedOsekMorsheFromStorage] =
    useState<string | undefined>(undefined);
  const [initialScannedSupplierId, setInitialScannedSupplierId] = useState<
    string | undefined
  >(undefined);
  const [initialSelectedPaymentDueDate, setInitialSelectedPaymentDueDate] =
    useState<Date | undefined>();

  const cleanupTemporaryData = useCallback(
    async (tempId?: string) => {
      const idToClear = tempId || initialTempInvoiceId;
      if (idToClear && user?.id) {
        try {
          console.log(
            `[useInvoiceLoader] Attempting to delete temporary scan data for ID: ${idToClear}`
          );
          clearTemporaryScanData(idToClear, user.id);
          // Also clear from localStorage if it was stored there
          localStorage.removeItem(`${TEMP_DATA_KEY_PREFIX}${idToClear}`);
          console.log(
            `[useInvoiceLoader] Temporary data for ID ${idToClear} cleared from service and localStorage.`
          );
        } catch (error) {
          console.error(
            `[useInvoiceLoader] Error cleaning up temporary data for ID ${idToClear}:`,
            error
          );
        }
      }
    },
    [user?.id, initialTempInvoiceId]
  );

  useEffect(() => {
    if (authLoading || initialDataLoaded) return;
    if (!user && !authLoading) {
      setDataError("User not authenticated. Please login.");
      setIsLoading(false);
      return;
    }
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setDataError(null);
      setScanProcessErrorFromLoad(null);

      const currentIsNewScan =
        !initialInvoiceIdParam && (!!initialTempInvoiceId || !!keyParamFromUrl);
      setIsNewScanState(currentIsNewScan);

      if (currentIsNewScan) {
        setIsViewModeInitially(true);
        setInitialProducts([]);
        setInitialTaxDetails({});
        setAiScannedSupplierNameFromStorage(undefined);
        setAiScannedOsekMorsheFromStorage(undefined);
        setInitialScannedSupplierId(undefined);
        setInitialSelectedPaymentDueDate(undefined);
        console.log(
          "[useInvoiceLoader] New scan detected (tempId/key). Setting isViewModeInitially to true."
        );
      } else if (initialInvoiceIdParam) {
        setIsViewModeInitially(true);
        console.log(
          "[useInvoiceLoader] Existing invoiceId detected. Setting isViewModeInitially to true."
        );
      } else {
        setIsViewModeInitially(false);
        setOriginalFileName("Manual Entry");
        setIsNewScanState(true);
        console.log(
          "[useInvoiceLoader] No invoiceId or tempId (manual entry). Setting isViewModeInitially to false."
        );
      }

      setOriginalFileName(
        urlOriginalFileName ||
          (docType === "invoice" ? "New Invoice" : "New Delivery Note")
      );
      let pendingDocSnap: any = null;
      let loadedProducts: EditableProduct[] = [];
      let loadedTaxDetails: Partial<Invoice> = {};
      let localAiScannedSupplier: string | undefined = undefined;
      let rawScanResultJsonFromStorage: string | null = null;
      let localScannedSupplierId: string | undefined = undefined;

      // --- START: Added block to handle loading from localStorage for new scans ---
      if (currentIsNewScan && initialTempInvoiceId && user?.id) {
        const storageKey = getStorageKey(
          `${TEMP_DATA_KEY_PREFIX}${initialTempInvoiceId}`,
          user.id
        );
        const jsonData = localStorage.getItem(storageKey);
        if (jsonData) {
          rawScanResultJsonFromStorage = jsonData;
        } else {
          console.warn(
            `[useInvoiceLoader] Scan data for tempId ${initialTempInvoiceId} not found in localStorage.`
          );
        }
      }
      // --- END: Added block ---

      try {
        if (initialInvoiceIdParam && db && user?.id) {
          const finalDocRef = doc(
            db,
            USERS_COLLECTION,
            user.id,
            DOCUMENTS_SUBCOLLECTION,
            initialInvoiceIdParam
          );
          pendingDocSnap = await getDoc(finalDocRef);
          if (
            !pendingDocSnap.exists() ||
            pendingDocSnap.data()?.userId !== user.id
          ) {
            setDataError(
              `Invoice not found or access denied (ID: ${initialInvoiceIdParam}).`
            );
            pendingDocSnap = null;
          }
        } else if (initialTempInvoiceId && db && user?.id) {
          const pendingDocRef = doc(
            db,
            USERS_COLLECTION,
            user.id,
            DOCUMENTS_SUBCOLLECTION,
            initialTempInvoiceId
          );
          pendingDocSnap = await getDoc(pendingDocRef);
          if (
            !pendingDocSnap.exists() ||
            pendingDocSnap.data()?.userId !== user.id
          ) {
            setDataError(
              `Pending scan data not found (Temp ID: ${initialTempInvoiceId}).`
            );
            pendingDocSnap = null;
          }
        }

        if (pendingDocSnap && pendingDocSnap.exists()) {
          const pendingData = pendingDocSnap.data() as Invoice;
          setOriginalFileName(
            pendingData.originalFileName || "Scanned Document"
          );
          if (!rawScanResultJsonFromStorage) {
            rawScanResultJsonFromStorage =
              pendingData.rawScanResultJson || null;
          }
          if (pendingData.products) {
            loadedProducts = pendingData.products.map((p: Product) => ({
              ...p,
              description: p.description || p.name,
              lineTotal: p.lineTotal || (p as any).totalPrice,
              _originalId: p.id,
            }));
          }
          loadedTaxDetails = {
            supplierName: pendingData.supplierName || undefined,
            invoiceNumber: pendingData.invoiceNumber || null,
            totalAmount: pendingData.totalAmount ?? null,
            date: pendingData.date, // <-- Use 'date' instead of 'invoiceDate'
            paymentMethod: pendingData.paymentMethod || null,
            dueDate: pendingData.dueDate, // <-- Use 'dueDate' instead of 'paymentDueDate'
            rawScanResultJson: rawScanResultJsonFromStorage,
            osekMorshe: pendingData.osekMorshe || undefined,
          };
          localAiScannedSupplier = pendingData.supplierName || undefined;
          if (pendingData.dueDate) {
            let dateToSet: Date | undefined;
            if (pendingData.dueDate instanceof Timestamp)
              dateToSet = pendingData.dueDate.toDate();
            else if (
              typeof pendingData.dueDate === "string" &&
              isValid(parseISO(pendingData.dueDate))
            )
              dateToSet = parseISO(pendingData.dueDate);
            else if (
              pendingData.dueDate instanceof Date &&
              isValid(pendingData.dueDate)
            )
              dateToSet = pendingData.dueDate;
            if (dateToSet) setInitialSelectedPaymentDueDate(dateToSet);
          }
          setDisplayedOriginalImageUrl(
            pendingData.originalImagePreviewUri || null
          );
          setDisplayedCompressedImageUrl(
            pendingData.compressedImageForFinalRecordUri || null
          );
          if (pendingData.errorMessage)
            setScanProcessErrorFromLoad(pendingData.errorMessage);
        } else if (
          currentIsNewScan &&
          !initialInvoiceIdParam &&
          !initialTempInvoiceId &&
          localStorageScanDataMissing
        ) {
          const lsMissingError = `Critical: Scan data was not saved to server and is also missing from local storage. Please try scanning again.`;
          setDataError(lsMissingError);
          setScanProcessErrorFromLoad(lsMissingError);
        } else if (
          currentIsNewScan &&
          !initialInvoiceIdParam &&
          !initialTempInvoiceId &&
          keyParamFromUrl &&
          user?.id
        ) {
          const storageKey = getStorageKey(
            `${TEMP_DATA_KEY_PREFIX}${keyParamFromUrl}`,
            user.id
          );
          rawScanResultJsonFromStorage = localStorage.getItem(storageKey);
          if (!rawScanResultJsonFromStorage) {
            const lsError = `Scan results not found locally for key: ${keyParamFromUrl}. The data might have been cleared or not saved.`;
            setDataError(lsError);
          }
        }

        if (rawScanResultJsonFromStorage) {
          try {
            const aiData = JSON.parse(
              rawScanResultJsonFromStorage
            ) as ScanDocumentOutput;
            if (aiData.products && loadedProducts.length === 0) {
              loadedProducts = aiData.products.map((p) => ({
                ...p,
                id: uuidv4(),
                userId: user.id,
                _originalId: `temp-${uuidv4()}`,
                name: p.name,
                description: p.name,
                lineTotal: p.totalPrice,
                quantity: p.quantity || 0,
                unitPrice: p.unitPrice || 0,
              }));
            }
            // We also extract the supplier name directly from the AI scan result,
            // as this is the most "raw" version available.
            localAiScannedSupplier = aiData.supplierName || undefined;
            setAiScannedSupplierNameFromStorage(
              aiData.supplierName || undefined
            );
            setAiScannedOsekMorsheFromStorage(aiData.osekMorshe || undefined);
            localScannedSupplierId = aiData.supplierId || undefined;
            setInitialScannedSupplierId(aiData.supplierId || undefined);

            // Override details from pendingData with fresh scan results if they exist
            loadedTaxDetails.supplierName =
              aiData.supplierName || loadedTaxDetails.supplierName;
            loadedTaxDetails.invoiceNumber =
              aiData.invoiceNumber || loadedTaxDetails.invoiceNumber;
            loadedTaxDetails.totalAmount =
              aiData.totalAmount ?? loadedTaxDetails.totalAmount;
            loadedTaxDetails.osekMorshe =
              aiData.osekMorshe || loadedTaxDetails.osekMorshe;

            // Use the invoice date from the scan result
            if (aiData.invoiceDate) {
              const parsedDate = parseISO(aiData.invoiceDate);
              if (isValid(parsedDate)) {
                loadedTaxDetails.date = Timestamp.fromDate(parsedDate);
              }
            }

            // The due date logic is handled by pendingData earlier. We don't want to
            // incorrectly use the invoiceDate from the scan as the paymentDueDate.
            // If the scan eventually provides a paymentDueDate, new logic can be added here.

            setDisplayedOriginalImageUrl(
              aiData.originalImagePreviewUri || null
            );
            setDisplayedCompressedImageUrl(
              aiData.compressedImageForFinalRecordUri || null
            );
          } catch (jsonError) {
            const parseErrorMsg = `Error parsing scan data. It might be corrupted.`;
            if (!scanProcessErrorFromLoad)
              setScanProcessErrorFromLoad((prev) =>
                prev ? `${prev}; ${parseErrorMsg}` : parseErrorMsg
              );
            if (!dataError) setDataError(parseErrorMsg);
          }
        } else if (
          pendingDocSnap?.exists() &&
          pendingDocSnap.data()?.products &&
          docType === "deliveryNote"
        ) {
          loadedProducts =
            pendingDocSnap
              .data()
              ?.products.map((p: Product) => ({ ...p, _originalId: p.id })) ||
            [];
        }

        setInitialProducts(loadedProducts);
        setInitialTaxDetails(loadedTaxDetails);
        setAiScannedSupplierNameFromStorage(localAiScannedSupplier);
      } catch (e) {
        console.error("[useInvoiceLoader] Outer catch block error:", e);
        setDataError(`Failed to load invoice data: ${(e as Error).message}`);
      } finally {
        setIsLoading(false);
        setInitialDataLoaded(true);
      }
    };

    if (user?.id) load();
  }, [
    authLoading,
    initialDataLoaded,
    user,
    docType,
    initialTempInvoiceId,
    initialInvoiceIdParam,
    keyParamFromUrl,
    urlOriginalFileName,
    cleanupTemporaryData,
  ]);

  // Wrap the return value in useMemo to stabilize the output
  const memoizedReturn = useMemo<UseInvoiceLoaderReturn>(() => {
    return {
      initialProducts,
      initialTaxDetails,
      originalFileName,
      displayedOriginalImageUrl,
      displayedCompressedImageUrl,
      isNewScan: isNewScanState,
      isViewModeInitially,
      isLoading,
      dataError,
      scanProcessErrorFromLoad,
      initialTempInvoiceId,
      initialInvoiceIdParam,
      docType,
      localStorageScanDataMissing,
      aiScannedSupplierNameFromStorage,
      aiScannedOsekMorsheFromStorage,
      initialScannedSupplierId,
      initialSelectedPaymentDueDate,
      cleanupTemporaryData,
      initialDataLoaded,
    };
  }, [
    initialProducts,
    initialTaxDetails,
    originalFileName,
    displayedOriginalImageUrl,
    displayedCompressedImageUrl,
    isNewScanState,
    isViewModeInitially,
    isLoading,
    dataError,
    scanProcessErrorFromLoad,
    initialTempInvoiceId,
    initialInvoiceIdParam,
    docType,
    localStorageScanDataMissing,
    aiScannedSupplierNameFromStorage,
    aiScannedOsekMorsheFromStorage,
    initialScannedSupplierId,
    initialSelectedPaymentDueDate,
    cleanupTemporaryData,
    initialDataLoaded,
  ]);

  return memoizedReturn;
}
