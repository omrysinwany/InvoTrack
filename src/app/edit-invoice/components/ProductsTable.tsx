import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  PlusCircle,
  Package,
  ShoppingCart,
  Hash,
  FileText,
  DollarSign,
  Calculator,
  Sparkles,
  Edit3,
  Save,
} from "lucide-react";
import type { EditableProduct } from "@/services/types";

interface ProductsTableProps {
  products: EditableProduct[];
  handleInputChange: (
    id: string,
    field: keyof EditableProduct,
    value: string | number
  ) => void;
  isSaving: boolean;
  isEditing: boolean;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const formatDisplayValue = (
  value: number | undefined | null,
  fieldType: "currency" | "quantity",
  t: ProductsTableProps["t"]
): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return fieldType === "currency" ? `${t("currency_symbol")}0.00` : "0";
  }
  if (fieldType === "currency") {
    return `${t("currency_symbol")}${parseFloat(String(value)).toFixed(2)}`;
  }
  return String(Math.round(value));
};

const formatInputValue = (
  value: number | undefined | null,
  fieldType: "currency" | "quantity"
): string => {
  if (fieldType === "currency" && (value === undefined || value === null)) {
    return "";
  }
  if (value === null || value === undefined || isNaN(value)) {
    return fieldType === "currency" ? "0.00" : "0";
  }
  if (fieldType === "currency") {
    return parseFloat(String(value)).toFixed(2);
  }
  return String(Math.round(value));
};

export function ProductsTable({
  products,
  handleInputChange,
  isSaving,
  isEditing,
  onAddRow,
  onRemoveRow,
  t,
}: ProductsTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);

  if (products.length === 0 && !isEditing) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-12 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
        <Package className="h-16 w-16 text-gray-300 dark:text-gray-700 mx-auto mb-4 opacity-50" />
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
          {t("edit_invoice_no_products_in_scan")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {/* Decorative elements */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-10" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-10" />

      {/* Table container */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-4 text-left font-bold text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-purple-500" />
                    <span>{t("edit_invoice_th_catalog")}</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-left font-bold text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span>{t("edit_invoice_th_description")}</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right font-bold text-gray-700 dark:text-gray-300">
                  <div className="flex items-center justify-end gap-2">
                    <Package className="h-4 w-4 text-green-500" />
                    <span>{t("edit_invoice_th_qty")}</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right font-bold text-gray-700 dark:text-gray-300">
                  <div className="flex items-center justify-end gap-2">
                    <DollarSign className="h-4 w-4 text-amber-500" />
                    <span>
                      {t("edit_invoice_th_unit_price", {
                        currency_symbol: t("currency_symbol"),
                      })}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-4 text-right font-bold text-gray-700 dark:text-gray-300">
                  <div className="flex items-center justify-end gap-2">
                    <Calculator className="h-4 w-4 text-pink-500" />
                    <span>
                      {t("edit_invoice_th_line_total", {
                        currency_symbol: t("currency_symbol"),
                      })}
                    </span>
                  </div>
                </th>
                {isEditing && (
                  <th className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300">
                    <div className="flex items-center justify-center gap-2">
                      <Edit3 className="h-4 w-4 text-red-500" />
                      <span>{t("edit_invoice_th_actions")}</span>
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr
                  key={product.id}
                  className={`
                    group transition-all duration-300 border-b border-gray-100 dark:border-gray-800
                    ${
                      hoveredRow === product.id
                        ? "bg-gray-50 dark:bg-gray-800/50"
                        : ""
                    }
                    ${
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-900"
                        : "bg-gray-50/50 dark:bg-gray-900/50"
                    }
                    hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 
                    dark:hover:from-purple-900/20 dark:hover:to-pink-900/20
                  `}
                  onMouseEnter={() => setHoveredRow(product.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="relative">
                        <Input
                          value={product.catalogNumber || ""}
                          onChange={(e) =>
                            handleInputChange(
                              product.id,
                              "catalogNumber",
                              e.target.value
                            )
                          }
                          onFocus={() =>
                            setFocusedCell(`${product.id}-catalog`)
                          }
                          onBlur={() => setFocusedCell(null)}
                          className={`
                            h-10 transition-all duration-300
                            ${
                              focusedCell === `${product.id}-catalog`
                                ? "ring-2 ring-purple-500 border-purple-500"
                                : "hover:border-gray-400"
                            }
                          `}
                          disabled={isSaving}
                        />
                        {focusedCell === `${product.id}-catalog` && (
                          <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-purple-500 animate-pulse" />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Hash className="h-3 w-3 text-gray-400 opacity-50" />
                        <span
                          title={product.catalogNumber || undefined}
                          className="font-medium text-gray-700 dark:text-gray-300"
                        >
                          {product.catalogNumber || "N/A"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[300px]">
                    {isEditing ? (
                      <div className="relative">
                        <Input
                          value={product.description || ""}
                          onChange={(e) =>
                            handleInputChange(
                              product.id,
                              "description",
                              e.target.value
                            )
                          }
                          onFocus={() => setFocusedCell(`${product.id}-desc`)}
                          onBlur={() => setFocusedCell(null)}
                          className={`
                            h-10 transition-all duration-300
                            ${
                              focusedCell === `${product.id}-desc`
                                ? "ring-2 ring-blue-500 border-blue-500"
                                : "hover:border-gray-400"
                            }
                          `}
                          disabled={isSaving}
                        />
                        {focusedCell === `${product.id}-desc` && (
                          <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-blue-500 animate-pulse" />
                        )}
                      </div>
                    ) : (
                      <span
                        title={product.description || undefined}
                        className="block truncate font-medium text-gray-700 dark:text-gray-300"
                      >
                        {product.description || "N/A"}
                      </span>
                    )}
                  </td>
                  <td className="text-right px-4 py-3">
                    {isEditing ? (
                      <div className="relative inline-block">
                        <Input
                          type="number"
                          value={formatInputValue(product.quantity, "quantity")}
                          onChange={(e) =>
                            handleInputChange(
                              product.id,
                              "quantity",
                              e.target.value
                            )
                          }
                          onFocus={() => setFocusedCell(`${product.id}-qty`)}
                          onBlur={() => setFocusedCell(null)}
                          className={`
                            w-24 text-right h-10 transition-all duration-300
                            ${
                              focusedCell === `${product.id}-qty`
                                ? "ring-2 ring-green-500 border-green-500"
                                : "hover:border-gray-400"
                            }
                          `}
                          disabled={isSaving}
                        />
                        {focusedCell === `${product.id}-qty` && (
                          <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-green-500 animate-pulse" />
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                        {formatDisplayValue(product.quantity, "quantity", t)}
                        <Package className="h-3 w-3 text-gray-400 opacity-50" />
                      </span>
                    )}
                  </td>
                  <td className="text-right px-4 py-3">
                    {isEditing ? (
                      <div className="relative inline-block">
                        <Input
                          type="number"
                          value={formatInputValue(
                            product.unitPrice,
                            "currency"
                          )}
                          onChange={(e) =>
                            handleInputChange(
                              product.id,
                              "unitPrice",
                              e.target.value
                            )
                          }
                          onFocus={() => setFocusedCell(`${product.id}-price`)}
                          onBlur={() => setFocusedCell(null)}
                          className={`
                            w-28 text-right h-10 transition-all duration-300
                            ${
                              focusedCell === `${product.id}-price`
                                ? "ring-2 ring-amber-500 border-amber-500"
                                : "hover:border-gray-400"
                            }
                          `}
                          disabled={isSaving}
                        />
                        {focusedCell === `${product.id}-price` && (
                          <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-amber-500 animate-pulse" />
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatDisplayValue(product.unitPrice, "currency", t)}
                      </span>
                    )}
                  </td>
                  <td className="text-right px-4 py-3">
                    {isEditing ? (
                      <div className="relative inline-block">
                        <Input
                          type="number"
                          value={formatInputValue(
                            product.lineTotal,
                            "currency"
                          )}
                          onChange={(e) =>
                            handleInputChange(
                              product.id,
                              "lineTotal",
                              e.target.value
                            )
                          }
                          onFocus={() => setFocusedCell(`${product.id}-total`)}
                          onBlur={() => setFocusedCell(null)}
                          className={`
                            w-28 text-right h-10 transition-all duration-300
                            ${
                              focusedCell === `${product.id}-total`
                                ? "ring-2 ring-pink-500 border-pink-500"
                                : "hover:border-gray-400"
                            }
                          `}
                          disabled={isSaving}
                        />
                        {focusedCell === `${product.id}-total` && (
                          <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-pink-500 animate-pulse" />
                        )}
                      </div>
                    ) : (
                      <span className="font-bold text-lg  text-gray-700 dark:text-gray-300">
                        {formatDisplayValue(product.lineTotal, "currency", t)}
                      </span>
                    )}
                  </td>
                  {isEditing && (
                    <td className="text-center px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveRow(product.id)}
                        className={`
                          relative group/btn text-red-500 hover:text-red-600 
                          hover:bg-red-50 dark:hover:bg-red-900/20 
                          h-9 w-9 transition-all duration-300
                          ${isSaving ? "opacity-50" : "hover:scale-110"}
                        `}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="absolute inset-0 rounded-md bg-red-500/20 scale-0 group-hover/btn:scale-100 transition-transform duration-300" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total summary bar */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {t("edit_invoice_total_items") || "Total Items"}:{" "}
                {products.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-px bg-gray-300 dark:bg-gray-600" />
              <Calculator className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {t("edit_invoice_grand_total") || "Grand Total"}:{" "}
                {t("currency_symbol")}
                {products
                  .reduce((sum, p) => sum + (p.lineTotal || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add row button */}
      {isEditing && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onAddRow}
            disabled={isSaving}
            className={`
              relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 
              text-white border-0 hover:from-purple-600 hover:to-pink-600 
              shadow-lg hover:shadow-xl transform transition-all duration-300 
              hover:scale-105 px-6 py-3 text-base font-semibold
              ${isSaving ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <span className="relative z-10 flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              {t("edit_invoice_add_row_button")}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 hover:opacity-100 transition-opacity duration-300" />
          </Button>
        </div>
      )}
    </div>
  );
}
