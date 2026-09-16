"use client";

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Minus, Plus, ShoppingCart, X,
  LogOut, ChevronDown, Package, Mail, MessageCircle,
} from "lucide-react";
import api from "@/lib/api";
import { loadSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";
import axios from "axios";

/* ─── types ─────────────────────────────────────────────────────────── */
interface StockItem {
  id: number;
  date: string;
  product_name: string;
  category: string;
  category_display: string;
  brand: string;
  brand_display: string;
  unit: string;
  unit_display: string;
  unit_price: string;
  physical_count: number;
  quantity_sold: number;
}

interface Product {
  id: number;
  name: string;
  unit: string;
  unitLabel: string;
  price: number;
  stock: number;
  category: string;
  categoryDisplay: string;
  brand: string;
  brandDisplay: string;
}

interface CustomerItem {
  id: number;
  name: string;
  outstanding_balance: number;
  credit_limit: number;
  available_credit: number;
}

interface CartItem extends Product {
  qty: number;
  salePrice: number;
}

interface ReceiptData {
  receiptNumber: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  customer: string;
  businessName: string;
  date: string;
  time: string;
}

const PAYMENT_METHODS = [
  { value: "cash",         label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank",         label: "Bank Transfer" },
  { value: "card",         label: "Card" },
  { value: "credit",       label: "Credit" },
];

const UNIT_SHORT: Record<string, string> = {
  pcs: "pcs", kg: "kg", g: "g", packets: "pkts",
  litres: "L", ml: "ml", bags: "bags", boxes: "boxes",
  bottles: "btl", bundles: "bndl", dozen: "doz", other: "",
};

/* ─── auto-print receipt (no modal) ─────────────────────────────────── */
function printReceipt(receipt: ReceiptData, settings: { symbol: string; footer: string; header: string; taxRate: number; showTax: boolean }) {
  const payLabel = PAYMENT_METHODS.find((m) => m.value === receipt.paymentMethod)?.label ?? receipt.paymentMethod;
  const sym = settings.symbol || "$";
  const taxLine = settings.showTax && settings.taxRate > 0
    ? `<div class="row"><span>Tax (${settings.taxRate}%)</span><span>${sym}${(receipt.total * settings.taxRate / 100).toFixed(2)}</span></div>`
    : "";

  const itemsHtml = receipt.items.map((item) => `
    <div>
      <div class="bold" style="font-size:11px">${item.name}</div>
      <div class="row" style="font-size:10px;color:#555">
        <span>${item.qty} ${item.unitLabel} &times; ${sym}${item.salePrice.toFixed(2)}</span>
        <span class="bold" style="color:#000">${sym}${(item.salePrice * item.qty).toFixed(2)}</span>
      </div>
    </div>`).join("");

  const barcode = Array.from({ length: 30 }).map((_, i) =>
    `<div style="display:inline-block;background:#000;width:${i % 3 === 0 ? 2 : 1}px;height:20px;margin:0 0.3px"></div>`
  ).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${receipt.receiptNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',Courier,monospace; font-size:12px; width:80mm; padding:4mm; color:#000; background:#fff; }
    .center { text-align:center; }
    .bold   { font-weight:bold; }
    .row    { display:flex; justify-content:space-between; margin:2px 0; }
    .dash   { border-top:1px dashed #000; margin:4px 0; }
    .solid  { border-top:1px solid #000; margin:4px 0; }
    @media print { @page { margin:0; size:80mm auto; } body { padding:2mm; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="bold" style="font-size:15px">${receipt.businessName}</div>
    ${settings.header ? `<div style="font-size:10px;color:#555;margin-top:2px">${settings.header}</div>` : ""}
    <div style="font-size:10px;color:#666;margin-top:2px">${receipt.date} &middot; ${receipt.time}</div>
  </div>
  <div class="dash"></div>
  <div class="row" style="font-size:10px"><span>Receipt #</span><span class="bold">${receipt.receiptNumber}</span></div>
  ${receipt.customer ? `<div class="row" style="font-size:10px"><span>Customer</span><span class="bold">${receipt.customer}</span></div>` : ""}
  <div class="dash"></div>
  <div style="line-height:1.6">${itemsHtml}</div>
  <div class="dash"></div>
  <div class="row" style="font-size:10px"><span>Items (${receipt.items.reduce((s, i) => s + i.qty, 0)})</span><span>${sym}${receipt.total.toFixed(2)}</span></div>
  <div class="row" style="font-size:10px"><span>Payment</span><span>${payLabel}</span></div>
  ${taxLine}
  <div class="solid"></div>
  <div class="row bold" style="font-size:14px"><span>TOTAL</span><span>${sym}${receipt.total.toFixed(2)}</span></div>
  <div class="dash" style="margin-top:8px"></div>
  <div class="center" style="font-size:10px;color:#555">${settings.footer || "Thank you for your purchase!"}</div>
  <div class="center" style="font-size:9px;color:#888;margin-top:2px">Powered by Quick Sale</div>
  <div class="center" style="margin-top:8px">${barcode}</div>
  <div class="center" style="font-size:8px;color:#888;margin-top:2px">${receipt.receiptNumber}</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=400,height=700");
  if (!win) return; // popup blocked — silently skip
  win.document.write(html);
  win.document.close();
  win.focus();
  // small delay lets the browser render before printing
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}

/* ─── generate plain-text receipt for WhatsApp ─────────────────────────── */
function generateReceiptText(receipt: ReceiptData, symbol: string): string {
  const payLabel =
    PAYMENT_METHODS.find((m) => m.value === receipt.paymentMethod)?.label ??
    receipt.paymentMethod;

  const lines: string[] = [];
  lines.push(`*${receipt.businessName}*`);
  lines.push(`*Receipt #${receipt.receiptNumber}*`);
  lines.push("");
  lines.push(`Date: ${receipt.date}`);
  lines.push(`Time: ${receipt.time}`);
  lines.push(`Payment: ${payLabel}`);
  if (receipt.customer) lines.push(`Customer: ${receipt.customer}`);
  lines.push("");
  lines.push("Items:");
  receipt.items.forEach((item) => {
    const itemTotal = item.salePrice * item.qty;
    lines.push(
      `  - ${item.name} (${item.qty} ${item.unitLabel}) x ${symbol}${item.salePrice.toFixed(2)} = ${symbol}${itemTotal.toFixed(2)}`,
    );
  });
  lines.push("");
  lines.push(`*TOTAL: ${symbol}${receipt.total.toFixed(2)}*`);
  lines.push("");
  lines.push("Thank you for your purchase!");
  lines.push("Powered by Quick Sale");
  return lines.join("\n");
}

/* ─── main POS ───────────────────────────────────────────────────────── */
function POSInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const prefill      = searchParams.get("product") || "";

  const [products,      setProducts]      = useState<Product[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [cart,          setCart]          = useState<CartItem[]>([]);
  const [search,        setSearch]        = useState("");
  const [stationId,    setStationId]    = useState<number | null>(null);
  const [stations,     setStations]     = useState<{ id: number; name: string }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customers,     setCustomers]     = useState<CustomerItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [businessId,    setBusinessId]    = useState("");
  const [businessName,  setBusinessName]  = useState("Quick Sale");
  const [role,          setRole]          = useState<string | null>(null);
  const [showCart,      setShowCart]      = useState(false);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const fullscreenPrompted = useRef(false);
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");
  const [displayMode] = useState<AppSettings["pos_display"]>(() => loadSettings().pos_display);
  const [theme] = useState<AppSettings["theme"]>(() => loadSettings().theme);
  const [receiptDelivery, setReceiptDelivery] = useState<"print" | "email" | "whatsapp">("print");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptWhatsapp, setReceiptWhatsapp] = useState("");

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  /* fullscreen toggle */
  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el).then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc).then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    // Browsers may reject this without a user gesture; the toolbar button remains available.
    if (!fullscreenPrompted.current && !document.fullscreenElement && !doc.webkitFullscreenElement) {
      fullscreenPrompted.current = true;
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el).catch(() => {});
    }

    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(localStorage.getItem("user_role"));
    const s = loadSettings();
    if (s.currency_symbol) setCurrencySymbol(s.currency_symbol);
    api.get("/businesses/").then((r) => {
      const list = r.data.results || r.data;
      if (Array.isArray(list) && list.length > 0) {
        const bid = String(list[0].id);
        setBusinessId(bid);
        setBusinessName(list[0].name || "Quick Sale");
        if (list[0].currency_symbol) setCurrencySymbol(list[0].currency_symbol);
        Promise.all([
          api.get("/stations/", { params: { business: bid } }),
          api.get("/customers/", { params: { business: bid } }),
        ]).then(([sr, cr]) => {
          const st = (sr.data.results || sr.data) as { id: number; name: string }[];
          setStations(st);
          if (st.length > 0 && !stationId) setStationId(st[0].id);
          const custs = (cr.data.results || cr.data).map((c: CustomerItem) => ({
            id: c.id,
            name: c.name,
            outstanding_balance: Number(c.outstanding_balance) || 0,
            credit_limit: Number(c.credit_limit) || 0,
            available_credit: Number(c.available_credit) || 0,
          }));
          setCustomers(custs);
        }).catch(() => {});
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* load products */
  useEffect(() => {
    if (!businessId) return;
    const load = async () => {
      setLoading(true);
      try {
        await api.post("/stock-counts/rollover/", { business: parseInt(businessId) }).catch(() => {});
        const res  = await api.get("/stock-counts/", { params: { business: businessId } });
        const data: StockItem[] = res.data.results || res.data;

        const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const seen   = new Set<string>();
        const list: Product[] = [];
        for (const item of sorted) {
          const key = item.product_name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const unit = item.unit || "pcs";
          list.push({
            id:        item.id,
            name:      item.product_name,
            unit,
            unitLabel: UNIT_SHORT[unit] ?? unit,
            price:     parseFloat(item.unit_price) || 0,
            stock:     Number(item.physical_count),
            category:  item.category_display || item.category,
            categoryDisplay: item.category_display || item.category,
            brand:     item.brand_display || item.brand,
            brandDisplay: item.brand_display || item.brand,
          });
        }
        setProducts(list);
      } catch (e) {
        console.error("Failed to load products", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId]);

  /* cart ops */
  const addToCart = (p: Product) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...p, qty: 1, salePrice: p.price }];
    });
  };

  const setQty   = (id: number, qty: number) => {
    if (qty <= 0) setCart((p) => p.filter((i) => i.id !== id));
    else setCart((p) => p.map((i) => i.id === id ? { ...i, qty } : i));
  };
  const setPrice = (id: number, val: number) =>
    setCart((p) => p.map((i) => i.id === id ? { ...i, salePrice: val } : i));
  const removeItem = (id: number) => setCart((p) => p.filter((i) => i.id !== id));

   useEffect(() => {
    if (!prefill || products.length === 0) return;
    const match = products.find((p) => p.name.toLowerCase().includes(prefill.toLowerCase()));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) addToCart(match);
  }, [prefill, products]);

  /* derived */
  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const subtotal  = cart.reduce((s, i) => s + i.salePrice * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  /* submit */
  const placeOrder = async () => {
    if (!cart.length || !businessId) return;
    const bad = cart.find((i) => i.salePrice <= 0);
    if (bad) { alert(`Set a price for "${bad.name}"`); return; }

    if (receiptDelivery === "email" && !receiptEmail.trim()) {
      alert("Please enter an email address for the receipt.");
      return;
    }
    if (receiptDelivery === "whatsapp" && !receiptWhatsapp.trim()) {
      alert("Please enter a WhatsApp number.");
      return;
    }

    if (paymentMethod === "credit" && !selectedCustomerId) {
      alert("Select a customer for credit payment.");
      return;
    }

    if (paymentMethod === "credit" && selectedCustomer) {
      const available = selectedCustomer.credit_limit - selectedCustomer.outstanding_balance;
      if (subtotal > available) {
        alert(`Credit limit exceeded. Available: ${currencySymbol}${available.toFixed(2)}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        business: parseInt(businessId, 10),
        ...(stationId ? { station: stationId } : {}),
        date: new Date().toISOString().split("T")[0],
        ...(selectedCustomerId
          ? { customer: selectedCustomerId }
          : {}),
        payment_method: paymentMethod,
        total_amount: Number(subtotal.toFixed(2)),
        notes: "",
        items: cart.map((item) => ({
          item_name: item.name,
          quantity: item.qty,
          unit: item.unit,
          unit_price: Number(item.salePrice.toFixed(2)),
          total: Number((item.qty * item.salePrice).toFixed(2)),
        })),
      };

      const res = await api.post("/sales/", payload);

      const now = new Date();
      const s = loadSettings();

      const receiptData: ReceiptData = {
        receiptNumber: res.data.receipt_number,
        items: [...cart],
        total: subtotal,
        paymentMethod,
        customer: selectedCustomer?.name || "",
        businessName,
        date: now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        time: now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      if (receiptDelivery === "email") {
        try {
          await api.post("/receipts/send_email/", {
            receipt_number: res.data.receipt_number,
            email: receiptEmail.trim(),
          });
          alert("Receipt sent via email!");
        } catch {
          alert("Failed to send email. Please try again or choose Print.");
        }
      } else if (receiptDelivery === "whatsapp") {
        try {
          const phone = receiptWhatsapp.replace(/[^\d]/g, "");
          const text = generateReceiptText(receiptData, currencySymbol);
          const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
          window.open(url, "_blank");
          alert(
            "Receipt opened in WhatsApp. Please review and send the message.",
          );
        } catch {
          alert(
            "Failed to open WhatsApp. Please check the number and try again.",
          );
        }
      } else {
        try {
          printReceipt(receiptData, {
            symbol: currencySymbol,
            footer: s.receipt_footer || "Thank you for your purchase!",
            header: s.receipt_header || "",
            taxRate: s.tax_rate || 0,
            showTax: s.receipt_show_tax ?? false,
          });
        } catch (receiptError) {
          console.error("Receipt printing failed:", receiptError);
        }
      }

      // Reset cart immediately — no waiting for modal
      setCart([]);
      setSelectedCustomerId(null);
      setShowCart(false);
      setReceiptEmail("");
      setReceiptWhatsapp("");
      setReceiptDelivery("print");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;

        console.error("Sale submission failed:", {
          status: error.response?.status,
          data: responseData,
        });

        const message =
          typeof responseData === "string"
            ? responseData
            : responseData?.detail ||
              Object.entries(responseData || {})
                .map(([field, value]) => `${field}: ${String(value)}`)
                .join("\n") ||
              "The sale data is invalid.";

        alert(`Unable to complete sale:\n${message}`);
      } else {
        console.error("Sale submission failed:", error);
        alert("Failed to submit order. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    ["access_token","refresh_token","user_role"].forEach((k) => localStorage.removeItem(k));
    router.push("/login");
  };

  /* receipt screen — removed: now auto-prints without modal */

  /* main layout */
  return (
    <div className={`app-theme-${theme} flex min-h-screen min-h-[100dvh] w-screen overflow-hidden`} style={{ colorScheme: theme === "dark" ? "dark" : "light" }}>

      {/* ── products panel ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* header */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-16 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f53f64] text-white flex items-center justify-center font-black text-base select-none shadow-sm">
              Q
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Quick Sale</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {businessName} · {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-xs mx-4 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search products…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#f53f64]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stations.length > 1 && (
              <select value={stationId || ""} onChange={(e) => setStationId(parseInt(e.target.value) || null)}
                className="hidden sm:block rounded-xl border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#f53f64] bg-white">
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="p-2 text-gray-500 hover:text-[#f53f64] hover:bg-[#fff6f7] rounded-xl transition">
              {isFullscreen ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowCart(true)}
              className="relative lg:hidden p-2 rounded-xl bg-[#f53f64] text-white">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ff963d] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
            {role !== "cashier" && (
              <button onClick={() => router.push("/")}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Dashboard
              </button>
            )}
            <button onClick={logout} title="Logout"
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* mobile search */}
        <div className="sm:hidden px-4 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-[#f53f64]"
            />
          </div>
        </div>

        {/* product grid */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-2 border-[#f53f64] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading products…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">{products.length === 0 ? "No products yet" : "No match"}</p>
              {products.length === 0 && (
                <button onClick={() => router.push("/stock/new")}
                  className="mt-2 px-4 py-2 text-xs bg-[#f53f64] text-white rounded-xl hover:bg-[#e03050] transition">
                  Add Products
                </button>
              )}
            </div>
          ) : (
            <div className={displayMode === "list"
              ? "w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              : displayMode === "gallery"
                ? "grid grid-cols-2 lg:grid-cols-3 gap-4"
                : "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
            }>
              {displayMode === "list" && (
                <div className="hidden w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:grid">
                  <span>Product</span>
                  <span>Brand</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Stock</span>
                </div>
              )}
              {filtered.map((product) => {
                const inCart     = cart.find((i) => i.id === product.id);
                const outOfStock = product.stock <= 0;
                if (displayMode === "list") {
                  return (
                    <div key={product.id} onClick={() => !outOfStock && addToCart(product)}
                      className={`group relative grid w-full grid-cols-1 gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 transition-all duration-200 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-4 ${
                        outOfStock
                          ? "cursor-not-allowed bg-gray-50 opacity-50"
                          : "cursor-pointer hover:bg-[#fff6f7] hover:shadow-[inset_3px_0_0_#f53f64]"
                      }`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-500 transition-colors group-hover:bg-white group-hover:text-[#f53f64]">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">{product.name}</p>
                          <p className="text-[10px] text-gray-400">{product.unitLabel}</p>
                        </div>
                        {inCart && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f53f64] px-1 text-[9px] font-bold text-white sm:hidden">
                            {inCart.qty}
                          </span>
                        )}
                      </div>
                      <p className="hidden truncate text-xs text-gray-500 sm:block">{product.brandDisplay || "-"}</p>
                      <p className="absolute right-4 top-3 text-sm font-bold text-[#f53f64] sm:static sm:text-right">
                        {currencySymbol}{product.price.toFixed(2)}
                      </p>
                      <p className={`text-[11px] sm:text-right ${product.stock <= 5 ? "text-orange-500" : "text-gray-400"}`}>
                        {outOfStock ? "Out of stock" : `${product.stock} ${product.unitLabel} left`}
                      </p>
                      {inCart && (
                        <span className="absolute right-4 top-1/2 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#f53f64] px-1 text-[9px] font-bold text-white sm:flex">
                          {inCart.qty}
                        </span>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={product.id} onClick={() => !outOfStock && addToCart(product)}
                    className={`relative bg-white rounded-xl border-2 p-3 transition-all
                      ${outOfStock
                        ? "opacity-50 cursor-not-allowed border-gray-100"
                        : inCart
                          ? "border-[#f53f64] shadow-sm cursor-pointer hover:shadow-md"
                          : "border-gray-100 cursor-pointer hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5"
                      }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 bg-[#f53f64] text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {inCart.qty}
                      </span>
                    )}
                    <div className={`${displayMode === "gallery" ? "h-24" : "h-14"} bg-gray-50 rounded-lg flex items-center justify-center mb-2`}>
                      <span className="text-2xl select-none">{product.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 leading-4 line-clamp-2 min-h-[2rem]">
                        {product.name}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{product.brandDisplay}</p>
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="text-sm font-bold text-[#f53f64]">{currencySymbol}{product.price.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-400">/{product.unitLabel}</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${product.stock <= 5 ? "text-orange-500" : "text-gray-400"}`}>
                        {outOfStock ? "Out of stock" : `${product.stock} ${product.unitLabel} left`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── cart panel ── */}
      <div className={`
        ${showCart ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        fixed inset-y-0 right-0 z-40 w-full sm:w-[min(100vw,24rem)]
        lg:relative lg:w-[clamp(320px,32vw,400px)] lg:min-w-0
        bg-white border-l border-gray-100 flex flex-col
        transition-transform duration-300 lg:transition-none
      `}>
        <div className="px-5 h-16 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[#f53f64]" />
            <h2 className="font-bold text-gray-900">Order</h2>
            {cartCount > 0 && (
              <span className="bg-[#f53f64] text-white text-xs font-bold rounded-full px-2 py-0.5">{cartCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button onClick={() => setCart([])}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition">
                Clear
              </button>
            )}
            <button onClick={() => setShowCart(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <ShoppingCart className="h-12 w-12 opacity-20" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs text-center text-gray-300">Tap a product to add it</p>
            </div>
          ) : (
            <div className="w-full min-w-0 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="w-full min-w-0 bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-4 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.unitLabel} · {item.categoryDisplay || item.category} · {item.brandDisplay || item.brand}</p>
                    </div>
                    <button onClick={() => removeItem(item.id)}
                      className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                      <button onClick={() => setQty(item.id, item.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-[#f53f64] transition">
                        <Minus className="h-3 w-3" />
                      </button>
                      <input type="number" min={1} value={item.qty}
                        onChange={(e) => setQty(item.id, parseInt(e.target.value) || 1)}
                        className="w-10 text-center text-sm font-semibold text-gray-800 bg-transparent outline-none"
                      />
                      <button onClick={() => setQty(item.id, item.qty + 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-[#f53f64] transition">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-[#f53f64]">
                      <span className="flex-shrink-0 px-2 text-xs text-gray-400">{currencySymbol}</span>
                      <input type="number" min={0} step="0.01"
                        value={item.salePrice || ""} placeholder="price"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setPrice(item.id, parseFloat(e.target.value) || 0)}
                        className="min-w-0 w-full py-1.5 pr-2 text-right text-sm bg-transparent outline-none"
                      />
                    </div>
                    <p className="min-w-[4.75rem] whitespace-nowrap text-right text-sm font-bold text-[#f53f64]">
                      {currencySymbol}{(item.salePrice * item.qty).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 border-t border-gray-100 px-5 py-4 space-y-3 flex-shrink-0">
          {/* ── Customer / Credit section ── */}
          <div className="bg-blue-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Customer
            </p>
            <select value={selectedCustomerId || ""} onChange={(e) => setSelectedCustomerId(parseInt(e.target.value) || null)}
              className="w-full appearance-none px-3 py-2 text-sm border border-blue-200 rounded-lg outline-none focus:border-blue-400 bg-white">
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {selectedCustomer && (
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <div className="min-w-0 bg-white rounded-lg px-3 py-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide">Outstanding</p>
                  <p className="text-sm font-bold text-orange-600">{currencySymbol}{selectedCustomer.outstanding_balance.toFixed(2)}</p>
                </div>
                <div className="min-w-0 bg-white rounded-lg px-3 py-2 text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide">Available Credit</p>
                  <p className={`text-sm font-bold ${selectedCustomer.available_credit > 0 ? "text-green-600" : "text-red-500"}`}>
                    {currencySymbol}{selectedCustomer.available_credit.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* payment method */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full appearance-none px-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#f53f64] bg-white">
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 bottom-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* receipt delivery */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500">
              Receipt Delivery
            </label>
            <select
              value={receiptDelivery}
              onChange={(e) =>
                setReceiptDelivery(
                  e.target.value as "print" | "email" | "whatsapp",
                )
              }
              className="w-full appearance-none px-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#f53f64] bg-white"
            >
              <option value="print">Print Receipt</option>
              <option value="email">Email Receipt</option>
              <option value="whatsapp">WhatsApp Receipt</option>
            </select>
            {receiptDelivery === "email" && (
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  className="block w-full rounded-md border border-gray-200 pl-10 pr-3 py-2 text-sm outline-none focus:border-[#f53f64] bg-white"
                />
              </div>
            )}
            {receiptDelivery === "whatsapp" && (
              <div className="relative">
                <MessageCircle className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  placeholder="256771234567 (intl format)"
                  value={receiptWhatsapp}
                  onChange={(e) => setReceiptWhatsapp(e.target.value)}
                  className="block w-full rounded-md border border-gray-200 pl-10 pr-3 py-2 text-sm outline-none focus:border-[#f53f64] bg-white"
                />
              </div>
            )}
          </div>

          {/* totals */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Items</span><span>{cartCount}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-[#f53f64]">{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
          </div>
          <button onClick={placeOrder} disabled={!cart.length || submitting}
            className="w-full bg-[#f53f64] hover:bg-[#e03050] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3.5 font-bold text-sm transition-colors">
            {submitting
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Processing…
                </span>
              : `Charge ${currencySymbol}${subtotal.toFixed(2)}`
            }
          </button>
        </div>
      </div>

      {showCart && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setShowCart(false)} />
      )}
    </div>
  );
}

export default function POSPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#f53f64] flex items-center justify-center shadow-sm">
            <span className="text-xl font-black text-white">Q</span>
          </div>
          <div className="w-6 h-6 border-2 border-[#f53f64] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    }>
      <POSInner />
    </Suspense>
  );
}
