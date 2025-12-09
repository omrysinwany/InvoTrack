import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast"; // For local save notifications
import { Timestamp } from "firebase/firestore";
import type { EditableProduct, Invoice } from "@/services/types";

interface UseInvoiceStateManagerProps {
  initialProducts?: EditableProduct[];
  initialTaxDetails?: Partial<Invoice>;
  isViewModeInitially: boolean; // To set initial edit states
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface UseInvoiceStateManagerReturn {
  products: EditableProduct[];
  setProducts: React.Dispatch<React.SetStateAction<EditableProduct[]>>;
  editableTaxInvoiceDetails: Partial<Invoice>;
  setEditableTaxInvoiceDetails: React.Dispatch<
    React.SetStateAction<Partial<Invoice>>
  >;
  initialScannedProducts: EditableProduct[]; // For cancel edit products
  initialScannedTaxDetails: Partial<Invoice>; // For cancel edit tax details

  handleInputChange: (
    id: string,
    field: keyof EditableProduct,
    value: string | number
  ) => void;
  handleTaxInvoiceDetailsChange: (
    field: keyof Partial<Invoice>,
    value: string | number | undefined | Date | Timestamp
  ) => void; // Timestamp added

  isViewMode: boolean;
  setIsViewMode: React.Dispatch<React.SetStateAction<boolean>>;

  // For dialogs that modify products before main save
  productsForNextStep: EditableProduct[];
  setProductsForNextStep: React.Dispatch<
    React.SetStateAction<EditableProduct[]>
  >;
  scanProcessError: string | null; // General error from scan or processing steps not related to initial load
  setScanProcessError: React.Dispatch<React.SetStateAction<string | null>>;
  handleCancelEdit: () => void; // Added handleCancelEdit
}

// Helper for formatting input values, can be moved to a utils file if used elsewhere
const formatInputValue = (
  value: number | undefined | null,
  fieldType: "currency" | "quantity" | "stockLevel"
): string => {
  if (
    (fieldType === "currency" || fieldType === "stockLevel") &&
    (value === undefined || value === null)
  ) {
    return "";
  }
  if (value === null || value === undefined || isNaN(value)) {
    return fieldType === "currency" ? `0.00` : "0";
  }
  if (fieldType === "currency") {
    return parseFloat(String(value)).toFixed(2);
  }
  if (fieldType === "quantity") {
    // Preserve decimals for quantity
    return String(value);
  }
  // For stockLevel, rounding is fine
  return String(Math.round(value));
};

export function useInvoiceStateManager({
  initialProducts = [],
  initialTaxDetails = {},
  isViewModeInitially,
  t,
}: UseInvoiceStateManagerProps): UseInvoiceStateManagerReturn {
  // ✅ דגל אתחול למניעת אתחולים מרובים
  const isInitialized = useRef(false);
  const initializedWithData = useRef<{
    products: EditableProduct[];
    taxDetails: Partial<Invoice>;
    viewMode: boolean;
  } | null>(null);

  // ✅ רק הודעה אחת לאתחול
  if (!isInitialized.current) {
    console.log(
      "[useInvoiceStateManager] Initializing. isViewModeInitially:",
      isViewModeInitially
    );
    isInitialized.current = true;
    initializedWithData.current = {
      products: initialProducts,
      taxDetails: initialTaxDetails,
      viewMode: isViewModeInitially,
    };
  }

  const { toast } = useToast();
  const [products, setProducts] = useState<EditableProduct[]>(initialProducts);
  const [editableTaxInvoiceDetails, setEditableTaxInvoiceDetails] =
    useState<Partial<Invoice>>(initialTaxDetails);

  // These store the state "as loaded" or "as last saved in section" for cancellation
  const [initialScannedProducts, setInitialScannedProducts] =
    useState<EditableProduct[]>(initialProducts);
  const [initialScannedTaxDetails, setInitialScannedTaxDetails] =
    useState<Partial<Invoice>>(initialTaxDetails);

  const [isViewMode, setIsViewMode] = useState(isViewModeInitially);

  const [productsForNextStep, setProductsForNextStep] =
    useState<EditableProduct[]>(initialProducts);
  const [scanProcessError, setScanProcessError] = useState<string | null>(null);

  // ✅ אתחול מאוחד במקום כמה useEffect נפרדים
  useEffect(() => {
    // בדוק אם יש שינוי משמעותי בנתונים הראשוניים
    const hasSignificantChange =
      JSON.stringify(initialProducts) !==
        JSON.stringify(initializedWithData.current?.products) ||
      JSON.stringify(initialTaxDetails) !==
        JSON.stringify(initializedWithData.current?.taxDetails) ||
      isViewModeInitially !== initializedWithData.current?.viewMode;

    if (hasSignificantChange) {
      console.log(
        "[useInvoiceStateManager] Significant data change detected, updating state"
      );

      // עדכון כל הסטייטים בבת אחת
      setProducts(initialProducts);
      setInitialScannedProducts(initialProducts);
      setProductsForNextStep(initialProducts);
      setEditableTaxInvoiceDetails(initialTaxDetails);
      setInitialScannedTaxDetails(initialTaxDetails);
      setIsViewMode(isViewModeInitially);

      // עדכון הנתונים שנשמרו
      initializedWithData.current = {
        products: initialProducts,
        taxDetails: initialTaxDetails,
        viewMode: isViewModeInitially,
      };
    }
  }, [initialProducts, initialTaxDetails, isViewModeInitially]);

  // ✅ לוג מוגבל לשינויים בלבד
  useEffect(() => {
    console.log(
      "[useInvoiceStateManager] isViewMode state changed to:",
      isViewMode
    );
  }, [isViewMode]);

  const handleInputChange = useCallback(
    (id: string, field: keyof EditableProduct, value: string | number) => {
      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          if (p.id === id) {
            const updatedProduct = { ...p };
            let numericValue: number | string | null | undefined = value;
            if (
              [
                "quantity",
                "unitPrice",
                "lineTotal",
                "minStockLevel",
                "maxStockLevel",
                "salePrice",
              ].includes(field as string)
            ) {
              const stringValue = String(value);
              if (
                (field === "minStockLevel" ||
                  field === "maxStockLevel" ||
                  field === "salePrice") &&
                stringValue.trim() === ""
              )
                numericValue = undefined;
              else {
                numericValue = parseFloat(stringValue.replace(/,/g, ""));
                if (isNaN(numericValue as number))
                  numericValue =
                    field === "minStockLevel" ||
                    field === "maxStockLevel" ||
                    field === "salePrice"
                      ? undefined
                      : 0;
              }
              (updatedProduct as any)[field] = numericValue;
            } else (updatedProduct as any)[field] = value;

            const currentQuantity = Number(updatedProduct.quantity) || 0;
            let currentUnitPrice =
              updatedProduct.unitPrice !== undefined &&
              updatedProduct.unitPrice !== null &&
              !isNaN(Number(updatedProduct.unitPrice))
                ? Number(updatedProduct.unitPrice)
                : 0;
            let currentLineTotal = Number(updatedProduct.lineTotal) || 0;

            if (field === "quantity" || field === "unitPrice") {
              if (currentQuantity > 0 && currentUnitPrice >= 0)
                currentLineTotal = parseFloat(
                  (currentQuantity * currentUnitPrice).toFixed(2)
                );
              else if (
                (field === "unitPrice" &&
                  currentUnitPrice === 0 &&
                  currentQuantity > 0) ||
                (field === "quantity" && currentQuantity === 0)
              )
                currentLineTotal = 0;
              updatedProduct.lineTotal = currentLineTotal;
            } else if (field === "lineTotal") {
              if (currentQuantity > 0 && currentLineTotal >= 0) {
                currentUnitPrice = parseFloat(
                  (currentLineTotal / currentQuantity).toFixed(2)
                );
                updatedProduct.unitPrice = currentUnitPrice;
              } else if (currentLineTotal === 0) updatedProduct.unitPrice = 0;
            }
            if (currentQuantity === 0 || currentUnitPrice === 0)
              updatedProduct.lineTotal = 0;
            if (
              currentQuantity > 0 &&
              currentLineTotal > 0 &&
              field !== "unitPrice" &&
              currentUnitPrice === 0
            )
              updatedProduct.unitPrice = parseFloat(
                (currentLineTotal / currentQuantity).toFixed(2)
              );
            return updatedProduct;
          }
          return p;
        })
      );

      // Also update productsForNextStep if it's meant to be in sync during editing
      setProductsForNextStep((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            const changedProduct = { ...p, [field]: value };
            // Re-calculate lineTotal/unitPrice if quantity/unitPrice/lineTotal changed, similar to above logic
            if (
              ["quantity", "unitPrice", "lineTotal"].includes(field as string)
            ) {
              const cq = Number(changedProduct.quantity) || 0;
              let cup =
                changedProduct.unitPrice !== undefined &&
                changedProduct.unitPrice !== null &&
                !isNaN(Number(changedProduct.unitPrice))
                  ? Number(changedProduct.unitPrice)
                  : 0;
              let clt = Number(changedProduct.lineTotal) || 0;

              if (field === "quantity" || field === "unitPrice") {
                if (cq > 0 && cup >= 0) clt = parseFloat((cq * cup).toFixed(2));
                else if (
                  (field === "unitPrice" && cup === 0 && cq > 0) ||
                  (field === "quantity" && cq === 0)
                )
                  clt = 0;
                (changedProduct as any).lineTotal = clt;
              } else if (field === "lineTotal") {
                if (cq > 0 && clt >= 0) {
                  cup = parseFloat((clt / cq).toFixed(2));
                  (changedProduct as any).unitPrice = cup;
                } else if (clt === 0) (changedProduct as any).unitPrice = 0;
              }
              if (cq === 0 || cup === 0) (changedProduct as any).lineTotal = 0;
              if (cq > 0 && clt > 0 && field !== "unitPrice" && cup === 0)
                (changedProduct as any).unitPrice = parseFloat(
                  (clt / cq).toFixed(2)
                );
            }
            return changedProduct;
          }
          return p;
        })
      );
    },
    []
  );

  const handleTaxInvoiceDetailsChange = useCallback(
    (
      field: keyof Partial<Invoice>,
      value: string | number | undefined | Date | Timestamp
    ) => {
      // Timestamp added
      setEditableTaxInvoiceDetails((prev) => ({
        ...prev,
        [field]: value === "" ? null : value,
      }));
    },
    []
  );

  const handleCancelEdit = useCallback(() => {
    setEditableTaxInvoiceDetails({ ...initialScannedTaxDetails });
    setProducts([...initialScannedProducts]);
    setProductsForNextStep([...initialScannedProducts]); // Also reset products for dialog flow
    setIsViewMode(true);
    toast({
      title: t("edit_cancelled_title", { defaultValue: "Edit Cancelled" }),
      description: t("edit_changes_discarded_desc", {
        defaultValue: "Your changes have been discarded.",
      }),
      variant: "default",
    });
  }, [initialScannedTaxDetails, initialScannedProducts, t, toast]);

  return {
    products,
    setProducts,
    editableTaxInvoiceDetails,
    setEditableTaxInvoiceDetails,
    initialScannedProducts,
    initialScannedTaxDetails,
    handleInputChange,
    handleTaxInvoiceDetailsChange,
    isViewMode,
    setIsViewMode,
    productsForNextStep,
    setProductsForNextStep,
    scanProcessError,
    setScanProcessError,
    handleCancelEdit,
  };
}
