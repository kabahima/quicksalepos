"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import api from "@/lib/api";

const POS_ROUTES = ["/sales/pos"];
const PUBLIC_ROUTES = ["/login", "/register"];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isPOS(pathname: string) {
  return POS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Don't run auth logic on public routes
    if (isPublic(pathname)) {
      setLoading(false);
      return;
    }

    const storedRole = localStorage.getItem("user_role");
    setRole(storedRole);

    if (storedRole) {
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await api.get("/auth/me/");
        const member = res.data.members?.[0];
        if (member) {
          const userRole = member.role;
          localStorage.setItem("user_role", userRole);
          setRole(userRole);
        }
      } catch (e) {
        console.error("Failed to fetch user", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [pathname]);

  useEffect(() => {
    if (isPublic(pathname) || loading || !role) return;
    if (role === "cashier" && !isPOS(pathname)) {
      window.location.href = "/sales/pos";
    }
  }, [role, loading, pathname]);

  // Public routes (login etc.) — no sidebar, no auth gate
  if (isPublic(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // POS route — full screen, no sidebar
  if (isPOS(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
