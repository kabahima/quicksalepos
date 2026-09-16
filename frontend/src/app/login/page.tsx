"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import axios from "axios";
import { Hash, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState("");
  const [loginMethod, setLoginMethod] = useState<"password" | "pin">("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegister] = useState(() =>
    typeof window === "undefined" || localStorage.getItem("qs_account_created") !== "true"
  );

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const formData = new URLSearchParams();
      formData.set("username", username.trim());
      // The API authenticates both a regular password and a PIN through the same credential field.
      formData.set("password", credential);

      const response = await api.post("/auth/token/", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);

      const [userRes, bizRes] = await Promise.all([
        api.get("/auth/me/"),
        api.get("/businesses/"),
      ]);

      const member = userRes.data.members?.[0];
      if (member) localStorage.setItem("user_role", member.role);

      // cache business settings so currency/receipt config is available app-wide
      const businesses = bizRes.data.results || bizRes.data;
      if (businesses?.length > 0) {
        const biz = businesses[0];
        const { saveSettings } = await import("@/lib/settings");
        saveSettings({
          currency:            biz.currency            ?? "UGX",
          currency_symbol:     biz.currency_symbol     ?? "UGX ",
          timezone:            biz.timezone            ?? "UTC",
          tax_rate:            parseFloat(biz.tax_rate)|| 0,
          low_stock_threshold: biz.low_stock_threshold ?? 5,
          receipt_header:      biz.receipt_header      ?? "",
          receipt_footer:      biz.receipt_footer      ?? "Thank you for your purchase!",
          receipt_show_tax:    biz.receipt_show_tax    ?? false,
          business_name:       biz.name                ?? "Quick Sale",
          pos_display:         "tiles",
          theme:               "light",
        });
      }

      router.replace("/");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Login request failed:", {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });

        const detail = error.response?.data?.detail;
        setError(
          typeof detail === "string"
            ? detail
            : "Unable to sign in. Please check your username and password.",
        );
      } else {
        setError("Unable to sign in. Please try again.");
      }

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff6f7] flex items-center justify-center p-4">
  <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl border border-[#eeeeee]">
    <div className="grid min-h-[650px] md:grid-cols-2">

      {/* LEFT - POS BUSINESS IMAGE */}
      <div className="relative hidden md:block overflow-hidden">

        <img
          src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85"
          alt="Cashier serving a customer at a retail store"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Dark/Pink overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#7d1730]/90 via-[#f53f64]/30 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">

          {/* Logo */}
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl font-bold text-[#f53f64] shadow-lg">
              Q
            </div>
          </div>

          {/* Bottom content */}
          <div className="max-w-md">
            <div className="mb-4 inline-flex rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur-md">
              Point of Sale
            </div>

            <h2 className="text-4xl font-bold leading-tight">
              Sell smarter.
              <br />
              Grow faster.
            </h2>

            <p className="mt-4 text-base leading-7 text-white/85">
              Manage your sales, serve customers and keep your business
              running smoothly from one simple POS platform.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT - LOGIN */}
      <div className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">

          {/* Mobile Logo */}
          <div className="mb-8 text-center">

            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[#f53f64] text-2xl font-bold text-white shadow-md">
              Q
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#252525]">
              Welcome back
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Sign in to continue to your POS account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#252525]">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="block w-full rounded-lg border border-[#dddddd] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#f53f64] focus:ring-2 focus:ring-[#f53f64]/10"
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-[#252525]">
                  {loginMethod === "pin" ? "PIN" : "Password"}
                </label>

                <a
                  href="/forgot-password"
                  className="text-sm font-medium text-[#f53f64] hover:text-[#e03050]"
                >
                  Forgot password?
                </a>
              </div>

              <input
                  type={loginMethod === "pin" ? "tel" : "password"}
                  inputMode={loginMethod === "pin" ? "numeric" : "text"}
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder={loginMethod === "pin" ? "Enter your PIN" : "Enter your password"}
                className="block w-full rounded-lg border border-[#dddddd] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#f53f64] focus:ring-2 focus:ring-[#f53f64]/10"
                required
              />
                <div className="mt-3 flex justify-center gap-3">
                  <button type="button" onClick={() => { setLoginMethod("password"); setCredential(""); }}
                    title="Use password"
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${loginMethod === "password" ? "bg-[#fff0f2] text-[#f53f64]" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}>
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Use password
                  </button>
                  <button type="button" onClick={() => { setLoginMethod("pin"); setCredential(""); }}
                    title="Use PIN"
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${loginMethod === "pin" ? "bg-[#fff0f2] text-[#f53f64]" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}>
                    <Hash className="h-3.5 w-3.5" />
                    Use PIN
                  </button>
                </div>
            </div>

            {/* Remember */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-[#f53f64] focus:ring-[#f53f64]"
              />

              <label
                htmlFor="remember"
                className="ml-2 text-sm text-gray-600"
              >
                Remember me
              </label>
            </div>

            {/* Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#f53f64] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#e03050] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#f53f64]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

          </form>

          {showRegister && (
            <p className="mt-8 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-[#f53f64] hover:text-[#e03050]">
                Create an account
              </Link>
            </p>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">
            © 2026 Quick Sale CRM. All rights reserved.
          </p>

        </div>
      </div>

    </div>
  </div>
</div>
  );
}
