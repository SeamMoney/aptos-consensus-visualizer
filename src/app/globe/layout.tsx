import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Global Validator Network | Aptos Velociraptr",
  description: "Watch Aptos consensus in real-time. See 140+ validators across 19 countries processing blocks every 100ms with live arcs showing block propagation.",
  openGraph: {
    title: "Aptos Global Validator Network",
    description: "Watch Aptos consensus in real-time across 140+ validators worldwide",
    type: "website",
    siteName: "Aptos Velociraptr",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aptos Global Validator Network",
    description: "Watch Aptos consensus in real-time across 140+ validators worldwide",
  },
};

export default function GlobeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
