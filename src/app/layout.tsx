import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aptos Velociraptr | 160K+ TPS Visualized",
  description: "Learn how Aptos processes 160,000+ transactions per second. Interactive visualizations of Block-STM, Raptr consensus, Quorum Store, and the Move VM execution pipeline.",
  keywords: ["Aptos", "blockchain", "consensus", "TPS", "Block-STM", "Raptr", "Velociraptr", "Move VM", "visualization", "parallel execution", "BFT", "cryptocurrency"],
  authors: [{ name: "SeamMoney" }],
  creator: "SeamMoney",
  publisher: "SeamMoney",
  metadataBase: new URL("https://aptos-consensus-visualizer.vercel.app"),
  alternates: {
    canonical: "https://aptos-consensus-visualizer.vercel.app",
  },
  category: "technology",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Aptos Velociraptr",
    title: "Aptos Velociraptr | 160K+ TPS Visualized",
    description: "Learn how Aptos processes 160,000+ transactions per second with interactive visualizations.",
    images: [
      {
        url: "https://aptos-consensus-visualizer.vercel.app/og-banner.png",
        width: 1200,
        height: 630,
        alt: "Aptos Velociraptr Banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aptos Velociraptr | 160K+ TPS Visualized",
    description: "Learn how Aptos processes 160,000+ transactions per second with interactive visualizations.",
    creator: "@AptosNetwork",
    images: ["https://aptos-consensus-visualizer.vercel.app/og-banner.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Aptos Velociraptr Visualizer",
  description: "Interactive visualizations explaining how Aptos blockchain achieves 160,000+ transactions per second using Block-STM parallel execution, Raptr consensus, and Move VM.",
  url: "https://aptos-consensus-visualizer.vercel.app",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Organization",
    name: "SeamMoney",
    url: "https://github.com/SeamMoney",
  },
  about: {
    "@type": "Thing",
    name: "Aptos Blockchain",
    url: "https://aptoslabs.com",
    description: "Layer 1 blockchain with parallel execution and sub-second finality",
  },
  educationalUse: "Interactive learning",
  learningResourceType: "Interactive visualization",
  keywords: "Aptos, Block-STM, Velociraptr, Raptr consensus, Move VM, blockchain, TPS, parallel execution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
