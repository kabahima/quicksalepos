"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";

interface StockReportData {
  by_date: Array<{ date: string; total_difference: number; count: number }>;
  by_product: Array<{ product_name: string; total_difference: number; total_sold: number }>;
}

function StockReportInner() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [data, setData] = useState<StockReportData | null>(null);
  const [loading, setLoading] = useState(true);

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
      const response = await api.get("/reports/stock/", { params });
      setData(response.data);
    } catch (error) {
      console.warn("Failed to fetch stock report", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-64">Failed to load report</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Stock Report</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">By Date</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.by_date.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
              ) : data.by_date.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.date}</td>
                  <td className="px-4 py-3 text-gray-700">{row.count}</td>
                  <td className={`px-4 py-3 font-semibold ${row.total_difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {row.total_difference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">By Product</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Sold</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.by_product.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
              ) : data.by_product.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-3 text-gray-700">{Number(row.total_sold).toFixed(2)}</td>
                  <td className={`px-4 py-3 font-semibold ${row.total_difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {row.total_difference}
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

export default function StockReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <StockReportInner />
    </Suspense>
  );
}
