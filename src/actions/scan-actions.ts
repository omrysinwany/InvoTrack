"use server";

import { scanDocument } from "@/ai/flows/scan-document";
import type {
  ScanDocumentInput,
  ScanDocumentOutput,
} from "@/ai/flows/documents-schemas";

export async function scanDocumentAction(
  input: ScanDocumentInput
): Promise<ScanDocumentOutput> {
  return scanDocument(input);
}
