import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aptos Velociraptr | 160K+ TPS Visualized",
  description: "Learn how Aptos processes 160,000+ transactions per second. Interactive visualizations of Block-STM, Raptr consensus, Quorum Store, and the Move VM execution pipeline.",
  keywords: ["Aptos", "blockchain", "consensus", "TPS", "Block-STM", "Raptr", "Velociraptr", "Move VM", "visualization"],
  authors: [{ name: "SeamMoney" }],
  creator: "SeamMoney",
  publisher: "SeamMoney",
  metadataBase: new URL("https://velociraptr.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Aptos Velociraptr",
    title: "Aptos Velociraptr | 160K+ TPS Visualized",
    description: "Learn how Aptos processes 160,000+ transactions per second with interactive visualizations.",
    images: [
      {
        url: "https://aptos-consensus-visualizer.vercel.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Aptos Velociraptr Banner"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Aptos Velociraptr | 160K+ TPS Visualized",
    description: "Learn how Aptos processes 160,000+ transactions per second with interactive visualizations.",
    creator: "@AptosNetwork",
    images: ["https://aptos-consensus-visualizer.vercel.app/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
