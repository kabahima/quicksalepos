import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - Quick sale CRM",
  description: "Login to Quick sale CRM",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
