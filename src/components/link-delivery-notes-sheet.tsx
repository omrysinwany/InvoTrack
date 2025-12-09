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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { getUnlinkedDeliveryNotesBySupplier } from "@/actions/invoice-actions";
import type { Invoice } from "@/services/types";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, X } from "lucide-react";

export interface LinkDeliveryNotesSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  supplierId: string | null;
  onLink: (deliveryNoteIds: string[]) => void;
  onCancel?: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LinkDeliveryNotesSheet: React.FC<LinkDeliveryNotesSheetProps> = ({
  isOpen,
  onOpenChange,
  supplierId,
  onLink,
  onCancel,
  t,
}) => {
  const { user } = useAuth();
  const [deliveryNotes, setDeliveryNotes] = useState<Invoice[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveryNotes = useCallback(async () => {
    if (!supplierId || !user?.id) {
      setDeliveryNotes([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSelectedNoteIds([]);
    try {
      const unlinkedNotes = await getUnlinkedDeliveryNotesBySupplier(
        supplierId,
        user.id
      );
      setDeliveryNotes(unlinkedNotes);
      if (unlinkedNotes.length === 0) {
        setError(t("link_delivery_notes_no_unlinked_found"));
      }
    } catch (err) {
      console.error("Failed to fetch unlinked delivery notes:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("link_delivery_notes_fetch_error_desc");
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
      fetchDeliveryNotes();
    }
  }, [isOpen, fetchDeliveryNotes]);

  const handleToggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleLink = () => {
    if (selectedNoteIds.length > 0) {
      onLink(selectedNoteIds);
      onOpenChange(false);
    }
  };

  const formatNoteDate = (date: Invoice["date"]): string => {
    if (!date) return "N/A";
    try {
      if (date instanceof Timestamp) {
        return format(date.toDate(), "P"); // Shorter format for notes
      }
      if (typeof date === "string") {
        return format(new Date(date), "P");
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
            {t("link_delivery_notes_sheet_title")}
          </SheetTitle>
          <SheetDescription className="text-xs sm:text-sm">
            {t("link_delivery_notes_sheet_description")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-grow">
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4">{t("loading_delivery_notes")}</p>
              </div>
            ) : error ? (
              <div className="text-center text-muted-foreground py-10">
                <p>{error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveryNotes.map((note) => (
                  <Label
                    key={note.id}
                    htmlFor={note.id}
                    className={`flex items-center space-x-3 rounded-md border p-4 cursor-pointer hover:bg-accent transition-colors ${
                      selectedNoteIds.includes(note.id)
                        ? "bg-primary text-primary-foreground"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id={note.id}
                      checked={selectedNoteIds.includes(note.id)}
                      onCheckedChange={() => handleToggleNoteSelection(note.id)}
                    />
                    <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-semibold">
                          {t("delivery_note_number_short")}:
                        </span>{" "}
                        {note.invoiceNumber || "N/A"}
                      </div>
                      <div>
                        <span className="font-semibold">
                          {t("date_label")}:
                        </span>{" "}
                        {formatNoteDate(note.date)}
                      </div>
                      <div className="text-right font-mono">
                        {formatCurrency(note.totalAmount)}
                      </div>
                    </div>
                  </Label>
                ))}
              </div>
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
            disabled={selectedNoteIds.length === 0 || isLoading}
            className="w-full sm:w-auto"
          >
            <LinkIcon className="mr-1.5 h-4 w-4" />{" "}
            {t("link_delivery_notes_button", { count: selectedNoteIds.length })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default LinkDeliveryNotesSheet;
