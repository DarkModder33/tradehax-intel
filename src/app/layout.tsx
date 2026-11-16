import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { RegisterSw } from "@/components/register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tradehaxai.tech"),
  title: { default: "TradeHax Intel", template: "%s · TradeHax Intel" },
  description:
    "A ranked briefing of bullish and bearish setups across a watchlist, with the reason each signal fired and where the timeframes agree.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "TradeHax Intel",
    description: "Delayed quotes, options flow, and a research desk. Not a recommendation.",
    siteName: "TradeHax Intel",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeHax Intel",
    description: "Delayed quotes, options flow, and a research desk. Not a recommendation.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} dark h-full antialiased`}
    >
      <body className="min-h-full pb-16 md:pb-0">
        <RegisterSw />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "TradeHax Intel",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              url: "https://tradehaxai.tech",
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
