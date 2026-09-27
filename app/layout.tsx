import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { StorefrontProvider } from "@/components/storefront/storefront-provider";

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

const siteTitle = "DINS by Daniyal | Premium Pakistani Fashion";

export const metadata: Metadata = {
  metadataBase: new URL("https://dinsbydaniyal.com"),
  title: {
    default: siteTitle,
    template: "%s | DINS by Daniyal",
  },
  description:
    "Premium Pakistani fashion and embroidery. Jamawar, Cut-Dana embroidery, lawn and unstitched collections by DINS by Daniyal.",
  applicationName: "DINS by Daniyal",
  keywords: [
    "Pakistani fashion",
    "Jamawar",
    "embroidery",
    "Cut-Dana",
    "lawn",
    "unstitched",
    "DINS by Daniyal",
  ],
  openGraph: {
    type: "website",
    locale: "en_PK",
    siteName: "DINS by Daniyal",
    title: siteTitle,
    description: "Premium Pakistani fashion and embroidery by DINS by Daniyal.",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: "Premium Pakistani fashion and embroidery by DINS by Daniyal.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
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
        <StorefrontProvider>{children}</StorefrontProvider>
      </body>
    </html>
  );
}
