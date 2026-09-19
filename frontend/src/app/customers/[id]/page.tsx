"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, DollarSign, History } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { loadSettings } from "@/lib/settings";

interface CustomerDetail {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  total_purchases: string;
  amount_paid: string;
  outstanding_balance: string;
  credit_limit: string;
  available_credit: string;
  created_at: string;
}

interface Payment {
  id: number;
  amount: string;
  payment_method: string;
  reference: string;
  notes: string;
  created_at: string;
  created_by: { username: string };
}

interface Sale {
  id: number;
  date: string;
  total_amount: string;
  payment_method: string;
  receipt_number: string;
  items: Array<{ item_name: string; quantity: number; unit_price: string; total: string }>;
}

interface Transaction {
  id: number;
  type: "sale" | "payment";
  date: string;
  description: string;
  amount: number;
  balance: number;
  payment_method?: string;
  receipt_number?: string;
  items?: Array<{ item_name: string; quantity: number; unit_price: string; total: string }>;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");
  const [businessId, setBusinessId] = useState<number>(1);
  const [editingCredit, setEditingCredit] = useState(false);
  const [creditLimitInput, setCreditLimitInput] = useState("");

  useEffect(() => {
    api.get("/businesses/").then((res) => {
      const businesses = res.data.results || res.data;
      if (Array.isArray(businesses) && businesses.length > 0) {
        setBusinessId(businesses[0].id);
      }
    }).catch((err) => console.warn("Failed to load business", err));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const s = loadSettings();
        if (s.currency_symbol) setCurrencySymbol(s.currency_symbol);
        const numericCustomerId = Number(customerId);

        if (!Number.isInteger(numericCustomerId) || numericCustomerId <= 0) {
          return;
        }

        const [custRes, payRes, salesRes] = await Promise.all([
          api.get(`/customers/${numericCustomerId}/`),
          api.get("/customer-payments/", {
            params: { customer: numericCustomerId },
          }),
          api.get("/sales/", {
            params: { customer: numericCustomerId },
          }),
        ]);
        const customerData = custRes.data;
        setCustomer(customerData);
        const salesData = (salesRes.data.results || salesRes.data) as Sale[];
        const paymentsData = payRes.data.results || payRes.data;

        const txs: Transaction[] = [];
        let runningBalance = parseFloat(customerData.outstanding_balance) || 0;

        salesData.forEach((sale) => {
          const amount = parseFloat(sale.total_amount) || 0;
          runningBalance -= amount;
          txs.push({
            id: sale.id,
            type: "sale",
            date: sale.date,
            description: `Sale ${sale.receipt_number}`,
            amount,
            balance: Math.max(runningBalance, 0),
            payment_method: sale.payment_method,
            receipt_number: sale.receipt_number,
            items: sale.items,
          });
        });

        paymentsData.forEach((payment: Payment) => {
          const amount = parseFloat(payment.amount) || 0;
          runningBalance += amount;
          txs.push({
            id: payment.id,
            type: "payment",
            date: payment.created_at,
            description: `Payment via ${payment.payment_method.replace(/_/g, " ")}`,
            amount: -amount,
            balance: Math.max(runningBalance, 0),
            payment_method: payment.payment_method,
          });
        });

        txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(txs);
      } catch (err) {
        console.warn("Failed to load customer details", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customerId]);

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !paymentAmount) return;
    setSaving(true);
    try {
      await api.post("/customer-payments/", {
        customer: customer.id,
        business: businessId,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        notes: paymentNotes,
      });
      setShowPaymentForm(false);
      setPaymentAmount("");
      setPaymentNotes("");
      const [custRes, payRes, salesRes] = await Promise.all([
        api.get(`/customers/${customerId}/`),
        api.get(`/customer-payments/?customer=${customerId}`),
        api.get(`/sales/?customer=${customerId}`),
      ]);
      const customerData = custRes.data;
      setCustomer(customerData);
      const salesData = (salesRes.data.results || salesRes.data) as Sale[];
      const paymentsData = payRes.data.results || payRes.data;

      const txs: Transaction[] = [];
      let runningBalance = parseFloat(customerData.outstanding_balance) || 0;
      salesData.forEach((sale) => {
        const amount = parseFloat(sale.total_amount) || 0;
        runningBalance -= amount;
        txs.push({
          id: sale.id,
          type: "sale",
          date: sale.date,
          description: `Sale ${sale.receipt_number}`,
          amount,
          balance: Math.max(runningBalance, 0),
          payment_method: sale.payment_method,
          receipt_number: sale.receipt_number,
          items: sale.items,
        });
      });
      paymentsData.forEach((payment: Payment) => {
        const amount = parseFloat(payment.amount) || 0;
        runningBalance += amount;
        txs.push({
          id: payment.id,
          type: "payment",
          date: payment.created_at,
          description: `Payment via ${payment.payment_method.replace(/_/g, " ")}`,
          amount: -amount,
          balance: Math.max(runningBalance, 0),
          payment_method: payment.payment_method,
        });
      });
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txs);
    } catch (err) {
      console.warn("Failed to record payment", err);
      alert("Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-[#f53f64] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64 text-[#999999] text-sm">
        Customer not found.
      </div>
    );
  }

  const outstanding = parseFloat(customer.outstanding_balance) || 0;
  const creditLimit = parseFloat(customer.credit_limit) || 0;
  const available = Math.max(creditLimit - outstanding, 0);

  const saveCreditLimit = async () => {
    const newLimit = parseFloat(creditLimitInput) || 0;
    setSaving(true);
    try {
      const res = await api.patch(`/customers/${customer.id}/`, {
        credit_limit: newLimit,
      });
      setCustomer({ ...res.data });
      setEditingCredit(false);
      setCreditLimitInput("");
    } catch (err) {
      alert("Failed to update credit limit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers" className="flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-gray-500">Customer Details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Credit Limit</p>
            {!editingCredit && (
              <button onClick={() => { setCreditLimitInput(String(creditLimit)); setEditingCredit(true); }}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">
                Edit
              </button>
            )}
          </div>
          {editingCredit ? (
            <div className="space-y-2">
              <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-blue-200 bg-white">
                <span className="flex-shrink-0 px-2 text-xs text-blue-500">{currencySymbol}</span>
                <input
                  type="number" min={0} step="0.01"
                  value={creditLimitInput}
                  onChange={(e) => setCreditLimitInput(e.target.value)}
                  className="flex-1 py-1.5 pr-2 text-sm bg-transparent outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveCreditLimit} disabled={saving}
                  className="flex-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setEditingCredit(false); setCreditLimitInput(""); }}
                  className="flex-1 px-2 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-900">{currencySymbol}{creditLimit.toFixed(2)}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-orange-600">{currencySymbol}{outstanding.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Available Credit</p>
          <p className={`text-2xl font-bold ${available > 0 ? "text-green-600" : available < 0 ? "text-red-600" : "text-gray-500"}`}>
            {currencySymbol}{available.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Phone</p>
            <p className="font-medium text-gray-900">{customer.phone || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{customer.email || "-"}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-gray-500">Address</p>
            <p className="font-medium text-gray-900">{customer.address || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Purchases</p>
            <p className="font-medium text-gray-900">{currencySymbol}{parseFloat(customer.total_purchases).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Paid</p>
            <p className="font-medium text-gray-900">{currencySymbol}{parseFloat(customer.amount_paid).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          </div>
          {outstanding > 0 && (
            <button onClick={() => setShowPaymentForm(true)}
              className="flex items-center gap-1.5 bg-[#f53f64] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#e03050] transition">
              <DollarSign className="h-3.5 w-3.5" /> Record Payment
            </button>
          )}
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400">No transactions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <tr key={`${tx.type}-${tx.id}`}>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        tx.type === "sale"
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                        {tx.type === "sale" ? "Debit" : "Credit"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {tx.description}
                      {tx.payment_method && tx.type === "sale" && (
                        <span className="block text-[10px] text-gray-400 capitalize">{tx.payment_method.replace(/_/g, " ")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {tx.items && tx.items.length > 0 ? (
                        <div className="space-y-1">
                          {tx.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="text-[10px] text-gray-500">
                              {item.quantity} x {item.item_name} @ {currencySymbol}{parseFloat(item.unit_price).toFixed(2)}
                            </div>
                          ))}
                          {tx.items.length > 3 && (
                            <div className="text-[10px] text-gray-400">+{tx.items.length - 3} more</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                      tx.type === "sale" ? "text-red-600" : "text-green-600"
                    }`}>
                      {tx.type === "sale" ? "+" : "-"}{currencySymbol}{Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-gray-800 whitespace-nowrap">
                      {currencySymbol}{tx.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Record Payment</h3>
            <p className="text-sm text-gray-500 mb-4">
              Outstanding balance: <span className="font-semibold text-orange-600">{currencySymbol}{outstanding.toFixed(2)}</span>
            </p>
            <form onSubmit={submitPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]"
                  required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f53f64] bg-white">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input type="text" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f53f64]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#f53f64] text-white rounded-xl text-sm font-bold hover:bg-[#e03050] disabled:opacity-40 transition">
                  {saving ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
