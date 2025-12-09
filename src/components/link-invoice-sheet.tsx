"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { getUnpaidInvoicesBySupplier } from "@/actions/invoice-actions";
import type { Invoice } from "@/services/types";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, X } from "lucide-react";

export interface LinkInvoiceSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  supplierId: string | null;
  onLink: (invoiceId: string) => void;
  onCancel?: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LinkInvoiceSheet: React.FC<LinkInvoiceSheetProps> = ({
  isOpen,
  onOpenChange,
  supplierId,
  onLink,
  onCancel,
  t,
}) => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!supplierId || !user?.id) {
      setInvoices([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSelectedInvoiceId(null);
    try {
      const unpaidInvoices = await getUnpaidInvoicesBySupplier(
        supplierId,
        user.id
      );
      setInvoices(unpaidInvoices);
      if (unpaidInvoices.length === 0) {
        setError(t("link_invoice_no_unpaid_invoices_found"));
      }
    } catch (err) {
      console.error("Failed to fetch unpaid invoices:", err);
      const errorMessage =
        err instanceof Error ? err.message : t("link_invoice_fetch_error_desc");
      setError(errorMessage);
      toast({
        title: t("error_title"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, user?.id, t]);

  useEffect(() => {
    if (isOpen) {
      fetchInvoices();
    }
  }, [isOpen, fetchInvoices]);

  const handleLink = () => {
    if (selectedInvoiceId) {
      onLink(selectedInvoiceId);
      onOpenChange(false);
    }
  };

  const formatInvoiceDate = (date: Invoice["date"]): string => {
    if (!date) return "N/A";
    try {
      if (date instanceof Timestamp) {
        return format(date.toDate(), "PPP");
      }
      if (typeof date === "string") {
        return format(new Date(date), "PPP");
      }
    } catch (e) {
      console.error("Error formatting date:", date, e);
    }
    return String(date);
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(amount);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[75vh] flex flex-col p-0 rounded-t-lg"
      >
        <SheetHeader className="p-4 sm:p-6 border-b shrink-0 sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center text-lg sm:text-xl">
            <LinkIcon className="mr-2 h-5 w-5 text-primary" />
            {t("link_invoice_sheet_title")}
          </SheetTitle>
          <SheetDescription className="text-xs sm:text-sm">
            {t("link_invoice_sheet_description")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-grow">
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4">{t("loading_invoices")}</p>
              </div>
            ) : error ? (
              <div className="text-center text-muted-foreground py-10">
                <p>{error}</p>
              </div>
            ) : (
              <RadioGroup
                value={selectedInvoiceId || ""}
                onValueChange={setSelectedInvoiceId}
                className="space-y-3"
              >
                {invoices.map((invoice) => (
                  <Label
                    key={invoice.id}
                    htmlFor={invoice.id}
                    className="flex items-center space-x-3 rounded-md border p-4 cursor-pointer hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
                  >
                    <RadioGroupItem value={invoice.id} id={invoice.id} />
                    <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-semibold">
                          {t("invoice_number_short")}:
                        </span>{" "}
                        {invoice.invoiceNumber || "N/A"}
                      </div>
                      <div>
                        <span className="font-semibold">
                          {t("date_label")}:
                        </span>{" "}
                        {formatInvoiceDate(invoice.date)}
                      </div>
                      <div className="text-right font-mono">
                        {formatCurrency(invoice.totalAmount)}
                      </div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-4 sm:p-6 border-t flex flex-col sm:flex-row gap-2 shrink-0 sticky bottom-0 bg-background z-10">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            <X className="mr-1.5 h-4 w-4" /> {t("cancel_button")}
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedInvoiceId || isLoading}
            className="w-full sm:w-auto"
          >
            <LinkIcon className="mr-1.5 h-4 w-4" /> {t("link_invoice_button")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default LinkInvoiceSheet;
