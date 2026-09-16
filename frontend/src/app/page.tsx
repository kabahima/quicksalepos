"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Search, Bell, Calendar, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import { loadSettings, formatCurrency } from "@/lib/settings";

interface DashboardData {
  sales_today: number;
  sales_week: number;
  sales_month: number;
  expenses_today: number;
  expenses_month: number;
  profit_month: number;
  cash_balance: number;
  customer_balances: number;
  supplier_balances: number;
  stock_value: number;
  recent_transactions: Array<{
    type: string;
    description: string;
    amount: number;
    date: string;
  }>;
}

interface DailyData {
  date: string;
  total: number;
  count: number;
}

interface TopItem {
  item_name: string;
  total_qty: number;
  total_revenue: number;
}

interface SalesReportData {
  daily: DailyData[];
  top_items: TopItem[];
}

const PRODUCT_COLORS = ["#f3c64c", "#d9a7ff", "#b9ebeb", "#ef9bd2", "#9b6df5"];

const chartMargin = { top: 5, right: 0, left: 0, bottom: 0 };

const tooltipStyle = {
  backgroundColor: "rgba(31, 37, 49, 0.92)",
  border: "none",
  borderRadius: "6px",
  fontSize: "10px",
  padding: "4px 8px",
};

const axisTick = { fontSize: 9, fill: "#a2a6ae" };

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function computeTrend(
  daily: DailyData[],
  metric: "total" | "count",
): number | null {
  if (!daily || daily.length < 2) return null;
  const sorted = [...daily].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const thisPeriod = sorted.slice(0, 7);
  const lastPeriod = sorted.slice(7, 14);
  const thisSum = thisPeriod.reduce(
    (acc, d) => acc + Number(d[metric] ?? 0),
    0,
  );
  const lastSum = lastPeriod.reduce(
    (acc, d) => acc + Number(d[metric] ?? 0),
    0,
  );
  if (!lastSum) return null;
  return ((thisSum - lastSum) / lastSum) * 100;
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span
      className={`text-[9px] font-semibold ${
        positive ? "text-emerald-500" : "text-red-400"
      }`}
    >
      {positive ? "↗" : "↘"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function CreateBusinessForm({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/businesses/", {
        name,
        address,
        phone,
        email,
      });
      onCreated(String(res.data.id));
    } catch {
      setError("Failed to create business. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow border border-[#eeeeee]">
        <h2 className="text-2xl font-bold text-[#252525] mb-2">
          Welcome!
        </h2>
        <p className="text-[#999999] mb-6 text-sm">
          Set up your business to get started.
        </p>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#252525]">
              Business Name <span className="text-[#f53f64]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#252525]">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#252525]">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-[#f53f64] px-4 py-2 text-white hover:bg-[#e03050] disabled:opacity-50 transition"
          >
            {saving ? "Creating..." : "Create Business"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  trendLabel,
  bgClass,
  children,
}: {
  title: string;
  value: string;
  trend?: number | null;
  trendLabel?: string;
  bgClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-sm ${
        bgClass ?? "bg-white"
      }`}
    >
      <div className="text-[10px] font-medium text-[var(--color-slate)]">
        {title}
      </div>
      <div className="mt-1 text-xl font-bold text-[var(--color-ink)]">
        {value}
      </div>
      {(trend !== undefined && trend !== null) && (
        <div className="mt-2 flex items-center gap-1 text-[9px]">
          <TrendBadge value={trend} />
          {trendLabel && (
            <span className="text-[var(--color-slate)]">{trendLabel}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function SalesLineChart({
  data,
}: {
  data: DailyData[] | null;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-[var(--color-slate)]">
        No sales data available
      </div>
    );
  }

  const chartData = data
    .slice(-10)
    .map((d) => ({
      date: formatDate(d.date),
      total: Number(d.total),
    }));

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={chartMargin}>
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={{ color: "#fff", fontSize: "10px" }}
            labelStyle={{ color: "#d1d5db", fontSize: "10px" }}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            tickFormatter={(v) => `$${Math.round(v)}`}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--chart-purple)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function OrdersRevenueChart({
  data,
}: {
  data: DailyData[] | null;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-[var(--color-slate)]">
        No data available
      </div>
    );
  }

  const chartData = data
    .slice(-10)
    .map((d) => ({
      date: formatDate(d.date),
      total: Number(d.total),
      count: Number(d.count),
    }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
        >
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={{ color: "#fff", fontSize: "10px" }}
            labelStyle={{ color: "#d1d5db", fontSize: "10px" }}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            tickFormatter={(v) => `$${Math.round(v)}`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="total"
            stroke="var(--chart-purple)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="count"
            stroke="var(--chart-amber)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueExpensesDonut({
  data,
}: {
  data: DashboardData;
}) {
  const revenue = Number(data.sales_month);
  const expenses = Number(data.expenses_month);
  const margin =
    revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;

  const pieData = [
    { name: "Revenue", value: revenue },
    { name: "Expenses", value: expenses },
  ].filter((item) => item.value > 0);

  if (pieData.length === 0) {
    return (
      <div className="relative h-36 w-36">
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)]">
              —
            </div>
            <div className="text-[8px] text-[var(--color-slate)]">
              No data
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-36 w-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={72}
            paddingAngle={2}
            strokeWidth={0}
          >
            <Cell fill="var(--chart-purple)" />
            <Cell fill="var(--chart-amber)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-xl font-bold text-[var(--color-ink)]">
            {margin >= 0 ? "+" : ""}
            {margin.toFixed(0)}%
          </div>
          <div className="text-[8px] text-[var(--color-slate)]">
            Profit Margin
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductList({
  items,
}: {
  items: TopItem[] | null;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="space-y-2 text-[11px]">
        <p className="text-[var(--color-slate)]">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-[11px]">
      {items.map((item, i) => {
        const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length];
        return (
          <div
            key={item.item_name}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-6 w-6 rounded-lg"
                style={{ backgroundColor: `${color}20` }}
              />
              <span className="text-[var(--color-ink)]">
                {item.item_name}
              </span>
            </span>
            <b className="text-[var(--color-slate)]">
              {Number(item.total_qty).toFixed(0)} sold
            </b>
          </div>
        );
      })}
    </div>
  );
}

function RecentTransactions({
  transactions,
  currencySymbol,
}: {
  transactions: DashboardData["recent_transactions"];
  currencySymbol: string;
}) {
  if (!transactions || transactions.length === 0) {
    return (
      <p className="text-[var(--color-slate)]">
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 last:border-b-0"
        >
          <div>
            <p className="font-medium text-[var(--color-ink)]">
              {tx.description}
            </p>
            <p className="text-xs text-[var(--color-slate)]">
              {tx.date}
            </p>
          </div>
          <span
            className={`font-semibold ${
              tx.type === "sale"
                ? "text-emerald-500"
                : "text-red-500"
            }`}
          >
            {tx.type === "sale" ? "+" : "-"}
            {formatCurrency(tx.amount, currencySymbol)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [currencySymbol, setCurrencySymbol] = useState(() =>
    loadSettings().currency_symbol || "UGX ",
  );
  const [theme] = useState<ReturnType<typeof loadSettings>["theme"]>(
    () => loadSettings().theme,
  );
  const [businessChecked, setBusinessChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalOrders = salesReport
    ? salesReport.daily.reduce(
        (acc, d) => acc + Number(d.count ?? 0),
        0,
      )
    : 0;

  const revenueTrend = computeTrend(
    salesReport?.daily ?? [],
    "total",
  );
  const ordersTrend = computeTrend(
    salesReport?.daily ?? [],
    "count",
  );

  useEffect(() => {
    const loadBusinessId = async () => {
      try {
        const response = await api.get("/businesses/");
        const businesses = response.data.results || response.data;
        const first = Array.isArray(businesses)
          ? businesses[0]
          : null;
        if (first?.id) {
          setBusinessId(String(first.id));
          if (first.currency_symbol)
            setCurrencySymbol(first.currency_symbol);
          if (first.name) setBusinessName(first.name);
        } else {
          setBusinessId(null);
        }
      } catch (error) {
        console.error("Failed to load business", error);
        setBusinessId(null);
      } finally {
        setBusinessChecked(true);
      }
    };
    const s = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s.currency_symbol) setCurrencySymbol(s.currency_symbol);
    loadBusinessId();
  }, []);

  const fetchDashboard = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const response = await api.get("/dashboard/", {
        params: { business: businessId },
      });
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch dashboard", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    if (!businessId) return;
    try {
      const reportRes = await api.get("/reports/sales/", {
        params: { business: businessId },
      });
      setSalesReport(reportRes.data);
    } catch (error) {
      console.error("Failed to fetch reports", error);
    }
  };

  useEffect(() => {
    if (!businessChecked) return;
    if (!businessId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    fetchDashboard();
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, businessChecked]);

  if (!businessChecked || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading...
      </div>
    );
  }

  if (!businessId) {
    return (
      <CreateBusinessForm
        onCreated={(id) => {
          setBusinessId(id);
          setBusinessChecked(true);
        }}
      />
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        Failed to load dashboard
      </div>
    );
  }

  const displayName = businessName || "there";

  return (
    <div
      className={`app-theme-${theme} -m-8 min-h-full space-y-6 p-8`}
    >
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Welcome, {displayName} 👋
          </h1>
          <p className="mt-1 text-[11px] text-[var(--color-slate)]">
            Here&apos;s what&apos;s happening in your store.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-xl bg-white text-gray-500 shadow-sm">
            <Search className="h-4 w-4" />
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-xl bg-white text-gray-500 shadow-sm">
            <Bell className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-medium text-[var(--color-slate)] shadow-sm">
            <Calendar className="h-3.5 w-3.5" />
            Last 7 days <ChevronDown className="h-3 w-3" />
          </button>
          <div className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-pink-300 to-purple-300"></div>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(data.sales_week, currencySymbol)}
          trend={revenueTrend}
          trendLabel="WoW"
          bgClass="bg-[var(--panel-yellow)]"
        />
        <MetricCard
          title="Total Orders"
          value={totalOrders.toLocaleString()}
          trend={ordersTrend}
          trendLabel="WoW"
          bgClass="bg-[var(--panel-purple)]"
        />
        <MetricCard
          title="Customer Balances"
          value={formatCurrency(
            data.customer_balances,
            currencySymbol,
          )}
          trend={null}
          bgClass="bg-[var(--panel-cyan)]"
        />
        <MetricCard
          title="Sales (Month)"
          value={formatCurrency(data.sales_month, currencySymbol)}
          trend={null}
          bgClass="bg-white"
        >
          <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] text-[var(--color-slate)]">
            <span>{formatCurrency(data.sales_today, currencySymbol)}</span>
            <span>{formatCurrency(data.sales_week, currencySymbol)}</span>
            <span>{formatCurrency(data.sales_month, currencySymbol)}</span>
          </div>
        </MetricCard>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.7fr]">
        {/* Left Column */}
        <section className="min-w-0 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">
              Sales Overview
            </h2>
            <p className="text-[11px] text-[var(--color-slate)] mt-0.5">
              Daily revenue trends over the last 10 days
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--color-ink)]">
                Daily Sales
              </h3>
              <div className="flex gap-3 text-[9px] text-[var(--color-slate)]">
                <span>
                  <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--chart-purple)]"></i>
                  Revenue
                </span>
              </div>
            </div>
            <SalesLineChart data={salesReport?.daily ?? null} />
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold text-[var(--color-ink)]">
              Recent Transactions
            </h3>
            <RecentTransactions
              transactions={data.recent_transactions}
              currencySymbol={currencySymbol}
            />
          </div>
        </section>

        {/* Right Column */}
        <section className="min-w-0 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">
              Orders & Profit
            </h2>
            <p className="text-[11px] text-[var(--color-slate)] mt-0.5">
              Orders count and revenue side by side
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--color-ink)]">
                Revenue & Orders
              </h3>
              <div className="flex gap-3 text-[9px] text-[var(--color-slate)]">
                <span>
                  <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--chart-purple)]"></i>
                  Revenue
                </span>
                <span>
                  <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--chart-amber)]"></i>
                  Orders
                </span>
              </div>
            </div>
            <OrdersRevenueChart data={salesReport?.daily ?? null} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold text-[var(--color-ink)]">
                Revenue vs Expenses
              </h3>
              <RevenueExpensesDonut data={data} />
              <div className="mt-3 space-y-1.5 text-[9px] text-[var(--color-slate)]">
                <div className="flex justify-between">
                  <span>
                    <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--chart-purple)]"></i>
                    Revenue
                  </span>
                  <b className="text-[var(--color-ink)]">
                    {formatCurrency(data.sales_month, currencySymbol)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>
                    <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--chart-amber)]"></i>
                    Expenses
                  </span>
                  <b className="text-[var(--color-ink)]">
                    {formatCurrency(data.expenses_month, currencySymbol)}
                  </b>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold text-[var(--color-ink)]">
                Top Selling Products
              </h3>
              <ProductList items={salesReport?.top_items ?? null} />
            </div>
          </div>
        </section>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-[10px] font-medium text-[var(--color-slate)]">
            Cash Balance
          </div>
          <div className="mt-1 text-xl font-bold text-[var(--color-ink)]">
            {formatCurrency(data.cash_balance, currencySymbol)}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-[10px] font-medium text-[var(--color-slate)]">
            Supplier Balances
          </div>
          <div className="mt-1 text-xl font-bold text-[var(--color-ink)]">
            {formatCurrency(data.supplier_balances, currencySymbol)}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-[10px] font-medium text-[var(--color-slate)]">
            Profit (Month)
          </div>
          <div
            className={`mt-1 text-xl font-bold ${
              data.profit_month >= 0
                ? "text-emerald-500"
                : "text-red-500"
            }`}
          >
            {formatCurrency(data.profit_month, currencySymbol)}
          </div>
        </div>
      </div>
    </div>
  );
}
