import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Ndulungu Secondary School (Ndulungu SS) | Results Management System",
    template: "%s | Ndulungu Secondary School",
  },
  description:
    "Tovuti rasmi ya Ndulungu Secondary School (Ndulungu SS), pia ikijulikana kama Ndulungu RMS. Mfumo wa usimamizi wa matokeo, wanafunzi na taarifa za masomo.",
  applicationName: "Ndulungu RMS",
  keywords: [
    "Ndulungu SS",
    "Ndulungu Secondary School",
    "Ndulungu RMS",
    "Ndulungu school results",
    "matokeo Ndulungu",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "sw_TZ",
    siteName: "Ndulungu Secondary School",
    title: "Ndulungu Secondary School (Ndulungu SS)",
    description:
      "Tovuti rasmi ya Ndulungu Secondary School na mfumo wake wa usimamizi wa matokeo (Ndulungu RMS).",
  },
  twitter: {
    card: "summary",
    title: "Ndulungu Secondary School (Ndulungu SS)",
    description:
      "Tovuti rasmi ya Ndulungu Secondary School na mfumo wake wa usimamizi wa matokeo.",
  },
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
