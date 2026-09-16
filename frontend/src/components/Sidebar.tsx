"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  Truck,
  Wallet,
  BarChart3,
  FileText,
  UsersRound,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { loadSettings } from "@/lib/settings";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "POS",
    href: "/sales/pos",
    icon: ShoppingBag,
    roles: ["owner", "manager", "cashier", "accountant"],
  },
  {
    name: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Expenses",
    href: "/expenses",
    icon: Receipt,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Stock Taking",
    href: "/stock",
    icon: Package,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Customers",
    href: "/customers",
    icon: Users,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Cash Book",
    href: "/cashbook",
    icon: Wallet,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Receipts",
    href: "/receipts",
    icon: FileText,
    roles: ["owner", "manager", "accountant"],
  },
  {
    name: "Team",
    href: "/team",
    icon: UsersRound,
    roles: ["owner", "manager"],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["owner", "manager"],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });

  const theme = loadSettings().theme;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(localStorage.getItem("user_role"));
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  const visibleItems = navigation.filter(
    (item) => !role || item.roles.includes(role),
  );

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
  };

  return (
    <aside
      className={`app-theme-${theme} flex h-screen flex-col border-r border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="relative flex h-16 shrink-0 items-center px-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 text-white">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold">Quick Sale</span>
          </div>
        )}
        {collapsed && (
          <div className="absolute left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 text-white">
            <LayoutDashboard className="h-4 w-4" />
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="absolute top-1/2 right-3 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-md text-[var(--theme-muted-text)] transition-colors hover:bg-[var(--theme-muted-surface)] hover:text-[var(--theme-text)]"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto py-3">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" &&
              pathname.startsWith(`${item.href}/`) &&
              !(
                item.href === "/customers" &&
                pathname.startsWith("/customers/credit-debit")
              ));

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`mx-3 flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[var(--theme-accent)] text-white"
                  : "text-[var(--theme-muted-text)] hover:bg-[var(--theme-muted-surface)] hover:text-[var(--theme-text)]"
              } ${collapsed ? "justify-center" : "gap-3"}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--theme-border)] py-3">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`mx-3 flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--theme-muted-text)] transition-all duration-200 hover:bg-[var(--theme-muted-surface)] hover:text-[var(--theme-text)] ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
