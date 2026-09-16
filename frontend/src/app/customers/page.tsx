"use client";

import { useEffect, useState } from "react";
import { Plus, Search, DollarSign, Eye } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { loadSettings } from "@/lib/settings";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  total_purchases: string;
  amount_paid: string;
  outstanding_balance: string;
  credit_limit: string;
  available_credit: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(() => loadSettings().currency_symbol || "UGX ");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.get("/customers/");
      setCustomers(response.data.results || response.data);
    } catch (error) {
      console.error("Failed to fetch customers", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers();
    const s = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s.currency_symbol) setCurrencySymbol(s.currency_symbol);
  }, []);

  const openPaymentForm = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentNotes("");
    setShowPaymentForm(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;
    setSaving(true);
    try {
      await api.post("/customer-payments/", {
        customer: selectedCustomer.id,
        business: (customers[0]?.id ? parseInt(customers[0].id.toString()) : 1),
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        notes: paymentNotes,
      });
      setShowPaymentForm(false);
      fetchCustomers();
    } catch (err) {
      console.error("Failed to record payment", err);
      alert("Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <Link href="/customers/new" className="flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          New Customer
        </Link>
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 pl-10 pr-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Purchases</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit Limit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available Credit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const outstanding = parseFloat(customer.outstanding_balance) || 0;
                  const available = parseFloat(customer.available_credit) || 0;
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/customers/${customer.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                          {customer.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{customer.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{currencySymbol}{parseFloat(customer.total_purchases).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{currencySymbol}{parseFloat(customer.credit_limit).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-orange-600">{currencySymbol}{outstanding.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-green-600">{currencySymbol}{available.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap flex items-center gap-2">
                        <Link href={`/customers/${customer.id}`}
                          className="flex items-center gap-1 text-xs bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">
                          <Eye className="h-3 w-3" /> View
                        </Link>
                        {outstanding > 0 && (
                          <button onClick={() => openPaymentForm(customer)}
                            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 transition">
                            <DollarSign className="h-3 w-3" /> Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPaymentForm && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Record Payment - {selectedCustomer.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Outstanding balance: <span className="font-semibold text-orange-600">{currencySymbol}{(parseFloat(selectedCustomer.outstanding_balance) || 0).toFixed(2)}</span></p>
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
