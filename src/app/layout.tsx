import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Results Management System",
  description: "School results management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sw" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
