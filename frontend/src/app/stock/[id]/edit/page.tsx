"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

const UNITS = [
  { value: "pcs",     label: "Pieces (pcs)" },
  { value: "kg",      label: "Kilograms (kg)" },
  { value: "g",       label: "Grams (g)" },
  { value: "packets", label: "Packets" },
  { value: "litres",  label: "Litres (L)" },
  { value: "ml",      label: "Millilitres (ml)" },
  { value: "bags",    label: "Bags" },
  { value: "boxes",   label: "Boxes" },
  { value: "bottles", label: "Bottles" },
  { value: "bundles", label: "Bundles" },
  { value: "dozen",   label: "Dozen" },
  { value: "meters",  label: "Meters" },
  { value: "rolls",   label: "Rolls" },
  { value: "sheets",  label: "Sheets" },
  { value: "tonnes",  label: "Tonnes" },
  { value: "sets",    label: "Sets" },
  { value: "pairs",   label: "Pairs" },
  { value: "other",   label: "Other" },
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id     = params?.id as string;

  const [productName,   setProductName]   = useState("");
  const [sku,           setSku]           = useState("");
  const [barcode,       setBarcode]       = useState("");
  const [unit,          setUnit]          = useState("pcs");
  const [costPrice,     setCostPrice]     = useState("0");
  const [unitPrice,     setUnitPrice]     = useState("");
  const [reorderLevel,  setReorderLevel]  = useState("5");
  const [physicalCount, setPhysicalCount] = useState("");
  const [stockAdded,    setStockAdded]    = useState("0");
  const [notes,         setNotes]         = useState("");
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  useEffect(() => {
    if (!id) return;
    api.get(`/stock-counts/${id}/`).then((r) => {
      const d = r.data;
      setProductName(d.product_name || "");
      setSku(d.sku || "");
      setBarcode(d.barcode || "");
      setUnit(d.unit || "pcs");
      setCostPrice(String(d.cost_price || "0"));
      setUnitPrice(String(d.unit_price || "0"));
      setReorderLevel(String(d.reorder_level ?? "5"));
      setPhysicalCount(String(d.physical_count || "0"));
      setStockAdded("0");
      setNotes(d.notes || "");
    }).catch(() => setError("Failed to load product."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch(`/stock-counts/${id}/`, {
        product_name:   productName.trim(),
        sku:            sku.trim(),
        barcode:        barcode.trim(),
        unit,
        cost_price:     parseFloat(costPrice) || 0,
        unit_price:     parseFloat(unitPrice) || 0,
        reorder_level:  parseFloat(reorderLevel) || 0,
        physical_count: parseFloat(physicalCount) || 0,
        stock_added:    parseFloat(stockAdded) || 0,
        notes,
      });
      router.push("/stock");
    } catch {
      setError("Failed to update product.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-[#f53f64] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/stock"
          className="p-2 text-[#999999] hover:text-[#252525] hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#252525]">Edit Product</h1>
          <p className="text-xs text-[#999999]">Update product details and stock</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-[#eeeeee] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#252525]">Product Details</h2>
          <div>
            <label className="block text-sm font-medium text-[#252525] mb-1">Product Name</label>
            <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
              className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]"
              required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Barcode</label>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64] bg-white">
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Selling Price / Unit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#999999]">$</span>
                <input type="number" min={0} step="0.01" value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-[#eeeeee] text-sm outline-none focus:border-[#f53f64]"
                  required />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Cost Price / Unit</label>
              <input type="number" min={0} step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Reorder Level</label>
              <input type="number" min={0} step="0.01" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#eeeeee] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#252525]">Stock Update</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Current Physical Count</label>
              <input type="number" min={0} step="0.01" value={physicalCount}
                onChange={(e) => setPhysicalCount(e.target.value)}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Stock Added</label>
              <input type="number" min={0} step="0.01" value={stockAdded}
                onChange={(e) => setStockAdded(e.target.value)}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#eeeeee] p-5">
          <label className="block text-sm font-medium text-[#252525] mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
        </div>

        <div className="flex gap-3">
          <Link href="/stock"
            className="flex-1 text-center py-3 rounded-xl border border-[#eeeeee] text-sm font-medium text-[#252525] hover:bg-gray-50 transition">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-xl bg-[#f53f64] py-3 text-sm font-bold text-white hover:bg-[#e03050] disabled:opacity-40 transition">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
