"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import api from "@/lib/api";
import { loadSettings, formatCurrency } from "@/lib/settings";

interface Receipt {
  id: number;
  sale: {
    receipt_number: string;
    date: string;
    total_amount: string;
    created_at?: string | null;
    items?: Array<{
      item_name: string;
      quantity: string;
      unit: string;
      unit_price: string;
      total: string;
    }>;
  };
  pdf_file: string | null;
  sent_email: boolean;
}

type DateFilter = "all" | "today" | "7d" | "30d";
type EmailFilter = "all" | "sent" | "unsent";

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

const EMAIL_OPTIONS: { value: EmailFilter; label: string }[] = [
  { value: "all", label: "All Emails" },
  { value: "sent", label: "Emailed" },
  { value: "unsent", label: "Not Emailed" },
];

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("all");
  const [currencySymbol, setCurrencySymbol] = useState(() =>
    loadSettings().currency_symbol || "UGX ",
  );
  const [expandedReceiptId, setExpandedReceiptId] = useState<number | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const response = await api.get("/receipts/");
      setReceipts(response.data.results || response.data);
    } catch (error) {
      console.warn("Failed to fetch receipts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const s = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s.currency_symbol) setCurrencySymbol(s.currency_symbol);

    const urlReceipt =
      new URLSearchParams(window.location.search).get("receipt") || "";
    setSearchText(urlReceipt);

    fetchReceipts();
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const getDateThreshold = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };

  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((receipt) => {
        if (searchText) {
          const term = searchText.toLowerCase();
          const matchesNumber =
            receipt.sale.receipt_number.toLowerCase().includes(term);
          const matchesItems =
            receipt.sale.items?.some((item) =>
              item.item_name.toLowerCase().includes(term),
            ) ?? false;
          if (!matchesNumber && !matchesItems) return false;
        }

        if (dateFilter !== "all") {
          const saleDate = receipt.sale.date;
          const threshold =
            dateFilter === "today"
              ? todayStr
              : getDateThreshold(dateFilter === "7d" ? 7 : 30);
          if (saleDate < threshold) return false;
        }

        if (emailFilter === "sent" && !receipt.sent_email) return false;
        if (emailFilter === "unsent" && receipt.sent_email) return false;

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.sale.date).getTime() - new Date(a.sale.date).getTime(),
      );
  }, [receipts, searchText, dateFilter, emailFilter, todayStr]);

  const formatTime = (createdAt?: string | null) => {
    if (!createdAt) return "-";
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Receipts</h1>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by receipt # or item..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="block w-full rounded-md border border-[#eeeeee] bg-[#f7f8fa] pl-10 pr-3 py-2 text-sm outline-none focus:border-[#f53f64] focus:ring-1 focus:ring-[#f53f64]"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        </div>

        <div className="flex gap-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="rounded-md border border-[#eeeeee] bg-[#f7f8fa] px-3 py-2 text-sm outline-none focus:border-[#f53f64] focus:ring-1 focus:ring-[#f53f64]"
          >
            {DATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as EmailFilter)}
            className="rounded-md border border-[#eeeeee] bg-[#f7f8fa] px-3 py-2 text-sm outline-none focus:border-[#f53f64] focus:ring-1 focus:ring-[#f53f64]"
          >
            {EMAIL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results summary */}
      <p className="text-sm text-gray-500">
        {filteredReceipts.length} receipt
        {filteredReceipts.length === 1 ? "" : "s"} found
      </p>

      {/* Table */}
      <div className="rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Receipt #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Items Sold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  PDF
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Emailed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No receipts found
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((receipt) => (
                  <Fragment key={receipt.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {receipt.sale.receipt_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {receipt.sale.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {formatTime(receipt.sale.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="space-y-1">
                          {(receipt.sale.items ?? []).length === 0 ? (
                            "-"
                          ) : (
                            (receipt.sale.items ?? []).map((item) => (
                              <div
                                key={`${receipt.id}-${item.item_name}`}
                              >
                                {item.item_name} ({item.quantity}{" "}
                                {item.unit}) x{" "}
                                {formatCurrency(
                                  parseFloat(item.unit_price),
                                  currencySymbol,
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        {formatCurrency(
                          parseFloat(receipt.sale.total_amount),
                          currencySymbol,
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {receipt.pdf_file ? (
                          <a
                            href={receipt.pdf_file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-indigo-600 hover:text-indigo-900"
                          >
                            <Download className="mr-1 h-4 w-4" />
                            Download
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedReceiptId(
                                expandedReceiptId === receipt.id
                                  ? null
                                  : receipt.id,
                              )
                            }
                            className="text-indigo-600 hover:text-indigo-900 hover:underline"
                          >
                            {expandedReceiptId === receipt.id
                              ? "Hide details"
                              : "View details"}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {receipt.sent_email ? "Yes" : "No"}
                      </td>
                    </tr>
                    {expandedReceiptId === receipt.id && (
                      <tr>
                        <td
                          colSpan={7}
                          className="bg-gray-50 px-6 py-4 text-sm text-gray-700"
                        >
                          <p className="mb-2 font-semibold">Receipt details</p>
                          {receipt.sale.items?.length ? (
                            <div className="space-y-1">
                              {receipt.sale.items.map((item) => (
                                <div
                                  key={`${receipt.id}-detail-${item.item_name}`}
                                >
                                  {item.item_name}: {item.quantity}{" "}
                                  {item.unit} x{" "}
                                  {formatCurrency(
                                    parseFloat(item.unit_price),
                                    currencySymbol,
                                  )}{" "}
                                  ={" "}
                                  {formatCurrency(
                                    parseFloat(item.total),
                                    currencySymbol,
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>No item details recorded.</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
