"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2, Receipt, DollarSign, User,
  Save, CheckCircle, AlertCircle, Plus, Trash2,
} from "lucide-react";
import api from "@/lib/api";
import { loadSettings, saveSettings } from "@/lib/settings";

/* ─── currency list ─────────────────────────────────────── */
const CURRENCIES = [
  { code: "USD", symbol: "$",    label: "US Dollar ($)" },
  { code: "EUR", symbol: "€",    label: "Euro (€)" },
  { code: "GBP", symbol: "£",    label: "British Pound (£)" },
  { code: "UGX", symbol: "UGX ", label: "Ugandan Shilling (UGX)" },
  { code: "KES", symbol: "KSh ", label: "Kenyan Shilling (KSh)" },
  { code: "TZS", symbol: "TSh ", label: "Tanzanian Shilling (TSh)" },
  { code: "RWF", symbol: "RWF ", label: "Rwandan Franc (RWF)" },
  { code: "NGN", symbol: "₦",    label: "Nigerian Naira (₦)" },
  { code: "GHS", symbol: "₵",    label: "Ghanaian Cedi (₵)" },
  { code: "ZAR", symbol: "R ",   label: "South African Rand (R)" },
  { code: "ETB", symbol: "Br ",  label: "Ethiopian Birr (Br)" },
  { code: "ZMW", symbol: "ZK ",  label: "Zambian Kwacha (ZK)" },
  { code: "XOF", symbol: "CFA ", label: "West African CFA (CFA)" },
  { code: "XAF", symbol: "FCFA ", label: "Central African CFA (FCFA)" },
  { code: "MWK", symbol: "MK ",  label: "Malawian Kwacha (MK)" },
  { code: "BIF", symbol: "BIF ", label: "Burundian Franc (BIF)" },
];

const TIMEZONES = [
  "UTC",
  "Africa/Kampala",
  "Africa/Nairobi",
  "Africa/Dar_es_Salaam",
  "Africa/Kigali",
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Johannesburg",
  "Africa/Addis_Ababa",
  "Africa/Lusaka",
  "Africa/Bujumbura",
  "Europe/London",
  "America/New_York",
];

interface BizSettings {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  tax_rate: string;
  low_stock_threshold: number;
  receipt_header: string;
  receipt_footer: string;
  receipt_show_tax: boolean;
}

type Tab = "business" | "receipt" | "finance" | "account" | "catalog" | "stations";

interface CategoryItem { id: number; name: string }
interface BrandItem { id: number; name: string; category_name?: string }
interface StationItem { id: number; name: string; address: string; phone: string; is_active: boolean }

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "business", label: "Business",  icon: <Building2 className="h-4 w-4" /> },
  { id: "receipt",  label: "Receipt",   icon: <Receipt className="h-4 w-4" /> },
  { id: "finance",  label: "Finance",   icon: <DollarSign className="h-4 w-4" /> },
  { id: "account",  label: "Account",   icon: <User className="h-4 w-4" /> },
  { id: "catalog",  label: "Catalog",   icon: <Plus className="h-4 w-4" /> },
  { id: "stations", label: "Stations",  icon: <Building2 className="h-4 w-4" /> },
];

const field = "mt-1 block w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64] focus:ring-1 focus:ring-[#f53f64] bg-white";
const label = "block text-sm font-medium text-[#252525] mb-1";
const card  = "bg-white rounded-xl border border-[#eeeeee] p-5 space-y-4";

function SettingsInner() {
  useSearchParams();
  const [tab,        setTab]        = useState<Tab>("business");
  const [settings,   setSettings]   = useState<BizSettings | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [status,     setStatus]     = useState<"idle" | "ok" | "err">("idle");
  const [posDisplay, setPosDisplay] = useState<"tiles" | "list" | "gallery">(() => loadSettings().pos_display);
  const [theme, setTheme] = useState<"light" | "dark" | "ocean" | "forest">(() => loadSettings().theme);

  /* account fields */
  const [firstName,    setFirstName]    = useState("");
  const [lastName,     setLastName]     = useState("");
  const [email,        setEmail]        = useState("");
  const [oldPassword,  setOldPassword]  = useState("");
  const [newPassword,  setNewPassword]  = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [accSaving,    setAccSaving]    = useState(false);
  const [accStatus,    setAccStatus]    = useState<"idle"|"ok"|"err">("idle");
  const [userRole,     setUserRole]     = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [catStatus, setCatStatus] = useState<"idle"|"ok"|"err">("idle");
  const [brandStatus, setBrandStatus] = useState<"idle"|"ok"|"err">("idle");

  const [stations, setStations] = useState<StationItem[]>([]);
  const [newStationName, setNewStationName] = useState("");
  const [newStationAddress, setNewStationAddress] = useState("");
  const [newStationPhone, setNewStationPhone] = useState("");
  const [stationSaving, setStationSaving] = useState(false);
  const [stationStatus, setStationStatus] = useState<"idle"|"ok"|"err">("idle");

  useEffect(() => {
    const load = async () => {
      try {
        const [bizRes, userRes] = await Promise.all([
          api.get("/businesses/").catch(() => ({ data: { results: [], } })),
          api.get("/auth/me/").catch(() => ({ data: { first_name: "", last_name: "", email: "", members: [], } })),
        ]);
        const businesses = bizRes.data.results || bizRes.data || [];
        if (businesses?.length > 0) setSettings(businesses[0]);

        const u = userRes.data;
        setFirstName(u.first_name || "");
        setLastName(u.last_name  || "");
        setEmail(u.email         || "");
        const members = u.members || [];
        if (members.length > 0) {
          setUserRole(members[0].role);
        }
      } catch (e) {
        console.warn("Settings load error", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (tab !== "catalog" || !settings?.id) return;
    const load = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          api.get("/product-categories/", { params: { business: settings.id } }).catch(() => ({ data: { results: [], } })),
          api.get("/brands/", { params: { business: settings.id } }).catch(() => ({ data: { results: [], } })),
        ]);
        setCategories((catRes.data.results || catRes.data || []).sort((a: CategoryItem, b: CategoryItem) => a.name.localeCompare(b.name)));
        setBrands((brandRes.data.results || brandRes.data || []).sort((a: BrandItem, b: BrandItem) => a.name.localeCompare(b.name)));
      } catch (e) {
        console.warn("Catalog load error", e);
      }
    };
    load();
  }, [tab, settings?.id]);

  useEffect(() => {
    if (tab !== "stations" || !settings?.id) return;
    const load = async () => {
      try {
        const res = await api.get("/stations/", { params: { business: settings.id } }).catch(() => ({ data: { results: [], } }));
        setStations((res.data.results || res.data || []).sort((a: StationItem, b: StationItem) => a.name.localeCompare(b.name)));
      } catch (e) {
        console.warn("Stations load error", e);
      }
    };
    load();
  }, [tab, settings?.id]);

  const set = <K extends keyof BizSettings>(k: K, v: BizSettings[K]) =>
    setSettings((s) => s ? { ...s, [k]: v } : s);

  const onCurrencyChange = (code: string) => {
    const cur = CURRENCIES.find((c) => c.code === code);
    set("currency", code);
    set("currency_symbol", cur?.symbol ?? "$");
  };

  const saveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setStatus("idle");
    try {
      await api.patch(`/businesses/${settings.id}/`, {
        name:                settings.name,
        address:             settings.address,
        phone:               settings.phone,
        email:               settings.email,
        currency:            settings.currency,
        currency_symbol:     settings.currency_symbol,
        timezone:            settings.timezone,
        tax_rate:            settings.tax_rate,
        low_stock_threshold: settings.low_stock_threshold,
        receipt_header:      settings.receipt_header,
        receipt_footer:      settings.receipt_footer,
        receipt_show_tax:    settings.receipt_show_tax,
      });
      // persist to localStorage for instant use across app
      saveSettings({
        ...loadSettings(),
        currency:            settings.currency,
        currency_symbol:     settings.currency_symbol,
        timezone:            settings.timezone,
        tax_rate:            parseFloat(settings.tax_rate) || 0,
        low_stock_threshold: settings.low_stock_threshold,
        receipt_header:      settings.receipt_header,
        receipt_footer:      settings.receipt_footer,
        receipt_show_tax:    settings.receipt_show_tax,
        business_name:       settings.name,
      });
      setStatus("ok");
    } catch {
      setStatus("err");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPass) {
      alert("Passwords do not match");
      return;
    }
    setAccSaving(true);
    setAccStatus("idle");
    try {
      await api.patch("/auth/me/update/", {
        first_name: firstName,
        last_name:  lastName,
        email,
        ...(newPassword ? { old_password: oldPassword, new_password: newPassword } : {}),
      });
      setOldPassword(""); setNewPassword(""); setConfirmPass("");
      setAccStatus("ok");
    } catch {
      setAccStatus("err");
    } finally {
      setAccSaving(false);
      setTimeout(() => setAccStatus("idle"), 3000);
    }
  };

  const addCategory = async () => {
    if (!newCat.trim() || !settings?.id) return;
    setCatSaving(true); setCatStatus("idle");
    try {
      const res = await api.post("/product-categories/", { name: newCat.trim(), business: settings.id });
      setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCat(""); setCatStatus("ok");
    } catch {
      setCatStatus("err");
    } finally {
      setCatSaving(false);
      setTimeout(() => setCatStatus("idle"), 3000);
    }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm("Delete this category? Products using it will keep the text.")) return;
    try {
      await api.delete(`/product-categories/${id}/`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.warn(e);
      alert("Failed to delete category.");
    }
  };

  const addBrand = async () => {
    if (!newBrand.trim() || !settings?.id) return;
    setBrandSaving(true); setBrandStatus("idle");
    try {
      const res = await api.post("/brands/", { name: newBrand.trim(), business: settings.id });
      setBrands((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBrand(""); setBrandStatus("ok");
    } catch {
      setBrandStatus("err");
    } finally {
      setBrandSaving(false);
      setTimeout(() => setBrandStatus("idle"), 3000);
    }
  };

  const deleteBrand = async (id: number) => {
    if (!confirm("Delete this brand?")) return;
    try {
      await api.delete(`/brands/${id}/`);
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      console.warn(e);
      alert("Failed to delete brand.");
    }
  };

  const addStation = async () => {
    if (!newStationName.trim() || !settings?.id) return;
    setStationSaving(true); setStationStatus("idle");
    try {
      const res = await api.post("/stations/", {
        name: newStationName.trim(),
        business: settings.id,
        address: newStationAddress.trim(),
        phone: newStationPhone.trim(),
      });
      setStations((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStationName(""); setNewStationAddress(""); setNewStationPhone("");
      setStationStatus("ok");
    } catch {
      setStationStatus("err");
    } finally {
      setStationSaving(false);
      setTimeout(() => setStationStatus("idle"), 3000);
    }
  };

  const deleteStation = async (id: number) => {
    if (!confirm("Delete this station?")) return;
    try {
      await api.delete(`/stations/${id}/`);
      setStations((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.warn(e);
      alert("Failed to delete station.");
    }
  };

  const toggleStationActive = async (id: number) => {
    const station = stations.find((s) => s.id === id);
    if (!station) return;
    try {
      const res = await api.patch(`/stations/${id}/`, { is_active: !station.is_active });
      setStations((prev) => prev.map((s) => s.id === id ? res.data : s));
    } catch (e) {
      console.warn(e);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-[#f53f64] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!settings) return (
    <div className="flex items-center justify-center h-64 text-[#999999] text-sm">
      No business found. Create one from the dashboard first.
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525]">Settings</h1>
        <p className="text-sm text-[#999999] mt-1">Manage your business configuration</p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.filter((t) => {
          if (t.id === "stations" && userRole !== null) return userRole === "owner" || userRole === "manager";
          return true;
        }).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id
                ? "bg-white text-[#252525] shadow-sm"
                : "text-[#999999] hover:text-[#252525]"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Business tab ── */}
      {tab === "business" && (
        <form onSubmit={saveBusiness} className="space-y-4">
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Business Information</h2>
            <div>
              <label className={label}>Business Name <span className="text-[#f53f64]">*</span></label>
              <input type="text" value={settings.name} required
                onChange={(e) => set("name", e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Address</label>
              <textarea value={settings.address} rows={3}
                onChange={(e) => set("address", e.target.value)} className={field} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Phone</label>
                <input type="tel" value={settings.phone}
                  onChange={(e) => set("phone", e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>Email</label>
                <input type="email" value={settings.email}
                  onChange={(e) => set("email", e.target.value)} className={field} />
              </div>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Regional</h2>
            <div>
              <label className={label}>Timezone</label>
              <select value={settings.timezone}
                onChange={(e) => set("timezone", e.target.value)} className={field}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <SaveBar saving={saving} status={status} />
        </form>
      )}

      {/* ── Receipt tab ── */}
      {tab === "receipt" && (
        <form onSubmit={saveBusiness} className="space-y-4">
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Receipt Customisation</h2>
            <div>
              <label className={label}>Receipt Header</label>
              <input type="text" value={settings.receipt_header} maxLength={255}
                placeholder="e.g. 'Welcome to our store!'"
                onChange={(e) => set("receipt_header", e.target.value)} className={field} />
              <p className="text-xs text-[#999999] mt-1">Printed at the top of every receipt, below the business name.</p>
            </div>
            <div>
              <label className={label}>Receipt Footer</label>
              <input type="text" value={settings.receipt_footer} maxLength={255}
                placeholder="e.g. 'Thank you! Come again.'"
                onChange={(e) => set("receipt_footer", e.target.value)} className={field} />
              <p className="text-xs text-[#999999] mt-1">Printed at the bottom of every receipt.</p>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-[#252525]">Show tax on receipt</p>
                <p className="text-xs text-[#999999]">Display the tax amount line when printing</p>
              </div>
              <button type="button" onClick={() => set("receipt_show_tax", !settings.receipt_show_tax)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.receipt_show_tax ? "bg-[#f53f64]" : "bg-gray-200"
                }`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.receipt_show_tax ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>
          </div>

          {/* live preview */}
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Preview</h2>
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-[11px] text-black border border-dashed border-gray-300"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}>
              <p className="text-center font-bold text-[13px]">{settings.name || "Your Business"}</p>
              {settings.receipt_header && (
                <p className="text-center text-[10px] text-gray-600 mt-0.5">{settings.receipt_header}</p>
              )}
              <div className="border-t border-dashed border-gray-400 my-2" />
              <p className="text-[10px] text-gray-500">Receipt # RCP-XXXXXXXX</p>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className="flex justify-between"><span>Sugar × 2 kg</span><span>{CURRENCIES.find(c=>c.code===settings.currency)?.symbol ?? "$"}3.00</span></div>
              <div className="flex justify-between"><span>Rice × 1 bag</span><span>{CURRENCIES.find(c=>c.code===settings.currency)?.symbol ?? "$"}5.50</span></div>
              {settings.receipt_show_tax && parseFloat(settings.tax_rate) > 0 && (
                <div className="flex justify-between text-gray-500 mt-1">
                  <span>Tax ({settings.tax_rate}%)</span>
                  <span>{CURRENCIES.find(c=>c.code===settings.currency)?.symbol ?? "$"}{(8.50 * parseFloat(settings.tax_rate) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-gray-800 my-1" />
              <div className="flex justify-between font-bold text-[13px]">
                <span>TOTAL</span>
                <span>{CURRENCIES.find(c=>c.code===settings.currency)?.symbol ?? "$"}8.50</span>
              </div>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <p className="text-center text-[10px] text-gray-500">
                {settings.receipt_footer || "Thank you for your purchase!"}
              </p>
            </div>
          </div>

          <SaveBar saving={saving} status={status} />
        </form>
      )}

      {/* ── Finance tab ── */}
      {tab === "finance" && (
        <form onSubmit={saveBusiness} className="space-y-4">
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Currency</h2>
            <div>
              <label className={label}>Currency <span className="text-[#f53f64]">*</span></label>
              <select value={settings.currency}
                onChange={(e) => onCurrencyChange(e.target.value)} className={field}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <p className="text-xs text-[#999999] mt-1">
                Symbol: <span className="font-bold text-[#252525]">{settings.currency_symbol}</span> — used on receipts and throughout the app.
              </p>
            </div>
            <div>
              <label className={label}>Currency Symbol Override</label>
              <input type="text" value={settings.currency_symbol} maxLength={5}
                placeholder="e.g. $, €, KSh"
                onChange={(e) => set("currency_symbol", e.target.value)} className={`${field} max-w-[120px]`} />
              <p className="text-xs text-[#999999] mt-1">Override the symbol if your currency isn&#39;t listed correctly.</p>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Tax</h2>
            <div>
              <label className={label}>Tax Rate (%)</label>
              <div className="flex items-center gap-2 max-w-[180px]">
                <input type="number" min={0} max={100} step="0.01"
                  value={settings.tax_rate}
                  onChange={(e) => set("tax_rate", e.target.value as BizSettings["tax_rate"])}
                  className={field} />
                <span className="text-sm text-[#999999] flex-shrink-0">%</span>
              </div>
              <p className="text-xs text-[#999999] mt-1">Set to 0 to disable tax. e.g. enter 16 for 16% VAT.</p>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Stock Alerts</h2>
            <div>
              <label className={label}>Low Stock Threshold</label>
              <div className="flex items-center gap-2 max-w-[180px]">
                <input type="number" min={0}
                  value={settings.low_stock_threshold}
                  onChange={(e) => set("low_stock_threshold", parseInt(e.target.value) || 0)}
                  className={field} />
                <span className="text-sm text-[#999999] flex-shrink-0">units</span>
              </div>
              <p className="text-xs text-[#999999] mt-1">Products with stock at or below this number are flagged as &quot;Low stock&quot;.</p>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Point of Sale</h2>
            <div>
              <label className={label}>Product Display</label>
              <select
                value={posDisplay}
                onChange={(e) => {
                  const value = e.target.value as typeof posDisplay;
                  setPosDisplay(value);
                  saveSettings({ ...loadSettings(), pos_display: value });
                }}
                className={field}
              >
                <option value="tiles">Tiles</option>
                <option value="list">List</option>
                <option value="gallery">Gallery</option>
              </select>
              <p className="text-xs text-[#999999] mt-1">Choose how products appear on the POS screen.</p>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Appearance</h2>
            <div>
              <label className={label}>POS and Dashboard Theme</label>
              <select
                value={theme}
                onChange={(e) => {
                  const value = e.target.value as typeof theme;
                  setTheme(value);
                  saveSettings({ ...loadSettings(), theme: value });
                }}
                className={field}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="ocean">Ocean</option>
                <option value="forest">Forest</option>
              </select>
              <p className="text-xs text-[#999999] mt-1">Changes the POS and dashboard colors only.</p>
            </div>
          </div>

          <SaveBar saving={saving} status={status} />
        </form>
      )}

      {/* ── Account tab ── */}
      {tab === "account" && (
        <form onSubmit={saveAccount} className="space-y-4">
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>First Name</label>
                <input type="text" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>Last Name</label>
                <input type="text" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} className={field} />
              </div>
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={field} />
            </div>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525]">Change Password</h2>
            <p className="text-xs text-[#999999]">Leave blank to keep your current password.</p>
            <div>
              <label className={label}>Current Password</label>
              <input type="password" value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password" className={field} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>New Password</label>
                <input type="password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password" className={field} />
              </div>
              <div>
                <label className={label}>Confirm Password</label>
                <input type="password" value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  autoComplete="new-password" className={field} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <StatusMsg status={accStatus} />
            <button type="submit" disabled={accSaving}
              className="flex items-center gap-2 rounded-xl bg-[#f53f64] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e03050] disabled:opacity-40 transition">
              <Save className="h-4 w-4" />
              {accSaving ? "Saving…" : "Save Account"}
            </button>
          </div>
        </form>
      )}

      {/* ── Catalog tab ── */}
      {tab === "catalog" && (
        <div className="space-y-6">
          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525] mb-3">Product Categories</h2>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category name"
                className={`${field} max-w-xs`}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
              />
              <button type="button" onClick={addCategory} disabled={catSaving}
                className="flex items-center gap-1.5 rounded-xl bg-[#f53f64] px-4 py-2 text-xs font-bold text-white hover:bg-[#e03050] disabled:opacity-40 transition">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-[#252525]">{c.name}</span>
                  <button type="button" onClick={() => deleteCategory(c.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-[#999999]">No categories yet. Add one above.</p>
              )}
            </div>
            <div className="mt-3">
              <StatusMsg status={catStatus} />
            </div>
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[#252525] mb-3">Brands</h2>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newBrand} onChange={(e) => setNewBrand(e.target.value)}
                placeholder="New brand name"
                className={`${field} max-w-xs`}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBrand())}
              />
              <button type="button" onClick={addBrand} disabled={brandSaving}
                className="flex items-center gap-1.5 rounded-xl bg-[#f53f64] px-4 py-2 text-xs font-bold text-white hover:bg-[#e03050] disabled:opacity-40 transition">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {brands.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-[#252525]">{b.name}</span>
                  <button type="button" onClick={() => deleteBrand(b.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {brands.length === 0 && (
                <p className="text-xs text-[#999999]">No brands yet. Add one above.</p>
              )}
            </div>
            <div className="mt-3">
              <StatusMsg status={brandStatus} />
            </div>
          </div>
        </div>
      )}

      {/* ── Stations tab ── */}
      {tab === "stations" && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-[#252525] mb-3">Locations / Stations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input type="text" value={newStationName} onChange={(e) => setNewStationName(e.target.value)}
              placeholder="Station name"
              className={field}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStation())}
            />
            <input type="text" value={newStationAddress} onChange={(e) => setNewStationAddress(e.target.value)}
              placeholder="Address"
              className={field}
            />
            <div className="flex gap-2">
              <input type="text" value={newStationPhone} onChange={(e) => setNewStationPhone(e.target.value)}
                placeholder="Phone"
                className={`${field} flex-1`}
              />
              <button type="button" onClick={addStation} disabled={stationSaving}
                className="flex items-center gap-1.5 rounded-xl bg-[#f53f64] px-4 py-2 text-xs font-bold text-white hover:bg-[#e03050] disabled:opacity-40 transition">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {stations.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-[#252525]">{s.name}</p>
                  <p className="text-[10px] text-[#999999]">{s.address} {s.phone ? `· ${s.phone}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleStationActive(s.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                      s.is_active ? "bg-green-50 text-green-600" : "bg-gray-200 text-gray-500"
                    }`}>
                    {s.is_active ? "Active" : "Inactive"}
                  </button>
                  <button type="button" onClick={() => deleteStation(s.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {stations.length === 0 && (
              <p className="text-xs text-[#999999]">No stations yet. Add one above.</p>
            )}
          </div>
          <div className="mt-3">
            <StatusMsg status={stationStatus} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-[#f53f64] border-t-transparent rounded-full animate-spin" /></div>}>
      <SettingsInner />
    </Suspense>
  );
}

/* ─── shared sub-components ─────────────────────────────── */
function StatusMsg({ status }: { status: "idle"|"ok"|"err" }) {
  if (status === "ok") return (
    <span className="flex items-center gap-1.5 text-sm text-green-600">
      <CheckCircle className="h-4 w-4" /> Saved successfully
    </span>
  );
  if (status === "err") return (
    <span className="flex items-center gap-1.5 text-sm text-red-500">
      <AlertCircle className="h-4 w-4" /> Failed to save
    </span>
  );
  return <span />;
}

function SaveBar({ saving, status }: { saving: boolean; status: "idle"|"ok"|"err" }) {
  return (
    <div className="flex items-center justify-between">
      <StatusMsg status={status} />
      <button type="submit" disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-[#f53f64] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e03050] disabled:opacity-40 transition">
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
