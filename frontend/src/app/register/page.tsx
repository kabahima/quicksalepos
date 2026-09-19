"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import axios from "axios";
import { saveSettings } from "@/lib/settings";

const inputClass = "mt-1 block w-full rounded-xl border border-[#eeeeee] px-3 py-2.5 text-sm outline-none focus:border-[#f53f64] focus:ring-1 focus:ring-[#f53f64]";
const labelClass = "block text-sm font-medium text-[#252525]";

const TIMEZONES = [
  ["Africa/Kampala", "Africa/Kampala (EAT)"],
  ["Africa/Nairobi", "Africa/Nairobi (EAT)"],
  ["Africa/Dar_es_Salaam", "Africa/Dar es Salaam (EAT)"],
  ["Africa/Kigali", "Africa/Kigali (CAT)"],
  ["UTC", "UTC"],
  ["Europe/London", "Europe/London"],
  ["America/New_York", "America/New York"],
] as const;

const CURRENCIES = [
  ["UGX", "UGX " , "Ugandan Shilling (UGX)"],
  ["KES", "KSh ", "Kenyan Shilling (KSh)"],
  ["USD", "$", "US Dollar ($)"],
  ["TZS", "TSh ", "Tanzanian Shilling (TSh)"],
  ["RWF", "RWF ", "Rwandan Franc (RWF)"],
] as const;

type Step = 1 | 2;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [timezone, setTimezone] = useState("Africa/Kampala");
  const [taxRate, setTaxRate] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for your purchase!");
  const [showTax, setShowTax] = useState(false);
  const [posDisplay, setPosDisplay] = useState<"tiles" | "list" | "gallery">("tiles");
  const [theme, setTheme] = useState<"light" | "dark" | "ocean" | "forest">("light");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("qs_account_created") === "true") {
      router.replace("/login");
    }
  }, [router]);

  const continueToBusiness = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/register/", {
        username: username.trim(),
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
      });

      const tokenResponse = await api.post("/auth/token/", new URLSearchParams({
        username: username.trim(),
        password,
      }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      localStorage.setItem("access_token", tokenResponse.data.access);
      localStorage.setItem("refresh_token", tokenResponse.data.refresh);
      localStorage.setItem("user_role", "owner");

      const businessResponse = await api.post("/businesses/", {
        name: businessName.trim(),
        address: businessAddress.trim(),
        phone: businessPhone.trim(),
        email: email.trim(),
        currency,
        currency_symbol: CURRENCIES.find(([code]) => code === currency)?.[1] ?? "UGX ",
        timezone,
        tax_rate: parseFloat(taxRate) || 0,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
        receipt_header: receiptHeader.trim(),
        receipt_footer: receiptFooter.trim(),
        receipt_show_tax: showTax,
      });
      const business = businessResponse.data;
      localStorage.setItem("qs_account_created", "true");
      saveSettings({
        ...loadDefaultSettings(),
        currency: business.currency || currency,
        currency_symbol: business.currency_symbol || CURRENCIES.find(([code]) => code === currency)?.[1] || "UGX ",
        timezone: business.timezone || timezone,
        tax_rate: Number(business.tax_rate) || 0,
        low_stock_threshold: business.low_stock_threshold || Number(lowStockThreshold) || 5,
        receipt_header: business.receipt_header || receiptHeader.trim(),
        receipt_footer: business.receipt_footer || receiptFooter.trim(),
        receipt_show_tax: business.receipt_show_tax ?? showTax,
        pos_display: posDisplay,
        theme,
        business_name: business.name || businessName.trim(),
      });
      router.replace("/");
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const data = requestError.response?.data;
        const detail = data?.detail || data?.username?.[0] || data?.name?.[0];
        setError(typeof detail === "string" ? detail : "Unable to complete setup. Please check your details and try again.");
      } else {
        setError("Unable to complete setup. Please try again.");
      }
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fff6f7] px-4 py-10">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[#eeeeee] bg-white shadow-xl">
        <div className="bg-[#f53f64] px-6 py-8 text-white sm:px-10">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl font-bold text-[#f53f64]">Q</div>
          <p className="text-sm font-semibold text-white/80">Quick Sale setup</p>
          <h1 className="mt-1 text-3xl font-bold">Create your workspace</h1>
          <p className="mt-2 text-sm text-white/85">Set up your account and business in two quick steps.</p>
          <div className="mt-6 flex items-center gap-2 text-xs font-semibold">
            <span className={`rounded-full px-3 py-1 ${step === 1 ? "bg-white text-[#f53f64]" : "bg-white/20"}`}>1 Account</span>
            <span className="text-white/60">/</span>
            <span className={`rounded-full px-3 py-1 ${step === 2 ? "bg-white text-[#f53f64]" : "bg-white/20"}`}>2 Business</span>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10">
          {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {step === 1 ? (
            <form onSubmit={continueToBusiness} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>First name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} required /></div>
                <div><label className={labelClass}>Last name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} required /></div>
              </div>
              <div><label className={labelClass}>Username</label><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} required autoComplete="username" /></div>
              <div><label className={labelClass}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required minLength={8} autoComplete="new-password" /></div>
                <div><label className={labelClass}>Confirm password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} required autoComplete="new-password" /></div>
              </div>
              <button className="mt-3 w-full rounded-xl bg-[#f53f64] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#e03050]">Continue to business setup</button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className={labelClass}>Business name</label><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} required autoFocus /></div>
              <div><label className={labelClass}>Address <span className="font-normal text-gray-400">(optional)</span></label><input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className={inputClass} /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Phone <span className="font-normal text-gray-400">(optional)</span></label><input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Currency</label><select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>{CURRENCIES.map(([code, , label]) => <option key={code} value={code}>{label}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Timezone</label><select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>{TIMEZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label className={labelClass}>Tax rate (%)</label><input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Low-stock alert</label><input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className={inputClass} /><p className="mt-1 text-xs text-gray-400">Alert when stock reaches this number.</p></div>
                <div><label className={labelClass}>POS product display</label><select value={posDisplay} onChange={(e) => setPosDisplay(e.target.value as typeof posDisplay)} className={inputClass}><option value="tiles">Tiles</option><option value="list">List</option><option value="gallery">Gallery</option></select></div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>POS and dashboard theme</label><select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)} className={inputClass}><option value="light">Light</option><option value="dark">Dark</option><option value="ocean">Ocean</option><option value="forest">Forest</option></select></div>
                <label className="flex items-center gap-3 self-end pb-3 text-sm text-gray-600"><input type="checkbox" checked={showTax} onChange={(e) => setShowTax(e.target.checked)} className="h-4 w-4 accent-[#f53f64]" /> Show tax on receipts</label>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Receipt header <span className="font-normal text-gray-400">(optional)</span></label><input value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} className={inputClass} placeholder="Welcome to our store" /></div>
                <div><label className={labelClass}>Receipt footer</label><input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} className={inputClass} /></div>
              </div>
              <div className="flex gap-3 pt-3"><button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600">Back</button><button disabled={loading} className="flex-1 rounded-xl bg-[#f53f64] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#e03050] disabled:opacity-50">{loading ? "Creating workspace..." : "Create workspace"}</button></div>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-gray-500">Already have an account? <Link href="/login" className="font-semibold text-[#f53f64] hover:text-[#e03050]">Sign in</Link></p>
        </div>
      </div>
    </main>
  );
}

function loadDefaultSettings() {
  return {
    currency: "UGX",
    currency_symbol: "UGX ",
    timezone: "UTC",
    tax_rate: 0,
    low_stock_threshold: 5,
    receipt_header: "",
    receipt_footer: "Thank you for your purchase!",
    receipt_show_tax: false,
    business_name: "Quick Sale",
    pos_display: "tiles" as const,
    theme: "light" as const,
    opening_balance: 0,
  };
}
