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
  title: { default: "TradeHax Intel: free options flow, dark pool prints and market news", template: "%s · TradeHax Intel" },
  description:
    "Free options flow, dealer gamma, off-exchange prints, insider and Congress filings, and auto-written market news. Delayed public data, clearly labeled. Not investment advice.",
  // "./" resolves to each route, so every page gets its own canonical URL.
  alternates: { canonical: "./" },
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
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION?.trim()
    ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION.trim() } }
    : {}),
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
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT.trim()}`}
            crossOrigin="anonymous"
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
