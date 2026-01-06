import { Metadata } from "next";

const baseUrl = "https://aptos-consensus-visualizer.vercel.app";

export const metadata: Metadata = {
  title: "Global Validator Network | Aptos Velociraptr",
  description: "Watch Aptos consensus in real-time. See 140+ validators across 19 countries processing blocks every 100ms with live arcs showing block propagation.",
  openGraph: {
    title: "Aptos Global Validator Network",
    description: "Watch Aptos consensus in real-time across 140+ validators worldwide",
    type: "website",
    siteName: "Aptos Velociraptr",
    url: `${baseUrl}/globe`,
    images: [
      {
        url: `${baseUrl}/globe/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Aptos Global Validator Network - Real-time consensus visualization",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aptos Global Validator Network",
    description: "Watch Aptos consensus in real-time across 140+ validators worldwide",
    images: [`${baseUrl}/globe/twitter-image`],
  },
};

export default function GlobeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
