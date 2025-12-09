import React from "react";
import type { Invoice } from "@/services/types";
import { Timestamp, FieldValue } from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";

interface InvoiceDetailsViewProps {
  detailsToDisplay: Partial<Invoice>;
  selectedPaymentDueDate?: Date; // From parent state, if different from detailsToDisplay.dueDate
  t: (key: string, params?: Record<string, string | number>) => string;
}

const ScanSummaryItem: React.FC<{
  labelKey: string;
  value?: string | number | null | Timestamp | Date;
  fieldType?: "invoiceDate" | "paymentDueDate";
  t: InvoiceDetailsViewProps["t"];
}> = ({ labelKey, value, fieldType, t }) => {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "object" && "isEqual" in value) ||
    String(value).trim() === ""
  )
    return null;
  let displayValue = String(value);

  if (
    typeof value === "number" &&
    (labelKey.toLowerCase().includes("amount") ||
      labelKey.toLowerCase().includes("total"))
  ) {
    displayValue =
      t("currency_symbol") +
      value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  } else if (
    (fieldType === "invoiceDate" || fieldType === "paymentDueDate") &&
    value
  ) {
    let dateToFormat: Date | null = null;
    if (value instanceof Timestamp) dateToFormat = value.toDate();
    else if (typeof value === "string" && isValid(parseISO(value)))
      dateToFormat = parseISO(value);
    else if (value instanceof Date && isValid(value)) dateToFormat = value;

    if (dateToFormat && isValid(dateToFormat))
      displayValue = format(dateToFormat, "PP");
    else displayValue = String(value); // fallback if not a valid date format
  }
  return (
    <div className="break-words">
      <p className="text-sm text-muted-foreground">{t(labelKey)}</p>
      <p className="font-medium">{displayValue}</p>
    </div>
  );
};

// Helper function to filter out FieldValue
const filterFieldValue = (
  value: any
): string | number | Date | Timestamp | null | undefined => {
  if (value instanceof FieldValue) return null;
  return value;
};

export function InvoiceDetailsView({
  detailsToDisplay,
  selectedPaymentDueDate, // Use this for payment due date if provided
  t,
}: InvoiceDetailsViewProps) {
  const noDetailsAvailable = Object.values(detailsToDisplay).every(
    (val) => val === undefined || val === null || String(val).trim() === ""
  );

  // Determine which payment due date to display
  const paymentDueDateToDisplay =
    selectedPaymentDueDate !== undefined
      ? selectedPaymentDueDate
      : detailsToDisplay.dueDate;

  // Clean the osekMorshe value for display
  const cleanedOsekMorshe = detailsToDisplay.osekMorshe
    ? String(detailsToDisplay.osekMorshe).replace(/\D/g, "")
    : null;

  if (noDetailsAvailable && !paymentDueDateToDisplay) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("edit_invoice_no_details_extracted")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ScanSummaryItem
        labelKey="invoice_details_supplier_label"
        value={filterFieldValue(detailsToDisplay.supplierName)}
        t={t}
      />
      <ScanSummaryItem
        labelKey="invoice_details_invoice_number_label"
        value={filterFieldValue(detailsToDisplay.invoiceNumber)}
        t={t}
      />
      <ScanSummaryItem
        labelKey="invoice_details_osek_morshe_label"
        value={filterFieldValue(cleanedOsekMorshe)}
        t={t}
      />
      <ScanSummaryItem
        labelKey="invoice_details_total_amount_label"
        value={filterFieldValue(detailsToDisplay.totalAmount)}
        t={t}
      />
      <ScanSummaryItem
        labelKey="invoice_details_invoice_date_label"
        value={filterFieldValue(detailsToDisplay.date)}
        fieldType="invoiceDate"
        t={t}
      />
      <ScanSummaryItem
        labelKey="invoice_details_payment_method_label"
        value={filterFieldValue(detailsToDisplay.paymentMethod)}
        t={t}
      />
      <ScanSummaryItem
        labelKey="payment_due_date_dialog_title"
        value={filterFieldValue(paymentDueDateToDisplay)}
        fieldType="paymentDueDate"
        t={t}
      />
    </div>
  );
}
