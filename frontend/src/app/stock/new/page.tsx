"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

const UNITS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "packets", label: "Packets" },
  { value: "litres", label: "Litres (L)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "bags", label: "Bags" },
  { value: "boxes", label: "Boxes" },
  { value: "bottles", label: "Bottles" },
  { value: "bundles", label: "Bundles" },
  { value: "dozen", label: "Dozen" },
  { value: "meters", label: "Meters" },
  { value: "rolls", label: "Rolls" },
  { value: "sheets", label: "Sheets" },
  { value: "tonnes", label: "Tonnes" },
  { value: "sets", label: "Sets" },
  { value: "pairs", label: "Pairs" },
  { value: "other", label: "Other" },
];

interface CategoryItem { id: number; name: string }
interface BrandItem { id: number; name: string }

export default function NewProductPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("5");
  const [openingStock, setOpeningStock] = useState("0");
  const [stockAdded, setStockAdded] = useState("0");
  const [physicalCount, setPhysicalCount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const res = await api.get("/businesses/");
        const businesses = res.data.results || res.data;
        if (Array.isArray(businesses) && businesses.length > 0) {
          const bid = String(businesses[0].id);
          setBusinessId(bid);
          const [catRes, brandRes] = await Promise.all([
            api.get("/product-categories/", { params: { business: bid } }),
            api.get("/brands/", { params: { business: bid } }),
          ]);
          setCategories((catRes.data.results || catRes.data).sort((a: CategoryItem, b: CategoryItem) => a.name.localeCompare(b.name)));
          setBrands((brandRes.data.results || brandRes.data).sort((a: BrandItem, b: BrandItem) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error("Failed to load data", err);
      }
    };
    loadBusiness();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      setError("No business found. Please create a business first.");
      return;
    }
    setLoading(true);
    setError("");

    const opening = parseFloat(openingStock) || 0;
    const added = parseFloat(stockAdded) || 0;
    const physical = physicalCount !== "" ? parseFloat(physicalCount) : opening + added;

    try {
      await api.post("/stock-counts/", {
        business: parseInt(businessId),
        date: new Date().toISOString().split("T")[0],
        product_name: productName.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        category: category || "other",
        brand: brand || "generic",
        unit,
        cost_price: parseFloat(costPrice) || 0,
        unit_price: parseFloat(unitPrice) || 0,
        reorder_level: parseFloat(reorderLevel) || 0,
        opening_stock: opening,
        stock_added: added,
        quantity_sold: 0,
        physical_count: physical,
        notes,
      });
      router.push("/stock");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      setError(msg ? JSON.stringify(msg) : "Failed to add product. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async () => {
    if (!newCategory.trim() || !businessId) return;
    setAddingCategory(true);
    try {
      const res = await api.post("/product-categories/", { name: newCategory.trim(), business: parseInt(businessId) });
      setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategory(res.data.name);
      setNewCategory("");
    } catch {
      setError("Failed to create category.");
    } finally {
      setAddingCategory(false);
    }
  };

  const createBrand = async () => {
    if (!newBrand.trim() || !businessId) return;
    setAddingBrand(true);
    try {
      const res = await api.post("/brands/", { name: newBrand.trim(), business: parseInt(businessId) });
      setBrands((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setBrand(res.data.name);
      setNewBrand("");
    } catch {
      setError("Failed to create brand.");
    } finally {
      setAddingBrand(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/stock" className="p-2 text-[#999999] hover:text-[#252525] hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#252525]">Add Product</h1>
          <p className="text-xs text-[#999999]">Add a new item to your inventory</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product identity */}
        <div className="bg-white rounded-xl border border-[#eeeeee] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#252525]">Product Details</h2>
          <div>
            <label className="block text-sm font-medium text-[#252525] mb-1">
              Product Name <span className="text-[#f53f64]">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Sugar, Rice 2kg, Coca-Cola 500ml"
              className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">
                Category <span className="text-[#f53f64]">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); if (e.target.value !== "__add__") setNewCategory(""); }}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64] bg-white"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value="__add__">+ Add new category</option>
              </select>
              {category === "__add__" && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    className="flex-1 rounded-xl border border-[#eeeeee] px-3 py-2 text-sm outline-none focus:border-[#f53f64]"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createCategory())}
                  />
                  <button type="button" onClick={createCategory} disabled={addingCategory}
                    className="px-3 py-2 bg-[#f53f64] text-white text-xs font-semibold rounded-xl hover:bg-[#e03050] disabled:opacity-50">
                    {addingCategory ? "..." : "Add"}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">
                Brand <span className="text-[#f53f64]">*</span>
              </label>
              <select
                value={brand}
                onChange={(e) => { setBrand(e.target.value); if (e.target.value !== "__add__") setNewBrand(""); }}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64] bg-white"
              >
                <option value="">Select brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
                <option value="__add__">+ Add new brand</option>
              </select>
              {brand === "__add__" && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="New brand name"
                    className="flex-1 rounded-xl border border-[#eeeeee] px-3 py-2 text-sm outline-none focus:border-[#f53f64]"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createBrand())}
                  />
                  <button type="button" onClick={createBrand} disabled={addingBrand}
                    className="px-3 py-2 bg-[#f53f64] text-white text-xs font-semibold rounded-xl hover:bg-[#e03050] disabled:opacity-50">
                    {addingBrand ? "..." : "Add"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#252525] mb-1">
              Unit of Measure <span className="text-[#f53f64]">*</span>
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64] bg-white"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#252525] mb-1">
              Selling Price / Unit <span className="text-[#f53f64]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#999999]">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-[#eeeeee] text-sm outline-none focus:border-[#f53f64] focus:ring-1 focus:ring-[#f53f64]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#252525]">Cost Price / Unit</label>
              <input type="number" min={0} step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#252525]">Reorder Level</label>
              <input type="number" min={0} step="0.01" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
            </div>
          </div>
        </div>

        {/* Stock quantities */}
        <div className="bg-white rounded-xl border border-[#eeeeee] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#252525]">Opening Stock</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Opening Stock</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525] mb-1">Stock Added Today</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={stockAdded}
                onChange={(e) => setStockAdded(e.target.value)}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#252525] mb-1">
                Physical Count{" "}
                <span className="text-[#999999] font-normal">
                  (leave blank to auto-calculate)
                </span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={physicalCount}
                onChange={(e) => setPhysicalCount(e.target.value)}
                placeholder={`${(parseFloat(openingStock) || 0) + (parseFloat(stockAdded) || 0)}`}
                className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-[#eeeeee] p-5">
          <label className="block text-sm font-medium text-[#252525] mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this product..."
            className="w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <Link
            href="/stock"
            className="flex-1 text-center py-3 rounded-xl border border-[#eeeeee] text-sm font-medium text-[#252525] hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !businessId}
            className="flex-1 rounded-xl bg-[#f53f64] py-3 text-sm font-bold text-white hover:bg-[#e03050] disabled:opacity-40 transition"
          >
            {loading ? "Adding..." : "Add Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
