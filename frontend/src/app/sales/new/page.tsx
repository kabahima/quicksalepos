"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/db";
import { useOnlineStatus } from "@/lib/offline";
import { loadSettings } from "@/lib/settings";

interface SaleItem {
  item_name: string;
  quantity: number;
  unit_price: number;
}

function NewSaleInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProduct = searchParams.get("product") || "";

  const [businessId, setBusinessId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SaleItem[]>([{ item_name: prefillProduct, quantity: 1, unit_price: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const online = useOnlineStatus();
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        let bizList: Array<{ id: number }> | null =
          await cacheGet<typeof bizList>("businesses").catch(() => null);
        if (!bizList) {
          const res = await api.get("/businesses/");
          bizList = res.data.results || res.data;
          if (bizList) await cacheSet("businesses", bizList).catch(() => {});
        }
        if (Array.isArray(bizList) && bizList.length > 0) {
          setBusinessId(String(bizList[0].id));
        }
      } catch (err) {
        console.warn("Failed to load business", err);
      }
    };
    loadBusiness();
  }, []);

  const addItem = () => {
    setItems([...items, { item_name: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SaleItem, value: string | number) => {
    const newItems = [...items];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const filteredItems = items.filter((item) => item.item_name && item.quantity > 0);
    if (filteredItems.length === 0) {
      setError("Please add at least one item");
      setLoading(false);
      return;
    }

    const totalAmount = filteredItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    try {
      const payload = {
        business: parseInt(businessId),
        date: new Date().toISOString().split("T")[0],
        payment_method: paymentMethod,
        total_amount: totalAmount,
        notes,
        items: filteredItems.map((item) => ({
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })),
      };

      if (!online) {
        const { queuePush } = await import("@/lib/db");
        await queuePush({
          method: "POST",
          url: "/sales/",
          payload,
          label: `Sale · ${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""}`,
          localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        router.push("/receipts");
        return;
      }

      await api.post("/sales/", payload);
      router.push("/receipts");
    } catch (err) {
      const offlineErr = err as { isOfflineQueued?: boolean };
      if (offlineErr?.isOfflineQueued) { router.push("/receipts"); return; }
      setError("Failed to create sale");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/sales" className="flex items-center text-[#999999] hover:text-[#252525]">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-3xl font-bold text-[#252525]">New Sale</h1>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow border border-[#eeeeee]">
          <h2 className="mb-4 text-lg font-semibold text-[#252525]">Sale Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[#252525]">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank">Bank</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#252525]">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow border border-[#eeeeee]">
          <h2 className="mb-4 text-lg font-semibold text-[#252525]">Items</h2>
          {items.map((item, index) => (
            <div key={index} className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <input
                type="text"
                placeholder="Item name"
                value={item.item_name}
                onChange={(e) => updateItem(index, "item_name", e.target.value)}
                className="rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={item.quantity}
                min={1}
                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                className="rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
              />
              <input
                type="number"
                placeholder="Unit price"
                value={item.unit_price}
                min={0}
                step="0.01"
                onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                className="rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-sm text-[#f53f64] hover:text-[#e03050]">
            + Add Item
          </button>
        </div>

        <div className="rounded-lg bg-white p-6 shadow border border-[#eeeeee]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#252525]">Total</h2>
            <p className="text-2xl font-bold text-[#252525]">{currencySymbol}{totalAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !businessId}
            className="rounded-md bg-[#f53f64] px-6 py-2 text-white hover:bg-[#e03050] disabled:opacity-50 transition"
          >
            {loading ? "Saving..." : !online ? "Save offline" : "Create Sale"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewSalePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <NewSaleInner />
    </Suspense>
  );
}
