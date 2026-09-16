"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";

interface SalesReportData {
  daily: Array<{ date: string; total: number; count: number }>;
  monthly: Array<{ date__year: number; date__month: number; total: number; count: number }>;
}

function SalesReportInner() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [data, setData] = useState<SalesReportData | null>(null);
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
      const response = await api.get("/reports/sales/", { params });
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch sales report", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-64">Failed to load report</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Sales Report</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Daily Sales</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Count</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.daily.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
              ) : data.daily.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.date}</td>
                  <td className="px-4 py-3 text-gray-700">{row.count}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">${Number(row.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Monthly Sales</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Count</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.monthly.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">No data</td></tr>
              ) : data.monthly.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.date__year}</td>
                  <td className="px-4 py-3 text-gray-700">{row.date__month}</td>
                  <td className="px-4 py-3 text-gray-700">{row.count}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">${Number(row.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SalesReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <SalesReportInner />
    </Suspense>
  );
}
