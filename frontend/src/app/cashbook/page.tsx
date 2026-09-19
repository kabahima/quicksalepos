"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { loadSettings } from "@/lib/settings";
import { ChevronDown } from "lucide-react";

interface CashBookEntry {
  id: number;
  date: string;
  transaction_type: string;
  description: string;
  amount: string;
  reference_id?: number;
  reference_model?: string;
  created_by?: { username: string };
  created_at: string;
  sale_details?: {
    receipt_number: string;
    seller: string | null;
    customer: string | null;
    payment_method: string;
    total_amount: string;
    sold_at: string;
    notes: string;
    items: Array<{
      item_name: string;
      quantity: string;
      unit: string;
      unit_price: string;
      total: string;
    }>;
  } | null;
}

export default function CashbookPage() {
  const [entries, setEntries] = useState<CashBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const fetchCashbook = async () => {
    setLoading(true);
    try {
      const response = await api.get("/cashbook/");
      setEntries(response.data.results || response.data);
    } catch (error) {
      console.warn("Failed to fetch cashbook", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (createdAt: string) =>
    new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const getReceiptNumber = (entry: CashBookEntry) => {
    if (entry.transaction_type !== "sale") return null;
    return entry.description.match(/RCP-[A-Z0-9]+/)?.[0] || null;
  };

  const groupedEntries = entries.reduce<Record<string, CashBookEntry[]>>((groups, entry) => {
    groups[entry.date] ??= [];
    groups[entry.date].push(entry);
    return groups;
  }, {});

  const toggleDate = (date: string) => {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  useEffect(() => {
    const s = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s.currency_symbol) setCurrencySymbol(s.currency_symbol);
    fetchCashbook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Cash Book</h1>

      <div className="rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">No entries found</td>
                </tr>
              ) : (
                Object.entries(groupedEntries).map(([date, dateEntries]) => {
                  const isExpanded = expandedDates.has(date);
                  const dayTotal = dateEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
                  return (
                    <Fragment key={date}>
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="p-0">
                        <button
                          type="button"
                          onClick={() => toggleDate(date)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-gray-100"
                        >
                          <span className="flex items-center gap-2 font-semibold text-gray-800">
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            {date}
                            <span className="text-xs font-normal text-gray-500">{dateEntries.length} transaction{dateEntries.length === 1 ? "" : "s"}</span>
                          </span>
                          <span className="font-semibold text-green-700">{dayTotal >= 0 ? "+" : "-"}{currencySymbol}{Math.abs(dayTotal).toFixed(2)}</span>
                        </button>
                      </td>
                    </tr>
                    {isExpanded && dateEntries.map((entry) => {
                      const receiptNumber = getReceiptNumber(entry);
                      return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{entry.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{formatTime(entry.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${["sale", "customer_payment", "other_income"].includes(entry.transaction_type) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {entry.transaction_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {entry.sale_details ? (
                          <div className="space-y-1">
                            {entry.sale_details.items.map((item) => (
                              <div key={`${entry.id}-${item.item_name}`}>
                                {item.item_name} ({item.quantity} {item.unit}) x {currencySymbol}{parseFloat(item.unit_price).toFixed(2)} = {currencySymbol}{parseFloat(item.total).toFixed(2)}
                              </div>
                            ))}
                            <div className="text-xs text-gray-500">
                              {entry.sale_details.payment_method.replace(/_/g, " ")}
                              {entry.sale_details.customer ? ` · ${entry.sale_details.customer}` : ""}
                              {entry.sale_details.notes ? ` · ${entry.sale_details.notes}` : ""}
                            </div>
                          </div>
                        ) : entry.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {entry.reference_model && entry.reference_id
                          ? `${entry.reference_model.replace(/_/g, " ")} #${entry.reference_id}`
                          : entry.reference_model || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {entry.sale_details?.seller || entry.created_by?.username || "-"}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold text-right whitespace-nowrap ${parseFloat(entry.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {receiptNumber ? <Link href={`/receipts?receipt=${encodeURIComponent(receiptNumber)}`} className="mr-3 text-[#f53f64] hover:underline">Receipt</Link> : null}
                        {parseFloat(entry.amount) >= 0 ? "+" : "-"}{currencySymbol}{Math.abs(parseFloat(entry.amount)).toFixed(2)}
                      </td>
                    </tr>
                      );
                    })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
