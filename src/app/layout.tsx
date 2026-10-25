import type { Metadata } from "next";
import { NotificationViewport } from "@/components/ui/notification-viewport";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ndulungu Secondary School (Ndulungu SS) | Results Management System",
    template: "%s | Ndulungu Secondary School",
  },
  description:
    "The official website of Ndulungu Secondary School (Ndulungu SS), also known as Ndulungu RMS. Manage school results, students, and academic information.",
  applicationName: "Ndulungu RMS",
  keywords: [
    "Ndulungu SS",
    "Ndulungu Secondary School",
    "Ndulungu RMS",
    "Ndulungu school results",
    "Ndulungu results",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_TZ",
    siteName: "Ndulungu Secondary School",
    title: "Ndulungu Secondary School (Ndulungu SS)",
    description:
      "The official website of Ndulungu Secondary School and its results management system (Ndulungu RMS).",
  },
  twitter: {
    card: "summary",
    title: "Ndulungu Secondary School (Ndulungu SS)",
    description:
      "The official website of Ndulungu Secondary School and its results management system.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <NotificationViewport />
      </body>
    </html>
  );
}
