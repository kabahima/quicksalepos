"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import api from "@/lib/api";
import {
  useOnlineStatus,
  useQueueCount,
  useSyncStatus,
  triggerSync,
} from "@/lib/offline";

const POS_ROUTES    = ["/sales/pos"];
const PUBLIC_ROUTES = ["/login", "/register"];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
}

function isPOS(pathname: string) {
  return POS_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const [role, setRole]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── offline state ──────────────────────────────────────────────────────────
  const online      = useOnlineStatus();
  const queueCount  = useQueueCount();
  const syncState   = useSyncStatus();
  const prevOnline  = useRef(online);

  // Flush the queue the moment we come back online
  useEffect(() => {
    if (!prevOnline.current && online) {
      triggerSync();
    }
    prevOnline.current = online;
  }, [online]);

  // ── auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
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
        const res    = await api.get("/auth/me/");
        const member = res.data.members?.[0];
        if (member) {
          const userRole = member.role;
          localStorage.setItem("user_role", userRole);
          setRole(userRole);
        }
      } catch (e) {
        console.warn("Failed to fetch user", e);
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

  // ── render helpers ────────────────────────────────────────────────────────

  /** Thin bar shown at the very top of every page (except public routes) */
  const OfflineBanner = () => {
    if (isPublic(pathname)) return null;

    // Syncing toast — shown on reconnect
    if (syncState.status === "syncing") {
      return (
        <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-blue-600 py-1.5 text-xs font-semibold text-white shadow">
          <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
          Syncing {syncState.done}/{syncState.total} offline {syncState.total === 1 ? "operation" : "operations"}…
        </div>
      );
    }

    // "Done" toast
    if (syncState.status === "done" && syncState.synced > 0) {
      return (
        <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-green-600 py-1.5 text-xs font-semibold text-white shadow">
          ✓ Synced {syncState.synced} offline {syncState.synced === 1 ? "operation" : "operations"}
        </div>
      );
    }

    // Offline bar — persistent while disconnected
    if (!online) {
      return (
        <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white opacity-80 inline-block" />
            You&apos;re offline — changes will sync when connection is restored
          </span>
          {queueCount > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5">
              {queueCount} pending
            </span>
          )}
        </div>
      );
    }

    // Online but queue is non-empty (rare edge — show a subtle nudge)
    if (online && queueCount > 0 && syncState.status === "idle") {
      return (
        <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-2 bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white shadow">
          <span>{queueCount} operation{queueCount !== 1 ? "s" : ""} waiting to sync</span>
          <button
            onClick={triggerSync}
            className="rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30 transition"
          >
            Sync now
          </button>
        </div>
      );
    }

    return null;
  };

  // ── layouts ───────────────────────────────────────────────────────────────

  if (isPublic(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading…
      </div>
    );
  }

  // POS — full screen, no sidebar, but still show the offline banner
  if (isPOS(pathname)) {
    return (
      <>
        <OfflineBanner />
        {children}
      </>
    );
  }

  return (
    <>
      <OfflineBanner />
      {/* Push content down when the banner is visible */}
      <div
        className={`flex h-screen ${!online || queueCount > 0 ? "pt-8" : ""}`}
        style={{ transition: "padding-top 0.15s" }}
      >
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </>
  );
}
