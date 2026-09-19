"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

export default function NewCashbookPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [transactionType, setTransactionType] = useState("sale");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [referenceModel, setReferenceModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const res = await api.get("/businesses/");
        const businesses = res.data.results || res.data;
        if (Array.isArray(businesses) && businesses.length > 0) {
          setBusinessId(String(businesses[0].id));
        }
      } catch (err) {
        console.warn("Failed to load business", err);
      }
    };
    loadBusiness();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!businessId || isNaN(parseInt(businessId))) {
      setError("Invalid business. Please refresh and try again.");
      setLoading(false);
      return;
    }

    try {
      await api.post("/cashbook/", {
        business: parseInt(businessId),
        date,
        transaction_type: transactionType,
        description,
        amount: parseFloat(amount),
        reference_id: referenceId || null,
        reference_model: referenceModel || null,
      });
      router.push("/cashbook");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      setError(msg ? JSON.stringify(msg) : "Failed to create cashbook entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/cashbook" className="flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">New Cashbook Entry</h1>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Transaction Type</label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
            <option value="sale">Sale</option>
              <option value="expense">Expense</option>
              <option value="customer_payment">Customer Payment</option>
              <option value="supplier_payment">Supplier Payment</option>
              <option value="other_income">Other Income</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reference ID</label>
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reference Model</label>
            <input
              type="text"
              value={referenceModel}
              onChange={(e) => setReferenceModel(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            rows={3}
            required
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Create Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
