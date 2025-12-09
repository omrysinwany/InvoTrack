"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, Camera, Check } from "lucide-react";
import NextImage from "next/image";
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Invoice } from "@/services/types";
import { getStorageKey, TEMP_DATA_KEY_PREFIX } from "@/services/backend";
import { scanDocument } from "@/ai/flows/scan-document";
import { v4 as uuidv4 } from "uuid";

type DocType = "deliveryNote" | "invoice" | "invoiceReceipt" | "receipt";
type FirestoreDocData = Omit<Invoice, "id"> & {
  createdAt: any;
  updatedAt: any;
};

function mapAiDocTypeToAppDocType(
  aiDocType: string | undefined | null
): DocType {
  switch (aiDocType) {
    case "delivery_note":
      return "deliveryNote";
    case "invoice_receipt":
      return "invoiceReceipt";
    case "invoice":
      return "invoice";
    case "receipt":
      return "receipt";
    default:
      // Fallback for 'credit_invoice', 'other', or null/undefined
      return "invoice";
  }
}

async function compressImage(
  base64Str: string,
  quality: number,
  maxWidth: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Failed to get canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = (error) =>
      reject(new Error("Failed to load image for compression"));
  });
}

export function HomepageScanDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setIsSubmitting(false);
    setUploadProgress(0);
    setStreamingContent("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmAndScan = async () => {
    if (!selectedFile || !user?.id || !filePreview) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    setStreamingContent(t("upload_preparing_file"));

    const originalFileName = selectedFile.name;
    const tempInvoiceId = `pending-inv-${user.id}_${Date.now()}`;

    try {
      setUploadProgress(10);
      setStreamingContent(t("upload_compressing_image"));
      const compressedPreview = await compressImage(filePreview, 0.7, 800);
      const compressedFinal = await compressImage(filePreview, 0.5, 1024);

      setUploadProgress(20);
      setStreamingContent(t("upload_ai_analysis_inprogress"));
      const finalScanResult = await scanDocument({
        invoiceDataUri: compressedPreview,
        userId: user.id,
      });

      if (
        !finalScanResult ||
        typeof finalScanResult !== "object" ||
        finalScanResult.error
      ) {
        throw new Error(
          finalScanResult?.error || "AI scan returned an invalid result."
        );
      }

      setUploadProgress(80);
      setStreamingContent(t("upload_scan_complete_processing_results"));
      const scanResultJsonString = JSON.stringify(finalScanResult);
      const dataKey = getStorageKey(
        `${TEMP_DATA_KEY_PREFIX}${tempInvoiceId}`,
        user.id
      );
      localStorage.setItem(dataKey, scanResultJsonString);

      const finalDocType = mapAiDocTypeToAppDocType(
        finalScanResult.documentType
      );

      const pendingDocRef = doc(
        db,
        "users",
        user.id,
        "documents",
        tempInvoiceId
      );
      const scanData: FirestoreDocData = {
        userId: user.id,
        status: "pending",
        originalFileName: originalFileName,
        generatedFileName: `${finalDocType}_${Date.now()}`,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        uploadTime: Timestamp.now(),
        documentType: finalDocType,
        supplierId: "",
        originalImagePreviewUri: compressedPreview,
        compressedImageForFinalRecordUri: compressedFinal,
        date: finalScanResult.invoiceDate
          ? Timestamp.fromDate(new Date(finalScanResult.invoiceDate))
          : null,
        supplierName: finalScanResult.supplierName || "",
        invoiceNumber: finalScanResult.invoiceNumber || null,
        totalAmount: finalScanResult.totalAmount ?? 0,
        osekMorshe: finalScanResult.osekMorshe
          ? finalScanResult.osekMorshe.replace(/\D/g, "")
          : null,
        paymentMethod: finalScanResult.paymentMethod || null,
        rawScanResultJson: scanResultJsonString,
        products: (finalScanResult.products || []).map((p) => ({
          ...p,
          id: uuidv4(),
          userId: user.id,
          description: p.name,
          lineTotal: p.totalPrice,
          catalogNumber: p.catalogNumber,
          quantity: p.quantity,
        })),
        paymentStatus: "unpaid",
        errorMessage: null,
        taxAmount: null,
        subtotalAmount: null,
        dueDate: null,
        paymentReceiptImageUri: null,
        isArchived: false,
        syncedPos: null,
        imageUri: null,
        compressedImageUri: null,
      };
      await setDoc(pendingDocRef, scanData);

      setUploadProgress(100);
      toast({
        title: t("upload_toast_scan_complete_title"),
      });

      const params = new URLSearchParams({
        tempInvoiceId,
        originalFileName: encodeURIComponent(originalFileName),
        docType: finalDocType,
      });
      router.push(`/edit-invoice?${params.toString()}`);
      handleOpenChange(false);
    } catch (error: any) {
      console.error("Scan process failed:", error);
      toast({
        title: t("error_title"),
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{t("homepage_scan_dialog_title")}</DialogTitle>
          {!selectedFile && (
            <DialogDescription>
              {t("homepage_scan_dialog_desc")}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="p-6 pt-0">
          {!filePreview && !isSubmitting && (
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-semibold text-primary">
                {t("homepage_scan_dialog_select_button")}
              </p>
              <Input
                type="file"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
              />
            </div>
          )}
          {filePreview && !isSubmitting && (
            <div className="relative w-full aspect-[3/4] rounded-md overflow-hidden border">
              <NextImage
                src={filePreview}
                alt={t("upload_preview_alt")}
                layout="fill"
                objectFit="contain"
              />
            </div>
          )}
          {isSubmitting && (
            <div className="flex flex-col items-center justify-center h-60 space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <Progress value={uploadProgress} className="w-full h-2" />
              <p className="text-sm text-muted-foreground">
                {streamingContent}
              </p>
            </div>
          )}
        </div>
        {!isSubmitting && (
          <DialogFooter className="p-4 border-t bg-muted/50">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              {t("cancel_button")}
            </Button>
            <Button onClick={handleConfirmAndScan} disabled={!selectedFile}>
              <Check className="mr-2 h-4 w-4" />
              {t("confirm_and_scan_button")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
