"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Package } from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const reports = [
    { name: "Sales Report", href: "/reports/sales", icon: TrendingUp, description: "View sales performance" },
    { name: "Expenses Report", href: "/reports/expenses", icon: TrendingDown, description: "View expense breakdown" },
    { name: "Profit Report", href: "/reports/profit", icon: BarChart3, description: "View profit margins" },
    { name: "Stock Report", href: "/reports/stock", icon: Package, description: "View stock levels" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Reports</h1>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold mb-4">Date Range Filter</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {reports.map((report) => (
          <Link
            key={report.name}
            href={report.href}
            className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{report.name}</p>
                <p className="mt-2 text-sm text-gray-500">{report.description}</p>
              </div>
              <report.icon className="h-8 w-8 text-indigo-600" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
