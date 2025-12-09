"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { getInvoicesByStatusService } from "@/services/backend";
import { linkReceiptToInvoiceAction } from "@/actions/pos-actions";
import type { Invoice as InvoiceType } from "@/services/types";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from "date-fns";
import { Timestamp } from "firebase/firestore";

interface LinkReceiptDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  supplierId: string | null;
  onLinkSuccess: () => void;
  onCancel: () => void;
}

export default function LinkReceiptDialog({
  isOpen,
  onOpenChange,
  supplierId,
  onLinkSuccess,
  onCancel,
}: LinkReceiptDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [unpaidInvoices, setUnpaidInvoices] = useState<InvoiceType[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      const fetchInvoices = async () => {
        setIsLoadingInvoices(true);
        try {
          const invoices = await getInvoicesByStatusService(
            user.id!,
            "unpaid",
            supplierId || undefined
          );
          setUnpaidInvoices(invoices);
        } catch (error) {
          console.error("Failed to fetch unpaid invoices:", error);
          toast({
            title: t("error_title"),
            description: t("link_receipt_dialog_fetch_invoices_error"),
            variant: "destructive",
          });
        } finally {
          setIsLoadingInvoices(false);
        }
      };
      fetchInvoices();
    }
  }, [isOpen, user, t, toast, supplierId]);

  const handleLinkReceipt = async () => {
    if (!selectedInvoiceId || !user?.id) {
      toast({
        title: t("error_title"),
        description: t("link_receipt_dialog_validation_error"),
        variant: "destructive",
      });
      return;
    }

    setIsLinking(true);
    try {
      const result = await linkReceiptToInvoiceAction({
        invoiceId: selectedInvoiceId,
        userId: user.id,
        receiptDataUri: "",
        receiptFileName: "",
      });

      if (result.success) {
        toast({
          title: t("link_receipt_dialog_success_title"),
          description: result.message,
        });
        onLinkSuccess();
        onOpenChange(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error("Failed to link receipt:", error);
      toast({
        title: t("error_title"),
        description:
          error.message || t("link_receipt_dialog_link_error_generic"),
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  const formatDate = (date: any) => {
    try {
      if (date instanceof Timestamp) {
        return format(date.toDate(), "dd/MM/yyyy");
      }
      if (typeof date === "string") {
        const parsedDate = parseISO(date);
        if (isValid(parsedDate)) {
          return format(parsedDate, "dd/MM/yyyy");
        }
      }
      return "N/A";
    } catch {
      return "Invalid Date";
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("link_receipt_dialog_title")}</DialogTitle>
          <DialogDescription>
            {supplierId
              ? t("link_receipt_dialog_description_filtered")
              : t("link_receipt_dialog_description")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoadingInvoices ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Select
              value={selectedInvoiceId}
              onValueChange={setSelectedInvoiceId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("link_receipt_dialog_select_placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {unpaidInvoices.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {`${invoice.supplierName} - #${
                      invoice.invoiceNumber
                    } (${formatDate(invoice.date)}) - ${formatCurrency(
                      invoice.totalAmount
                    )}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleLinkReceipt}
            disabled={!selectedInvoiceId || isLinking}
          >
            {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("link_receipt_dialog_link_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
