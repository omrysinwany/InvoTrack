import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Edit,
  Save,
  Image,
  Sparkles,
  FileCheck,
  Receipt,
  Truck,
  FileX,
  Calendar,
  Hash,
  Building2,
  CreditCard,
  DollarSign,
  Clock,
  User,
} from "lucide-react";
import type { Invoice } from "@/services/types";
import { Timestamp, FieldValue } from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";

interface InvoiceCardProps {
  // Header props
  originalFileName: string;
  docType: "deliveryNote" | "invoice" | "receipt" | "invoiceReceipt" | null;
  imageUrl: string | null;
  // Details props
  detailsToDisplay: Partial<Invoice>;
  selectedPaymentDueDate?: Date;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const getDocumentIcon = (docType: InvoiceCardProps["docType"]) => {
  switch (docType) {
    case "deliveryNote":
      return Truck;
    case "invoice":
      return FileText;
    case "receipt":
      return Receipt;
    case "invoiceReceipt":
      return FileCheck;
    default:
      return FileX;
  }
};

const getDocumentTypeDisplay = (
  docType: "deliveryNote" | "invoice" | "receipt" | "invoiceReceipt" | null,
  t: (key: string) => string
) => {
  switch (docType) {
    case "deliveryNote":
      return t("document_type_delivery_note");
    case "invoice":
      return t("document_type_invoice");
    case "receipt":
      return t("document_type_receipt");
    case "invoiceReceipt":
      return t("document_type_invoice_receipt");
    default:
      return t("edit_invoice_title");
  }
};

const getDocumentColor = (docType: InvoiceCardProps["docType"]) => {
  switch (docType) {
    case "deliveryNote":
      return "from-blue-500 to-cyan-500";
    case "invoice":
      return "from-purple-500 to-pink-500";
    case "receipt":
      return "from-green-500 to-emerald-500";
    case "invoiceReceipt":
      return "from-amber-500 to-orange-500";
    default:
      return "from-gray-500 to-slate-500";
  }
};

const getDetailIcon = (fieldType: string) => {
  switch (fieldType) {
    case "supplier":
      return Building2;
    case "invoiceNumber":
      return Hash;
    case "osekMorshe":
      return User;
    case "totalAmount":
      return DollarSign;
    case "date":
      return Calendar;
    case "paymentMethod":
      return CreditCard;
    case "dueDate":
      return Clock;
    default:
      return FileText;
  }
};

// Helper function to filter out FieldValue
const filterFieldValue = (
  value: any
): string | number | Date | Timestamp | null | undefined => {
  if (value instanceof FieldValue) return null;
  return value;
};

const InvoiceDetailItem: React.FC<{
  labelKey: string;
  value?: string | number | null | Timestamp | Date;
  fieldType?: string;
  icon?: React.ElementType;
  gradientColors?: string;
  t: InvoiceCardProps["t"];
}> = ({ labelKey, value, fieldType, icon: Icon, gradientColors, t }) => {
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
    else displayValue = String(value);
  }

  return (
    <div className="group flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-all duration-300 border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
      {Icon && (
        <div
          className={`p-2 rounded-lg bg-gradient-to-br ${
            gradientColors || "from-gray-400 to-gray-500"
          } bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
          {t(labelKey)}
        </p>
        <p className="font-semibold text-gray-900 dark:text-gray-100 break-words">
          {displayValue}
        </p>
      </div>
    </div>
  );
};

export function InvoiceCard({
  originalFileName,
  docType,
  imageUrl,
  detailsToDisplay,
  selectedPaymentDueDate,
  t,
}: InvoiceCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const title = originalFileName || t("edit_invoice_unknown_document");
  const description = getDocumentTypeDisplay(docType, t);
  const DocIcon = getDocumentIcon(docType);
  const gradientColors = getDocumentColor(docType);

  const paymentDueDateToDisplay =
    selectedPaymentDueDate !== undefined
      ? selectedPaymentDueDate
      : detailsToDisplay.dueDate;

  const cleanedOsekMorshe = detailsToDisplay.osekMorshe
    ? String(detailsToDisplay.osekMorshe).replace(/\D/g, "")
    : null;

  const noDetailsAvailable = Object.values(detailsToDisplay).every(
    (val) => val === undefined || val === null || String(val).trim() === ""
  );

  return (
    <Card className="group relative overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-0">
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradientColors} animate-pulse`}
        />
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-[hsl(230_60%_18%)] to-[hsl(210,70%,40%)]
hover:from-[hsl(230_60%_15%)] rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-1000"
        />
        <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-1000" />
      </div>

      <div className="relative">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-stretch">
          {/* Image Preview */}
          <div className="sm:w-56 flex-shrink-0 relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 overflow-hidden">
            {!imageLoaded && !imageError && imageUrl && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
            )}

            {imageUrl && !imageError ? (
              <div className="relative w-full h-56 sm:h-48">
                <img
                  src={imageUrl}
                  alt={title}
                  className={`w-full h-full object-cover transition-all duration-700 ${
                    imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  }`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            ) : (
              <div className="w-full h-56 sm:h-48 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200/50 to-gray-300/50 dark:from-gray-700/50 dark:to-gray-800/50" />
                <Image className="h-20 w-20 text-gray-400 dark:text-gray-600 relative z-10 opacity-50" />
              </div>
            )}

            {/* Document type badge */}
            <div className="absolute top-3 left-3 z-20">
              <div
                className={`bg-gradient-to-r ${gradientColors} p-2.5 rounded-xl shadow-lg backdrop-blur-sm bg-opacity-90 transform transition-transform duration-300 hover:scale-110`}
              >
                <DocIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          {/* Title Section */}
          <div className="flex-1 relative">
            <CardHeader className="p-6 sm:p-8 flex flex-col justify-center space-y-4">
              <Sparkles className="absolute top-6 right-6 h-4 w-4 text-blue-800 opacity-40 animate-pulse" />

              <div className="space-y-3">
                <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent flex items-start gap-3">
                  <DocIcon
                    className={`h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 mt-0.5 bg-gradient-to-r ${gradientColors} text-transparent bg-clip-text`}
                  />
                  <span className="break-words leading-tight" title={title}>
                    {title}
                  </span>
                </CardTitle>

                <CardDescription className="text-base sm:text-lg text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                  {description}
                </CardDescription>

                <div className="flex flex-wrap gap-2 pt-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Active</span>
                  </div>
                  {docType && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${gradientColors} bg-opacity-10 rounded-full text-xs font-medium`}
                    >
                      <DocIcon className="h-3 w-3" />
                      <span className="capitalize">
                        {docType.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
          </div>
        </div>

        {/* Details Section */}
        <CardContent className="px-6 pb-6">
          <div className="relative">
            {/* Divider with gradient */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-gray-900 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("invoice_details_section_title") || "Invoice Details"}
                </span>
              </div>
            </div>

            {noDetailsAvailable && !paymentDueDateToDisplay ? (
              <div className="text-center py-8">
                <FileX className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("edit_invoice_no_details_extracted")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InvoiceDetailItem
                  labelKey="invoice_details_supplier_label"
                  value={filterFieldValue(detailsToDisplay.supplierName)}
                  fieldType="supplier"
                  icon={Building2}
                  gradientColors={gradientColors}
                  t={t}
                />
                <InvoiceDetailItem
                  labelKey="invoice_details_invoice_number_label"
                  value={filterFieldValue(detailsToDisplay.invoiceNumber)}
                  fieldType="invoiceNumber"
                  icon={Hash}
                  gradientColors={gradientColors}
                  t={t}
                />
                <InvoiceDetailItem
                  labelKey="invoice_details_osek_morshe_label"
                  value={filterFieldValue(cleanedOsekMorshe)}
                  fieldType="osekMorshe"
                  icon={User}
                  gradientColors={gradientColors}
                  t={t}
                />
                <InvoiceDetailItem
                  labelKey="invoice_details_total_amount_label"
                  value={filterFieldValue(detailsToDisplay.totalAmount)}
                  fieldType="totalAmount"
                  icon={DollarSign}
                  gradientColors={gradientColors}
                  t={t}
                />
                <InvoiceDetailItem
                  labelKey="invoice_details_invoice_date_label"
                  value={filterFieldValue(detailsToDisplay.date)}
                  fieldType="invoiceDate"
                  icon={Calendar}
                  gradientColors={gradientColors}
                  t={t}
                />
                <InvoiceDetailItem
                  labelKey="invoice_details_payment_method_label"
                  value={filterFieldValue(detailsToDisplay.paymentMethod)}
                  fieldType="paymentMethod"
                  icon={CreditCard}
                  gradientColors={gradientColors}
                  t={t}
                />
                <InvoiceDetailItem
                  labelKey="payment_due_date_dialog_title"
                  value={filterFieldValue(paymentDueDateToDisplay)}
                  fieldType="paymentDueDate"
                  icon={Clock}
                  gradientColors={gradientColors}
                  t={t}
                />
              </div>
            )}
          </div>
        </CardContent>
      </div>

      {/* Bottom gradient border effect */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientColors} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}
      />
    </Card>
  );
}

// Add required CSS for animations
const style = document.createElement("style");
style.textContent = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;
document.head.appendChild(style);
