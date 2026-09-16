"use client";

import { useEffect, useState } from "react";
import { Plus, Search, ShieldCheck, UserPlus } from "lucide-react";
import api from "@/lib/api";

interface TeamMember {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
  };
  business: {
    id: number;
    name: string;
  };
  role: string;
  stations?: number[];
}

interface Station {
  id: number;
  name: string;
}

function formatMemberError(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const messages = value.map(formatMemberError).filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(" ") : null;
  }
  if (value && typeof value === "object") {
    const messages = Object.entries(value)
      .map(([field, detail]) => {
        const message = formatMemberError(detail);
        return message ? `${field}: ${message}` : null;
      })
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join("\n") : null;
  }
  return null;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [businessId, setBusinessId] = useState("1");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("cashier");
  const [selectedStations, setSelectedStations] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const [bizRes, userRes] = await Promise.all([api.get("/businesses/"), api.get("/auth/me/")]);
        const businesses = bizRes.data.results || bizRes.data;
        if (Array.isArray(businesses) && businesses.length > 0) {
          const bid = String(businesses[0].id);
          setBusinessId(bid);
          const [memRes, stRes] = await Promise.all([
            api.get("/members/", { params: { business: bid } }),
            api.get("/stations/", { params: { business: bid } }),
          ]);
          const loadedMembers = (memRes.data.results || memRes.data).map((m: TeamMember) => ({
            ...m,
            stations: m.stations || [],
          }));
          const loadedStations = (stRes.data.results || stRes.data).sort((a: Station, b: Station) => a.name.localeCompare(b.name));
          if (businesses[0].owner === userRes.data.id && !loadedMembers.some((m: TeamMember) => m.role === "owner" && m.user.id === userRes.data.id)) {
            loadedMembers.unshift({
              id: -Number(businesses[0].id),
              user: { ...userRes.data, first_name: userRes.data.first_name || "", last_name: userRes.data.last_name || "", is_active: true },
              business: { id: businesses[0].id, name: businesses[0].name },
              role: "owner",
              stations: loadedStations.map((station: Station) => station.id),
            });
          }
          setMembers(loadedMembers);
          setStations(loadedStations);
        }
      } catch {
        console.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const trimmedPin = pin.trim();
    if (!trimmedUsername) {
      const message = "Username is required.";
      setError(message);
      window.alert(message);
      return;
    }
    if (!trimmedPassword && !trimmedPin) {
      const message = "Enter either a password or a PIN.";
      setError(message);
      window.alert(message);
      return;
    }
    if (trimmedPassword && trimmedPassword.length < 8) {
      const message = "Password must be at least 8 characters.";
      setError(message);
      window.alert(message);
      return;
    }
    if (!trimmedPassword && !/^\d{4,12}$/.test(trimmedPin)) {
      const message = "PIN must contain 4 to 12 digits.";
      setError(message);
      window.alert(message);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/members/", {
        business: parseInt(businessId),
        username: trimmedUsername,
        ...(trimmedPassword ? { password: trimmedPassword } : { pin: trimmedPin }),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        role: role || "cashier",
        stations: selectedStations,
      });
      setMembers((prev) => [...prev, { ...res.data, stations: [] }]);
      setShowForm(false);
      setUsername("");
      setPassword("");
      setPin("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setSelectedStations([]);
      setRole("cashier");
    } catch (err) {
      const responseData = (err as { response?: { data?: unknown } })?.response?.data;
      const message = formatMemberError(responseData) || "Failed to create team account.";
      setError(message);
      window.alert(`Could not create team account:\n\n${message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStation = async (memberId: number, stationId: number) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const has = member.stations?.includes(stationId);
    const next = has
      ? (member.stations || []).filter((id) => id !== stationId)
      : [...(member.stations || []), stationId];
    try {
      await api.patch(`/members/${memberId}/`, { stations: next });
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, stations: next } : m));
    } catch (err) {
      console.error("Failed to update stations", err);
    }
  };

  const filteredMembers = members.filter((member) =>
    member.user.username.toLowerCase().includes(search.toLowerCase()) ||
    member.user.email.toLowerCase().includes(search.toLowerCase()) ||
    member.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#252525]">Team & access</h1>
          <p className="mt-1 text-sm text-[#999999]">Manage staff accounts, roles, and station permissions.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center rounded-md bg-[#f53f64] px-4 py-2 text-white hover:bg-[#e03050]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow border border-[#eeeeee]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6f7] text-[#f53f64]"><UserPlus className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-semibold text-[#252525]">Create team account</h2><p className="text-xs text-[#999999]">The member can sign in immediately with these credentials.</p></div>
          </div>
          {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleAddMember} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[#252525]">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525]">Password <span className="text-xs font-normal text-[#999999]">(optional if using PIN)</span></label>
              <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]" required={!pin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#252525]">PIN <span className="text-xs font-normal text-[#999999]">(4-12 digits, optional)</span></label>
              <input type="password" inputMode="numeric" pattern="[0-9]{4,12}" minLength={4} maxLength={12} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]" required={!password} />
            </div>
            <div><label className="block text-sm font-medium text-[#252525]">First name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2" /></div>
            <div><label className="block text-sm font-medium text-[#252525]">Last name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2" /></div>
            <div><label className="block text-sm font-medium text-[#252525]">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2" /></div>
            <div>
              <label className="block text-sm font-medium text-[#252525]">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[#eeeeee] px-3 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[#252525]">Station access</label>
              <div className="flex flex-wrap gap-2">
                {stations.map((station) => {
                  const selected = selectedStations.includes(station.id);
                  return <button key={station.id} type="button" onClick={() => setSelectedStations((current) => selected ? current.filter((id) => id !== station.id) : [...current, station.id])} className={`rounded-lg px-3 py-2 text-xs font-semibold ${selected ? "bg-[#f53f64] text-white" : "bg-gray-100 text-gray-600"}`}>{station.name}</button>;
                })}
                {!stations.length && <span className="text-xs text-[#999999]">Create a station in Settings first.</span>}
              </div>
            </div>
            <div className="flex items-end md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#f53f64] px-4 py-2 text-white hover:bg-[#e03050] disabled:opacity-50 transition"
              >
                {saving ? "Creating..." : "Create account"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg bg-white shadow border border-[#eeeeee]">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
            <input
              type="text"
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-[#eeeeee] pl-10 pr-4 py-2 focus:border-[#f53f64] focus:outline-none focus:ring-[#f53f64]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#eeeeee]">
            <thead className="bg-[#fff6f7]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Business</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Stations</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#999999] uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeeeee]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-[#999999]">Loading...</td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-[#999999]">No team members found</td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-[#fff6f7]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-[#252525]">{member.user.first_name || member.user.last_name ? `${member.user.first_name} ${member.user.last_name}`.trim() : member.user.username}</p>
                        <p className="text-xs text-[#999999]">@{member.user.username}</p>
                        <p className="text-sm text-[#999999]">{member.user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[#999999]">{member.business.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-[#f53f64]/10 text-[#f53f64]">
                        <ShieldCheck className="mr-1 h-3 w-3" />{member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${member.user.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{member.user.is_active ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {member.role === "owner" ? (
                          <span className="text-xs font-semibold text-[#f53f64]">All stations</span>
                        ) : stations.map((s) => {
                          const active = member.stations?.includes(s.id);
                          return (
                            <button key={s.id} type="button" onClick={() => toggleStation(member.id, s.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                                active ? "bg-[#f53f64] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}>
                              {s.name}
                            </button>
                          );
                        })}
                        {stations.length === 0 && (
                          <span className="text-xs text-[#999999]">No stations</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
