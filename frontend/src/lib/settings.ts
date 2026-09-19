/**
 * Global settings store — loaded once after login, used throughout the app.
 * Written to localStorage so it survives page refreshes without an extra API call.
 */

export interface AppSettings {
  currency: string;
  currency_symbol: string;
  timezone: string;
  tax_rate: number;
  low_stock_threshold: number;
  receipt_header: string;
  receipt_footer: string;
  receipt_show_tax: boolean;
  business_name: string;
  pos_display: "tiles" | "list" | "gallery";
  theme: "light" | "dark" | "ocean" | "forest";
  opening_balance: number;
}

const KEY = "qs_settings";

const DEFAULTS: AppSettings = {
  currency: "UGX",
  currency_symbol: "UGX ",
  timezone: "UTC",
  tax_rate: 0,
  low_stock_threshold: 5,
  receipt_header: "",
  receipt_footer: "Thank you for your purchase!",
  receipt_show_tax: false,
  business_name: "Quick Sale",
  pos_display: "tiles",
  theme: "light",
  opening_balance: 0,
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

export function saveSettings(s: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function formatCurrency(amount: number, symbol?: string): string {
  const sym = symbol ?? loadSettings().currency_symbol;
  return `${sym}${amount.toFixed(2)}`;
}
