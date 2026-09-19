"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { loadSettings } from "@/lib/settings";

interface Sale {
  id: number;
  receipt_number: string;
  date: string;
  customer: string | null;
  total_amount: string;
  payment_method: string;
  created_at?: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async (retryCount = 0) => {
    setLoading(true);
    try {
      const response = await api.get("/sales/");
      setSales(response.data.results || response.data || []);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; code?: string };
      const isNetworkError = !err?.response || err?.code === "ERR_NETWORK" || err?.code === "ERR_CLOSED";
      if (isNetworkError && retryCount < 2) {
        setTimeout(() => fetchSales(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        console.warn("Failed to fetch sales", error);
        setSales([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(
    (sale) =>
      sale.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
      (sale.customer && sale.customer.toLowerCase().includes(search.toLowerCase()))
  );

  const groupedSales = filteredSales.reduce<Record<string, Sale[]>>((groups, sale) => {
    groups[sale.date] ??= [];
    groups[sale.date].push(sale);
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

  const formatTime = (createdAt?: string) => {
    if (!createdAt) return "-";
    const time = new Date(createdAt);
    return Number.isNaN(time.getTime())
      ? "-"
      : time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#252525]">Sales</h1>
        <Link href="/sales/new" className="flex items-center rounded-md bg-[#f53f64] px-4 py-2 text-white hover:bg-[#e03050]">
          <Plus className="mr-2 h-4 w-4" />
          New Sale
        </Link>
      </div>

      <div className="rounded-lg bg-white shadow border border-[#eeeeee]">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
            <input
              type="text"
              placeholder="Search sales..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-[#eeeeee] pl-10 pr-4 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#eeeeee]">
            <thead className="bg-[#fff6f7]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Receipt #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Payment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeeeee]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-[#999999]">Loading...</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-[#999999]">No sales found</td>
                </tr>
              ) : (
                Object.entries(groupedSales).map(([date, dateSales]) => {
                  const isExpanded = expandedDates.has(date);
                  const dayTotal = dateSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
                  return (
                    <Fragment key={date}>
                      <tr className="bg-[#fff6f7]">
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => toggleDate(date)}
                            aria-expanded={isExpanded}
                            className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-[#ffecef]"
                          >
                            <span className="flex items-center gap-2 font-semibold text-[#252525]">
                              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              {date}
                              <span className="text-xs font-normal text-[#999999]">{dateSales.length} sale{dateSales.length === 1 ? "" : "s"}</span>
                            </span>
                            <span className="font-semibold text-[#252525]">{currencySymbol}{dayTotal.toFixed(2)}</span>
                          </button>
                        </td>
                      </tr>
                      {isExpanded && dateSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-[#fff6f7]">
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-[#252525]">{sale.receipt_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-[#999999]">{formatTime(sale.created_at)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-[#999999]">{sale.customer || "-"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-[#999999]">{sale.payment_method}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold text-[#252525]">{currencySymbol}{parseFloat(sale.total_amount).toFixed(2)}</td>
                        </tr>
                      ))}
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
