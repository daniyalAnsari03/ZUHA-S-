import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "dINS by Daniyal | Premium Pakistani Fashion",
    template: "%s | dINS by Daniyal",
  },
  description:
    "Premium Pakistani fashion and embroidery. Jamawar, Cut-Dana embroidery, lawn and unstitched collections by dINS by Daniyal.",
  applicationName: "dINS by Daniyal",
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
        {children}
      </body>
    </html>
  );
}
