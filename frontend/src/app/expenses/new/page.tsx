"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/db";
import { useOnlineStatus } from "@/lib/offline";

interface ExpenseCategory {
  id: number;
  name: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const online = useOnlineStatus();

  useEffect(() => {
    const loadBusinessAndCategories = async () => {
      try {
        // Businesses — cache-first
        let bizList: Array<{ id: number }> | null =
          await cacheGet<typeof bizList>("businesses").catch(() => null);
        if (!bizList) {
          const bizRes = await api.get("/businesses/");
          bizList = bizRes.data.results || bizRes.data;
          if (bizList) await cacheSet("businesses", bizList).catch(() => {});
        }
        if (Array.isArray(bizList) && bizList.length > 0) {
          setBusinessId(String(bizList[0].id));
        }

        // Expense categories — cache-first
        let cats: ExpenseCategory[] | null =
          await cacheGet<ExpenseCategory[]>("expense-categories").catch(() => null);
        if (!cats) {
          const catRes = await api.get("/expense-categories/");
          cats = catRes.data.results || catRes.data;
          if (cats) await cacheSet("expense-categories", cats).catch(() => {});
        }
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (err) {
        console.warn("Failed to load initial data", err);
      }
    };
    loadBusinessAndCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        business: parseInt(businessId),
        date,
        category: categoryId ? parseInt(categoryId) : null,
        description,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        notes,
      };

      if (!online) {
        const { queuePush } = await import("@/lib/db");
        await queuePush({
          method: "POST",
          url: "/expenses/",
          payload,
          label: `Expense · ${description || "untitled"}`,
          localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        router.push("/expenses");
        return;
      }

      await api.post("/expenses/", payload);
      router.push("/expenses");
    } catch (err) {
      const offlineErr = err as { isOfflineQueued?: boolean };
      if (offlineErr?.isOfflineQueued) { router.push("/expenses"); return; }
      setError("Failed to create expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/expenses" className="flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">New Expense</h1>
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
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">— No category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
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
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
            </select>
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
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            rows={3}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : !online ? "Save offline" : "Create Expense"}
          </button>
        </div>
      </form>
    </div>
  );
}
