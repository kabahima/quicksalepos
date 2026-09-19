"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { loadSettings } from "@/lib/settings";

interface ProfitReportData {
  total_sales: number;
  total_expenses: number;
  profit: number;
  daily_profit: Array<{ date: string; sales: number; expenses: number; profit: number }>;
}

function ProfitReportInner() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [data, setData] = useState<ProfitReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const res = await api.get("/businesses/");
        const businesses = res.data.results || res.data;
        if (Array.isArray(businesses) && businesses.length > 0) {
          setBusinessId(String(businesses[0].id));
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };
    loadBusiness();
  }, []);

  useEffect(() => {
    if (!businessId) return;
    fetchReport();
  }, [businessId, startDate, endDate]);

  const fetchReport = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { business: businessId };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const response = await api.get("/reports/profit/", { params });
      setData(response.data);
    } catch (error) {
      console.warn("Failed to fetch profit report", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-64">Failed to load report</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Profit Report</h1>
      <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-600">Total Sales</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{currencySymbol}{data.total_sales.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-600">Total Expenses</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{currencySymbol}{data.total_expenses.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-600">Profit</p>
          <p className={`mt-2 text-2xl font-bold ${data.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {currencySymbol}{data.profit.toFixed(2)}
          </p>
        </div>
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Daily Profit</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expenses</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.daily_profit.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
              ) : data.daily_profit.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.date}</td>
                  <td className="px-4 py-3 text-gray-700">{currencySymbol}{row.sales.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-700">{currencySymbol}{row.expenses.toFixed(2)}</td>
                  <td className={`px-4 py-3 font-semibold ${row.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {currencySymbol}{row.profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ProfitReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <ProfitReportInner />
    </Suspense>
  );
}
