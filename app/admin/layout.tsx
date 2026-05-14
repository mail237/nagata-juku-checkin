import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "永田塾 入退室管理",
  description: "永田塾 入退室スキャン・管理",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
