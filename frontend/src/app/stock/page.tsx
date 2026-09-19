"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Package } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { loadSettings } from "@/lib/settings";

interface Product {
  id: number;
  date: string;
  product_name: string;
  sku: string;
  barcode: string;
  category: string;
  category_display: string;
  brand: string;
  brand_display: string;
  unit: string;
  unit_display: string;
  cost_price: string;
  unit_price: string;
  reorder_level: number;
  opening_stock: number;
  stock_added: number;
  quantity_sold: number;
  expected_stock: number;
  physical_count: number;
  difference: number;
}

const UNIT_LABELS: Record<string, string> = {
  pcs: "pcs", kg: "kg", g: "g", packets: "pkts",
  litres: "L", ml: "ml", bags: "bags", boxes: "boxes",
  bottles: "btl", bundles: "bndl", dozen: "doz", meters: "m", rolls: "rolls",
  sheets: "sheets", tonnes: "t", sets: "sets", pairs: "pairs", other: "",
};

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");

  useEffect(() => {
    const load = async () => {
      try {
        const bizRes = await api.get("/businesses/");
        const businesses = bizRes.data.results || bizRes.data;
        if (Array.isArray(businesses) && businesses.length > 0) {
          const bid = String(businesses[0].id);
          setBusinessId(bid);
          fetchProducts(bid);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fetchProducts = async (bid: string) => {
    setLoading(true);
    try {
      const response = await api.get("/stock-counts/", { params: { business: bid } });
      const data: Product[] = response.data.results || response.data;

      // deduplicate — keep the most recent per product
      const sorted = [...data].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const seen = new Set<string>();
      const unique: Product[] = [];
      for (const item of sorted) {
        const key = item.product_name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }
      setProducts(unique);
    } catch (error) {
      console.warn("Failed to fetch products", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalProducts = products.length;
  const lowStock = products.filter((p) => p.physical_count <= p.reorder_level).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#252525]">Products</h1>
          <p className="text-sm text-[#999999] mt-1">
            {totalProducts} products · {lowStock} low stock
          </p>
        </div>
        <Link
          href="/stock/new"
          className="flex items-center gap-2 rounded-xl bg-[#f53f64] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e03050] transition"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999999]" />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-[#eeeeee] rounded-xl text-sm outline-none focus:border-[#f53f64] bg-white"
        />
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-[#f53f64] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-[#999999]">
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm">No products yet</p>
          <Link href="/stock/new" className="text-xs text-[#f53f64] hover:underline">
            Add your first product
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => {
            const unitLabel = UNIT_LABELS[product.unit] || product.unit;
            const stockNum = Number(product.physical_count);
            const isLow = stockNum <= Number(product.reorder_level);
            const isOut = stockNum <= 0;
            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-[#eeeeee] p-4 space-y-3 hover:shadow-sm transition"
              >
                {/* Icon + name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#fff6f7] flex items-center justify-center text-lg font-bold text-[#f53f64] flex-shrink-0">
                      {product.product_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#252525] leading-4 truncate">
                        {product.product_name}
                      </p>
                      <p className="text-xs text-[#999999] mt-0.5">{product.category_display || product.category} · {product.brand_display || product.brand}</p>
                      <p className="text-[11px] text-[#999999] mt-0.5">{product.sku || "No SKU"}{product.barcode ? ` · ${product.barcode}` : ""}</p>
                    </div>
                  </div>
                  <Link
                    href={`/stock/${product.id}/edit`}
                    className="p-1.5 text-[#999999] hover:text-[#f53f64] hover:bg-[#fff6f7] rounded-lg transition flex-shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>

{/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#252525]">
                      {currencySymbol}{Number(product.unit_price).toFixed(2)}
                    </span>
                  <span className="text-xs text-[#999999]">/ {unitLabel} · reorder at {product.reorder_level}</span>
                </div>

                {/* Stock bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#999999]">Stock</span>
                    <span className={`font-semibold ${isOut ? "text-red-500" : isLow ? "text-orange-500" : "text-[#00C49F]"}`}>
                      {isOut ? "Out of stock" : isLow ? "Low" : "In stock"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[#999999]">Current</p>
                      <p className="font-bold text-[#252525]">{stockNum} {unitLabel}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[#999999]">Sold</p>
                      <p className="font-bold text-[#252525]">{Number(product.quantity_sold)} {unitLabel}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[#999999]">Added</p>
                      <p className="font-bold text-[#252525]">{Number(product.stock_added)} {unitLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Sell button */}
                <Link
                  href={`/sales/pos?product=${encodeURIComponent(product.product_name)}`}
                  className="flex items-center justify-center w-full py-2 rounded-xl bg-[#f53f64] text-white text-xs font-semibold hover:bg-[#e03050] transition"
                >
                  Sell
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
