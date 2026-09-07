import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import {
  getActiveAnnouncements,
  getActiveCategories,
  getAllActiveProducts,
} from "@/lib/storefront/data";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const siteTitle = "dINS by Daniyal | Premium Pakistani Fashion";

export const metadata: Metadata = {
  metadataBase: new URL("https://dinsbydaniyal.com"),
  title: {
    default: siteTitle,
    template: "%s | dINS by Daniyal",
  },
  description:
    "Premium Pakistani fashion and embroidery. Jamawar, Cut-Dana embroidery, lawn and unstitched collections by dINS by Daniyal.",
  applicationName: "dINS by Daniyal",
  keywords: [
    "Pakistani fashion",
    "Jamawar",
    "embroidery",
    "Cut-Dana",
    "lawn",
    "unstitched",
    "dINS by Daniyal",
  ],
  openGraph: {
    type: "website",
    locale: "en_PK",
    siteName: "dINS by Daniyal",
    title: siteTitle,
    description:
      "Premium Pakistani fashion and embroidery by dINS by Daniyal.",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description:
      "Premium Pakistani fashion and embroidery by dINS by Daniyal.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-ivory font-sans text-charcoal">
        <AnnouncementBar announcements={getActiveAnnouncements()} />
        <Navbar
          categories={getActiveCategories()}
          products={getAllActiveProducts()}
        />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer categories={getActiveCategories()} />
      </body>
    </html>
  );
}