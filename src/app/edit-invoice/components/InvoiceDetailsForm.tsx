import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { Invoice } from "@/services/types";
import { Timestamp } from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";

interface InvoiceDetailsFormProps {
  editableTaxInvoiceDetails: Partial<Invoice>;
  handleTaxInvoiceDetailsChange: (
    field: keyof Partial<Invoice>,
    value: string | number | undefined | Date | Timestamp
  ) => void;
  isSaving: boolean;
  selectedPaymentDueDate?: Date; // Could be managed here or passed in
  onSelectedPaymentDueDateChange?: (date: Date | undefined) => void; // If managed by parent
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function InvoiceDetailsForm({
  editableTaxInvoiceDetails,
  handleTaxInvoiceDetailsChange,
  isSaving,
  selectedPaymentDueDate, // Use this if it's the source of truth for the input
  onSelectedPaymentDueDateChange,
  t,
}: InvoiceDetailsFormProps) {
  const paymentDueDateValue = selectedPaymentDueDate
    ? format(selectedPaymentDueDate, "yyyy-MM-dd")
    : editableTaxInvoiceDetails.dueDate
    ? editableTaxInvoiceDetails.dueDate instanceof Timestamp
      ? format(editableTaxInvoiceDetails.dueDate.toDate(), "yyyy-MM-dd")
      : typeof editableTaxInvoiceDetails.dueDate === "string" &&
        isValid(parseISO(editableTaxInvoiceDetails.dueDate))
      ? format(parseISO(editableTaxInvoiceDetails.dueDate), "yyyy-MM-dd")
      : editableTaxInvoiceDetails.dueDate instanceof Date &&
        isValid(editableTaxInvoiceDetails.dueDate)
      ? format(editableTaxInvoiceDetails.dueDate, "yyyy-MM-dd")
      : ""
    : "";

  const invoiceDateValue = editableTaxInvoiceDetails.date
    ? editableTaxInvoiceDetails.date instanceof Timestamp
      ? format(editableTaxInvoiceDetails.date.toDate(), "yyyy-MM-dd")
      : typeof editableTaxInvoiceDetails.date === "string" &&
        isValid(parseISO(editableTaxInvoiceDetails.date))
      ? format(parseISO(editableTaxInvoiceDetails.date), "yyyy-MM-dd")
      : editableTaxInvoiceDetails.date instanceof Date &&
        isValid(editableTaxInvoiceDetails.date)
      ? format(editableTaxInvoiceDetails.date, "yyyy-MM-dd")
      : ""
    : "";

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="supplierName">
          {t("invoice_details_supplier_label")}
        </Label>
        <Input
          id="supplierName"
          value={editableTaxInvoiceDetails.supplierName || ""}
          onChange={(e) =>
            handleTaxInvoiceDetailsChange("supplierName", e.target.value)
          }
          disabled={isSaving}
        />
      </div>
      <div>
        <Label htmlFor="invoiceNumber">
          {t("invoice_details_invoice_number_label")}
        </Label>
        <Input
          id="invoiceNumber"
          value={editableTaxInvoiceDetails.invoiceNumber || ""}
          onChange={(e) =>
            handleTaxInvoiceDetailsChange("invoiceNumber", e.target.value)
          }
          disabled={isSaving}
        />
      </div>
      <div>
        <Label htmlFor="totalAmount">
          {t("invoice_details_total_amount_label")}
        </Label>
        <Input
          id="totalAmount"
          type="number"
          value={editableTaxInvoiceDetails.totalAmount ?? ""}
          onChange={(e) =>
            handleTaxInvoiceDetailsChange(
              "totalAmount",
              e.target.value === "" ? undefined : parseFloat(e.target.value)
            )
          }
          disabled={isSaving}
        />
      </div>
      <div>
        <Label htmlFor="osekMorshe">
          {t("invoice_details_osek_morshe_label")}
        </Label>
        <Input
          id="osekMorshe"
          value={editableTaxInvoiceDetails.osekMorshe || ""}
          onChange={(e) =>
            handleTaxInvoiceDetailsChange(
              "osekMorshe",
              e.target.value.replace(/\D/g, "")
            )
          }
          disabled={isSaving}
        />
      </div>
      <div>
        <Label htmlFor="invoiceDate">
          {t("invoice_details_invoice_date_label")}
        </Label>
        <Input
          id="invoiceDate"
          type="date"
          value={invoiceDateValue}
          onChange={(e) =>
            handleTaxInvoiceDetailsChange(
              "date",
              e.target.value ? parseISO(e.target.value) : undefined
            )
          } // Store as Date object or ISO string
          disabled={isSaving}
        />
      </div>
      <div>
        <Label htmlFor="paymentMethod">
          {t("invoice_details_payment_method_label")}
        </Label>
        <Select
          value={editableTaxInvoiceDetails.paymentMethod || ""}
          onValueChange={(value) =>
            handleTaxInvoiceDetailsChange("paymentMethod", value)
          }
          disabled={isSaving}
        >
          <SelectTrigger className="mt-1">
            <SelectValue
              placeholder={t("invoice_details_payment_method_placeholder")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">{t("payment_method_cash")}</SelectItem>
            <SelectItem value="credit_card">
              {t("payment_method_credit_card")}
            </SelectItem>
            <SelectItem value="bank_transfer">
              {t("payment_method_bank_transfer")}
            </SelectItem>
            <SelectItem value="check">{t("payment_method_check")}</SelectItem>
            <SelectItem value="other">{t("payment_method_other")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="paymentDueDate">
          {t("payment_due_date_dialog_title")}
        </Label>
        <Input
          id="paymentDueDate"
          type="date"
          value={paymentDueDateValue}
          onChange={(e) => {
            const newDate = e.target.value
              ? parseISO(e.target.value)
              : undefined;
            if (onSelectedPaymentDueDateChange)
              onSelectedPaymentDueDateChange(newDate); // Update state if managed by parent
            handleTaxInvoiceDetailsChange("dueDate", newDate); // Store as Date object or ISO string
          }}
          disabled={isSaving}
        />
      </div>
    </div>
  );
}
